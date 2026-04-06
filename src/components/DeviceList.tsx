import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Smartphone, Tablet, Wifi, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DeviceInfo } from '@/lib/signaling';

interface DeviceListProps {
  devices: DeviceInfo[];
  connectedPeers: Set<string>;
  onConnect: (device: DeviceInfo) => void;
  onSendFiles: (deviceId: string) => void;
  hasFiles: boolean;
}

const deviceIcons = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

export default function DeviceList({
  devices,
  connectedPeers,
  onConnect,
  onSendFiles,
  hasFiles,
}: DeviceListProps) {
  if (devices.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-3 py-8 text-muted-foreground"
      >
        <Wifi className="h-10 w-10 animate-pulse" />
        <p className="text-sm font-medium">Searching for nearby devices...</p>
        <p className="text-xs">Devices in the same room will appear here</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {devices.map((device) => {
          const Icon = deviceIcons[device.type];
          const isConnected = connectedPeers.has(device.id);

          return (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass-card flex items-center gap-4 p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-display font-semibold text-foreground">
                  {device.name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {device.type} ·{' '}
                  <span className={isConnected ? 'text-accent' : 'text-muted-foreground'}>
                    {isConnected ? 'Connected' : 'Available'}
                  </span>
                </p>
              </div>
              {isConnected && hasFiles ? (
                <Button size="sm" onClick={() => onSendFiles(device.id)} className="gap-1.5">
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              ) : !isConnected ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onConnect(device)}
                >
                  Connect
                </Button>
              ) : (
                <span className="text-xs text-accent font-medium px-3">Ready</span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
