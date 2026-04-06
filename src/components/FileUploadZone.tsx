import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileUp, X, Zap, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateFile, formatFileSize, getFileIcon } from '@/lib/file-utils';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  progress: number;
}

export default function FileUploadZone({ onFilesSelected, isUploading, progress }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  const processFiles = (files: File[]) => {
    setError(null);
    const validatedFiles = [];
    for (const file of files) {
      const err = validateFile(file);
      if (err) {
        setError(err);
        return;
      }
      validatedFiles.push(file);
    }

    if (validatedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validatedFiles]);
      onFilesSelected(validatedFiles);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  return (
    <div className="w-full">
      <motion.div
        className={`upload-zone cursor-pointer text-center relative overflow-hidden group ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />

        <motion.div
          animate={isDragging ? { scale: 1.05, y: -2 } : { scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="relative z-10 py-10"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
            <Upload className="h-10 w-10 text-primary group-hover:scale-110 transition-transform duration-300" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            {isDragging ? 'Drop to start' : 'Instant Upload'}
          </h2>
          <p className="mt-2 text-muted-foreground">
            Drag & drop files here or <span className="text-primary font-semibold">browse</span>
          </p>
          <div className="mt-6 flex items-center justify-center gap-4 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" /> No size limit</span>
            <span className="h-1 w-1 rounded-full bg-border" />
            <span className="flex items-center gap-1"><Cloud className="h-3 w-3 text-primary" /> Parallel processing</span>
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-sm font-medium text-destructive bg-destructive/10 py-2 rounded-lg"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
