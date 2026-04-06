import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { joinDiscoveryRoom, type DeviceInfo } from '@/lib/signaling';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useDeviceDiscovery(roomCode: string | null) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!roomCode) {
      setDevices([]);
      setIsConnected(false);
      return;
    }

    let channel: RealtimeChannel | null = null;

    channel = joinDiscoveryRoom(roomCode, (discoveredDevices) => {
      setDevices(discoveredDevices);
      setIsConnected(true);
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      setDevices([]);
      setIsConnected(false);
    };
  }, [roomCode]);

  return { devices, isConnected };
}
