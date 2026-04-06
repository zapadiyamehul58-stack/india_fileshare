import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, Check, AlertCircle } from 'lucide-react';
import { type TransferProgress as TransferProgressType, formatSpeed, formatETA } from '@/lib/webrtc-transfer';
import { formatFileSize } from '@/lib/file-utils';

interface TransferProgressProps {
  transfers: TransferProgressType[];
}

export default function TransferProgressPanel({ transfers }: TransferProgressProps) {
  if (transfers.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">
        Transfers
      </h3>
      <AnimatePresence mode="popLayout">
        {transfers.map((transfer) => {
          const percent =
            transfer.fileSize > 0
              ? Math.round((transfer.transferred / transfer.fileSize) * 100)
              : 0;
          const Icon = transfer.direction === 'send' ? ArrowUp : ArrowDown;
          const StatusIcon =
            transfer.status === 'completed'
              ? Check
              : transfer.status === 'failed'
              ? AlertCircle
              : null;

          return (
            <motion.div
              key={transfer.fileId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    transfer.status === 'completed'
                      ? 'bg-accent/10'
                      : transfer.status === 'failed'
                      ? 'bg-destructive/10'
                      : 'bg-primary/10'
                  }`}
                >
                  {StatusIcon ? (
                    <StatusIcon
                      className={`h-4 w-4 ${
                        transfer.status === 'completed'
                          ? 'text-accent'
                          : 'text-destructive'
                      }`}
                    />
                  ) : (
                    <Icon className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {transfer.fileName}
                  </p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>
                      {formatFileSize(transfer.transferred)} / {formatFileSize(transfer.fileSize)}
                    </span>
                    {transfer.status === 'transferring' && (
                      <>
                        <span>·</span>
                        <span>{formatSpeed(transfer.speed)}</span>
                        <span>·</span>
                        <span>ETA {formatETA(transfer.eta)}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-sm font-display font-bold text-foreground">
                  {percent}%
                </span>
              </div>

              {transfer.status === 'transferring' && (
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
              {transfer.status === 'completed' && (
                <div className="h-1.5 rounded-full bg-accent" />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
