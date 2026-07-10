import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

/* ────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────── */
const pad2 = (n) => String(n).padStart(2, '0');

/** yyyy-mm-dd  →  { dd, mm, yyyy } strings */
const isoToParts = (iso) => {
    if (!iso) return { dd: '', mm: '', yyyy: '' };
    const [y, m, d] = iso.split('-');
    return { dd: d || '', mm: m || '', yyyy: y || '' };
};

/** { dd, mm, yyyy }  →  yyyy-mm-dd  (returns '' if incomplete) */
const partsToIso = (dd, mm, yyyy) => {
    if (dd.length === 2 && mm.length === 2 && yyyy.length === 4) {
        return `${yyyy}-${mm}-${dd}`;
    }
    return null;
};

const parseLocalDate = (iso) => {
    if (!iso) return new Date();
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const formatLocalDate = (date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

/* ────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────── */
const CustomDatePicker = ({
    selectedDate,
    onChange,
    label,
    placeholder = 'DD / MM / YYYY',
    disabled = false,
}) => {
    /* ── Calendar open state ── */
    const [isOpen, setIsOpen]         = useState(false);
    const [currentMonth, setCurrentMonth] = useState(parseLocalDate(selectedDate));

    /* ── Text-input segment state ── */
    const initial = isoToParts(selectedDate);
    const [dd,   setDd]   = useState(initial.dd);
    const [mm,   setMm]   = useState(initial.mm);
    const [yyyy, setYyyy] = useState(initial.yyyy);

    const ddRef   = useRef(null);
    const mmRef   = useRef(null);
    const yyyyRef = useRef(null);
    const containerRef = useRef(null);

    /* Sync text segments when selectedDate changes externally */
    useEffect(() => {
        const parts = isoToParts(selectedDate);
        setDd(parts.dd);
        setMm(parts.mm);
        setYyyy(parts.yyyy);
        if (selectedDate) setCurrentMonth(parseLocalDate(selectedDate));
    }, [selectedDate]);

    /* When all three segments are filled, fire onChange */
    const tryEmit = (newDd, newMm, newYyyy) => {
        const iso = partsToIso(newDd, newMm, newYyyy);
        if (iso) {
            const d = parseLocalDate(iso);
            if (!isNaN(d)) {
                onChange(iso);
                setCurrentMonth(d);
            }
        }
    };

    /* ── Segment handlers ── */
    const handleDd = (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 2);
        setDd(v);
        if (v.length === 2) { mmRef.current?.focus(); mmRef.current?.select(); }
        tryEmit(v, mm, yyyy);
    };

    const handleMm = (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 2);
        setMm(v);
        if (v.length === 2) { yyyyRef.current?.focus(); yyyyRef.current?.select(); }
        tryEmit(dd, v, yyyy);
    };

    const handleYyyy = (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
        setYyyy(v);
        tryEmit(dd, mm, v);
    };

    /* Backspace on mm → jump back to dd */
    const handleMmKey = (e) => {
        if (e.key === 'Backspace' && mm === '') {
            ddRef.current?.focus();
            ddRef.current?.select();
        }
    };

    /* Backspace on yyyy → jump back to mm */
    const handleYyyyKey = (e) => {
        if (e.key === 'Backspace' && yyyy === '') {
            mmRef.current?.focus();
            mmRef.current?.select();
        }
    };

    /* ── Calendar navigation ── */
    const handlePrevMonth = (e) => {
        e.stopPropagation();
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };
    const handleNextMonth = (e) => {
        e.stopPropagation();
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };
    const handleDateSelect = (day) => {
        const iso = formatLocalDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
        onChange(iso);
        setIsOpen(false);
    };

    /* ── Calendar helpers ── */
    const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const firstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

    const isToday = (day) => {
        const t = new Date();
        return t.getDate() === day && t.getMonth() === currentMonth.getMonth() && t.getFullYear() === currentMonth.getFullYear();
    };
    const isSelected = (day) => {
        if (!selectedDate) return false;
        const s = parseLocalDate(selectedDate);
        return s.getDate() === day && s.getMonth() === currentMonth.getMonth() && s.getFullYear() === currentMonth.getFullYear();
    };

    const calendarDays = [];
    const totalDays = daysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    const firstDay  = firstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= totalDays; i++) calendarDays.push(i);

    /* ── Portal positioning ── */
    const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'bottom' });

    const updateCoords = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const calH = 340;
        const placement = spaceBelow < calH && spaceAbove > spaceBelow ? 'top' : 'bottom';
        setCoords({
            top: placement === 'bottom' ? rect.bottom + window.scrollY + 5 : rect.top + window.scrollY - calH - 5,
            left: rect.left + window.scrollX,
            placement,
        });
    };

    useEffect(() => { if (disabled) setIsOpen(false); }, [disabled]);

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
                const portal = document.getElementById('datepicker-portal');
                if (portal && portal.contains(event.target)) return;
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* ── Calendar dropdown (portalled) ── */
    const CalendarDropdown = (
        <AnimatePresence>
            {isOpen && (
                <div
                    id="datepicker-portal"
                    style={{
                        position: 'fixed',
                        top: window.innerWidth < 768 ? '50%' : coords.top - window.scrollY,
                        left: window.innerWidth < 768 ? '50%' : coords.left,
                        transform: window.innerWidth < 768 ? 'translate(-50%,-50%)' : 'none',
                        zIndex: 99999,
                        width: window.innerWidth < 768 ? '90%' : 'auto',
                        maxWidth: '260px',
                    }}
                >
                    <div
                        className="glass-card p-3 border-accent/30 shadow-[0_15px_40px_rgba(0,0,0,0.4)] backdrop-blur-3xl bg-sidebar/95 overflow-hidden w-[260px]"
                        style={{ animation: 'fadeIn 0.15s ease' }}
                    >
                        {/* Luxury Gradient Overlay */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />

                        {/* Month/Year navigation */}
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white/10 rounded-full text-secondary hover:text-white transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <div className="text-center">
                                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{MONTHS[currentMonth.getMonth()]}</h4>
                                <p className="text-[9px] font-bold text-accent mt-0.5">{currentMonth.getFullYear()}</p>
                            </div>
                            <button onClick={handleNextMonth} className="p-1.5 hover:bg-white/10 rounded-full text-secondary hover:text-white transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        {/* Week days */}
                        <div className="grid grid-cols-7 gap-1 mb-2 relative z-10">
                            {WEEKDAYS.map(d => (
                                <div key={d} className="text-center">
                                    <span className="text-[9px] font-black text-muted/60 uppercase tracking-widest">{d}</span>
                                </div>
                            ))}
                        </div>

                        {/* Day cells */}
                        <div className="grid grid-cols-7 gap-0.5 relative z-10">
                            {calendarDays.map((day, idx) => (
                                <div key={idx} className="aspect-square flex items-center justify-center">
                                    {day ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDateSelect(day); }}
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
                                        <div className="w-full h-full" />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-center relative z-10">
                            <button
                                onClick={(e) => { e.stopPropagation(); onChange(formatLocalDate(new Date())); setIsOpen(false); }}
                                className="text-[9px] font-black text-accent uppercase tracking-widest hover:text-white transition-all px-2 py-1 rounded-md hover:bg-accent/10"
                            >
                                Today
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-secondary hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 block">{label}</label>}

            {/* Trigger row */}
            <div className={`flex items-center gap-2 w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 transition-all group ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-accent'} ${isOpen ? 'ring-2 ring-accent/20 border-accent shadow-[0_0_30px_rgba(200,169,106,0.15)] bg-white/[0.05]' : ''}`}>
                {/* Calendar icon — opens the picker */}
                <CalendarIcon
                    size={14}
                    className={`shrink-0 transition-colors cursor-pointer ${isOpen ? 'text-accent' : 'text-secondary group-hover:text-accent'}`}
                    onClick={() => { if (!disabled) setIsOpen(prev => !prev); }}
                />

                {/* Inline dd / mm / yyyy inputs */}
                <div className="flex items-center gap-0.5 flex-1">
                    <input
                        ref={ddRef}
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        placeholder="DD"
                        disabled={disabled}
                        value={dd}
                        onChange={handleDd}
                        onFocus={e => e.target.select()}
                        className="w-7 bg-transparent text-center text-sm font-bold text-white placeholder-muted outline-none border-none p-0 leading-none"
                    />
                    <span className="text-muted text-sm font-bold select-none">/</span>
                    <input
                        ref={mmRef}
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        placeholder="MM"
                        disabled={disabled}
                        value={mm}
                        onChange={handleMm}
                        onKeyDown={handleMmKey}
                        onFocus={e => e.target.select()}
                        className="w-7 bg-transparent text-center text-sm font-bold text-white placeholder-muted outline-none border-none p-0 leading-none"
                    />
                    <span className="text-muted text-sm font-bold select-none">/</span>
                    <input
                        ref={yyyyRef}
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="YYYY"
                        disabled={disabled}
                        value={yyyy}
                        onChange={handleYyyy}
                        onKeyDown={handleYyyyKey}
                        onFocus={e => e.target.select()}
                        className="w-12 bg-transparent text-center text-sm font-bold text-white placeholder-muted outline-none border-none p-0 leading-none"
                    />
                </div>

                {/* Clear button */}
                {selectedDate && !disabled && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChange(''); setDd(''); setMm(''); setYyyy(''); }}
                        className="p-0.5 hover:bg-white/10 rounded text-muted hover:text-white transition-colors shrink-0"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {createPortal(CalendarDropdown, document.body)}
        </div>
    );
};

export default CustomDatePicker;
