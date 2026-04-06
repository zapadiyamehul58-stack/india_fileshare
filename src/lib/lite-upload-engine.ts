import { nanoid } from 'nanoid';

export interface LiteUploadStatus {
    progress: number;
    status: 'idle' | 'uploading' | 'completed' | 'error';
    link?: string;
    directDownloadLink?: string;
    error?: string;
    speed?: string;
    eta?: string;
    uploadedChunks?: number;
    totalChunks?: number;
}

export type LiteUploadCallback = (status: LiteUploadStatus) => void;

class LiteUploadEngine {
    private CHUNK_SIZE = 10 * 1024 * 1024; // 10MB Chunks
    private MAX_WORKERS = 6;

    private getApiBase(): string {
        const envUrl = import.meta.env.VITE_API_URL as string | undefined;
        if (envUrl && envUrl.trim()) return envUrl.trim();
        return `http://${window.location.hostname}:3001`;
    }

    private getFingerprint(file: File) {
        return `fs_lite_v2_${file.name}_${file.size}_${file.lastModified}`;
    }

    /**
     * Resolve the API base URL dynamically.
     * If VITE_API_URL contains localhost, replace it with the backend's
     * actual network IP so cross-device share links work.
     */
    private async resolveNetworkInfo(): Promise<{ backendUrl: string; frontendUrl: string } | null> {
        try {
            const res = await fetch(`${this.getApiBase()}/api/network-info`);
            if (res.ok) {
                return await res.json();
            }
        } catch {
            // Backend not reachable — fall back to window.location
        }
        return null;
    }

    async upload(file: File, callback: LiteUploadCallback, customFileId?: string) {
        const startTime = Date.now();
        const fingerprint = this.getFingerprint(file);
        let uploadedBytes = 0;
        const totalSize = file.size;

        try {
            callback({ progress: 0, status: 'uploading' });

            // === Resolve the real network info from the backend ===
            const networkInfo = await this.resolveNetworkInfo();

            // 1. Check for Auto-Resume Session
            const savedSession = localStorage.getItem(fingerprint);
            let sessionData = savedSession ? JSON.parse(savedSession) : null;

            if (sessionData) {
                console.log(`[UltraEngine] Found existing session for ${file.name}. Resuming...`);
            } else {
                console.log(`[UltraEngine] Initiating new upload: ${file.name}`);
                const initRes = await fetch(`${this.getApiBase()}/api/upload/init`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        fileId: customFileId
                    }),
                });

