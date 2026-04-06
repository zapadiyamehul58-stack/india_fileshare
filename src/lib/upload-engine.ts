import { generateFileId } from "./file-utils";

export interface UploadStatus {
    id: string;
    name: string;
    size: number;
    progress: number;
    speed: number; // bytes per second
    eta: number; // seconds remaining
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
    startTime: number;
}

export type UploadCallback = (status: UploadStatus) => void;

class HighSpeedUploadEngine {
    private activeUploads: Map<string, AbortController> = new Map();
    private CHUNK_SIZE = 8 * 1024 * 1024; // 8MB
    private MAX_CONCURRENT_CHUNKS = 20;
    private API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    async upload(file: File, callback: UploadCallback) {
        const id = generateFileId();
        const status: UploadStatus = {
            id,
            name: file.name,
            size: file.size,
            progress: 0,
            speed: 0,
            eta: 0,
            status: 'pending',
            startTime: Date.now(),
        };

        const abortController = new AbortController();
        this.activeUploads.set(id, abortController);

        this.startMultipartUpload(file, id, status, callback, abortController.signal);
        return id;
    }

    private async startMultipartUpload(
        file: File,
        id: string,
        status: UploadStatus,
        callback: UploadCallback,
        signal: AbortSignal
    ) {
        try {
            status.status = 'uploading';
            callback({ ...status });

            // 1. Initialize
            const initRes = await fetch(`${this.API_BASE}/api/upload/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
                signal
            });
            const { uploadId, key, fileId } = await initRes.json();

            const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
            const parts: { ETag: string; PartNumber: number }[] = [];
            let uploadedBytes = 0;

            // 2. Chunk Queue
            const chunkIndexes = Array.from({ length: totalChunks }, (_, i) => i + 1);
            const uploadPool = async () => {
                while (chunkIndexes.length > 0) {
                    if (signal.aborted) return;
                    const partNumber = chunkIndexes.shift()!;
                    const start = (partNumber - 1) * this.CHUNK_SIZE;
                    const end = Math.min(start + this.CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);

                    // Get signed URL
                    const signRes = await fetch(`${this.API_BASE}/api/upload/sign-part`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uploadId, key, partNumber }),
                        signal
                    });
                    const { url } = await signRes.json();

                    // Upload chunk direct to cloud
                    const uploadRes = await fetch(url, {
                        method: 'PUT',
                        body: chunk,
                        signal
                    });

                    if (!uploadRes.ok) throw new Error(`Chunk ${partNumber} failed`);

                    const etag = uploadRes.headers.get('ETag');
                    parts.push({ ETag: etag!.replace(/"/g, ''), PartNumber: partNumber });

                    uploadedBytes += (end - start);
                    const now = Date.now();
                    const elapsed = (now - status.startTime) / 1000;
                    status.progress = Math.round((uploadedBytes / file.size) * 100);
                    status.speed = uploadedBytes / elapsed;
                    status.eta = (file.size - uploadedBytes) / status.speed;

                    callback({ ...status });
                }
            };

            // Run parallel chunks
            const workers = Array.from({ length: Math.min(this.MAX_CONCURRENT_CHUNKS, totalChunks) }, uploadPool);
            await Promise.all(workers);

            if (signal.aborted) return;

            // 3. Complete
            const completeRes = await fetch(`${this.API_BASE}/api/upload/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uploadId, key, parts, fileId }),
                signal
            });

            if (!completeRes.ok) throw new Error('Failed to complete upload');

            status.progress = 100;
            status.status = 'completed';
            callback({ ...status });

        } catch (err: any) {
            if (err.name === 'AbortError') return;
            status.status = 'error';
            status.error = err.message || 'Upload failed';
            callback({ ...status });
        } finally {
            this.activeUploads.delete(id);
        }
    }

    cancel(id: string) {
        this.activeUploads.get(id)?.abort();
        this.activeUploads.delete(id);
    }
}

export const uploadEngine = new HighSpeedUploadEngine();
