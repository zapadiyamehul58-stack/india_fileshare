import { useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Hash, QrCode, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface RoomPanelProps {
  roomCode: string | null;
  onJoinRoom: (code: string) => void;
  onCreateRoom: () => void;
}

export default function RoomPanel({ roomCode, onJoinRoom, onCreateRoom }: RoomPanelProps) {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const copyCode = async () => {
    if (!roomCode) return;
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    toast.success('Room code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareUrl = roomCode ? `${window.location.origin}?room=${roomCode}` : '';

  if (!roomCode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 space-y-5"
      >
        <div className="text-center space-y-2">
          <h3 className="font-display text-lg font-bold text-foreground">
            Connect Devices
          </h3>
          <p className="text-sm text-muted-foreground">
            Create a room or join one to start sharing
          </p>
        </div>

        <Button onClick={onCreateRoom} className="w-full gap-2" size="lg">
          <Hash className="h-5 w-5" />
          Create Room
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or join existing</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Enter room code..."
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="font-mono text-lg tracking-widest text-center uppercase"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (joinCode.length >= 4) onJoinRoom(joinCode);
            }}
            disabled={joinCode.length < 4}
          >
            Join
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Room Code
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQR(!showQR)}>
            <QrCode className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCreateRoom}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-xl bg-secondary/50 px-5 py-3 text-center">
          <span className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground">
            {roomCode}
          </span>
        </div>
        <Button variant="outline" size="icon" onClick={copyCode}>
          {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {showQR && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex flex-col items-center gap-2 pt-2"
        >
          <div className="rounded-xl bg-[hsl(0,0%,100%)] p-3">
            <QRCodeSVG value={shareUrl} size={160} level="M" />
          </div>
          <p className="text-xs text-muted-foreground">Scan to join this room</p>
        </motion.div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        Share this code with others to connect
      </p>
    </motion.div>
  );
}
