import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { formatDateDisplayDMY } from '../utils/orderWorkflow';

const CustomDatePicker = ({ selectedDate, onChange, label, placeholder = "Select Date", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return new Date();
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    const [currentMonth, setCurrentMonth] = useState(parseLocalDate(selectedDate));
    const containerRef = useRef(null);

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const handlePrevMonth = (e) => {
        e.stopPropagation();
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const handleNextMonth = (e) => {
        e.stopPropagation();
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleDateSelect = (day) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        onChange(formatLocalDate(newDate));
        setIsOpen(false);
    };

    const isToday = (day) => {
        const today = new Date();
        return today.getDate() === day &&
            today.getMonth() === currentMonth.getMonth() &&
            today.getFullYear() === currentMonth.getFullYear();
    };

    const isSelected = (day) => {
        if (!selectedDate) return false;
        const sel = parseLocalDate(selectedDate);
        return sel.getDate() === day &&
            sel.getMonth() === currentMonth.getMonth() &&
            sel.getFullYear() === currentMonth.getFullYear();
    };

    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });

    const updateCoords = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const calendarHeight = 320; // Estimated height

            let placement = 'bottom';
            let topPosition = rect.bottom + window.scrollY;

            if (spaceBelow < calendarHeight && spaceAbove > spaceBelow) {
                placement = 'top';
                topPosition = rect.top + window.scrollY - calendarHeight - 10;
            }

            setCoords({
                top: topPosition,
                left: rect.left + window.scrollX,
                width: rect.width,
                placement
            });
        }
    };

    useEffect(() => {
        if (disabled) setIsOpen(false);
    }, [disabled]);

    useEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('scroll', updateCoords, true);
            window.addEventListener('resize', updateCoords);
        }
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                // Check if the click was inside the portal
                const portalElement = document.getElementById('datepicker-portal');
                if (portalElement && portalElement.contains(event.target)) return;
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const calendarDays = [];
    const totalDays = daysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const firstDay = firstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());

    for (let i = 0; i < firstDay; i++) {
        calendarDays.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
        calendarDays.push(i);
    }

    const CalendarDropdown = (
        <AnimatePresence>
            {isOpen && (
                <div
                    id="datepicker-portal"
                    style={{
                        position: 'fixed',
                        top: window.innerWidth < 768 ? '50%' : (coords.top + (coords.placement === 'bottom' ? 5 : 0)) - window.scrollY,
                        left: window.innerWidth < 768 ? '50%' : coords.left,
                        transform: window.innerWidth < 768 ? 'translate(-50%, -50%)' : 'none',
                        zIndex: 99999,
                        width: window.innerWidth < 768 ? '90%' : 'auto',
                        maxWidth: '260px'
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: window.innerWidth < 768 ? 20 : (coords.placement === 'bottom' ? 10 : -10), scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass-card p-3 border-accent/30 shadow-[0_15px_40px_rgba(0,0,0,0.4)] backdrop-blur-3xl bg-sidebar/95 overflow-hidden w-[260px]"
                    >
                        {/* Luxury Gradient Overlay */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none"></div>

                        {/* Calendar Header */}
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white/10 rounded-full text-secondary hover:text-white transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <div className="text-center">
                                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{months[currentMonth.getMonth()]}</h4>
                                <p className="text-[9px] font-bold text-accent mt-0.5">{currentMonth.getFullYear()}</p>
                            </div>
                            <button onClick={handleNextMonth} className="p-1.5 hover:bg-white/10 rounded-full text-secondary hover:text-white transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* Week Days */}
                        <div className="grid grid-cols-7 gap-1 mb-2 relative z-10">
                            {weekDays.map(day => (
                                <div key={day} className="text-center">
                                    <span className="text-[9px] font-black text-muted/60 uppercase tracking-widest">{day}</span>
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-0.5 relative z-10">
                            {calendarDays.map((day, idx) => (
                                <div key={idx} className="aspect-square flex items-center justify-center">
                                    {day ? (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDateSelect(day);
                                            }}
                                            className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center
                                                ${isSelected(day)
                                                    ? 'bg-accent text-black shadow-[0_4px_12px_rgba(200,169,106,0.3)] scale-105'
                                                    : isToday(day)
                                                        ? 'bg-accent/10 text-accent border border-accent/20'
                                                        : 'text-secondary hover:bg-white/10 hover:text-white hover:scale-110'
                                                }`}
                                        >
                                            {day}
                                        </button>
                                    ) : (
                                        <div className="w-full h-full"></div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer Actions */}
                        <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-center relative z-10">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(formatLocalDate(new Date()));
                                    setIsOpen(false);
                                }}
                                className="text-[9px] font-black text-accent uppercase tracking-widest hover:text-white transition-all px-2 py-1 rounded-md hover:bg-accent/10"
                            >
                                Today
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                }}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-secondary hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 block">{label}</label>}

            <div
                onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
                className={`flex items-center gap-2 w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 transition-all group ${disabled ? 'opacity-60 cursor-not-allowed' : `cursor-pointer hover:border-accent ${isOpen ? 'ring-2 ring-accent/20 border-accent shadow-[0_0_30px_rgba(200,169,106,0.15)] bg-white/[0.05]' : ''}`}`}
            >
                <CalendarIcon size={14} className={`transition-colors ${isOpen ? 'text-accent' : 'text-secondary group-hover:text-accent'}`} />
                <span className={`text-sm font-bold ${selectedDate ? 'text-white' : 'text-muted'}`}>
                    {selectedDate ? formatDateDisplayDMY(selectedDate) : placeholder}
                </span>
            </div>

            {createPortal(CalendarDropdown, document.body)}
        </div>
    );
};

export default CustomDatePicker;
