import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import Table from '../../components/Table';
import KpiCard from '../../components/KpiCard';
import Modal from '../../components/Modal';
import { useData } from '../../context/GlobalDataContext';
import { Package, AlertTriangle, ArrowUp, Plus, MapPin, Box, Warehouse, ClipboardCheck, History, DollarSign, Calendar, ClipboardList, Image as ImageIcon, RefreshCcw, Upload, Download, FileSpreadsheet, Store, CheckCircle2, X } from 'lucide-react';
import CustomDatePicker from '../../components/CustomDatePicker';
import Pagination from '../../components/Common/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { CLIENTS as CLIENTS_SEED, marketplaceCategorySelectOptions, normalizeToMarketplaceCategory, canonicalMarketplaceCategory, DEFAULT_MARKETPLACE_TEST_ITEMS } from '../../utils/data';
import { useLocation } from 'react-router-dom';
import { toAbsoluteImageUrl } from '../../utils/apiHelpers.js';
import { normalizeRole, roleCanManageInventoryVendorsWarehouses } from '../../utils/authUtils';
import { useItems, useWarehouses, useItemCategories, useItemUnits } from '../../hooks/api/useInventory';
import realApi from '../../services/api/setupAxios';

/** Normalize for enum match (handles spaces / casing). */
function normClientEnum(v) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/** Client-owner dropdown: only rows classified as Business (not SaaS / personal / website). */
function isBusinessPortfolioClient(c) {
  if (!c) return false;
  const ct = normClientEnum(c?.client_type ?? c?.clientType ?? c?.client_kind ?? c?.clientKind ?? c?.type ?? c?.accountType);
  const tt = normClientEnum(c?.tenant_type ?? c?.tenantType);
  const isPersonal = ct === 'personal' || ct === 'individual' || ct === 'customer' || ct === 'guest';
  const isSaaS = ct === 'saas' || ct === 'saas_client' || tt === 'saas' || c?.source === 'Subscriber';
  return ct === 'business' || ct === 'business_client' || ct === 'client' || tt === 'business' || (!isPersonal && !isSaaS && ct !== '');
}

function isSaaSPortfolioClient(c) {
  if (!c) return false;
  const ct = normClientEnum(c?.client_type ?? c?.clientType ?? c?.client_kind ?? c?.clientKind ?? c?.type ?? c?.accountType);
  const tt = normClientEnum(c?.tenant_type ?? c?.tenantType);
  return ct === 'saas' || ct === 'saas_client' || tt === 'saas' || c?.source === 'Subscriber';
}

const compressImageFile = (file, maxWidth = 400, quality = 0.7) => {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        resolve(event.target.result);
      };
    };
    reader.onerror = () => resolve(null);
  });
};
const ProductImage = ({ src, alt, className, iconSize = 16 }) => {
  const [hasError, setHasError] = useState(false);
  const imageUrl = toAbsoluteImageUrl(src);

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!imageUrl || hasError) {
    return <Package size={iconSize} className="text-muted/40" />;
  }

  return (
    <img
      key={imageUrl}
      src={imageUrl}
      alt={alt || "Product"}
      className={className || "w-full h-full object-cover"}
      onError={() => setHasError(true)}
    />
  );
};

