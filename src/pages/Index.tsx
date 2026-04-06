import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Wifi, Cloud, LayoutDashboard, History, Settings, LogOut, ChevronRight, Activity, HardDrive, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import FileUploadZone from '@/components/FileUploadZone';
import FileList from '@/components/FileList';
import {
  UploadedFile,
  getAllFiles,
  deleteFile as removeFile,
  incrementDownloads,
} from '@/lib/file-utils';
import { uploadEngine, UploadStatus } from '@/lib/upload-engine';
import { toast } from 'sonner';

const Index = () => {
  const [searchParams] = useSearchParams();
  const [files, setFiles] = useState<UploadedFile[]>(getAllFiles());
  const [activeUploads, setActiveUploads] = useState<Map<string, UploadStatus>>(new Map());
  const [mode, setMode] = useState<'p2p' | 'cloud'>(searchParams.get('mode') === 'p2p' ? 'p2p' : 'cloud');

  const refreshFiles = useCallback(() => setFiles(getAllFiles()), []);

  const handleUploadStatusChange = useCallback((status: UploadStatus) => {
    setActiveUploads(prev => {
      const next = new Map(prev);
      if (status.status === 'completed' || status.status === 'error') {
        // Keep completed items for a moment then clear?
        // Or move to history
        if (status.status === 'completed') {
          setTimeout(() => {
            setActiveUploads(p => {
              const n = new Map(p);
              n.delete(status.id);
              return n;
            });
            refreshFiles();
          }, 2000);
        }
      }
      next.set(status.id, status);
      return next;
    });
  }, [refreshFiles]);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    if (mode === 'cloud') {
      newFiles.forEach(file => {
        uploadEngine.upload(file, handleUploadStatusChange);
      });
      toast.success(`Starting ${newFiles.length} upload(s)...`);
    } else {
      // P2P logic (if still relevant)
      toast.info('P2P mode selected. Choose a peer to share.');
    }
  }, [mode, handleUploadStatusChange]);

  const handleDelete = (id: string) => {
    removeFile(id);
    refreshFiles();
    toast.success('File removed from local view');
  };

  const handleDownload = (file: UploadedFile) => {
    incrementDownloads(file.id);
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    refreshFiles();
  };

  const uploadList = useMemo(() => Array.from(activeUploads.values()), [activeUploads]);
  const stats = useMemo(() => {
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    const uploadingCount = uploadList.filter(u => u.status === 'uploading').length;
    return { totalSize, uploadingCount };
  }, [files, uploadList]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 md:w-64 border-r border-border/50 bg-card/30 flex flex-col items-center md:items-stretch py-6 px-3 z-50">
        <div className="flex items-center gap-3 px-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-glow">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="hidden md:block font-display text-xl font-bold">
            FlashShare <span className="text-primary">Pro</span>
          </span>
        </div>

        <nav className="flex-1 space-y-2">
          <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl bg-primary/10 text-primary font-medium transition-all">
            <LayoutDashboard className="h-5 w-5" />
            <span className="hidden md:block">Dashboard</span>
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all">
            <History className="h-5 w-5" />
            <span className="hidden md:block">Transfers</span>
          </button>
          <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all">
            <Settings className="h-5 w-5" />
            <span className="hidden md:block">Settings</span>
          </button>
        </nav>

        <div className="pt-6 mt-6 border-t border-border/50 space-y-4">
          <div className="hidden md:block bg-secondary/30 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Cloud Usage</span>
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">Unlimited</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[35%]" />
            </div>
          </div>
          <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-all">
            <LogOut className="h-5 w-5" />
            <span className="hidden md:block">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-border/10 backdrop-blur-md">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold">Cloud Dashboard</h1>
            <div className="flex items-center gap-1 rounded-xl bg-secondary/50 p-1">
              <button
                onClick={() => setMode('cloud')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${mode === 'cloud'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Cloud className="h-3.5 w-3.5" />
                Live Cloud
              </button>
              <button
                onClick={() => setMode('p2p')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${mode === 'p2p'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Wifi className="h-3.5 w-3.5" />
                Direct P2P
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground bg-card/40 px-4 py-2 rounded-full border border-border/20">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-accent" /> Encrypted</span>
              <span className="w-px h-3 bg-border" />
              <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-primary" /> {stats.uploadingCount} Active</span>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 overflow-hidden">
          {/* Left Column: Upload & History */}
          <div className="space-y-8 flex flex-col h-full overflow-hidden">
            {/* Upload Zone */}
            <div className="shrink-0">
              <FileUploadZone
                onFilesSelected={handleFilesSelected}
                isUploading={stats.uploadingCount > 0}
                progress={0}
              />
            </div>

            {/* History Section */}
            <div className="flex-1 flex flex-col min-h-0 bg-card/30 rounded-3xl border border-border/30 backdrop-blur-sm overflow-hidden">
              <div className="p-6 border-b border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">Recent Transfers</h3>
                </div>
                <button
                  onClick={refreshFiles}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Refresh
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20">
                <FileList
                  files={files}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                />
                {files.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 py-20">
                    <div className="h-12 w-12 rounded-full bg-secondary/30 flex items-center justify-center">
                      <HardDrive className="h-6 w-6 opacity-20" />
                    </div>
                    <p className="text-sm">No files uploaded yet. Start by dropping a file above.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Upload Dashboard */}
          <div className="bg-card/40 rounded-3xl border border-border/30 backdrop-blur-md flex flex-col overflow-hidden">
            <div className="p-6 border-b border-border/30">
              <h3 className="font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary animate-pulse" />
                Upload Dashboard
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <AnimatePresence mode="popLayout">
                {uploadList.length > 0 ? (
                  uploadList.map((upload) => (
                    <motion.div
                      key={upload.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass-card p-4 space-y-3 border-primary/10"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{upload.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-mono">
                            {upload.status} • {(upload.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                        <div className="text-xs font-bold text-primary">
                          {upload.progress}%
                        </div>
                      </div>

                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${upload.status === 'error' ? 'bg-destructive' : 'bg-primary'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${upload.progress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>

                      {upload.status === 'uploading' && (
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Zap className="h-2.5 w-2.5" /> High Performance
                          </span>
                          <span>Streaming chunks...</span>
                        </div>
                      )}

                      {upload.status === 'completed' && (
                        <div className="text-[10px] text-accent font-bold flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> Successfully Secured
                        </div>
                      )}

                      {upload.status === 'error' && (
                        <div className="text-[10px] text-destructive font-bold flex items-center gap-1">
                          ⚠️ {upload.error || 'Connection Lost'}
                        </div>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 space-y-4 py-32 text-center">
                    <div className="relative">
                      <Zap className="h-16 w-16 opacity-5" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ChevronRight className="h-6 w-6 opacity-10 animate-ping" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Ready for Action</p>
                      <p className="text-xs">Drag files to see high-performance stats</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-6 bg-secondary/20 border-t border-border/30">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase">System Stats</span>
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/40 p-3 rounded-xl border border-border/10">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-tighter">Avg. Speed</p>
                  <p className="text-lg font-bold">42.5 <span className="text-xs font-normal opacity-50">MB/s</span></p>
                </div>
                <div className="bg-background/40 p-3 rounded-xl border border-border/10">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-tighter">Availability</p>
                  <p className="text-lg font-bold text-accent">99.9 <span className="text-xs font-normal opacity-50">%</span></p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
