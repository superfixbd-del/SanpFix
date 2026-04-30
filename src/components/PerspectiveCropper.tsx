import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Point {
  x: number;
  y: number;
}

interface PerspectiveCropperProps {
  image: string;
  onComplete: (croppedImage: string) => void;
  onCancel: () => void;
  initialPoints?: Point[];
}

// Internal perspective transform math to avoid dependency issues
function getPerspectiveTransform(src: number[][], dst: number[][]) {
  const [p0, p1, p2, p3] = src;
  const [q0, q1, q2, q3] = dst;

  const x0 = p0[0], y0 = p0[1];
  const x1 = p1[0], y1 = p1[1];
  const x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1];

  const u0 = q0[0], v0 = q0[1];
  const u1 = q1[0], v1 = q1[1];
  const u2 = q2[0], v2 = q2[1];
  const u3 = q3[0], v3 = q3[1];

  const a = [
    [x0, y0, 1, 0, 0, 0, -u0 * x0, -u0 * y0],
    [0, 0, 0, x0, y0, 1, -v0 * x0, -v0 * y0],
    [x1, y1, 1, 0, 0, 0, -u1 * x1, -u1 * y1],
    [0, 0, 0, x1, y1, 1, -v1 * x1, -v1 * y1],
    [x2, y2, 1, 0, 0, 0, -u2 * x2, -u2 * y2],
    [0, 0, 0, x2, y2, 1, -v2 * x2, -v2 * y2],
    [x3, y3, 1, 0, 0, 0, -u3 * x3, -u3 * y3],
    [0, 0, 0, x3, y3, 1, -v3 * x3, -v3 * y3]
  ];

  const b = [u0, v0, u1, v1, u2, v2, u3, v3];

  // Solve using Gaussian Elimination
  const n = 8;
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(a[j][i]) > Math.abs(a[max][i])) max = j;
    }
    [a[i], a[max]] = [a[max], a[i]];
    [b[i], b[max]] = [b[max], b[i]];

    for (let j = i + 1; j < n; j++) {
      const f = a[j][i] / a[i][i];
      b[j] -= f * b[i];
      for (let k = i; k < n; k++) {
        a[j][k] -= f * a[i][k];
      }
    }
  }

  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += a[i][j] * x[j];
    }
    x[i] = (b[i] - sum) / a[i][i];
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7] = x;
  
  return {
    transform: (px: number, py: number) => {
      const z = h6 * px + h7 * py + 1;
      return [
        (h0 * px + h1 * py + h2) / z,
        (h4 * px + h5 * py + h3) / z // wait, let's check index
      ];
    }
  };
}

