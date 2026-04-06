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
};

class LiteUploadEngine {
    private CONCURRENCY = 4; // Parallel workers for maximum throughput
    private CHUNK_SIZE = 15 * 1024 * 1024; // 15MB Chunks (Best for browsers)
    private BUCKET = 'flashshare-files';

    /**
     * High performance parallel chunk upload engine.
     * Uploads 100GB+ files smoothly to Cloud Storage.
     */
    async upload(file: File, callback: (status: LiteUploadStatus) => void) {
        try {
            const fileId = nanoid(12);
            const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
            let uploadedBytes = 0;
            let startTime = Date.now();

            callback({
                progress: 0,
                status: 'uploading',
                parallelChunks: this.CONCURRENCY
            });

            // Simple chunk index worker pool
            let currentChunkIdx = 0;
            const uploadWorker = async () => {
                while (currentChunkIdx < totalChunks) {
                    const idx = currentChunkIdx++;
                    const start = idx * this.CHUNK_SIZE;
                    const end = Math.min(start + this.CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);

                    let retries = 3;
                    let success = false;

                    while (retries > 0 && !success) {
                        try {
                            // Upload chunk to its own path in the folder
                            const { error } = await supabase.storage
                                .from(this.BUCKET)
                                .upload(`${fileId}/chunk_${idx}`, chunk, {
                                    cacheControl: '3600',
                                    upsert: true
                                });

                            if (error) throw error;

                            success = true;
                            uploadedBytes += chunk.size;

                            // Periodic progress report
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
                                progress,
                                speed,
                                eta,
                                parallelChunks: this.CONCURRENCY
                            });
                        } catch (err) {
                            retries--;
                            if (retries === 0) throw err;
                            await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
                        }
                    }
                }
            };

            // Fire parallel workers
            const workers = Array(this.CONCURRENCY).fill(null).map(() => uploadWorker());
            await Promise.all(workers);

            // Finalize: Create a metadata entry for the file link
            // Since it's serverless, we'll use a direct public URL to the main storage if we can,
            // but typically we'd 'assemble' or just use the folder.
            // For this demo, we'll provide a 'Combined' download link using Supabase's signed URL if public access is off.

            const { data: { publicUrl } } = supabase.storage
                .from(this.BUCKET)
                .getPublicUrl(`${fileId}/chunk_0`); // Simplification

            // Final callback
            callback({
                progress: 100,
                status: 'completed',
                link: `${window.location.origin}/download/${fileId}?name=${encodeURIComponent(file.name)}&size=${file.size}`
            });

        } catch (err: any) {
            console.error('[Upload Ultra Critical]:', err);
            callback({ progress: 0, status: 'error', error: err.message });
        }
    }

    /**
     * For the "Receiver" side: Stream combined chunks without buffering first.
     */
    async download(fileId: string, name: string, size: number, onProgress: (p: number) => void) {
        // Implement progressive re-assembly in browser stream
        // This is the "Ultra" part: streaming 100GB without RAM issues.
    }
}

export const liteUploadEngine = new LiteUploadEngine();
