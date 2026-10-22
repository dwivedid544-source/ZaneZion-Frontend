export const DASHBOARD_STATS = [
  { id: 1, label: "Active Clients", value: "8", change: "+2", type: "increase" },
  { id: 2, label: "Pending Orders", value: "4", change: "-1", type: "decrease" },
  { id: 3, label: "Deliveries Today", value: "5", change: "+3", type: "neutral" },
  { id: 4, label: "Active Events", value: "3", change: "+1", type: "increase" },
  { id: 5, label: "Total Revenue", value: "$62K", change: "+22%", type: "increase" },
];

export const RECENT_ORDERS = [
  { id: "ORD-001", client: "Goldwynn Residences", product: "Premium Champagne & Spirits", status: "Delivered", deliveryTime: "09:15 AM" },
  { id: "ORD-002", client: "SY Azure (Private Yacht)", product: "Fresh Seafood & Provisions", status: "On Way", deliveryTime: "11:30 AM" },
  { id: "ORD-003", client: "Lyford Cay Estate", product: "Egyptian Cotton Linens", status: "Preparing", deliveryTime: "02:00 PM" },
];

export const EVENTS = [
  { id: 1, name: "Private Island Beach Wedding", client: "The Pemberton Family", location: "Blue Lagoon Island", date: "2025-04-12", progress: { planning: 100, setup: 75, logistics: 60, completed: 0 } },
  { id: 2, name: "VIP Yacht Charter Gala", client: "Goldwynn Residences", location: "Nassau Harbour", date: "2025-04-18", progress: { planning: 100, setup: 40, logistics: 30, completed: 0 } },
];

export const INVENTORY_ALERTS = [
  { id: 1, item: "Dom Perignon Champagne", alert: "Low Stock", count: "6 bottles left", type: "warning" },
  { id: 2, item: "Marine Grade Fuel", alert: "Critical", count: "~800L remaining", type: "warning" },
  { id: 3, item: "Fresh Atlantic Lobster", alert: "New Arrival", count: "15kg arrived", type: "info" },
];

export const CLIENTS = [
  { id: 1, name: "Goldwynn Residences", location: "Cable Beach, Nassau", orders: 18, inventory: "Stable", status: "Active", client_type: "Business", clientType: "Business" },
  { id: 2, name: "SY Azure", location: "Nassau Harbour", orders: 24, inventory: "Stable", status: "Active", client_type: "Business", clientType: "Business" },
  { id: 3, name: "Lyford Cay Estate", location: "Lyford Cay, Nassau", orders: 11, inventory: "Warning", status: "Active", client_type: "Business", clientType: "Business" },
  { id: 4, name: "Kamalame Cay Resort", location: "Andros, Bahamas", orders: 7, inventory: "Stable", status: "Active", client_type: "Business", clientType: "Business" },
  { id: 5, name: "Blue Lagoon Island", location: "Salt Cay, Nassau", orders: 9, inventory: "Low", status: "Warning", client_type: "Business", clientType: "Business" },
];

export const VENDOR_PERFORMANCE = [
  { id: 1, name: 'Caribbean Fine Provisions', rating: 97, delivery: 94 },
  { id: 2, name: 'Nassau Wine & Spirits', rating: 95, delivery: 91 },
  { id: 3, name: 'Bahamas Marine Tech', rating: 89, delivery: 96 },
  { id: 4, name: 'Island Linen & Hospitality', rating: 93, delivery: 90 },
  { id: 5, name: 'Tropical Blooms & Floral', rating: 88, delivery: 85 },
];

export const LOGISTICS_DATA = [
  { id: 1, driver: "Jaheem Brown", vehicle: "Van-01 (Road)", route: "Nassau Hub → Goldwynn", eta: "12 mins", status: "On Way", type: "Truck" },
  { id: 2, driver: "Devon Williams", vehicle: "Vessel-02 (Sea)", route: "Potters Cay → Blue Lagoon", eta: "35 mins", status: "En Route", type: "Vessel" },
  { id: 3, driver: "Andre Rolle", vehicle: "Boat-03 (Sea)", route: "Nassau → Kamalame Cay", eta: "2.5 hrs", status: "Scheduled", type: "Vessel" },
];

