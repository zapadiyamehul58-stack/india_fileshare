// WebRTC P2P File Transfer Engine
// Supports unlimited file sizes via chunked streaming through data channels

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for WebRTC data channel
const BUFFER_THRESHOLD = 1024 * 1024; // 1MB buffer threshold
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export interface TransferProgress {
  fileId: string;
  fileName: string;
  fileSize: number;
  transferred: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  status: 'connecting' | 'transferring' | 'completed' | 'failed' | 'paused';
  direction: 'send' | 'receive';
}

export interface PeerConnection {
  id: string;
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  onProgress?: (progress: TransferProgress) => void;
  onComplete?: (file: File) => void;
  onError?: (error: Error) => void;
}

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

export async function createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(
  pc: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function acceptAnswer(
  pc: RTCPeerConnection,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function addIceCandidate(
  pc: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

// Send file through WebRTC data channel with chunked streaming
export function sendFile(
  dataChannel: RTCDataChannel,
  file: File,
  onProgress?: (progress: TransferProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Send file metadata first
    const metadata = JSON.stringify({
      type: 'file-meta',
      name: file.name,
      size: file.size,
      mimeType: file.type,
    });
    dataChannel.send(metadata);

    let offset = 0;
    let startTime = Date.now();
    let lastProgressTime = Date.now();
    let lastOffset = 0;
    const fileId = Math.random().toString(36).slice(2, 10);

    const reader = new FileReader();

    const sendChunk = () => {
      if (offset >= file.size) {
        dataChannel.send(JSON.stringify({ type: 'file-complete' }));
        onProgress?.({
          fileId,
          fileName: file.name,
          fileSize: file.size,
          transferred: file.size,
          speed: 0,
          eta: 0,
          status: 'completed',
          direction: 'send',
        });
        resolve();
        return;
      }

      // Check buffer - wait if too full
      if (dataChannel.bufferedAmount > BUFFER_THRESHOLD) {
        setTimeout(sendChunk, 50);
        return;
      }

      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      reader.onload = () => {
        if (reader.result) {
          try {
            dataChannel.send(reader.result as ArrayBuffer);
            offset += CHUNK_SIZE;

            // Calculate speed every 500ms
            const now = Date.now();
            if (now - lastProgressTime > 200) {
              const elapsed = (now - lastProgressTime) / 1000;
              const bytesInInterval = offset - lastOffset;
              const speed = bytesInInterval / elapsed;
              const remaining = file.size - offset;
              const eta = speed > 0 ? remaining / speed : 0;

              onProgress?.({
                fileId,
                fileName: file.name,
                fileSize: file.size,
                transferred: Math.min(offset, file.size),
                speed,
                eta,
                status: 'transferring',
                direction: 'send',
              });

              lastProgressTime = now;
              lastOffset = offset;
            }

            sendChunk();
          } catch (err) {
            reject(err);
          }
        }
      };
      reader.readAsArrayBuffer(chunk);
    };

    onProgress?.({
      fileId,
      fileName: file.name,
      fileSize: file.size,
      transferred: 0,
      speed: 0,
      eta: 0,
      status: 'transferring',
      direction: 'send',
    });

    sendChunk();
  });
}

// Receive file from WebRTC data channel
export function receiveFile(
  dataChannel: RTCDataChannel,
  onProgress?: (progress: TransferProgress) => void,
  onComplete?: (file: File) => void
): () => void {
  let metadata: { name: string; size: number; mimeType: string } | null = null;
  let chunks: ArrayBuffer[] = [];
  let received = 0;
  let lastProgressTime = Date.now();
  let lastReceived = 0;
  const fileId = Math.random().toString(36).slice(2, 10);

  const handler = (event: MessageEvent) => {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file-meta') {
          metadata = { name: msg.name, size: msg.size, mimeType: msg.mimeType };
          chunks = [];
          received = 0;
          onProgress?.({
            fileId,
            fileName: msg.name,
            fileSize: msg.size,
            transferred: 0,
            speed: 0,
            eta: 0,
            status: 'transferring',
            direction: 'receive',
          });
        } else if (msg.type === 'file-complete' && metadata) {
          const blob = new Blob(chunks, { type: metadata.mimeType });
          const file = new File([blob], metadata.name, { type: metadata.mimeType });
          onProgress?.({
            fileId,
            fileName: metadata.name,
            fileSize: metadata.size,
            transferred: metadata.size,
            speed: 0,
            eta: 0,
            status: 'completed',
            direction: 'receive',
          });
          onComplete?.(file);
          metadata = null;
          chunks = [];
          received = 0;
        }
      } catch {
        // Not JSON, ignore
      }
    } else if (event.data instanceof ArrayBuffer && metadata) {
      chunks.push(event.data);
      received += event.data.byteLength;

      const now = Date.now();
      if (now - lastProgressTime > 200) {
        const elapsed = (now - lastProgressTime) / 1000;
        const bytesInInterval = received - lastReceived;
        const speed = bytesInInterval / elapsed;
        const remaining = metadata.size - received;
        const eta = speed > 0 ? remaining / speed : 0;

        onProgress?.({
          fileId,
          fileName: metadata.name,
          fileSize: metadata.size,
          transferred: Math.min(received, metadata.size),
          speed,
          eta,
          status: 'transferring',
          direction: 'receive',
        });

        lastProgressTime = now;
        lastReceived = received;
      }
    }
  };

  dataChannel.binaryType = 'arraybuffer';
  dataChannel.addEventListener('message', handler);

  return () => dataChannel.removeEventListener('message', handler);
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatETA(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
