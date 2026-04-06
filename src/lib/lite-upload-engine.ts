import { supabase } from "@/integrations/supabase/client";
import { nanoid } from 'nanoid';

export type LiteUploadStatus = {
    progress: number;
    status: 'idle' | 'uploading' | 'completed' | 'error' | 'resuming';
    speed?: string;
    eta?: string;
    link?: string;
    error?: string;
    parallelChunks?: number;
    fileId?: string;
};

class LiteUploadEngine {
    private CONCURRENCY = 6; // Increased to 6 workers for Mega-Parallelism
    private CHUNK_SIZE = 10 * 1024 * 1024; // 10MB Chunks for better responsiveness
    private BUCKET = 'flashshare-files';

    /**
     * High performance parallel chunk upload engine.
     * Uploads 100GB+ files smoothly to Cloud Storage.
     */
    async upload(file: File, callback: (status: LiteUploadStatus) => void) {
        try {
            const fileId = nanoid(10); // Predictable short ID
            const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
            let uploadedBytes = 0;
            let startTime = Date.now();

            // INSTANT LINK: Generate and share the link before the first byte is even sent!
            const instantLink = `${window.location.origin}/download/${fileId}?name=${encodeURIComponent(file.name)}&size=${file.size}`;

            callback({
                progress: 1, // Start at 1% for instant feedback
                status: 'uploading',
                parallelChunks: this.CONCURRENCY,
                link: instantLink,
                fileId
            });

            let currentChunkIdx = 0;
            const uploadWorker = async () => {
                while (currentChunkIdx < totalChunks) {
                    const idx = currentChunkIdx++;
                    const start = idx * this.CHUNK_SIZE;
                    const end = Math.min(start + this.CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);

                    let retries = 5;
                    let success = false;

                    while (retries > 0 && !success) {
                        try {
                            const { error } = await supabase.storage
                                .from(this.BUCKET)
                                .upload(`${fileId}/chunk_${idx}`, chunk, {
                                    cacheControl: '3600',
                                    upsert: true
                                });

                            if (error) throw error;

                            success = true;
                            uploadedBytes += chunk.size;

                            const now = Date.now();
                            const elapsed = (now - startTime) / 1000;
                            const speed = (uploadedBytes / 1024 / 1024 / elapsed).toFixed(1);
                            const progress = Math.min(Math.round((uploadedBytes / file.size) * 100), 99);

                            const remainingBytes = file.size - uploadedBytes;
                            const etaSec = remainingBytes / (uploadedBytes / elapsed);
                            const eta = etaSec > 3600
                                ? `${(etaSec / 3600).toFixed(1)}h`
                                : etaSec > 60
                                    ? `${Math.round(etaSec / 60)}m`
                                    : `${Math.round(etaSec)}s`;

                            callback({
                                status: 'uploading',
                                progress: Math.max(progress, 1),
                                speed,
                                eta,
                                parallelChunks: this.CONCURRENCY,
                                link: instantLink,
                                fileId
                            });
                        } catch (err) {
                            retries--;
                            if (retries === 0) throw err;
                            await new Promise(r => setTimeout(r, 500)); // Quicker retry
                        }
                    }
                }
            };

            const workers = Array(this.CONCURRENCY).fill(null).map(() => uploadWorker());
            await Promise.all(workers);

            callback({
                progress: 100,
                status: 'completed',
                link: instantLink,
                fileId
            });

        } catch (err: any) {
            console.error('[Upload Ultra Critical]:', err);
            callback({ progress: 0, status: 'error', error: err.message });
        }
    }
}

export const liteUploadEngine = new LiteUploadEngine();