// Corrected index for transform
function getInverseTransform(src: number[][], dst: number[][]) {
  // We want to transform from DEST pixels to SOURCE points
  // So we swap src and dst in the solver
  const [p0, p1, p2, p3] = dst; // Destination points (rectangular)
  const [q0, q1, q2, q3] = src; // Source points (quadrilateral)

  const x0 = p0[0], y0 = p0[1];
  const x1 = p1[0], y1 = p1[1];
  const x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1];

  const u0 = q0[0], v0 = q0[1];
  const u1 = q1[0], v1 = q1[1];
  const u2 = q2[0], v2 = q2[1];
  const u3 = q3[0], v3 = q3[1];

  const a = [
    [x0, y0, 1, 0, 0, 0, -u0 * x0, -u0 * y0],
    [0, 0, 0, x0, y0, 1, -v0 * x0, -v0 * y0],
    [x1, y1, 1, 0, 0, 0, -u1 * x1, -u1 * y1],
    [0, 0, 0, x1, y1, 1, -v1 * x1, -v1 * y1],
    [x2, y2, 1, 0, 0, 0, -u2 * x2, -u2 * y2],
    [0, 0, 0, x2, y2, 1, -v2 * x2, -v2 * y2],
    [x3, y3, 1, 0, 0, 0, -u3 * x3, -u3 * y3],
    [0, 0, 0, x3, y3, 1, -v3 * x3, -v3 * y3]
  ];

  const b = [u0, v0, u1, v1, u2, v2, u3, v3];

  const n = 8;
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(a[j][i]) > Math.abs(a[max][i])) max = j;
    }
    [a[i], a[max]] = [a[max], a[i]];
    [b[i], b[max]] = [b[max], b[i]];

    for (let j = i + 1; j < n; j++) {
      const f = a[j][i] / a[i][i];
      b[j] -= f * b[i];
      for (let k = i; k < n; k++) {
        a[j][k] -= f * a[i][k];
      }
    }
  }

  const coeffs = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += a[i][j] * coeffs[j];
    }
    coeffs[i] = (b[i] - sum) / a[i][i];
  }

  return {
    transform: (x: number, y: number) => {
      const den = coeffs[6] * x + coeffs[7] * y + 1;
      return [
        (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / den,
        (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / den
      ];
    }
  };
}

export default function PerspectiveCropper({ image, onComplete, onCancel, initialPoints }: PerspectiveCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  
  // Points in percentages (0-100)
  const [pts, setPts] = useState<Point[]>(initialPoints || [
    { x: 15, y: 15 }, // TL
    { x: 85, y: 15 }, // TR
    { x: 85, y: 85 }, // BR
    { x: 15, y: 85 }, // BL
  ]);

  const [isWarping, setIsWarping] = useState(false);
  const [activePoint, setActivePoint] = useState<number | null>(null);

  useEffect(() => {
    if (initialPoints) setPts(initialPoints);
  }, [initialPoints]);

  const handleReset = () => {
    setPts([
      { x: 15, y: 15 },
      { x: 85, y: 15 },
      { x: 85, y: 85 },
      { x: 15, y: 85 },
    ]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activePoint === null) return;
      
      const step = e.shiftKey ? 1 : 0.1;
      let dx = 0;
      let dy = 0;

      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else return;

      e.preventDefault();
      setPts(prev => {
        const next = [...prev];
        next[activePoint] = {
          x: Math.max(0, Math.min(100, next[activePoint].x + dx)),
          y: Math.max(0, Math.min(100, next[activePoint].y + dy)),
        };
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePoint]);

  useEffect(() => {
    const img = new Image();
    img.src = image;
    img.onload = () => {
      setImgSize({ w: img.width, h: img.height });
      updateContainerSize();
    };
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, [image]);

  const updateContainerSize = () => {
    if (containerRef.current) {
      setContainerSize({
        w: containerRef.current.clientWidth,
        h: containerRef.current.clientHeight,
      });
    }
  };

  const containerRect = useRef<DOMRect | null>(null);

  const handlePanStart = (index: number) => {
    setActivePoint(index);
    if (containerRef.current) {
      containerRect.current = containerRef.current.getBoundingClientRect();
    }
  };

  const handlePointDrag = (index: number, info: any) => {
    if (!containerSize.w || !containerSize.h || !containerRect.current) return;
    
    // Use raw pointer coordinates for better responsiveness
    const x = ((info.point.x - containerRect.current.left) / containerSize.w) * 100;
    const y = ((info.point.y - containerRect.current.top) / containerSize.h) * 100;

    setPts(prev => {
      const next = [...prev];
      next[index] = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      };
      return next;
    });
  };

  const handleQuadMove = (e: any, info: any) => {
    if (!containerSize.w || !containerSize.h) return;
    
    const dx = (info.delta.x / containerSize.w) * 100;
    const dy = (info.delta.y / containerSize.h) * 100;

    setPts(prev => {
      // Check if any point would go out of bounds
      const canMove = prev.every(p => 
        p.x + dx >= 0 && p.x + dx <= 100 && 
        p.y + dy >= 0 && p.y + dy <= 100
      );
      
      if (!canMove) return prev;
      
      return prev.map(p => ({
        x: p.x + dx,
        y: p.y + dy
      }));
    });
  };

  const handlePanEnd = () => {
    // We keep activePoint for keyboard input until they click away? 
    // Actually, let's keep it until they stop dragging for the loupe, 
    // but maybe keep it selected for keyboard. 
    // Let's keep it selected.
  };

  const warpedImage = async () => {
    setIsWarping(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.src = image;
      await new Promise(r => img.onload = r);

      const destW = 1000;
      const destH = 628;
      canvas.width = destW;
      canvas.height = destH;

      const srcPts = pts.map(p => [p.x * img.width / 100, p.y * img.height / 100]);
      const dstPts = [
        [0, 0],
        [destW, 0],
        [destW, destH],
        [0, destH]
      ];

      // Use my internal perspective transform math
      const invTransform = getInverseTransform(srcPts, dstPts);

      const imageData = ctx.createImageData(destW, destH);
      const data = imageData.data;
      
      // Create a temporary canvas to get source pixel data
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (!srcCtx) return;
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, img.width, img.height).data;

      for (let y = 0; y < destH; y++) {
        for (let x = 0; x < destW; x++) {
          const srcCoord = invTransform.transform(x, y);
          const sx = srcCoord[0];
          const sy = srcCoord[1];

          if (sx >= 0 && sx < img.width - 1 && sy >= 0 && sy < img.height - 1) {
            // Bilinear interpolation
            const x0 = Math.floor(sx);
            const x1 = x0 + 1;
            const y0 = Math.floor(sy);
            const y1 = y0 + 1;

            const dx = sx - x0;
            const dy = sy - y0;

            const idx00 = (y0 * img.width + x0) * 4;
            const idx01 = (y0 * img.width + x1) * 4;
            const idx10 = (y1 * img.width + x0) * 4;
            const idx11 = (y1 * img.width + x1) * 4;

            const outIdx = (y * destW + x) * 4;

            for (let i = 0; i < 4; i++) {
              const c00 = srcData[idx00 + i];
              const c01 = srcData[idx01 + i];
              const c10 = srcData[idx10 + i];
              const c11 = srcData[idx11 + i];

              const c0 = c00 * (1 - dx) + c01 * dx;
              const c1 = c10 * (1 - dx) + c11 * dx;
              data[outIdx + i] = Math.round(c0 * (1 - dy) + c1 * dy);
            }
          } else {
            const outIdx = (y * destW + x) * 4;
            data[outIdx + 3] = 0;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      onComplete(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error(e);
    } finally {
      setIsWarping(false);
    }
  };

  // Convert pts to absolute container coordinates for markers
  const markers = useMemo(() => {
    return pts.map(p => ({
      x: p.x * containerSize.w / 100,
      y: p.y * containerSize.h / 100,
    }));
  }, [pts, containerSize]);

  // Path for the polygon overlay
  const polyPath = useMemo(() => {
    if (markers.length < 4) return "";
    return `M ${markers[0].x} ${markers[0].y} L ${markers[1].x} ${markers[1].y} L ${markers[2].x} ${markers[2].y} L ${markers[3].x} ${markers[3].y} Z`;
  }, [markers]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900">
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
        <div 
          ref={containerRef}
          style={{ 
            aspectRatio: imgSize.w ? `${imgSize.w}/${imgSize.h}` : 'auto',
            maxHeight: '100%',
            maxWidth: '100%',
            width: imgSize.w ? 'auto' : '100%',
            height: imgSize.h ? 'auto' : '100%'
          }}
          className="relative bg-slate-800 shadow-2xl select-none"
        >
          {image && (
            <img 
              src={image} 
              className="w-full h-full pointer-events-none select-none" 
              alt="Source"
            />
          )}
          
          {/* SVG Overlay for Lines */}
          <svg className="absolute inset-0 w-full h-full cursor-default select-none pointer-events-none overflow-visible">
            <motion.path 
              d={polyPath} 
              fill={activePoint === null ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.2)"} 
              stroke="#3b82f6" 
              strokeWidth="2" 
              strokeDasharray="4 4"
              className="pointer-events-auto cursor-move"
              onPan={handleQuadMove}
              onTap={() => setActivePoint(null)}
            />
          </svg>
   
          {/* Draggable Markers */}
          {markers.map((m, i) => (
            <motion.div
              key={i}
              onPanStart={() => handlePanStart(i)}
              onPan={(e, info) => handlePointDrag(i, info)}
              onPanEnd={handlePanEnd}
              onTap={() => setActivePoint(i)}
              style={{ 
                left: m.x, 
                top: m.y,
                transform: 'translate(-50%, -50%)'
              }}
              className={cn(
                "absolute w-8 h-8 rounded-full shadow-2xl z-50 cursor-move flex items-center justify-center transition-all group",
                activePoint === i ? "bg-blue-600 scale-110 ring-4 ring-blue-200" : "bg-white border-2 border-blue-600 hover:scale-110"
              )}
            >
              <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                activePoint === i ? "bg-white" : "bg-blue-600"
              )} />

              {/* Magnifier / Loupe */}
              <AnimatePresence>
                {activePoint === i && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0, y: -20, x: -50 }}
                    animate={{ scale: 1, opacity: 1, y: -80, x: -50 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute left-1/2 bottom-full mb-4 w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-900 pointer-events-none z-[100]"
                  >
                    <div 
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${image})`,
                        backgroundPosition: `${pts[i].x}% ${pts[i].y}%`,
                        backgroundSize: `${containerSize.w * 4}px ${containerSize.h * 4}px`, // 4x zoom
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-full h-[1px] bg-red-400/50" />
                      <div className="h-full w-[1px] bg-red-400/50 absolute" />
                      <div className="w-2 h-2 border border-red-500 rounded-full" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
  
          {/* Helpful labels for corners */}
          {markers.map((m, i) => (
            <div 
              key={`label-${i}`}
              className={cn(
                "absolute text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none z-40 whitespace-nowrap transition-colors",
                activePoint === i ? "bg-blue-600 text-white" : "bg-white/80 text-blue-600 border border-blue-100"
              )}
              style={{ 
                left: m.x, 
                top: m.y,
                transform: `translate(${i === 0 || i === 3 ? '-110%' : '10%'}, ${i === 0 || i === 1 ? '-110%' : '10%'})`
              }}
            >
              {i === 0 ? 'Top-Left' : i === 1 ? 'Top-Right' : i === 2 ? 'Bottom-Right' : 'Bottom-Left'}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-3">
        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-blue-600">Pro</span>
        </div>
        <p className="text-[11px] text-blue-700 font-medium leading-tight">
          <span className="font-bold">Tip:</span> Drag the <span className="underline decoration-blue-300">blue area</span> to move the whole card. Select a corner and use <kbd className="bg-white px-1 py-0.5 rounded border border-blue-200">Arrow Keys</kbd> for fine adjustments.
        </p>
      </div>

      <div className="p-4 sm:p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-2 sm:gap-4">
        <div className="flex gap-2 flex-1">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors whitespace-nowrap text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={handleReset}
            className="px-4 py-3 bg-slate-100 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-colors text-sm"
            title="Reset Handles"
          >
            Reset
          </button>
        </div>
        <button 
          onClick={warpedImage}
          disabled={isWarping}
          className="sm:flex-[2] px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 text-sm"
        >
          {isWarping ? 'Warping...' : 'Apply Perspective'}
        </button>
      </div>
    </div>
  );
}
