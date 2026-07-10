import React, { useState, useMemo, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import { useData } from '../../context/GlobalDataContext';
import { ShoppingCart, Search, Store, Plus, Minus, X, Package, DollarSign, FileText, ChevronRight, Zap, Truck, Tag, Trash2, MapPin, Car } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomDatePicker from '../../components/CustomDatePicker';
import { localDateISO } from '../../utils/orderWorkflow';
import { MARKETPLACE_CATEGORIES, canonicalMarketplaceCategory } from '../../utils/data';
import { normalizeRole } from '../../utils/authUtils';
import { calculateOSRMRouteDistance } from '../../utils/distanceHelper';
import { toAbsoluteImageUrl } from '../../utils/apiHelpers.js';
import { Image as ImageIcon } from 'lucide-react';

const DEFAULT_TRANSPORT_EXTRA_FEE = {
    Road: 0,
    Sea: 150,
    Air: 300,
};

const TRANSPORT_ASSET_OPTIONS = {
    Sea: ['Boat', 'Cargo Boat', 'Ferry'],
    Air: ['Airplane', 'Charter Jet', 'Cargo Plane'],
};

const CHAUFFEUR_BASE_FEE_USD = Number(import.meta.env?.VITE_CHAUFFEUR_BASE_FEE_USD) || 120;
const CHAUFFEUR_BILLING_MODE = String(import.meta.env?.VITE_CHAUFFEUR_BILLING_MODE || 'separate').toLowerCase() === 'included'
    ? 'included'
    : 'separate';

const ClientStore = () => {
    const { inventory, cart, addToCart, removeFromCart, clearCart, addOrder, currentUser, clients, vendors, marketplaceVendors, shippingModePricing, fetchInventory, fetchVendors, systemSettings, fetchSystemSettings, deliveryPricing } = useData();
    const location = useLocation();
    const navigate = useNavigate();
    /** Simplified: primary marketplace + optional custom request for personal accounts */
    const [activeTab, setActiveTab] = useState('catalog');
    const [customItems, setCustomItems] = useState([{ name: '', qty: 1, price: 0 }]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [destination, setDestination] = useState(currentUser?.location || 'Port Hercule');
    const [deliveryMode, setDeliveryMode] = useState('Road');
    const [catalogDeliveryAddress, setCatalogDeliveryAddress] = useState(currentUser?.location || '');
    const [checkoutVendorId, setCheckoutVendorId] = useState('');
    const [bookChauffeur, setBookChauffeur] = useState(false);
    const [transportAsset, setTransportAsset] = useState('');
    const [islandLocation, setIslandLocation] = useState('');
    const [orderPlacementDate, setOrderPlacementDate] = useState(() => localDateISO());
    const [customRequestSubtype, setCustomRequestSubtype] = useState('');
    /** 'all' | store group key from inventoryByStore */
    const [catalogStoreFilter, setCatalogStoreFilter] = useState('all');
    const [productCategoryFilter, setProductCategoryFilter] = useState('all');
    const [personalNotes, setPersonalNotes] = useState('');
    const [deliveryInstructions, setDeliveryInstructions] = useState('');
    const [transportAssetCustom, setTransportAssetCustom] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('wallet');
    const [authorizeCharge, setAuthorizeCharge] = useState(false);
    /** Estimated one-way distance for personal document/package pickup & delivery pricing (admin: base + per km). */
    const [customRequestDistanceKm, setCustomRequestDistanceKm] = useState('');

    // Distance/Routing state variables
    const [catalogPickupAddress, setCatalogPickupAddress] = useState('');
    const [catalogDistanceKm, setCatalogDistanceKm] = useState('');
    const [customPickupAddress, setCustomPickupAddress] = useState('');
    const [customDistanceKm, setCustomDistanceKm] = useState('');
    const [personalPickupAddress, setPersonalPickupAddress] = useState('');
    const [personalDropAddress, setPersonalDropAddress] = useState('');

    // useEffect for Catalog/Marketplace Checkout OSRM Route distance
    React.useEffect(() => {
        const calculateDistance = async () => {
            if (catalogPickupAddress && catalogDeliveryAddress) {
                const res = await calculateOSRMRouteDistance(catalogPickupAddress, catalogDeliveryAddress);
                if (res && res.distanceKm != null) {
                    setCatalogDistanceKm(String(res.distanceKm));
                } else {
                    setCatalogDistanceKm('');
                }
            } else {
                setCatalogDistanceKm('');
            }
        };
        const timer = setTimeout(() => {
            calculateDistance();
        }, 1000);
        return () => clearTimeout(timer);
    }, [catalogPickupAddress, catalogDeliveryAddress]);

    // useEffect for Custom Requests (B2B/Business portfolio) OSRM Route distance
    React.useEffect(() => {
        const calculateDistance = async () => {
            if (customPickupAddress && destination) {
                const res = await calculateOSRMRouteDistance(customPickupAddress, destination);
                if (res && res.distanceKm != null) {
                    setCustomDistanceKm(String(res.distanceKm));
                } else {
                    setCustomDistanceKm('');
                }
            } else {
                setCustomDistanceKm('');
            }
        };
        const timer = setTimeout(() => {
            calculateDistance();
        }, 1000);
        return () => clearTimeout(timer);
    }, [customPickupAddress, destination]);

    // useEffect for Personal Custom Requests (customer pickup/delivery) OSRM Route distance
    React.useEffect(() => {
        const calculateDistance = async () => {
            if (personalPickupAddress && personalDropAddress) {
                const res = await calculateOSRMRouteDistance(personalPickupAddress, personalDropAddress);
                if (res && res.distanceKm != null) {
                    setCustomRequestDistanceKm(String(res.distanceKm));
                } else {
                    setCustomRequestDistanceKm('');
                }
            } else {
                setCustomRequestDistanceKm('');
            }
        };
        const timer = setTimeout(() => {
            calculateDistance();
        }, 1000);
        return () => clearTimeout(timer);
    }, [personalPickupAddress, personalDropAddress]);

    React.useEffect(() => {
        fetchInventory();
        fetchVendors();
        fetchSystemSettings();
    }, [fetchInventory, fetchVendors, fetchSystemSettings]);

    const userPortalRole = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/\s+/g, '');
    const isRetailPersonal = userPortalRole === 'customer';
    const roleKey = normalizeRole(currentUser?.role);
    const canDirectManageMarketplaceInventory = ['client', 'saas_client', 'admin', 'superadmin', 'inventory', 'procurement'].includes(roleKey);

    React.useEffect(() => {
        if (!isRetailPersonal && activeTab === 'sheet') {
            setActiveTab('catalog');
        }
    }, [isRetailPersonal, activeTab]);

    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('tab');
        if (!isRetailPersonal && (tab === 'sheet' || tab === 'custom')) {
            setActiveTab('catalog');
            return;
        }
        if (tab === 'sheet' || tab === 'custom') {
            setActiveTab('sheet');
        } else if (tab === 'catalog') {
            setActiveTab('catalog');
        }
    }, [location, isRetailPersonal]);

    const marketplaceInventory = inventory.filter(item => item.inventoryType?.toUpperCase() === 'MARKETPLACE' || !item.inventoryType);

    const filteredInventory = marketplaceInventory.filter(item => {
        const q = searchTerm.toLowerCase();
        const matchQ = !q || item.name.toLowerCase().includes(q) || String(item.category || '').toLowerCase().includes(q);
        const cat = canonicalMarketplaceCategory(item.category);
        const matchCat = productCategoryFilter === 'all' || cat === productCategoryFilter;
        return matchQ && matchCat;
    });

    const catalogShowAllPartnerItems = normalizeRole(currentUser?.role) === 'superadmin';

    const approvedPartnerNumericIds = useMemo(() => {
        const s = new Set();
        for (const v of marketplaceVendors || []) {
            const n = parseInt(String(v?.id).replace(/\D/g, ''), 10);
            if (!Number.isNaN(n)) s.add(n);
        }
        return s;
    }, [marketplaceVendors]);

    const catalogInventory = useMemo(() => {
        if (catalogShowAllPartnerItems) return filteredInventory;
        const partners = marketplaceVendors || [];
        return filteredInventory.filter((item) => {
            const raw = item?.vendor_id ?? item?.vendorId;
            if (raw != null && raw !== '') {
                const n = parseInt(String(raw).replace(/\D/g, ''), 10);
                if (!Number.isNaN(n)) return approvedPartnerNumericIds.has(n);
            }
            const nm = String(item?.vendorName || item?.vendor_name || '').trim();
            if (!nm) return true;
            return partners.some((x) => {
                const label = String(x.name || x.vendor_name || x.business_name || '').trim().toLowerCase();
                return label && label === nm.toLowerCase();
            });
        });
    }, [filteredInventory, catalogShowAllPartnerItems, approvedPartnerNumericIds, marketplaceVendors]);

    const resolveVendorIdForItem = (item) => {
        const raw = item?.vendor_id ?? item?.vendorId;
        if (raw != null && raw !== '') {
            const n = parseInt(String(raw).replace(/\D/g, ''), 10);
            if (!Number.isNaN(n)) return n;
        }
        const nm = String(item?.vendorName || item?.vendor_name || '').trim();
        if (nm && vendors?.length) {
            const v = vendors.find((x) => {
                const label = String(x.name || x.vendor_name || x.business_name || '').trim().toLowerCase();
                return label && label === nm.toLowerCase();
            });
            if (v?.id != null) {
                const n = parseInt(String(v.id).replace(/\D/g, ''), 10);
                return Number.isNaN(n) ? null : n;
            }
        }
        return null;
    };

    const resolveVendorIdFromCartLine = (line) => resolveVendorIdForItem(line);
    const resolveStoreKeyForItem = (item) => {
        const vid = resolveVendorIdForItem(item);
        if (vid != null) return `vendor:${vid}`;
        const groupKey = String(item?.vendor_group_key || '').trim();
        if (groupKey) return groupKey;
        const nm = String(item?.vendorName || item?.vendor_name || '').trim();
        if (nm) return `name:${nm.toLowerCase()}`;
        return 'unknown';
    };

    const inventoryByStore = useMemo(() => {
        const groups = new Map();
        for (const item of catalogInventory) {
            const vid = resolveVendorIdForItem(item);
            const label =
                String(item.vendorName || item.vendor_name || '').trim()
                || (vid != null && vendors?.find(v => String(v.id) === String(vid))?.name)
                || 'General catalogue';
            const key = vid != null ? `vendor:${vid}` : `name:${label}`;
            if (!groups.has(key)) {
                groups.set(key, { key, vendorId: vid, label, items: [] });
            }
            groups.get(key).items.push(item);
        }
        return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
    }, [catalogInventory, vendors]);

    const catalogSections = catalogStoreFilter === 'all'
        ? inventoryByStore
        : inventoryByStore.filter((g) => g.key === catalogStoreFilter);

    const cartVendorIds = useMemo(() => {
        const s = new Set();
        for (const line of cart) {
            const id = resolveVendorIdFromCartLine(line);
            if (id != null) s.add(id);
        }
        return [...s];
    }, [cart, vendors]);
    const cartStoreKeys = useMemo(() => {
        const keys = new Set();
        for (const line of cart) {
            keys.add(resolveStoreKeyForItem(line));
        }
        return [...keys];
    }, [cart, vendors]);

    const checkoutVendorOptions = useMemo(() => {
        if (!Array.isArray(marketplaceVendors) || marketplaceVendors.length === 0) return [];
        const matchCartId = (v, cid) => {
            const n = parseInt(String(v.id).replace(/\D/g, ''), 10);
            return cid === n || String(cid) === String(v.id);
        };
        if (cartVendorIds.length > 1) {
            return marketplaceVendors.filter((v) => cartVendorIds.some((cid) => matchCartId(v, cid)));
        }
        // Single-store or unknown vendor on lines: HQ-approved partners only
        return marketplaceVendors;
    }, [marketplaceVendors, cartVendorIds]);

    useEffect(() => {
        if (activeTab !== 'catalog') return;
        const ids = [];
        const seen = new Set();
        for (const line of cart) {
            const id = resolveVendorIdFromCartLine(line);
            if (id != null && !seen.has(id)) {
                seen.add(id);
                ids.push(id);
            }
        }
        if (ids.length === 1) {
            setCheckoutVendorId(String(ids[0]));
        } else if (ids.length > 1) {
            setCheckoutVendorId((prev) => {
                const p = prev !== '' ? parseInt(String(prev), 10) : null;
                if (p != null && !Number.isNaN(p) && ids.includes(p)) return prev;
                return '';
            });
        }
    }, [activeTab, cart, vendors]);

    useEffect(() => {
        if (deliveryMode === 'Sea' && !transportAsset) {
            setTransportAsset('Boat');
        } else if (deliveryMode === 'Air' && !transportAsset) {
            setTransportAsset('Airplane');
        } else if (deliveryMode === 'Road' && transportAsset) {
            setTransportAsset('');
        }
    }, [deliveryMode, transportAsset]);

    const addCustomRow = () => setCustomItems([...customItems, { name: '', qty: 1, price: 0 }]);
    const removeCustomRow = (index) => setCustomItems(customItems.filter((_, i) => i !== index));
    const updateCustomItem = (index, field, value) => {
        const newItems = [...customItems];
        newItems[index][field] = value;
        setCustomItems(newItems);
    };

    const adminDeliveryBaseUsd = useMemo(() => {
        const raw = systemSettings?.delivery_base_price ?? systemSettings?.deliveryBasePrice;
        const n = parseFloat(raw);
        return Number.isFinite(n) && n >= 0 ? n : 25;
    }, [systemSettings]);
    const adminPerKmUsd = useMemo(() => {
        const raw = systemSettings?.per_km_charges ?? systemSettings?.perKmCharges;
        const n = parseFloat(raw);
        return Number.isFinite(n) && n >= 0 ? n : 2.5;
    }, [systemSettings]);

    /** Find the matching delivery tier for a given distance in km. Returns the price or null if no match. */
    const getTierDeliveryFee = (km, tiers) => {
        if (!Array.isArray(tiers) || tiers.length === 0) return null;
        const match = tiers.find(t => km >= Number(t.min) && km <= Number(t.max));
        if (match) return Number(parseFloat(match.price).toFixed(2));
        // If km exceeds all tiers, use the last tier's price
        const sorted = [...tiers].sort((a, b) => Number(a.max) - Number(b.max));
        return Number(parseFloat(sorted[sorted.length - 1].price).toFixed(2));
    };

    const isPersonalPickupDeliveryRequest =
        isRetailPersonal
        && activeTab === 'sheet'
        && (customRequestSubtype === 'document_pickup_delivery' || customRequestSubtype === 'package_pickup_delivery');

    const personalPickupDeliveryServiceTotal = useMemo(() => {
        if (!isPersonalPickupDeliveryRequest) return 0;
        const km = Math.max(0, parseFloat(String(customRequestDistanceKm).replace(',', '.')) || 0);
        return Number((adminDeliveryBaseUsd + adminPerKmUsd * km).toFixed(2));
    }, [isPersonalPickupDeliveryRequest, customRequestDistanceKm, adminDeliveryBaseUsd, adminPerKmUsd]);

    /** Tiered delivery fee based on catalog route distance (only applies when distance is known) */
    const tierDeliveryFee = useMemo(() => {
        if (activeTab !== 'catalog') return 0;
        const kmRaw = activeTab === 'catalog' ? catalogDistanceKm : customDistanceKm;
        const km = parseFloat(String(kmRaw).replace(',', '.'));
        if (!Number.isFinite(km) || km <= 0) return 0;
        return getTierDeliveryFee(km, deliveryPricing) ?? 0;
    }, [activeTab, catalogDistanceKm, customDistanceKm, deliveryPricing]);

    const cartSubtotal = activeTab === 'catalog'
        ? cart.reduce((acc, item) => acc + (item.price * item.qty), 0)
        : isPersonalPickupDeliveryRequest
            ? personalPickupDeliveryServiceTotal
            : customItems.reduce((acc, item) => acc + (parseFloat(item.price || 0) * (parseInt(item.qty) || 0)), 0);
    const transportExtraFee = Number(
        shippingModePricing?.[deliveryMode]
        ?? DEFAULT_TRANSPORT_EXTRA_FEE[deliveryMode]
        ?? 0
    ) || 0;
    const chauffeurFee = bookChauffeur ? CHAUFFEUR_BASE_FEE_USD : 0;
    const chauffeurFeeIncludedInCheckout = CHAUFFEUR_BILLING_MODE === 'included';
    const estimatedGrandTotal = cartSubtotal + tierDeliveryFee + transportExtraFee + (chauffeurFeeIncludedInCheckout ? chauffeurFee : 0);

    const myClient = (clients || []).find(c => {
        const cId = String(c.id).replace('CLT-', '');
        const uId = String(currentUser?.clientId).replace('CLT-', '');
        return (currentUser?.clientId && cId === uId) ||
            (currentUser?.email && c.email?.toLowerCase() === currentUser.email?.toLowerCase()) ||
            (currentUser?.name && c.name?.toLowerCase() === currentUser.name?.toLowerCase());
    });

    const handleCheckout = async () => {
        let items = activeTab === 'catalog'
            ? cart.map(i => ({ name: i.name || 'Unknown Item', qty: i.qty || 1, price: i.price || 0, vendorName: i.vendorName }))
            : customItems.filter(i => i?.name?.trim() !== '').map(i => ({ name: i.name, qty: parseInt(i.qty) || 1, price: parseFloat(i.price || 0), custom: true }));

        if (activeTab === 'sheet' && isRetailPersonal) {
            const line = String(personalNotes || '').trim();
            if (!line) {
                swalWarning('Details required', 'Enter pickup/delivery details for your request.');
                return;
            }
            items = [{
                name: `${String(customRequestSubtype || 'request').replace(/_/g, ' ')} — ${line}`,
                qty: 1,
                price: personalPickupDeliveryServiceTotal,
                custom: true,
            }];
        }

        if (items.length === 0) {
            swalWarning('Empty Manifest', 'Manifest must contain at least one item.');
            return;
        }

        const isBespoke = activeTab === 'sheet';

        if (isBespoke && isRetailPersonal && !customRequestSubtype) {
            swalWarning('Request type', 'Select document or package logistics for your custom request.');
            return;
        }

        const deliveryAddress = isBespoke ? destination : catalogDeliveryAddress;
        if (!deliveryAddress || !deliveryAddress.trim()) {
            swalWarning('Address Required', 'Please enter a delivery address before confirming.');
            return;
        }
        const hasTransportDetail =
            !!(transportAsset && String(transportAsset).trim()) ||
            !!(transportAssetCustom && String(transportAssetCustom).trim());
        if ((deliveryMode === 'Sea' || deliveryMode === 'Air') && !hasTransportDetail) {
            swalWarning('Select transport asset', `Choose a ${deliveryMode === 'Sea' ? 'boat' : 'airplane'} option or describe a custom vessel / aircraft below.`);
            return;
        }
        /* 
        // Island/Location and Transport Asset details are now optional per user request to streamline marketplace checkout.
        if ((deliveryMode === 'Sea' || deliveryMode === 'Air') && !String(islandLocation || '').trim()) {
            swalWarning('Island/Location required', 'For sea/air dispatch, please enter the island or delivery location.');
            return;
        }
        */

        const orderKind = isBespoke ? 'custom_request' : 'marketplace';
        const typeLabel = isBespoke
            ? (customRequestSubtype ? `Custom Request (${customRequestSubtype.replace(/_/g, ' ')} × ${deliveryMode})` : 'Custom Request')
            : 'Marketplace Order';

        let vendorIdResolved = checkoutVendorId !== '' && checkoutVendorId != null ? parseInt(String(checkoutVendorId), 10) : null;
        if (!Number.isFinite(vendorIdResolved) || Number.isNaN(vendorIdResolved)) vendorIdResolved = null;

        if (!isBespoke && cart.length > 0) {
            const idsInCart = [];
            const seen = new Set();
            for (const line of cart) {
                const id = resolveVendorIdFromCartLine(line);
                if (id != null && !seen.has(id)) {
                    seen.add(id);
                    idsInCart.push(id);
                }
            }
            const multipleStores = cartStoreKeys.length > 1;
            if ((idsInCart.length > 1 || multipleStores) && vendorIdResolved == null) {
                swalWarning(
                    'Select fulfilment store',
                    'Your cart includes items from more than one store. Choose which store should fulfil this order on this screen, then confirm.'
                );
                return;
            }
            if (idsInCart.length === 1 && vendorIdResolved == null) {
                vendorIdResolved = idsInCart[0];
            }
        }

        const resolvedPickupLocation = isBespoke
            ? (isRetailPersonal ? personalPickupAddress : customPickupAddress)
            : catalogPickupAddress;

        const orderPayload = {
            client: myClient?.name || currentUser?.name || 'Client',
            clientId: myClient?.id || currentUser?.clientId || 1,
            items,
            deliveryType: deliveryMode,
            pickupLocation: resolvedPickupLocation || null,
            pickup_location: resolvedPickupLocation || null,
            transport_asset: (transportAssetCustom && transportAssetCustom.trim()) || transportAsset || null,
            transport_asset_custom: transportAssetCustom?.trim() || null,
            island_location: islandLocation || null,
            delivery_instructions: deliveryInstructions?.trim() || null,
            transport_fee: transportExtraFee,
            tier_delivery_fee: tierDeliveryFee,
            chauffeur_fee: chauffeurFee,
            chauffeur_fee_mode: chauffeurFeeIncludedInCheckout ? 'included' : 'separate',
            subtotal: Number(cartSubtotal.toFixed(2)),
            estimated_total: Number(estimatedGrandTotal.toFixed(2)),
            location: deliveryAddress.trim(),
            deliveryAddress: deliveryAddress.trim(),
            date: orderPlacementDate,
            requestDate: orderPlacementDate,
            order_date: orderPlacementDate,
            type: typeLabel,
            order_kind: orderKind,
            orderKind,
            vendorId: vendorIdResolved,
            vendor_id: vendorIdResolved,
            bookChauffeur,
            book_chauffeur: bookChauffeur,
            custom_request_category: isBespoke ? `${customRequestSubtype}_${deliveryMode.toLowerCase()}` : undefined,
            customRequestCategory: isBespoke ? `${customRequestSubtype}_${deliveryMode.toLowerCase()}` : undefined,
            payment_method: paymentMethod,
            payment_authorized: !!authorizeCharge,
        };

        if (isRetailPersonal && !authorizeCharge) {
            swalWarning('Payment authorization required', 'Please authorize the automatic charge before placing this order.');
            return;
        }

        const result = await addOrder(orderPayload, { silentUi: true, customerCheckout: true });
        if (!result?.ok) {
            swalError('Checkout failed', result?.error || 'Could not create order.');
            return;
        }

        if (activeTab === 'catalog') clearCart();
        else {
            setCustomItems([{ name: '', qty: 1, price: 0 }]);
            setCustomRequestDistanceKm('');
        }

        setIsCartOpen(false);

        const totalStr = `$${estimatedGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

        if (isRetailPersonal) {
            if (result?.charged === false) {
                swalWarning(
                    'Order placed, payment pending',
                    `Order #${result.id} was created but auto-charge did not complete via ${paymentMethod}. ${result?.chargeError || 'Please complete payment from billing.'}`
                );
            } else {
                swalSuccess('Order placed & charged', `Payment authorised via ${paymentMethod} (${totalStr}) for order #${result.id}. Chauffeur and membership fees bill separately where applicable.`);
            }
        } else {
            swalSuccess('Order submitted', `Order #${result.id} sent for fulfilment (${totalStr}).`);
        }

        /* Stay on marketplace — fulfilment choices were confirmed in-checkout; My Orders available from the menu when needed */
    };

    return (
        <div className="space-y-6 sm:space-y-10 pb-20">
            {/* Header section... */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white italic uppercase leading-none">
                        ZaneZion <span className="text-accent underline decoration-white/10 underline-offset-8">Concierge</span> Portal
                    </h1>
                    <p className="text-secondary text-[10px] sm:text-xs mt-4 font-black uppercase tracking-[0.4em] opacity-80 italic">Global Logistics & Bespoke Procurement Network</p>
                </div>
                <div className="flex items-center gap-4">
                    {canDirectManageMarketplaceInventory && (
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard/inventory?action=entry&type=Marketplace')}
                            className="px-5 py-3 rounded-2xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
                        >
                            + Add Marketplace Item
                        </button>
                    )}
                    <div className="hidden lg:flex flex-col items-end px-6 border-r border-white/10">
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">Client Identity</span>
                        <span className="text-sm font-bold text-accent uppercase italic">{currentUser?.name || 'Client'}</span>
                    </div>
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="relative p-5 sm:p-6 bg-accent/10 border border-accent/30 rounded-[2rem] text-accent hover:bg-accent hover:text-black transition-all shadow-2xl shadow-accent/5 group"
                    >
                        <ShoppingCart size={24} className="group-hover:scale-110 transition-transform" />
                        {cart.length > 0 && (
                            <span className="absolute top-2 right-2 w-6 h-6 bg-white text-black border-2 border-accent text-[10px] font-black rounded-full flex items-center justify-center animate-bounce">
                                {cart.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-[2.5rem] border border-white/5 w-fit">
                <button
                    onClick={() => setActiveTab('catalog')}
                    className={`px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'catalog' ? 'bg-accent text-black shadow-xl shadow-accent/20' : 'text-muted hover:text-white'}`}
                >
                    Elite Catalog
                </button>
                {isRetailPersonal && (
                    <button
                        type="button"
                        onClick={() => setActiveTab('sheet')}
                        className={`px-8 py-3.5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'sheet' ? 'bg-accent text-black shadow-xl shadow-accent/20' : 'text-muted hover:text-white border border-white/10 hover:border-accent/40 hover:bg-white/5'}`}
                    >
                        Custom Request
                    </button>
                )}
            </div>

            {activeTab === 'catalog' ? (
                <div className="space-y-8">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.25em]">
                                {catalogStoreFilter === 'all' ? 'Select a boutique to browse' : 'Browsing Boutique'}
                            </p>
                            {catalogStoreFilter !== 'all' && (
                                <button
                                    onClick={() => setCatalogStoreFilter('all')}
                                    className="text-[10px] font-black text-accent uppercase tracking-widest hover:underline flex items-center gap-1"
                                >
                                    <ChevronRight size={12} className="rotate-180" /> Back to all stores
                                </button>
                            )}
                        </div>
                        {catalogStoreFilter !== 'all' && (
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCatalogStoreFilter('all')}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${catalogStoreFilter === 'all' ? 'bg-accent text-black border-accent' : 'bg-white/[0.03] border-white/10 text-muted hover:text-white'}`}
                                >
                                    <Store size={14} /> All boutiques
                                </button>
                                {inventoryByStore.map((g) => (
                                    <button
                                        type="button"
                                        key={g.key}
                                        onClick={() => setCatalogStoreFilter(g.key)}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${catalogStoreFilter === g.key ? 'bg-accent text-black border-accent' : 'bg-white/[0.03] border-white/10 text-muted hover:text-white'}`}
                                    >
                                        {g.label}
                                        <span className="opacity-70 tabular-nums">({g.items.length})</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <p className="text-[10px] font-black text-muted uppercase tracking-[0.25em]">Browse by category</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setProductCategoryFilter('all')}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${productCategoryFilter === 'all' ? 'bg-accent text-black border-accent' : 'bg-white/[0.03] border-white/10 text-muted hover:text-white'}`}
                            >
                                <Tag size={14} /> All categories
                            </button>
                            {MARKETPLACE_CATEGORIES.map((c) => (
                                <button
                                    type="button"
                                    key={c}
                                    onClick={() => setProductCategoryFilter(c)}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${productCategoryFilter === c ? 'bg-accent text-black border-accent' : 'bg-white/[0.03] border-white/10 text-muted hover:text-white'}`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {catalogSections.length === 0 ? (
                        <div className="py-32 flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                            <Search size={64} strokeWidth={1} className="text-muted" />
                            <p className="text-sm font-black uppercase tracking-[0.3em]">No Assets Match Protocol</p>
                        </div>
                    ) : catalogStoreFilter === 'all' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {inventoryByStore.map((group) => (
                                <div
                                    key={group.key}
                                    onClick={() => setCatalogStoreFilter(group.key)}
                                    className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 hover:border-accent/40 hover:bg-white/[0.04] transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Store size={120} />
                                    </div>
                                    <div className="relative z-10 space-y-4">
                                        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                                            <Store size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white uppercase italic">{group.label}</h3>
                                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mt-1">{group.items.length} Curated Assets</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-accent text-[10px] font-black uppercase tracking-widest">
                                            Enter Boutique <ChevronRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        catalogSections.map((group, gi) => (
                            <div key={group.key} className={`space-y-6 ${gi > 0 ? 'pt-8 border-t border-white/5' : ''}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                                            <Store size={28} className="text-accent" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tight">{group.label}</h2>
                                            <p className="text-[10px] font-bold text-muted uppercase tracking-[0.3em] mt-1">
                                                Elite Partner Store · {group.items.length} Asset{group.items.length !== 1 ? 's' : ''} Available
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
                                    {group.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-accent/30 transition-all duration-500 shadow-2xl flex flex-col"
                                        >
                                            <div className="aspect-square bg-white/5 border-b border-white/5 flex items-center justify-center relative overflow-hidden">
                                                {item.image && (
                                                    <img
                                                        src={toAbsoluteImageUrl(item.image)}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }}
                                                    />
                                                )}
                                                <div className={item.image ? "hidden" : "block"}>
                                                    <Package size={64} className="text-accent/10 group-hover:text-accent/20 group-hover:scale-110 transition-all duration-700" />
                                                </div>
                                                <div className="absolute top-6 right-6 px-4 py-2 bg-background/90 backdrop-blur-md border border-accent/20 rounded-2xl text-sm font-black text-accent shadow-2xl z-10">
                                                    ${parseFloat(item.price).toLocaleString()}
                                                </div>
                                                {item.category && (
                                                    <div className="absolute top-6 left-6 px-3 py-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl text-[9px] font-black text-white uppercase tracking-widest z-10">
                                                        {item.category}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-6 flex-1 flex flex-col">
                                                <div className="flex-1 space-y-4">
                                                    <div>
                                                        <h3 className="font-black text-white text-lg group-hover:text-accent transition-colors italic leading-tight">{item.name}</h3>
                                                        {item.description && (
                                                            <p className="text-[11px] text-secondary mt-2 line-clamp-2 leading-relaxed font-medium">
                                                                {item.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {(item.size || item.color || item.material) && (
                                                        <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/5">
                                                            {item.size && (
                                                                <div className="space-y-0.5">
                                                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest">Size</p>
                                                                    <p className="text-[10px] font-bold text-white uppercase">{item.size}</p>
                                                                </div>
                                                            )}
                                                            {item.color && (
                                                                <div className="space-y-0.5">
                                                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest">Color</p>
                                                                    <p className="text-[10px] font-bold text-white uppercase">{item.color}</p>
                                                                </div>
                                                            )}
                                                            {item.material && (
                                                                <div className="space-y-0.5 col-span-2">
                                                                    <p className="text-[8px] font-black text-muted uppercase tracking-widest">Material</p>
                                                                    <p className="text-[10px] font-bold text-white uppercase">{item.material}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {item.specifications && (
                                                        <div className="flex items-center gap-2">
                                                            <Zap size={10} className="text-accent" />
                                                            <p className="text-[9px] font-black text-accent uppercase tracking-widest truncate">
                                                                {item.specifications}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => addToCart({
                                                        ...item,
                                                        vendor_group_key: group.key,
                                                        vendorName: item.vendorName || item.vendor_name || group.label,
                                                        vendor_id: item.vendor_id ?? item.vendorId ?? group.vendorId ?? null,
                                                    })}
                                                    className="w-full mt-6 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] hover:bg-accent hover:text-black hover:border-accent transition-all flex items-center justify-center gap-3 active:scale-[0.98] shadow-lg shadow-black/20"
                                                >
                                                    <Plus size={14} /> {isRetailPersonal ? 'Add to order' : 'Add to Manifest'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* Custom Manifest Section - UPGRADED TO MATCH SCREENSHOT */
                <div className="bg-card/40 border border-white/5 rounded-[2.5rem] p-4 sm:p-10 space-y-10 backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/30 to-transparent"></div>

                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="space-y-4 w-full lg:w-auto">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center text-accent">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-3">
                                        Custom <span className="text-accent">Aspirational</span> Manifest
                                    </h3>
                                    <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] mt-1">Manual asset requisition protocol for non-catalog items.</p>
                                </div>
                            </div>

                            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl max-w-md">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest block mb-2">Requesting Client</label>
                                <p className="text-sm font-bold text-accent italic uppercase">{currentUser?.name || 'Client'}</p>
                            </div>
                        </div>
                        {!isRetailPersonal && (
                            <button
                                onClick={addCustomRow}
                                className="w-full lg:w-auto px-8 py-4 bg-accent/10 border border-accent/30 rounded-2xl text-accent text-[10px] font-black uppercase tracking-[0.25em] hover:bg-accent hover:text-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-accent/5 group"
                            >
                                <Plus size={16} className="group-hover:rotate-90 transition-transform" /> ADD LINE ITEM
                            </button>
                        )}
                    </div>

                    {isRetailPersonal && (
                        <div className="w-full p-6 bg-white/[0.02] border border-accent/20 rounded-3xl space-y-4">
                            <p className="text-[10px] font-black text-accent uppercase tracking-[0.25em]">Custom request type (personal)</p>
                            <p className="text-xs text-secondary">Document or package moves with your selected Road / Sea / Air mode below.</p>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCustomRequestSubtype('document_pickup_delivery')}
                                    className={`flex-1 min-w-[140px] px-5 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${customRequestSubtype === 'document_pickup_delivery' ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 bg-white/[0.02] text-muted hover:text-white'}`}
                                >
                                    Document pickup / delivery
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomRequestSubtype('package_pickup_delivery')}
                                    className={`flex-1 min-w-[140px] px-5 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${customRequestSubtype === 'package_pickup_delivery' ? 'border-accent bg-accent/10 text-accent' : 'border-white/10 bg-white/[0.02] text-muted hover:text-white'}`}
                                >
                                    Package pickup / delivery
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        {isRetailPersonal ? (
                            <div className="p-6 bg-white/[0.02] border border-accent/20 rounded-3xl space-y-4">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Request details (pickup / delivery instructions)</label>
                                <textarea
                                    value={personalNotes}
                                    onChange={(e) => setPersonalNotes(e.target.value)}
                                    rows={5}
                                    className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none"
                                    placeholder="Describe what to pick up or deliver, time windows, contact on site, special handling…"
                                />
                                <p className="text-[9px] text-muted font-bold uppercase tracking-widest">Document pickup is optional; package moves use the same form. Use the task bar for other concierge requests after placing this requisition.</p>
                                {(customRequestSubtype === 'document_pickup_delivery' || customRequestSubtype === 'package_pickup_delivery') && (
                                    <div className="space-y-4 pt-2 border-t border-white/10">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest">Pickup Location / Origin Address</label>
                                            <input
                                                type="text"
                                                placeholder="Enter pickup address..."
                                                value={personalPickupAddress}
                                                onChange={(e) => setPersonalPickupAddress(e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest">Destination Address / Drop Location</label>
                                            <input
                                                type="text"
                                                placeholder="Enter drop address..."
                                                value={personalDropAddress}
                                                onChange={(e) => setPersonalDropAddress(e.target.value)}
                                                className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted uppercase tracking-widest">Estimated distance (km)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                inputMode="decimal"
                                                value={customRequestDistanceKm}
                                                onChange={(e) => setCustomRequestDistanceKm(e.target.value)}
                                                placeholder="e.g. 12"
                                                className="w-full max-w-xs bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none font-bold"
                                            />
                                        </div>
                                        <p className="text-[10px] text-secondary font-bold leading-relaxed">
                                            Service estimate: ${adminDeliveryBaseUsd.toFixed(2)} base + {(Math.max(0, parseFloat(String(customRequestDistanceKm).replace(',', '.')) || 0)).toFixed(1)} km × ${adminPerKmUsd.toFixed(2)}/km ={' '}
                                            <span className="text-accent">${personalPickupDeliveryServiceTotal.toFixed(2)}</span>
                                            <span className="text-muted font-semibold normal-case"> (from admin settings)</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : null}
                        <div className="space-y-4">
                            {!isRetailPersonal && customItems.map((item, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ x: -10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl group hover:border-accent/40 transition-all relative"
                                >
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                                        <div className="lg:col-span-5 space-y-2">
                                            <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Item Name / Strategic Specs</label>
                                            <div className="relative">
                                                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Vintage 1996 Dom Perignon..."
                                                    className="w-full bg-background border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:border-accent/50 outline-none font-bold transition-all"
                                                    value={item.name}
                                                    onChange={(e) => updateCustomItem(idx, 'name', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2 space-y-2">
                                            <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1 text-center block">QTY</label>
                                            <div className="flex items-center gap-1 bg-background border border-white/10 rounded-2xl p-1">
                                                <button
                                                    onClick={() => updateCustomItem(idx, 'qty', Math.max(1, item.qty - 1))}
                                                    className="w-10 h-10 flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent border-none p-0 text-center text-sm font-black text-white focus:ring-0"
                                                    value={item.qty}
                                                    onChange={(e) => updateCustomItem(idx, 'qty', parseInt(e.target.value) || 1)}
                                                />
                                                <button
                                                    onClick={() => updateCustomItem(idx, 'qty', item.qty + 1)}
                                                    className="w-10 h-10 flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 rounded-xl transition-all"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2 space-y-2">
                                            <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Unit Price</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={14} />
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    className="w-full bg-background border border-white/5 rounded-2xl pl-10 pr-4 py-4 text-sm text-white focus:border-accent/50 outline-none font-bold transition-all"
                                                    value={item.price}
                                                    onChange={(e) => updateCustomItem(idx, 'price', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="lg:col-span-2 space-y-2">
                                            <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Line Total</label>
                                            <div className="w-full bg-accent/5 border border-accent/10 rounded-2xl px-5 py-4 text-sm text-accent font-black">
                                                ${(parseFloat(item.price || 0) * (parseInt(item.qty) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>

                                        <div className="lg:col-span-1">
                                            <button
                                                onClick={() => removeCustomRow(idx)}
                                                className="w-full h-14 flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 rounded-2xl transition-all group/del"
                                                disabled={customItems.length === 1}
                                            >
                                                <Trash2 size={20} className="group-hover/del:scale-110 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-8 pt-8 border-t border-white/5">
                        <div className="flex-1 max-w-md space-y-4">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Pickup Location / Origin Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={16} />
                                <input
                                    type="text"
                                    placeholder="Enter secure origin/pickup..."
                                    className="w-full bg-background border border-white/10 rounded-3xl pl-12 pr-4 py-4 text-sm text-white focus:border-accent/50 outline-none font-bold transition-all shadow-inner"
                                    value={customPickupAddress}
                                    onChange={(e) => setCustomPickupAddress(e.target.value)}
                                />
                            </div>
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Destination Address / Port</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={16} />
                                <input
                                    type="text"
                                    placeholder="Enter secure drop location..."
                                    className="w-full bg-background border border-white/10 rounded-3xl pl-12 pr-4 py-4 text-sm text-white focus:border-accent/50 outline-none font-bold transition-all shadow-inner"
                                    value={destination}
                                    onChange={(e) => setDestination(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-accent uppercase tracking-widest ml-1">Total Distance (km)</label>
                                <input
                                    type="text"
                                    placeholder="Distance auto-calculated..."
                                    className="w-full bg-background border border-white/10 rounded-3xl px-4 py-4 text-sm text-accent focus:border-accent/50 outline-none font-black transition-all shadow-inner"
                                    value={customDistanceKm}
                                    onChange={(e) => setCustomDistanceKm(e.target.value)}
                                />
                            </div>
                            <CustomDatePicker
                                label="Order placement date"
                                selectedDate={orderPlacementDate}
                                onChange={(d) => setOrderPlacementDate(d)}
                            />
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <FileText size={12} className="text-accent" /> Delivery instructions (optional)
                                </label>
                                <textarea
                                    rows={3}
                                    value={deliveryInstructions}
                                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                                    placeholder="Time windows, access notes, who receives the handoff…"
                                    className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none resize-none"
                                />
                            </div>


                            {isRetailPersonal && (
                                <div className="p-5 rounded-[2rem] border border-accent/25 bg-accent/[0.04] space-y-4">
                                    <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Payment authorization</p>
                                    {/* auto-fit uses card width (not viewport), so labels never sit in too-narrow columns */}
                                    <div className="grid w-full min-w-0 gap-2 [grid-template-columns:repeat(auto-fit,minmax(7.25rem,1fr))]">
                                        {[
                                            { id: 'wallet', label: 'Wallet' },
                                            { id: 'card', label: 'Card' },
                                            { id: 'bank', label: 'Bank' },
                                        ].map((m) => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setPaymentMethod(m.id)}
                                                className={`w-full min-w-0 max-w-full min-h-[44px] box-border inline-flex items-center justify-center px-4 py-2.5 rounded-2xl text-[11px] font-bold uppercase tracking-normal text-center whitespace-normal leading-snug border transition-all break-words [overflow-wrap:anywhere] ${paymentMethod === m.id ? 'bg-accent text-black border-accent' : 'bg-white/[0.03] border-white/10 text-muted hover:text-white'}`}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-border accent-accent mt-0.5"
                                            checked={authorizeCharge}
                                            onChange={(e) => setAuthorizeCharge(e.target.checked)}
                                        />
                                        <span className="text-[10px] text-secondary font-bold leading-relaxed group-hover:text-white transition-colors">
                                            I authorize immediate charge for this custom request total.
                                        </span>
                                    </label>
                                </div>
                            )}
                            {marketplaceVendors?.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Vendor preference</label>
                                    <select
                                        value={checkoutVendorId}
                                        onChange={(e) => setCheckoutVendorId(e.target.value)}
                                        className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/40 outline-none"
                                    >
                                        <option value="">ZaneZion assigns best partner</option>
                                        {marketplaceVendors.map((v) => (
                                            <option key={v.id} value={String(v.id)}>
                                                {(v.name || 'Vendor')} {v.category ? `— ${v.category}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-6 bg-accent/[0.03] border border-accent/20 p-6 rounded-[2rem] min-w-[300px] justify-between">
                            <div>
                                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1 italic">Grand Total (Estimated)</p>
                                <div className="flex items-center gap-1.5 text-success font-bold text-[10px]">
                                    <Zap size={10} className="fill-success" /> Items ${cartSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                                {tierDeliveryFee > 0 && (
                                    <div className="flex items-center gap-1.5 text-accent font-black text-[10px] mt-1 uppercase tracking-wide">
                                        <Truck size={10} /> Delivery ({catalogDistanceKm || '?'} km) ${tierDeliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                )}
                                {transportExtraFee > 0 && (
                                    <div className="text-[10px] text-warning font-black mt-1 uppercase tracking-wide">
                                        + {deliveryMode} transport ${transportExtraFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                )}
                            </div>
                            <p className="text-4xl font-black text-white italic tracking-tighter">${estimatedGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    <div className="pt-10 flex flex-col xl:flex-row items-center justify-between gap-10">
                        <div className="w-full xl:w-auto space-y-5">
                            <div className="flex items-center gap-3">
                                <Truck size={18} className="text-accent" />
                                <label className="text-[10px] font-black text-accent uppercase tracking-[0.4em]">Logistics Protocol Selection</label>
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                                {['Road', 'Sea', 'Air'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setDeliveryMode(mode)}
                                        className={`px-10 py-5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.25em] border transition-all duration-300 relative overflow-hidden group ${deliveryMode === mode
                                            ? 'bg-accent/10 border-accent text-accent shadow-lg shadow-accent/5'
                                            : 'bg-white/[0.02] border-white/5 text-muted/60 hover:border-white/20 hover:text-white'
                                            }`}
                                    >
                                        {deliveryMode === mode && (
                                            <span className="absolute top-0 left-0 w-1.5 h-full bg-accent"></span>
                                        )}
                                        {mode}
                                    </button>
                                ))}
                            </div>
                            {(deliveryMode === 'Sea' || deliveryMode === 'Air') && (
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Select {deliveryMode === 'Sea' ? 'boat' : 'airplane'} option</p>
                                    <div className="flex flex-wrap gap-2.5">
                                        {(TRANSPORT_ASSET_OPTIONS[deliveryMode] || []).map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setTransportAsset(opt)}
                                                className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${transportAsset === opt ? 'bg-accent/10 border-accent text-accent' : 'bg-white/[0.02] border-white/10 text-muted hover:text-white'}`}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="space-y-2 max-w-md">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Island / location for {deliveryMode.toLowerCase()} dispatch</label>
                                        <input
                                            type="text"
                                            value={islandLocation}
                                            onChange={(e) => setIslandLocation(e.target.value)}
                                            placeholder={deliveryMode === 'Sea' ? 'e.g. Blue Lagoon Island' : 'e.g. Exuma Airstrip'}
                                            className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/40 outline-none font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2 max-w-md">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Custom vessel or aircraft (optional)</label>
                                        <input
                                            type="text"
                                            value={transportAssetCustom}
                                            onChange={(e) => setTransportAssetCustom(e.target.value)}
                                            placeholder={deliveryMode === 'Sea' ? 'e.g. private tender, named yacht' : 'e.g. seaplane charter, tail number'}
                                            className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/40 outline-none font-bold"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleCheckout}
                            disabled={
                                isRetailPersonal
                                    ? !String(personalNotes || '').trim() || !customRequestSubtype
                                    : customItems.every(i => i.name.trim() === '')
                            }
                            className="w-full xl:w-auto px-14 py-6 bg-accent text-black rounded-[2.2rem] font-black uppercase tracking-[0.3em] text-xs hover:shadow-[0_25px_50px_-12px_rgba(200,169,106,0.6)] active:scale-[0.98] transition-all disabled:opacity-20 flex items-center justify-center gap-5 group"
                        >
                            {isRetailPersonal ? 'Checkout & pay' : 'Submit requisition'} <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            )}


            {/* Cart Drawer */}
            <AnimatePresence>
                {isCartOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCartOpen(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-full sm:max-w-[450px] bg-sidebar border-l border-white/5 z-[101] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] h-[100dvh] max-h-[100dvh] overflow-hidden"
                        >
                            <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between shrink-0 bg-gradient-to-br from-white/[0.02] to-transparent">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-extrabold flex items-center gap-3 text-white">
                                        <ShoppingCart size={22} className="text-accent" />{' '}
                                        {isRetailPersonal ? (
                                            <>Create <span className="text-accent">order</span></>
                                        ) : (
                                            <>Checkout <span className="text-accent">Manifest</span></>
                                        )}
                                    </h3>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-[0.3em]">
                                        {isRetailPersonal ? 'Review cart & vendor, then place order' : 'Institutional Procurement'}
                                    </p>
                                </div>
                                <button onClick={() => setIsCartOpen(false)} className="w-12 h-12 flex items-center justify-center hover:bg-white/5 rounded-2xl text-muted transition-all border border-transparent hover:border-white/10 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Single scroll region: cart lines + checkout controls (footer was stealing flex space and clipping items) */}
                            <div className="flex-1 min-h-0 max-h-[calc(100vh-120px)] overflow-y-auto overscroll-contain p-5 sm:p-8 pb-36 space-y-6 custom-scrollbar bg-[radial-gradient(circle_at_top_right,rgba(200,169,106,0.03),transparent)] border-t border-transparent">
                                {cart.length > 0 && checkoutVendorOptions.length > 0 && (
                                    <div className="p-4 rounded-2xl border border-accent/25 bg-accent/[0.06] space-y-3 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <Store size={18} className="text-accent shrink-0" />
                                            <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">
                                                {isRetailPersonal ? 'Vendor for this order' : 'Fulfilment store — confirm on this screen'}
                                            </p>
                                        </div>
                                        {(cartVendorIds.length > 1 || cartStoreKeys.length > 1) ? (
                                            <p className="text-[10px] text-warning font-bold leading-relaxed">
                                                Your cart mixes multiple stores. Choose which vendor fulfils this order before you continue.
                                            </p>
                                        ) : (
                                            <p className="text-[10px] text-muted font-bold leading-relaxed">
                                                {isRetailPersonal
                                                    ? 'Pick the partner you want to fulfil this order, or leave as default to match your catalogue store.'
                                                    : 'Adjust only if your team assigns a different fulfilment partner.'}
                                            </p>
                                        )}
                                        <label className="text-[9px] font-black text-muted uppercase tracking-widest block">Vendor / store</label>
                                        <select
                                            value={checkoutVendorId}
                                            onChange={(e) => setCheckoutVendorId(e.target.value)}
                                            className="w-full bg-background border border-white/15 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none font-bold"
                                        >
                                            <option value="">
                                                {(cartVendorIds.length > 1 || cartStoreKeys.length > 1) ? 'Choose vendor for this order…' : (isRetailPersonal ? 'Use catalogue store (default)' : 'Platform assigns best partner (optional)')}
                                            </option>
                                            {checkoutVendorOptions.map((v) => (
                                                <option key={v.id} value={String(v.id)}>{v.name || 'Partner'}{v.category ? ` — ${v.category}` : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="space-y-5">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Line items</p>
                                    {cart.length > 0 ? cart.map((item) => (
                                        <motion.div
                                            layout
                                            key={item.id}
                                            className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center justify-between gap-4 group hover:border-accent/20 transition-all shadow-xl"
                                        >
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="w-12 h-12 bg-background border border-white/5 rounded-xl flex items-center justify-center text-accent/40 group-hover:text-accent shrink-0 transition-colors">
                                                    <Package size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-[13px] font-bold text-white break-words group-hover:text-accent transition-colors">{item.name}</h4>
                                                    <p className="text-[9px] text-muted/60 uppercase font-black tracking-widest truncate mt-0.5">{item.vendorName}</p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="text-[11px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded-md self-start font-mono">${item.price.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-background/80 p-1 rounded-xl border border-white/10 shadow-inner shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-danger/20 hover:text-danger rounded-lg transition-all text-muted/40"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="text-[11px] font-black w-6 text-center text-white">{item.qty}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => addToCart(item)}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-success/20 hover:text-success rounded-lg transition-all text-muted/40"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )) : (
                                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
                                            <div className="w-24 h-24 bg-white/[0.02] border border-white/5 rounded-full flex items-center justify-center text-muted/20">
                                                <Package size={48} strokeWidth={1} />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted italic">{isRetailPersonal ? 'Cart is empty' : 'Manifest is Empty'}</p>
                                                <p className="text-[10px] text-muted/40 uppercase tracking-widest max-w-[180px]">{isRetailPersonal ? 'Add items from the catalogue to create an order.' : 'Requisition required to proceed with logistics portal.'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-white/10 pt-6 space-y-6 relative">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 blur-[80px] -mr-20 -mt-20 pointer-events-none" />

                                    <div className="space-y-4 relative">
                                        <div className="flex items-center justify-between ml-1">
                                            <p className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">Logistics Protocol</p>
                                            <span className="text-[8px] text-muted font-black uppercase tracking-widest">{deliveryMode} Selected</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-white">
                                            {['Road', 'Sea', 'Air'].map(mode => (
                                                <button
                                                    key={mode}
                                                    onClick={() => setDeliveryMode(mode)}
                                                    className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all relative overflow-hidden ${deliveryMode === mode
                                                        ? 'bg-accent text-black border-accent'
                                                        : 'bg-white/[0.03] border-white/5 text-muted hover:border-white/10 hover:text-white'
                                                        }`}
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {(deliveryMode === 'Sea' || deliveryMode === 'Air') && (
                                        <div className="space-y-3">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest">Select {deliveryMode === 'Sea' ? 'boat' : 'airplane'}</p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {(TRANSPORT_ASSET_OPTIONS[deliveryMode] || []).map((opt) => (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setTransportAsset(opt)}
                                                        className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${transportAsset === opt ? 'bg-accent/10 border-accent text-accent' : 'bg-white/[0.03] border-white/10 text-muted hover:text-white'}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-accent uppercase tracking-widest ml-1 flex items-center gap-2">
                                                    <MapPin size={12} /> Island / Location (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder={deliveryMode === 'Sea' ? 'e.g. Paradise Island Jetty' : 'e.g. Staniel Cay Airstrip'}
                                                    value={islandLocation}
                                                    onChange={(e) => setIslandLocation(e.target.value)}
                                                    className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none font-bold transition-all placeholder:text-muted/40"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Custom vessel or aircraft (optional)</label>
                                                <input
                                                    type="text"
                                                    placeholder={deliveryMode === 'Sea' ? 'Named boat, tender, or special instructions' : 'Aircraft type, charter, or tail number'}
                                                    value={transportAssetCustom}
                                                    onChange={(e) => setTransportAssetCustom(e.target.value)}
                                                    className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none font-bold transition-all placeholder:text-muted/40"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <CustomDatePicker
                                        label="Order placement date"
                                        selectedDate={orderPlacementDate}
                                        onChange={(d) => setOrderPlacementDate(d)}
                                    />



                                    {isRetailPersonal && (
                                        <div className="p-4 rounded-2xl border border-accent/25 bg-accent/[0.06] space-y-3">
                                            <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Payment checkout</p>
                                            <p className="text-[10px] text-muted leading-relaxed">
                                                Personal orders are auto-charged immediately after order creation. Select funding source and confirm authorization.
                                            </p>
                                            <div className="grid w-full min-w-0 gap-2 [grid-template-columns:repeat(auto-fit,minmax(7.25rem,1fr))]">
                                                {[
                                                    { id: 'wallet', label: 'Wallet' },
                                                    { id: 'card', label: 'Card' },
                                                    { id: 'bank', label: 'Bank' },
                                                ].map((m) => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => setPaymentMethod(m.id)}
                                                        className={`w-full min-w-0 max-w-full min-h-[44px] box-border inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-normal text-center whitespace-normal leading-snug border transition-all break-words [overflow-wrap:anywhere] ${paymentMethod === m.id ? 'bg-accent text-black border-accent' : 'bg-white/[0.03] border-white/10 text-muted hover:text-white'}`}
                                                    >
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-border accent-accent mt-0.5"
                                                    checked={authorizeCharge}
                                                    onChange={(e) => setAuthorizeCharge(e.target.checked)}
                                                />
                                                <span className="text-[10px] text-secondary font-bold leading-relaxed">
                                                    I authorize immediate charge for this order total and understand payment is captured automatically once order is submitted.
                                                </span>
                                            </label>
                                        </div>
                                    )}

                                    {/* Delivery address required for catalog orders */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-accent uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <MapPin size={12} /> Pickup Location / Origin Address
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Enter pickup/origin address..."
                                            value={catalogPickupAddress}
                                            onChange={(e) => setCatalogPickupAddress(e.target.value)}
                                            className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none font-bold transition-all placeholder:text-muted/40"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-accent uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <MapPin size={12} /> Delivery Address *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Enter delivery address..."
                                            value={catalogDeliveryAddress}
                                            onChange={(e) => setCatalogDeliveryAddress(e.target.value)}
                                            className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none font-bold transition-all placeholder:text-muted/40"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-accent uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <MapPin size={12} /> Total Distance (km)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Distance auto-calculated..."
                                            value={catalogDistanceKm}
                                            onChange={(e) => setCatalogDistanceKm(e.target.value)}
                                            className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-accent focus:border-accent/50 outline-none font-black transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <FileText size={12} /> Delivery instructions (optional)
                                        </label>
                                        <textarea
                                            rows={3}
                                            placeholder="Gate codes, dock slip, contact on arrival, time windows…"
                                            value={deliveryInstructions}
                                            onChange={(e) => setDeliveryInstructions(e.target.value)}
                                            className="w-full bg-background border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-accent/50 outline-none font-bold transition-all placeholder:text-muted/40 resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Drawer Footer */}
                            <div className="p-6 border-t border-white/5 bg-sidebar shrink-0 space-y-4">
                                <div className="flex justify-between items-center bg-white/[0.03] p-5 rounded-3xl border border-white/5 shadow-inner">
                                    <div className="space-y-1">
                                        <span className="text-muted text-[9px] uppercase font-black tracking-[0.3em] ml-1">{isRetailPersonal ? 'Order total' : 'Manifest Valuation'}</span>
                                        <div className="flex items-center gap-1.5 text-success font-bold text-[10px] ml-1">
                                            <Zap size={10} className="fill-success" /> Items ${cartSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                        {tierDeliveryFee > 0 && (
                                            <div className="flex items-center gap-1.5 text-accent font-black text-[10px] mt-1 uppercase tracking-wide ml-1">
                                                <Truck size={10} /> Delivery ({catalogDistanceKm || '?'} km) ${tierDeliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        )}
                                        {transportExtraFee > 0 && (
                                            <div className="text-[10px] text-warning font-black mt-1 uppercase tracking-wide ml-1">
                                                + {deliveryMode} fee ${transportExtraFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-3xl font-black text-white tracking-tight">${estimatedGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleCheckout}
                                    disabled={cart.length === 0 || !String(catalogDeliveryAddress || '').trim() || (isRetailPersonal && !authorizeCharge)}
                                    className="w-full py-5 bg-accent text-black rounded-[1.8rem] font-black uppercase tracking-[0.3em] text-[11px] hover:shadow-[0_20px_40px_-10px_rgba(200,169,106,0.4)] transition-all disabled:opacity-20 active:scale-[0.98] flex items-center justify-center gap-4 group"
                                >
                                    {isRetailPersonal ? 'Place order & pay' : 'Confirm dispatch'} <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ClientStore;


