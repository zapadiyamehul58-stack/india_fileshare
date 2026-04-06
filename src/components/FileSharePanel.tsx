import { useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, MessageCircle, Send, Mail, Share2, Download, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadedFile, formatFileSize, getFileIcon } from '@/lib/file-utils';
import { toast } from 'sonner';

interface FileSharePanelProps {
  file: UploadedFile;
  onDelete: (id: string) => void;
  onDownload: (file: UploadedFile) => void;
}

export default function FileSharePanel({ file, onDelete, onDownload }: FileSharePanelProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/file/${file.id}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Download "${file.name}" from QuickShare: ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareTelegram = () => {
    const text = encodeURIComponent(`Download "${file.name}": ${shareUrl}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${text}`, '_blank');
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(`Shared file: ${file.name}`);
    const body = encodeURIComponent(`Hi,\n\nI'm sharing "${file.name}" (${formatFileSize(file.size)}) with you via QuickShare.\n\nDownload it here: ${shareUrl}\n\nThis link expires on ${file.expiresAt.toLocaleString()}.`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: file.name, text: `Download ${file.name} from QuickShare`, url: shareUrl });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  const timeLeft = () => {
    const diff = file.expiresAt.getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden"
    >
      {/* File Info Header */}
      <div className="flex items-center gap-4 border-b border-border/50 p-5">
        <span className="text-3xl">{getFileIcon(file.type)}</span>
        <div className="flex-1 min-w-0">
          <h3 className="truncate font-display font-semibold text-foreground">{file.name}</h3>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{formatFileSize(file.size)}</span>
            <span>·</span>
            <span>{file.downloads} downloads</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeLeft()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => onDownload(file)} title="Download">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onDelete(file.id)} className="text-destructive hover:text-destructive" title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto]">
        {/* Share Buttons */}
        <div className="space-y-3">
          <h4 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">Share via</h4>

          <button onClick={copyLink} className="share-button w-full bg-secondary text-secondary-foreground">
            {copied ? <Check className="h-5 w-5 text-accent" /> : <Copy className="h-5 w-5" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={shareWhatsApp} className="share-button bg-[hsl(142,70%,40%)] text-[hsl(0,0%,100%)]">
              <MessageCircle className="h-5 w-5" />WhatsApp
            </button>
            <button onClick={shareTelegram} className="share-button bg-[hsl(210,80%,52%)] text-[hsl(0,0%,100%)]">
              <Send className="h-5 w-5" />Telegram
            </button>
            <button onClick={shareEmail} className="share-button bg-secondary text-secondary-foreground">
              <Mail className="h-5 w-5" />Email
            </button>
            <button onClick={nativeShare} className="share-button bg-secondary text-secondary-foreground">
              <Share2 className="h-5 w-5" />More...
            </button>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-3">
          <h4 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">QR Code</h4>
          <div className="rounded-xl bg-[hsl(0,0%,100%)] p-3">
            <QRCodeSVG value={shareUrl} size={140} level="M" />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-[160px]">Scan to download on another device</p>
        </div>
      </div>
    </motion.div>
  );
}
