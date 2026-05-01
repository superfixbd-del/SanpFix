import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { jsPDF } from 'jspdf';
import { 
  Camera, FileText, Scan, Layers, Download, Check, 
  RefreshCw, Smartphone, CreditCard, Scissors, 
  Wand2, Maximize2, ZoomIn, X, Move
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import PerspectiveCropper from './PerspectiveCropper';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const getApiKey = () => {
  return (import.meta as any).env.VITE_GEMINI_API_KEY || (process as any).env.GEMINI_API_KEY || '';
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface NIDCard {
  front: string | null;
  back: string | null;
  frontOriginal: string | null;
  backOriginal: string | null;
}

interface Point {
  x: number;
  y: number;
}

async function compressImage(base64Str: string, maxWidth = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(base64Str);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function NIDModule() {
  const [cards, setCards] = useState<NIDCard>({ 
    front: null, 
    back: null, 
    frontOriginal: null, 
    backOriginal: null 
  });
  const [detectedPoints, setDetectedPoints] = useState<Record<string, Point[]>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [autoCrop, setAutoCrop] = useState(true);
  
  // Cropper State
  const [cropType, setCropType] = useState<'front' | 'back' | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const cropperRef = React.useRef<any>(null);

  const onDrop = useCallback((acceptedFiles: File[], type: 'front' | 'back') => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setCards(prev => ({ 
          ...prev, 
          [type]: result,
          [`${type}Original`]: result 
        }));
        if (autoCrop) detectAndCrop(result, type);
      };
      reader.readAsDataURL(file);
    }
  }, [autoCrop]);

  const detectAndCrop = async (imageData: string, type: 'front' | 'back') => {
    setIsProcessing(true);
    setStatus(`AI: Detecting and cropping ${type} card...`);
    try {
      const compressed = await compressImage(imageData);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: compressed.split(',')[1], mimeType: 'image/jpeg' } },
            { text: `Locate the Bangladesh National ID (NID) card in this photo. 
            
            SPECIFIC INSTRUCTIONS:
            1. Identify the exact four corner points of the physical card, ignoring any background, hands, or surrounding clutter.
            2. The card is a rectangle. Ensure the points follow the card's actual physical edges.
            3. Return only a JSON object with keys "tl", "tr", "br", "bl" for Top-Left, Top-Right, Bottom-Right, and Bottom-Left respectively.
            4. Each value must be an [x, y] array where x and y are percentages (0-100) of the total image width and height.
            
            Example output: {"tl": [10.5, 20.1], "tr": [89.2, 21.5], "br": [88.5, 78.2], "bl": [11.2, 79.5]}
            
            Return ONLY the valid JSON.` }
          ]
        }
      });

      const responseText = response.text || '';
      const jsonMatch = responseText.match(/\{.*\}/s);
      if (!jsonMatch) throw new Error('AI could not locate the card corner points.');
      
      const pts = JSON.parse(jsonMatch[0]);

      // Save detected points for manual adjustment later
      const tl = pts.tl || [pts.left, pts.top];
      const tr = pts.tr || [pts.right, pts.top];
      const br = pts.br || [pts.right, pts.bottom];
      const bl = pts.bl || [pts.left, pts.bottom];

      setDetectedPoints(prev => ({
        ...prev,
        [type]: [
          { x: tl[0], y: tl[1] },
          { x: tr[0], y: tr[1] },
          { x: br[0], y: br[1] },
          { x: bl[0], y: bl[1] },
        ]
      }));

      const img = new Image();
      img.src = imageData;
      await new Promise((resolve) => { img.onload = resolve; });

      // We still use a simple crop for the "Preview" in the auto-crop phase 
      // but the manual adjustment will now be much better if needed.
      // For the AUTO phase's output, we can actually do a basic warp too!
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context failed");

      // Set destination size (86x54 aspect)
      const destWidth = 1000;
      const destHeight = 628;
      canvas.width = destWidth;
      canvas.height = destHeight;

      // For auto-crop, if we don't want to implement a full warp in JS here (slow), 
      // we can just take the bounding box for the preview.
      // But let's try a simple "Perspective-Aware" bounding box.
      const minX = Math.min(tl[0], tr[0], br[0], bl[0]);
      const maxX = Math.max(tl[0], tr[0], br[0], bl[0]);
      const minY = Math.min(tl[1], tr[1], br[1], bl[1]);
      const maxY = Math.max(tl[1], tr[1], br[1], bl[1]);

      const width = img.width * (maxX - minX) / 100;
      const height = img.height * (maxY - minY) / 100;
      const x = img.width * minX / 100;
      const y = img.height * minY / 100;

      ctx.drawImage(img, x, y, width, height, 0, 0, destWidth, destHeight);
      setCards(prev => ({ ...prev, [type]: canvas.toDataURL('image/png') }));
      setStatus(`${type === 'front' ? 'Front' : 'Back'} card auto-detected!`);
    } catch (error: any) {
      console.error('Detection Error:', error);
      const errorStr = JSON.stringify(error).toLowerCase();
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('resource_exhausted') || 
          errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
        setStatus('AI Quota Exceeded: Please wait a minute before trying again.');
      } else {
        setStatus(`Auto-crop failed for ${type}. Use manual crop.`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnhance = async (type: 'front' | 'back') => {
    const source = cards[type];
    if (!source) return;
    
    setIsProcessing(true);
    setStatus(`AI: Enhancing ${type} card clarity...`);
    
    try {
      const compressed = await compressImage(source);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: compressed.split(',')[1], mimeType: 'image/jpeg' } },
            { text: "Enhance this NID card image. Improve clarity, sharpen text, normalize exposure, and remove background color noise. Output ONLY the resulting high-quality image data part." }
          ]
        }
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const enhanced = `data:image/png;base64,${part.inlineData.data}`;
          setCards(prev => ({ ...prev, [type]: enhanced }));
          break;
        }
      }
      setStatus(`${type === 'front' ? 'Front' : 'Back'} card enhanced!`);
    } catch (error: any) {
      console.error('Enhance Error:', error);
      const errorStr = JSON.stringify(error).toLowerCase();
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('resource_exhausted') || 
          errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
        setStatus('AI Quota Exceeded: Please wait a minute before trying again.');
      } else {
        setStatus('Enhancement failed.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualCropSave = async (croppedImage: string) => {
    if (cropType) {
      setCards(prev => ({ ...prev, [cropType]: croppedImage }));
      setCropType(null);
      setStatus(`${cropType === 'front' ? 'Front' : 'Back'} card perspective corrected!`);
    }
  };

  const startManualCrop = (type: 'front' | 'back') => {
    const original = cards[`${type}Original` as keyof NIDCard];
    if (!original) return;
    setTempImage(original);
    setCropType(type);
  };

  const handleExportPDF = () => {
    if (!cards.front || !cards.back) return;
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const cardWidth = 86;
    const cardHeight = 54;
    const gap = 10;
    const totalHeight = (cardHeight * 2) + gap;
    const startY = (297 - totalHeight) / 2;
    const centerX = (210 - cardWidth) / 2;

    doc.addImage(cards.front, 'PNG', centerX, startY, cardWidth, cardHeight);
    doc.addImage(cards.back, 'PNG', centerX, startY + cardHeight + gap, cardWidth, cardHeight);

    doc.setDrawColor(220);
    doc.setLineDashPattern([2, 1], 0);
    doc.rect(centerX, startY, cardWidth, cardHeight);
    doc.rect(centerX, startY + cardHeight + gap, cardWidth, cardHeight);

    doc.save('nid_print_ready.pdf');
  };

  return (
    <div className="flex flex-col">
      <header className="h-auto py-4 lg:h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4">
        <div>
          <h2 className="text-lg lg:text-xl font-semibold text-slate-800">NID Card Formatting</h2>
        </div>
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setAutoCrop(!autoCrop)}
            className={cn(
              "btn-secondary text-xs lg:text-sm flex-1 sm:flex-none",
              autoCrop && "bg-blue-50 border-blue-200 text-blue-700"
            )}
          >
           <Scan className="w-4 h-4" />
           {autoCrop ? 'Auto: ON' : 'Auto: OFF'}
          </button>
          {cards.front && cards.back && (
            <button onClick={handleExportPDF} className="btn-primary text-xs lg:text-sm shadow-md flex-1 sm:flex-none">
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row p-2 sm:p-4 lg:p-8 gap-4 lg:gap-8">
        <div className="flex-1 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <FileUploadBox 
              type="front" 
              image={cards.front} 
              onDrop={(f) => onDrop(f, 'front')} 
              isProcessing={isProcessing}
              onManualCrop={() => startManualCrop('front')}
              onEnhance={() => handleEnhance('front')}
            />
            <FileUploadBox 
              type="back" 
              image={cards.back} 
              onDrop={(f) => onDrop(f, 'back')} 
              isProcessing={isProcessing}
              onManualCrop={() => startManualCrop('back')}
              onEnhance={() => handleEnhance('back')}
            />
          </div>

          <AnimatePresence>
            {status && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-sm"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                <span className="font-medium text-slate-600 italic">“{status}”</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* A4 Preview Sidebar */}
        <aside className="w-full lg:w-80 flex flex-col gap-4 sm:gap-6 shrink-0 order-last">
          <div className="glass-card p-4 sm:p-6 flex flex-col items-center">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-6">A4 Print Canvas</h3>
            <div className="w-[210px] h-[297px] bg-white shadow-2xl border border-slate-300 p-4 flex flex-col items-center justify-center gap-3 relative overflow-hidden origin-top scale-[0.85]">
              <div className="text-[6px] text-slate-300 absolute top-2 left-2 uppercase font-mono tracking-tighter">PRECISE LAYOUT</div>
              
              <div className="w-[86px] h-[54px] border border-dashed border-slate-200 flex items-center justify-center bg-slate-50 relative rounded-[2px] overflow-hidden shadow-sm">
                {cards.front ? (
                  <img src={cards.front} className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-4 h-4 text-slate-200" />
                )}
              </div>
              <div className="w-[86px] h-[54px] border border-dashed border-slate-200 flex items-center justify-center bg-slate-50 relative rounded-[2px] overflow-hidden shadow-sm">
                {cards.back ? (
                  <img src={cards.back} className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-4 h-4 text-slate-200" />
                )}
              </div>

              <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:10px_10px] opacity-[0.03] pointer-events-none" />
            </div>
            
            <div className="mt-4 space-y-4 w-full">
              <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-blue-200" />
                  <span className="font-bold text-xs uppercase tracking-wider">Features</span>
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] text-blue-100 flex gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-500/50 flex shrink-0 items-center justify-center text-[10px]">1</span>
                    Auto-detection of NID card boundaries.
                  </p>
                  <p className="text-[11px] text-blue-100 flex gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-500/50 flex shrink-0 items-center justify-center text-[10px]">2</span>
                    Manual crop for pixel-perfect adjustments.
                  </p>
                  <p className="text-[11px] text-blue-100 flex gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-500/50 flex shrink-0 items-center justify-center text-[10px]">3</span>
                    AI Enhance for high-quality scanned results.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {cropType && tempImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 lg:p-8 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-3xl lg:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] lg:h-[80vh]"
            >
              <div className="p-4 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-blue-600">
                    <Scissors className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-800">Fine-tune Cropping</h3>
                    <p className="text-[10px] sm:text-sm text-slate-500">Zoom and pan to select the card edges</p>
                  </div>
                </div>
                <button onClick={() => setCropType(null)} className="p-2 sm:p-3 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 relative bg-slate-900 border-y border-slate-800 overflow-hidden flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center">
                  {tempImage && (
                    <PerspectiveCropper
                      image={tempImage}
                      initialPoints={detectedPoints[cropType] || undefined}
                      onComplete={handleManualCropSave}
                      onCancel={() => setCropType(null)}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FileUploadBox({ type, image, onDrop, isProcessing, onManualCrop, onEnhance }: any) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
    disabled: isProcessing
  } as any);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
          {type === 'front' ? <CreditCard className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
          {type} view
        </label>
        {image && (
          <div className="flex gap-2">
            <button 
              onClick={onEnhance} 
              disabled={isProcessing}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold transition-all border border-indigo-100 hover:bg-indigo-100 flex items-center gap-1.5"
            >
              <Wand2 className="w-3 h-3" /> Enhance
            </button>
            <button 
              onClick={onManualCrop} 
              disabled={isProcessing}
              className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold transition-all border border-slate-200 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <Maximize2 className="w-3 h-3" /> Adjust
            </button>
          </div>
        )}
      </div>

      <div 
        {...getRootProps()}
        className={cn(
          "relative aspect-[86/54] rounded-2xl sm:rounded-[2.5rem] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden group/box",
          image ? "border-blue-200 bg-white shadow-xl shadow-blue-900/5" : "border-slate-200 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-300",
          isDragActive && "bg-blue-50 border-blue-500 scale-[1.01]"
        )}
      >
        <input {...getInputProps()} />
        {image ? (
          <>
            <img src={image} className="w-full h-full object-cover filter contrast-[1.02]" />
            <div className="absolute inset-0 bg-black/0 group-hover/box:bg-black/5 transition-colors" />
            <div className="absolute top-4 right-4 translate-y-[-10px] opacity-0 group-hover/box:translate-y-0 group-hover/box:opacity-100 transition-all">
              <div className="px-3 py-1.5 bg-white shadow-xl rounded-xl border border-slate-100 flex items-center gap-2">
                <RefreshCw className="w-3 h-3 text-blue-600" />
                <span className="text-[10px] font-bold text-slate-700">Replace Photo</span>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 p-2 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">Ready for Print</span>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-white rounded-[2rem] shadow-sm border border-slate-50 flex items-center justify-center mx-auto mb-5 group-hover/box:scale-110 transition-transform">
              <Layers className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-base text-slate-700 font-bold mb-1">
              {isDragActive ? "Drop scan here" : `Upload your ${type} side`}
            </p>
            <p className="text-xs text-slate-400 font-medium tracking-wide">AI will automatically detect and crop</p>
          </div>
        )}
      </div>
    </div>
  );
}

