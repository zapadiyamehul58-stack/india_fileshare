// Signaling via Supabase Realtime channels
// Used to establish WebRTC connections between peers

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  joinedAt: string;
}

function detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function generateDeviceName(): string {
  const type = detectDeviceType();
  const adjectives = ['Swift', 'Bold', 'Bright', 'Cool', 'Fast', 'Sharp', 'Vivid', 'Zen'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const suffix = Math.floor(Math.random() * 1000);
  const icon = type === 'mobile' ? 'Phone' : type === 'tablet' ? 'Tablet' : 'Desktop';
  return `${adj} ${icon} ${suffix}`;
}

let deviceId: string | null = null;
let deviceName: string | null = null;

export function getDeviceId(): string {
  if (!deviceId) {
    deviceId = localStorage.getItem('flashshare-device-id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('flashshare-device-id', deviceId);
    }
  }
  return deviceId;
}

export function getDeviceName(): string {
  if (!deviceName) {
    deviceName = localStorage.getItem('flashshare-device-name');
    if (!deviceName) {
      deviceName = generateDeviceName();
      localStorage.setItem('flashshare-device-name', deviceName);
    }
  }
  return deviceName;
}

export function getDeviceInfo(): DeviceInfo {
  return {
    id: getDeviceId(),
    name: getDeviceName(),
    type: detectDeviceType(),
    joinedAt: new Date().toISOString(),
  };
}

// Join a room for device discovery using Presence
export function joinDiscoveryRoom(
  roomCode: string,
  onDevicesChange: (devices: DeviceInfo[]) => void
): RealtimeChannel {
  const myInfo = getDeviceInfo();

  const channel = supabase.channel(`discovery:${roomCode}`, {
    config: { presence: { key: myInfo.id } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<DeviceInfo>();
      const devices: DeviceInfo[] = [];
      Object.values(state).forEach((presences) => {
        presences.forEach((p: any) => {
          if (p.id !== myInfo.id) {
            devices.push({ id: p.id, name: p.name, type: p.type, joinedAt: p.joinedAt });
          }
        });
      });
      onDevicesChange(devices);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(myInfo);
      }
    });

  return channel;
}

// Create a signaling channel for WebRTC negotiation
export function createSignalingChannel(
  roomCode: string,
  peerId: string,
  callbacks: {
    onOffer?: (offer: RTCSessionDescriptionInit, fromId: string) => void;
    onAnswer?: (answer: RTCSessionDescriptionInit, fromId: string) => void;
    onIceCandidate?: (candidate: RTCIceCandidateInit, fromId: string) => void;
  }
): RealtimeChannel {
  const myId = getDeviceId();
  const channelName = `signal:${roomCode}:${[myId, peerId].sort().join('-')}`;

  const channel = supabase.channel(channelName);

  channel
    .on('broadcast', { event: 'offer' }, ({ payload }) => {
      if (payload.targetId === myId) {
        callbacks.onOffer?.(payload.offer, payload.fromId);
      }
    })
    .on('broadcast', { event: 'answer' }, ({ payload }) => {
      if (payload.targetId === myId) {
        callbacks.onAnswer?.(payload.answer, payload.fromId);
      }
    })
    .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
      if (payload.targetId === myId) {
        callbacks.onIceCandidate?.(payload.candidate, payload.fromId);
      }
    })
    .subscribe();

  return channel;
}

export function sendSignal(
  channel: RealtimeChannel,
  event: string,
  payload: Record<string, any>
): void {
  channel.send({ type: 'broadcast', event, payload: { ...payload, fromId: getDeviceId() } });
}
