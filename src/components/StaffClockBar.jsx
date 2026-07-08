import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useData } from '../context/GlobalDataContext';

const CLOCK_ROLES = new Set([
    'staff',
    'field_staff',
    'operations',
    'procurement',
    'logistics',
    'inventory',
    'warehouse'
]);

/** Compact attendance strip for dashboard topbars (API + local fallback lives in GlobalDataContext). */
const StaffClockBar = ({ role }) => {
    const { currentUser, clockIn, clockOut, addLog } = useData();
    const r = String(role || currentUser?.role || '').toLowerCase().replace(/\s+/g, '');
    if (!CLOCK_ROLES.has(r)) return null;

    const storageKey = () => `zz_clock_${currentUser?.id ?? currentUser?.email ?? 'guest'}`;

    const [onDuty, setOnDuty] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey());
            if (raw) {
                const o = JSON.parse(raw);
                setOnDuty(!!o?.in);
            } else {
                setOnDuty(false);
            }
        } catch {
            setOnDuty(false);
        }
    }, [currentUser?.id, currentUser?.email]);

    const handleIn = async () => {
        const ref = await clockIn(currentUser?.location || 'HQ');
        if (ref) {
            setOnDuty(true);
            addLog?.({ action: 'Clock In', detail: `${currentUser?.name || 'User'} (top bar)`, type: 'system' });
        }
    };

    const handleOut = async () => {
        const res = await clockOut();
        if (res) {
            setOnDuty(false);
            addLog?.({ action: 'Clock Out', detail: `${currentUser?.name || 'User'} (top bar)`, type: 'system' });
        }
    };

    return (
        <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-0.5 shrink-0">
            <span className="px-2 flex items-center gap-1.5 text-muted" title={onDuty ? 'You are checked in' : 'You are checked out'}>
                <Clock size={14} className={onDuty ? 'text-success' : 'text-danger'} />
                <span className={`hidden xl:inline text-[8px] font-black uppercase tracking-widest max-w-[72px] leading-tight ${onDuty ? 'text-success' : 'text-danger'}`}>
                    {onDuty ? 'Checked in' : 'Checked out'}
                </span>
            </span>
            <button
                type="button"
                onClick={handleIn}
                disabled={onDuty}
                title={onDuty ? 'Already checked in' : 'Check in'}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${onDuty
                    ? 'bg-success text-black border-success shadow-[0_0_14px_rgba(34,197,94,0.45)] cursor-not-allowed'
                    : 'bg-transparent text-secondary border-white/15 hover:bg-success/15 hover:border-success/40 hover:text-success'}`}
            >
                Check in
            </button>
            <button
                type="button"
                onClick={handleOut}
                disabled={!onDuty}
                title={!onDuty ? 'Already checked out' : 'Check out'}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${!onDuty
                    ? 'bg-danger text-white border-danger shadow-[0_0_14px_rgba(239,68,68,0.45)] cursor-not-allowed'
                    : 'bg-transparent text-secondary border-white/15 hover:bg-danger/15 hover:border-danger/40 hover:text-danger'}`}
            >
                Check out
            </button>
        </div>
    );
};

export default StaffClockBar;
