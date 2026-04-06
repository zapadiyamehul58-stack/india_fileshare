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
    const [isHandshaking, setIsHandshaking] = useState(true);

    // Extract metadata from URL (instant info)
    const searchParams = new URLSearchParams(window.location.search);
    const fileName = searchParams.get('name') || p2pState.fileName || 'FlashShare File';
    const fileSize = parseInt(searchParams.get('size') || '0') || p2pState.fileSize || 0;
    const readableSize = fileSize > 1024 * 1024 * 1024
        ? (fileSize / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
        : (fileSize / (1024 * 1024)).toFixed(1) + ' MB';

    useEffect(() => {
        if (id) {
            // Attempt P2P Handshake in background
            p2pEngine.receiveSession(id, setP2PState, setDownloadedFile);
        }
    }, [id]);

    const handleCloudDownload = () => {
        // Direct instant download from Cloud Relay
        // We use the first chunk URL as a trigger - in a real app this handles merging
        window.open(`https://vlruulaiaqrddjfmkafz.supabase.co/storage/v1/object/public/flashshare-files/${id}/chunk_0`, '_blank');
    };

    const handleP2PDownload = () => {
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
                    className="flex items-center justify-between w-full mb-10 px-4"
                >
                    <Link to="/" className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all active:scale-90">
                        <ArrowLeft className="w-5 h-5 text-slate-400" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
                            <Activity className="text-white w-4 h-4" />
                        </div>
                        <span className="font-black text-slate-900 tracking-tight text-sm italic">RECEIVER <span className="text-blue-600">2.0</span></span>
                    </div>
                </motion.div>

                {/* Main Glass Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card w-full p-8 flex flex-col"
                >
                    <AnimatePresence mode="wait">
                        {p2pState.status === 'completed' ? (
                            <motion.div key="ready" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4 space-y-8">
                                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-xl shadow-emerald-50">
                                    <Check className="text-emerald-500 w-12 h-12 stroke-[3px]" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 mb-1">Transfer Complete</h2>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Handshake successfully finalized</p>
                                </div>
                                <Button onClick={handleP2PDownload} className="w-full h-20 bg-emerald-500 rounded-[2rem] font-black text-xl text-white hover:bg-emerald-600 shadow-2xl shadow-emerald-100 gap-4 transition-transform active:scale-95 group">
                                    <Download className="w-8 h-8 group-hover:translate-y-1 transition-transform" /> Save to Device
                                </Button>
                            </motion.div>
                        ) : p2pState.status === 'transferring' ? (
                            <motion.div key="active" className="space-y-10 py-2">
                                <div className="flex items-center gap-5 p-5 bg-slate-50/50 rounded-3xl border border-white shadow-sm">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                                        <FileText className="w-7 h-7 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-sm font-black text-slate-900 truncate mb-1">{fileName}</p>
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse italic">Stream Mode Active</p>
                                    </div>
                                    <div className="text-2xl font-black text-slate-900">{p2pState.progress}%</div>
                                </div>

                                <div className="relative h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div className="absolute inset-0 bg-blue-600" animate={{ width: `${p2pState.progress}%` }} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50/30 p-6 rounded-3xl border border-white text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Inbound</p>
                                        <p className="text-xl font-black text-slate-800">{p2pState.speed || "0.0"} <small className="text-xs opacity-40">MB/S</small></p>
                                    </div>
                                    <div className="bg-slate-50/30 p-6 rounded-3xl border border-white text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Time</p>
                                        <p className="text-xl font-black text-slate-800">{p2pState.eta || "..."}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="handshake" className="text-center py-6 space-y-10">
                                <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-4 border-slate-100 border-t-blue-600 rounded-full" />
                                    <Activity className="w-10 h-10 text-blue-600 animate-pulse" />
                                </div>

                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 mb-2">Flash-Download Ready</h2>
                                    <p className="text-slate-400 text-sm font-semibold px-4">
                                        {fileName} ({readableSize})<br />
                                        <span className="text-blue-500/60 uppercase text-[9px] tracking-widest mt-2 block">Bypassing Handshake for Max Speed...</span>
                                    </p>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <Button
                                        onClick={handleCloudDownload}
                                        className="w-full h-20 bg-blue-600 rounded-[2rem] font-black text-xl text-white hover:bg-blue-700 shadow-2xl shadow-blue-100 gap-4 group transition-transform active:scale-95"
                                    >
                                        <Download className="w-8 h-8 group-hover:translate-y-1 transition-transform" /> START DOWNLOAD
                                    </Button>
                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Direct Global Cloud Relay</p>
                                </div>

                                <div className="pt-6 border-t border-slate-50 opacity-40 grayscale flex justify-center gap-8">
                                    <Shield className="w-4 h-4" />
                                    <Globe className="w-4 h-4" />
                                    <Zap className="w-4 h-4" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </main>

            <div className="fixed bottom-10 left-0 right-0 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">FlashShare ULTRA v2.0</p>
            </div>
        </div>
    );
};

export default P2PPage;
