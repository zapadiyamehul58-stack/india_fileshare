import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, ArrowLeft, Clock, FileX, Zap, Loader2,
  HardDrive, Copy, Check, Shield, Globe,
  AlertTriangle, RefreshCw, Plus, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────
interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  status: string;
  createdAt: number;
  expiresAt: string;
  downloads: number;
  fileExists: boolean;
  downloadUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type: string): string {
  if (!type) return '📎';
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type.startsWith('audio/')) return '🎵';
  if (type.includes('pdf')) return '📄';
  if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar')) return '📦';
  if (type.includes('document') || type.includes('word')) return '📝';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📽️';
  return '📎';
}

function getTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h remaining`;
  return 'Less than 1h remaining';
}

/**
 * Resolves the correct API base URL for the device opening the link.
 *
 * If the user opened the share link via a real network IP
 * (e.g. http://192.168.1.5:8080/download/abc) we derive the
 * backend port from that same hostname so it works cross-device.
 *
 * Priority:
 *  1. VITE_API_URL env (set at build time for the upload device)
 *  2. Same hostname as the current page, on port 3001
 */
function getApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim();
  const hostname = window.location.hostname;
  return `http://${hostname}:3001`;
}

// ─── Component ────────────────────────────────────────────────
export default function FilePage() {
  const { id } = useParams<{ id: string }>();
  const [file, setFile] = useState<FileMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'not_found' | 'expired' | 'missing' | 'network' | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const API_BASE = getApiBase();

  // ── Fetch metadata from backend ──
  const fetchMetadata = async () => {
    if (!id) {
      setError('Invalid file link — no file ID found.');
      setErrorType('not_found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      const res = await fetch(`${API_BASE}/api/metadata/${id}`);

      if (res.status === 404) {
        setError('This file does not exist. It may have been deleted or never uploaded.');
        setErrorType('not_found');
        setLoading(false);
        return;
      }
      if (res.status === 410) {
        setError('This file has expired and is no longer available for download.');
        setErrorType('expired');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setErrorType('not_found');
        setLoading(false);
        return;
      }

      // File still processing — auto-retry
      if (data.status === 'uploading' || data.status === 'merging') {
        setError('File is still being assembled. This page will refresh automatically…');
        setErrorType('missing');
        setLoading(false);
        setTimeout(() => setRetryCount(c => c + 1), 5000);
        return;
      }

      // Verify the physical file actually exists on disk
      if (data.fileExists === false) {
        setError('The file data is missing on the server. Please ask the sender to re-upload.');
        setErrorType('missing');
        setLoading(false);
        return;
      }

      setFile(data);
      setLoading(false);
    } catch (err: any) {
      console.error('[FilePage] fetch error:', err);
      setError(
        'Cannot connect to the FlashShare server.\n\nMake sure the sender\'s computer is on and you are on the same Wi-Fi/network.'
      );
      setErrorType('network');
      setLoading(false);
    }
  };

  useEffect(() => { fetchMetadata(); }, [id, retryCount]);

  // ── Download — DIRECT browser download, zero memory usage ──
  const handleDownload = () => {
    if (!file) return;

    // Build the direct download URL from the backend API.
    // Using the host the page was opened on ensures cross-device compatibility.
    const directUrl = file.downloadUrl || `${API_BASE}/api/download/${file.id}`;

    // Create a hidden anchor and click it.
    // The browser's native download manager handles streaming —
    // no RAM buffering, works for any file size (100 GB+).
    const a = document.createElement('a');
    a.href = directUrl;
    a.download = file.name;   // Suggests save-as filename
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setDownloadStarted(true);
    toast.success('Download started! Check your Downloads folder.');

    // Refresh the download count after a moment
    setTimeout(() => fetchMetadata(), 3000);
  };

  // ── Copy share link ──
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Share link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // ══════════════════════════════════════════════════════════════
  //  LOADING
  // ══════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="ultra-layout font-sans bg-[#FBFDFF]">
        <Blobs />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 flex flex-col items-center gap-5"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-200">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-800">Looking up your file…</p>
            <p className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-widest">Connecting to FlashShare</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  ERROR
  // ══════════════════════════════════════════════════════════════
  if (error || !file) {
    const icons = {
      not_found: <FileX className="w-9 h-9 text-slate-400" />,
      expired: <Clock className="w-9 h-9 text-amber-500" />,
      missing: <AlertTriangle className="w-9 h-9 text-amber-500" />,
      network: <Globe className="w-9 h-9 text-red-400" />,
    };
    const titles = {
      not_found: 'File Not Found',
      expired: 'File Expired',
      missing: 'File Unavailable',
      network: 'Cannot Reach Server',
    };
    const key = errorType ?? 'not_found';

    return (
      <div className="ultra-layout font-sans bg-[#FBFDFF]">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-orange-50 opacity-60" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 glass-card w-full max-w-md p-10 text-center space-y-6"
        >
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100 shadow-inner">
            {icons[key]}
          </div>

          <div>
            <h1 className="text-2xl font-black text-slate-900 mb-3">{titles[key]}</h1>
            <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line">
              {error ?? 'This file could not be found.'}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {(key === 'network' || key === 'missing') && (
              <button
                onClick={() => setRetryCount(c => c + 1)}
                className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            )}
            <Link to="/" className="w-full">
              <button className="w-full py-4 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Upload a File
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  SUCCESS — file ready
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="ultra-layout font-sans bg-[#FBFDFF]">
      <Blobs />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Brand */}
        <div className="text-center mb-7">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-200 mx-auto mb-3 hover:scale-105 transition-transform duration-300">
            <Zap className="text-white w-6 h-6 fill-white/20" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            FlashShare{' '}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-medium italic">
              ULTRA
            </span>
          </h2>
        </div>

        {/* Card */}
        <div className="glass-card p-7 space-y-5">

          {/* ── File details ── */}
          <div className="flex items-center gap-4 bg-slate-50/60 p-5 rounded-[2rem] border border-white">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 text-3xl shrink-0 select-none">
              {getFileIcon(file.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 truncate mb-1.5" title={file.name}>
                {file.name}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatFileSize(file.size)}
                </span>
                <span>·</span>
                <span>{file.downloads} download{file.downloads !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50/60 p-4 rounded-2xl border border-white text-center">
              <Clock className="w-4 h-4 text-slate-400 mx-auto mb-1" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Expires</p>
              <p className="text-[11px] font-bold text-slate-700 leading-tight">{getTimeRemaining(file.expiresAt)}</p>
            </div>
            <div className="bg-slate-50/60 p-4 rounded-2xl border border-white text-center">
              <Shield className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Status</p>
              <p className="text-[11px] font-bold text-emerald-600">Ready ✓</p>
            </div>
          </div>

          {/* ── Download Button ── */}
          <AnimatePresence mode="wait">
            {downloadStarted ? (
              <motion.div
                key="started"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {/* Success banner */}
                <div className="w-full py-4 rounded-[1.5rem] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  Download started — check your Downloads folder
                </div>

                {/* Download again */}
                <button
                  onClick={handleDownload}
                  className="w-full py-4 rounded-[1.5rem] bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Again
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="download-btn"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={handleDownload}
                whileTap={{ scale: 0.97 }}
                className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-200 hover:shadow-blue-300 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <Download className="w-5 h-5" />
                Download File
                <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-normal normal-case">
                  {formatFileSize(file.size)}
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* ── Copy share link ── */}
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">
              Copy Share Link
            </p>
            <div className="relative">
              <input
                readOnly
                value={window.location.href}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 px-5 pr-14 text-blue-600 text-[11px] font-semibold text-center focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-text"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={copyLink}
                title="Copy link"
                className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white rounded-xl px-3.5 flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all shadow-md shadow-blue-200"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 font-bold uppercase tracking-widest transition-colors"
          >
            <Plus className="w-3 h-3" /> Upload a File
          </Link>
          <span className="text-slate-200">|</span>
          <a
            href={file.downloadUrl || `${API_BASE}/api/download/${file.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 font-bold uppercase tracking-widest transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Direct Link
          </a>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Background decoration ─────────────────────────────────────
function Blobs() {
  return (
    <>
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-50 rounded-full blur-[160px] opacity-50 animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-50 rounded-full blur-[160px] opacity-50 animate-pulse pointer-events-none" />
    </>
  );
}
