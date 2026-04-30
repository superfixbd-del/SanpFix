import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { removeBackground } from '@imgly/background-removal';
import { Upload, Trash2, Download, Sun, Droplets, Palette, Shirt, RefreshCw, Check, AlertCircle, Sparkles } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const getApiKey = () => {
  return (import.meta as any).env.VITE_GEMINI_API_KEY || (process as any).env.GEMINI_API_KEY || '';
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

// Small helper to compress image before AI call
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
  });
}

export default function PassportModule() {
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [brightness, setBrightness] = useState(100);
  const [softness, setSoftness] = useState(0);
  const [edgeFeather, setEdgeFeather] = useState(0.5);
  const [isFaceSoftened, setIsFaceSoftened] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [activeAttire, setActiveAttire] = useState<'original' | 'formal' | 'blazer' | 'auto'>('original');
  const [selectedAutoAttire, setSelectedAutoAttire] = useState<'original' | 'shirt' | 'blazer'>('shirt');
  const [shirtColor, setShirtColor] = useState<string>('white');
  const [shirtPattern, setShirtPattern] = useState<'solid' | 'check'>('solid');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!getApiKey()) {
      alert('GEMINI_API_KEY is not configured in the environment. Please add VITE_GEMINI_API_KEY to your deployment environment variables.');
    }
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImage(result);
        setProcessedImage(null);
        setActiveAttire('original');
        setStatus('Photo uploaded. Select options and click Generate.');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  } as any);

  const handleAutoPassport = async () => {
    if (!image) return;
    setIsProcessing(true);
    setStatus('AI Studio: Preserving identity & generating studio framing...');
    
    // Determine attire prompt
    let attireText = "Change the attire to a clean, crisp professional formal white button-down shirt (no tie).";
    if (selectedAutoAttire === 'original') {
      attireText = "Keep the person's original clothing but CROP the image to chest level according to passport standards.";
    } else if (selectedAutoAttire === 'blazer') {
      attireText = "Change the attire to a professional formal navy blue blazer with a white shirt underneath (no tie).";
    }

    // Determine background prompt
    const bgText = bgColor === 'transparent' || bgColor === '#ffffff' 
      ? "Ensure the background is a solid, clean studio white." 
      : `Ensure the background is a solid studio ${bgColor} color.`;

    try {
      const compressed = await compressImage(image);
      const response = await (ai as any).models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [
            { inlineData: { data: compressed.split(',')[1], mimeType: 'image/jpeg' } },
            { text: `Transform the subject in this photo into a professional studio-standard passport portrait with 100% IDENTICAL FACIAL FEATURES.
            
            STRICT VISUAL REQUIREMENTS (MANDATORY):
            1. ZERO IDENTITY MORPHING: You MUST strictly preserve the person's EXACT face, eyes, nose, lips, hair texture, and unique facial structure. Do NOT apply any generic beauty filters, skin thinning, or feature alterations. The identity must be 100% identical and recognizable as the original person.
            2. GENDER & APPEARANCE CONSISTENCY: Maintain the original person's gender and natural appearance without adding any makeup or features not present in the original.
            3. CAMERA GAZE: The person MUST look DIRECTLY into the camera lens with a natural, professional studio gaze. 
            4. STUDIO QUALITY: Apply high-end neutral studio soft-box lighting to create realistic depth and professional catchlights.
            5. IMAGE CLARITY: Enhance to Ultra-HD resolution while preserving natural skin pores and textures faithfully.
            6. ATTIRE: ${attireText}
            7. COMPOSITION & CROP (MANDATORY):
               - STANDARD SIZE: 40x50mm aspect ratio.
               - HEADROOM: Standard 25% space above the head.
               - CENTERING: Symmetrical horizontal and vertical alignment.
               - CROP LIMIT: The image MUST be cropped from the MID-CHEST area up to the top of the head.
            8. BACKGROUND: ${bgText}
            
            Output MUST be the resulting edited image segment only.` }
          ]
        }
      });

      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error('AI could not process the photo. Please try a clearer picture.');
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const aiBase64 = `data:image/png;base64,${part.inlineData.data}`;
          setProcessedImage(aiBase64);
          setActiveAttire('auto');
          
          // If attire changed or transparent requested, refine background
          if (selectedAutoAttire !== 'original' || bgColor === 'transparent') {
            setStatus('Refining studio background...');
            try {
              const filterColor = bgColor === 'transparent' ? '#ffffff' : bgColor;
              const blob = await removeBackground(aiBase64);
              setProcessedImage(URL.createObjectURL(blob));
            } catch(e) {
              console.warn('Post-AI BG removal failed');
            }
          }
          break;
        }
      }
      setStatus('Studio-quality Passport generated!');
    } catch (error: any) {
      console.error('Gemini Error:', error);
      const errorStr = JSON.stringify(error).toLowerCase();
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('resource_exhausted') || 
          errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
        setStatus('Quota Exceeded: Please wait a minute before trying again.');
      } else {
        setStatus(`AI Error: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShirtColorChange = async (color: string) => {
    if (!processedImage) return;
    setIsProcessing(true);
    setStatus(`AI Studio: Recoloring shirt to ${color}...`);
    setShirtColor(color);

    try {
      const compressed = await compressImage(processedImage);
      const response = await (ai as any).models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [
            { inlineData: { data: compressed.split(',')[1], mimeType: 'image/jpeg' } },
            { text: `Change the person's shirt color to ${color}. 
            CRITICAL: Maintain the 100% IDENTICAL facial identity, features, and natural expression. Do NOT MORPH or enhance the face differently. IDENTITY PRESERVATION is the priority. Only the shirt color should change.` }
          ]
        }
      });

      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error('AI could not recolor the shirt.');
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const aiBase64 = `data:image/png;base64,${part.inlineData.data}`;
          setProcessedImage(aiBase64);
          
          // Re-remove background to keep transparency intact
          try {
            const blob = await removeBackground(aiBase64);
            setProcessedImage(URL.createObjectURL(blob));
          } catch(e) {
            console.warn('BG removal after recolor failed');
          }
          break;
        }
      }
      setStatus(`Shirt color updated to ${color}!`);
    } catch (error: any) {
      console.error('Recolor Error:', error);
      const errorStr = JSON.stringify(error).toLowerCase();
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('resource_exhausted') || 
          errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
        setStatus('Quota Exceeded: Please wait a minute before retrying.');
      } else {
        setStatus(`Recolor Error: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveBg = async () => {
    const source = processedImage || image;
    if (!source) return;
    setIsProcessing(true);
    setStatus('Removing background...');
    try {
      const blob = await removeBackground(source, {
        progress: (key, current, total) => {
          setStatus(`Processing: ${Math.round((current / total) * 100)}%`);
        },
      });
      const url = URL.createObjectURL(blob);
      setProcessedImage(url);
      setBgColor('#ffffff');
      setStatus('Background removed successfully!');
    } catch (error) {
      console.error(error);
      setStatus('Failed to remove background.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClothingSwap = async (type: 'formal' | 'blazer') => {
    const source = processedImage || image;
    if (!source) return;
    setIsProcessing(true);
    setStatus(`Updating attire and keeping studio style...`);
    
    try {
      const compressed = await compressImage(source);
      const styleDesc = type === 'formal' 
        ? `professional formal ${shirtPattern === 'solid' ? 'solid-colored' : 'checkered pattern'} white button-down shirt` 
        : 'navy blue blazer with a white shirt';

      const response = await (ai as any).models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [
            { inlineData: { data: compressed.split(',')[1], mimeType: 'image/jpeg' } },
            { text: `Edit this professional studio portrait with 100% IDENTITY PRESERVATION.
            
            REQUIREMENTS:
            1. ATTIRE: Change the person's clothing to a ${styleDesc}.
            2. IDENTITY: Preserve the EXACT face, features, and bone structure. ZERO MORPHING or beauty enhancement. The subject's appearance must remain 100% identical to the original photo.
            3. GAZE: Direct to camera lens.` }
          ]
        }
      });

      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error('AI could not swap attire');
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const aiBase64 = `data:image/png;base64,${part.inlineData.data}`;
          setProcessedImage(aiBase64);
          setActiveAttire(type);
          
          // Re-apply background removal to keep transparency for the color picker
          setStatus('Refining attire and background...');
          try {
            const blob = await removeBackground(aiBase64);
            setProcessedImage(URL.createObjectURL(blob));
          } catch(e) {
            console.warn('Post-swap BG removal failed');
          }
          break;
        }
      }
      setStatus('Attire updated successfully!');
    } catch (error: any) {
      console.error('Gemini Error:', error);
      const errorStr = JSON.stringify(error).toLowerCase();
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('resource_exhausted') || 
          errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
        setStatus('Quota Exceeded: Please wait a minute.');
      } else {
        setStatus(`AI Error: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFaceSoftness = async () => {
    const source = processedImage || image;
    if (!source) return;
    setIsProcessing(true);
    setStatus(`AI Studio: Applying skin smoothing (${softness * 10}%)...`);
    
    try {
      const compressed = await compressImage(source);
      const response = await (ai as any).models.generateContent({
        model: 'gemini-1.5-flash',
        contents: {
          parts: [
            { inlineData: { data: compressed.split(',')[1], mimeType: 'image/jpeg' } },
            { text: `Professionally retouch this studio photo while keeping the person 100% IDENTICAL. 
            
            ENHANCEMENT RULES:
            1. SKIN: Apply subtle professional skin smoothing while preserving ORIGINAL textures, features, and natural skin marks. No plastic look.
            2. IDENTITY: ZERO MORPHING. Facial structure, nose shape, and eye characteristics must remain 100% accurate. IDENTITY CONSISTENCY is the absolute priority.
            3. EYES: Enhance clarity while maintaining original gaze and shape.
            4. LIGHTING: Optimize for high-end studio lighting.` }
          ]
        }
      });

      if (!response.candidates?.[0]?.content?.parts) {
        throw new Error('AI could not refine skin');
      }

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const aiBase64 = `data:image/png;base64,${part.inlineData.data}`;
          setProcessedImage(aiBase64);
          setIsFaceSoftened(true);
          
          // Refine background again to maintain consistency
          try {
            const blob = await removeBackground(aiBase64);
            setProcessedImage(URL.createObjectURL(blob));
          } catch(e) {
            console.warn('BG removal failed after softening');
          }
          break;
        }
      }
      setStatus('Face skin polished successfully!');
    } catch (error: any) {
      console.error('Softness Error:', error);
      const errorStr = JSON.stringify(error).toLowerCase();
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('resource_exhausted') || 
          errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('resource_exhausted')) {
        setStatus('Quota Exceeded: Please wait a minute before retrying.');
      } else {
        setStatus(`Softness Error: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = processedImage || image || '';
    
    img.onload = () => {
      // Standard 40mm x 50mm at 300 DPI
      // 1mm = 11.811 pixels at 300 DPI
      const width = Math.round(40 * 11.811);
      const height = Math.round(50 * 11.811);
      
      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        // Draw Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);

        // Draw Image (Centered and scaled to fit)
        const scale = Math.max(width / img.width, height / img.height);
        const x = (width - img.width * scale) / 2;
        const y = (height - img.height * scale) / 2;
        
        ctx.filter = `brightness(${brightness}%) ${processedImage ? `url(#edge-feather)` : ''}`;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        const link = document.createElement('a');
        link.download = 'passport_photo.png';
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      }
    };
  };

  return (
    <div className="flex flex-col">
      <header className="h-auto py-4 lg:h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4">
        <SVGFeather stdDeviation={edgeFeather} />
        <div>
          <h2 className="text-lg lg:text-xl font-semibold text-slate-800">Passport Photo Generation</h2>
        </div>
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
          <button onClick={() => { setImage(null); setProcessedImage(null); }} className="btn-secondary text-xs lg:text-sm flex-1 sm:flex-none">
            Reset
          </button>
          {processedImage && (
            <button onClick={handleDownload} className="btn-primary text-xs lg:text-sm flex-1 sm:flex-none">
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row p-1 sm:p-4 lg:p-8 gap-4 lg:gap-8 overflow-y-auto">
        {/* Preview Area */}
        <div className="flex-1 flex flex-col gap-4 sm:gap-6">
          <div 
            className={cn(
              "relative flex-1 bg-white rounded-xl sm:rounded-3xl border-2 border-dashed border-slate-200 shadow-sm overflow-hidden flex items-center justify-center transition-all min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]",
              !image && "hover:border-blue-400 hover:bg-blue-50/50"
            )}
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            
            <AnimatePresence mode="wait">
              {!image ? (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center p-4 sm:p-8"
                >
                  <div className="w-10 h-10 sm:w-16 sm:h-16 bg-slate-100 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <Upload className="w-5 h-5 sm:w-8 sm:h-8 text-slate-400" />
                  </div>
                  <p className="font-bold text-slate-800 text-xs sm:text-base">Upload Source Photo</p>
                  <p className="text-[10px] sm:text-sm text-slate-400 mt-1">Click or drag photo to start</p>
                </motion.div>
              ) : (
                <motion.div 
                  key="preview-container"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative h-full w-full flex items-center justify-center bg-slate-50 p-1 sm:p-4 lg:p-6 overflow-hidden"
                >
                  <div className={cn(
                    "relative shadow-2xl rounded-xl overflow-hidden border border-slate-300 aspect-[4/5] w-full max-w-[280px] sm:max-w-[320px] md:max-w-md lg:h-full lg:max-h-full",
                    bgColor === 'transparent' ? "bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-slate-200" : "bg-white"
                  )}>
                    <div 
                      className="absolute inset-0 transition-all flex items-center justify-center"
                      style={{ 
                        backgroundColor: bgColor === 'transparent' ? 'transparent' : bgColor,
                        filter: `brightness(${brightness}%)` 
                      }}
                    >
                      <img 
                        src={processedImage || image} 
                        alt="Preview" 
                        className="w-full h-full object-contain"
                        style={{ 
                          filter: processedImage ? `url(#edge-feather)` : 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div className="absolute top-6 right-6 flex flex-col gap-2">
                    {processedImage && (
                      <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-500/20 uppercase">
                        BG Removed
                      </div>
                    )}
                    <div className="px-3 py-1 bg-blue-500/10 text-blue-600 text-[10px] font-bold rounded-full border border-blue-500/20 uppercase">
                      Face Aligned
                    </div>
                  </div>

                  <button 
                    onClick={(e) => { e.stopPropagation(); setImage(null); setProcessedImage(null); }}
                    className="absolute top-6 left-6 p-2 bg-white text-red-500 border border-slate-200 rounded-full hover:bg-red-50 transition-colors shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {isProcessing && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center z-20">
                <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="font-bold text-slate-800">{status}</p>
                <div className="w-48 h-1 bg-slate-200 rounded-full mt-4 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="h-full bg-blue-600"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:h-32 shrink-0">
            <div className="glass-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Resolution</div>
                <div className="font-bold text-slate-800">300 DPI High-Res</div>
              </div>
            </div>
            <div className="glass-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                <Shirt className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Inpainting</div>
                <div className="font-bold text-slate-800">Clothing Swap Enabled</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Area */}
        <aside className="w-full lg:w-80 flex flex-col gap-4 sm:gap-6 shrink-0">
          <div className="glass-card p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-600" />
              AI Customization
            </h3>

            {/* Background Color */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Background Color</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setBgColor('transparent')}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center overflow-hidden",
                    bgColor === 'transparent' ? "border-blue-600 ring-4 ring-blue-50" : "border-slate-100"
                  )}
                >
                  <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
                  <span className="absolute text-[8px] font-bold text-slate-500">TR</span>
                </button>
                {['#ffffff', '#3b82f6', '#f1f5f9', '#0f172a'].map(color => (
                  <button
                    key={color}
                    onClick={() => setBgColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                      bgColor === color ? "border-blue-600 ring-4 ring-blue-50" : "border-slate-100"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-indigo-400 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                  <input 
                    type="color" 
                    value={bgColor} 
                    onChange={(e) => setBgColor(e.target.value)}
                    className="opacity-0 absolute w-8 h-8 cursor-pointer"
                  />
                  <Palette className="w-4 h-4 text-white pointer-events-none" />
                </div>
              </div>
            </div>

            {/* AI Tools */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Auto Passport Settings</label>
              
              <div className="grid grid-cols-3 gap-1 mb-2">
                {[
                  { id: 'original', label: 'As Is' },
                  { id: 'shirt', label: 'Shirt' },
                  { id: 'blazer', label: 'Blazer' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedAutoAttire(opt.id as any)}
                    className={cn(
                      "py-1.5 px-1 rounded-md text-[10px] font-bold transition-all border",
                      selectedAutoAttire === opt.id 
                        ? "bg-blue-600 border-blue-600 text-white" 
                        : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button 
                onClick={handleAutoPassport}
                disabled={!image || isProcessing}
                className={cn(
                  "w-full btn-primary !bg-emerald-600 !hover:bg-emerald-700 !shadow-emerald-100 flex items-center justify-center gap-2 py-3 mb-2 font-bold",
                  activeAttire === 'auto' && "ring-4 ring-emerald-100"
                )}
              >
                <Sparkles className="w-5 h-5 text-white" />
                Generate Auto Passport
              </button>

              {activeAttire !== 'original' && processedImage && (
                <div className="pt-2 border-t border-slate-100 mt-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Change Shirt Color</label>
                  <div className="flex gap-2">
                    {['white', 'blue', 'pink', 'black'].map(color => (
                      <button
                        key={color}
                        onClick={() => handleShirtColorChange(color)}
                        className={cn(
                          "w-6 h-6 rounded-md border text-[10px] font-bold capitalize transition-all",
                          shirtColor === color ? "ring-2 ring-blue-500 border-blue-500" : "border-slate-200"
                        )}
                        style={{ backgroundColor: color === 'white' ? '#fff' : color === 'blue' ? '#dbeafe' : color === 'pink' ? '#fce7f3' : '#334155', color: color === 'black' ? 'white' : 'black' }}
                      >
                        {color[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 text-center">Manual AI Edits</label>
                
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => setShirtPattern('solid')}
                    className={cn(
                      "flex-1 py-1 rounded-md text-[10px] font-bold border transition-all",
                      shirtPattern === 'solid' ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-500"
                    )}
                  >
                    Solid
                  </button>
                  <button
                    onClick={() => setShirtPattern('check')}
                    className={cn(
                      "flex-1 py-1 rounded-md text-[10px] font-bold border transition-all",
                      shirtPattern === 'check' ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-500"
                    )}
                  >
                    Check
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleClothingSwap('formal')}
                  disabled={!image || isProcessing}
                  className={cn(
                    "py-2 px-3 border rounded-lg text-xs font-semibold transition-all",
                    activeAttire === 'formal' ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"
                  )}
                >
                  Apply Shirt
                </button>
                <button 
                  onClick={() => handleClothingSwap('blazer')}
                  disabled={!image || isProcessing}
                  className={cn(
                    "py-2 px-3 border rounded-lg text-xs font-semibold transition-all",
                    activeAttire === 'blazer' ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"
                  )}
                >
                  Formal Blazer
                </button>
              </div>
              <button 
                onClick={handleRemoveBg}
                disabled={!image || isProcessing}
                className="w-full btn-secondary text-xs mt-2"
              >
                <Palette className="w-3 h-3 text-blue-600" />
                Smart BG Removal
              </button>
            </div>

            {/* Sliders */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Sun className="w-3 h-3" /> Brightness</span>
                  <span className="text-blue-600">{brightness}%</span>
                </div>
                <div className="relative h-1.5 bg-slate-100 rounded-full mt-2">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${(brightness - 50) / 100 * 100}%` }}
                    className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
                  />
                  <input 
                    type="range" min="50" max="150" value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Droplets className="w-3 h-3" /> Face Skin Polish (AI)</span>
                  <span className="text-blue-600">{softness * 10}%</span>
                </div>
                <div className="relative h-1.5 bg-slate-100 rounded-full mt-2">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${softness * 10}%` }}
                    className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
                  />
                  <input 
                    type="range" min="0" max="10" step="1" value={softness}
                    onChange={(e) => setSoftness(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
                <button
                  onClick={handleFaceSoftness}
                  disabled={!image || isProcessing}
                  className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold border border-blue-100 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3 h-3" />
                  Apply Face Softness
                </button>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Droplets className="w-3 h-3" /> Edge Feathering</span>
                  <span className="text-blue-600">{edgeFeather * 20}%</span>
                </div>
                <div className="relative h-1.5 bg-slate-100 rounded-full mt-2">
                  <motion.div 
                    initial={false}
                    animate={{ width: `${edgeFeather * 10}%` }}
                    className="absolute inset-y-0 left-0 bg-blue-600 rounded-full"
                  />
                  <input 
                    type="range" min="0" max="5" step="0.1" value={edgeFeather}
                    onChange={(e) => setEdgeFeather(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
          
          <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-lg shadow-blue-200 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-blue-200" />
              <span className="font-bold">Pro Tip</span>
            </div>
            <p className="text-sm text-blue-50 leading-relaxed">
              Standard passport photos require a neutral expression and high resolution. For best shirt-swaps, look directly at the lens.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SVGFeather({ stdDeviation }: { stdDeviation: number }) {
  return (
    <svg width="0" height="0" className="absolute invisible">
      <defs>
        <filter id="edge-feather" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation={stdDeviation} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}

function Settings2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 7h-9" />
      <path d="M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </svg>
  );
}
