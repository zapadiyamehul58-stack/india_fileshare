import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Copy, Check, Zap, FileText,
    Globe, Shield, X, Share2, MessageSquare, Mail,
    Send, QrCode, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { liteUploadEngine, LiteUploadStatus } from '@/lib/lite-upload-engine';
import { p2pEngine, P2PState } from '@/lib/p2p-engine';
import { toast } from 'sonner';

const LiteIndex = () => {
    const [uploadStatus, setUploadStatus] = useState<any>({ progress: 0, status: 'idle' });
    const [isP2P, setIsP2P] = useState(false);
    const [p2pState, setP2PState] = useState<P2PState>({ status: 'idle', progress: 0 });
    const [copied, setCopied] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [showQR, setShowQR] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Peer initialized on demand
    }, []);

    const handleUpload = async (file: File) => {
        setFileName(file.name);
        if (isP2P) {
            setUploadStatus({ progress: 0, status: 'uploading' });

            // 1. Initialize P2P Session to get deterministic ID
            await p2pEngine.createSession(file, (state) => {
                setP2PState(state);

                // Show completion or error from P2P track
                if (state.status === 'completed') {
                    setUploadStatus({
                        progress: 100,
                        status: 'completed',
                        link: `${window.location.origin}/p2p/${state.sessionId}`
                    });
                } else if (state.status === 'error') {
                    setUploadStatus({ progress: 0, status: 'error', error: state.error });
                } else if (state.status === 'waiting' || state.status === 'transferring') {
                    setUploadStatus(prev => ({
                        ...prev,
                        progress: state.progress || prev.progress,
                        status: 'uploading',
                        link: state.sessionId ? `${window.location.origin}/p2p/${state.sessionId}` : undefined,
                        speed: state.speed,
                        eta: state.eta
                    }));
                }
            });
        } else {
            // OPTION B: NEW ULTRA PARALLEL CLOUD ENGINE
            await liteUploadEngine.upload(file, (status) => {
                setUploadStatus(status);
            });
        }
    };

    const copyToClipboard = () => {
        if (uploadStatus.link) {
            navigator.clipboard.writeText(uploadStatus.link);
            setCopied(true);
            toast.success("Link copied!");
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const shareSystem = async () => {
        if (navigator.share && uploadStatus.link) {
            try {
                await navigator.share({
                    title: 'FlashShare Ultra File',
                    text: `Download ${fileName} via FlashShare:`,
                    url: uploadStatus.link,
                });
            } catch (err) { }
        } else {
            copyToClipboard();
        }
    };

    return (
        <div className="ultra-layout no-scroll font-sans bg-[#FBFDFF]">
            {/* Animated Background Elements */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-blue-50 rounded-full blur-[160px] opacity-50 animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-50 rounded-full blur-[160px] opacity-50 animate-pulse" />

            <main className="w-full max-w-lg relative z-10 flex flex-col items-center">
                {/* Fixed Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10"
                >
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-200 mx-auto mb-4 transform hover:scale-105 transition-transform duration-500">
                        <Zap className="text-white w-7 h-7 fill-white/20" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                        FlashShare <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-medium italic">ULTRA</span>
                    </h1>
                    <div className="flex items-center justify-center gap-2">
                        <div className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-blue-100">Zero-Latency</div>
                        <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-indigo-100">100GB+ Support</div>
                    </div>
                </motion.div>

                {/* Main Glass Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card w-full overflow-hidden flex flex-col"
                >
                    <AnimatePresence mode="wait">
                        {uploadStatus.status === 'idle' ? (
                            <motion.div key="idle" exit={{ opacity: 0, scale: 0.95 }} className="p-8">
                                {/* Mode Selector */}
                                <div className="flex bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100 mb-8 backdrop-blur-sm">
                                    <button
                                        onClick={() => setIsP2P(false)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isP2P ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <Globe className="w-3 h-3" /> Cloud Ultra
                                    </button>
                                    <button
                                        onClick={() => setIsP2P(true)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isP2P ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <Zap className="w-3 h-3" /> Peer-to-Peer
                                    </button>
                                </div>

                                {/* Drop Zone */}
                                <div
                                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50/30'); }}
                                    onDragLeave={(e) => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/30'); }}
                                    onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]); }}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 flex flex-col items-center cursor-pointer transition-all hover:border-blue-300 hover:bg-blue-50/20 group relative overflow-hidden"
                                >
                                    <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} className="hidden" />

                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-50 transition-all duration-500 shadow-xl shadow-slate-100 border border-slate-50">
                                        <Upload className="w-7 h-7 text-slate-300 group-hover:text-blue-600 transition-colors" />
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Drop it here</h3>
                                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">or browse device</p>

                                    <div className="mt-8 flex gap-4 opacity-30 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-700">
                                        <Globe className="w-4 h-4 text-slate-400" />
                                        <Shield className="w-4 h-4 text-slate-400" />
                                        <Zap className="w-4 h-4 text-blue-500" />
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8">
                                <AnimatePresence mode="wait">
                                    {uploadStatus.status === 'uploading' ? (
                                        <motion.div key="uploading" className="space-y-8 py-2">
                                            {/* File Info Header */}
                                            <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-3xl border border-white">
                                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100">
                                                    <FileText className="text-white w-7 h-7" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-black text-slate-900 truncate mb-1">{fileName}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest italic">{isP2P ? "P2P Multi-Channel Engine" : "Ultra Resumable Stream"}</span>
                                                    </div>
                                                </div>
                                                <div className="text-2xl font-black text-slate-900">{uploadStatus.progress}%</div>
                                            </div>

                                            {isP2P && uploadStatus.progress === 0 && (
                                                <div className="px-6 py-3 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-center gap-3">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                    </span>
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Waiting for Receiver to open link...</span>
                                                </div>
                                            )}

                                            {/* Advanced Progress Ring / Bar */}
                                            <div className="relative h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${uploadStatus.progress}%` }}
                                                    transition={{ type: "spring", bounce: 0, duration: 1 }}
                                                />
                                            </div>

                                            {/* Real-time Metrics Grid */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-white text-center">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{uploadStatus.progress > 0 ? "Speed" : "Link Status"}</p>
                                                    <p className="text-lg font-black text-slate-800 tracking-tighter">
                                                        {uploadStatus.progress > 0
                                                            ? `${uploadStatus.speed || "0.0"} `
                                                            : "READY"}
                                                        {uploadStatus.progress > 0 && <small className="text-[10px] opacity-40">MB/S</small>}
                                                    </p>
                                                </div>
                                                <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-white text-center">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{uploadStatus.progress > 0 ? "Time Left" : "Handshake"}</p>
                                                    <p className="text-lg font-black text-slate-800 tracking-tighter">{uploadStatus.progress > 0 ? (uploadStatus.eta || "...") : "NEGOTIATING"}</p>
                                                </div>
                                                <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-white text-center">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Health</p>
                                                    <div className="flex justify-center gap-0.5 mt-2">
                                                        {[...Array(5)].map((_, i) => (
                                                            <div key={i} className={`w-1 h-3 rounded-full ${i < 4 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {isP2P && uploadStatus.link && (
                                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-6 border-t border-slate-50">
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-center mb-4">Direct Receiver Link</p>
                                                    <div className="relative">
                                                        <input readOnly value={uploadStatus.link} className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 pr-14 text-blue-600 text-[11px] font-black text-center focus:ring-0" />
                                                        <button onClick={copyToClipboard} className="absolute right-2 top-2 bottom-2 bg-blue-600 text-white rounded-xl px-4 flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                                                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    ) : uploadStatus.status === 'completed' ? (
                                        <motion.div key="completed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-2 space-y-6">
                                            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-xl shadow-emerald-50">
                                                <Check className="text-emerald-500 w-10 h-10 stroke-[3px]" />
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-black text-slate-900 mb-1">Transfer Ready</h2>
                                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">File uploaded — share the link below</p>
                                            </div>

                                            {/* Share link */}
                                            <div className="relative">
                                                <input readOnly value={uploadStatus.link || 'Generating link…'} onClick={e => (e.target as HTMLInputElement).select()} className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] py-5 px-6 pr-20 text-blue-600 text-xs font-bold text-center cursor-text" />
                                                <button onClick={copyToClipboard} className="absolute right-3 top-3 bottom-3 bg-blue-600 text-white rounded-xl px-4 flex items-center justify-center hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">
                                                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                                </button>
                                            </div>

                                            {/* Action icons */}
                                            <div className="grid grid-cols-4 gap-3">
                                                <button onClick={shareSystem} title="Share" className="aspect-square bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-blue-50 transition-colors group">
                                                    <Share2 className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                                                </button>
                                                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(uploadStatus.link || '')}`, '_blank')} title="WhatsApp" className="aspect-square bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition-colors group">
                                                    <MessageSquare className="w-5 h-5 text-slate-400 group-hover:text-emerald-600" />
                                                </button>
                                                <button onClick={() => setShowQR(!showQR)} title="QR Code" className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-all group ${showQR ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                                                    <QrCode className="w-5 h-5" />
                                                </button>
                                                <a href={uploadStatus.link} target="_blank" rel="noopener noreferrer" title="Open download page" className="aspect-square bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-indigo-50 transition-colors group">
                                                    <Download className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                                                </a>
                                            </div>

                                            <AnimatePresence>
                                                {showQR && uploadStatus.link && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-4 bg-slate-50 rounded-3xl flex flex-col items-center gap-4 overflow-hidden border border-slate-100">
                                                        <QRCodeSVG value={uploadStatus.link} size={160} />
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scan to download</span>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* CTAs */}
                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                <button onClick={() => window.location.reload()} className="py-4 rounded-[1.5rem] bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                                                    <Upload className="w-4 h-4" /> Upload Another
                                                </button>
                                                <a href={uploadStatus.link} target="_blank" rel="noopener noreferrer" className="py-4 rounded-[1.5rem] bg-slate-900 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2">
                                                    <Download className="w-4 h-4" /> Open Page
                                                </a>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <X className="text-red-500 w-8 h-8" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900">Upload Encountered Error</h3>
                                            <p className="text-slate-400 text-xs font-semibold mt-2 mb-8">{uploadStatus.error}</p>
                                            <button onClick={() => window.location.reload()} className="w-full py-5 rounded-[1.5rem] bg-slate-900 text-white font-black text-sm uppercase tracking-widest">Reset System</button>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Fixed Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-10 text-center"
                >
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] mb-4">Secure Parallel Chunks Engine v2.0</p>
                    <div className="flex items-center justify-center gap-6 opacity-40 grayscale group-hover:grayscale-0 transition-all">
                        <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-tighter"><Shield className="w-3 h-3" /> End-to-End</div>
                        <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-tighter"><Globe className="w-3 h-3" /> Multi-Region</div>
                        <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-tighter"><Zap className="w-3 h-3" /> Warp Speed</div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default LiteIndex;
