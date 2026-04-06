import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  createPeerConnection,
  createOffer,
  createAnswer,
  acceptAnswer,
  addIceCandidate,
  sendFile,
  receiveFile,
  type TransferProgress,
} from '@/lib/webrtc-transfer';
import {
  getDeviceId,
  createSignalingChannel,
  sendSignal,
  type DeviceInfo,
} from '@/lib/signaling';

export function useP2PTransfer(roomCode: string) {
  const [transfers, setTransfers] = useState<TransferProgress[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const signalingChannels = useRef<Map<string, RealtimeChannel>>(new Map());
  const pendingFiles = useRef<Map<string, File[]>>(new Map());
  const onFileReceived = useRef<((file: File) => void) | null>(null);

  const updateTransfer = useCallback((progress: TransferProgress) => {
    setTransfers((prev) => {
      const idx = prev.findIndex(
        (t) => t.fileId === progress.fileId
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = progress;
        return updated;
      }
      return [...prev, progress];
    });
  }, []);

  const setupDataChannel = useCallback(
    (dc: RTCDataChannel, peerId: string) => {
      dc.binaryType = 'arraybuffer';
      dataChannels.current.set(peerId, dc);

      dc.onopen = () => {
        setConnectedPeers((prev) => new Set([...prev, peerId]));
        // Send any pending files
        const files = pendingFiles.current.get(peerId);
        if (files && files.length > 0) {
          pendingFiles.current.delete(peerId);
          files.forEach((file) => {
            sendFile(dc, file, updateTransfer);
          });
        }
      };

      dc.onclose = () => {
        setConnectedPeers((prev) => {
          const next = new Set(prev);
          next.delete(peerId);
          return next;
        });
        dataChannels.current.delete(peerId);
      };

      // Set up receiver
      receiveFile(dc, updateTransfer, (file) => {
        onFileReceived.current?.(file);
      });
    },
    [updateTransfer]
  );

  const connectToPeer = useCallback(
    async (peer: DeviceInfo) => {
      if (peerConnections.current.has(peer.id)) return;

      const pc = createPeerConnection();
      peerConnections.current.set(peer.id, pc);

      // Create data channel
      const dc = pc.createDataChannel('file-transfer', {
        ordered: true,
      });
      setupDataChannel(dc, peer.id);

      // Set up signaling
      const sigChannel = createSignalingChannel(roomCode, peer.id, {
        onAnswer: (answer) => {
          acceptAnswer(pc, answer);
        },
        onIceCandidate: (candidate) => {
          addIceCandidate(pc, candidate);
        },
      });
      signalingChannels.current.set(peer.id, sigChannel);

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(sigChannel, 'ice-candidate', {
            candidate: event.candidate.toJSON(),
            targetId: peer.id,
          });
        }
      };

      // Wait for signaling channel to be ready, then create offer
      setTimeout(async () => {
        const offer = await createOffer(pc);
        sendSignal(sigChannel, 'offer', { offer, targetId: peer.id });
      }, 500);
    },
    [roomCode, setupDataChannel]
  );

  // Listen for incoming connections
  useEffect(() => {
    const myId = getDeviceId();
    const incomingChannel = supabase.channel(`incoming:${roomCode}:${myId}`);

    // Also listen on a general channel for offers directed at us
    const generalSigChannel = supabase.channel(`signal-listen:${roomCode}:${myId}`);

    // We need to handle offers from any peer - use a broadcast listener
    const handleIncomingOffer = async (
      offer: RTCSessionDescriptionInit,
      fromId: string
    ) => {
      if (peerConnections.current.has(fromId)) return;

      const pc = createPeerConnection();
      peerConnections.current.set(fromId, pc);

      pc.ondatachannel = (event) => {
        setupDataChannel(event.channel, fromId);
      };

      const sigChannel = createSignalingChannel(roomCode, fromId, {
        onIceCandidate: (candidate) => {
          addIceCandidate(pc, candidate);
        },
      });
      signalingChannels.current.set(fromId, sigChannel);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(sigChannel, 'ice-candidate', {
            candidate: event.candidate.toJSON(),
            targetId: fromId,
          });
        }
      };

      const answer = await createAnswer(pc, offer);

      // Wait a moment for signaling channel
      setTimeout(() => {
        sendSignal(sigChannel, 'answer', { answer, targetId: fromId });
      }, 300);
    };

    // We listen on all possible signaling channels by subscribing to a catch-all
    // Actually, the signaling channels are created per-peer, so incoming offers
    // will come through the specific channel. We need to handle this differently.
    // 
    // Solution: use a broadcast channel where all peers in the room can send offers
    const roomSigChannel = supabase.channel(`room-signal:${roomCode}`);
    roomSigChannel
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        if (payload.targetId === myId) {
          handleIncomingOffer(payload.offer, payload.fromId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomSigChannel);
    };
  }, [roomCode, setupDataChannel]);

  const sendFileToPeer = useCallback(
    (peerId: string, files: File[]) => {
      const dc = dataChannels.current.get(peerId);
      if (dc && dc.readyState === 'open') {
        files.forEach((file) => {
          sendFile(dc, file, updateTransfer);
        });
      } else {
        // Queue files and initiate connection
        pendingFiles.current.set(peerId, files);
      }
    },
    [updateTransfer]
  );

  const sendFilesToAllPeers = useCallback(
    (files: File[]) => {
      connectedPeers.forEach((peerId) => {
        sendFileToPeer(peerId, files);
      });
    },
    [connectedPeers, sendFileToPeer]
  );

  const setOnFileReceived = useCallback((cb: (file: File) => void) => {
    onFileReceived.current = cb;
  }, []);

  const clearCompletedTransfers = useCallback(() => {
    setTransfers((prev) => prev.filter((t) => t.status !== 'completed'));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      peerConnections.current.forEach((pc) => pc.close());
      signalingChannels.current.forEach((ch) => supabase.removeChannel(ch));
      dataChannels.current.forEach((dc) => dc.close());
    };
  }, []);

  return {
    transfers,
    connectedPeers,
    connectToPeer,
    sendFileToPeer,
    sendFilesToAllPeers,
    setOnFileReceived,
    clearCompletedTransfers,
  };
}
