/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, FileText, Image as ImageIcon, CreditCard, Github, Cpu, Scissors, UserCircle, Menu, X, Maximize2 } from 'lucide-react';
import PassportModule from './components/PassportModule';
import NIDModule from './components/NIDModule';
import ImagePreviewer from './components/ImagePreviewer';
import { cn } from './lib/utils';

type Module = 'passport' | 'nid' | 'previewer';

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('passport');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-[60] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-black">Snap<span className="text-blue-600">Fix</span></span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 z-50 flex flex-col shadow-sm transition-transform duration-300 lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-100 hidden lg:flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-black">Snap<span className="text-blue-600">Fix</span></span>
        </div>

        <div className="lg:hidden h-16 border-b border-slate-100" /> {/* Spacer for mobile header */}

        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 px-2">Modules</div>
            <NavBtn 
              active={activeModule === 'passport'} 
              onClick={() => {
                setActiveModule('passport');
                setIsMobileMenuOpen(false);
              }}
              icon={<ImageIcon className="w-5 h-5" />}
              label="Passport Maker"
            />
            <NavBtn 
              active={activeModule === 'nid'} 
              onClick={() => {
                setActiveModule('nid');
                setIsMobileMenuOpen(false);
              }}
              icon={<CreditCard className="w-5 h-5" />}
              label="NID Formatter"
            />
            <NavBtn 
              active={activeModule === 'previewer'} 
              onClick={() => {
                setActiveModule('previewer');
                setIsMobileMenuOpen(false);
              }}
              icon={<Maximize2 className="w-5 h-5" />}
              label="Image Previewer"
            />
          </div>

          <div className="pt-4">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 px-2">System Status</div>
            <div className="px-2 py-2 space-y-3">
              <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
                <span>GPU Acceleration</span>
                <span className="text-emerald-500 font-bold uppercase">Active</span>
              </div>
              <div className="flex justify-between items-center text-[11px] font-medium text-slate-500">
                <span>Gemini API</span>
                <span className="text-emerald-500 font-bold uppercase">Stable</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="p-4">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Cpu className="w-12 h-12 rotate-12" />
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Current Plan</div>
            <div className="font-bold text-sm">Senior Dev - Unlimited</div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile side menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen lg:ml-64">
        <div className="h-16 lg:hidden" /> {/* Header spacer */}
        <div className="flex-1 p-4 lg:p-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="min-h-full"
            >
              {activeModule === 'passport' ? <PassportModule /> : activeModule === 'nid' ? <NIDModule /> : <ImagePreviewer />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="max-w-5xl mx-auto px-6 py-12 md:px-12 border-t border-slate-100">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-slate-400 text-sm">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span>&copy; 2026 SnapFix. Developed by <a href="https://www.facebook.com/share/1HshAsioLj/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">SuperfixBD</a>.</span>
            </div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-brand-600">Privacy Policy</a>
              <a href="#" className="hover:text-brand-600">Usage Limits</a>
              <a href="#" className="hover:text-brand-600">Support</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

interface NavBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function NavBtn({ active, onClick, icon, label }: NavBtnProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
        active 
          ? "bg-blue-50 text-blue-700 shadow-sm" 
          : "text-slate-600 hover:bg-slate-50"
      )}
    >
      <div className={cn(
        "transition-transform",
        active ? "text-blue-600" : "text-slate-400"
      )}>
        {icon}
      </div>
      <span className="text-sm">{label}</span>
    </button>
  );
}

