import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Download, Loader2, Check, X, Shield, Globe, FileText, ArrowLeft, Activity } from 'lucide-react';
import { p2pEngine, P2PState } from '@/lib/p2p-engine';
import { Button } from '@/components/ui/button';

const P2PPage = () => {
    const { id } = useParams<{ id: string }>();
    const [p2pState, setP2PState] = useState<P2PState>({ status: 'connecting', progress: 0 });
    const [downloadedFile, setDownloadedFile] = useState<File | null>(null);

    useEffect(() => {
        if (id) {
            p2pEngine.receiveSession(id, setP2PState, setDownloadedFile);
        }
    }, [id]);

    const handleDownload = () => {
        if (downloadedFile) {
            const url = URL.createObjectURL(downloadedFile);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadedFile.name;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="ultra-layout no-scroll font-sans bg-[#FBFDFF]">
            {/* Background Effects */}
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-blue-50 rounded-full blur-[160px] opacity-50 animate-pulse" />
            <div className="absolute bottom-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-50 rounded-full blur-[160px] opacity-50 animate-pulse" />

            <main className="w-full max-w-lg relative z-10 flex flex-col items-center">
                {/* Fixed Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-10"
                >
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-200 mx-auto mb-4 scale-90">
                        <Activity className="text-white w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">
                        Secure <span className="text-blue-600 font-medium italic">Handshake</span>
                    </h1>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">FlashShare Ultra Receiver</p>
                </motion.div>

                {/* Receiver Glass Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card w-full p-8 md:p-10 relative"
                >
                    <AnimatePresence mode="wait">
                        {p2pState.status === 'connecting' ? (
                            <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-6">
                                <div className="relative w-20 h-20 mx-auto mb-8">
                                    <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20" />
                                    <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center border border-blue-50 shadow-xl shadow-blue-100/50">
                                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin stroke-[2.5px]" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 mb-2">Establishing Handshake</h2>
                                <p className="text-slate-400 text-sm font-semibold mb-8 leading-relaxed">Attempting direct P2P connection tunnel...</p>

                                {p2pState.fileName && (
                                    <div className="p-4 bg-slate-50/50 rounded-3xl border border-white flex items-center gap-4 text-left shadow-sm">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-slate-800 truncate">{p2pState.fileName}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic animate-pulse">Pre-fetching metadata</p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ) : p2pState.status === 'fallback' ? (
                            <motion.div key="fallback" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center py-4 space-y-8">
                                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto border border-amber-100/50 shadow-xl shadow-amber-50">
                                    <Globe className="text-amber-600 w-10 h-10" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 mb-1">P2P Blocked</h2>
                                    <p className="text-slate-400 text-sm font-semibold px-4">Network topology prevents direct handshake. Switching to Ultra Secure Cloud Path.</p>
                                </div>

                                <div className="p-5 bg-blue-50/30 rounded-3xl border border-blue-100/50 flex items-center gap-4 text-left">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                                        <Shield className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-800 truncate">{p2pState.fileName}</p>
                                        <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-0.5 animate-pulse">Security Check Passed</p>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/download/${id}`, '_blank')}
                                    className="w-full h-16 bg-blue-600 rounded-[1.5rem] font-black text-white hover:bg-blue-700 shadow-2xl shadow-blue-200 gap-3 text-lg transition-transform active:scale-95"
                                >
                                    <Download className="w-6 h-6" /> Start Ultra Download
                                </Button>

                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] cursor-pointer hover:text-slate-500 transition-colors" onClick={() => window.location.reload()}>
                                    Force Reset Handshake Engine
                                </p>
                            </motion.div>
                        ) : p2pState.status === 'transferring' ? (
                            <motion.div key="transferring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 py-2">
                                {/* Transfer Header */}
                                <div className="flex items-center gap-5 bg-blue-50/50 p-5 rounded-[2rem] border border-white">
                                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100">
                                        <FileText className="text-white w-8 h-8" />
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-sm font-black text-slate-900 truncate mb-1">{p2pState.fileName}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest italic animate-pulse">Peer-to-Peer Tunnel Active</span>
                                        </div>
                                    </div>
                                    <div className="text-3xl font-black text-slate-900 tabular-nums">{p2pState.progress}%</div>
                                </div>

                                {/* Ultra Progress Layout */}
                                <div className="space-y-6">
                                    <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-white">
                                        <motion.div
                                            className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500"
                                            animate={{ width: `${p2pState.progress}%` }}
                                            transition={{ type: "spring", bounce: 0, duration: 1 }}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-white text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Incoming Speed</p>
                                            <p className="text-2xl font-black text-slate-800 tabular-nums">{p2pState.speed || "0.0"} <small className="text-xs opacity-40">MB/S</small></p>
                                        </div>
                                        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-white text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Time Remaining</p>
                                            <p className="text-2xl font-black text-slate-800 tabular-nums">{p2pState.eta || "..."}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-center gap-3 py-2">
                                    {[...Array(8)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ height: [4, 12, 4], opacity: [0.2, 1, 0.2] }}
                                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                                            className="w-1.5 bg-blue-600 rounded-full"
                                        />
                                    ))}
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4">Turbo Stream Mode Active</span>
                                </div>
                            </motion.div>
                        ) : p2pState.status === 'completed' ? (
                            <motion.div key="completed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-10 py-4">
                                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-2xl shadow-emerald-50 relative">
                                    <Check className="text-emerald-500 w-12 h-12 stroke-[3px]" />
                                    <motion.div className="absolute inset-[-4px] border-4 border-emerald-500/20 rounded-full" animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Handshake Successful</h2>
                                    <p className="text-slate-400 text-sm font-semibold uppercase tracking-widest">Flash-Parallel Tunnel Reassembled</p>
                                </div>
                                <Button onClick={handleDownload} className="h-20 w-full rounded-[2rem] bg-slate-900 text-white font-black hover:bg-slate-800 shadow-2xl shadow-slate-200 gap-4 text-xl border-b-8 border-slate-700 transition-all active:border-b-0 active:translate-y-1">
                                    <Download className="w-7 h-7" /> Save To Device
                                </Button>
                                <Link to="/" className="text-slate-400 text-[10px] font-black hover:text-blue-600 transition-all uppercase tracking-[0.4em] flex items-center justify-center gap-2">
                                    <ArrowLeft className="w-3 h-3" /> Warp Velocity Home
                                </Link>
                            </motion.div>
                        ) : (
                            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-50 border border-red-100">
                                    <X className="text-red-500 w-10 h-10 stroke-[3px]" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Stream Interrupted</h3>
                                <p className="text-slate-400 text-sm font-semibold mb-10 px-6">{p2pState.error || "The sender lost connection to the signaling relay."}</p>
                                <Button onClick={() => window.location.reload()} className="w-full h-16 bg-slate-900 rounded-[1.5rem] font-black text-white hover:bg-slate-800 shadow-2xl shadow-slate-200 uppercase tracking-widest tracking-widest">
                                    Re-Initialize System
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Visual Data Flow Lines (Pure Aesthetic) */}
                <div className="absolute top-[20%] right-[-100px] w-[300px] h-[1px] bg-gradient-to-r from-transparent via-blue-200 to-transparent rotate-[-45deg] opacity-20" />
                <div className="absolute bottom-[20%] left-[-100px] w-[300px] h-[1px] bg-gradient-to-r from-transparent via-indigo-200 to-transparent rotate-[45deg] opacity-20" />
            </main>
        </div>
    );
};

export default P2PPage;
