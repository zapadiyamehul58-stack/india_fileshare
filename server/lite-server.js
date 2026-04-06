import express from 'express';
import cors from 'cors';
import AWS from 'aws-sdk';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

const statusEvents = new EventEmitter();
statusEvents.setMaxListeners(100);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ═══════════════════════════════════════════════════════════════
//  CORS — single, exhaustive configuration
// ═══════════════════════════════════════════════════════════════
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ETag', 'Range', 'X-Requested-With'],
    exposedHeaders: ['ETag', 'Content-Length', 'Content-Range', 'Content-Disposition'],
    credentials: true
}));

// Increased limits for Ultra processing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ═══════════════════════════════════════════════════════════════
//  NETWORK IP DETECTION — for cross-device share links
// ═══════════════════════════════════════════════════════════════
function getLocalNetworkIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const LOCAL_IP = getLocalNetworkIP();
const PORT = 3001;
const FRONTEND_PORT = 8080;

// ═══════════════════════════════════════════════════════════════
//  FILE STORAGE — Persistent local storage
// ═══════════════════════════════════════════════════════════════
const UPLOADS_DIR = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Static files for direct downloads with optimized headers
app.use('/local-files', express.static(UPLOADS_DIR, {
    setHeaders: (res) => {
        res.set('Content-Disposition', 'attachment');
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Cache-Control', 'public, max-age=3600');
    }
}));

// ═══════════════════════════════════════════════════════════════
//  S3 CONFIGURATION (optional)
// ═══════════════════════════════════════════════════════════════
const useS3 = process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_ENDPOINT;
const s3 = useS3 ? new AWS.S3({
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    signatureVersion: 'v4',
    s3ForcePathStyle: true,
}) : null;

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'flashshare-lite';

// ═══════════════════════════════════════════════════════════════
//  FILE REGISTRY — Persistent JSON file database
// ═══════════════════════════════════════════════════════════════
const FILE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REGISTRY_FILE = path.join(__dirname, 'registry.json');
let fileRegistry = new Map();

const saveRegistry = () => {
    try {
        const obj = Object.fromEntries(fileRegistry);
        fs.writeFileSync(REGISTRY_FILE, JSON.stringify(obj, null, 2));
    } catch (e) {
        console.error('[Registry] Save failed:', e);
    }
};

const loadRegistry = () => {
    try {
        if (fs.existsSync(REGISTRY_FILE)) {
            const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
            const obj = JSON.parse(data);
            fileRegistry = new Map(Object.entries(obj));

            // Recovery: fix files stuck in merging/uploading state
            for (const [id, file] of fileRegistry) {
                if (file.status === 'merging' || file.status === 'uploading') {
                    const filePath = path.join(UPLOADS_DIR, file.key);
                    if (fs.existsSync(filePath)) {
                        console.log(`[Registry] Recovered stalled file: ${file.name}`);
                        file.status = 'ready';
                        file.localPath = file.key;
                    } else {
                        file.status = 'idle';
                    }
                }
            }

            // Cleanup: remove expired files
            const now = Date.now();
            for (const [id, file] of fileRegistry) {
                const expiresAt = file.createdAt + FILE_EXPIRY_MS;
                if (now > expiresAt) {
                    console.log(`[Cleanup] Expired file removed: ${file.name}`);
                    const filePath = path.join(UPLOADS_DIR, file.key);
                    if (fs.existsSync(filePath)) {
                        try { fs.unlinkSync(filePath); } catch (_) { }
                    }
                    fileRegistry.delete(id);
                }
            }

            saveRegistry();
            console.log(`[Registry] Loaded ${fileRegistry.size} active files.`);
        }
    } catch (e) {
        console.error('[Registry] Load failed:', e);
    }
};

loadRegistry();
const p2pSessions = new Map();

// ═══════════════════════════════════════════════════════════════
//  Periodic cleanup of expired files (runs every hour)
// ═══════════════════════════════════════════════════════════════
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, file] of fileRegistry) {
        const expiresAt = file.createdAt + FILE_EXPIRY_MS;
        if (now > expiresAt) {
            const filePath = path.join(UPLOADS_DIR, file.key);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (_) { }
            }
            fileRegistry.delete(id);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        saveRegistry();
        console.log(`[Cleanup] Removed ${cleaned} expired files.`);
    }
}, 3600000); // every hour

// ═══════════════════════════════════════════════════════════════
//  API: Health Check
// ═══════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mode: useS3 ? 's3' : 'local',
        files: fileRegistry.size,
        uptime: process.uptime(),
        networkIP: LOCAL_IP,
        storageDir: UPLOADS_DIR,
        storageDirExists: fs.existsSync(UPLOADS_DIR),
    });
});

