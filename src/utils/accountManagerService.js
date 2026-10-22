import { notifyStateChanged } from './stateSyncHelper';

export const DEFAULT_ACCOUNT_MANAGERS = [
  { id: 'am-1', name: 'Sophia Vance', role: 'Senior Account Manager', email: 'sophia.vance@zanezion.com' },
  { id: 'am-2', name: 'Marcus Sterling', role: 'VIP Corporate Relationship Lead', email: 'marcus.sterling@zanezion.com' },
  { id: 'am-3', name: 'Elena Rostova', role: 'Executive Concierge Lead', email: 'elena.rostova@zanezion.com' },
  { id: 'am-4', name: 'David Miller', role: 'Corporate Operations Director', email: 'david.miller@zanezion.com' },
];

/** Retrieve all local account manager overrides. */
export function getClientAccountManagerMap() {
  try {
    return JSON.parse(localStorage.getItem('client_account_managers_v1') || '{}');
  } catch (_) {
    return {};
  }
}

/** Assign an Account Manager to a client and optionally activate their status. */
export function setClientAccountManager(clientIdentifier, managerName, status = 'active') {
  try {
    const map = getClientAccountManagerMap();
    const key = String(clientIdentifier || '').trim().toLowerCase();
    if (!key) return;

    map[key] = {
      accountManager: managerName,
      status: status,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('client_account_managers_v1', JSON.stringify(map));

    // Also update matching record in pending_business_signups if present
    try {
      const pending = JSON.parse(localStorage.getItem('pending_business_signups') || '[]');
      let matched = false;
      const updatedPending = pending.map(item => {
        const itemKeys = [
          String(item.id || ''),
          String(item.email || ''),
          String(item.name || ''),
          String(item.companyName || '')
        ].map(k => k.trim().toLowerCase());

        if (itemKeys.includes(key)) {
          matched = true;
          return {
            ...item,
            accountManager: managerName,
            status: status,
            approvedAt: new Date().toISOString()
          };
        }
        return item;
      });

      if (matched) {
        localStorage.setItem('pending_business_signups', JSON.stringify(updatedPending));
      }
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('app:state-changed'));
  } catch (e) {
    console.error('Error setting account manager:', e);
  }
}

/** Get the assigned Account Manager for a client record or email/name. */
export function getAssignedAccountManager(client, fallback = 'Unassigned (Pending Approval)') {
  if (!client) return fallback;
  if (
    client.accountManager &&
    client.accountManager !== 'Unassigned (Awaiting Admin Assignment)' &&
    client.accountManager !== 'Unassigned (Pending Approval)'
  ) {
    return client.accountManager;
  }

  const map = getClientAccountManagerMap();
  const keys = [
    client.id,
    client.email,
    client.companyName,
    client.name,
    client.business_name
  ].filter(Boolean).map(k => String(k).trim().toLowerCase());

  for (const k of keys) {
    if (map[k]?.accountManager) {
      return map[k].accountManager;
    }
  }

  return client.accountManager || fallback;
}

/** Check if a client or order represents a Business Account. */
export function isClientBusinessAccount(clientOrOrder, clientsList = []) {
  if (!clientOrOrder) return false;

  // 1. Direct type flags
  const directType = String(
    clientOrOrder.clientType ||
    clientOrOrder.client_type ||
    clientOrOrder.accountType ||
    clientOrOrder.account_type ||
    clientOrOrder.tagline ||
    ''
  ).toLowerCase().trim();

  if (['business', 'saas', 'saas_client', 'corporate', 'enterprise'].includes(directType)) {
    return true;
  }
  if (['personal', 'customer', 'free', 'individual'].includes(directType)) {
    return false;
  }

  // 2. Check metadata or custom tags
  if (clientOrOrder.metadata) {
    try {
      const meta = typeof clientOrOrder.metadata === 'string' ? JSON.parse(clientOrOrder.metadata) : clientOrOrder.metadata;
      const metaType = String(meta.accountType || meta.clientType || '').toLowerCase();
      if (['business', 'saas'].includes(metaType)) return true;
      if (['personal', 'customer'].includes(metaType)) return false;
    } catch (_) {}
  }

  // 3. Match against clients list & pending business signups
  const clientId = clientOrOrder.clientId || clientOrOrder.client_id || clientOrOrder.company_id || clientOrOrder.id;
  const clientEmail = clientOrOrder.email || clientOrOrder.clientEmail;
  const clientName = clientOrOrder.client || clientOrOrder.clientName || clientOrOrder.customer_name || clientOrOrder.name;

  let pending = [];
  try {
    pending = JSON.parse(localStorage.getItem('pending_business_signups') || '[]');
  } catch (_) {}

  const allClients = [...(clientsList || []), ...pending];

  const matched = allClients.find(c => {
    if (clientId && (String(c.id) === String(clientId) || String(c.id) === `CLT-${clientId}`)) return true;
    if (clientEmail && String(c.email || '').toLowerCase() === String(clientEmail).toLowerCase()) return true;
    if (clientName && (String(c.name || '').toLowerCase() === String(clientName).toLowerCase() || String(c.companyName || '').toLowerCase() === String(clientName).toLowerCase())) return true;
    return false;
  });

  if (matched) {
    const matchedType = String(matched.clientType || matched.client_type || '').toLowerCase();
    return ['business', 'saas', 'corporate'].includes(matchedType);
  }

  return false;
}

/**
 * Determine if an order is held under Account Manager supervision and blocked from Field Staff.
 * Business client orders are held until an Account Manager explicitly releases them.
 * Personal orders are never held and route directly to Field Staff.
 */
export function isOrderHeldFromFieldStaff(order, clientsList = []) {
  const isBusiness = isClientBusinessAccount(order, clientsList);
  if (!isBusiness) {
    return false; // Personal orders route directly to field staff
  }

  const rawSt = String(order.status || '').toLowerCase().trim();
  // If explicitly dispatched/released to logistics/field staff or already completed
  const isReleased = [
    'logistics',
    'dispatched',
    'in_transit',
    'en_route',
    'out_for_delivery',
    'arrived',
    'completed',
    'delivered'
  ].includes(rawSt);

  return !isReleased;
}