export const REVENUE_CHART_DATA = [
  { month: 'Oct', revenue: 28000, orders: 22 },
  { month: 'Nov', revenue: 34000, orders: 31 },
  { month: 'Dec', revenue: 58000, orders: 64 },
  { month: 'Jan', revenue: 41000, orders: 38 },
  { month: 'Feb', revenue: 47000, orders: 45 },
  { month: 'Mar', revenue: 62000, orders: 58 },
];

export const LIFESTYLE_SERVICES = [
  {
    category: "End-to-End Supply Chain Management",
    description: "Strategic procurement and strategic planning to ensure operational resilience.",
    services: [
      { id: 1, title: "Strategic Procurement & Sourcing", description: "Curated sourcing of premium goods, specialty items, and hard-to-find products tailored to each property or vessel." },
      { id: 2, title: "Inventory Management & Planning", description: "Usage based planning to prevent shortages, reduce waste, and maintain optimal stock levels." },
      { id: 3, title: "Vendor Management & Consolidation", description: "Vet, score and manage multiple suppliers, consolidate orders, and ensure consistent quality." },
      { id: 4, title: "Quality Auditing & Assurance", description: "Inspection, freshness checks, and adherence to hospitality and maritime standards." }
    ]
  },
  {
    category: "Luxury Provisioning",
    description: "Bespoke culinary and essential supplies for the most discerning guests.",
    services: [
      { id: 5, title: "Gourmet Food & Beverage", description: "Premium produce, artisanal goods, fine wines, spirits, and specialty dietary items." },
      { id: 6, title: "Guest Essentials", description: "Toiletries, linens, prescriptions, amenities, and guest-ready essentials." },
      { id: 7, title: "Chef Driven & Custom Requests", description: "Sourcing ingredients, bespoke menus, and last-minute culinary needs." },
      { id: 8, title: "Eco-Conscious Options", description: "Sustainable, organic, and locally sourced alternatives for eco-focused properties." }
    ]
  },
  {
    category: "White-Glove Transportation & Logistics",
    description: "Cold-chain secure and punctual distribution across your operations.",
    services: [
      { id: 9, title: "Dedicated Delivery Fleet", description: "Temperature controlled, secure and punctual deliveries tailored to maritime schedules." },
      { id: 10, title: "Last Mile & Mystery Delivery", description: "Discreet, guest-friendly delivery protocols for private homes and yachts." },
      { id: 11, title: "Urgent & On-Demand Logistics", description: "Rapid response for unexpected needs, special events, or guest emergencies." },
      { id: 12, title: "Route Optimization", description: "Efficient routes to reduce delays, costs, and environmental impact." }
    ]
  },
  {
    category: "Concierge Fulfillment",
    description: "Elevating the guest experience through seamless back-of-house support.",
    services: [
      { id: 13, title: "Event & Experience Provisioning", description: "Suppliers for weddings, retreats, and festive provisioning for peak seasons." },
      { id: 14, title: "Lifestyle Item Sourcing", description: "Flowers, décor, spa products, entertainment items, and bespoke requests." },
      { id: 15, title: "Back-of-House Program", description: "Cleaning supplies, maintenance items, and operational essentials." },
      { id: 16, title: "Storage solutions", description: "Short-term storage, stock rotation, and inventory audits." }
    ]
  },
  {
    category: "Custom Supply Chain Programs",
    description: "Tailored institutional support for long-term operational excellence.",
    services: [
      { id: 17, title: "Dedicated Account Management", description: "A single point of contact for sourcing, quoting, and managing lead times." },
      { id: 18, title: "Tailored Service Plans", description: "Subscription-style provisioning or fully customized supply programs." },
      { id: 19, title: "Sustainability Consulting", description: "Helping clients meet eco goals through smarter sourcing and inventory practices." }
    ]
  }
];

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

export const ACCESS_PLANS = [];

