import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/50 bg-white/[0.02]">
              <h3 className="text-lg sm:text-xl font-bold font-heading text-primary truncate pr-4">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full text-secondary hover:text-white transition-all group flex-shrink-0"
              >
                <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>
            <div className="p-4 sm:p-6 md:p-8 max-h-[80dvh] overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>

      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