                if (!initRes.ok) {
                    const errTxt = await initRes.text();
                    throw new Error(`Initialization failed: ${errTxt || initRes.statusText}`);
                }
                sessionData = await initRes.json();
                sessionData.parts = [];
            }

            const { uploadId, key, fileId, mode, parts } = sessionData;
            const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);

            // Map of finished part numbers
            const finishedParts = new Set(parts.map((p: any) => p.PartNumber));
            const chunkIndexes = Array.from({ length: totalChunks }, (_, i) => i + 1)
                .filter(idx => !finishedParts.has(idx));

            uploadedBytes = (totalChunks - chunkIndexes.length) * this.CHUNK_SIZE;
            if (uploadedBytes > totalSize) uploadedBytes = totalSize;

            // 2. Upload chunks with persistent state updates and smarter retry
            const uploadChunk = async (partNumber: number, retry = 8) => {
                try {
                    const start = (partNumber - 1) * this.CHUNK_SIZE;
                    const end = Math.min(start + this.CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);

                    const signRes = await fetch(`${this.getApiBase()}/api/upload/sign-part`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uploadId, key, partNumber, mode }),
                    });

                    if (!signRes.ok) throw new Error(`Sign failed for part ${partNumber}`);

                    const { url } = await signRes.json();
                    // Fix URL if it's relative
                    const uploadUrl = (url.startsWith('/') && !url.startsWith('//'))
                        ? `${this.getApiBase()}${url}`
                        : url;

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 60000);

                    const uploadRes = await fetch(uploadUrl, {
                        method: 'PUT',
                        body: chunk,
                        headers: { 'Content-Type': 'application/octet-stream' },
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!uploadRes.ok) throw new Error(`Status ${uploadRes.status} on part ${partNumber}`);

                    const etag = uploadRes.headers.get('ETag') || `local-${partNumber}`;
                    const part = { ETag: etag.replace(/"/g, ''), PartNumber: partNumber };
                    parts.push(part);

                    // PERSIST PROGRESS
                    localStorage.setItem(fingerprint, JSON.stringify({ ...sessionData, parts }));

                    uploadedBytes += (end - start);
                    const elapsed = (Date.now() - startTime) / 1000;
                    const bytesPerSec = uploadedBytes / elapsed;
                    const speedMBps = (bytesPerSec / 1024 / 1024).toFixed(2);
                    const remainingBytes = totalSize - uploadedBytes;
                    const etaSecs = Math.round(remainingBytes / bytesPerSec);

                    callback({
                        progress: Math.min(99, Math.round((uploadedBytes / totalSize) * 100)),
                        status: 'uploading',
                        speed: speedMBps,
                        eta: etaSecs > 3600 ? "Calculating..." : `${etaSecs}s`,
                        uploadedChunks: parts.length,
                        totalChunks
                    });

                } catch (err: any) {
                    if (retry > 1) {
                        const delay = Math.pow(2, 9 - retry) * 1000;
                        console.warn(`[UltraEngine] Part ${partNumber} failed (${err.message}). Retrying in ${delay}ms...`);
                        await new Promise(r => setTimeout(r, delay));
                        return uploadChunk(partNumber, retry - 1);
                    }
                    throw err;
                }
            };

            // 3. Parallel Execution Queue
            const workers = Array.from({ length: this.MAX_WORKERS }, async () => {
                while (chunkIndexes.length > 0) {
                    const idx = chunkIndexes.shift();
                    if (idx !== undefined) await uploadChunk(idx);
                }
            });
            await Promise.all(workers);

            // 4. Final Completion & Cleanup
            console.log(`[UltraEngine] Finalizing ${fileId}...`);
            const completeRes = await fetch(`${this.getApiBase()}/api/upload/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uploadId,
                    key,
                    parts,
                    fileId,
                    mode,
                    metadata: {
                        name: file.name,
                        type: file.type,
                        size: file.size
                    }
                }),
            });

            if (!completeRes.ok) throw new Error('Final merge failed.');

            const completeData = await completeRes.json();

            localStorage.removeItem(fingerprint); // Clean up on success

            // === BUILD CROSS-DEVICE SHARE LINK ===
            // Priority: use server-provided link > network info > fallback to window.location
            let shareLink: string;
            let directDownloadLink: string;

            if (completeData.shareLink) {
                // Server already built the perfect link with the real IP
                shareLink = completeData.shareLink;
                directDownloadLink = completeData.directDownloadLink;
            } else if (networkInfo) {
                // Construct from network info
                shareLink = `${networkInfo.frontendUrl}/download/${fileId}`;
                directDownloadLink = `${networkInfo.backendUrl}/api/download/${fileId}`;
            } else {
                // Fallback: try to use current page's host (works if user opened via IP)
                const currentHost = window.location.hostname;
                const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';

                if (isLocalhost) {
                    // If opened via localhost, the link won't work on other devices
                    // but it's the best we can do without backend network info
                    shareLink = `${window.location.origin}/download/${fileId}`;
                    directDownloadLink = `${this.getApiBase()}/api/download/${fileId}`;
                } else {
                    // User opened via real IP — great, just use that
                    shareLink = `${window.location.origin}/download/${fileId}`;
                    directDownloadLink = `http://${currentHost}:3001/api/download/${fileId}`;
                }
            }

            console.log(`[UltraEngine] Share link: ${shareLink}`);
            callback({
                progress: 100,
                status: 'completed',
                link: shareLink,
                directDownloadLink,
            });

        } catch (err: any) {
            console.error('[Ultra Critical]:', err);
            callback({ progress: 0, status: 'error', error: err.message });
        }
    }
}

export const liteUploadEngine = new LiteUploadEngine();
