import { Peer, DataConnection } from 'peerjs';
import { nanoid } from 'nanoid';

export type P2PStatus = 'idle' | 'waiting' | 'connecting' | 'transferring' | 'completed' | 'error';

export interface P2PState {
    status: P2PStatus;
    progress: number;
    sessionId?: string;
    speed?: string;
    eta?: string;
    fileName?: string;
    fileSize?: number;
    error?: string;
}

class P2PEngine {
    private peer: Peer | null = null;
    private activeConnection: DataConnection | null = null;
    private sessionId: string | null = null;
    private CHUNK_SIZE = 128 * 1024; // 128KB chunks for high stability

    constructor() {
        if (typeof window !== 'undefined') {
            this.preWarm();
        }
    }

    preWarm() {
        if (!this.peer || this.peer.destroyed) {
            // No ID provided here; PeerJS will generate one or we set it later
            this.peer = new Peer({
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            this.peer.on('error', (err) => {
                console.error('[P2P Engine] Peer error:', err);
            });
        }
    }

    public getSessionId() { return this.sessionId; }

    async createSession(file: File, onUpdate: (state: P2PState) => void) {
        try {
            this.preWarm();

            // Wait for Peer ID
            if (!this.peer?.id) {
                await new Promise<string>((resolve) => {
                    this.peer?.on('open', resolve);
                });
            }

            this.sessionId = this.peer!.id;
            onUpdate({ status: 'waiting', progress: 0, sessionId: this.sessionId, fileName: file.name, fileSize: file.size });

            // Handle incoming connections (The receiver connects to us)
            this.peer!.on('connection', (conn) => {
                this.activeConnection = conn;
                this.handleSender(file, conn, onUpdate);
            });

        } catch (err: any) {
            onUpdate({ status: 'error', progress: 0, error: err.message });
        }
    }

    private handleSender(file: File, conn: DataConnection, onUpdate: (state: P2PState) => void) {
        conn.on('open', async () => {
            onUpdate({ status: 'transferring', progress: 0 });

            // Send metadata first
            conn.send({
                type: 'metadata',
                name: file.name,
                size: file.size,
                fileType: file.type
            });

            const startTime = Date.now();
            let offset = 0;

            const sendChunk = async () => {
                if (offset >= file.size) {
                    conn.send({ type: 'EOF' });
                    onUpdate({ status: 'completed', progress: 100 });
                    return;
                }

                // Check for buffer overflow to avoid memory issues
                // Note: PeerJS doesn't natively expose bufferedAmount like raw RTC, 
                // but we can trust its internal queuing or add a slight delay for huge files.

                const slice = file.slice(offset, offset + this.CHUNK_SIZE);
                const buffer = await slice.arrayBuffer();
                conn.send({ type: 'data', chunk: buffer });

                offset += buffer.byteLength;

                const now = Date.now();
                const elapsed = (now - startTime) / 1000 || 0.1;
                const speed = (offset / 1024 / 1024 / elapsed).toFixed(1);
                const progress = Math.min(Math.round((offset / file.size) * 100), 99);
                const eta = `${Math.round((file.size - offset) / (offset / elapsed))}s`;

                onUpdate({ status: 'transferring', progress, speed, eta });

                // Use setTimeout to allow the event loop to breathe for the UI
                if (offset % (this.CHUNK_SIZE * 10) === 0) {
                    setTimeout(sendChunk, 0);
                } else {
                    sendChunk();
                }
            };

            sendChunk();
        });

        conn.on('error', (err) => {
            onUpdate({ status: 'error', progress: 0, error: 'Connection lost' });
        });
    }

    async receiveSession(sessionId: string, onUpdate: (state: P2PState) => void, onFileReady: (file: File) => void) {
        try {
            this.preWarm();

            if (!this.peer?.id) {
                await new Promise<string>((resolve) => {
                    this.peer?.on('open', resolve);
                });
            }

            onUpdate({ status: 'connecting', progress: 0 });

            const conn = this.peer!.connect(sessionId, { reliable: true });
            this.activeConnection = conn;

            let receivedBuffers: ArrayBuffer[] = [];
            let metadata: any = null;
            let receivedSize = 0;
            let startTime = 0;

            conn.on('open', () => {
                onUpdate({ status: 'connecting', progress: 0 });
            });

            conn.on('data', (data: any) => {
                if (startTime === 0) startTime = Date.now();

                if (data.type === 'metadata') {
                    metadata = data;
                    onUpdate({ status: 'transferring', progress: 0, fileName: data.name, fileSize: data.size });
                } else if (data.type === 'data') {
                    receivedBuffers.push(data.chunk);
                    receivedSize += data.chunk.byteLength;

                    if (metadata) {
                        const elapsed = (Date.now() - startTime) / 1000 || 0.1;
                        const progress = Math.min(Math.round((receivedSize / metadata.size) * 100), 99);
                        const speed = (receivedSize / 1024 / 1024 / elapsed).toFixed(1);
                        onUpdate({ status: 'transferring', progress, speed, fileName: metadata.name });
                    }
                } else if (data.type === 'EOF') {
                    const finalFile = new File([new Blob(receivedBuffers)], metadata.name, { type: metadata.fileType });
                    onUpdate({ status: 'completed', progress: 100 });
                    onFileReady(finalFile);
                    conn.close();
                }
            });

            conn.on('error', (err) => {
                onUpdate({ status: 'error', progress: 0, error: 'Failed to connect to sender' });
            });

            // Set a timeout for connection
            setTimeout(() => {
                if (receivedSize === 0 && onUpdate) {
                    // onUpdate({ status: 'error', error: 'Connection timed out' });
                }
            }, 10000);

        } catch (err: any) {
            onUpdate({ status: 'error', progress: 0, error: err.message });
        }
    }
}

export const p2pEngine = new P2PEngine();
