export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  expiresAt: Date;
  downloads: number;
  url: string;
  blob?: Blob;
  storagePath?: string;
}

export function generateFileId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📄';
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return '📦';
  if (type.includes('document') || type.includes('word')) return '📝';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📽️';
  return '📎';
}

export function getExpiryDate(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function validateFile(_file: File): string | null {
  // No file size limit for P2P transfers
  return null;
}

// In-memory store for local files
const fileStore = new Map<string, UploadedFile>();

export function storeFile(file: UploadedFile): void {
  fileStore.set(file.id, file);
}

export function getFile(id: string): UploadedFile | undefined {
  const file = fileStore.get(id);
  if (file && new Date() > file.expiresAt) {
    fileStore.delete(id);
    return undefined;
  }
  return file;
}

export function getAllFiles(): UploadedFile[] {
  const now = new Date();
  const files: UploadedFile[] = [];
  fileStore.forEach((file, id) => {
    if (now > file.expiresAt) {
      fileStore.delete(id);
    } else {
      files.push(file);
    }
  });
  return files.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

export function deleteFile(id: string): void {
  fileStore.delete(id);
}

export function incrementDownloads(id: string): void {
  const file = fileStore.get(id);
  if (file) file.downloads++;
}
