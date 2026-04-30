import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Maximize2, Download, Image as ImageIcon, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ImagePreviewer() {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setFileName(file.name);
      setFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  } as any);

  const clearImage = () => {
    setImage(null);
    setFileName(null);
    setFileSize(null);
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">ছবি আপলোডার</h2>
        <p className="text-slate-500">আপনার ছবি আপলোড করুন এবং সাথে সাথে প্রিভিউ দেখুন</p>
      </div>

      <div 
        {...getRootProps()}
        className={cn(
          "relative group cursor-pointer transition-all duration-300",
          "aspect-video md:aspect-[21/9] rounded-[2rem] border-4 border-dashed",
          image ? "border-blue-200 bg-white shadow-2xl shadow-blue-500/10" : "border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5",
          isDragActive && "border-blue-500 bg-blue-50 scale-[1.01]"
        )}
      >
        <input {...getInputProps()} />
        
        <AnimatePresence mode="wait">
          {!image ? (
            <motion.div 
              key="upload-prompt"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm border border-blue-100">
                <Upload className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">ছবি এখানে ড্রপ করুন</h3>
              <p className="text-slate-400 text-sm max-w-xs">অথবা আপনার কম্পিউটার থেকে ছবি বাছাই করতে এখানে ক্লিক করুন</p>
              <div className="mt-8 px-6 py-2 bg-white rounded-full border border-slate-200 text-xs font-bold text-slate-500 shadow-sm group-hover:border-blue-300 transition-colors">
                PNG, JPG, WEBP (Max 10MB)
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="image-preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 p-4"
            >
              <img 
                src={image} 
                alt="Uploaded Preview" 
                className="w-full h-full object-cover rounded-2xl shadow-inner border border-slate-100" 
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); }}
                  className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-blue-600 transition-all border border-white/30"
                  title="Full Preview"
                >
                  <Maximize2 className="w-6 h-6" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); clearImage(); }}
                  className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-red-500 hover:text-white transition-all border border-white/30"
                  title="Remove Image"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {image && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 border border-blue-100/50">
              <ImageIcon className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 line-clamp-1">{fileName}</h4>
              <p className="text-xs text-slate-400 font-medium">{fileSize}</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={() => setIsPreviewOpen(true)}
              className="flex-1 md:flex-none btn-secondary h-12 px-6"
            >
              <Maximize2 className="w-4 h-4" />
              প্রিভিউ
            </button>
            <a 
              href={image} 
              download={fileName || 'preview.png'}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Download className="w-4 h-4" />
              ডাউনলোড
            </a>
          </div>
        </motion.div>
      )}

      {/* Full Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && image && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-4 md:p-8"
            onClick={() => setIsPreviewOpen(false)}
          >
            <button 
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all border border-white/10"
              onClick={() => setIsPreviewOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
            
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={image} 
                alt="Full Preview" 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl shadow-black/50 border border-white/10" 
              />
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/60 text-xs font-mono uppercase tracking-widest text-center w-full">
                {fileName} • {fileSize}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