// ═══════════════════════════════════════════════════════════════
//  API: Get server network info (for share link generation)
// ═══════════════════════════════════════════════════════════════
app.get('/api/network-info', (req, res) => {
    res.json({
        ip: LOCAL_IP,
        backendPort: PORT,
        frontendPort: FRONTEND_PORT,
        backendUrl: `http://${LOCAL_IP}:${PORT}`,
        frontendUrl: `http://${LOCAL_IP}:${FRONTEND_PORT}`,
    });
});

// ═══════════════════════════════════════════════════════════════
//  1. Initialize Upload
// ═══════════════════════════════════════════════════════════════
app.post('/api/upload/init', async (req, res) => {
    const { name, type, size, fileId: forcedFileId } = req.body;
    const fileId = forcedFileId || nanoid(10);
    const storageKey = `${fileId}-${name.replace(/\s+/g, '_')}`;

    try {
        console.log(`[Init] Starting upload for: ${name} (${size} bytes) | ID: ${fileId}`);

        // Save to registry immediately
        fileRegistry.set(fileId, {
            name,
            type,
            size,
            status: 'uploading',
            createdAt: Date.now(),
            key: storageKey,
            downloads: 0,
        });
        saveRegistry();

        if (useS3) {
            const multiPartUpload = await s3.createMultipartUpload({
                Bucket: BUCKET_NAME,
                Key: `lite/${storageKey}`,
                ContentType: type,
            }).promise();

            res.json({
                uploadId: multiPartUpload.UploadId,
                key: storageKey,
                fileId,
                mode: 's3'
            });
        } else {
            res.json({
                uploadId: 'local',
                key: storageKey,
                fileId,
                mode: 'local'
            });
        }
    } catch (error) {
        console.error('[Init Error]:', error);
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  2. Generate Signed / Local Upload URL
// ═══════════════════════════════════════════════════════════════
app.post('/api/upload/sign-part', async (req, res) => {
    const { uploadId, key, partNumber, mode } = req.body;
    try {
        if (mode === 's3') {
            const url = await s3.getSignedUrlPromise('uploadPart', {
                Bucket: BUCKET_NAME,
                Key: `lite/${key}`,
                PartNumber: partNumber,
                UploadId: uploadId,
                Expires: 3600,
            });
            res.json({ url });
        } else {
            // Use current host for local mode to support network access
            const host = req.get('host') || `${LOCAL_IP}:${PORT}`;
            const protocol = req.protocol || 'http';
            res.json({ url: `${protocol}://${host}/api/upload/local-chunk?key=${key}&part=${partNumber}` });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  Local chunk upload endpoint
// ═══════════════════════════════════════════════════════════════
app.put('/api/upload/local-chunk', express.raw({ limit: '30mb', type: '*/*' }), (req, res) => {
    const { key, part } = req.query;
    try {
        const filePath = path.join(UPLOADS_DIR, `${key}.part${part}`);
        fs.writeFileSync(filePath, req.body);
        console.log(`[Upload] Chunk ${part} received for ${key}`);

        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Expose-Headers', 'ETag');
        res.set('ETag', `chunk-${part}`);

        res.json({ success: true, partNumber: part });
    } catch (err) {
        console.error('[Chunk Error]:', err);
        res.status(500).end();
    }
});

// ═══════════════════════════════════════════════════════════════
//  3. Complete Upload — merge chunks into final file
// ═══════════════════════════════════════════════════════════════
app.post('/api/upload/complete', async (req, res) => {
    const { uploadId, key, parts, fileId, mode, metadata } = req.body;
    try {
        console.log(`[Complete] Finalizing ${key}...`);

        // Metadata Recovery: If server was restarted, re-create the entry
        if (!fileRegistry.has(fileId) && metadata) {
            console.log(`[Complete] Recovering missing metadata for ${fileId}`);
            fileRegistry.set(fileId, {
                ...metadata,
                status: 'merging',
                createdAt: Date.now(),
                key: key,
                downloads: 0,
            });
            saveRegistry();
        }

        if (mode === 's3') {
            await s3.completeMultipartUpload({
                Bucket: BUCKET_NAME,
                Key: `lite/${key}`,
                UploadId: uploadId,
                MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
            }).promise();
            if (fileRegistry.has(fileId)) {
                fileRegistry.get(fileId).status = 'ready';
                saveRegistry();
                statusEvents.emit(`ready:${fileId}`);
            }
        } else {
            // Streaming merge for arbitrarily large files
            const finalPath = path.join(UPLOADS_DIR, key);
            const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);

            if (fileRegistry.has(fileId)) fileRegistry.get(fileId).status = 'merging';
            console.log(`[Ultra-Merge] Initializing stream merge for ${key} (${sortedParts.length} chunks)`);

            if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
            const writeStream = fs.createWriteStream(finalPath);

            const mergeChunks = async (index) => {
                if (index >= sortedParts.length) {
                    writeStream.end();
                    return;
                }

                const p = sortedParts[index];
                const partPath = path.join(UPLOADS_DIR, `${key}.part${p.PartNumber}`);

                if (!fs.existsSync(partPath)) {
                    writeStream.destroy();
                    throw new Error(`Critical: Part ${p.PartNumber} missing at disk.`);
                }

                return new Promise((resolve, reject) => {
                    const readStream = fs.createReadStream(partPath);
                    readStream.pipe(writeStream, { end: false });

                    readStream.on('end', () => {
                        fs.unlinkSync(partPath); // Clean up immediately
                        resolve(mergeChunks(index + 1));
                    });

                    readStream.on('error', (err) => {
                        writeStream.destroy();
                        reject(err);
                    });
                });
            };

            await mergeChunks(0);

            // Verify the merged file exists and has correct size
            if (fileRegistry.has(fileId)) {
                const entry = fileRegistry.get(fileId);
                entry.localPath = key;
                entry.status = 'ready';

                // Verify file integrity
                if (fs.existsSync(finalPath)) {
                    const stat = fs.statSync(finalPath);
                    entry.actualSize = stat.size;
                    console.log(`[Verify] File ${key}: expected=${entry.size}, actual=${stat.size}`);
                }

                saveRegistry();
                statusEvents.emit(`ready:${fileId}`);
            }
        }

        // Build the share link using the real network IP
        const shareLink = `http://${LOCAL_IP}:${FRONTEND_PORT}/download/${fileId}`;
        const directDownloadLink = `http://${LOCAL_IP}:${PORT}/api/download/${fileId}`;

        console.log(`[Success] ${key} is ready for download.`);
        console.log(`[Share] Link: ${shareLink}`);
        console.log(`[Direct] Download: ${directDownloadLink}`);

        res.json({
            success: true,
            fileId,
            shareLink,
            directDownloadLink,
            networkIP: LOCAL_IP,
        });
    } catch (error) {
        console.error('[Complete Error]:', error);
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  Helper: Serve local file with streaming & range support
// ═══════════════════════════════════════════════════════════════
const serveFile = (file, res, req) => {
    if (!file.localPath) return res.status(404).json({ error: 'File path not linked' });
    const filePath = path.join(UPLOADS_DIR, file.localPath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Physical file missing from disk' });

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': chunksize,
            'Content-Type': file.type || 'application/octet-stream',
        });
        fileStream.pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': file.type || 'application/octet-stream'
        });
        fs.createReadStream(filePath).pipe(res);
    }
};

// ═══════════════════════════════════════════════════════════════
//  4. Download File — with smart wait for in-progress uploads
// ═══════════════════════════════════════════════════════════════
app.get('/api/download/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const file = fileRegistry.get(fileId);

        console.log(`[Download] Request for fileId: ${fileId}`);

        if (!file) {
            return res.status(404).json({
                error: 'File not found',
                message: 'This file does not exist, may have expired, or was deleted.'
            });
        }

        // Check expiry
        const expiresAt = file.createdAt + FILE_EXPIRY_MS;
        if (Date.now() > expiresAt) {
            return res.status(410).json({
                error: 'File expired',
                message: 'This file has expired and is no longer available.'
            });
        }

        if (useS3) {
            // S3 handling
        } else {
            if (file.status === 'uploading' || file.status === 'merging') {
                console.log(`[Download] File ${fileId} is busy (${file.status}). Waiting...`);

                const waitForReady = () => new Promise((resolve) => {
                    const timer = setTimeout(() => {
                        statusEvents.removeListener(`ready:${fileId}`, handler);
                        resolve(false);
                    }, 45000);

                    const handler = () => {
                        clearTimeout(timer);
                        resolve(true);
                    };
                    statusEvents.once(`ready:${fileId}`, handler);
                });

                const isReady = await waitForReady();
                if (!isReady) {
                    return res.status(202).json({
                        error: 'Stream incomplete',
                        status: file.status,
                        message: 'File is still uploading. Please try again in a moment.'
                    });
                }
            }

            // Validate file exists on disk
            const filePath = path.join(UPLOADS_DIR, file.localPath || file.key);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'File missing',
                    message: 'The file data is missing from disk. It may have been deleted.'
                });
            }

            // Increment download count
            file.downloads = (file.downloads || 0) + 1;
            saveRegistry();

            serveFile(file, res, req);
        }
    } catch (error) {
        console.error('[Download Error]:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════════════════════
//  5. File Metadata — for the download page UI
// ═══════════════════════════════════════════════════════════════
app.get('/api/metadata/:fileId', (req, res) => {
    const file = fileRegistry.get(req.params.fileId);
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Check expiry
    const expiresAt = file.createdAt + FILE_EXPIRY_MS;
    if (Date.now() > expiresAt) {
        return res.status(410).json({ error: 'File expired' });
    }

    // Validate physical file exists
    let fileExists = false;
    if (file.localPath || file.key) {
        const filePath = path.join(UPLOADS_DIR, file.localPath || file.key);
        fileExists = fs.existsSync(filePath);
    }

    res.json({
        id: req.params.fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: file.status,
        createdAt: file.createdAt,
        expiresAt: new Date(expiresAt).toISOString(),
        downloads: file.downloads || 0,
        fileExists,
        downloadUrl: `http://${LOCAL_IP}:${PORT}/api/download/${req.params.fileId}`,
    });
});

// ═══════════════════════════════════════════════════════════════
//  6. List all files (for debugging / admin)
// ═══════════════════════════════════════════════════════════════
app.get('/api/files', (req, res) => {
    const files = [];
    const now = Date.now();
    for (const [id, file] of fileRegistry) {
        const expiresAt = file.createdAt + FILE_EXPIRY_MS;
        if (now <= expiresAt && file.status === 'ready') {
            files.push({
                id,
                name: file.name,
                size: file.size,
                type: file.type,
                createdAt: file.createdAt,
                expiresAt: new Date(expiresAt).toISOString(),
                downloads: file.downloads || 0,
            });
        }
    }
    res.json({ files, total: files.length });
});

// ═══════════════════════════════════════════════════════════════
//  P2P Signaling Relay
// ═══════════════════════════════════════════════════════════════
app.post('/api/p2p/init', (req, res) => {
    const sessionId = nanoid(12);
    const { name, size, type } = req.body;
    p2pSessions.set(sessionId, {
        id: sessionId,
        name, size, type,
        signals: [],
        status: 'waiting',
        createdAt: Date.now()
    });
    res.json({ sessionId });
});

app.get('/api/p2p/status/:sessionId', (req, res) => {
    const session = p2pSessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session expired' });
    res.json(session);
});

app.post('/api/p2p/signal/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { signal } = req.body;
    const session = p2pSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session expired' });
    session.signals.push(signal);
    res.json({ success: true });
});

app.get('/api/p2p/signals/:sessionId', (req, res) => {
    const session = p2pSessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session expired' });
    res.json({ signals: session.signals });
});

// Clean up old P2P sessions
setInterval(() => {
    const now = Date.now();
    for (const [id, s] of p2pSessions) {
        if (now - s.createdAt > 3600000) p2pSessions.delete(id);
    }
}, 3600000);

// ═══════════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════════
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\x1b[36m%s\x1b[0m`, `\n  ╔══════════════════════════════════════════════════╗`);
    console.log(`\x1b[36m%s\x1b[0m`, `  ║   FlashShare Ultra — ${useS3 ? 'S3 Cloud' : 'Local Storage'} Mode           ║`);
    console.log(`\x1b[36m%s\x1b[0m`, `  ╠══════════════════════════════════════════════════╣`);
    console.log(`\x1b[36m%s\x1b[0m`, `  ║   Backend  :  http://${LOCAL_IP}:${PORT}             `);
    console.log(`\x1b[36m%s\x1b[0m`, `  ║   Frontend :  http://${LOCAL_IP}:${FRONTEND_PORT}             `);
    console.log(`\x1b[36m%s\x1b[0m`, `  ║   Files    :  ${fileRegistry.size} active | 7 day expiry       `);
    console.log(`\x1b[36m%s\x1b[0m`, `  ║   Storage  :  ${UPLOADS_DIR}`);
    console.log(`\x1b[36m%s\x1b[0m`, `  ╚══════════════════════════════════════════════════╝\n`);
});

// Configure for large transfers
server.timeout = 0;
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[Error] Port ${PORT} is already in use. Please close other instances.`);
        process.exit(1);
    } else {
        console.error('[Server Error]:', err);
    }
});
