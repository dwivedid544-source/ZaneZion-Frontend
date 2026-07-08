/** Backend orders.status ENUM + aliases handled by orderController.normalizeOrderStatus */

export function normalizeOrderStatusForApi(input) {
    if (input === undefined || input === null || String(input).trim() === '') return null;
    const raw = String(input).trim().toLowerCase().replace(/\s+/g, '_');
    const aliases = {
        submitted: 'created',
        pending_review: 'admin_review',
        in_operations: 'operation',
        operations: 'operation',
        logistics_dispatch: 'logistics',
        out_for_delivery: 'logistics',
        pending: 'admin_review',
        processing: 'operation',
        in_progress: 'operation',
        approved: 'operation',
        shipped: 'logistics',
        in_transit: 'logistics',
        dispatch: 'logistics',
        delivered: 'completed',
        fulfilled: 'completed',
        done: 'completed',
        canceled: 'cancelled',
        cancelled: 'cancelled'
    };
    const resolved = aliases[raw] || raw;
    const valid = ['created', 'admin_review', 'concierge', 'operation', 'procurement', 'inventory', 'logistics', 'completed', 'cancelled'];
    return valid.includes(resolved) ? resolved : null;
}

export function coerceOrderStatusToApi(input, fallback = 'admin_review') {
    return normalizeOrderStatusForApi(input) || fallback;
}

/** Calendar YYYY-MM-DD in the user's local timezone (not UTC). */
function toLocalYMD(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Today's date as YYYY-MM-DD in local time — avoids UTC day-shift from `toISOString()`. */
export function localDateISO(date = new Date()) {
    return toLocalYMD(date);
}

/** Show stored YYYY-MM-DD as D-M-YYYY (e.g. 4-5-2026 for 4 May 2026). */
export function formatDateDisplayDMY(isoOrAny) {
    const ymd = isoDateSlice(isoOrAny);
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        const t = String(isoOrAny ?? '').trim();
        return t || '—';
    }
    const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
    return `${d}-${m}-${y}`;
}

export function isoDateSlice(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
        return toLocalYMD(v);
    }
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s.slice(0, 10))) return s.slice(0, 10);
    if (s.includes('T')) {
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) return toLocalYMD(d);
        return s.split('T')[0];
    }
    try {
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) return toLocalYMD(d);
    } catch { /* ignore */ }
    return '';
}

export function displayOrderStatus(dbStatus) {
    const key = String(dbStatus || '').toLowerCase();
    const map = {
        created: 'Submitted',
        admin_review: 'Pending Review',
        concierge: 'Concierge',
        operation: 'In Operations',
        procurement: 'Procurement',
        inventory: 'Inventory',
        logistics: 'Logistics / Dispatch',
        completed: 'Completed',
        cancelled: 'Cancelled'
    };
    return map[key] || (dbStatus ? String(dbStatus).replace(/_/g, ' ') : 'Unknown');
}

export const ORDER_STATUS_OPTIONS = [
    { value: 'created', label: 'Created / Draft' },
    { value: 'admin_review', label: 'Admin review' },
    { value: 'concierge', label: 'Concierge' },
    { value: 'operation', label: 'Operations' },
    { value: 'procurement', label: 'Procurement' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'logistics', label: 'Logistics / Dispatch' },
    { value: 'completed', label: 'Completed / Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
];
