/**
 * Normalizes a role string to a canonical shorthand key used by the application.
 * Maps backend roles to frontend route/sidebar keys.
 * @param {string} role - The raw role string from the database or UI.
 * @returns {string} - The normalized canonical role key.
 */
export const normalizeRole = (role) => {
    if (!role) return 'staff';
    
    // If role is an object (e.g., Prisma relation), extract its name
    const roleStr = typeof role === 'object' ? (role.name || role.label || '') : String(role);
    
    const r = roleStr.toLowerCase().trim();

    if (r.includes('superadmin') || r.includes('super admin') || r.includes('super_admin')) return 'superadmin';
    // 'admin' = either ZaneZion internal manager OR SaaS tenant admin — both get full access
    if (r === 'admin') return 'admin';
    if (r === 'manager') return 'operations';
    if (r === 'operation') return 'operations';
    if (r.includes('procurement')) return 'procurement';
    if (r.includes('operations')) return 'operations';
    if (r.includes('logistics')) return 'logistics';
    if (r.includes('inventory') || r.includes('stock')) return 'inventory';
    if (r.includes('concierge')) return 'concierge';
    // 'saas_client' kept for backward compat (old accounts before multi-tenant fix)
    if (r.includes('saas_client') || r.includes('saas client')) return 'saas_client';
    if (r === 'customer' || r === 'personal_user' || r.includes('personal')) return 'customer';
    // Business client aliases
    if (r === 'client' || r === 'business_client' || r === 'business client') return 'client';
    if (r.includes('vendor')) return 'vendor';
    if (r.includes('staff')) return 'staff';

    return 'staff';
};

/**
 * For SaaS signups some backends still return role='admin'.
 * Keep same access level, but preserve SaaS identity in UI/routing as 'saas_client'.
 */
export const resolvePortalRole = (user) => {
    const base = normalizeRole(user?.role);
    // Keep explicit admin users as admin.
    // Prior behavior remapped SaaS admins to `saas_client`, which reduced/changed portal visibility.
    return base;
};

/** Roles allowed to create institutional / manual orders (Order Management modal — not marketplace checkout). */
const INSTITUTIONAL_ORDER_CREATOR_ROLES = new Set([
    'superadmin',
    'operations',
    'procurement',
    'logistics',
    'inventory',
    'concierge',
    'admin',
    'saas_client',
    'staff',
]);

export function roleCanCreateInstitutionalOrder(role) {
    const key = normalizeRole(role);
    return INSTITUTIONAL_ORDER_CREATOR_ROLES.has(key);
}

/** Who may change order workflow status (OrderModal / API). Not customers or tenant portal users. */
export function roleCanUpdateOrderStatus(role) {
    const key = normalizeRole(role);
    if (['customer', 'client', 'vendor'].includes(key)) return false;
    return INSTITUTIONAL_ORDER_CREATOR_ROLES.has(key);
}

/**
 * Vendor rows shown in shared UI (marketplace checkout, order vendor pickers, inventory partner pickers).
 * Super Admin sees every row (pending, active, blacklisted). All other roles only see HQ-approved
 * partners (`status === 'active'`). Blacklisted is never shown outside Super Admin.
 * Rows with no explicit `status` are not shown (pending until Super Admin sets Active).
 */
export function vendorVisibleInSharedLists(vendor, viewerRole) {
    const key = normalizeRole(viewerRole);
    if (key === 'superadmin') return true;
    const st = String(vendor?.status ?? '').trim().toLowerCase();
    if (st === 'blacklisted') return false;
    return st === 'active';
}

export const normalizeMenuPathBase = (path) => {
    if (!path) return '';
    const base = String(path).trim().split('?')[0];
    let out = base.startsWith('/') ? base : `/${base.replace(/^\/+/, '')}`;
    out = out.replace(/\/+$/, '') || '/';
    return out;
};

/** Whether current URL is allowed by a login `menuPermissions[].path` row. */
export const menuPathGrantsAccess = (pathname, search, permPath) => {
    if (!permPath) return false;
    const full = String(permPath).trim();
    if (normalizeMenuPathBase(full) === '/dashboard' && !full.includes('?')) return false;
    if (full.includes('?')) {
        const [base, query] = full.split('?');
        if (normalizeMenuPathBase(pathname) !== normalizeMenuPathBase(base)) return false;
        const want = new URLSearchParams(query);
        const have = new URLSearchParams((search || '').replace(/^\?/, ''));
        for (const [k, v] of want.entries()) {
            if (have.get(k) !== v) return false;
        }
        return true;
    }
    const p = normalizeMenuPathBase(full);
    const cur = normalizeMenuPathBase(pathname);
    if (p === '/dashboard') return false;
    return cur === p || cur.startsWith(`${p}/`);
};
