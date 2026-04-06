import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import FileSharePanel from './FileSharePanel';
import { UploadedFile } from '@/lib/file-utils';

interface FileListProps {
  files: UploadedFile[];
  onDelete: (id: string) => void;
  onDownload: (file: UploadedFile) => void;
}

export default function FileList({ files, onDelete, onDownload }: FileListProps) {
  const [search, setSearch] = useState('');

  const filtered = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (files.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-xl font-bold text-foreground">Your Files</h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{files.length}</span>
      </div>

      {files.length > 2 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-8 text-muted-foreground"
          >
            <FileX className="h-8 w-8" />
            <p className="text-sm">No files match your search</p>
          </motion.div>
        ) : (
          filtered.map(file => (
            <motion.div
              key={file.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <FileSharePanel file={file} onDelete={onDelete} onDownload={onDownload} />
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
