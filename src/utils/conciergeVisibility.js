/**
 * Utility for Concierge Portal Order Visibility Rules:
 * - Concierge should ONLY see Concierge Requests/Orders by default.
 * - Hide all Marketplace orders by default.
 * - Marketplace orders are visible to Concierge ONLY for clients with an upgraded account in database.
 * - Use the client's actual account/upgrade status from the database and do not hardcode the filter.
 */

/**
 * Determines whether a Client account is an Upgraded Account.
 * Evaluates real database fields on the Client record (plan, clientType, tier, isUpgraded, etc.).
 * @param {Object} client - The client object from database or clients state.
 * @returns {boolean}
 */
export function isClientUpgraded(client) {
  if (!client) return false;

  // 1. Explicit boolean upgrade flags in database
  if (client.isUpgraded === true || client.is_upgraded === true || client.upgraded === true || client.isVip === true || client.concierge_member === true) {
    return true;
  }

  // 2. Explicit plan in database that is NOT Free or Standard
  const planStr = String(
    client.plan || client.membership || client.subscription_plan || client.tier || ''
  ).toLowerCase().trim();

  if (planStr && !['free', 'standard', 'standard (free)', 'none', 'null', 'undefined', ''].includes(planStr)) {
    return true;
  }

  return false;
}

/**
 * Resolves the client object for a given order, checking embedded client data or matching from clients list.
 */
export function getOrderClient(order, clients = []) {
  if (!order) return null;
  if (order.client && typeof order.client === 'object') {
    return order.client;
  }
  if (!Array.isArray(clients) || clients.length === 0) {
    return null;
  }
  const oClientId = String(order.clientId || order.client_id || order.company_id || '').replace(/\D/g, '');
  if (!oClientId) return null;

  return clients.find(c => {
    const cId = String(c.id || '').replace(/\D/g, '');
    return cId && cId === oClientId;
  }) || null;
}

/**
 * Determines whether an order is a Concierge Request / Order.
 * Concierge requests include Chauffeur, Events, Bespoke Requests, and orders with concierge categories.
 */
export function isConciergeOrder(order) {
  if (!order) return false;

  const typeStr = String(order.orderType || order.order_type || order.type || '').toUpperCase();
  const kindStr = String(order.orderKind || order.order_kind || order.kind || '').toLowerCase();
  const statusStr = String(order.status || '').toLowerCase();

  let metadata = {};
  if (typeof order.metadata === 'string') {
    try { metadata = JSON.parse(order.metadata || '{}'); } catch (e) {}
  } else if (order.metadata && typeof order.metadata === 'object') {
    metadata = order.metadata;
  }

  // 1. Explicit orderType checks
  if (
    typeStr.includes('CONCIERGE') ||
    typeStr.includes('CHAUFFEUR') ||
    typeStr.includes('EVENTS') ||
    typeStr.includes('BESPOKE') ||
    typeStr.includes('VIP')
  ) {
    return true;
  }

  // 2. Explicit orderKind or custom request category
  if (
    kindStr.includes('custom') ||
    kindStr.includes('bespoke') ||
    kindStr.includes('concierge') ||
    kindStr.includes('chauffeur') ||
    order.isConcierge ||
    order.isCustomRequest ||
    metadata.custom_request_category ||
    metadata.isConcierge ||
    String(metadata.serviceType || '').toLowerCase().includes('concierge') ||
    String(metadata.serviceType || '').toLowerCase().includes('chauffeur')
  ) {
    return true;
  }

  // 3. Status is concierge
  if (statusStr === 'concierge') {
    return true;
  }

  // 4. Custom items or item names matching concierge/chauffeur/bespoke/vip
  const items = order.items || order.customItems || metadata.customItems || [];
  if (Array.isArray(items) && items.length > 0) {
    const hasConciergeItem = items.some(item => {
      const name = String(item?.name || item?.title || item?.item || '').toLowerCase();
      return (
        name.includes('concierge') ||
        name.includes('chauffeur') ||
        name.includes('bespoke') ||
        name.includes('vip') ||
        name.includes('passenger') ||
        name.includes('luxury')
      );
    });
    if (hasConciergeItem) return true;
  }

  return false;
}

/**
 * Filter rule for Concierge Portal order visibility:
 * - Concierge Requests/Orders: ALWAYS visible to Concierge.
 * - Marketplace Orders: Visible to Concierge ONLY if client has an Upgraded Account in DB.
 * @param {Object} order - The order item.
 * @param {Array} clients - Optional array of client records for lookup.
 * @returns {boolean}
 */
export function isOrderVisibleToConcierge(order, clients = []) {
  if (!order) return false;

  // 1. Concierge requests/orders are always visible
  if (isConciergeOrder(order)) {
    return true;
  }

  // 2. Marketplace orders are hidden by default, visible ONLY for clients with upgraded accounts in DB
  const clientObj = getOrderClient(order, clients);
  return isClientUpgraded(clientObj);
}

/**
 * Filters an array of orders for Concierge view.
 */
export function filterOrdersForConciergeView(orders = [], clients = []) {
  if (!Array.isArray(orders)) return [];
  return orders.filter(order => isOrderVisibleToConcierge(order, clients));
}
