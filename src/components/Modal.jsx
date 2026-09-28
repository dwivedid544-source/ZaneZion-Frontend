import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-5xl',
  '4xl': 'max-w-6xl',
  '5xl': 'max-w-7xl',
  full: 'max-w-[96vw]'
};

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  subtitle,
  children, 
  size, 
  maxWidth, 
  className = '', 
  bodyClassName = '',
  headerClassName = ''
}) => {
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

  const resolvedMaxWidth = maxWidth || (size ? sizeClasses[size] : null) || 'max-w-lg';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`relative w-full ${resolvedMaxWidth} bg-card border border-border rounded-2xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden my-auto ${className}`}
          >
            <div className={`flex items-center justify-between p-4 sm:p-6 border-b border-border/50 bg-white/[0.02] ${headerClassName}`}>
              <div className="min-w-0 pr-4">
                <h3 className="text-lg sm:text-xl font-bold font-heading text-primary truncate">{title}</h3>
                {subtitle && <p className="text-xs text-secondary mt-0.5 truncate">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full text-secondary hover:text-white transition-all group flex-shrink-0 cursor-pointer"
                title="Close"
              >
                <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>
            <div className={`p-4 sm:p-6 md:p-8 max-h-[82vh] overflow-y-auto custom-scrollbar ${bodyClassName}`}>
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