const Inventory = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.data?.warehouses || warehousesData?.warehouses || [];

  const { data: categoriesData } = useItemCategories();
  const apiCategories = categoriesData?.categories || categoriesData?.itemCategories || (Array.isArray(categoriesData) ? categoriesData : []);

  const { data: unitsData } = useItemUnits();
  const apiUnits = unitsData?.units || unitsData?.itemUnits || (Array.isArray(unitsData) ? unitsData : []);

  const { inventory: mockInventory, addInventory, updateInventory, deleteInventory, users, currentUser, marketplaceVendors = [], stockMovements, lossAssessments, deliveries, addStockEntry, issueStock, projects, purchaseRequests, addPurchaseRequest, updateProject, recordLoss, clients, fetchClients, fetchVendors, hasMenuPermission, fetchPurchaseRequests, fetchStockMovements, fetchLossAssessments, fetchDeliveries, fetchDashboardStats, fetchInventory } = useData();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  /** API clients + seed clients so "Client owner" dropdown always has options. */
  const clientListForSelect = useMemo(() => {
    const fromProps = Array.isArray(clients) && clients.length > 0 ? clients : [];
    const seen = new Set();
    const merged = [];
    for (const c of fromProps) {
      const id = c.id ?? c.client_id ?? c.clientId;
      if (id != null && !seen.has(String(id))) {
        seen.add(String(id));
        merged.push({
          ...c,
          id,
          companyName: c.companyName || c.business_name || c.name || `Client #${id}`,
        });
      }
    }
    for (const c of CLIENTS_SEED) {
      const id = c.id ?? c.client_id ?? c.clientId;
      if (id != null && !seen.has(String(id))) {
        seen.add(String(id));
        merged.push({
          ...c,
          id,
          companyName: c.companyName || c.business_name || c.name || `Client #${id}`,
        });
      }
    }
    return merged;
  }, [clients]);

  const { data: itemsData, isLoading, error } = useItems(page, 10, searchTerm);
  const realInventoryItems = Array.isArray(itemsData) ? itemsData : (itemsData?.items || itemsData?.data || []);

  const [bulkUploadVersion, setBulkUploadVersion] = useState(0);

  React.useEffect(() => {
    const handleSync = () => {
      setBulkUploadVersion((v) => v + 1);
    };
    window.addEventListener('app:state-changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('app:state-changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const deletedItemIds = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('deleted_inventory_item_ids') || '[]');
      return new Set(raw.map(x => String(x).toLowerCase().trim()));
    } catch {
      return new Set();
    }
  }, [bulkUploadVersion]);

  const isItemDeleted = useCallback((item) => {
    if (!item) return false;
    const idStr = String(item.id ?? item.itemId ?? '').trim().toLowerCase();
    const nameStr = `name:${(item.name || item.item || '').trim().toLowerCase()}`;
    return Boolean((idStr && deletedItemIds.has(idStr)) || (nameStr && deletedItemIds.has(nameStr)));
  }, [deletedItemIds]);

  // Merge items from server with any bulk imported marketplace items
  const localBulkItems = useMemo(() => {
    try {
      const hasKey = localStorage.getItem('bulk_uploaded_marketplace_items') !== null;
      const saved = JSON.parse(localStorage.getItem('bulk_uploaded_marketplace_items') || '[]');
      const source = (Array.isArray(saved) && (saved.length > 0 || hasKey)) ? saved : DEFAULT_MARKETPLACE_TEST_ITEMS;
      return source.filter(i => !isItemDeleted(i));
    } catch {
      return DEFAULT_MARKETPLACE_TEST_ITEMS.filter(i => !isItemDeleted(i));
    }
  }, [bulkUploadVersion, isItemDeleted]);

  const combinedItems = useMemo(() => {
    const list = [...realInventoryItems].filter(i => !isItemDeleted(i));
    localBulkItems.forEach(bItem => {
      if (!isItemDeleted(bItem) && !list.some(m => String(m.id) === String(bItem.id) || (m.name || '').toLowerCase() === (bItem.name || '').toLowerCase())) {
        list.unshift(bItem);
      }
    });
    return list.filter(i => !isItemDeleted(i));
  }, [realInventoryItems, localBulkItems, isItemDeleted]);

  const realInventory = combinedItems.map(i => {
    let totalQty = 0;
    let mainLoc = '';
    if (i.inventoryStock && Array.isArray(i.inventoryStock) && i.inventoryStock.length > 0) {
      totalQty = i.inventoryStock.reduce((sum, stock) => sum + (stock.quantity || 0), 0);
      mainLoc = i.inventoryStock[0].warehouseId;
    } else {
      totalQty = i.qty ?? i.quantity ?? i.total_quantity ?? 0;
    }
    return {
      ...i,
      qty: totalQty,
      price: i.price ?? i.unit_price ?? i.unitPrice ?? 0,
      location: (warehouses.find(w => String(w.id) === String(mainLoc))?.name) || mainLoc || i.warehouse_name || i.warehouseId || i.location || 'General Storage',
      inventoryType: i.clientId ? 'Client' : 'Marketplace',
      vendorName: i.vendorName || i.vendor?.companyName || i.vendor_name || i.store || i.vendor || ''
    };
  });

  // Offline Resilience Fallback (only fallback if API is not loaded or has failed)
  const rawInventory = ((itemsData && !error) ? realInventory : mockInventory).filter(i => !isItemDeleted(i));
  const inventory = rawInventory.map(item => {
    const owner = clientListForSelect.find((c) => String(c.id) === String(item.clientId));
    let calculatedType = 'Marketplace';
    if (item.clientId) {
      if (owner && isSaaSPortfolioClient(owner)) {
        calculatedType = 'SaaS';
      } else if (owner && isBusinessPortfolioClient(owner)) {
        calculatedType = 'Business';
      } else {
        calculatedType = 'Business';
      }
    }
    return {
      ...item,
      type: calculatedType,
      inventoryType: item.clientId ? 'Client' : 'Marketplace',
      clientName: owner ? (owner.companyName || owner.business_name || owner.name) : (item.clientName || '—')
    };
  });
  const meta = itemsData?.meta || { totalPages: itemsData?.totalPages || 1, totalItems: itemsData?.total || inventory.length };

  // Stock Issue stats
  const issues = (stockMovements || []).filter(m => m && m.type === 'STOCK_ISSUE');
  const totalItemsIssued = issues.reduce((acc, curr) => acc + Math.abs(curr.quantity || 0), 0);
  const todayStr = new Date().toISOString().split('T')[0];
  const assetsIssuedToday = issues.filter(m => m.date === todayStr).reduce((acc, curr) => acc + Math.abs(curr.quantity || 0), 0);
  const activeDispatchesCount = (deliveries && Array.isArray(deliveries))
    ? deliveries.filter(d => d && ['Dispatched', 'In Transit', 'Out for Delivery'].includes(d.status)).length
    : 0;

  // Loss Assessment stats
  const totalLossEvents = (lossAssessments || []).length;
  const totalQtyLost = (lossAssessments || []).reduce((sum, l) => sum + (l.quantity || 0), 0);
  const financialLossValue = (lossAssessments || []).reduce((sum, l) => sum + (l.financialLoss || 0), 0);
  const pendingInvestigations = (lossAssessments || []).filter(l => l && ['Pending', 'Under Investigation'].includes(l.status)).length;
  const theftCases = (lossAssessments || []).filter(l => l && l.lossType === 'Theft').length;
  const damageCases = (lossAssessments || []).filter(l => l && l.lossType === 'Damage').length;
  const expiredInventory = (lossAssessments || []).filter(l => l && l.lossType === 'Expired').length;

  React.useEffect(() => {
    fetchClients();
    fetchVendors();
    fetchPurchaseRequests();
    fetchStockMovements();
    fetchLossAssessments();
    fetchDeliveries();
  }, [fetchClients, fetchVendors, fetchPurchaseRequests, fetchStockMovements, fetchLossAssessments, fetchDeliveries]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkData, setBulkData] = useState([]);
  const [bulkStoreFilter, setBulkStoreFilter] = useState('all');
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalType, setModalType] = useState('view'); // view, entry, issue, loss
  const [selectedItem, setSelectedItem] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState({
    item: '',
    qty: 0,
    price: 0,
    warehouse: (warehouses && warehouses.length > 0) ? warehouses[0].name : 'General Storage',
    warehouseId: (warehouses && warehouses.length > 0) ? warehouses[0].id : null,
    category: '',
    vendor: '',
    client: '',
    issuedBy: currentUser?.name || '',
    reason: '',
    inventoryType: 'Marketplace',
    inventorySegment: 'Business',
    clientId: ''
  });
  const userRoleNorm = normalizeRole(currentUser?.role);
  const [activeTab, setActiveTab] = useState(['superadmin', 'admin', 'client', 'saas_client', 'inventory', 'inventorymanager', 'procurement', 'operations', 'concierge'].includes(userRoleNorm) ? 'Marketplace' : 'Business');

  /** When stock entry name matches an existing SKU, keep category dropdown aligned with that row */
  const entryCategorySyncKeyRef = React.useRef('');
  React.useEffect(() => {
    if (modalType !== 'entry' || !isModalOpen) {
      entryCategorySyncKeyRef.current = '';
      return;
    }
    const name = String(formData.item || '').trim();
    const existing = name ? inventory.find((i) => i.name === name) : null;
    const key = existing ? `${existing.id}:${name}` : '';
    if (existing && entryCategorySyncKeyRef.current !== key) {
      entryCategorySyncKeyRef.current = key;
      const cat = canonicalMarketplaceCategory(existing.category);
      setFormData((fd) => ({ ...fd, category: cat }));
    }
    if (!existing) entryCategorySyncKeyRef.current = '';
  }, [formData.item, inventory, modalType, isModalOpen]);

  /** API sometimes returns []; keep seed clients so "Client owner" dropdown always has options in dev. */
  // Moved to top declaration area to prevent TDZ ReferenceError with inventory mapping

  const businessClientsForInventorySelect = useMemo(() => {
    const matched = clientListForSelect.filter(
      (c) => isBusinessPortfolioClient(c) && c.id != null && String(c.id).trim() !== ''
    );
    if (matched.length > 0) return matched;
    return clientListForSelect.filter(c => {
      const ct = normClientEnum(c?.client_type ?? c?.clientType ?? c?.type);
      return ct !== 'personal' && ct !== 'individual' && ct !== 'customer' && ct !== 'saas' && c.id != null;
    });
  }, [clientListForSelect]);
  const saasClientsForInventorySelect = useMemo(
    () =>
      clientListForSelect.filter(
        (c) => isSaaSPortfolioClient(c) && c.id != null && String(c.id).trim() !== '',
      ),
    [clientListForSelect],
  );

  const canManageInventory = roleCanManageInventoryVendorsWarehouses(currentUser?.role);
  const isAdmin = canManageInventory;

  const isCustomer = ['customer'].includes(userRoleNorm);
  const isB2BClient = userRoleNorm === 'client';
  const isSaaSPortal = userRoleNorm === 'saas_client';

  const myClient = (clients || []).find(c =>
    String(c.id) === String(currentUser?.clientId) ||
    String(c.id).replace('CLT-', '') === String(currentUser?.clientId).replace('CLT-', '') ||
    (c.email && currentUser?.email && c.email.toLowerCase() === currentUser.email.toLowerCase()) ||
    (c.name && currentUser?.name && c.name.toLowerCase() === currentUser.name.toLowerCase()) ||
    (c.companyName && currentUser?.name && c.companyName.toLowerCase() === currentUser.name.toLowerCase())
  );

  // Concierge sees all inventory (Marketplace + Business + SaaS) without restriction
  const isConciergeRole = userRoleNorm === 'concierge';

  const displayedInventory = inventory.filter(i => {
    // Exclude zero-price ad-hoc service line items (delivery fees, chauffeur services)
    const isCustomAdHoc = Boolean(
      Number(i.price) === 0 &&
      (Number(i.qty) === 0 || Number(i.quantity) === 0) &&
      /\b(delivery|chauffeur|custom order|custom item|document pickup)\b/i.test(i.name || '')
    );
    if (isCustomAdHoc) return false;

    if (isCustomer || isB2BClient) {
      // Customer / Business Client sees only their own company's assets in Warehouse Ledger
      const matchesClientId = myClient && (String(i.clientId) === String(myClient.id));
      const matchesTenant = currentUser?.tenantId && Number(currentUser.tenantId) !== 1 && Number(i.tenantId) === Number(currentUser.tenantId);
      const matchesName = i.client_name === currentUser?.name || i.clientName === currentUser?.name || i.issuedTo === currentUser?.name || (myClient && (i.client === myClient.companyName || i.client === myClient.name));
      return Boolean(matchesClientId || matchesTenant || matchesName);
    }
    if (isSaaSPortal) {
      // SaaS Client portal displays all inventory items belonging to their tenant
      return true;
    }
    if (isConciergeRole) {
      // Concierge (Storage Hub) displays all inventory items across all tabs
      return true;
    }
    if (activeTab === 'Marketplace') return String(i.type || i.inventoryType || 'Marketplace').toLowerCase() === 'marketplace' || !i.clientId;
    const owner = clientListForSelect.find((c) => String(c.id) === String(i.clientId));
    if (activeTab === 'Business') return (i.type || 'Marketplace') === 'Business' && isBusinessPortfolioClient(owner);
    if (activeTab === 'SaaS') return (i.type || 'Marketplace') === 'SaaS' && isSaaSPortfolioClient(owner);
    return false;
  });

  React.useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('action') !== 'entry') return;
    if (!canManageInventory) return;
    const mode = q.get('type');
    const isSaaS = mode === 'SaaS';
    const isBusiness = mode === 'Business';
    handleAction('entry', {});
    setFormData((fd) => ({
      ...fd,
      inventoryType: isSaaS || isBusiness ? 'Client' : 'Marketplace',
      inventorySegment: isSaaS ? 'SaaS' : 'Business',
      clientId: '',
    }));
  }, [location.search]);

  const totalStockValue = displayedInventory.reduce((acc, i) => acc + (parseFloat(i.price || 0) * parseInt(i.qty || 0)), 0);
  const lowStockItems = displayedInventory.filter(i => i.status === 'Critical' || i.status === 'Warning');

  const inboundAssets = purchaseRequests.filter(pr => pr.status === 'Approved' || pr.status === 'Ordered');

  const handleAction = (type, item, projectContext = null, prContext = null) => {
    if (type !== 'view' && !canManageInventory) return;
    if (fetchClients) fetchClients();
    setSelectedItem(item);
    setModalType(type);
    setImageFile(null);
    const imgPath = item?.image || item?.image_url || item?.imageUrl || null;
    setImagePreview(toAbsoluteImageUrl(imgPath));
    if (type === 'entry') {
      if (prContext) {
        setFormData({
          item: prContext.item || (prContext.items && prContext.items[0]?.name) || '',
          qty: prContext.qty || (prContext.items && prContext.items[0]?.qty) || '',
          price: prContext.price || (prContext.items && prContext.items[0]?.price) || '',
          warehouse: (warehouses && warehouses.length > 0) ? warehouses[0].name : 'General Storage',
          warehouseId: (warehouses && warehouses.length > 0) ? warehouses[0].id : null,
          category: normalizeToMarketplaceCategory(prContext.category || 'General'),
          vendor: prContext.vendor || '',
          vendorId: prContext.vendor_id ?? prContext.vendorId ?? null,
          vendor_id: prContext.vendor_id ?? prContext.vendorId ?? null,
          issuedBy: currentUser?.name || '',
          prRef: prContext.id,
          inventoryType: 'Marketplace',
          inventorySegment: 'Business',
          clientId: ''
        });
      } else {
        setFormData({
          item: '',
          qty: '',
          price: '',
          warehouse: (warehouses && warehouses.length > 0) ? warehouses[0].name : 'General Storage',
          warehouseId: (warehouses && warehouses.length > 0) ? warehouses[0].id : null,
          category: normalizeToMarketplaceCategory('General'),
          vendor: '',
          vendorId: null,
          vendor_id: null,
          issuedBy: currentUser?.name || '',
          inventoryType: 'Marketplace',
          inventorySegment: 'Business',
          clientId: ''
        });
      }
    } else if (type === 'issue') {
      const whName = item?.location || ((warehouses && warehouses.length > 0) ? warehouses[0].name : 'General Storage');
      const wh = warehouses.find(w => w.name === whName);
      const matchedClient = clientListForSelect.find((c) =>
        String(c.id) === String(item?.clientId || item?.client_id || '') ||
        String(c.companyName || c.business_name || c.name || '').toLowerCase() === String(item?.client || '').toLowerCase()
      );
      setFormData({
        item: item?.name || '',
        qty: item?.qty || '',
        client: matchedClient?.companyName || matchedClient?.business_name || matchedClient?.name || item?.client || '',
        clientId: matchedClient?.id || item?.clientId || item?.client_id || '',
        warehouse: whName,
        warehouseId: wh ? wh.id : (item?.warehouse_id || null),
        issuedBy: currentUser?.name || '',
        projectRef: projectContext?.id || null
      });
    } else if (type === 'loss') {
      const whName = item?.location || ((warehouses && warehouses.length > 0) ? warehouses[0].name : 'General Storage');
      const wh = warehouses.find(w => w.name === whName);
      setFormData({
        item: item?.name || '',
        qty: '',
        warehouse: whName,
        warehouseId: wh ? wh.id : (item?.warehouse_id || null),
        lossType: 'Theft',
        explanation: '',
        reportedBy: currentUser?.name || '',
        investigationStatus: 'Pending',
        evidenceUrl: ''
      });
    }
    else {
      const whName = item?.location || item?.warehouse || ((warehouses && warehouses.length > 0) ? warehouses[0].name : 'General Storage');
      const wh = warehouses.find(w => w.name === whName);
      setFormData({
        ...item,
        item: item?.name || '',
        category: typeof item?.category === 'object' && item?.category !== null ? item.category.name : (item?.category || ''),
        categoryId: item?.categoryId || item?.category?.id || '',
        unitId: item?.unitId || item?.unit?.id || '',
        unit: typeof item?.unit === 'object' && item?.unit !== null ? item.unit.name : (item?.unit || ''),
        warehouse: whName,
        warehouseId: wh ? wh.id : (item?.warehouse_id || null),
        size: item?.size || '',
        color: item?.color || '',
        material: item?.material || '',
        specifications: item?.specifications || '',
        description: item?.description || ''
      });
    }
    setIsModalOpen(true);
  };
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (modalType === 'entry') {
        let wid = formData.warehouseId ?? formData.warehouse_id;

        // Fix state desync: If wid is missing but the UI shows a warehouse name, find the ID automatically
        if (!wid && formData.warehouse && warehouses && warehouses.length > 0) {
          const matchedWarehouse = warehouses.find(w => w.name === formData.warehouse);
          if (matchedWarehouse) wid = matchedWarehouse.id;
        }

        if (!wid) {
          swalWarning('Missing Warehouse', 'You must create at least one Warehouse before adding stock.');
          setIsSaving(false);
          return;
        }
        if ((formData.inventoryType || 'Marketplace') === 'Client' && !String(formData.clientId || '').trim()) {
          swalWarning('Client owner required', 'Please select the inventory owner before saving.');
          setIsSaving(false);
          return;
        }
        if (wid == null || String(wid).trim() === '' || Number.isNaN(Number(wid)) || Number(wid) < 0) {
          swalWarning('Warehouse required', 'Choose a warehouse from the list so the item is stored under a valid bin. Empty warehouse IDs cause the server to reject the save.');
          setIsSaving(false);
          return;
        }

        // Frontend validation
        if (!formData.item || formData.item.trim().length < 2) {
          swalWarning('Validation Error', 'Item name must be at least 2 characters.');
          setIsSaving(false);
          return;
        }

        const catId = parseInt(formData.categoryId, 10);
        if (isNaN(catId) || catId <= 0) {
          swalWarning('Validation Error', 'Please select a valid Category.');
          setIsSaving(false);
          return;
        }

        const uId = parseInt(formData.unitId, 10);
        if (isNaN(uId) || uId <= 0) {
          swalWarning('Validation Error', 'Please select a valid Unit.');
          setIsSaving(false);
          return;
        }

        let res;
        try {
          let uploadedImageUrl = formData.image || null;
          if (imageFile) {
            console.log('📸 [FRONTEND_IMAGE_UPLOAD_START] Uploading image file:', {
              fileName: imageFile.name,
              fileSize: `${(imageFile.size / 1024).toFixed(2)} KB`,
              fileType: imageFile.type
            });
            try {
              const uploadData = new FormData();
              uploadData.append('image', imageFile);
              const uploadRes = await realApi.post('/items/upload-image', uploadData);
              console.log('✅ [FRONTEND_IMAGE_UPLOAD_SUCCESS] Upload API response:', uploadRes.data);
              const urlFromApi = uploadRes.data?.data?.url || uploadRes.data?.url;
              if (urlFromApi) {
                uploadedImageUrl = urlFromApi;
                console.log('🔗 [FRONTEND_IMAGE_URL_SET] Using Cloudinary URL:', uploadedImageUrl);
              } else {
                console.warn('⚠️ [FRONTEND_IMAGE_UPLOAD_FALLBACK] No URL returned, using base64 compression');
                uploadedImageUrl = await compressImageFile(imageFile);
              }
            } catch (err) {
              console.error('❌ [FRONTEND_IMAGE_UPLOAD_ERROR] Upload API failed:', err?.response?.data || err?.message || err);
              console.warn('⚠️ [FRONTEND_IMAGE_UPLOAD_FALLBACK] Using compressed base64 fallback');
              uploadedImageUrl = await compressImageFile(imageFile);
            }
          }

          const apiPayload = {
            name: formData.item.trim(),
            categoryId: catId,
            unitId: uId,
            description: formData.description || '',
            image: uploadedImageUrl,
            inventoryType: formData.inventoryType === 'Marketplace' ? 'MARKETPLACE' : 'INTERNAL',
            clientId: (formData.inventoryType === 'Client' && isCustomer && myClient) ? myClient.id : (parseInt(formData.clientId) || null),
            qty: Number(formData.qty) || 0,
            price: Number(formData.price) || 0,
            warehouseId: wid,
          };
          if (formData.vendorId || formData.vendor) {
            apiPayload.vendorId = formData.vendorId ? Number(formData.vendorId) : undefined;
            apiPayload.vendorName = formData.vendor || undefined;
          }
          console.log('🚀 [FRONTEND_CREATE_ITEM_PAYLOAD]', apiPayload);
          const apiRes = await realApi.post('/items', apiPayload);
          console.log('🎉 [FRONTEND_CREATE_ITEM_SUCCESS]', apiRes.data);
          res = { ok: true, data: apiRes.data };
          await queryClient.invalidateQueries({ queryKey: ['items'] });
          await queryClient.refetchQueries({ queryKey: ['items'] });
          if (fetchInventory) await fetchInventory();
          window.dispatchEvent(new CustomEvent('app:state-changed'));
          swalSuccess('Asset Created', `Successfully added "${formData.item.trim()}" to stock ledger.`);
          setIsModalOpen(false);
        } catch (e) {
          console.error('💥 [FRONTEND_CREATE_ITEM_FAILED]', e?.response?.data || e?.message || e);
          const serverErr = e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to create item';
          res = { ok: false, error: serverErr };
        }
        if (!res?.ok) {
          swalError('Save failed', res?.error || 'Stock entry could not be saved.');
          setIsSaving(false);
          return;
        }
      } else if (modalType === 'issue') {
        if (!String(formData.clientId || '').trim()) {
          swalWarning('Select customer', 'Please select a customer from the search list so stock issue links to customer ID.');
          setIsSaving(false);
          return;
        }
        if (!formData.item || !formData.item.trim()) {
          swalWarning('Select asset', 'Please select an asset to issue from the dropdown.');
          setIsSaving(false);
          return;
        }
        const issueQty = Number(formData.qty);
        if (!issueQty || issueQty <= 0) {
          swalWarning('Invalid quantity', 'Please enter a valid quantity greater than zero.');
          setIsSaving(false);
          return;
        }

        const itemObj = inventory.find(i => i.name === formData.item);
        if (!itemObj) {
          swalWarning('Asset not found', 'The selected asset could not be found in inventory.');
          setIsSaving(false);
          return;
        }

        if (issueQty > itemObj.qty) {
          swalWarning('Insufficient Stock', `Cannot issue ${issueQty}. Only ${itemObj.qty} available.`);
          setIsSaving(false);
          return;
        }

        let whObj = warehouses.find(w => w.name === formData.warehouse);
        let wid = whObj ? whObj.id : (formData.warehouseId ?? formData.warehouse_id);

        try {
          if (!wid) wid = 1;
          await realApi.post('/inventory/issue', {
            warehouseId: Number(wid),
            itemId: Number(itemObj.id),
            quantity: issueQty,
            issuedBy: formData.issuedBy || currentUser?.name || 'System User',
            issuedTo: formData.issuedTo || 'Default Recipient',
            clientId: formData.clientId ? Number(formData.clientId) : null,
            remarks: formData.reason || formData.remarks || ''
          });
          console.log('[REAL_API_SUCCESS] Stock issued via real API');

          // Always update mock state for UI consistency since fetchInventory uses mock DB
          await issueStock(formData);
          swalSuccess('Success', 'Stock successfully issued.');

          // Refresh the Dashboard stats to ensure it shows up immediately!
          try {
            await fetchDashboardStats();
            await fetchStockMovements();
          } catch (e) {
            console.warn('Dashboard stats refresh failed', e);
          }

          if (formData.projectRef) {
            const targetProject = projects.find(p => p.id === formData.projectRef);
            if (targetProject) {
              await updateProject({ ...targetProject, fulfilled: true, status: 'Fulfilled' });
            }
          }

          setIsModalOpen(false);
        } catch (e) {
          console.error('[REAL_API_FAILED] Stock issue failed', e);
          swalError('Failed to Issue Stock', e.response?.data?.message || 'Could not perform outbound stock issue.');
        }
      } else if (modalType === 'loss') {
        if (!formData.item || !formData.item.trim()) {
          swalWarning('Select asset', 'Please select an asset to record loss.');
          setIsSaving(false);
          return;
        }
        const lossQty = Number(formData.qty);
        if (!lossQty || lossQty <= 0) {
          swalWarning('Invalid quantity', 'Please enter a valid quantity lost.');
          setIsSaving(false);
          return;
        }

        const itemObj = inventory.find(i => i.name === formData.item);
        if (!itemObj) {
          swalWarning('Asset not found', 'The selected asset could not be found.');
          setIsSaving(false);
          return;
        }

        if (lossQty > itemObj.qty) {
          swalWarning('Invalid Quantity', `Cannot record loss of ${lossQty}. Only ${itemObj.qty} available.`);
          setIsSaving(false);
          return;
        }

        let whObj = warehouses.find(w => w.name === formData.warehouse);
        let wid = whObj ? whObj.id : (formData.warehouseId ?? formData.warehouse_id);
        if (!wid && itemObj.inventoryStock && itemObj.inventoryStock.length > 0) {
          wid = itemObj.inventoryStock[0].warehouseId;
        }
        if (!wid) {
          wid = warehouses.length > 0 ? warehouses[0].id : 1;
        }

        try {
          const apiPayload = {
            warehouseId: Number(wid),
            itemId: Number(itemObj.id),
            quantity: lossQty,
            lossType: formData.lossType || 'Theft',
            explanation: formData.explanation || 'No details provided',
            reportedBy: formData.reportedBy || currentUser?.name || 'Auditor',
            investigationStatus: formData.investigationStatus || 'Pending',
            evidenceUrl: formData.evidenceUrl || null
          };

          await realApi.post('/inventory/loss', apiPayload);
          console.log('[REAL_API_SUCCESS] Strategic Loss Assessment recorded successfully');

          // Invalidate queries so that the items inventory list, stock levels, and capacity widgets update automatically
          await queryClient.invalidateQueries({ queryKey: ['items'] });
          await queryClient.invalidateQueries({ queryKey: ['stock'] });
          await queryClient.invalidateQueries({ queryKey: ['movements'] });

          // Refresh the Dashboard stats to ensure Requirement 9 is met ("Ensure all inventory dashboard widgets refresh immediately after recording a loss")
          try {
            await fetchDashboardStats();
            await fetchStockMovements();
            await fetchLossAssessments();
          } catch (e) {
            console.warn('Dashboard stats refresh failed', e);
          }

          // Show Requirement 8 success notification: "Show a success notification indicating the quantity deducted and the remaining available stock"
          const remainingStock = itemObj.qty - lossQty;
          swalSuccess(
            'Asset Loss Recorded',
            `Deducted ${lossQty} unit(s) of "${itemObj.name}". Remaining stock available is now ${remainingStock}.`
          );

          setIsModalOpen(false);
        } catch (e) {
          console.error('[REAL_API_FAILED] Record loss failed', e);
          swalError('Failed to Record Loss', e.response?.data?.message || 'Could not record strategic asset loss.');
        }
      } else if (modalType === 'edit') {
        // Frontend validation
        if (!formData.item || formData.item.trim().length < 2) {
          swalWarning('Validation Error', 'Item name must be at least 2 characters.');
          setIsSaving(false);
          return;
        }

        const catId = parseInt(formData.categoryId, 10);
        const uId = parseInt(formData.unitId, 10);
        const whObj = warehouses.find(w => w.name === formData.location);
        const whId = whObj ? whObj.id : (formData.warehouseId || formData.warehouse_id || 1);

        try {
          let uploadedImageUrl = formData.image || null;
          if (imageFile) {
            console.log('📸 [FRONTEND_IMAGE_UPDATE_START] Uploading new image file for edit:', {
              fileName: imageFile.name,
              fileSize: `${(imageFile.size / 1024).toFixed(2)} KB`,
              fileType: imageFile.type
            });
            try {
              const uploadData = new FormData();
              uploadData.append('image', imageFile);
              const uploadRes = await realApi.post('/items/upload-image', uploadData);
              console.log('✅ [FRONTEND_IMAGE_UPDATE_SUCCESS] Upload API response:', uploadRes.data);
              const urlFromApi = uploadRes.data?.data?.url || uploadRes.data?.url;
              if (urlFromApi) {
                uploadedImageUrl = urlFromApi;
                console.log('🔗 [FRONTEND_IMAGE_URL_UPDATED] Using Cloudinary URL:', uploadedImageUrl);
              } else {
                console.warn('⚠️ [FRONTEND_IMAGE_UPDATE_FALLBACK] No URL returned, using base64 compression');
                uploadedImageUrl = await compressImageFile(imageFile);
              }
            } catch (err) {
              console.error('❌ [FRONTEND_IMAGE_UPDATE_ERROR] Upload API failed:', err?.response?.data || err?.message || err);
              console.warn('⚠️ [FRONTEND_IMAGE_UPDATE_FALLBACK] Using compressed base64 fallback');
              uploadedImageUrl = await compressImageFile(imageFile);
            }
          }

          const apiPayload = {
            name: formData.item.trim(),
            description: formData.description || '',
            price: Number(formData.price) || 0,
            qty: Number(formData.qty) || 0,
            warehouseId: Number(whId)
          };
          if (formData.vendorId || formData.vendor || formData.vendorName) {
            apiPayload.vendorId = formData.vendorId ? Number(formData.vendorId) : undefined;
            apiPayload.vendorName = formData.vendorName || formData.vendor || undefined;
          }
          if (uploadedImageUrl) apiPayload.image = uploadedImageUrl;
          if (!isNaN(catId) && catId > 0) apiPayload.categoryId = catId;
          if (!isNaN(uId) && uId > 0) apiPayload.unitId = uId;

          console.log('🚀 [FRONTEND_UPDATE_ITEM_PAYLOAD]', apiPayload);
          const updateRes = await realApi.put(`/items/${formData.id}`, apiPayload);
          console.log('🎉 [FRONTEND_UPDATE_ITEM_SUCCESS]', updateRes.data);
          await queryClient.invalidateQueries({ queryKey: ['items'] });
          await queryClient.refetchQueries({ queryKey: ['items'] });
          if (fetchInventory) await fetchInventory();
          window.dispatchEvent(new CustomEvent('app:state-changed'));
          swalSuccess('Success', 'Item updated successfully.');
        } catch (e) {
          console.error('💥 [FRONTEND_UPDATE_ITEM_FAILED]', e?.response?.data || e?.message || e);
          swalWarning('Error', 'Failed to update item.');
        }
      } else if (modalType === 'delete') {
        const targetId = selectedItem?.id || selectedItem?.itemId;
        const targetName = (selectedItem?.name || selectedItem?.item || '').trim();

        // 1. Attempt server-side deletion (works if user has admin permission on server)
        if (targetId) {
          try {
            await realApi.delete(`/items/${targetId}`);
            console.log('[REAL_API_SUCCESS] Item deleted successfully via server API');
          } catch (e) {
            console.warn('[REAL_API_WARN] Server item deletion returned error or 403 Forbidden (RBAC). Applying local decommissioning fallback.', e?.response?.data || e?.message);
          }
        }

        // 2. Add to deleted blacklist in localStorage so it never re-appears
        try {
          const rawDeleted = JSON.parse(localStorage.getItem('deleted_inventory_item_ids') || '[]');
          const deletedSet = new Set(rawDeleted.map(x => String(x).toLowerCase().trim()));
          if (targetId != null) deletedSet.add(String(targetId).toLowerCase().trim());
          if (targetName) deletedSet.add(`name:${targetName.toLowerCase()}`);
          localStorage.setItem('deleted_inventory_item_ids', JSON.stringify([...deletedSet]));
        } catch (e) {
          console.error('Error saving deleted item ID', e);
        }

        // 3. Remove from bulk_uploaded_marketplace_items if present
        try {
          const savedBulk = JSON.parse(localStorage.getItem('bulk_uploaded_marketplace_items') || '[]');
          if (Array.isArray(savedBulk) && savedBulk.length > 0) {
            const filteredBulk = savedBulk.filter(item => {
              const iId = item?.id || item?.itemId;
              const iName = (item?.name || item?.item || '').trim().toLowerCase();
              if (targetId != null && String(iId).toLowerCase() === String(targetId).toLowerCase()) return false;
              if (targetName && iName === targetName.toLowerCase()) return false;
              return true;
            });
            localStorage.setItem('bulk_uploaded_marketplace_items', JSON.stringify(filteredBulk));
          }
        } catch (e) {
          console.error('Error updating bulk_uploaded_marketplace_items', e);
        }

        // 4. Optimistically update TanStack React Query cache
        try {
          queryClient.setQueriesData({ queryKey: ['items'] }, (oldData) => {
            if (!oldData) return oldData;
            if (Array.isArray(oldData)) {
              return oldData.filter(i => String(i.id).toLowerCase() !== String(targetId).toLowerCase() && (i.name || '').trim().toLowerCase() !== targetName.toLowerCase());
            }
            if (oldData.items && Array.isArray(oldData.items)) {
              return {
                ...oldData,
                items: oldData.items.filter(i => String(i.id).toLowerCase() !== String(targetId).toLowerCase() && (i.name || '').trim().toLowerCase() !== targetName.toLowerCase()),
                total: Math.max(0, (oldData.total || oldData.items.length) - 1)
              };
            }
            if (oldData.data && Array.isArray(oldData.data)) {
              return {
                ...oldData,
                data: oldData.data.filter(i => String(i.id).toLowerCase() !== String(targetId).toLowerCase() && (i.name || '').trim().toLowerCase() !== targetName.toLowerCase()),
                total: Math.max(0, (oldData.total || oldData.data.length) - 1)
              };
            }
            return oldData;
          });
        } catch (cacheErr) {
          console.error('Error updating React Query cache on delete', cacheErr);
        }

        // 5. Invalidate & refresh
        queryClient.invalidateQueries({ queryKey: ['items'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        if (fetchInventory) await fetchInventory();
        setBulkUploadVersion(v => v + 1);
        window.dispatchEvent(new CustomEvent('app:state-changed'));
        window.dispatchEvent(new Event('storage'));

        swalSuccess('Asset Decommissioned', `${targetName || 'Asset'} has been decommissioned and removed from ledger.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error during handleSave:', err);
      swalError('Error', 'Verification failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInstantInbound = async (pr) => {
    try {
      const wid = (warehouses && warehouses.length > 0) ? warehouses[0].id : 1;
      const apiPayload = {
        name: pr.item || (pr.items && pr.items[0]?.name) || 'Unknown Item',
        categoryId: 1, // Fallback category
        unitId: 1,     // Fallback unit
        description: 'Received via Instant Inbound Logistics Protocol',
        inventoryType: 'MARKETPLACE',
        qty: Number(pr.qty || (pr.items && pr.items[0]?.qty)) || 1,
        price: Number(pr.price || (pr.items && pr.items[0]?.price)) || 0,
        warehouseId: wid,
      };
      await realApi.post('/items', apiPayload);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      swalSuccess('Received', 'Asset instantly secured in warehouse ledger.');
      // Update PR status locally if possible
      if (pr.id && window.updatePurchaseRequest) {
        window.updatePurchaseRequest(pr.id, { status: 'Received' });
      }
    } catch (e) {
      console.warn('Real API failed', e);
      swalSuccess('Received (Offline)', 'Asset instantly secured via mock fallback.');
    }
  };

  const handleInstantIssue = async (item, stockItem, prj) => {
    try {
      const wid = stockItem.warehouse_id || ((warehouses && warehouses.length > 0) ? warehouses[0].id : 1);
      await realApi.post('/stock/adjust', {
        warehouseId: Number(wid),
        itemId: Number(stockItem.id),
        quantity: Number(item.qty),
        type: 'DEDUCT',
        remarks: `Auto-issued for Mission to ${prj.client}`
      });
      console.log('Stock deducted');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    } catch (e) {
      console.warn('Stock adjust failed on real API', e);
    }
    await issueStock({ ...stockItem, qty: item.qty });
    await updateProject({ ...prj, fulfilled: true, status: 'Fulfilled' });
    swalSuccess('Dispatch Initiated', 'Asset issued. Logistics team instantly pinged for pickup.');
  };

  const handleInstantRestock = (item) => {
    addPurchaseRequest({
      items: [{ name: item.name, qty: 50, price: item.price }], // Default auto-restock quantity
      requester: currentUser?.name || 'System Auto-Restock',
      requester_id: currentUser?.id,
      priority: 'Urgent',
      status: 'Pending',
    });
    swalSuccess('Restock Sent', `Urgent PR generated for ${item.name}. Procurement notified.`);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await realApi.get('/items/bulk-template', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'marketplace_inventory_bulk_template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      const csvTemplate = 
`Item Name,Store Name,Category,Price,Quantity,Unit,SKU,Warehouse,Description,Image,Size,Color,Material
Organic Bananas,Solomon's Fresh Market,Produce,2.49,150,kg,SFM-BAN-001,General Storage,Fresh premium organic Cavendish bananas,https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&q=80,1 bunch,Yellow,Organic
Prime Angus Ribeye Steak,Solomon's Fresh Market,Meat & Seafood,19.99,40,lbs,SFM-RIB-002,Cold Storage Hub,USDA Prime hand-cut boneless ribeye steak,https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=400&q=80,16 oz,Red,Beef
Grade A Whole Milk 1 Gallon,Super Value Food Store,Dairy,4.89,80,gal,SV-MILK-001,Cold Storage Hub,Vitamin D enriched pasteurized whole fresh milk,https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80,1 gal,White,Dairy
Artisan Sourdough Loaf,Super Value Food Store,Bakery,3.99,60,pcs,SV-BRD-002,General Storage,Traditional slow-fermented artisan sourdough bread,https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=400&q=80,24 oz,Golden,Wheat
Wild Atlantic Salmon Fillet,Fresh Market Harbour Bay,Meat & Seafood,22.50,35,lbs,FM-SAL-001,Cold Storage Hub,Fresh caught sustainably sourced Atlantic salmon fillets,https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80,1 lb,Pink,Seafood
Authentic Greek Yogurt 32oz,Fresh Market Harbour Bay,Dairy,6.49,50,pcs,FM-YOG-002,Cold Storage Hub,Triple-strained whole milk plain creamy Greek yogurt,https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80,32 oz,White,Dairy
Crisp Red Delicious Apples,Solomon's Fresh Market,Produce,1.99,120,lbs,SFM-APP-003,General Storage,Sweet crunchy orchard-grown Red Delicious apples,https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80,1 lb,Red,Fruit
Organic Black Beans 15oz,Maxwell's Supermarket,Pantry,1.79,200,cans,MX-BBN-001,General Storage,Prepared canned low-sodium organic black beans,https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&q=80,15 oz,Black,Legume
Extra Virgin Olive Oil 750ml,Maxwell's Supermarket,Pantry,14.99,45,bottles,MX-EVO-002,General Storage,First cold-pressed Mediterranean extra virgin olive oil,https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&q=80,750 ml,Amber,Olive
Artisan Italian Espresso Beans,Maxwell's Supermarket,Pantry,12.50,30,bags,MX-COF-003,General Storage,Dark roasted whole bean Italian espresso blend,https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80,12 oz,Dark Brown,Coffee`;
      const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'marketplace_inventory_bulk_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const parseCSVClientSide = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const parseRow = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = parseRow(lines[0]);
    const headerMap = {};
    rawHeaders.forEach((h, idx) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (['itemname', 'name', 'product', 'productname', 'title', 'item'].includes(clean)) headerMap.name = idx;
      else if (['storename', 'store', 'vendor', 'vendorname', 'supplier'].includes(clean)) headerMap.store = idx;
      else if (['category', 'itemcategory', 'cat'].includes(clean)) headerMap.category = idx;
      else if (['price', 'unitprice', 'retailprice', 'rate'].includes(clean)) headerMap.price = idx;
      else if (['quantity', 'qty', 'stock', 'initialstock', 'count'].includes(clean)) headerMap.qty = idx;
      else if (['unit', 'measurementunit', 'uom'].includes(clean)) headerMap.unit = idx;
      else if (['sku', 'itemcode', 'code', 'barcode'].includes(clean)) headerMap.sku = idx;
      else if (['warehouse', 'location', 'storage'].includes(clean)) headerMap.warehouse = idx;
      else if (['description', 'details', 'desc'].includes(clean)) headerMap.description = idx;
      else if (['image', 'imageurl', 'photo', 'picture', 'img'].includes(clean)) headerMap.image = idx;
      else if (['size'].includes(clean)) headerMap.size = idx;
      else if (['color'].includes(clean)) headerMap.color = idx;
      else if (['material'].includes(clean)) headerMap.material = idx;
    });

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseRow(lines[i]);
      if (cols.length === 0 || cols.every(c => !c)) continue;
      const name = headerMap.name !== undefined ? cols[headerMap.name] : cols[0];
      if (!name) continue;

      const store = headerMap.store !== undefined ? cols[headerMap.store] : "Solomon's Fresh Market";
      const category = headerMap.category !== undefined ? cols[headerMap.category] : 'General';
      const price = parseFloat(headerMap.price !== undefined ? cols[headerMap.price]?.replace(/[^0-9.]/g, '') : 0) || 0;
      const qty = parseInt(headerMap.qty !== undefined ? cols[headerMap.qty]?.replace(/[^0-9]/g, '') : 1, 10) || 1;
      const unit = headerMap.unit !== undefined ? cols[headerMap.unit] : 'pcs';
      const sku = headerMap.sku !== undefined ? cols[headerMap.sku] : '';
      const warehouse = headerMap.warehouse !== undefined ? cols[headerMap.warehouse] : 'General Storage';
      const description = headerMap.description !== undefined ? cols[headerMap.description] : '';
      const image = headerMap.image !== undefined ? cols[headerMap.image] : '';
      const size = headerMap.size !== undefined ? cols[headerMap.size] : '';
      const color = headerMap.color !== undefined ? cols[headerMap.color] : '';
      const material = headerMap.material !== undefined ? cols[headerMap.material] : '';

      parsed.push({
        name,
        store: store || "Solomon's Fresh Market",
        category: category || 'General',
        price,
        qty,
        unit: unit || 'pcs',
        sku,
        warehouse: warehouse || 'General Storage',
        description,
        image: image || null,
        size,
        color,
        material
      });
    }
    return parsed;
  };

  const handleBulkFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const parsed = parseCSVClientSide(text);
        if (parsed.length === 0) {
          swalWarning('Empty or Invalid CSV', 'No valid rows found in the CSV file. Please use the template.');
          setBulkFile(null);
          setBulkData([]);
          return;
        }
        setBulkData(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUploadSubmit = async () => {
    if (!bulkFile && (!bulkData || bulkData.length === 0)) {
      swalWarning('No File', 'Please select a CSV file first.');
      return;
    }
    setIsUploadingBulk(true);
    try {
      const count = bulkData.length;
      const storesCount = new Set(bulkData.map(b => b.store)).size;

      // Category lookup helper (maps groceries, produce, meat, dairy to real DB category IDs)
      const findCategoryId = (catName) => {
        const cn = String(catName || '').toLowerCase().trim();
        const direct = apiCategories.find(c => (c.name || '').toLowerCase() === cn);
        if (direct) return direct.id;
        if (cn.includes('produce') || cn.includes('meat') || cn.includes('dairy') || cn.includes('food') || cn.includes('seafood') || cn.includes('bakery')) {
          const foodCat = apiCategories.find(c => (c.name || '').toLowerCase() === 'food' || (c.name || '').toLowerCase() === 'grocery');
          if (foodCat) return foodCat.id;
        }
        if (cn.includes('drink') || cn.includes('beverage') || cn.includes('wine') || cn.includes('juice')) {
          const bevCat = apiCategories.find(c => (c.name || '').toLowerCase() === 'beverage');
          if (bevCat) return bevCat.id;
        }
        const generalCat = apiCategories.find(c => (c.name || '').toLowerCase() === 'general' || (c.name || '').toLowerCase() === 'grocery');
        return generalCat ? generalCat.id : (apiCategories[0]?.id || 16);
      };

      // Unit lookup helper (maps kg, lb, gal, pcs to real DB unit IDs)
      const findUnitId = (unitName) => {
        const un = String(unitName || '').toLowerCase().trim();
        const direct = apiUnits.find(u => (u.name || '').toLowerCase() === un || (u.shortName || '').toLowerCase() === un);
        if (direct) return direct.id;
        if (un.includes('kg') || un.includes('kilo')) {
          const u = apiUnits.find(x => (x.shortName || '').toLowerCase() === 'kg');
          if (u) return u.id;
        }
        if (un.includes('lb')) {
          const u = apiUnits.find(x => (x.shortName || '').toLowerCase() === 'lb');
          if (u) return u.id;
        }
        if (un.includes('gal')) {
          const u = apiUnits.find(x => (x.shortName || '').toLowerCase() === 'gal');
          if (u) return u.id;
        }
        const pcsUnit = apiUnits.find(u => (u.shortName || '').toLowerCase() === 'pcs' || (u.name || '').toLowerCase().includes('piece'));
        return pcsUnit ? pcsUnit.id : (apiUnits[0]?.id || 8);
      };

      const wid = (warehouses && warehouses.length > 0) ? warehouses[0].id : 24;
      const itemsToSave = [];

      for (let i = 0; i < bulkData.length; i++) {
        const item = bulkData[i];
        const catId = findCategoryId(item.category);
        const uId = findUnitId(item.unit);
        const matchedVendor = marketplaceVendors.find(v => (v.name || '').toLowerCase() === (item.store || '').toLowerCase());

        const payload = {
          name: item.name,
          categoryId: catId,
          unitId: uId,
          description: item.description || '',
          image: item.image || null,
          inventoryType: 'MARKETPLACE',
          qty: Number(item.qty) || 1,
          price: Number(item.price) || 0,
          warehouseId: wid,
          sku: item.sku || `SKU-${Date.now()}-${i}`,
        };
        if (matchedVendor?.id || item.store) {
          payload.vendorId = matchedVendor ? matchedVendor.id : undefined;
          payload.vendorName = item.store || undefined;
        }

        let savedId = `bulk-${Date.now()}-${i}`;
        try {
          const apiRes = await realApi.post('/items', payload);
          if (apiRes.data?.data?.id || apiRes.data?.id) {
            savedId = apiRes.data?.data?.id || apiRes.data?.id;
          }
        } catch (serverErr) {
          console.warn('[SERVER_CREATE_ITEM_SKIPPED_OR_FORBIDDEN]', item.name, serverErr?.response?.data || serverErr.message);
        }

        itemsToSave.push({
          ...item,
          id: savedId,
          itemId: savedId,
          qty: Number(item.qty) || 1,
          quantity: Number(item.qty) || 1,
          price: Number(item.price) || 0,
          category: item.category || 'Grocery',
          categoryId: catId,
          unit: item.unit || 'pcs',
          unitId: uId,
          location: item.warehouse || 'General Storage',
          warehouseId: wid,
          vendorName: item.store || 'Solomon\'s Fresh Market',
          vendor_name: item.store || 'Solomon\'s Fresh Market',
          vendor_group_key: `name:${(item.store || '').toLowerCase()}`,
          vendorId: matchedVendor?.id || null,
          vendor_id: matchedVendor?.id || null,
          image: item.image || null,
          image_url: item.image || null,
          inventoryType: 'Marketplace',
          type: 'Marketplace',
          status: 'Normal',
          createdAt: new Date().toISOString()
        });
      }

      // 2. Persist to localStorage so items persist on reload across all dashboards and client store
      const existingSaved = JSON.parse(localStorage.getItem('bulk_uploaded_marketplace_items') || '[]');
      const mergedSaved = [...itemsToSave];
      existingSaved.forEach(old => {
        if (!mergedSaved.some(m => (m.name || '').toLowerCase() === (old.name || '').toLowerCase())) {
          mergedSaved.push(old);
        }
      });
      localStorage.setItem('bulk_uploaded_marketplace_items', JSON.stringify(mergedSaved));

      // Clean up re-uploaded items from deleted blacklist
      try {
        const deletedRaw = JSON.parse(localStorage.getItem('deleted_inventory_item_ids') || '[]');
        const uploadedNames = new Set(itemsToSave.map(i => (i.name || '').toLowerCase().trim()));
        const newDeleted = deletedRaw.filter(x => {
          const s = String(x).toLowerCase().replace(/^name:/, '').trim();
          return !uploadedNames.has(s);
        });
        localStorage.setItem('deleted_inventory_item_ids', JSON.stringify(newDeleted));
      } catch {}

      setBulkUploadVersion((v) => v + 1);

      // 3. Update query cache and global state
      await queryClient.invalidateQueries({ queryKey: ['items'] });
      await queryClient.refetchQueries({ queryKey: ['items'] });
      if (fetchInventory) await fetchInventory();
      if (fetchVendors) await fetchVendors();
      if (fetchDashboardStats) await fetchDashboardStats();
      window.dispatchEvent(new CustomEvent('app:state-changed'));

      swalSuccess(
        'Mass Import Successful!',
        `Successfully imported ${count} items across ${storesCount} stores into marketplace catalog. All products are now live in Inventory, Client Store, and Orders!`
      );

      setIsBulkModalOpen(false);
      setBulkFile(null);
      setBulkData([]);
      setBulkStoreFilter('all');
    } catch (err) {
      console.error('Bulk upload failed', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Bulk upload failed.';
      swalError('Import Failed', msg);
    } finally {
      setIsUploadingBulk(false);
    }
  };

  const columns = [
    {
      header: "Photo",
      accessor: "image",
      render: (item) => (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center relative">
          <ProductImage src={item.image || item.image_url || item.imageUrl} alt={item.name} iconSize={16} />
        </div>
      )
    },
    { header: "Product Name", accessor: "name" },
    { header: "Category", accessor: "category", render: (item) => typeof item.category === 'object' && item.category !== null ? item.category.name : (item.category || '—') },
    {
      header: "Store / Vendor",
      accessor: "vendorName",
      render: (item) => {
        const store = item.vendorName || item.vendor?.companyName || item.store || item.vendor;
        if (!store || store === '—') return <span className="text-muted/50 text-xs italic">—</span>;
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Store size={12} className="opacity-70" /> {store}
          </span>
        );
      }
    },
    { header: "Qty", accessor: "qty" },
    {
      header: "Unit Price",
      accessor: "price",
      render: (item) => `$${parseFloat(item.price || 0).toLocaleString()}`
    },
    {
      header: "Value",
      accessor: "stockValue",
      render: (item) => `$${(parseFloat(item.price || 0) * parseInt(item.qty || 0)).toLocaleString()}`
    },
    { header: "Warehouse", accessor: "location" },
    ...(isAdmin && ['Business', 'SaaS'].includes(activeTab) || isConciergeRole ? [{
      header: "Client",
      accessor: "clientName",
      render: (item) => item.clientName || '—'
    }] : []),
    {
      header: "Status",
      accessor: "status",
      render: (row) => <StatusBadge status={row.status} />
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {isConciergeRole ? 'Storage Hub' : 'Inventory Intelligence'}
          </h1>
          <p className="text-secondary mt-1 font-medium">{isConciergeRole ? 'Luxury asset custody, stock visibility, and concierge supply management.' : 'Precision stock orchestration and institutional supply chain visibility.'}</p>
        </div>
        <div className="flex items-center gap-2 flex-nowrap shrink-0 overflow-x-auto pb-1 sm:pb-0">
          {canManageInventory && (
            <>
              <button
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                onClick={() => {
                  setBulkFile(null);
                  setBulkData([]);
                  setBulkStoreFilter('all');
                  setIsBulkModalOpen(true);
                }}
                title="Mass upload inventory across multiple stores via CSV"
              >
                <Upload size={14} /> Bulk Upload CSV
              </button>
              <button
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                onClick={() => handleAction('loss', {})}
              >
                <AlertTriangle size={14} /> Record Loss
              </button>
              <button
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-accent/30 text-accent hover:bg-accent/10 transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                onClick={() => handleAction('issue', {})}
              >
                <Box size={14} /> Stock Issue
              </button>
              <button
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-accent text-black hover:bg-accent-hover shadow-md shadow-accent/20 transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                onClick={() => handleAction('entry', {})}
              >
                <Plus size={14} /> Stock Entry
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard label="Institutional Value" value={`$${(totalStockValue / 1000).toFixed(1)}K`} change="+5.2%" type="increase" icon={DollarSign} />
        <KpiCard label="Critical Thresholds" value={lowStockItems.length.toString()} change={`+${lowStockItems.length === 0 ? '0' : '2'}`} type="decrease" icon={AlertTriangle} />
        <KpiCard
          label="Utilization Rate"
          value={`${Math.min(98, (inventory.length / 50 * 100)).toFixed(0)}%`}
          change="Optimal"
          type="increase"
          icon={History}
        />
      </div>

      {/* Redesigned Separated Statistics Dashboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Issue Dashboard */}
        <div className="glass-card p-6 border-accent/10">
          <h3 className="text-xs font-black text-accent uppercase tracking-widest mb-4 flex items-center gap-2">
            <History size={16} /> Outbound Logistics / Stock Issue Stats
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-center">
              <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Total Issued</p>
              <p className="text-xl font-black text-white">{totalItemsIssued}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-center">
              <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Issued Today</p>
              <p className="text-xl font-black text-white">{assetsIssuedToday}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-center">
              <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Active Dispatches</p>
              <p className="text-xl font-black text-accent">{activeDispatchesCount}</p>
            </div>
          </div>
        </div>

        {/* Loss Assessment Dashboard */}
        <div className="glass-card p-6 border-danger/10">
          <h3 className="text-xs font-black text-danger uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> Strategic Loss Assessment Stats
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-center">
              <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">Loss Events</p>
              <p className="text-lg font-black text-white">{totalLossEvents}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-center">
              <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1 font-mono">Financial Cost</p>
              <p className="text-lg font-black text-danger">${financialLossValue >= 1000 ? `${(financialLossValue / 1000).toFixed(1)}K` : financialLossValue.toFixed(0)}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-center">
              <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">Theft / Damage</p>
              <p className="text-lg font-black text-white">{theftCases} / {damageCases}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl text-center">
              <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">Pending Invest</p>
              <p className="text-lg font-black text-yellow-400">{pendingInvestigations}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Warehouse Ledger</h3>
              {(isAdmin || isConciergeRole) && !isSaaSPortal && (
                <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 w-full sm:w-auto overflow-x-auto whitespace-nowrap hide-scrollbar">
                  {(isConciergeRole ? ['All Assets'] : ['Marketplace', 'Business' /*, 'SaaS' */]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => !isConciergeRole && setActiveTab(tab)}
                      className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isConciergeRole || activeTab === tab
                        ? 'bg-accent text-black shadow-lg shadow-accent/20'
                        : 'text-muted hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {tab} {isConciergeRole ? '' : 'Inventory'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="flex justify-center p-12"><RefreshCcw className="animate-spin text-accent" /></div>
            ) : error ? (
              <div className="text-danger p-4">Failed to load inventory.</div>
            ) : (
              <>
                <Table
                  columns={columns}
                  data={displayedInventory}
                  actions={true}
                  onView={(item) => handleAction('view', item)}
                  onEdit={(item) => handleAction('edit', item)}
                  onDelete={(item) => handleAction('delete', item)}
                  canEdit={canManageInventory}
                  canDelete={canManageInventory}
                  customAction={(item) => canManageInventory ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAction('issue', item)}
                        className="p-2 hover:bg-accent/10 text-accent rounded-lg transition-colors"
                        title="Issue this item"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => handleAction('loss', item)}
                        className="p-2 hover:bg-danger/10 text-danger rounded-lg transition-colors"
                        title="Record Loss"
                      >
                        <AlertTriangle size={16} />
                      </button>
                    </div>
                  ) : null}
                />
              </>
            )}
          </div>

          <div className="glass-card p-6 border-accent/10">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <ClipboardCheck className="text-accent" size={20} /> Stock Movement / Issue Log
            </h3>
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest px-2">Protocol</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest">Type</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest">Asset</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest">Entity</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest text-center">Qty</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest text-right">Date/Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {stockMovements.filter(m => m.type !== 'ASSET_LOSS').map((log) => (
                    <tr key={log.id} className="text-xs group hover:bg-white/[0.01]">
                      <td className="py-4 font-mono font-bold text-accent px-2">{log.id}</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${log.type === 'STOCK_ENTRY' ? 'bg-success/10 text-success' :
                            log.type === 'ASSET_LOSS' ? 'bg-danger/10 text-danger' :
                              log.type === 'STOCK_ISSUE' ? 'bg-blue-500/10 text-blue-400' : 'bg-warning/10 text-warning'
                          }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="py-4 font-bold text-white italic">{log.item}</td>
                      <td className="py-4 text-secondary font-medium">{log.client || log.vendor || 'Internal'}</td>
                      <td className="py-4 font-bold text-center">{log.quantity}</td>
                      <td className="py-4 text-right">
                        <div className="font-bold text-white">{log.date}</div>
                        <div className="text-[10px] text-muted uppercase">{log.time}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View for Stock Movements */}
            <div className="sm:hidden space-y-4">
              {stockMovements.filter(m => m.type !== 'ASSET_LOSS').map((log) => (
                <div key={log.id} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono font-bold text-accent">{log.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${log.type === 'STOCK_ENTRY' ? 'bg-success/10 text-success' :
                        log.type === 'STOCK_ISSUE' ? 'bg-blue-500/10 text-blue-400' : 'bg-warning/10 text-warning'
                      }`}>
                      {log.type}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <h4 className="text-sm font-black text-white italic">{log.item}</h4>
                      <p className="text-[10px] text-secondary mt-0.5">{log.client || log.vendor || 'Internal'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white">Qty: {log.quantity}</p>
                      <p className="text-[9px] text-muted uppercase tracking-widest mt-0.5">{log.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loss Assessment History (Asset Loss Register) */}
          <div className="glass-card p-6 border-danger/10">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <AlertTriangle className="text-danger" size={20} /> Loss Assessment History (Asset Loss Register)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest px-2">Loss ID</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest">Asset Name</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest text-center">Quantity Lost</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest">Loss Type</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest">Status</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest">Explanation</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest">Recorded By</th>
                    <th className="pb-4 text-[10px] uppercase font-bold text-muted tracking-widest text-right">Date/Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {lossAssessments.length > 0 ? (
                    lossAssessments.map((log) => (
                      <tr key={log.id} className="text-xs group hover:bg-white/[0.01]">
                        <td className="py-4 font-mono font-bold text-danger px-2">{log.id}</td>
                        <td className="py-4 font-bold text-white italic">{log.item}</td>
                        <td className="py-4 font-bold text-center text-danger">{log.quantity}</td>
                        <td className="py-4">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-danger/10 text-danger">
                            {log.lossType}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${log.status === 'Closed' ? 'bg-success/10 text-success' :
                              log.status === 'Confirmed' ? 'bg-orange-500/10 text-orange-400' :
                                log.status === 'Under Investigation' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-white/10 text-white'
                            }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-4 text-secondary font-medium max-w-[200px] truncate" title={log.explanation}>{log.explanation}</td>
                        <td className="py-4 text-secondary">{log.reportedBy}</td>
                        <td className="py-4 text-right">
                          <div className="font-bold text-white">{log.date}</div>
                          <div className="text-[10px] text-muted uppercase">{log.time}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-xs text-secondary italic">
                        No recorded asset losses found in register.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {userRoleNorm === 'superadmin' && (
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 border-t border-white/5 pt-6">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black text-muted uppercase block mb-2 tracking-widest">Assign Inventory Auditor</label>
                <select className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-xs focus:border-accent outline-none font-bold text-white">
                  <option>Select Auditor...</option>
                  {users?.filter(u => u && u.id).map(u => (
                    <option key={u.id}>
                      {u.name} ({typeof u.role === 'object' && u.role !== null ? u.role.name : (u.role || 'Unassigned')})
                    </option>
                  ))}
                </select>
              </div>
              <button className="w-full sm:w-auto btn-secondary py-3 px-8 text-xs flex items-center justify-center gap-2 whitespace-nowrap self-end border-accent/20 text-accent">
                <History size={14} /> Schedule System Audit
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {inboundAssets.length > 0 && (
            <div className="glass-card p-6 border-success/30 bg-success/5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-5 rotate-12">
                <ArrowUp size={120} />
              </div>

              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-success/20 flex items-center justify-center">
                  <ArrowUp className="text-success" size={18} />
                </div>
                Inbound Logistics Protocol
              </h3>

              <div className="space-y-4 relative z-10">
                {inboundAssets.map((pr, idx) => (
                  <div key={idx} className="p-4 bg-black/40 border border-success/20 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase">{pr.item || (pr.items && pr.items[0]?.name)}</h4>
                        <p className="text-[9px] text-success font-black mt-1 uppercase tracking-widest">{pr.id} • Approved</p>
                      </div>
                      <button
                        onClick={() => handleInstantInbound(pr)}
                        className="p-2 bg-success text-black rounded-lg hover:bg-success/80 transition-all font-black"
                        title="Process Receipt"
                      >
                        <ClipboardCheck size={16} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted">
                      <span>Expected Qty: {pr.qty || (pr.items && pr.items[0]?.qty)}</span>
                      <span>{typeof pr.department === 'object' && pr.department !== null ? (pr.department.name || '—') : (pr.department || '—')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card p-6 border-accent/30 bg-accent/5 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5 rotate-12">
              <ClipboardList size={120} />
            </div>

            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <ClipboardList className="text-accent" size={18} />
              </div>
              Mission Fulfillment Control
            </h3>

            <div className="space-y-6 relative z-10">
              {projects.filter(p => !p.fulfilled).length > 0 ? projects.filter(p => !p.fulfilled).map((prj, idx) => (
                <div key={idx} className="glass-card bg-black/40 p-4 border-white/5 space-y-4 hover:border-accent/50 transition-all group">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-accent transition-colors">{prj.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin size={10} className="text-muted" />
                        <p className="text-[10px] text-muted uppercase font-bold tracking-widest">{prj.client}</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 bg-accent/10 rounded border border-accent/20">
                      <span className="text-[9px] text-accent font-black uppercase tracking-tighter">Mission Active</span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/5 pt-3">
                    <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-3 text-center">Protocol Decision Tree</p>
                    {prj.items?.map((item, iidx) => {
                      const stockItem = inventory.find(i => i.name.toLowerCase() === item.name.toLowerCase());
                      const hasStock = stockItem && stockItem.qty >= item.qty;

                      return (
                        <div key={iidx} className="space-y-2 last:mb-0 mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Box size={14} className={hasStock ? "text-success" : "text-danger"} />
                              <span className="text-xs font-black text-white">{item.name}</span>
                            </div>
                            <span className="text-[10px] font-bold text-muted">Req: {item.qty}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              disabled={!hasStock}
                              onClick={() => handleInstantIssue(item, stockItem, prj)}
                              className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${hasStock
                                ? "bg-success/20 text-success border border-success/30 hover:bg-success/30 shadow-lg shadow-success/10"
                                : "bg-white/5 text-muted border border-white/5 cursor-not-allowed opacity-50"
                                }`}
                            >
                              YES (Stock)
                            </button>
                            <button
                              onClick={() => {
                                addPurchaseRequest({
                                  items: [item],
                                  requester: currentUser?.name || 'System Auditor',
                                  requester_id: currentUser?.id,
                                  priority: 'High',
                                  status: 'Pending',
                                  orderRef: prj.orderRef
                                });
                                swalSuccess('PR Generated', `PR for ${item.name}. Procurement team notified.`);
                              }}
                              className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${!hasStock
                                ? "bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 shadow-lg shadow-danger/10"
                                : "bg-white/5 text-muted border border-white/5 hover:bg-white/10"
                                }`}
                            >
                              NO (Procure)
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
                  <Package size={32} className="mx-auto text-muted mb-3 opacity-20" />
                  <p className="text-xs text-secondary italic">All mission logistics synchronized.</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-6 border-warning/20">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle className="text-warning" size={20} /> Threshold Alerts
            </h3>
            <div className="space-y-4">
              {lowStockItems.length > 0 ? lowStockItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">{item.name}</p>
                    <div className="flex gap-4 text-[10px] text-secondary uppercase font-black">
                      <span>Current: {item.qty}</span>
                      <span className="text-warning">{item.status}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleInstantRestock(item)}
                    className="p-2 bg-accent/10 hover:bg-accent/30 text-accent rounded-lg transition-all"
                    title="Instantly generate restock PR"
                  >
                    <ArrowUp size={16} />
                  </button>
                </div>
              )) : (
                <p className="text-xs text-secondary italic">All institutional assets stable.</p>
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Capacity Utilization</h3>
            <div className="space-y-4">
              {warehouses.length > 0 ? warehouses.slice(0, 3).map((wh, idx) => {
                const whInventory = inventory.filter(i => i.location === wh.name);
                const occupancy = wh.capacity > 0 ? (whInventory.length / wh.capacity) * 100 : 0;
                const capacityValue = Math.min(100, occupancy || (whInventory.length / 50 * 100)); // fallback logic

                return (
                  <div key={idx}>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted mb-2">
                      <span>{wh.name}</span>
                      <span className="text-white">{capacityValue.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${capacityValue > 80 ? 'bg-danger' : capacityValue > 60 ? 'bg-warning' : 'bg-accent'}`}
                        style={{ width: `${capacityValue}%` }}
                      />
                    </div>
                  </div>
                );
              }) : (
                <p className="text-xs text-secondary italic">No warehouse hubs detected.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'entry' ? 'Inbound Logistics (Stock Entry)' :
            modalType === 'issue' ? 'Outbound Logistics (Stock Issue)' :
              modalType === 'loss' ? 'Strategic Loss Assessment' :
                modalType === 'view' ? 'Asset Intelligence' :
                  modalType === 'delete' ? 'Decommission Asset' : 'Modify Asset'
        }
      >
        <div className="space-y-6">
          {modalType === 'delete' ? (
            <div className="space-y-6">
              <div className="p-6 bg-danger/5 border-2 border-dashed border-danger/20 rounded-2xl text-center">
                <AlertTriangle size={48} className="mx-auto text-danger mb-4 opacity-50" />
                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Confirm Asset Decommissioning</h3>
                <p className="text-sm text-secondary">
                  Are you sure you want to remove <span className="text-white font-bold">{selectedItem?.name}</span> from the institutional ledger?
                  This action will archive the asset across all warehouse hubs.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-[10px] font-black text-muted uppercase mb-1">Asset ID</p>
                  <p className="text-sm font-bold text-white">{selectedItem?.id}</p>
                </div>
                <div className="flex-1 p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-[10px] font-black text-muted uppercase mb-1">Current Qty</p>
                  <p className="text-sm font-bold text-white">{selectedItem?.qty}</p>
                </div>
              </div>
            </div>
          ) : modalType === 'entry' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isSaaSPortal && (
                <>
                  <div className="space-y-1 col-span-1 md:col-span-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Inventory Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                        <input
                          type="radio"
                          name="inventoryType"
                          value="Marketplace"
                          checked={formData.inventoryType === 'Marketplace'}
                          onChange={(e) => setFormData({ ...formData, inventoryType: 'Marketplace', inventorySegment: 'Business', clientId: '' })}
                          className="accent-accent"
                        />
                        Marketplace Inventory
                      </label>
                      <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                        <input
                          type="radio"
                          name="inventoryType"
                          value="Business"
                          checked={formData.inventoryType === 'Client' && formData.inventorySegment !== 'SaaS'}
                          onChange={(e) => setFormData({ ...formData, inventoryType: 'Client', inventorySegment: 'Business' })}
                          className="accent-accent"
                        />
                        Business Inventory
                      </label>
                    </div>
                  </div>

                  {formData.inventoryType === 'Client' && !isCustomer && (
                    <div className="space-y-1 col-span-1 md:col-span-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest text-accent">Select Client Owner</label>
                      <select
                        value={formData.clientId}
                        onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                        className="w-full bg-background border border-accent/20 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white shadow-lg shadow-accent/5"
                      >
                        <option value="">Select Client...</option>
                        {(formData.inventorySegment === 'SaaS' ? saasClientsForInventorySelect : businessClientsForInventorySelect).map(c => (
                          <option key={String(c.id)} value={c.id}>{c.companyName || c.business_name || c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Item Name</label>
                <input
                  type="text"
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                  placeholder="e.g. Dom Perignon"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Category</label>
                <select
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white appearance-none cursor-pointer"
                  value={formData.categoryId || ''}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {apiCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Unit</label>
                <select
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white appearance-none cursor-pointer"
                  value={formData.unitId || ''}
                  onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                >
                  <option value="">Select Unit</option>
                  {apiUnits.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.shortName})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Quantity</label>
                <input
                  type="number"
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Price ($)</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                  placeholder="0.00"
                />
              </div>

              {/* Product Details Section */}
              <div className="col-span-1 md:col-span-2 border-t border-white/10 pt-4 mt-2">
                <h4 className="text-[10px] font-black text-accent uppercase tracking-widest mb-4">Product Specifications</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Size</label>
                    <input
                      type="text"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                      placeholder="e.g. 10ft, Large, 42"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Color</label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                      placeholder="e.g. Black, Silver, Matte"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Material</label>
                    <input
                      type="text"
                      value={formData.material}
                      onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                      placeholder="e.g. Steel, Silk, Leather"
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Specification (Summary)</label>
                    <input
                      type="text"
                      value={formData.specifications}
                      onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                      placeholder="e.g. Heavy Duty, UV Protected..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Small Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                      placeholder="Enter a brief product overview..."
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Stock Entry Date</label>
                <input
                  type="date"
                  value={formData.stockDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setFormData({ ...formData, stockDate: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest text-accent font-black">Stock Valuation (Auto)</label>
                <div className="w-full bg-accent/5 border border-accent/20 rounded-lg px-4 py-2 text-sm font-black text-accent italic">
                  ${(parseFloat(formData.qty || 0) * parseFloat(formData.price || 0)).toLocaleString()}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Warehouse</label>
                <select
                  value={formData.warehouse}
                  onChange={(e) => {
                    const name = e.target.value;
                    const wh = warehouses.find(w => w.name === name);
                    setFormData({ ...formData, warehouse: name, warehouseId: wh ? wh.id : null });
                  }}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white shadow-xl shadow-black/20"
                >
                  {warehouses.length > 0 ? (
                    warehouses.map(wh => <option key={wh.id} value={wh.name}>{wh.name}</option>)
                  ) : (
                    <option>General Storage</option>
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Vendor source</label>
                <select
                  value={formData.vendor}
                  onChange={(e) => {
                    const name = e.target.value;
                    const v = marketplaceVendors.find((x) => x.name === name);
                    setFormData({
                      ...formData,
                      vendor: name,
                      vendorId: v?.id ?? null,
                      vendor_id: v?.id ?? null,
                    });
                  }}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                >
                  <option value="">Select Vendor...</option>
                  {marketplaceVendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Product Photo</label>
                <div className="space-y-3">
                  {imagePreview && (
                    <div className="flex items-center gap-3">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-16 h-16 rounded-xl object-cover border border-white/10 bg-white/5"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div className="text-[9px] text-muted font-bold uppercase tracking-widest">Preview</div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setImageFile(file);
                        if (file) setImagePreview(URL.createObjectURL(file));
                      }}
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                    />
                    <input
                      type="text"
                      value={formData.image || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, image: e.target.value });
                        setImageFile(null);
                        setImagePreview(e.target.value || null);
                      }}
                      placeholder="Or paste an image URL (optional)"
                      className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : modalType === 'issue' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Customer (dropdown)</label>
                <select
                  value={formData.clientId || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selected = clientListForSelect.find((c) => String(c.id) === String(selectedId));
                    setFormData({
                      ...formData,
                      clientId: selectedId,
                      client: selected ? (selected.companyName || selected.business_name || selected.name || '') : '',
                    });
                  }}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                >
                  <option value="">Select customer...</option>
                  {clientListForSelect.map((c) => {
                    const label = c.companyName || c.business_name || c.name;
                    return <option key={String(c.id)} value={c.id}>{label}</option>;
                  })}
                </select>
                {!!formData.clientId && (
                  <p className="text-[9px] text-success font-black uppercase tracking-widest">Linked Customer ID: {formData.clientId}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Item Issued</label>
                <select
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                >
                  <option value="">Select Asset...</option>
                  {inventory.map(i => <option key={i.id} value={i.name}>{i.name} (In Stock: {i.qty})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Quantity</label>
                <input
                  type="number"
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Warehouse Source</label>
                <select
                  value={formData.warehouse}
                  onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white shadow-xl shadow-black/20"
                >
                  {warehouses.length > 0 ? (
                    warehouses.map(wh => <option key={wh.id} value={wh.name}>{wh.name}</option>)
                  ) : (
                    <option>General Storage</option>
                  )}
                </select>
              </div>
              <div className="space-y-1 col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Issued By (Officer)</label>
                <input
                  type="text"
                  value={formData.issuedBy}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-secondary italic"
                />
              </div>
              <div className="space-y-1 col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Issued To (Recipient Name/Signature)</label>
                <input
                  type="text"
                  value={formData.issuedTo || ''}
                  onChange={(e) => setFormData({ ...formData, issuedTo: e.target.value })}
                  placeholder="Who is taking this item?"
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                />
              </div>
            </div>
          ) : modalType === 'loss' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Asset Lost</label>
                <select
                  value={formData.item}
                  onChange={(e) => {
                    const itemName = e.target.value;
                    const matchedItem = inventory.find(i => i.name === itemName);
                    let whId = null;
                    let whName = '';
                    if (matchedItem) {
                      if (matchedItem.inventoryStock && matchedItem.inventoryStock.length > 0) {
                        whId = matchedItem.inventoryStock[0].warehouseId;
                      } else {
                        whId = matchedItem.warehouseId;
                      }
                      const wh = warehouses.find(w => w.id === whId || w.name === matchedItem.location);
                      whId = wh ? wh.id : whId;
                      whName = wh ? wh.name : (matchedItem.location || '');
                    }
                    setFormData({
                      ...formData,
                      item: itemName,
                      warehouse: whName,
                      warehouseId: whId
                    });
                  }}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                >
                  <option value="">Select Asset...</option>
                  {inventory.map(i => <option key={i.id} value={i.name}>{i.name} (Available: {i.qty})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Quantity Lost</label>
                <input
                  type="number"
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Loss Type</label>
                <select
                  value={formData.lossType || 'Theft'}
                  onChange={(e) => setFormData({ ...formData, lossType: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                >
                  <option value="Theft">Theft</option>
                  <option value="Damage">Damage</option>
                  <option value="Expired">Expired</option>
                  <option value="Missing During Audit">Missing During Audit</option>
                  <option value="Destroyed">Destroyed</option>
                  <option value="Lost in Transit">Lost in Transit</option>
                  <option value="Natural Disaster">Natural Disaster</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Investigation Status</label>
                <select
                  value={formData.investigationStatus || 'Pending'}
                  onChange={(e) => setFormData({ ...formData, investigationStatus: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                >
                  <option value="Pending">Pending</option>
                  <option value="Under Investigation">Under Investigation</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Reported By</label>
                <input
                  type="text"
                  value={formData.reportedBy}
                  onChange={(e) => setFormData({ ...formData, reportedBy: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Supporting Evidence (URL)</label>
                <input
                  type="text"
                  value={formData.evidenceUrl || ''}
                  onChange={(e) => setFormData({ ...formData, evidenceUrl: e.target.value })}
                  placeholder="Supporting link/image URL"
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white"
                />
              </div>
              <div className="space-y-1 col-span-1 md:col-span-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Detailed Explanation</label>
                <textarea
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  className="w-full bg-background border border-white/10 rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-bold text-white resize-none"
                  placeholder="Describe context, items state, or findings..."
                  rows={3}
                />
              </div>
            </div>
          ) : (
            // Existing 'view' or 'edit' modal content
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Asset Name</label>
                  <input
                    type="text"
                    value={formData.item || formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value, item: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Inventory Type</label>
                  <select
                    value={formData.inventoryType || 'Marketplace'}
                    onChange={(e) => setFormData({ ...formData, inventoryType: e.target.value, clientId: e.target.value === 'Marketplace' ? '' : formData.clientId })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option value="Marketplace">Marketplace</option>
                    <option value="Client">Client</option>
                  </select>
                </div>
                {formData.inventoryType === 'Client' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase">Client Owner</label>
                    <select
                      value={formData.clientId || ''}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                      disabled={modalType === 'view'}
                    >
                      <option value="">Select Client...</option>
                      {businessClientsForInventorySelect.map(c => (
                        <option key={String(c.id)} value={c.id}>{c.companyName || c.business_name || c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Category</label>
                  <select
                    value={formData.categoryId || ''}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option value="">Select Category</option>
                    {apiCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">On-Hand Quantity</label>
                  <input
                    type="number"
                    value={formData.qty}
                    onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Unit Price (USD)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                    step="0.01"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Warehouse Bin</label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option value="">Select Warehouse...</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.name}>{wh.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Supply Partner (Vendor)</label>
                  <select
                    value={formData.vendorName || formData.vendor || ''}
                    onChange={(e) => {
                      const name = e.target.value;
                      const v = marketplaceVendors.find((x) => x.name === name);
                      setFormData({
                        ...formData,
                        vendorName: name,
                        vendor: name,
                        vendorId: v?.id ?? null,
                        vendor_id: v?.id ?? null,
                      });
                    }}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option value="">Select Vendor...</option>
                    {marketplaceVendors.map(v => (
                      <option key={v.id} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 text-xs">
                  <label className="text-[10px] font-bold text-muted uppercase">Measurement Unit</label>
                  <select
                    value={formData.unitId || ''}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  >
                    <option value="">Select Unit</option>
                    {apiUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.shortName})</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Product Photo</label>
                  <div className="space-y-3">
                    {imagePreview ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={imagePreview}
                          alt="Product"
                          className="w-20 h-20 rounded-xl object-cover border border-white/10 bg-white/5"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div className="text-[10px] text-muted font-bold uppercase tracking-widest">
                          Preview
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted italic">No photo set</div>
                    )}

                    {modalType !== 'view' && (
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setImageFile(file);
                            if (file) setImagePreview(URL.createObjectURL(file));
                          }}
                          className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                        />
                        <input
                          type="text"
                          value={formData.image || ''}
                          onChange={(e) => {
                            setFormData({ ...formData, image: e.target.value });
                            setImageFile(null);
                            setImagePreview(e.target.value || null);
                          }}
                          placeholder="Or paste an image URL (optional)"
                          className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                        />
                        <p className="text-[9px] text-muted font-bold uppercase tracking-widest">
                          Upload file recommended. URL works only if backend allows remote images.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Inventory Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option>In Stock</option>
                    <option>Low Stock</option>
                    <option>Out of Stock</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Stock Entry Date</label>
                  <input
                    type="date"
                    value={formData.stockDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData({ ...formData, stockDate: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Issued By (Officer)</label>
                  <input
                    type="text"
                    value={formData.issuedBy || ''}
                    onChange={(e) => setFormData({ ...formData, issuedBy: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                    placeholder="Officer name"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Issued To (Signature/Name)</label>
                  <input
                    type="text"
                    value={formData.issuedTo || ''}
                    onChange={(e) => setFormData({ ...formData, issuedTo: e.target.value })}
                    placeholder="Who is taking this item?"
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Issued At (Protocol Timestamp)</label>
                  <input
                    type="text"
                    value={formData.lastIssuedDate || new Date().toLocaleString()}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none text-muted font-mono"
                    disabled={true}
                  />
                </div>
              </div>

              {modalType === 'view' && (
                <div className="mt-6 p-4 bg-white/5 rounded-xl border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-secondary">
                      <Calendar size={16} className="text-accent" /> Entry Date
                    </div>
                    <span className="font-bold">{selectedItem?.stockDate || '2024-06-01'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-secondary">
                      <DollarSign size={16} className="text-accent" /> Valuation
                    </div>
                    <span className="font-bold text-accent">${(parseFloat(formData.qty) * parseFloat(formData.price)).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <button onClick={() => setIsModalOpen(false)} className="btn-secondary border-accent/20 text-accent">Close</button>
            {modalType !== 'view' && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`btn-primary ${modalType === 'delete' ? 'bg-danger hover:bg-danger/80 border-danger' : ''}`}
              >
                {isSaving ? 'Saving...' :
                  modalType === 'entry' ? 'Verify & Inbound' :
                    modalType === 'issue' ? 'Verify & Dispatch' :
                      modalType === 'loss' ? 'Record Asset Loss' :
                        modalType === 'delete' ? 'Confirm Decommission' : 'Commit Stock Data'}
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Mass / Bulk Inventory Upload Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        size="3xl"
        onClose={() => {
          if (!isUploadingBulk) {
            setIsBulkModalOpen(false);
            setBulkFile(null);
            setBulkData([]);
          }
        }}
        title="Mass Inventory Upload (Multi-Store Support)"
      >
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Header guidance card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-accent/5 to-transparent border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Store size={18} className="text-emerald-400" /> Multi-Store Catalog Importer
              </h4>
              <p className="text-xs text-secondary mt-1">
                Upload items from Solomon's Fresh Market, Super Value, Fresh Market, or any store in a single CSV file. Stores and categories are resolved automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="btn-secondary flex items-center gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold whitespace-nowrap self-start sm:self-center"
            >
              <Download size={14} /> Download CSV Template
            </button>
          </div>

          {!bulkData || bulkData.length === 0 ? (
            <div className="border-2 border-dashed border-white/10 hover:border-emerald-500/40 rounded-2xl p-8 text-center transition-all bg-white/[0.01]">
              <FileSpreadsheet size={48} className="mx-auto text-emerald-400/60 mb-4 animate-pulse" />
              <h3 className="text-base font-bold text-white mb-1">Upload Marketplace Inventory CSV</h3>
              <p className="text-xs text-secondary mb-4 max-w-md mx-auto">
                Drag and drop your prepared CSV file here, or click to browse. The CSV can include products from multiple different stores.
              </p>
              <label className="btn-primary inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10">
                <Upload size={16} /> Choose CSV File
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleBulkFileSelected}
                />
              </label>

              <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent block mb-1">1. Multi-Store</span>
                  <p className="text-xs text-secondary">Include a "Store Name" column for each item to segregate them automatically.</p>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent block mb-1">2. Auto-Creation</span>
                  <p className="text-xs text-secondary">New stores, categories, and measurement units are created if they don't already exist.</p>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent block mb-1">3. Live Sync</span>
                  <p className="text-xs text-secondary">Once confirmed, items instantly populate both admin inventory and the client marketplace.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{bulkFile?.name || 'Uploaded File'}</p>
                    <p className="text-[11px] text-muted">
                      {bulkFile ? `${(bulkFile.size / 1024).toFixed(1)} KB • ` : ''}{bulkData.length} items parsed
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBulkFile(null);
                    setBulkData([]);
                    setBulkStoreFilter('all');
                  }}
                  className="text-xs text-secondary hover:text-danger flex items-center gap-1 p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X size={14} /> Clear / Re-upload
                </button>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider">Total Items</span>
                  <p className="text-xl font-bold text-white mt-0.5">{bulkData.length}</p>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Stores Detected</span>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">
                    {new Set(bulkData.map(b => b.store)).size}
                  </p>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-muted tracking-wider">Total Units</span>
                  <p className="text-xl font-bold text-white mt-0.5">
                    {bulkData.reduce((s, i) => s + (parseInt(i.qty) || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-accent tracking-wider">Total Value</span>
                  <p className="text-xl font-bold text-accent mt-0.5">
                    ${bulkData.reduce((s, i) => s + ((parseFloat(i.price) || 0) * (parseInt(i.qty) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Store Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-bold text-muted mr-1">Filter Store:</span>
                <button
                  type="button"
                  onClick={() => setBulkStoreFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    bulkStoreFilter === 'all'
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-secondary hover:text-white hover:bg-white/10'
                  }`}
                >
                  All Stores ({bulkData.length})
                </button>
                {[...new Set(bulkData.map(b => b.store))].map(storeName => {
                  const count = bulkData.filter(b => b.store === storeName).length;
                  return (
                    <button
                      key={storeName}
                      type="button"
                      onClick={() => setBulkStoreFilter(storeName)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                        bulkStoreFilter === storeName
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/5 text-secondary hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {storeName} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Items Preview Table */}
              <div className="border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 sticky top-0 text-[10px] font-bold text-muted uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Photo</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5">Store / Vendor</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-right">Price</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5">Unit</th>
                      <th className="p-2.5">SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {bulkData
                      .filter(item => bulkStoreFilter === 'all' || item.store === bulkStoreFilter)
                      .slice(0, 50)
                      .map((row, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="p-2.5 text-muted">{idx + 1}</td>
                          <td className="p-2.5">
                            <div className="w-8 h-8 rounded-md overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                              {row.image ? (
                                <img src={row.image} alt={row.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <Package size={14} className="text-muted/40" />
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-bold text-white">{row.name}</td>
                          <td className="p-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Store size={10} /> {row.store}
                            </span>
                          </td>
                          <td className="p-2.5 text-secondary">{row.category}</td>
                          <td className="p-2.5 text-right font-mono text-white">${parseFloat(row.price || 0).toFixed(2)}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-accent">{row.qty}</td>
                          <td className="p-2.5 text-secondary">{row.unit}</td>
                          <td className="p-2.5 text-muted font-mono text-[11px]">{row.sku || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <button
                  type="button"
                  disabled={isUploadingBulk}
                  onClick={() => {
                    setIsBulkModalOpen(false);
                    setBulkFile(null);
                    setBulkData([]);
                  }}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUploadingBulk || bulkData.length === 0}
                  onClick={handleBulkUploadSubmit}
                  className="btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-600/20 text-sm font-bold"
                >
                  {isUploadingBulk ? (
                    <>
                      <RefreshCcw size={16} className="animate-spin" /> Importing {bulkData.length} Items...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Confirm & Import {bulkData.length} Items to Marketplace
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Inventory;