export const USERS = [
  { id: 1, name: 'John Doe', email: 'john@example.com', phone: '123-456-7890', role: 'Operations', status: 'Active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '123-456-7891', role: 'Procurement', status: 'Active' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', phone: '123-456-7892', role: 'Logistics', status: 'Active' },
  { id: 4, name: 'Alice Brown', email: 'alice@example.com', phone: '123-456-7893', role: 'Inventory', status: 'Active' },
  { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', phone: '123-456-7894', role: 'Concierge', status: 'Active' },
];

export const ORDERS = [
  { id: 'ORD-001', client: 'Goldwynn Residences', product: 'Premium Champagne & Spirits', status: 'Delivered', deliveryTime: '09:15 AM' },
  { id: 'ORD-002', client: 'SY Azure', product: 'Fresh Seafood & Provisions', status: 'On Way', deliveryTime: '11:30 AM' },
  { id: 'ORD-003', client: 'Lyford Cay Estate', product: 'Egyptian Cotton Linens', status: 'Preparing', deliveryTime: '02:00 PM' },
];

export const INVOICES = [
  { id: 'INV-001', client: 'Goldwynn Residences', amount: 1500, status: 'Paid', date: '2024-04-01' },
  { id: 'INV-002', client: 'SY Azure', amount: 2200, status: 'Pending', date: '2024-04-02' },
];

export const VENDORS = [
  { id: 1, name: 'Caribbean Fine Provisions', contact_name: 'Mike Johnson', email: 'mike@cfp.com', phone: '123-456-7895', status: 'active' },
  { id: 2, name: 'Nassau Wine & Spirits', contact_name: 'Sarah Lee', email: 'sarah@nws.com', phone: '123-456-7896', status: 'active' },
];

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
  Produce: 'Grocery',
  'Meat & Seafood': 'Grocery',
  Dairy: 'Grocery',
  Bakery: 'Grocery',
  Pantry: 'Grocery',
  Meat: 'Grocery',
  Seafood: 'Grocery',
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

export const DEFAULT_MARKETPLACE_TEST_ITEMS = [
  {
    id: "bulk-seed-1",
    itemId: "bulk-seed-1",
    name: "Organic Bananas",
    store: "Solomon's Fresh Market",
    vendorName: "Solomon's Fresh Market",
    vendor_name: "Solomon's Fresh Market",
    vendor_group_key: "name:solomon's fresh market",
    category: "Grocery",
    price: 2.49,
    qty: 150,
    quantity: 150,
    unit: "kg",
    sku: "SFM-BAN-001",
    warehouse: "General Storage",
    location: "General Storage",
    description: "Fresh premium organic Cavendish bananas",
    image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  },
  {
    id: "bulk-seed-2",
    itemId: "bulk-seed-2",
    name: "Prime Angus Ribeye Steak",
    store: "Solomon's Fresh Market",
    vendorName: "Solomon's Fresh Market",
    vendor_name: "Solomon's Fresh Market",
    vendor_group_key: "name:solomon's fresh market",
    category: "Grocery",
    price: 19.99,
    qty: 40,
    quantity: 40,
    unit: "lbs",
    sku: "SFM-RIB-002",
    warehouse: "Cold Storage Hub",
    location: "Cold Storage Hub",
    description: "USDA Prime hand-cut boneless ribeye steak",
    image: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  },
  {
    id: "bulk-seed-3",
    itemId: "bulk-seed-3",
    name: "Grade A Whole Milk 1 Gallon",
    store: "Super Value Food Store",
    vendorName: "Super Value Food Store",
    vendor_name: "Super Value Food Store",
    vendor_group_key: "name:super value food store",
    category: "Grocery",
    price: 4.89,
    qty: 80,
    quantity: 80,
    unit: "gal",
    sku: "SV-MILK-001",
    warehouse: "Cold Storage Hub",
    location: "Cold Storage Hub",
    description: "Vitamin D enriched pasteurized whole fresh milk",
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  },
  {
    id: "bulk-seed-4",
    itemId: "bulk-seed-4",
    name: "Artisan Sourdough Loaf",
    store: "Super Value Food Store",
    vendorName: "Super Value Food Store",
    vendor_name: "Super Value Food Store",
    vendor_group_key: "name:super value food store",
    category: "Grocery",
    price: 3.99,
    qty: 60,
    quantity: 60,
    unit: "pcs",
    sku: "SV-BRD-002",
    warehouse: "General Storage",
    location: "General Storage",
    description: "Traditional slow-fermented artisan sourdough bread",
    image: "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  },
  {
    id: "bulk-seed-5",
    itemId: "bulk-seed-5",
    name: "Wild Atlantic Salmon Fillet",
    store: "Fresh Market Harbour Bay",
    vendorName: "Fresh Market Harbour Bay",
    vendor_name: "Fresh Market Harbour Bay",
    vendor_group_key: "name:fresh market harbour bay",
    category: "Grocery",
    price: 22.50,
    qty: 35,
    quantity: 35,
    unit: "lbs",
    sku: "FM-SAL-001",
    warehouse: "Cold Storage Hub",
    location: "Cold Storage Hub",
    description: "Fresh caught sustainably sourced Atlantic salmon fillets",
    image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  },
  {
    id: "bulk-seed-6",
    itemId: "bulk-seed-6",
    name: "Authentic Greek Yogurt 32oz",
    store: "Fresh Market Harbour Bay",
    vendorName: "Fresh Market Harbour Bay",
    vendor_name: "Fresh Market Harbour Bay",
    vendor_group_key: "name:fresh market harbour bay",
    category: "Grocery",
    price: 6.49,
    qty: 50,
    quantity: 50,
    unit: "pcs",
    sku: "FM-YOG-002",
    warehouse: "Cold Storage Hub",
    location: "Cold Storage Hub",
    description: "Triple-strained whole milk plain creamy Greek yogurt",
    image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  },
  {
    id: "bulk-seed-7",
    itemId: "bulk-seed-7",
    name: "Crisp Red Delicious Apples",
    store: "Solomon's Fresh Market",
    vendorName: "Solomon's Fresh Market",
    vendor_name: "Solomon's Fresh Market",
    vendor_group_key: "name:solomon's fresh market",
    category: "Grocery",
    price: 1.99,
    qty: 120,
    quantity: 120,
    unit: "lbs",
    sku: "SFM-APP-003",
    warehouse: "General Storage",
    location: "General Storage",
    description: "Sweet crunchy orchard-grown Red Delicious apples",
    image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  },
  {
    id: "bulk-seed-8",
    itemId: "bulk-seed-8",
    name: "Organic Black Beans 15oz",
    store: "Maxwell's Supermarket",
    vendorName: "Maxwell's Supermarket",
    vendor_name: "Maxwell's Supermarket",
    vendor_group_key: "name:maxwell's supermarket",
    category: "Grocery",
    price: 1.79,
    qty: 200,
    quantity: 200,
    unit: "cans",
    sku: "MX-BBN-001",
    warehouse: "General Storage",
    location: "General Storage",
    description: "Prepared canned low-sodium organic black beans",
    image: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  },
  {
    id: "bulk-seed-9",
    itemId: "bulk-seed-9",
    name: "Extra Virgin Olive Oil 750ml",
    store: "Maxwell's Supermarket",
    vendorName: "Maxwell's Supermarket",
    vendor_name: "Maxwell's Supermarket",
    vendor_group_key: "name:maxwell's supermarket",
    category: "Grocery",
    price: 14.99,
    qty: 45,
    quantity: 45,
    unit: "bottles",
    sku: "MX-EVO-002",
    warehouse: "General Storage",
    location: "General Storage",
    description: "First cold-pressed Mediterranean extra virgin olive oil",
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  },
  {
    id: "bulk-seed-10",
    itemId: "bulk-seed-10",
    name: "Artisan Italian Espresso Beans",
    store: "Maxwell's Supermarket",
    vendorName: "Maxwell's Supermarket",
    vendor_name: "Maxwell's Supermarket",
    vendor_group_key: "name:maxwell's supermarket",
    category: "Grocery",
    price: 12.50,
    qty: 30,
    quantity: 30,
    unit: "bags",
    sku: "MX-COF-003",
    warehouse: "General Storage",
    location: "General Storage",
    description: "Dark roasted whole bean Italian espresso blend",
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80",
    image_url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80",
    type: "Marketplace",
    inventoryType: "Marketplace",
    status: "Normal"
  }
];

export const INVENTORY = [
  ...DEFAULT_MARKETPLACE_TEST_ITEMS,
  { id: 1, name: 'Dom Perignon Champagne', category: 'Beverage', quantity: 6, price: 200, vendor_id: 2, vendor_name: 'Nassau Wine & Spirits', warehouse_name: 'Main Warehouse' },
  { id: 2, name: 'Fresh Atlantic Lobster', category: 'Food', quantity: 15, price: 50, vendor_id: 1, vendor_name: 'Caribbean Fine Provisions', warehouse_name: 'Cold Storage' },
];

export function getAutoSyncedMarketplaceVendors() {
  try {
    const hasKey = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('bulk_uploaded_marketplace_items') !== null : false;
    let savedBulk = [];
    try {
      savedBulk = JSON.parse(window.localStorage.getItem('bulk_uploaded_marketplace_items') || '[]');
    } catch {
      savedBulk = [];
    }
    let itemsList = (Array.isArray(savedBulk) && (savedBulk.length > 0 || hasKey)) ? savedBulk : DEFAULT_MARKETPLACE_TEST_ITEMS;

    // Filter out deleted items
    try {
      const deletedRaw = JSON.parse(window.localStorage.getItem('deleted_inventory_item_ids') || '[]');
      if (Array.isArray(deletedRaw) && deletedRaw.length > 0) {
        const deletedSet = new Set(deletedRaw.map(x => String(x).toLowerCase().trim()));
        itemsList = itemsList.filter(i => {
          const idStr = String(i.id ?? i.itemId ?? '').trim().toLowerCase();
          const nameStr = `name:${(i.name || i.item || '').trim().toLowerCase()}`;
          return !(idStr && deletedSet.has(idStr)) && !(nameStr && deletedSet.has(nameStr));
        });
      }
    } catch {}

    const knownProfiles = {
      "solomon's fresh market": {
        contactPerson: "Harbour Bay Branch Manager",
        email: "orders@solomonsfreshmarket.com",
        phone: "+1 (242) 393-4041",
        rating: 98,
        delivery: 96,
        category: "Grocery & Supermarket"
      },
      "maxwell's supermarket": {
        contactPerson: "Marsh Harbour Provisions Lead",
        email: "procurement@maxwellsbahamas.com",
        phone: "+1 (242) 367-2601",
        rating: 96,
        delivery: 95,
        category: "Grocery & Supermarket"
      },
      "fresh market harbour bay": {
        contactPerson: "Store Operations Supervisor",
        email: "harbourbay@freshmarket.bs",
        phone: "+1 (242) 394-4050",
        rating: 95,
        delivery: 94,
        category: "Grocery & Organic"
      },
      "super value food store": {
        contactPerson: "Nassau Distribution Lead",
        email: "service@supervalue.com.bs",
        phone: "+1 (242) 393-5477",
        rating: 94,
        delivery: 92,
        category: "Wholesale & Grocery"
      }
    };

    const vendorsMap = new Map();
    itemsList.forEach((item, idx) => {
      const sName = (item.store || item.vendorName || item.vendor || '').trim();
      if (!sName) return;
      const key = sName.toLowerCase();
      if (!vendorsMap.has(key)) {
        const profile = knownProfiles[key] || {};
        const safeStoreId = 8000 + idx;
        vendorsMap.set(key, {
          id: safeStoreId,
          vendor_id: safeStoreId,
          name: sName,
          companyName: sName,
          company_name: sName,
          contactPerson: profile.contactPerson || `${sName} Partner Representative`,
          contact: profile.contactPerson || `${sName} Partner Representative`,
          contact_name: profile.contactPerson || `${sName} Partner Representative`,
          phone: profile.phone || `+1 (242) 393-00${(idx % 90) + 10}`,
          email: profile.email || `orders@${key.replace(/[^a-z0-9]/g, '')}.com`,
          rating: profile.rating ?? 95,
          delivery: profile.delivery ?? 95,
          category: profile.category || (item.category ? `${item.category} Partner` : 'Marketplace Partner'),
          status: 'active',
          type: 'Marketplace',
          isMarketplaceSync: true
        });
      }
    });

    return Array.from(vendorsMap.values());
  } catch (e) {
    console.warn('Error computing auto synced marketplace vendors', e);
    return [];
  }
}

