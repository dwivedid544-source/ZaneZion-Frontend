/** Standard catalogue taxonomy — filter marketplace / reporting */
export const MARKETPLACE_CATEGORIES = [
  'Grocery',
  'Food',
  'Beverage',
  'Automotive',
  'Maritime',
  'Pharmaceutical',
  'Building Supplies',
  'Electronics',
  'Home',
  'General',
  'Stationary',
];

/** Map retired inventory UI labels onto marketplace taxonomy */
const LEGACY_INVENTORY_CATEGORY = {
  'Marine Supply': 'Maritime',
  Provisions: 'Grocery',
  Housekeeping: 'Home',
};

/** Coerce stored / PR category toward marketplace list; unknown strings preserved */
export function normalizeToMarketplaceCategory(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return 'General';
  if (MARKETPLACE_CATEGORIES.includes(s)) return s;
  return LEGACY_INVENTORY_CATEGORY[s] || s;
}

/** Select options: marketplace list plus current value when it is not in the list */
export function marketplaceCategorySelectOptions(currentCategory) {
  const c = String(normalizeToMarketplaceCategory(currentCategory) ?? '').trim();
  if (c && !MARKETPLACE_CATEGORIES.includes(c)) {
    return [...MARKETPLACE_CATEGORIES, c];
  }
  return [...MARKETPLACE_CATEGORIES];
}

/** Exact label from MARKETPLACE_CATEGORIES (case-insensitive) so API/UI filters stay aligned */
export function canonicalMarketplaceCategory(raw) {
  const mapped = normalizeToMarketplaceCategory(raw);
  const lower = String(mapped).toLowerCase();
  const hit = MARKETPLACE_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return hit || mapped;
}

/** Personal portal membership: platform fee only; fulfilment for each service line is quoted & billed separately */
export const PERSONAL_MEMBERSHIP_FEE_USD = 9.99;

/**
 * Concierge-style services members can access after subscribing (coordination / portal access;
 * actual job costs are separate). Used on Personal Membership + Plans lifestyle card.
 */
export const PERSONAL_MEMBERSHIP_CONCIERGE_SERVICES = [
  {
    key: 'events',
    title: 'Event Services',
    tagline: 'Events-related help through your concierge.',
    items: ['Events related help'],
  },
  {
    key: 'guest',
    title: 'Guest Requests',
    tagline: 'Errands, sourcing, shopping, documents & bespoke asks.',
    items: [
      'Errand services (small day-to-day tasks)',
      'Product sourcing',
      'Personal shopping',
      'Package pickup & delivery',
      'Document pickup & delivery',
      'Custom requests',
    ],
  },
  {
    key: 'other',
    title: 'Other Services',
    tagline: 'Luxury inventory, storage, and mobility.',
    items: ['Luxury items', 'Storage hub', 'Chauffeur services'],
  },
];
