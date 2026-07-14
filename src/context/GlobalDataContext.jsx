import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api/setupAxios.js";
import { io } from "socket.io-client";
import {
  normalizeRole,
  roleCanCreateInstitutionalOrder,
  roleCanUpdateOrderStatus,
  vendorVisibleInSharedLists,
  menuPathGrantsAccess,
} from "../utils/authUtils";
import { swalInfo, swalSuccess, swalError } from "../utils/swal";
import {
  isoDateSlice,
  localDateISO,
  normalizeOrderStatusForApi,
  displayOrderStatus,
} from "../utils/orderWorkflow";
import {
  canonicalMarketplaceCategory,
  PERSONAL_MEMBERSHIP_FEE_USD,
} from "../utils/constants";
import { INVENTORY, VENDORS, ACCESS_PLANS } from "../utils/data";

const GlobalDataContext = createContext();

/** Shallow merge: overlay keys only if value !== undefined (keeps false / 0 / ''). */
function mergeUserFields(base, ...overlays) {
  const out = { ...(base && typeof base === "object" ? base : {}) };
  for (const o of overlays) {
    if (!o || typeof o !== "object") continue;
    for (const [k, v] of Object.entries(o)) {
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}

function withoutPassword(obj) {
  if (!obj || typeof obj !== "object") return {};
  const { password, password_confirm, current_password, ...rest } = obj;
  return rest;
}

function normalizeCompanyIdForApi(value) {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric) && numeric > 0)
    return numeric;
  return undefined;
}

/** First usable image URL from GET /inventory row (snake/camel + common aliases). */
function inventoryImageFromApiRow(i) {
  if (!i || typeof i !== "object") return "";
  const candidates = [
    i.image_url,
    i.imageUrl,
    i.image,
    i.photo_url,
    i.photoUrl,
    i.photo,
    i.product_image,
    i.productImage,
    i.picture_url,
    i.pictureUrl,
    i.thumbnail_url,
    i.thumbnailUrl,
    i.media_url,
    i.mediaUrl,
    i.cover_image,
    i.coverImage,
    Array.isArray(i.images) && i.images[0]
      ? typeof i.images[0] === "string"
        ? i.images[0]
        : i.images[0]?.url
      : null,
  ];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    if (typeof c === "string") return c;
    if (typeof c === "object" && typeof c.url === "string") return c.url;
  }
  return "";
}

/** POST/PUT inventory: treat 2xx + body as success when `success` flag is omitted (some APIs only return `data`). */
function inventoryWriteResponseOk(res) {
  if (!res || res.status < 200 || res.status >= 300) return false;
  if (res.data?.success === false) return false;
  if (res.data?.success === true) return true;
  const payload = res.data?.data ?? res.data;
  if (payload == null) return false;
  if (typeof payload !== "object" || Array.isArray(payload)) return true;
  return Object.keys(payload).length > 0;
}

/** Multipart inventory: only append FK fields when they are positive integers — `warehouse_id=""` often causes DB 500s. */
function appendInventoryFk(formData, key, raw) {
  if (raw === undefined || raw === null) return;
  const s = String(raw).trim();
  if (s === "" || s === "undefined" || s === "null") return;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return;
  formData.append(key, String(Math.trunc(n)));
}

function nullablePositiveInt(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "" || s === "undefined" || s === "null") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

/** Many inventory INSERTs require `company_id`; superadmin often has none — fall back to env or HQ `1`. */
function resolveInventoryCompanyId(user, rowCompanyId) {
  const fromRow = normalizeCompanyIdForApi(rowCompanyId);
  if (fromRow != null) return fromRow;
  const fromUser = normalizeCompanyIdForApi(
    user?.company_id ?? user?.companyId,
  );
  if (fromUser != null) return fromUser;
  const env = Number(import.meta.env?.VITE_DEFAULT_COMPANY_ID);
  if (Number.isFinite(env) && env > 0) return env;
  return 1;
}

function normalizeApiUserPayload(data) {
  if (!data || typeof data !== "object") return null;
  if (data.user && typeof data.user === "object") return data.user;
  if (Array.isArray(data))
    return data[0] && typeof data[0] === "object" ? data[0] : null;
  return data;
}

function normalizeUserForUi(user) {
  if (!user || typeof user !== "object") return user;
  const bankName =
    user.bank_name ?? user.bankName ?? user.bankingInfo?.bank ?? "";
  const accountNumber =
    user.account_number ??
    user.accountNumber ??
    user.bankingInfo?.account ??
    "";
  const routingNumber =
    user.routing_number ??
    user.routingNumber ??
    user.bankingInfo?.routing ??
    "";
  const vacationBalance = user.vacation_balance ?? user.vacationBalance ?? 0;
  return {
    ...user,
    bank_name: bankName,
    bankName,
    account_number: accountNumber,
    accountNumber,
    routing_number: routingNumber,
    routingNumber,
    vacation_balance: vacationBalance,
    vacationBalance,
    bankingInfo: {
      ...(user.bankingInfo || {}),
      bank: bankName,
      account: accountNumber,
      routing: routingNumber,
      method: user.bankingInfo?.method || "Direct Deposit",
    },
  };
}

/** API route id: numeric or first digits from VND-123 style. */
function poNumericId(id) {
  if (id == null || id === "") return "";
  const s = String(id).trim();
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/(\d+)/);
  return m ? m[1] : s;
}

function quotePathId(id) {
  return poNumericId(id);
}

/** Backend may return [] or wrap rows in { clients, items, data }. */
function normalizeClientsResponseBody(body) {
  if (body == null) return [];
  if (Array.isArray(body)) return body;
  if (typeof body !== "object") return [];
  if (Array.isArray(body.data)) return body.data;
  for (const k of ["clients", "items", "records", "results", "rows"]) {
    if (Array.isArray(body[k])) return body[k];
  }
  return [];
}

function mapClientFromApi(c) {
  if (!c || typeof c !== "object") return null;
  const roleRaw = String(c.role || c.user_role || "")
    .trim()
    .toLowerCase();
  const clientTypeRaw =
    c.client_type ??
    c.clientType ??
    c.client_kind ??
    c.clientKind ??
    c.account_type ??
    c.accountType ??
    (roleRaw === "saas_client" ? "SaaS" : null) ??
    (roleRaw === "client" ? "Business" : null) ??
    (roleRaw === "customer" ? "Personal" : null) ??
    null;
  const tenantTypeRaw = c.tenant_type ?? c.tenantType ?? c.tenant ?? null;
  return {
    ...c,
    companyName: c.business_name || c.companyName || c.name,
    location: c.location || c.address || "",
    address: c.address || c.location || "",
    client_type: clientTypeRaw ?? c.client_type,
    clientType: c.clientType ?? clientTypeRaw,
    tenant_type: tenantTypeRaw ?? c.tenant_type,
    tenantType: c.tenantType ?? tenantTypeRaw,
  };
}

function normalizeClientTypeValue(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (
    raw === "saas" ||
    raw === "saas_client" ||
    raw === "saas client" ||
    raw === "subscription"
  )
    return "SaaS";
  if (
    raw === "business" ||
    raw === "client" ||
    raw === "business_client" ||
    raw === "business client"
  )
    return "Business";
  if (
    raw === "personal" ||
    raw === "customer" ||
    raw === "individual" ||
    raw === "direct"
  )
    return "Personal";
  return String(value || "").trim();
}

function clientMatchesTypeFilter(client, requestedType) {
  if (!requestedType) return true;
  const desired = normalizeClientTypeValue(requestedType);
  const actual = normalizeClientTypeValue(
    client?.client_type ??
    client?.clientType ??
    client?.account_type ??
    client?.accountType ??
    client?.role ??
    client?.user_role ??
    (String(client?.plan || "").toLowerCase() !== "free" &&
      String(client?.plan || "").trim()
      ? "saas"
      : ""),
  );
  if (!desired) return true;
  return desired.toLowerCase() === actual.toLowerCase();
}

function vendorPathId(id) {
  if (id == null || id === "") return "";
  const s = String(id).trim();
  if (/^\d+$/.test(s)) return s;
  const rest = s.replace(/^VND-?/i, "");
  if (/^\d+$/.test(rest)) return rest;
  const m = s.match(/(\d+)/);
  return m ? m[1] : s;
}

function buildVendorApiBody(vendor, companyId) {
  const name = String(
    vendor.name ||
    vendor.vendor_name ||
    vendor.business_name ||
    vendor.company_name ||
    "",
  ).trim();
  if (!name) {
    const err = new Error("Vendor name is required.");
    err.code = "VALIDATION";
    throw err;
  }
  // Edit form writes `contact`; prefer it over stale API-backed contact_name/contact_person.
  const contactName = (
    vendor.contact ||
    vendor.contact_name ||
    vendor.contactPerson ||
    ""
  ).trim();
  const body = {
    name,
    // Some backends only read vendor_name for the directory label
    vendor_name: name,
    email: (vendor.email || "").trim() || undefined,
    phone: (vendor.phone || "").trim() || undefined,
    category: (vendor.category || "").trim() || undefined,
    address: (vendor.address || "").trim() || undefined,
  };
  if (contactName) {
    body.contact_name = contactName;
    body.contact_person = contactName;
  }

  const r = vendor.rating;
  const d = vendor.delivery;
  if (r !== "" && r != null && !Number.isNaN(Number(r))) {
    body.rating = Math.min(100, Math.max(0, Math.round(Number(r))));
  }
  if (d !== "" && d != null && !Number.isNaN(Number(d))) {
    body.delivery = Math.min(100, Math.max(0, Math.round(Number(d))));
  }

  if (companyId != null && companyId !== "") {
    const n = Number(companyId);
    body.company_id = Number.isFinite(n) && !Number.isNaN(n) ? n : companyId;
  }

  const st = String(vendor.status || "").toLowerCase();
  if (["active", "inactive", "blacklisted"].includes(st)) {
    body.status = st;
  }

  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * API rows: only explicit status strings (or numeric 0/1) count as active/inactive.
 * We do not treat bare `is_active: true` as marketplace-approved — many backends default it on INSERT;
 * HQ workflow requires an explicit `status: active` (or equivalent string) from the API.
 */
function mapVendorStatusFromApi(v) {
  if (!v || typeof v !== "object") return "inactive";
  const raw = v.status ?? v.vendor_status ?? v.approval_status ?? v.state;
  if (raw != null && String(raw).trim() !== "") {
    const s = String(raw).trim().toLowerCase();
    if (["active", "inactive", "blacklisted"].includes(s)) return s;
    if (
      s === "pending" ||
      s === "awaiting_approval" ||
      s === "awaitingapproval"
    )
      return "inactive";
    if (s === "1" || s === "true") return "active";
    if (s === "0" || s === "false") return "inactive";
    return "inactive";
  }
  const ia = v.is_active ?? v.isActive ?? v.active;
  if (
    ia === 0 ||
    ia === false ||
    ia === "0" ||
    String(ia).toLowerCase() === "false"
  )
    return "inactive";
  return "inactive";
}

/** POST /vendors response shapes vary — extract the created row for follow-up PUT. */
function normalizeVendorCreateResponse(resBody) {
  if (resBody == null || typeof resBody !== "object") return null;
  const payload = Object.prototype.hasOwnProperty.call(resBody, "data")
    ? resBody.data
    : resBody;
  if (payload == null) return null;
  if (Array.isArray(payload)) {
    const row = payload[0];
    return row && typeof row === "object" ? row : null;
  }
  if (typeof payload === "object") {
    if (payload.vendor && typeof payload.vendor === "object")
      return payload.vendor;
    if (payload.id != null) return payload;
  }
  return null;
}

const PENDING_VENDOR_OVERRIDE_KEY = "pending_vendor_overrides_v1";
const PENDING_VENDOR_DRAFTS_KEY = "pending_vendor_drafts_v1";
const CUSTOMER_ORDER_STATUS_OVERRIDE_KEY = "customer_order_status_overrides_v1";
const SHIPPING_MODE_PRICING_KEY = "zz_shipping_mode_pricing_v1";

function readPendingVendorOverrides() {
  try {
    const raw = localStorage.getItem(PENDING_VENDOR_OVERRIDE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((x) => String(x)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function writePendingVendorOverrides(ids) {
  try {
    const list = Array.from(
      new Set((ids || []).map((x) => String(x)).filter(Boolean)),
    );
    localStorage.setItem(PENDING_VENDOR_OVERRIDE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

function readPendingVendorDrafts() {
  try {
    const raw = localStorage.getItem(PENDING_VENDOR_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x === "object" && x.id != null);
  } catch {
    return [];
  }
}

function writePendingVendorDrafts(rows) {
  try {
    const list = Array.isArray(rows)
      ? rows.filter((x) => x && typeof x === "object" && x.id != null)
      : [];
    localStorage.setItem(PENDING_VENDOR_DRAFTS_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

function readCustomerOrderStatusOverrides() {
  try {
    const raw = localStorage.getItem(CUSTOMER_ORDER_STATUS_OVERRIDE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((x) => String(x)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function writeCustomerOrderStatusOverrides(ids) {
  try {
    const list = Array.from(
      new Set((ids || []).map((x) => String(x)).filter(Boolean)),
    );
    localStorage.setItem(
      CUSTOMER_ORDER_STATUS_OVERRIDE_KEY,
      JSON.stringify(list),
    );
  } catch {
    // ignore storage errors
  }
}

function readShippingModePricing() {
  try {
    const raw = localStorage.getItem(SHIPPING_MODE_PRICING_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      Road: Number(parsed?.Road) >= 0 ? Number(parsed.Road) : 0,
      Sea: Number(parsed?.Sea) >= 0 ? Number(parsed.Sea) : 150,
      Air: Number(parsed?.Air) >= 0 ? Number(parsed.Air) : 300,
    };
  } catch {
    return { Road: 0, Sea: 150, Air: 300 };
  }
}

function writeShippingModePricing(pricing) {
  try {
    localStorage.setItem(SHIPPING_MODE_PRICING_KEY, JSON.stringify(pricing));
  } catch {
    // ignore storage errors
  }
}

/** Vendors table / directory: Super Admin sees all; admin & procurement see non-blacklisted; others see HQ-approved only. */
function vendorsVisibleInDirectory(mapped, viewerRole) {
  const key = normalizeRole(viewerRole);
  if (key === "superadmin") return mapped;
  if (["admin", "saas_client", "procurement"].includes(key)) {
    return mapped.filter(
      (v) => String(v.status || "").toLowerCase() !== "blacklisted",
    );
  }
  return mapped.filter((v) => vendorVisibleInSharedLists(v, viewerRole));
}

/** DB expects integers — frontend often sends "ORD-12", "CLT-5", or "user_9". */
function parseInvoiceOrderIdForApi(orderId) {
  if (orderId == null || orderId === "") return null;
  if (typeof orderId === "number" && Number.isFinite(orderId)) return orderId;
  const digits = String(orderId).replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

/** Personal customers use value "user_<id>" — same as checkout: numeric id as client_id for API. */
function parseInvoiceClientIdForApi(clientId) {
  if (clientId == null || clientId === "") return null;
  if (typeof clientId === "number" && Number.isFinite(clientId))
    return clientId;
  const s = String(clientId).trim();
  if (s.startsWith("user_")) {
    const n = parseInt(s.slice(5), 10);
    return Number.isNaN(n) ? null : n;
  }
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

function mapInvoiceStatusForApi(status) {
  const x = String(status || "unpaid")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  const map = {
    unpaid: "unpaid",
    partially_paid: "partially_paid",
    paid: "paid",
    overdue: "overdue",
    cancelled: "cancelled",
    pending: "pending",
    proforma: "pro_forma",
    pro_forma: "pro_forma",
  };
  return map[x] || "unpaid";
}

/** Body for POST /finance/invoices (snake_case, numeric FKs). */
function buildFinanceInvoiceCreatePayload(invoice) {
  const order_id = parseInvoiceOrderIdForApi(
    invoice.orderId ?? invoice.order_id,
  );
  const client_id = parseInvoiceClientIdForApi(
    invoice.clientId ?? invoice.client_id,
  );
  let amount = parseFloat(invoice.totalAmount ?? invoice.amount ?? 0);
  if (!Number.isFinite(amount)) amount = 0;
  let paid_amount = parseFloat(invoice.paidAmount ?? invoice.paid_amount ?? 0);
  if (!Number.isFinite(paid_amount)) paid_amount = 0;
  let due_date = invoice.dueDate || invoice.due_date || invoice.date;
  due_date = due_date
    ? String(due_date).split("T")[0]
    : new Date(Date.now() + 7 * 864e5).toISOString().split("T")[0];
  const status = mapInvoiceStatusForApi(invoice.status);

  const body = {
    client_id,
    amount,
    due_date,
    status,
  };
  if (Number.isFinite(paid_amount) && paid_amount > 0)
    body.paid_amount = paid_amount;
  if (order_id != null) body.order_id = order_id;
  return body;
}

/** GET /orders row → UI `total`: use API money fields when > 0, else sum items (qty × unit price). */
function mapOrderDisplayTotal(o, parsedItemsArr) {
  const toNum = (v) => {
    if (v == null || v === "") return NaN;
    return typeof v === "number" && Number.isFinite(v)
      ? v
      : parseFloat(String(v).replace(/,/g, ""));
  };
  const candidates = [
    o.total_amount,
    o.totalAmount,
    o.amount,
    o.total,
    o.grand_total,
    o.grandTotal,
    o.order_total,
    o.orderTotal,
  ];
  for (const c of candidates) {
    const n = toNum(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const lines = Array.isArray(parsedItemsArr) ? parsedItemsArr : [];
  let sum = 0;
  for (const line of lines) {
    const lineTot = toNum(
      line.total ?? line.line_total ?? line.lineTotal ?? line.subtotal,
    );
    if (Number.isFinite(lineTot) && lineTot > 0) {
      sum += lineTot;
      continue;
    }
    const q = toNum(line.qty ?? line.quantity ?? 1);
    const p = toNum(
      line.price ?? line.unit_price ?? line.unitPrice ?? line.amount ?? 0,
    );
    sum += (Number.isFinite(q) ? q : 0) * (Number.isFinite(p) ? p : 0);
  }
  if (Number.isFinite(sum) && sum > 0) return sum;
  const z = toNum(o.total_amount ?? o.totalAmount ?? o.amount ?? o.total ?? 0);
  return Number.isFinite(z) ? z : 0;
}

function normalizeTransportMode(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "road" || raw === "land" || raw === "ground") return "Road";
  if (raw === "sea" || raw === "boat" || raw === "marine") return "Sea";
  if (raw === "air" || raw === "flight" || raw === "plane") return "Air";
  return "";
}

function extractTransportModeFromOrder(row) {
  if (!row || typeof row !== "object") return "Road";

  const notesMatch = String(row.notes || row.order_notes || "").match(
    /delivery_mode\s*:\s*([^;\]\n]+)/i,
  );
  const fromNotes = normalizeTransportMode(notesMatch?.[1]);
  if (fromNotes) return fromNotes;

  let meta = {};
  if (typeof row.metadata === "string") {
    try { meta = JSON.parse(row.metadata); } catch (e) { }
  } else if (row.metadata && typeof row.metadata === "object") {
    meta = row.metadata;
  }

  const direct = normalizeTransportMode(
    row.delivery_mode ?? row.deliveryMode ?? row.deliveryType ?? row.mode ?? meta.deliveryType ?? meta.delivery_mode ?? meta.mode,
  );
  if (direct) return direct;

  const category = String(
    row.custom_request_category || row.customRequestCategory || row.type || "",
  ).toLowerCase();
  if (category.includes("sea")) return "Sea";
  if (category.includes("air")) return "Air";
  if (category.includes("road") || category.includes("land")) return "Road";
  return "Road";
}

export const GlobalDataProvider = ({ children }) => {
  const [saasRequests, setSaasRequests] = useState([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [clients, setClients] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accessPlans, setAccessPlans] = useState([]);
  const [pendingVendorOverrideIds, setPendingVendorOverrideIds] = useState(() =>
    readPendingVendorOverrides(),
  );
  const [pendingVendorDrafts, setPendingVendorDrafts] = useState(() =>
    readPendingVendorDrafts(),
  );
  const [customerOrderStatusOverrides, setCustomerOrderStatusOverrides] =
    useState(() => readCustomerOrderStatusOverrides());

  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }
    return null;
  });

  // FETCH REAL PROFILE ON MOUNT (PHASE 11 INTEGRATION) & POLL PERIODICALLY
  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await api.get('/auth/profile');
          const realUser = res.data?.data || res.data;
          if (realUser) {
            setCurrentUser((prev) => JSON.stringify(prev) === JSON.stringify(realUser) ? prev : realUser);
            localStorage.setItem('user', JSON.stringify(realUser));
            if (realUser.role?.name) {
              localStorage.setItem('userRole', realUser.role.name.toLowerCase());
            }
            if (realUser.menuPermissions) {
              setMenuPermissions((prev) => JSON.stringify(prev) === JSON.stringify(realUser.menuPermissions) ? prev : realUser.menuPermissions);
              localStorage.setItem('menuPermissions', JSON.stringify(realUser.menuPermissions));

              // Auto-kick out if on a restricted page
              const path = window.location.pathname;
              const search = window.location.search;

              const isDashboardIndexWithoutTab = (path === '/dashboard' || path === '/dashboard/') && !search.includes('tab=');

              if (path.startsWith('/dashboard') && !isDashboardIndexWithoutTab && !['/dashboard/settings', '/dashboard/profile'].includes(path)) {
                const hasPermission = realUser.menuPermissions.some(p =>
                  p.can_view &&
                  p.path &&
                  menuPathGrantsAccess(path, search, p.path)
                );

                const role = normalizeRole(realUser.role);
                const isPrivileged = ['superadmin', 'admin', 'saas_client', 'staff', 'customer', 'client', 'concierge', 'inventory', 'logistics'].includes(role);

                if (!hasPermission && !isPrivileged) {
                  window.location.href = '/dashboard';
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch real profile:', error);
          if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('menuPermissions');
            setCurrentUser(null);
          }
        }
      }
    };

    fetchProfile();

    // Poll every 10 seconds to detect real-time permissions changes
    const interval = setInterval(fetchProfile, 10000);

    // Refresh when user returns to/focuses the window
    window.addEventListener('focus', fetchProfile);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchProfile);
    };
  }, []);

  const [menuPermissions, setMenuPermissions] = useState(() => {
    const saved = localStorage.getItem("menuPermissions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  /** Core procurement screens: DB role menus sometimes omit can_add; procurement staff should manage these. */
  const PROCUREMENT_FULL_CRUD_MENUS = new Set([
    "quotes",
    "purchase requests",
    "vendors",
    "purchase orders",
  ]);

  /** Inventory role: warehouses & stock ledger are core duties; RBAC rows sometimes omit create. */
  const INVENTORY_FULL_CRUD_MENUS = new Set(["warehouses", "inventory"]);
  /** Logistics role: delivery ops screens should always support standard CRUD actions. */
  const LOGISTICS_FULL_CRUD_MENUS = new Set([
    "fleet",
    "deliveries",
    "tracking",
    "routes",
    "urgent",
  ]);
  const CONCIERGE_FULL_CRUD_MENUS = new Set([
    "orders",
    "events",
    "guest requests",
    "luxury items",
    "chauffeur",
  ]);

  const hasMenuPermission = (menuName, action = "can_view") => {
    const role = normalizeRole(currentUser?.role);
    if (
      role === "super_admin" ||
      role === "superadmin" ||
      role === "admin" ||
      role === "saas_client"
    )
      return true;

    const key = String(menuName || "")
      .trim()
      .toLowerCase();

    // Staff role bypasses for core operational screens
    if (role === "procurement" && PROCUREMENT_FULL_CRUD_MENUS.has(key)) return true;
    if (role === "inventory" && INVENTORY_FULL_CRUD_MENUS.has(key)) return true;
    if (role === "logistics" && LOGISTICS_FULL_CRUD_MENUS.has(key)) return true;
    if (role === "concierge" && CONCIERGE_FULL_CRUD_MENUS.has(key)) return true;

    // If no permissions loaded, deny by default (secure fallback)
    if (!menuPermissions || menuPermissions.length === 0) return false;
    const perm = menuPermissions.find(
      (p) =>
        String(p.name || "")
          .trim()
          .toLowerCase() === key,
    );
    return perm ? !!perm[action] : false;
  };

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [chauffeurRequests, setChauffeurRequests] = useState([]);
  const [logs, setLogs] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [rawSupportTickets, setRawSupportTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [missions, setMissions] = useState([]);
  const [staffAssignments, setStaffAssignments] = useState([]);
  const [payHistory, setPayHistory] = useState([]);
  const [teams, setTeams] = useState([]);
  const [audits, setAudits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [guestRequests, setGuestRequests] = useState([]);
  const [rawGuestRequests, setRawGuestRequests] = useState([]);
  const [events, setEvents] = useState([]);
  const [rawEvents, setRawEvents] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [urgentTasks, setUrgentTasks] = useState([]);
  const [tracking, setTracking] = useState([]);
  // Backend in some deployments doesn't expose tracking/urgent endpoints.
  const trackingApiUnavailableRef = React.useRef(false);
  const urgentApiUnavailableRef = React.useRef(false);
  const lastFetchedUserIdRef = React.useRef(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [lossAssessments, setLossAssessments] = useState([]);
  const [cart, setCart] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [revenueFilter, setRevenueFilter] = useState("Weekly");
  const [activePlan, setActivePlan] = useState("Institutional Premium");
  const [dashboardStats, setDashboardStats] = useState({});
  const [systemSettings, setSystemSettings] = useState({});
  const [inventoryAlerts, setInventoryAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Determine the base URL for the socket connection from the API URL
    const baseURL = import.meta.env.VITE_API_URL || 'https://zanezion-backend-production.up.railway.app/api/v1';
    const socketURL = baseURL.replace('/api/v1', '');

    const socket = io(socketURL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('🔗 Connected to Socket.io real-time server');
    });

    socket.on('delivery_update', (updatedDelivery) => {
      if (!updatedDelivery || !updatedDelivery.id) return;
      setDeliveries(prev => prev.map(d => d.id === updatedDelivery.id ? { ...d, ...updatedDelivery } : d));
    });

    socket.on('support_update', (updatedTicket) => {
      if (!updatedTicket || !updatedTicket.id) return;
      if (updatedTicket.deleted) {
        setSupportTickets(prev => prev.filter(t => t.id !== parseInt(updatedTicket.id)));
      } else {
        setSupportTickets(prev => prev.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t));
      }
    });

    socket.on('event_update', (updatedEvent) => {
      if (!updatedEvent || !updatedEvent.id) return;
      if (updatedEvent.deleted) {
        setEvents(prev => prev.filter(e => e.id !== parseInt(updatedEvent.id)));
      } else {
        setEvents(prev => prev.map(e => e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e));
      }
    });

    socket.on('guest_request_update', (updatedReq) => {
      if (!updatedReq || !updatedReq.id) return;
      if (updatedReq.deleted) {
        setGuestRequests(prev => prev.filter(r => r.id !== parseInt(updatedReq.id)));
      } else {
        setGuestRequests(prev => prev.map(r => r.id === updatedReq.id ? { ...r, ...updatedReq } : r));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);


  const filterDataForCurrentUser = React.useCallback(
    (dataArray) => {
      if (!Array.isArray(dataArray)) return [];
      if (!currentUser) return [];

      const role = normalizeRole(currentUser.role);
      // Super Admin sees everything
      if (["super_admin", "superadmin"].includes(role)) {
        return dataArray;
      }

      // Determine user's scoping IDs
      const myCompanyId =
        currentUser.company_id ||
        currentUser.companyId ||
        currentUser.clientId ||
        currentUser.client_id;
      const myUserId = currentUser.id;

      // If the user has a specific company scope, filter by that company
      if (myCompanyId && String(myCompanyId) !== "1") {
        return dataArray.filter((item) => {
          const itemCompany =
            item.company_id ||
            item.companyId ||
            item.client_id ||
            item.clientId ||
            item.customer_id;
          const itemUser =
            item.user_id ||
            item.userId ||
            item.created_by ||
            item.requested_by ||
            item.manager_id ||
            item.submitted_by;

          // If it belongs to their company OR if they created it
          return (
            (itemCompany && String(itemCompany) === String(myCompanyId)) ||
            (itemUser && String(itemUser) === String(myUserId))
          );
        });
      }

      // For regular customers, filter strictly by their user_id
      if (role === "customer") {
        return dataArray.filter((item) => {
          const itemCompany =
            item.company_id ||
            item.companyId ||
            item.client_id ||
            item.clientId ||
            item.customer_id;
          const itemUser =
            item.user_id ||
            item.userId ||
            item.created_by ||
            item.requested_by ||
            item.manager_id ||
            item.submitted_by;
          return (
            (itemUser && String(itemUser) === String(myUserId)) ||
            (itemCompany && String(itemCompany) === String(myUserId))
          );
        });
      }

      return dataArray;
    },
    [currentUser],
  );

  // Re-apply filtering for fetched tickets when user becomes available
  React.useEffect(() => {
    if (!Array.isArray(rawSupportTickets)) return;
    if (!currentUser) return; // keep existing state — don't wipe on null user
    setSupportTickets(filterDataForCurrentUser(rawSupportTickets));
  }, [currentUser, rawSupportTickets, filterDataForCurrentUser]);

  // Re-apply filtering for events when user becomes available
  React.useEffect(() => {
    if (!Array.isArray(rawEvents)) return;
    if (!currentUser) return;
    setEvents(filterDataForCurrentUser(rawEvents));
  }, [currentUser, rawEvents, filterDataForCurrentUser]);

  // Re-apply filtering for guest requests when user becomes available
  React.useEffect(() => {
    if (!Array.isArray(rawGuestRequests)) return;
    if (!currentUser) return;
    setGuestRequests(filterDataForCurrentUser(rawGuestRequests));
  }, [currentUser, rawGuestRequests, filterDataForCurrentUser]);

  const addLog = (log) => {
    setLogs((prev) =>
      [
        {
          ...log,
          id: Date.now(),
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev,
      ].slice(0, 50),
    );
  };

  /** Personal (customer) portal membership — same flags as Concierge Lifestyle on Plans; local profile until PSP wiring */
  const activatePersonalMembership = React.useCallback(async () => {
    try {
      const memberSince = new Date().toISOString().slice(0, 10);
      const next = {
        ...currentUser,
        concierge_member: true,
        conciergeMembership: true,
        concierge_membership_since: memberSince,
        concierge_fee_usd: PERSONAL_MEMBERSHIP_FEE_USD,
        plan: "Premium",
        is_upgraded: true,
      };

      // 1. Update Backend — save membership fields to users table
      if (currentUser?.id) {
        await api.put(`/users/${currentUser.id}`, {
          plan: "Premium",
          is_upgraded: true,
          concierge_member: true,
          concierge_membership_since: memberSince,
        });
      }

      // 2. Update Local State
      setCurrentUser(next);
      try {
        localStorage.setItem("user", JSON.stringify(next));
      } catch (_) {
        /* ignore */
      }

      addLog({
        action: "Membership upgrade",
        detail: `Personal portal membership activated ($${PERSONAL_MEMBERSHIP_FEE_USD}/mo platform subscription fee). Access to Purchase Requests and Audit Logs is now unlocked.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to activate membership on backend:", error);
      // Fallback to local update if backend fails (optimistic)
      setCurrentUser((prev) => ({
        ...prev,
        plan: "Premium",
        is_upgraded: true,
        concierge_member: true,
      }));
    }
  }, [currentUser]);

  const cancelPersonalMembership = React.useCallback(
    async (targetUserId) => {
      try {
        const next = {
          ...currentUser,
          concierge_member: false,
          concierge_membership_since: null,
          concierge_fee_usd: 0,
          plan: "Basic",
          is_upgraded: false,
        };

        // 1. Update Backend
        if (targetUserId) {
          await api.put(`/users/${targetUserId}`, {
            plan: "Basic",
            is_upgraded: false,
            concierge_member: false,
          });
        } else if (currentUser?.id) {
          await api.put(`/users/${currentUser.id}`, {
            plan: "Basic",
            is_upgraded: false,
            concierge_member: false,
          });
        }

        // 2. Update Local State (only if target is self)
        if (!targetUserId || targetUserId === currentUser?.id) {
          setCurrentUser(next);
          try {
            localStorage.setItem("user", JSON.stringify(next));
          } catch (_) {
            /* ignore */
          }
        }

        addLog({
          action: "Membership cancelled",
          detail: `Personal portal membership was cancelled. Access to premium features restricted.`,
          type: "system",
        });

        return true;
      } catch (error) {
        console.error("Failed to cancel membership:", error);
        throw error;
      }
    },
    [currentUser],
  );

  const formatDateTime = (date, time) => {
    if (!date) date = new Date().toISOString().split("T")[0];
    if (!time) return `${date} 00:00:00`;

    // Attempt to parse time string (e.g., "11:20 PM", "23:20", "11:20")
    let hours = 0,
      minutes = 0,
      seconds = 0;
    const timeRegex = /(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i;
    const match = String(time).match(timeRegex);

    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      seconds = match[3] ? parseInt(match[3], 10) : 0;
      const ampm = match[4];

      if (ampm) {
        if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
        if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;
      }
    }

    const h = String(hours).padStart(2, "0");
    const m = String(minutes).padStart(2, "0");
    const s = String(seconds).padStart(2, "0");

    return `${date} ${h}:${m}:${s}`;
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [...prev, { ...item, qty: 1 }];
    });
    addLog({
      action: "Cart Update",
      detail: `Added ${item.name} to the procurement queue.`,
      type: "system",
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item && item.qty > 1) {
        return prev.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i));
      }
      return prev.filter((i) => i.id !== id);
    });
  };
  const clearCart = () => setCart([]);

  const fetchClients = React.useCallback(
    async (options = {}) => {
      const buildFallbackFromUsers = async () => {
        const res = await api.get(
          "/users/customers?include_all=1&include_client_role=1",
        );
        const list = res.data?.success ? res.data.data || [] : [];
        return list
          .filter((u) => {
            const role = normalizeRole(u?.role);
            const acct = normalizeClientTypeValue(
              u?.account_type ??
              u?.accountType ??
              u?.client_type ??
              u?.clientType ??
              role,
            );
            return (
              ["client", "customer", "saas_client"].includes(role) ||
              ["business", "personal", "saas"].includes(
                String(acct || "").toLowerCase(),
              )
            );
          })
          .map((u) => {
            const acct = normalizeClientTypeValue(
              u?.account_type ??
              u?.accountType ??
              u?.client_type ??
              u?.clientType ??
              u?.role,
            );
            const mappedType =
              acct ||
              (normalizeRole(u?.role) === "client"
                ? "Business"
                : normalizeRole(u?.role) === "saas_client"
                  ? "SaaS"
                  : "Personal");
            const base = mapClientFromApi({
              id: u?.client_id ?? u?.company_id ?? u?.id,
              name: u?.name || u?.business_name || u?.company_name || u?.companyName || "",
              business_name:
                u?.business_name || u?.company_name || u?.companyName || u?.name || "",
              companyName: u?.companyName || u?.business_name || u?.company_name || u?.name || "",
              email: u?.email || "",
              phone: u?.phone || "",
              address: u?.address || u?.location || "",
              location: u?.location || u?.address || "",
              status: u?.status || "pending",
              source: "Signup",
              client_type: mappedType,
              account_type: mappedType,
              business_license_url:
                u?.business_license_url || u?.businessLicenseUrl || "",
              plan: u?.plan || "Free",
              concierge_member: u?.concierge_member,
              conciergeMembership:
                u?.conciergeMembership ?? u?.concierge_member,
              is_upgraded: u?.is_upgraded,
            });
            return {
              ...(base || {}),
              signup_user_id: u?.id,
            };
          })
          .filter(Boolean);
      };
      try {
        const roleKey = normalizeRole(currentUser?.role);
        const requestedTypeNorm = normalizeClientTypeValue(options.client_type);
        const tenantCustomerOnlyView =
          (roleKey === "admin" || roleKey === "saas_client") &&
          requestedTypeNorm === "Personal";
        const params = new URLSearchParams();
        if (options.search) params.append("search", options.search);
        if (options.client_type)
          params.append("client_type", options.client_type);
        const url = `/clients${params.toString() ? "?" + params.toString() : ""}`;
        const res = await api.get(url);
        let raw = res.data?.success ? res.data.data : res.data;
        const arr = normalizeClientsResponseBody(raw);
        const mapped = arr.map(mapClientFromApi).filter(Boolean);
        if (mapped.length > 0) {
          const filteredMapped = mapped.filter((c) =>
            clientMatchesTypeFilter(c, options.client_type),
          );
          if (filteredMapped.length > 0) {
            setClients(filteredMapped);
          } else {
            if (tenantCustomerOnlyView) {
              // Admin customer menu should only show admin-added tenant customers,
              // not personal signup users from global fallback.
              setClients([]);
              return;
            }
            // API returned clients, but none match requested type (common for Personal customers).
            // Fall back to users directory so admin/customer tabs still show signup + manually added customers.
            const fromUsers = await buildFallbackFromUsers();
            setClients(
              fromUsers.filter((c) =>
                clientMatchesTypeFilter(c, options.client_type),
              ),
            );
          }
        } else {
          if (tenantCustomerOnlyView) {
            setClients([]);
            return;
          }
          const fromUsers = await buildFallbackFromUsers();
          setClients(
            fromUsers.filter((c) =>
              clientMatchesTypeFilter(c, options.client_type),
            ),
          );
        }
      } catch (e) {
        console.error("Fetch clients failed", e);
        try {
          const roleKey = normalizeRole(currentUser?.role);
          const requestedTypeNorm = normalizeClientTypeValue(
            options.client_type,
          );
          const tenantCustomerOnlyView =
            (roleKey === "admin" || roleKey === "saas_client") &&
            requestedTypeNorm === "Personal";
          if (tenantCustomerOnlyView) {
            setClients([]);
            return;
          }
          const fromUsers = await buildFallbackFromUsers();
          setClients(
            fromUsers.filter((c) =>
              clientMatchesTypeFilter(c, options.client_type),
            ),
          );
        } catch (innerErr) {
          console.error("Fetch fallback clients from users failed", innerErr);
          setClients([]);
        }
      }
    },
    [currentUser?.role],
  );

  const fetchVendors = React.useCallback(async () => {
    try {
      const res = await api.get("/vendors");
      const raw = res.data?.success
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      const safeRaw = Array.isArray(raw) ? raw : (raw?.vendors && Array.isArray(raw.vendors) ? raw.vendors : (raw?.data && Array.isArray(raw.data) ? raw.data : []));
      const mapped = safeRaw.map((v) => ({
        ...v,
        name:
          v.name ||
          v.vendor_name ||
          v.business_name ||
          v.companyName ||
          v.company_name ||
          v.title ||
          "Partner",
        status: mapVendorStatusFromApi(v),
        contact: v.contact_name || v.contact || v.contact_person || "",
        delivery:
          (v.delivery ??
            v.delivery_performance ??
            Math.round((v.rating || 0) * 100)) ||
          90,
      }));
      // Server status is source of truth (pending/inactive until super-admin approval).
      setVendors(vendorsVisibleInDirectory(mapped, currentUser?.role));
    } catch (e) {
      console.error("Fetch vendors failed", e);
      const seed = VENDORS.map((v) => ({
        ...v,
        name:
          v.name ||
          v.vendor_name ||
          v.business_name ||
          v.companyName ||
          v.company_name ||
          v.title ||
          "Partner",
        status: mapVendorStatusFromApi(v),
        contact: v.contact_name || v.contact || v.contact_person || "",
        delivery:
          (v.delivery ??
            v.delivery_performance ??
            Math.round((v.rating || 0) * 100)) ||
          90,
      }));
      setVendors(vendorsVisibleInDirectory(seed, currentUser?.role));
    }
  }, [currentUser?.role, currentUser?.id]);

  const marketplaceVendors = React.useMemo(
    () =>
      (vendors || []).filter(
        (v) => String(v?.status || "").trim().toLowerCase() === "active",
      ),
    [vendors],
  );

  const fetchInventory = React.useCallback(async () => {
    let stockArr = [];
    try {
      // Try real DB stock endpoint first
      const res = await api.get("/stock", { params: { limit: 500 } });
      const raw = res.data?.data;
      // real API: { stock: [...], total: N } or just an array
      stockArr = Array.isArray(raw) ? raw : (Array.isArray(raw?.stock) ? raw.stock : []);
    } catch (e) {
      console.warn("Fetch real stock API failed (possibly 403), falling back to /inventory", e.message);
    }

    try {
      if (stockArr.length > 0) {
        setInventory(
          stockArr.map((i) => ({
            ...i,
            id: i.id,
            name: i.item?.name || i.name || "",
            image: inventoryImageFromApiRow(i) || "",
            qty: i.quantity ?? i.qty ?? 0,
            quantity: i.quantity ?? i.qty ?? 0,
            location: i.warehouse?.name || i.warehouse_name || i.location || "",
            warehouse_name: i.warehouse?.name || i.warehouse_name || "",
            warehouseId: i.warehouseId || i.warehouse_id || null,
            itemId: i.itemId || i.item_id || null,
            inventoryType: i.item?.inventoryType || i.inventory_type || i.inventoryType || "Marketplace",
            clientId: i.item?.clientId || i.client_id || i.clientId || null,
            clientName: i.item?.client?.companyName || i.client_name || i.clientName || "",
            vendor_id: i.vendor_id ?? i.vendorId ?? null,
            vendorName: i.vendor_name || i.vendorName || i.vendor || "",
            category: canonicalMarketplaceCategory(
              i.item?.category?.name || i.category?.name || i.category || ""
            ),
            sku: i.item?.sku || i.sku || "",
            price: i.item?.price || i.price || 0,
            size: i.size || "",
            color: i.color || "",
            material: i.material || "",
            specifications: i.specifications || "",
            description: i.item?.description || i.description || "",
            status:
              i.quantity <= 0
                ? "Critical"
                : i.item?.reorderLevel && i.quantity <= i.item.reorderLevel
                  ? "Warning"
                  : i.status === "in_stock"
                    ? "Normal"
                    : i.status === "low_stock"
                      ? "Warning"
                      : i.status === "out_of_stock"
                        ? "Critical"
                        : i.status || "Normal",
          }))
        );
        return;
      }
    } catch (e) {
      console.error("Mapping stock failed", e);
    }

    // Fallback to mock /inventory endpoint if real stock is empty or failed
    try {
      const res2 = await api.get("/inventory");
      const data = res2.data?.success
        ? res2.data.data
        : Array.isArray(res2.data)
          ? res2.data
          : [];
      setInventory(
        data.map((i) => ({
          ...i,
          image: inventoryImageFromApiRow(i) || "",
          qty: i.quantity ?? i.qty ?? 0,
          location: i.warehouse_name || i.location || "",
          inventoryType: i.inventory_type || i.inventoryType || "Marketplace",
          clientId: i.client_id || i.clientId || null,
          clientName: i.client_name || i.clientName || "",
          vendor_id: i.vendor_id ?? i.vendorId ?? null,
          vendorName: i.vendor_name || i.vendorName || i.vendor || "",
          category: canonicalMarketplaceCategory(i.category),
          size: i.size || "",
          color: i.color || "",
          material: i.material || "",
          specifications: i.specifications || "",
          description: i.description || "",
          status:
            i.status === "in_stock"
              ? "Normal"
              : i.status === "low_stock"
                ? "Warning"
                : i.status === "out_of_stock"
                  ? "Critical"
                  : i.status || "Normal",
        }))
      );
    } catch (e) {
      console.error("Fetch /inventory failed, using default mock data", e);
      setInventory(INVENTORY);
    }
  }, []);

  const fetchStockMovements = React.useCallback(async () => {
    try {
      const res = await api.get("/stock/movements");
      const movementsData = res.data?.success ? (res.data.data?.movements || res.data.data) : [];
      if (Array.isArray(movementsData)) {
        setStockMovements(
          movementsData.map((m) => {
            let typeLabel = "ADJUSTMENT";
            const mType = String(m.movementType || '').toUpperCase();
            const rType = String(m.referenceType || '').toUpperCase();

            if (rType === 'LOSS' || mType === 'LOSS' || rType === 'ASSET_LOSS' || mType === 'ASSET_LOSS') {
              typeLabel = 'ASSET_LOSS';
            } else if (mType === 'IN' || rType === 'GRN') {
              typeLabel = 'STOCK_ENTRY';
            } else if (mType === 'OUT' || rType === 'TRANSFER_OUT') {
              typeLabel = 'STOCK_ISSUE';
            }

            return {
              id: m.id,
              item: m.item?.name || m.item_name || "Deleted Asset",
              type: typeLabel,
              quantity: m.quantity,
              reason: m.remarks || m.reason || "Routine Adjustment",
              issuedBy: m.performerName || m.performed_by_name || "System User",
              date: (m.createdAt || m.created_at || new Date().toISOString()).split("T")[0],
              time: (m.createdAt || m.created_at || "").split("T")[1]?.slice(0, 5) || "",
              referenceType: m.referenceType,
              movementType: m.movementType,
              remarks: m.remarks
            };
          }),
        );
      }
    } catch (e) {
      console.error("Fetch stock movements failed", e);
    }
  }, []);

  const fetchLossAssessments = React.useCallback(async () => {
    try {
      const res = await api.get("/inventory/loss");
      const lossesData = res.data?.success ? (res.data.data?.losses || res.data.data) : [];
      if (Array.isArray(lossesData)) {
        setLossAssessments(
          lossesData.map((l) => ({
            id: l.id,
            item: l.item?.name || l.item_name || "Deleted Asset",
            quantity: l.quantity,
            lossType: l.lossType,
            explanation: l.explanation,
            reportedBy: l.reportedBy,
            status: l.investigationStatus || "Pending",
            evidenceUrl: l.evidenceUrl || "",
            date: (l.createdAt || new Date().toISOString()).split("T")[0],
            time: (l.createdAt || "").split("T")[1]?.slice(0, 5) || "",
            financialLoss: (parseFloat(l.item?.price || 0) * parseFloat(l.quantity || 0))
          })),
        );
      }
    } catch (e) {
      console.error("Fetch loss assessments failed", e);
    }
  }, []);

  const fetchAccessPlans = React.useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const url = token ? "/plans" : "/plans/public";
      const res = await api.get(url);
      let rawData = res.data?.success
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      if (rawData && !Array.isArray(rawData) && typeof rawData === 'object') {
        rawData = rawData.data || rawData.items || rawData.orders || rawData.missions || rawData.invoices || rawData.projects || Object.values(rawData).find(Array.isArray) || [];
      }
      if (!Array.isArray(rawData) || rawData.length === 0) {
        setAccessPlans(ACCESS_PLANS);
        return;
      }
      const mapped = rawData.map((row) => {
        let featureObj = {};
        if (row.features != null) {
          try {
            featureObj = typeof row.features === "string" ? JSON.parse(row.features) : row.features;
          } catch {
            featureObj = {};
          }
        }

        let featureList = [];
        let tier = row.billingCycle || row.billing_cycle || "Monthly";
        let yearlyPriceNum = 0;
        let commitment = `${tier} subscription.`;

        if (Array.isArray(featureObj)) {
          featureList = featureObj;
        } else if (featureObj && typeof featureObj === 'object') {
          featureList = featureObj.list || [];
          if (featureObj.tier) tier = featureObj.tier;
          if (featureObj.yearlyPrice) yearlyPriceNum = parseFloat(featureObj.yearlyPrice);
          if (featureObj.commitment) commitment = featureObj.commitment;
        }

        const priceNum = parseFloat(row.price || 0);
        const cycle = row.billing_cycle || row.billingCycle || "Monthly";
        const isAnnual = String(cycle).toLowerCase() === "annually" || String(cycle).toLowerCase() === "yearly";

        if (!yearlyPriceNum) {
          yearlyPriceNum = isAnnual ? priceNum : Math.round(priceNum * 12 * 0.8);
        }

        return {
          id: row.id,
          name: row.name,
          tier: tier,
          price: `$${priceNum.toLocaleString(undefined, { minimumFractionDigits: priceNum % 1 ? 2 : 0, maximumFractionDigits: 2 })}`,
          period: isAnnual ? "per year" : "per month",
          yearlyPrice: `$${yearlyPriceNum.toLocaleString(undefined, { minimumFractionDigits: yearlyPriceNum % 1 ? 2 : 0, maximumFractionDigits: 2 })}`,
          description: row.description || "",
          features: featureList,
          commitment: commitment,
          billing_cycle: cycle,
          max_users: row.maxUsers || row.max_users,
          max_orders: row.maxOrders || row.max_orders,
          status: row.isActive ? "Active" : row.status || "Inactive",
        };
      });
      setAccessPlans(mapped);
    } catch (e) {
      console.error("Fetch access plans failed", e);
      setAccessPlans(ACCESS_PLANS);
    }
  }, []);

  const fetchSubscriptionRequests = React.useCallback(async (operationId) => {
    try {
      // The backend /api/saas/requests already filters by logged-in user if role is operations
      const res = await api.get("/saas/requests");
      let rawData = res.data?.success
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      if (rawData && !Array.isArray(rawData) && typeof rawData === 'object') {
        rawData = rawData.data || rawData.items || rawData.orders || rawData.missions || rawData.invoices || rawData.projects || Object.values(rawData).find(Array.isArray) || [];
      }
      setSubscriptionRequests(rawData);
    } catch (e) {
      console.error("Fetch subscription requests failed", e);
    }
  }, []);

  const fetchLeaveRequests = React.useCallback(async () => {
    try {
      const res = await api.get("/staff/leave");
      if (res.data?.success) {
        setLeaveRequests(res.data.data);
      }
    } catch (error) {
      console.error("Fetch leave requests failed", error);
    }
  }, []);

  const fetchStaff = React.useCallback(async (filters = {}) => {
    try {
      const params = { limit: 1000 };
      if (filters?.status) params.status = String(filters.status).toLowerCase();
      if (filters?.search) params.search = String(filters.search).trim();
      const res = await api.get("/users", { params });
      if (res.data?.success) {
        let rawUsers = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.users || []);
        let list = rawUsers.map((u) => normalizeUserForUi(u));

        // Fallback filtering in case backend doesn't yet support these query params.
        if (filters?.status) {
          const want = String(filters.status).toLowerCase();
          list = list.filter(
            (u) => String(u?.status || "").toLowerCase() === want,
          );
        }
        if (filters?.search) {
          const q = String(filters.search).toLowerCase();
          list = list.filter(
            (u) =>
              String(u?.name || "")
                .toLowerCase()
                .includes(q) ||
              String(u?.email || "")
                .toLowerCase()
                .includes(q),
          );
        }

        setUsers(list);
        return list;
      }
    } catch (e) {
      console.error("Fetch staff failed", e);
      setUsers([]);
    }
    return null;
  }, []);

  const [customerUsers, setCustomerUsers] = React.useState([]);
  const fetchCustomerUsers = React.useCallback(async (options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.include_all) params.append("include_all", "1");
      if (options.include_client_role)
        params.append("include_client_role", "1");
      const url = `/users/customers${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await api.get(url);
      if (res.data?.success) {
        // Extract array if backend returned paginated object { users: [...] }
        const usersArray = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.users || []);
        setCustomerUsers(usersArray);
        return usersArray;
      }
    } catch (e) {
      console.error("Fetch customer users failed", e);
    }
    return [];
  }, []);

  const fetchFleet = React.useCallback(async () => {
    try {
      const res = await api.get("/vehicles");
      if (res.data && res.data.success) {
        setFleet(
          res.data.data.map((v) => ({
            id: v.vehicleId,
            db_id: v.id,
            type: v.type,
            model: v.model,
            fuel: v.fuel || '100%',
            status: v.status || 'Active',
            capacity: v.capacity,
            location: v.location,
            insurancePolicy: v.insurancePolicy,
            registrationExpiry: v.registrationExpiry || '',
            inspectionDate: v.inspectionDate || '',
            diagnosticStatus: v.diagnosticStatus,
          }))
        );
      }
    } catch (e) {
      console.error("Fetch fleet failed", e);
    }
  }, []);

  const fetchDeliveries = React.useCallback(async () => {
    try {
      const [resLogistics, resChauffeur] = await Promise.all([
        api.get("/deliveries"),
        api.get("/orders", { params: { orderType: 'CHAUFFEUR', limit: 100 } })
      ]);

      const combined = [];

      const logisticsRaw = resLogistics.data?.data;
      const logisticsArr = Array.isArray(logisticsRaw)
        ? logisticsRaw
        : Array.isArray(logisticsRaw?.deliveries)
          ? logisticsRaw.deliveries
          : Array.isArray(logisticsRaw?.data)
            ? logisticsRaw.data
            : [];

      if (logisticsArr.length > 0 || (resLogistics.data && resLogistics.data.success)) {
        combined.push(...logisticsArr.map((d) => {
          // Real DB uses camelCase; mock API uses snake_case. Support both.
          const dbItems = Array.isArray(d.items) ? d.items : [];
          let items = [];
          if (dbItems.length > 0) {
            // Real DB response: d.items = [{ item: { name: '...' }, quantity: N, itemId: N }]
            items = dbItems.map(di => ({
              name: di.item?.name || di.name || 'Item',
              qty: di.quantity,
              quantity: di.quantity,
              itemId: di.itemId,
            }));
          } else if (d.package_details) {
            try { items = JSON.parse(d.package_details); } catch { items = []; }
          }
          if (!Array.isArray(items)) items = [];

          const transportMode = extractTransportModeFromOrder(d);
          // Support both real DB (orderId) and mock (order_id)
          const rawOrderId = d.orderId ?? d.order_id ?? null;
          const orderRef = rawOrderId ? `ORD-${String(rawOrderId).padStart(3, "0")}` : null;
          const rawClientId = d.clientId ?? d.client_id ?? d.customer_id ?? null;
          const rawMissionType = d.missionType ?? d.mission_type ?? null;
          const rawDriverName = d.driverName ?? d.driver_name ?? null;
          const rawPlate = d.plateNumber ?? d.plate_number ?? null;
          const rawPickup = d.pickupLocation ?? d.pickup_location ?? null;
          const rawDrop = d.dropLocation ?? d.drop_location ?? null;
          const rawRoute = d.route ?? null;
          const rawEta = d.etaSchedule ?? d.delivery_date ?? null;
          const rawFee = d.deliveryFee ?? d.delivery_fee ?? d.total_amount ?? d.amount ?? 0;
          const rawDriverId = d.driverId ?? d.assigned_driver ?? d.driver_id ?? d.assigned_to ?? null;

          return {
            id: `DEL-${String(d.id).padStart(3, "0")}`,
            db_id: d.id,
            deliveryNumber: d.deliveryNumber || `DEL-${String(d.id).padStart(3, "0")}`,
            orderId: orderRef,
            order_id_raw: rawOrderId,
            company_id: d.companyId ?? d.company_id ?? null,
            client_id: rawClientId,
            customer_id: d.customerId ?? d.customer_id ?? null,
            clientId: rawClientId,
            client: d.client?.companyName || d.client_name || d.customer_name || "",
            clientName: d.client?.companyName || d.client_name || d.customer_name || "",
            mission_type: rawMissionType,
            item: items.length > 0
              ? items[0].name
              : rawMissionType === "Chauffeur"
                ? "VIP Chauffeur Service"
                : orderRef
                  ? `Order ${orderRef}`
                  : "Internal Mission",
            items: items,
            package_details: d.package_details,
            order_instructions: d.orderInstructions ?? d.order_instructions ?? null,
            status: d.status,
            driverId: rawDriverId,
            driver: rawDriverName,
            vehicleId: rawPlate,
            pickupLocation: rawPickup,
            drop_location: rawDrop,
            dropLocation: rawDrop,
            warehouseId: d.warehouseId ?? d.warehouse_id ?? null,
            warehouse: d.warehouse?.name ?? d.warehouse_name ?? null,
            route: rawRoute,
            location: rawDrop || rawRoute || rawPickup || "In Transit",
            mode: rawMissionType === "Chauffeur" ? "Road" : transportMode,
            deliveryDate: rawEta ? rawEta.split("T")[0] : null,
            eta: rawEta ? rawEta.split("T")[0] : "TBD",
            delivery_instructions: d.deliveryInstructions ?? d.delivery_instructions ?? d.order_instructions ?? d.order_notes ?? "",
            delivery_fee: parseFloat(rawFee) || 0,
            route_distance: d.routeDistance != null ? parseFloat(d.routeDistance) : (d.route_distance != null ? parseFloat(d.route_distance) : null),
            staff_pay_rate: d.staffPayRate != null ? parseFloat(d.staffPayRate) : (d.staff_pay_rate != null ? parseFloat(d.staff_pay_rate) : null),
            clientConfirmed: !!(d.signature),
            signature: d.signature,
            payout_status: (d.status === 'delivered' || d.status === 'Delivered') ? 'held' : null,
            payout_ready_at: (d.status === 'delivered' || d.status === 'Delivered') ? new Date(new Date(d.updatedAt || Date.now()).getTime() + 48 * 60 * 60 * 1000).toISOString() : null,
          };
        }));
      }

      if (resChauffeur.data && resChauffeur.data.success) {
        const chauffeurOrders = Array.isArray(resChauffeur.data.data)
          ? resChauffeur.data.data
          : (resChauffeur.data.data?.orders || []);

        combined.push(...chauffeurOrders.map((order) => {
          const detail = order.metadata?.customItems?.[0] || order.metadata || {};
          return {
            id: `CH-ORD-${String(order.id).padStart(3, "0")}`,
            db_id: order.id,
            orderId: order.orderNumber || `ORD-${String(order.id).padStart(3, "0")}`,
            order_id_raw: order.id,
            company_id: order.companyId ?? null,
            client_id: order.clientId ?? null,
            customer_id: order.customerId ?? null,
            clientId: order.clientId ?? null,
            client: order.client?.companyName || order.client?.name || detail.clientName || 'Guest Client',
            clientName: order.client?.companyName || order.client?.name || detail.clientName || 'Guest Client',
            mission_type: "Chauffeur",
            item: "VIP Chauffeur Service",
            items: [{ name: "VIP Chauffeur Service", qty: 1 }],
            package_details: JSON.stringify(detail),
            order_instructions: detail.instructions || null,
            status: order.status,
            driverId: order.driver_user_id || detail.driver_user_id || null,
            driver: order.driverName || detail.driverName || "",
            vehicleId: order.plateNumber || detail.plateNumber || "",
            pickupLocation: detail.pickupLocation || "Nassau Area",
            drop_location: detail.dropLocation || "Destination",
            dropLocation: detail.dropLocation || "Destination",
            route: detail.route || "",
            location: detail.dropLocation || "Destination",
            mode: "Road",
            deliveryDate: detail.eta || detail.dueDate || null,
            eta: detail.eta || detail.dueDate || "TBD",
            delivery_instructions: detail.delivery_instructions || "",
            delivery_fee: parseFloat(detail.chauffeurFee ?? detail.chauffeur_fee ?? 0) || 0,
            route_distance: null,
            staff_pay_rate: null,
            clientConfirmed: false,
            signature: null,
            payout_status: (order.status === 'Delivered' || order.status === 'Completed' || order.status === 'completed') ? 'held' : null,
            payout_ready_at: (order.status === 'Delivered' || order.status === 'Completed' || order.status === 'completed') ? new Date(new Date(order.updatedAt || Date.now()).getTime() + 48 * 60 * 60 * 1000).toISOString() : null,
            remarks: JSON.stringify(detail)
          };
        }));
      }

      setDeliveries(combined);
    } catch (e) {
      console.error("Fetch deliveries failed", e);
    }
  }, []);

  const parsePOItems = (raw) => {
    let items = raw;
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }
    if (!Array.isArray(items)) return [];
    return items.map((item, idx) => {
      const orderedQty = item.orderedQty ?? item.quantity ?? item.qty ?? 0;
      const price = item.price ?? item.unit_price ?? item.unitPrice ?? 0;
      const receivedQty = item.receivedQty ?? item.received_qty ?? 0;
      const pendingReceiveQty = item.pending_receive_qty ?? 0;
      return {
        ...item,
        id: item.id ?? idx,
        orderedQty,
        price,
        receivedQty,
        pending_receive_qty: pendingReceiveQty,
        pendingQty: Math.max(0, orderedQty - receivedQty - pendingReceiveQty),
      };
    });
  };

  const mapPurchaseRequest = React.useCallback((r) => {
    let parsedItems = r.items;
    if (typeof parsedItems === "string") {
      try {
        parsedItems = JSON.parse(parsedItems);
      } catch {
        parsedItems = [];
      }
    }
    const itemsArray = (() => {
      if (Array.isArray(parsedItems) && parsedItems.length) return parsedItems;
      if (r.item_name) {
        return [
          {
            name: r.item_name,
            category: r.category || "",
            qty: r.quantity ?? 0,
            price: parseFloat(r.estimated_cost) || 0,
          },
        ];
      }
      return [];
    })();

    const mappedItems = itemsArray.map((item, idx) => ({
      ...item,
      name: item.name || r.item_name || "",
      qty: item.qty ?? item.quantity ?? r.quantity ?? 1,
      price: parseFloat(item.price ?? item.estimated_cost ?? r.estimated_cost ?? 0),
    }));

    const computedTotal = mappedItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const finalTotal = parseFloat(r.estimated_cost || r.total || computedTotal || 0);

    return {
      ...r,
      requestId: r.request_id ?? r.requestId ?? (r.id ? `REQ-${r.id}` : `REQ-${Date.now()}`),
      id: r.id ?? r.request_id ?? r.requestId,
      items: mappedItems,
      item: r.item_name || (mappedItems[0]?.name || ""),
      total: finalTotal,
      date: r.created_at || r.date,
    };
  }, []);

  const fetchProcurement = React.useCallback(async () => {
    try {
      const [reqs, quotes, pos] = await Promise.all([
        api.get("/purchase-requests").catch((e) => ({ data: [] })),
        api.get("/quotations").catch((e) => ({ data: [] })),
        api.get("/purchase-orders").catch((e) => ({ data: [] })),
      ]);
      if (reqs.data?.success || Array.isArray(reqs.data?.data) || Array.isArray(reqs.data?.data?.purchaseRequests)) {
        const reqData = Array.isArray(reqs.data?.data) ? reqs.data.data : (reqs.data?.data?.purchaseRequests || []);
        setPurchaseRequests(reqData.map(mapPurchaseRequest));
      }
      if (quotes.data?.success || Array.isArray(quotes.data?.data) || Array.isArray(quotes.data?.data?.quotations)) {
        const quoteData = Array.isArray(quotes.data?.data) ? quotes.data.data : (quotes.data?.data?.quotations || []);
        setQuotes(
          quoteData.map((q) => ({
            ...q,
            vendorId: q.vendor_id ?? q.vendorId ?? null,
            vendor: q.vendor_name || q.vendor,
            vendorName: q.vendor_name || q.vendor,
            date: q.created_at || q.date,
            total: parseFloat(q.amount || q.totalAmount || q.total_amount || q.total || 0),
            validity: q.validity_date || q.validity,
          }))
        );
      }
      if (pos.data?.success || Array.isArray(pos.data?.data) || Array.isArray(pos.data?.data?.purchaseOrders)) {
        const poData = Array.isArray(pos.data?.data) ? pos.data.data : (pos.data?.data?.purchaseOrders || []);
        setPurchaseOrders(
          poData.map((po) => ({
            ...po,
            vendorId: po.vendor_id ?? po.vendorId ?? null,
            vendor: po.vendor_name || po.vendor,
            vendorName: po.vendor_name || po.vendor,
            date: po.created_at || po.date,
            total: parseFloat(po.amount || po.totalAmount || po.total_amount || po.total || 0),
          }))
        );
      }
    } catch (e) {
      console.error("fetchProcurement error", e);
    }
  }, [mapPurchaseRequest]);

  const fetchQuotes = React.useCallback(async (params = {}) => {
    try {
      const res = await api.get("/procurement/quotes", { params });
      if (res.data?.success) {
        setQuotes(
          res.data.data.map((q) => ({
            ...q,
            vendorId: q.vendor_id ?? q.vendorId ?? null,
            vendor: q.vendor_name || q.vendor,
            vendorName: q.vendor_name || q.vendor,
            date: q.created_at || q.date,
            total: parseFloat(q.total_amount || q.total || 0),
            validity: q.validity_date || q.validity,
          })),
        );
      }
    } catch (e) {
      console.error("Fetch quotes failed", e);
    }
  }, []);

  const fetchPurchaseRequests = React.useCallback(async (params = {}) => {
    try {
      const res = await api.get("/purchase-requests", { params });
      if (res.data?.success) {
        const data = res.data.data;
        const list = Array.isArray(data) ? data : (data?.purchaseRequests || []);
        setPurchaseRequests(list.map(mapPurchaseRequest));
      }
    } catch (e) {
      console.error("Fetch purchase requests failed", e);
    }
  }, [mapPurchaseRequest]);

  const fetchPurchaseOrders = React.useCallback(async (params = {}) => {
    try {
      const res = await api.get("/purchase-orders", { params });
      if (res.data?.success) {
        const data = res.data.data;
        const list = Array.isArray(data) ? data : (data?.purchaseOrders || []);
        setPurchaseOrders(
          list.map((po) => ({
            ...po,
            vendorName: po.vendor?.companyName || po.vendor_name || po.vendorName,
            date: po.createdAt || po.created_at || po.date,
            total: parseFloat(po.totalAmount || po.total_amount || po.total || 0),
            paymentTerms: po.payment_terms || po.paymentTerms,
            items: parsePOItems(po.items),
          })),
        );
      }
    } catch (e) {
      console.error("Fetch purchase orders failed", e);
    }
  }, []);

  const fetchOrders = React.useCallback(async () => {
    try {
      const res = await api.get("/orders");
      let rawData = res.data?.success
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      if (rawData && !Array.isArray(rawData) && typeof rawData === 'object') {
        rawData = rawData.data || rawData.items || rawData.orders || rawData.missions || rawData.invoices || rawData.projects || Object.values(rawData).find(Array.isArray) || [];
      }
      const mappedOrders = rawData.map((o) => {
        let parsedItems = o.items;
        if (typeof parsedItems === "string") {
          try {
            parsedItems = JSON.parse(parsedItems);
          } catch {
            parsedItems = [];
          }
        }
        const itemsArr = Array.isArray(parsedItems) ? parsedItems : [];
        const totalVal = mapOrderDisplayTotal(o, itemsArr);
        const createdDay = isoDateSlice(o.created_at);
        const orderDay = isoDateSlice(o.order_date);
        const dueDay = isoDateSlice(o.due_date);
        const displayDate = orderDay || createdDay;
        const statusForUi = o.status;
        const transportMode = extractTransportModeFromOrder(o);
        let meta = {};
        if (typeof o.metadata === "string") {
          try { meta = JSON.parse(o.metadata); } catch (e) { }
        } else if (o.metadata && typeof o.metadata === "object") {
          meta = o.metadata;
        }

        return {
          ...o,
          ...meta,
          items: itemsArr,
          clientId: o.customer_id || o.client_id || o.clientId,
          companyId: o.company_id || o.tenantId,
          vendorId: o.vendor_id || o.vendorId,
          client: o.customer_name || o.client_name || o.client?.companyName || o.client?.name || "",
          vendor: o.vendor_name || o.vendor?.name || "",
          total: totalVal,
          total_amount: totalVal,
          amount: totalVal,
          date: displayDate,
          order_date: orderDay || o.order_date,
          createdAt: o.created_at || o.createdAt,
          requestDate: displayDate,
          dueDate: dueDay,
          due_date: dueDay || o.due_date,
          status: statusForUi,
          statusLabel: displayOrderStatus(statusForUi),
          delivery_instructions:
            o.delivery_instructions || o.deliveryInstructions || meta.delivery_instructions || meta.deliveryInstructions || null,
          location: o.delivery_address || o.location || o.deliveryAddress || meta.delivery_address || meta.location || meta.deliveryAddress || "",
          pickupLocation: o.pickup_location || o.pickupLocation || meta.pickup_location || meta.pickupLocation || "",
          pickup_location: o.pickup_location || o.pickupLocation || meta.pickup_location || meta.pickupLocation || null,
          deliveryType: transportMode,
          deliveryMode: transportMode,
          delivery_mode: transportMode,
          mode: transportMode,
        };
      });
      setOrders(mappedOrders);
      return mappedOrders;
    } catch (e) {
      console.error("Fetch orders failed", e);
      return null;
    }
  }, []);

  const fetchMissions = React.useCallback(async () => {
    try {
      const res = await api.get("/missions");
      let rawData = res.data?.success
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      if (rawData && !Array.isArray(rawData) && typeof rawData === 'object') {
        rawData = rawData.data || rawData.items || rawData.orders || rawData.missions || rawData.invoices || rawData.projects || Object.values(rawData).find(Array.isArray) || [];
      }
      setMissions(
        rawData.map((m) => ({
          ...m,
          orderId: m.order_id || m.orderId,
          driverId: m.assigned_driver || m.assignedEmployeeId,
          driverName: m.driver_name || (m.assignee ? `${m.assignee.firstName} ${m.assignee.lastName}` : ""),
          vehicleId: m.vehicle_id || (m.metadata?.vehicleId),
          plateNumber: m.plate_number || (m.assignee && m.assignee.vehiclePlate) || "",
          missionType: m.mission_type || m.missionType,
          destinationType: m.destination_type,
          date: m.event_date
            ? m.event_date.split("T")[0]
            : m.created_at || m.createdAt
              ? (m.created_at || m.createdAt).split("T")[0]
              : "",
          id: m.missionNumber || m.id,
          db_id: m.id,
        })),
      );
    } catch (e) {
      console.error("Fetch missions failed", e);
    }
  }, []);

  const fetchFinance = React.useCallback(async () => {
    try {
      const res = await api.get("/invoices");
      let rawData = res.data?.success
        ? (res.data.data?.invoices || res.data.data)
        : Array.isArray(res.data)
          ? res.data
          : (res.data?.invoices || []);
      if (rawData && !Array.isArray(rawData) && typeof rawData === 'object') {
        rawData = rawData.data || rawData.items || rawData.orders || rawData.missions || rawData.invoices || rawData.projects || Object.values(rawData).find(Array.isArray) || [];
      }
      setInvoices(
        rawData.map((i) => {
          const paidAmount = i.paidAmount || (i.payments ? i.payments.reduce((sum, p) => sum + p.amount, 0) : 0);
          return {
            ...i,
            orderId: i.orderId || i.order_id,
            clientId: i.clientId || i.client_id,
            totalAmount: parseFloat(i.totalAmount || i.amount || 0),
            paidAmount: parseFloat(paidAmount),
            date: i.invoiceDate || i.date || i.created_at || i.createdAt ? (i.invoiceDate || i.date || i.created_at || i.createdAt).split("T")[0] : "",
            dueDate: i.dueDate || i.due_date ? (i.dueDate || i.due_date).split("T")[0] : "",
            clientName: i.clientName || i.client_name || i.client?.companyName || i.client?.name || "",
          };
        }),
      );
    } catch (e) {
      console.error("Fetch finance failed", e);
    }
  }, []);

  const fetchProjects = React.useCallback(async () => {
    const mapStatusToFrontend = (status) => {
      switch (status?.toLowerCase()) {
        case "planned":
          return "Pending";
        case "in_progress":
          return "In Progress";
        case "completed":
          return "Completed";
        case "on_hold":
          return "Cancelled";
        default:
          return status || "Pending";
      }
    };

    try {
      const res = await api.get(`/orders/projects/all?_t=${Date.now()}`);
      let rawData = res.data?.success
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      if (rawData && !Array.isArray(rawData) && typeof rawData === 'object') {
        rawData = rawData.data || rawData.items || rawData.orders || rawData.missions || rawData.invoices || rawData.projects || Object.values(rawData).find(Array.isArray) || [];
      }
      setProjects(
        rawData.map((p) => ({
          ...p,
          orderId: p.order_id || p.orderId,
          managerId: p.manager_id || p.managerId,
          companyId: p.company_id || p.companyId,
          customerId: p.customer_id || p.customerId,
          clientId: p.clientId || p.customer_id || p.company_id,
          client: p.client || p.client_name,
          status: mapStatusToFrontend(p.status),
          start: p.start || (p.start_date ? (() => {
            const d = new Date(p.start_date);
            if (isNaN(d.getTime())) return p.start_date.split("T")[0];
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          })() : ""),
          end: p.end || (p.end_date ? (() => {
            const d = new Date(p.end_date);
            if (isNaN(d.getTime())) return p.end_date.split("T")[0];
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          })() : ""),
          deliveryType: p.deliveryType || p.delivery_type || "Road",
        })),
      );
    } catch (e) {
      console.error("Fetch projects failed", e);
    }
  }, []);

  const fetchSupportingDocs = React.useCallback(async () => {
    try {
      const [assignments, leave] = await Promise.all([
        api
          .get("/missions")
          .catch((e) => ({ data: { success: false, data: [] } })),
        api
          .get("/staff/leave")
          .catch((e) => ({ data: { success: false, data: [] } })),
      ]);

      if (assignments.data?.success) {
        // Map backend missions to frontend staffAssignments structure
        const mapped = (assignments.data.data.missions || assignments.data.data || []).map(m => ({
          id: m.missionNumber || m.id,
          rawId: m.id,
          source: 'mission',
          task: m.metadata?.task || m.missionType,
          location: m.metadata?.location || m.delivery?.dropLocation || m.delivery?.pickupLocation || (m.delivery?.client?.address ? [m.delivery.client.address, m.delivery.client.city, m.delivery.client.country].filter(Boolean).join(', ') : '') || 'N/A',
          assignee: m.assignee ? `${m.assignee.firstName} ${m.assignee.lastName}` : 'System',
          assigneeId: m.assignedEmployeeId,
          priority: m.metadata?.priority || 'Normal',
          status: m.status
        }));
        setStaffAssignments(mapped);
      } else if (Array.isArray(assignments.data)) {
        setStaffAssignments(assignments.data);
      }

      if (leave.data?.success) {
        setLeaveRequests(leave.data.data);
      } else if (Array.isArray(leave.data)) {
        setLeaveRequests(leave.data);
      }
    } catch (e) {
      console.error("Fetch supporting docs failed", e);
    }
  }, [currentUser?.id]);

  const fetchWarehouses = React.useCallback(async () => {
    try {
      const res = await api.get("/warehouses");
      if (res.data?.success) {
        const data = res.data.data;
        setWarehouses(data?.warehouses ? data.warehouses : (Array.isArray(data) ? data : []));
      }
    } catch (e) {
      console.error("Fetch warehouses failed", e);
    }
  }, []);

  const fetchTickets = React.useCallback(async () => {
    try {
      const [tickets, eventsData, guestReqs] = await Promise.all([
        api.get(`/support/tickets?_t=${Date.now()}`).catch((e) => ({ data: [] })),
        api.get(`/support/events?_t=${Date.now()}`).catch((e) => ({ data: [] })),
        api.get(`/support/guest-requests?_t=${Date.now()}`).catch((e) => ({ data: [] })),
      ]);
      if (tickets.data?.success) {
        const formatStatus = (s) => {
          if (!s) return "Open";
          return String(s)
            .split(/[_\s]+/)
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" ");
        };

        const mapped = tickets.data.data.map((t) => {
          let msgs = [];
          if (t.messages) {
            try {
              msgs =
                typeof t.messages === "string"
                  ? JSON.parse(t.messages)
                  : t.messages;
            } catch (e) {
              msgs = [];
            }
          }
          if (!Array.isArray(msgs) || msgs.length === 0) {
            msgs = [
              {
                sender: "client",
                text: t.description || "No description provided.",
                time: new Date(t.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            ];
          }

          return {
            id: String(t.id).startsWith("TKT-") ? t.id : `TKT-${String(t.id).padStart(3, "0")}`,
            db_id: t.id,
            // preserve original backend identification fields to satisfy global filters
            submitted_by: t.submitted_by ?? t.createdById ?? null,
            created_by: t.submitted_by ?? t.created_by ?? t.createdById ?? null,
            user_id: t.submitted_by ?? t.user_id ?? t.createdById ?? null,
            clientName: t.submitted_by_name || t.createdByName || "System User",
            clientId: t.client_id ?? t.company_id ?? t.clientId ?? null,
            createdById: t.created_by ?? t.user_id ?? t.createdById ?? null,
            createdByEmail: t.created_by_email || t.email || t.createdByEmail || null,
            createdByName: t.submitted_by_name || t.created_by_name || t.createdByName || null,
            subject: t.subject || t.title,
            category: t.category || "General",
            priority: t.priority
              ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1)
              : "Medium",
            status: formatStatus(t.status),
            date: t.created_at ? t.created_at.split("T")[0] : "",
            messages: msgs,
          };
        });
        setRawSupportTickets(mapped);
        // Always apply filter immediately if user is available; otherwise the
        // useEffect above will re-apply once currentUser resolves (no wipe).
        if (currentUser) setSupportTickets(filterDataForCurrentUser(mapped));
      }
      if (eventsData.data?.success) {
        const eventsList = Array.isArray(eventsData.data.data) ? eventsData.data.data : [];
        const mappedEvents = eventsList.map((e) => {
          const clientName = e.client_name || e.client?.companyName || e.client?.name || "";
          return {
            ...e,
            title: e.name || e.title,
            client_name: clientName,
            client: clientName || e.client,
            date: e.event_date ? e.event_date.split("T")[0] : e.date ? e.date.split("T")[0] : "",
            imageUrl: e.image_url || e.imageUrl,
            plannerName: e.planner_name || e.plannerName,
            specialRequests: e.special_requests || e.specialRequests,
            guestCount: e.guest_count || e.guestCount,
            moodBoardUrl: e.mood_board_url || e.moodBoardUrl,
            client_id: e.client_id || e.clientId,
            manager_id: e.manager_id || e.managerId,
          };
        });
        // Store raw events so the filter-effect can re-apply when user loads
        setRawEvents(mappedEvents);
        if (currentUser) setEvents(filterDataForCurrentUser(mappedEvents));
      }
      if (guestReqs.data?.success) {
        const capitalizePriority = (p) =>
          p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "Medium";
        const reqsList = Array.isArray(guestReqs.data.data) ? guestReqs.data.data : [];
        const mappedGuest = reqsList.map((r) => {
          let parsedDate = "";
          let parsedTime = "";
          if (r.delivery_time) {
            try {
              const dt = new Date(r.delivery_time);
              if (!isNaN(dt.getTime())) {
                const year = dt.getFullYear();
                const month = String(dt.getMonth() + 1).padStart(2, "0");
                const day = String(dt.getDate()).padStart(2, "0");
                parsedDate = `${year}-${month}-${day}`;

                let hours = dt.getHours();
                const ampm = hours >= 12 ? "PM" : "AM";
                hours = hours % 12;
                hours = hours ? hours : 12;
                const minutes = String(dt.getMinutes()).padStart(2, "0");
                parsedTime = `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
              }
            } catch (err) {
              parsedDate = String(r.delivery_time).split("T")[0];
              parsedTime = String(r.delivery_time).split("T")[1]?.substring(0, 5) || "";
            }
          }
          return {
            ...r,
            request: r.request_details,
            requestedBy: r.requested_by,
            time: parsedTime || r.delivery_time || "",
            date: parsedDate || (r.created_at ? r.created_at.split("T")[0] : ""),
            guest: r.guest || r.guestName || r.client_name || "VIP Suite",
            priority: capitalizePriority(r.priority),
          };
        });
        // Store raw guest requests so the filter-effect can re-apply when user loads
        setRawGuestRequests(mappedGuest);
        if (currentUser) setGuestRequests(filterDataForCurrentUser(mappedGuest));
      }
    } catch (e) {
      console.error("Fetch tickets failed", e);
    }
  }, [currentUser, filterDataForCurrentUser]);

  const fetchLuxuryItems = React.useCallback(async () => {
    try {
      const res = await api.get("/concierge/luxury-items");
      const luxuryData = res.data?.success
        ? (Array.isArray(res.data.data) ? res.data.data : [])
        : Array.isArray(res.data)
          ? res.data
          : [];
      const mapped = (luxuryData || []).map((item) => ({
        id: item.id || item.itemId,
        item: item.item_name || item.name || 'Unknown Item',
        owner: item.owner_name || item.owner || 'Unknown Beneficiary',
        vault: item.vault_location || item.vault || 'Vault Alpha',
        status: item.status || 'Stored',
        value: item.estimated_value || item.value || item.price || 0,
        notes: item.notes || '',
      }));
      setLuxuryItems(filterDataForCurrentUser(mapped));
    } catch (e) {
      console.error("Fetch luxury items failed", e);
    }
  }, []);

  const fetchDashboardStats = React.useCallback(async (filter) => {
    try {
      const filterParam = filter || revenueFilter || 'Monthly';
      const res = await api.get(`/dashboard/stats?revenueFilter=${encodeURIComponent(filterParam)}`);
      if (res.data?.success) setDashboardStats(res.data.data);
    } catch (e) {
      console.error("Fetch dashboard stats failed", e);
    }
  }, [revenueFilter]);

  const fetchDashboardLogs = React.useCallback(async () => {
    try {
      const res = await api.get("/dashboard/logs");
      if (res.data?.success) {
        setLogs(res.data.data.map(audit => ({
          action: audit.action || "System Action",
          detail: audit.detail || "System event recorded",
          type: "system",
          time: audit.timestamp ? new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Unknown Time"
        })));
      }
    } catch (e) {
      console.error("Fetch dashboard logs failed", e);
    }
  }, []);

  const fetchSystemSettings = React.useCallback(async () => {
    try {
      const res = await api.get("/settings/system");
      if (res.data?.success) setSystemSettings(res.data.data);
    } catch (e) {
      console.error("Fetch system settings failed", e);
    }
  }, []);

  const fetchDeliveryPricing = React.useCallback(async () => {
    try {
      const res = await api.get("/logistics/pricing");
      if (res.data?.success) setDeliveryPricing(res.data.data);
    } catch (e) {
      console.error("Fetch delivery pricing failed", e);
    }
  }, []);

  const DISMISSED_ALERTS_KEY = "zz_dismissed_inv_alerts";

  const fetchInventoryAlerts = React.useCallback(async () => {
    let dismissed = [];
    try {
      dismissed = JSON.parse(
        localStorage.getItem(DISMISSED_ALERTS_KEY) || "[]",
      );
    } catch {
      dismissed = [];
    }
    const dismissedSet = new Set(dismissed.map(String));
    try {
      const res = await api.get("/inventory/alerts");
      if (res.data?.success) {
        const mapped = res.data.data.map((i) => ({
          id: i.id,
          name: i.name,
          qty: i.quantity,
          threshold: i.threshold,
          status:
            i.status === "low_stock"
              ? "Warning"
              : i.status === "out_of_stock"
                ? "Critical"
                : i.status,
          location: i.warehouse_name || "General Storage",
        }));
        setInventoryAlerts(
          mapped.filter((a) => !dismissedSet.has(String(a.id))),
        );
      }
    } catch (e) {
      console.error("Fetch inventory alerts failed", e);
    }
  }, []);

  const acknowledgeInventoryAlert = React.useCallback((alertId) => {
    const idStr = String(alertId);
    setInventoryAlerts((prev) => prev.filter((a) => String(a.id) !== idStr));
    try {
      const arr = JSON.parse(
        localStorage.getItem(DISMISSED_ALERTS_KEY) || "[]",
      );
      if (!arr.includes(idStr)) {
        arr.push(idStr);
        localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(arr));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      if (res.data?.success) {
        // Backend already scopes notifications to the current user via user_id and role_target+company_id.
        // No additional client-side filtering needed — this prevents false notifications for new accounts.
        let notifs = res.data.data || [];

        // Ignore default mock notifications that leak from outdated mockApi fallback
        notifs = notifs.filter(n => {
          const title = n.title || '';
          const msg = n.message || '';
          const isDefaultMock1 = title === "New Purchase Order" && msg.includes("PO-001");
          const isDefaultMock2 = title === "Critical Stock Alert" && msg.includes("Dom Perignon");
          return !isDefaultMock1 && !isDefaultMock2;
        });

        setNotifications(notifs);
        // Compute unread count directly from the scoped list to prevent phantom badges
        setUnreadCount(notifs.filter(n => !(n.isRead || n.is_read)).length);
      }
    } catch (e) {
      console.error("Fetch notifications failed", e);
    }
  }, [currentUser]);

  const fetchUnreadCount = React.useCallback(async () => {
    // Disabled: Unread count is now calculated accurately from fetchNotifications.
    // This prevents phantom badges where the backend unread-count endpoint includes unscoped items.
  }, []);

  const markNotificationRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Mark read failed", e);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.put("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Mark all read failed", e);
    }
  };

  // Poll for new notifications every 15 seconds
  React.useEffect(() => {
    if (!currentUser || !localStorage.getItem("token")) return;
    fetchNotifications();
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 15000);
    return () => clearInterval(interval);
  }, [currentUser, fetchNotifications, fetchUnreadCount]);

  const fetchInitialData = async () => {
    if (!localStorage.getItem("token")) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const role = normalizeRole(currentUser?.role);
      // Roles that have access to Personnel (users) endpoint
      const canAccessUsers = ["superadmin", "admin", "saas_client", "operations"].includes(role);
      // Roles that have access to Security (roles) endpoint
      const canAccessRoles = ["superadmin", "admin", "saas_client"].includes(role);
      const canAccessStock = ["superadmin", "admin", "operations", "inventory", "inventorymanager", "procurement", "logistics"].includes(role);

      const fetches = [
        fetchDashboardStats(),
        fetchDashboardLogs(),
        fetchSystemSettings(),
        fetchInventoryAlerts(),
        fetchTracking(),
        fetchUrgentTasks(),
        fetchTickets(),
        fetchNotifications(),
      ];

      if (canAccessStock) {
        fetches.push(fetchStockMovements());
        fetches.push(fetchLossAssessments());
      }

      // Only fetch users if the role has Personnel menu permission
      if (canAccessUsers) {
        fetches.push(fetchStaff());
      }

      // If the user is staff, fetch their specific data
      if (
        ["staff", "operations", "logistics", "inventory"].includes(role)
      ) {
        fetches.push(fetchSupportingDocs());
        fetches.push(fetchDeliveries());
        fetches.push(fetchPayHistory());
      }

      // Only fetch roles if the role has Security menu permission or can access users
      if (canAccessRoles || canAccessUsers) {
        fetches.push(api.get('/roles?limit=100').then(res => {
          const rawData = res.data?.data;
          const rolesArray = Array.isArray(rawData) ? rawData : (rawData?.roles || []);
          setRoles(rolesArray);
        }).catch(() => { }));
      }
      await Promise.all(fetches);
    } catch (err) {
      console.error("Error fetching initial context data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial Data Fetch
  useEffect(() => {
    if (currentUser && localStorage.getItem("token")) {
      if (lastFetchedUserIdRef.current !== currentUser.id) {
        lastFetchedUserIdRef.current = currentUser.id;
        fetchInitialData();
      }
    } else {
      lastFetchedUserIdRef.current = null;
    }
  }, [currentUser]);

  // Keep support / concierge tickets and guest requests refreshed across roles.
  useEffect(() => {
    if (!currentUser || !localStorage.getItem("token")) return;
    fetchTickets();
  }, [currentUser, fetchTickets]);

  // Keep cross-portal operational state in sync when another role changes an order or delivery.
  // Only fetch orders for roles that have the "Orders" menu permission.
  useEffect(() => {
    if (!currentUser || !localStorage.getItem("token")) return;
    const role = normalizeRole(currentUser?.role);
    // Roles that have access to Orders endpoint
    const canAccessOrders = ["superadmin", "admin", "saas_client", "operations", "logistics", "concierge"].includes(role);
    const canAccessProjects = ["superadmin", "admin", "saas_client", "operations"].includes(role);
    const canAccessDeliveries = ["superadmin", "admin", "saas_client", "operations", "logistics", "driver"].includes(role);

    const refreshOperationalState = () => {
      if (canAccessOrders) fetchOrders();
      if (canAccessDeliveries) fetchDeliveries();
      if (canAccessProjects) fetchProjects();
    };
    refreshOperationalState();
    const interval = setInterval(refreshOperationalState, 10000); // Poll every 10 seconds for cross-portal sync
    return () => clearInterval(interval);
  }, [currentUser, fetchOrders, fetchDeliveries, fetchProjects]);

  const recordLoss = async (loss) => {
    try {
      const item = inventory.find((i) => i.name === loss.item);
      if (!item) return;

      const res = await api.post(`/inventory/${item.id}/adjust`, {
        quantity: loss.qty,
        type: "loss",
        reason: loss.reason,
      });

      if (res.data?.success) {
        setInventory((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, ...res.data.data, qty: res.data.data.quantity }
              : i,
          ),
        );
        await fetchStockMovements();
        addLog({
          action: "Asset Loss Recorded",
          detail: `Loss of ${loss.qty} units for ${loss.item} noted: ${loss.reason || "No reason provided"}. Auditor notified.`,
          type: "inventory",
        });
      }
    } catch (error) {
      console.error("Failed to record loss:", error);
    }
  };

  const addStockEntry = async (entry) => {
    try {
      const item = inventory.find((i) => i.name === entry.item);
      if (item) {
        const res = await api.post(`/inventory/${item.id}/adjust`, {
          quantity: entry.qty,
          type: "entry",
          reference_type: entry.prRef ? "purchase_request" : null,
          reference_id: entry.prRef || null,
        });

        if (res.data?.success) {
          const qtyAfter =
            parseInt(
              res.data.data.quantity ?? res.data.data.qty ?? item.qty,
              10,
            ) || 0;
          const categoryForApi = canonicalMarketplaceCategory(
            entry.category ?? item.category,
          );
          try {
            if (entry.imageFile) {
              const formData = new FormData();
              formData.append("name", item.name);
              formData.append("category", categoryForApi);
              formData.append("price", String(parseFloat(item.price) || 0));
              formData.append("quantity", String(qtyAfter));
              appendInventoryFk(
                formData,
                "warehouse_id",
                item.warehouse_id ?? item.warehouseId,
              );
              appendInventoryFk(
                formData,
                "vendor_id",
                item.vendor_id ?? item.vendorId,
              );
              appendInventoryFk(
                formData,
                "client_id",
                item.client_id ?? item.clientId,
              );
              formData.append(
                "company_id",
                String(
                  resolveInventoryCompanyId(
                    currentUser,
                    item.company_id ?? item.companyId,
                  ),
                ),
              );
              formData.append("image", entry.imageFile);
              await api.put(`/inventory/${item.id}`, formData);
            } else {
              await api.put(`/inventory/${item.id}`, {
                name: item.name,
                category: categoryForApi,
                price: parseFloat(item.price) || 0,
                quantity: qtyAfter,
                warehouse_id: nullablePositiveInt(
                  item.warehouse_id ?? item.warehouseId,
                ),
                vendor_id: nullablePositiveInt(item.vendor_id ?? item.vendorId),
                client_id: nullablePositiveInt(item.client_id ?? item.clientId),
                company_id: resolveInventoryCompanyId(
                  currentUser,
                  item.company_id ?? item.companyId,
                ),
              });
            }
          } catch (e) {
            console.warn("Inventory category sync after stock entry failed", e);
          }

          await fetchInventory();
          await fetchStockMovements();

          if (entry.prRef) {
            setPurchaseRequests((prev) =>
              prev.map((pr) =>
                pr.id === entry.prRef ? { ...pr, status: "Received" } : pr,
              ),
            );
          }

          addLog({
            action: "Stock Entry",
            detail: `Procured ${entry.qty} units of ${entry.item} from ${entry.vendor || entry.vendorName || "Unknown Partner"}.`,
            type: "inventory",
          });
          return { ok: true };
        }
      } else {
        const imageUrl =
          entry.image_url || entry.imageUrl || entry.image || null;
        let res;

        if (entry.imageFile) {
          const formData = new FormData();
          formData.append("name", entry.item || "");
          formData.append(
            "category",
            canonicalMarketplaceCategory(entry.category),
          );
          formData.append("price", String(parseFloat(entry.price) || 0));
          formData.append("quantity", String(parseInt(entry.qty) || 0));
          appendInventoryFk(
            formData,
            "warehouse_id",
            entry.warehouseId ?? entry.warehouse_id,
          );
          formData.append(
            "inventory_type",
            entry.inventoryType || "Marketplace",
          );
          appendInventoryFk(formData, "client_id", entry.clientId);
          formData.append(
            "sku",
            entry.sku || `SKU-${Math.floor(Math.random() * 100000)}`,
          );
          appendInventoryFk(
            formData,
            "vendor_id",
            entry.vendorId ?? entry.vendor_id,
          );
          if (imageUrl) formData.append("image_url", String(imageUrl));
          formData.append(
            "company_id",
            String(
              resolveInventoryCompanyId(
                currentUser,
                entry.company_id ?? entry.companyId,
              ),
            ),
          );
          formData.append("image", entry.imageFile);

          res = await api.post("/inventory", formData);
        } else {
          const reqData = {
            name: entry.item,
            category: canonicalMarketplaceCategory(entry.category),
            price: entry.price,
            quantity: entry.qty,
            warehouse_id: nullablePositiveInt(
              entry.warehouseId ?? entry.warehouse_id,
            ),
            vendor_id: nullablePositiveInt(entry.vendorId ?? entry.vendor_id),
            inventory_type: entry.inventoryType || "Marketplace",
            client_id: nullablePositiveInt(entry.clientId),
            company_id: resolveInventoryCompanyId(
              currentUser,
              entry.company_id ?? entry.companyId,
            ),
            image_url: imageUrl,
            sku: entry.sku || `SKU-${Math.floor(Math.random() * 100000)}`,
          };
          res = await api.post("/inventory", reqData);
        }

        if (inventoryWriteResponseOk(res)) {
          // Re-fetch to ensure correct mapping
          await fetchInventory();
          await fetchStockMovements();
          addLog({
            action: "Stock Entry",
            detail: `Procured ${entry.qty} units of ${entry.item} from ${entry.vendor || entry.vendorName || "Unknown Partner"}.`,
            type: "inventory",
          });
          return { ok: true };
        }
      }
      return { ok: false, error: "Stock entry did not complete." };
    } catch (error) {
      console.error("Failed to add stock entry:", error);
      return {
        ok: false,
        error:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to add stock entry.",
      };
    }
  };

  const issueStock = async (issue) => {
    try {
      const item = inventory.find((i) => i.name === issue.item);
      if (!item) return;

      const res = await api.post(`/inventory/${item.id}/adjust`, {
        quantity: issue.qty,
        type: "issue",
        reference_type: issue.projectRef ? "project" : "client",
        reference_id: issue.projectRef || issue.clientId || null,
      });

      if (res.data?.success) {
        const updatedItem = {
          ...item,
          ...res.data.data,
          qty: res.data.data.quantity,
        };
        setInventory((prev) =>
          prev.map((i) => (i.id === item.id ? updatedItem : i)),
        );
        await fetchStockMovements();

        // Automate low stock alert if needed (local check after update)
        if (updatedItem.qty < 10) {
          addLog({
            action: "Automated Procurement Alert",
            detail: `Low stock detected for ${issue.item}. System generated auto-PR.`,
            type: "automated",
          });
        }

        addLog({
          action: "Stock Issue",
          detail: `Issued ${issue.qty} units of ${issue.item} to ${issue.client || issue.issuedTo}.`,
          type: "inventory",
        });
      }
    } catch (error) {
      console.error("Failed to issue stock:", error);
    }
  };

  const addPlan = async (plan) => {
    try {
      const priceNum = parseFloat(String(plan.price).replace(/[^0-9.-]+/g, "")) || 0;
      const yearlyPriceNum = parseFloat(String(plan.yearlyPrice).replace(/[^0-9.-]+/g, "")) || 0;
      const apiPayload = {
        name: plan.name,
        description: plan.description || "",
        price: priceNum,
        billingCycle: "MONTHLY",
        maxUsers: 100,
        maxStorage: 1024,
        features: {
          tier: plan.tier || "",
          yearlyPrice: yearlyPriceNum,
          commitment: plan.commitment || "",
          list: plan.features || []
        }
      };
      await api.post("/plans", apiPayload);
      addLog({
        action: "Plan Created",
        detail: `Super Admin created new protocol: ${plan.name}`,
        type: "system",
      });
      await fetchAccessPlans();
    } catch (error) {
      console.error("Failed to add access plan:", error);
      if (!silentUi) window.alert(`Failed to add plan: ${error?.response?.data?.message || error.message}`);
    }
  };

  const updatePlan = async (updated) => {
    try {
      const priceNum = parseFloat(String(updated.price).replace(/[^0-9.-]+/g, "")) || 0;
      const yearlyPriceNum = parseFloat(String(updated.yearlyPrice).replace(/[^0-9.-]+/g, "")) || 0;
      const apiPayload = {
        name: updated.name,
        description: updated.description || "",
        price: priceNum,
        billingCycle: "MONTHLY",
        features: {
          tier: updated.tier || "",
          yearlyPrice: yearlyPriceNum,
          commitment: updated.commitment || "",
          list: updated.features || []
        }
      };
      await api.put(`/plans/${updated.id}`, apiPayload);
      addLog({
        action: "Plan Updated",
        detail: `Super Admin modified protocol: ${updated.name}`,
        type: "system",
      });
      await fetchAccessPlans();
    } catch (error) {
      console.error("Failed to update access plan:", error);
      if (!silentUi) window.alert(`Failed to update plan: ${error?.response?.data?.message || error.message}`);
    }
  };

  const deletePlan = async (id) => {
    try {
      await api.delete(`/plans/${id}`);
      addLog({
        action: "Plan Deleted",
        detail: `Super Admin removed protocol ID: ${id}`,
        type: "system",
      });
      await fetchAccessPlans();
    } catch (error) {
      console.error("Failed to delete access plan:", error);
    }
  };

  const registerSaaSClient = async (formData) => {
    try {
      const res = await api.post("/clients", {
        name: formData.clientName,
        email: formData.email,
        phone: formData.phone || "0000000000",
        password: formData.password || "Password123!", // Default password for initial setup
        location: formData.country || "Bahamas",
        client_type: "SaaS",
        plan: formData.plan.replace(" Protocol", ""),
        billing_cycle: "Monthly",
        payment_method: "Credit Card",
        clientCode: `CLT-${Date.now().toString().slice(-6)}`,
        companyName: formData.clientName || "Unknown Company",
        contactPerson: formData.contact || "Admin",
        country: formData.country || "Bahamas",
        status: "active",
      });

      if (res.data?.success) {
        await fetchClients();
        addLog({
          action: "SaaS Registration",
          detail: `New SaaS client ${formData.clientName} registered via Landing Page.`,
          type: "system",
        });
        return res.data.data;
      }
    } catch (error) {
      console.error("Failed to register SaaS client:", error);
      throw error;
    }
  };

  const dispatchSubscriptionRequest = async (request) => {
    try {
      const res = await api.post("/saas/submit", request);
      return res.data;
    } catch (error) {
      console.error("Failed to submit SaaS request:", error);
      throw error;
    }
  };

  const updateSubscriptionRequest = async (id, status) => {
    try {
      if (status === "Approved") {
        // Call the provisioning endpoint which creates user + client in DB
        const res = await api.post(`/saas/requests/${id}/provision`);
        if (res.data?.success) {
          setSubscriptionRequests((prev) =>
            prev.map((req) =>
              String(req.id) === String(id)
                ? { ...req, status: "Provisioned" }
                : req,
            ),
          );

          // Refresh clients list to include the new client
          await fetchClients();

          addLog({
            action: "Request Approved",
            detail: `Provisioned workspace for ${res.data.data.clientName}. Protocol: ${res.data.data.plan}. Credentials generated for ${res.data.data.email}.`,
            type: "system",
          });

          return res.data.data; // { clientId, clientName, email, password, plan }
        }
      } else {
        // For Rejected or other status updates
        const res = await api.put(`/saas/requests/${id}/status`, { status });
        if (res.data?.success) {
          setSubscriptionRequests((prev) =>
            prev.map((req) =>
              String(req.id) === String(id) ? { ...req, status } : req,
            ),
          );

          const req = (subscriptionRequests || []).find((r) => r.id === id);
          if (req) {
            addLog({
              action: "Request Updated",
              detail: `Registration for ${req.clientName} marked as ${status}.`,
              type: "alert",
            });
          }
        }
      }
    } catch (error) {
      console.error("Failed to update subscription request:", error);
      const errMsg = error.response?.data?.message || "Provisioning failed";
      alert(errMsg);
    }
    return null;
  };

  const deleteSubscriptionRequest = async (id) => {
    try {
      const res = await api.delete(`/saas/requests/${id}`);
      if (res.data?.success) {
        setSubscriptionRequests((prev) => prev.filter((req) => req.id !== id));
        addLog({
          action: "Request Purged",
          detail: `Institutional request ${id} removed from queue.`,
          type: "alert",
        });
      }
    } catch (error) {
      console.error("Failed to delete subscription request:", error);
    }
  };

  const getRevenueChartData = () => {
    const now = new Date();
    const dataMap = {};

    const paidInvoices = invoices.filter((inv) => inv.status?.toLowerCase() === "paid");

    if (revenueFilter === "Daily") {
      // Last 24 hours in 2-hour blocks
      for (let i = 0; i < 24; i += 2) {
        const hour = String(i).padStart(2, "0") + ":00";
        dataMap[hour] = 0;
      }
      paidInvoices.forEach((inv) => {
        const date = new Date(inv.date);
        if (now.getTime() - date.getTime() < 86400000) {
          const hour = Math.floor(date.getHours() / 2) * 2;
          const key = String(hour).padStart(2, "0") + ":00";
          if (dataMap[key] !== undefined)
            dataMap[key] += Number(inv.totalAmount);
        }
      });
    } else if (revenueFilter === "Weekly") {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      days.forEach((d) => (dataMap[d] = 0));
      paidInvoices.forEach((inv) => {
        const date = new Date(inv.date);
        if (now.getTime() - date.getTime() < 7 * 86400000) {
          const day = days[date.getDay()];
          dataMap[day] += Number(inv.totalAmount);
        }
      });
    } else if (revenueFilter === "Monthly") {
      ["Week 1", "Week 2", "Week 3", "Week 4"].forEach((w) => (dataMap[w] = 0));
      paidInvoices.forEach((inv) => {
        const date = new Date(inv.date);
        if (
          now.getMonth() === date.getMonth() &&
          now.getFullYear() === date.getFullYear()
        ) {
          const week = Math.min(4, Math.ceil(date.getDate() / 7));
          dataMap[`Week ${week}`] += Number(inv.totalAmount);
        }
      });
    } else {
      // Generic fallback or larger grouping
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      months.forEach((m) => (dataMap[m] = 0));
      paidInvoices.forEach((inv) => {
        const date = new Date(inv.date);
        if (now.getFullYear() === date.getFullYear()) {
          const month = months[date.getMonth()];
          dataMap[month] += Number(inv.totalAmount);
        }
      });
    }

    return Object.keys(dataMap).map((key) => ({
      name: key,
      revenue: dataMap[key],
    }));
  };

  // --- STAFF ACTIONS ---
  const addUser = async (user) => {
    try {
      const cleaned = { ...user };
      const normalizedCompanyId = normalizeCompanyIdForApi(
        cleaned.company_id ?? cleaned.companyId,
      );

      if (normalizedCompanyId === undefined) {
        delete cleaned.company_id;
        delete cleaned.companyId;
      } else {
        cleaned.company_id = normalizedCompanyId;
        cleaned.companyId = normalizedCompanyId;
      }

      const res = await api.post("/users", cleaned);
      if (res.data?.success) {
        await fetchStaff();
        addLog({
          action: "Staff Provisioned",
          detail: `Onboarded ${user.name} as ${user.role}.`,
          type: "system",
        });
        return res.data;
      }
    } catch (error) {
      console.error("Failed to add user:", error);
      const msg = error.response?.data?.message || "Failed to add user.";
      alert(msg);
      throw error;
    }
  };

  const updateUser = async (updated) => {
    try {
      const id = updated?.id;
      if (id == null) {
        console.error("updateUser: missing user id");
        return;
      }
      const safePayload = { ...updated };
      if (!safePayload.password) {
        delete safePayload.password;
      }
      const bank =
        safePayload?.bankingInfo?.bank ??
        safePayload.bankName ??
        safePayload.bank_name;
      const account =
        safePayload?.bankingInfo?.account ??
        safePayload.accountNumber ??
        safePayload.account_number;
      const routing =
        safePayload?.bankingInfo?.routing ??
        safePayload.routingNumber ??
        safePayload.routing_number;
      const payload = {
        ...safePayload,
        bank_name: bank,
        bankName: bank,
        account_number: account,
        accountNumber: account,
        routing_number: routing,
        routingNumber: routing,
        vacation_balance:
          safePayload.vacationBalance ?? safePayload.vacation_balance,
        vacationBalance:
          safePayload.vacationBalance ?? safePayload.vacation_balance,
      };

      const endpoint = String(id) === String(currentUser?.id) ? '/auth/profile' : `/users/${id}`;
      const res = await api.put(endpoint, payload);
      if (res.data?.success) {
        const apiUser = normalizeUserForUi(
          normalizeApiUserPayload(res.data.data),
        );
        const normalizedPayload = normalizeUserForUi(payload);

        const list = await fetchStaff();
        setUsers((prev) => {
          const baseList = Array.isArray(list) ? list : prev;
          if (!Array.isArray(baseList)) return prev;
          return baseList.map((u) => {
            if (String(u.id) !== String(id)) return u;
            return normalizeUserForUi(
              mergeUserFields(u, apiUser, normalizedPayload),
            );
          });
        });

        setCurrentUser((cur) => {
          if (!cur || String(cur.id) !== String(id)) return cur;
          const next = normalizeUserForUi(
            mergeUserFields(cur, apiUser, normalizedPayload),
          );
          try {
            localStorage.setItem("user", JSON.stringify(next));
          } catch (e) {
            console.error("Failed to persist user to localStorage", e);
          }
          return next;
        });

        addLog({
          action: "Staff Profile Modified",
          detail: `Updated record for ${safePayload.name || apiUser?.name || id}.`,
          type: "system",
        });
        return res.data;
      }
    } catch (error) {
      console.error("Failed to update user:", error);
      const msg = error.response?.data?.message || "Failed to update user.";
      alert(msg);
      throw error;
    }
  };

  const reviewStaff = async (id, status) => {
    try {
      // Try tenant-scoped review first (admin reviewing their own staff)
      // Falls back to super_admin staff-review endpoint
      try {
        await api.put(`/users/${id}/review`, { status });
      } catch (e) {
        await api.put(`/auth/staff-review/${id}`, { status });
      }

      // Re-fetch staff to update local state
      await fetchStaff();

      addLog({
        action: "Staff Review",
        detail: `Staff protocol ${status === "Active" ? "Activated" : "Denied"} for ID: ${id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to review staff:", error);
      alert("Error updating staff status.");
    }
  };

  const deleteUser = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      await fetchStaff();
      addLog({
        action: "Staff Terminated",
        detail: `Separated staff member ID: ${id}.`,
        type: "alert",
      });
    } catch (error) {
      console.error("Failed to delete user:", error);
      const msg = error.response?.data?.message || "Failed to delete user.";
      alert(msg);
      throw error;
    }
  };

  const deleteOrder = async (id) => {
    try {
      await api.delete(`/orders/${id}`);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      addLog({
        action: "Order Terminated",
        detail: `Protocol ${id} deleted from ledger.`,
        type: "alert",
      });
    } catch (error) {
      console.error("Failed to delete order:", error);
    }
  };

  const updateOrder = async (orderId, data) => {
    try {
      console.log(data)
      const numericParam =
        typeof orderId === "string"
          ? orderId.replace(/[^\d]/g, "") || orderId
          : orderId;

      // Status-only payloads (backward compat): string | { status }
      const isBareStatus =
        typeof data === "string" ||
        (data &&
          typeof data === "object" &&
          Object.keys(data).length === 1 &&
          Object.prototype.hasOwnProperty.call(data, "status"));

      if (isBareStatus) {
        const statusRaw = typeof data === "string" ? data : data.status;
        const normalized = normalizeOrderStatusForApi(statusRaw);
        if (!normalized) {
          alert(
            `Invalid workflow status "${statusRaw}". Use a known stage (e.g. admin_review, concierge, operation, logistics, completed).`,
          );
          return;
        }
        await api.patch(`/orders/${numericParam}/status`, {
          status: normalized,
        });
        setOrders((prev) =>
          prev.map((o) =>
            String(o.id) === String(orderId) ||
              String(o.id) === String(numericParam)
              ? { ...o, status: normalized }
              : o,
          ),
        );
        addLog({
          action: "Order Updated",
          detail: `Order ${orderId} status changed to ${normalized}.`,
          type: "system",
        });
        await fetchOrders();
        return;
      }

      const { status: uiStatusRaw, ...rest } = data;
      const normalizedFromForm = normalizeOrderStatusForApi(uiStatusRaw);
      let statusPatched = false;

      // PATCH status first: PUT can return 400 "No fields to update" when only status changed, which blocked saves.
      if (normalizedFromForm) {
        await api.patch(`/orders/${numericParam}/status`, {
          status: normalizedFromForm,
        });
        statusPatched = true;
      }

      const putCandidate = {
        client_id: rest.clientId ?? rest.client_id,
        company_id: rest.companyId ?? rest.company_id,
        vendor_id: rest.vendorId ?? rest.vendor_id,
        vendor_name: rest.vendorName ?? rest.vendor_name ?? rest.vendor,
        type: rest.type,
        items: rest.items,
        notes: rest.notes,
        location: rest.location,
        pickup_location: rest.pickupLocation ?? rest.pickup_location,
        total_amount: rest.total ?? rest.total_amount ?? rest.totalAmount,
        due_date: isoDateSlice(rest.dueDate || rest.due_date) || null,
        order_date:
          isoDateSlice(rest.date || rest.requestDate || rest.order_date) ||
          undefined,
        deliveryType: rest.deliveryType ?? rest.deliveryMode ?? rest.mode,
      };
      const putBody = {};
      for (const [k, val] of Object.entries(putCandidate)) {
        if (val === undefined) continue;
        if (val === "" && ["client_id", "vendor_id", "company_id"].includes(k))
          continue;
        putBody[k] = val;
      }
      if (Object.keys(putBody).length > 0) {
        try {
          await api.put(`/orders/${numericParam}`, putBody);
        } catch (putError) {
          // Keep status change durable even if generic profile update fails.
          if (!statusPatched) throw putError;
          console.warn(
            "Order detail PUT failed after successful status PATCH:",
            putError?.response?.data || putError?.message,
          );
        }
      }

      await fetchOrders();
      addLog({
        action: "Order Updated",
        detail: `Order ${orderId} parameters recalibrated.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update order:", error);
      const msg = error.response?.data?.message || "";
      alert(msg || "Failed to update order.");
    }
  };

  const assignOrderToStage = async (
    orderId,
    stage,
    assignedTo = null,
    notes = null,
  ) => {
    try {
      const res = await api.put(`/orders/${orderId}/assign`, {
        stage,
        assigned_to: assignedTo,
        notes,
      });
      if (res.data?.success) {
        await fetchOrders();
        const stageNorm = String(stage || "").toLowerCase();
        if (stageNorm === "logistics" && orderId != null) {
          try {
            const delRes = await api.get("/deliveries");
            const rawDel = delRes.data?.success ? delRes.data.data : [];
            const hasForOrder =
              Array.isArray(rawDel) &&
              rawDel.some((d) => Number(d.order_id) === Number(orderId));
            if (!hasForOrder) {
              const ordRes = await api.get("/orders");
              const ordList = ordRes.data?.success
                ? ordRes.data.data
                : Array.isArray(ordRes.data)
                  ? ordRes.data
                  : [];
              const o = ordList.find((x) => String(x.id) === String(orderId));
              if (o) {
                let parsedItems = o.items;
                if (typeof parsedItems === "string") {
                  try {
                    parsedItems = JSON.parse(parsedItems);
                  } catch {
                    parsedItems = [];
                  }
                }
                const itemsArr = Array.isArray(parsedItems) ? parsedItems : [];
                const totalAmountVal = mapOrderDisplayTotal(o, itemsArr);
                const orderDateVal = isoDateSlice(o.order_date || o.created_at);
                const dueVal = isoDateSlice(o.due_date);
                const dropAddr =
                  o.delivery_address || o.location || o.deliveryAddress || "";
                const firstItemName = itemsArr[0]?.name || "Order";
                await addDelivery({
                  orderId,
                  company_id: o.company_id ?? null,
                  client_id: o.client_id ?? o.customer_id ?? null,
                  customer_id: o.customer_id ?? null,
                  missionType: "Delivery",
                  location: dropAddr,
                  driver: "",
                  vehicleId: "",
                  items: itemsArr,
                  pickupLocation: "Fulfilment Hub",
                  dropLocation: dropAddr,
                  dueDate: dueVal || orderDateVal,
                  status: "Pending Pickup",
                  delivery_instructions:
                    o.delivery_instructions || o.deliveryInstructions || null,
                  delivery_fee: 0, // Staff payout is set separately in Deliveries form (distance × rate/km)
                });
                await addStaffAssignment({
                  assigneeId: assignedTo ?? null,
                  task: `Dispatch Order #${orderId} - ${firstItemName}`,
                  location: dropAddr || "Client location",
                  status: "Pending",
                  priority: "Normal",
                  missionType: "Delivery",
                  pickupLocation: "Fulfilment Hub",
                  deliveryLocation: dropAddr || "",
                });
              }
            }
          } catch (ensureErr) {
            console.warn(
              "Could not ensure delivery queue after logistics stage:",
              ensureErr?.response?.data || ensureErr?.message,
            );
          }
        } else if (stageNorm === "concierge" && orderId != null) {
          try {
            const ordRes = await api.get("/orders");
            const ordList = ordRes.data?.success
              ? ordRes.data.data
              : Array.isArray(ordRes.data)
                ? ordRes.data
                : [];
            const o = ordList.find((x) => String(x.id) === String(orderId));
            if (o) {
              const customLabel =
                String(
                  o.custom_request_category || o.customRequestCategory || "",
                )
                  .replace(/_/g, " ")
                  .trim() || "Custom request";
              const dropAddr =
                o.delivery_address || o.location || o.deliveryAddress || "";
              await addStaffAssignment({
                assigneeId: assignedTo ?? null,
                task: `Concierge triage: Order #${orderId} — ${customLabel}`,
                location: dropAddr || "Client location",
                status: "Pending",
                priority: "High",
                missionType: "Concierge",
                pickupLocation: "Concierge desk",
                deliveryLocation: dropAddr || "",
              });
            }
          } catch (conciergeErr) {
            console.warn(
              "Could not enqueue concierge desk assignment:",
              conciergeErr?.response?.data || conciergeErr?.message,
            );
          }
        }
        addLog({
          action: "Stage Transition",
          detail: `Order ${orderId} moved to ${stage} stage.`,
          type: "system",
        });
        return res.data;
      }
    } catch (error) {
      console.error("Failed to assign order stage:", error);
      const errMsg =
        error.response?.data?.message || "Failed to move order to next stage.";
      alert(errMsg);
    }
    return null;
  };

  const launchMissionFromOrder = async (orderId, missionData) => {
    try {
      const res = await api.post(`/missions/convert/${orderId}`, missionData);
      if (res.data?.success) {
        await fetchOrders();
        await fetchMissions();
        addLog({
          action: "Mission Launched",
          detail: `Order ${orderId} converted to Mission ${res.data.data.id}.`,
          type: "system",
        });
        return res.data.data;
      }
    } catch (error) {
      console.error("Failed to convert order to mission:", error);
    }
  };

  const convertOrderToProject = async (orderId, projectData) => {
    try {
      const res = await api.post(`/orders/convert/${orderId}`, projectData);
      if (res.data?.success) {
        await fetchOrders();
        await fetchProjects();
        addLog({
          action: "Project Launched",
          detail: `Order ${orderId} converted to Project ${res.data.data.id}.`,
          type: "system",
        });
        return res.data.data;
      }
    } catch (error) {
      console.error("Failed to convert order to project:", error);
    }
  };

  const convertProjectToMission = async (projectId, missionData) => {
    try {
      const res = await api.post(
        `/missions/convert-project/${projectId}`,
        missionData,
      );
      if (res.data?.success) {
        await fetchProjects();
        await fetchMissions();
        addLog({
          action: "Mission Launched",
          detail: `Project ${projectId} converted to Mission ${res.data.data.id}.`,
          type: "system",
        });
        return res.data.data;
      }
    } catch (error) {
      console.error("Failed to convert project to mission:", error);
    }
  };

  const updateMissionStatus = async (id, status) => {
    try {
      await api.put(`/missions/${id}/status`, { status });

      // If mission is dispatched, ensure a delivery row exists for operations tracking.
      if (String(status).toLowerCase() === "en_route") {
        const mission = missions.find((m) => String(m.id) === String(id) || String(m.missionNumber) === String(id) || String(m.db_id) === String(id) || String(m.mission_number) === String(id));
        if (mission) {
          const hasLinkedDelivery = deliveries.some((d) => {
            const dOrderRaw =
              d.order_id_raw ??
              (d.orderId
                ? parseInt(String(d.orderId).replace(/[^0-9]/g, ""), 10)
                : null);
            return (
              (mission.orderId &&
                Number(dOrderRaw) === Number(mission.orderId)) ||
              (mission.id && String(d.mission_id || "") === String(mission.id))
            );
          });

          if (!hasLinkedDelivery) {
            await addDelivery({
              orderId: mission.orderId || null,
              missionType:
                mission.missionType || mission.mission_type || "Delivery",
              location: mission.route || mission.location || "",
              driver: mission.driverName || mission.driver_name || "",
              vehicleId:
                mission.plateNumber ||
                mission.vehicleId ||
                mission.plate_number ||
                "",
              items: mission.items || [
                { name: `Mission ${mission.id}`, qty: 1 },
              ],
              pickupLocation: mission.pickup_location || "",
              dropLocation: mission.drop_location || mission.destination || "",
              dueDate: mission.date || null,
              status: "In Transit",
            });
          }
        }
      }
      await fetchMissions();
      addLog({
        action: "Mission Update",
        detail: `Mission ${id} status updated to ${status}.`,
        type: "logistics",
      });
    } catch (error) {
      console.error("Failed to update mission status:", error);
    }
  };

  const assignMissionDriver = async (missionId, driverId, vehicleId) => {
    try {
      await api.put(`/missions/${missionId}/assign`, { driverId, vehicleId });
      await fetchMissions();
      addLog({
        action: "Driver Assigned",
        detail: `Driver ${driverId} assigned to Mission ${missionId}.`,
        type: "logistics",
      });
      return true;
    } catch (error) {
      console.error("Failed to assign driver:", error);
      return false;
    }
  };

  const deleteMission = async (id) => {
    try {
      await api.delete(`/missions/${id}`);
      setMissions((prev) => prev.filter((m) => m.id !== id));
      addLog({
        action: "Mission Scrapped",
        detail: `Removed mission ${id} from operational queue.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete mission:", error);
    }
  };

  const hasPermission = (permission) => {
    const normalizedRole = normalizeRole(currentUser?.role);
    if (normalizedRole === "superadmin") return true;
    // Financial restrictions
    if (
      ["financial_reports", "revenue_analytics", "invoice_management"].includes(
        permission,
      )
    ) {
      return normalizedRole === "superadmin";
    }
    return true;
  };

  // --- INTEGRATED DATA FLOW ACTIONS ---

  const addOrder = async (order, options = {}) => {
    const { silentUi = false, customerCheckout = false } = options;
    // Marketplace / store checkout — customers may place orders. Manual "Create Order" is staff-only.
    if (
      !customerCheckout &&
      !roleCanCreateInstitutionalOrder(normalizeRole(currentUser?.role))
    ) {
      const msg =
        "Only authorised staff can create orders here. Customers should use Marketplace checkout, or ask staff to raise an order on their behalf.";
      if (!silentUi) window.alert(msg);
      return { ok: false, error: msg };
    }
    if (!order.items || order.items.length === 0) {
      if (!silentUi) alert("Order Error: No items in manifest.");
      return false;
    }

    // 0. Resolve Client ID if missing but name is present
    let targetClientId = order.clientId;
    if (!targetClientId && order.client) {
      const foundClient = clients.find((c) => c.name === order.client);
      if (foundClient) targetClientId = foundClient.id;
    }
    if (!targetClientId) targetClientId = 1;

    const total = (order.items || []).reduce(
      (acc, item) =>
        acc + parseFloat(item.price || 0) * parseInt(item.qty || 0),
      0,
    );

    try {
      const roleKey = normalizeRole(currentUser?.role);
      const userRole = roleKey;
      const tenantTypeKey = String(
        currentUser?.tenant_type || currentUser?.tenantType || "",
      )
        .trim()
        .toLowerCase();
      const isCustomer = userRole === "customer";
      const isBusinessTenant =
        tenantTypeKey === "saas" ||
        tenantTypeKey === "business" ||
        ["client", "saas_client", "admin"].includes(roleKey);
      const isPersonalAutoChargeUser =
        roleKey === "customer" && !isBusinessTenant;
      const hqCompanyId = Number(import.meta.env?.VITE_DEFAULT_COMPANY_ID) || 1;
      const scopedCompanyId =
        currentUser?.company_id || currentUser?.companyId || null;
      /** Personal marketplace orders must use the customer's linked company when set, so that company's admin sees them in /orders. */
      const customerOrderCompanyId = isCustomer
        ? (normalizeCompanyIdForApi(scopedCompanyId) ?? hqCompanyId)
        : null;
      const orderDateVal =
        isoDateSlice(
          order.order_date ||
          order.orderDate ||
          order.date ||
          order.requestDate,
        ) || localDateISO();
      const dueVal = isoDateSlice(order.dueDate || order.due_date || null);
      const orderKindNorm = String(
        order.order_kind || order.orderKind || "marketplace",
      ).toLowerCase();
      const customCategory = String(
        order.custom_request_category || order.customRequestCategory || "",
      ).toLowerCase();
      const isCustomRequestOrder =
        orderKindNorm === "custom_request" || customCategory !== "";
      /** Marketplace customer checkout: route via operations first so create payload does not imply dispatch yet (`logistics` route can coerce order status to Out for Delivery on some backends). Custom requests: always concierge routing after admin (not straight to operation/procurement). */
      const routedDepartment = (() => {
        if (isCustomRequestOrder) return "concierge";
        if (customerCheckout) return "operations";
        return "logistics";
      })();
      /** Marketplace + bespoke: start in `admin_review`. Custom requests must not default to `operation`/`procurement` at create — concierge triage comes after admin approve. */
      const requestedStatus =
        normalizeOrderStatusForApi(order.status) ||
        (isCustomRequestOrder
          ? "admin_review"
          : normalizeOrderStatusForApi("pending_review") || "admin_review");
      const totalAmountVal = (() => {
        const direct = parseFloat(
          order.estimated_total ?? order.total_amount ?? order.total ?? 0,
        );
        if (Number.isFinite(direct) && !Number.isNaN(direct) && direct >= 0)
          return direct;
        return Number.isFinite(total) && !Number.isNaN(total) ? total : 0;
      })();
      const subtotalVal = (() => {
        const sub = parseFloat(order.subtotal ?? totalAmountVal);
        return Number.isFinite(sub) && !Number.isNaN(sub)
          ? sub
          : totalAmountVal;
      })();
      const pickupLocationVal =
        order.pickupLocation ?? order.pickup_location ?? null;

      const res = await api.post("/orders", {
        clientId: isCustomer ? (currentUser?.clientId || targetClientId) : targetClientId,
        companyId: isCustomer
          ? customerOrderCompanyId
          : userRole !== "super_admin"
            ? scopedCompanyId
            : order.company_id || order.companyId || targetClientId,
        vendorId: (() => {
          const vId = order.vendorId != null ? order.vendorId : order.vendor_id;
          return vId && vId !== "" ? Number(vId) : null;
        })(),
        vendor_name: order.vendor || order.vendor_name || null,
        type: order.type || order.orderType || "Marketplace Order",
        items: order.items,
        notes: order.notes || null,
        location: order.deliveryAddress || order.location || null,
        delivery_address: order.deliveryAddress || order.location || null,
        pickup_location: pickupLocationVal,
        order_date: orderDateVal,
        request_date: orderDateVal,
        due_date: dueVal || null,
        order_kind: order.order_kind || order.orderKind || "marketplace",
        delivery_mode:
          order.deliveryType || order.delivery_mode || order.deliveryMode,
        routed_department: routedDepartment,
        route_department: routedDepartment,
        total_amount: totalAmountVal,
        subtotal: subtotalVal,
        estimated_total: totalAmountVal,
        status: requestedStatus,
        book_chauffeur: !!(order.bookChauffeur || order.book_chauffeur),
        custom_request_category:
          order.custom_request_category || order.customRequestCategory || null,
        concierge_member: !!(
          currentUser?.concierge_member || currentUser?.conciergeMembership
        ),
        delivery_instructions:
          order.delivery_instructions || order.deliveryInstructions || null,
      });

      const newId = res.data?.data?.id ?? res.data?.data ?? res.data?.id;
      // Some backends ignore create-time status defaults. Enforce routed status where role allows.
      if (
        requestedStatus &&
        newId != null &&
        roleCanUpdateOrderStatus(normalizeRole(currentUser?.role))
      ) {
        try {
          await api.patch(`/orders/${newId}/status`, {
            status: requestedStatus,
          });
        } catch (statusErr) {
          console.warn(
            "Could not enforce routed status after order create:",
            statusErr?.response?.data || statusErr?.message,
          );
        }
      }

      /** Staff-created orders: enqueue delivery + field task immediately. Marketplace checkout: defer until admin workflow reaches logistics (see `assignOrderToStage`) so customer-facing status stays admin_review / not "Out for Delivery". */
      if (!isCustomRequestOrder && newId != null && !customerCheckout) {
        try {
          await addDelivery({
            orderId: newId,
            company_id: isCustomer
              ? customerOrderCompanyId
              : currentUser?.company_id || currentUser?.companyId || null,
            client_id: targetClientId || null,
            customer_id: isCustomer ? currentUser?.id || null : null,
            // DB `mission_type` is constrained; keep canonical short value.
            missionType: "Delivery",
            location: order.deliveryAddress || order.location || "",
            driver: "",
            vehicleId: "",
            items: order.items || [],
            pickupLocation: pickupLocationVal || "Fulfilment Hub",
            dropLocation: order.deliveryAddress || order.location || "",
            dueDate: dueVal || orderDateVal,
            status: "Pending Pickup",
            delivery_instructions:
              order.delivery_instructions || order.deliveryInstructions || null,
            delivery_fee: 0, // Staff payout is set separately in Deliveries form (distance × rate/km)
          });
        } catch (queueErr) {
          console.warn(
            "Could not enqueue normal order for delivery team:",
            queueErr?.response?.data || queueErr?.message,
          );
        }
        // Marketplace/normal orders should be visible directly to field staff queue.
        try {
          const firstItemName =
            (order.items || [])[0]?.name || "Marketplace order";
          await addStaffAssignment({
            assigneeId: null,
            task: `Dispatch Order #${newId} - ${firstItemName}`,
            location:
              order.deliveryAddress || order.location || "Client location",
            status: "Pending",
            priority: "Normal",
            missionType: "Delivery",
            pickupLocation: pickupLocationVal || "Fulfilment Hub",
            deliveryLocation: order.deliveryAddress || order.location || "",
          });
        } catch (assignErr) {
          console.warn(
            "Could not create field staff assignment for normal order:",
            assignErr?.response?.data || assignErr?.message,
          );
        }
      }
      /** Custom / bespoke: no immediate Ops/Procurement staff row — admin approves → `concierge` stage, then `assignOrderToStage` creates the concierge desk assignment. */

      // Re-fetch to ensure sync and correct mapping
      await fetchOrders();

      let charged = !isPersonalAutoChargeUser;
      let chargeError = null;
      // Personal (non-business) accounts: immediately raise invoice + settlement record.
      if (isPersonalAutoChargeUser && newId != null) {
        try {
          const invRes = await api.post(
            "/finance/invoices",
            buildFinanceInvoiceCreatePayload({
              orderId: newId,
              clientId: currentUser?.id ?? null,
              totalAmount: totalAmountVal,
              dueDate: orderDateVal,
              paidAmount: 0,
              status: "unpaid",
            }),
          );
          const payload = invRes.data?.data ?? invRes.data;
          const invId = payload?.id ?? payload?.invoice_id ?? payload;
          if (invId != null && String(invId).match(/^\d+$/)) {
            await api.post(`/finance/invoices/${invId}/pay`, {
              amount: totalAmountVal,
              payment_method: "Instant checkout (personal)",
              transaction_id: `AUTO-${Date.now()}`,
            });
            await fetchFinance();
            charged = true;
          } else {
            chargeError = "Invoice ID missing after invoice creation.";
          }
        } catch (e) {
          chargeError =
            e?.response?.data?.message || e?.message || "Auto-charge failed.";
          console.warn(
            "Personal auto-charge failed:",
            e?.response?.data || e?.message,
          );
        }
      }

      if (!silentUi) {
        swalSuccess(
          "Institutional Protocol Initialized: Order has been successfully logged and queued for audit.",
        );
      }

      addLog({
        action: "Order Received",
        detail: `${newId} submitted by client.`,
        type: "system",
      });
      return { ok: true, id: newId, charged, chargeError };
    } catch (error) {
      console.error("Failed to submit order:", error);
      const hint = error.response?.data?.message || error.message;
      if (!silentUi) swalError(hint ? `Order failed: ${hint}` : "Order failed.");
      return { ok: false, error: hint };
    }
  };

  const generateInvoiceFromOrder = async (order) => {
    try {
      const items = (order.items && order.items.length > 0)
        ? order.items.map(item => ({
          itemId: Number(item.itemId || item.id || 1),
          quantity: Number(item.quantity || item.qty || 1),
          unitPrice: Number(item.unitPrice || item.price || 0),
          tax: 0,
          discount: 0
        }))
        : [{
          itemId: 1,
          quantity: 1,
          unitPrice: Number(order.totalAmount || order.total || 0),
          tax: 0,
          discount: 0
        }];

      const isoDueDate = order.dueDate
        ? new Date(order.dueDate).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const reqData = {
        deliveryId: order.id,
        dueDate: isoDueDate,
        items
      };

      await api.post("/invoices", reqData);

      // Re-fetch to sync
      await fetchFinance();

      addLog({
        action: "Manual Ledger Commit",
        detail: `Institutional Ledger generated for mission ${order.id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to generate invoice:", error);
    }
  };

  const settleInvoice = async (invoiceId, paymentData) => {
    try {
      const numericId =
        typeof invoiceId === "string" && invoiceId.startsWith("INV-")
          ? invoiceId.split("-")[1]
          : invoiceId;

      await api.post("/payments", {
        invoiceId: Number(numericId),
        paymentMethod: paymentData.method || "bank_transfer",
        amount: Number(paymentData.amount),
        referenceNumber: `TXN-${Date.now()}`,
        remarks: paymentData.remarks || "Institutional Settlement"
      });

      await fetchFinance();

      addLog({
        action: "Ledger Settlement",
        detail: `Paid $${paymentData.amount} for invoice ${invoiceId}.`,
        type: "finance",
      });
    } catch (error) {
      console.error("Failed to settle invoice:", error);
    }
  };

  const addInvoice = async (invoice) => {
    try {
      const reqData = buildFinanceInvoiceCreatePayload(invoice);
      if (reqData.client_id == null || Number.isNaN(reqData.client_id)) {
        const msg =
          "Choose a valid client (company or personal). IDs like user_123 are converted automatically once selected.";
        window.alert(msg);
        return { ok: false, error: msg };
      }
      await api.post("/finance/invoices", reqData);

      await fetchFinance();
      addLog({
        action: "Invoice Generated",
        detail: `Institutional ledger entry for Order ${invoice.orderId ?? "—"} successfully logged.`,
        type: "system",
      });
      return { ok: true };
    } catch (error) {
      console.error("Failed to add invoice:", error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Failed to create invoice.";
      window.alert(msg);
      return { ok: false, error: msg };
    }
  };

  const addDelivery = async (del) => {
    try {
      // Sanitize order_id: strip non-numeric prefixes (e.g., 'ord-122' -> 122)
      let sanitizedOrderId = null;
      if (del.orderId) {
        const parsed =
          typeof del.orderId === "string"
            ? parseInt(del.orderId.replace(/[^0-9]/g, ""), 10)
            : del.orderId;
        if (!isNaN(parsed)) sanitizedOrderId = parsed;
      }
      const rawStatus = String(del.status || "pending")
        .toLowerCase()
        .replace(/\s+/g, "_");
      const createStatusMap = {
        pending_pickup: "pending",
        pending_review: "pending",
        in_transit: "en_route",
        completed: "delivered",
      };
      const apiCreateStatus = createStatusMap[rawStatus] || rawStatus;

      const reqData = {
        orderId: sanitizedOrderId,
        companyId: del.companyId || del.company_id || null,
        clientId: del.customerId || del.customer_id || del.client_id || null,
        missionType: ["Delivery", "Pickup", "Transfer", "Chauffeur"].includes(
          del.missionType || del.mission_type,
        )
          ? del.missionType || del.mission_type
          : "Delivery",
        remarks: JSON.stringify({
          route: del.location || del.route || "",
          driver: del.driver_name || del.driver || "",
          assigned_driver: del.assigned_driver || del.driverId || del.driver_id || null,
          package_details: typeof del.items === "string" ? del.items : JSON.stringify(del.items || []),
        }),
        pickupLocation: del.pickupLocation || del.pickup_location || "",
        dropLocation: del.dropLocation || del.drop_location || "",
        dueDate: del.dueDate || del.due_date || null,
        status: apiCreateStatus,
        items: Array.isArray(del.items) ? del.items.map(i => ({
          quantity: Number(i.qty || i.quantity || 1),
          itemId: i.itemId || i.id || 1
        })) : [{ quantity: 1, itemId: 1 }],
        routeDistance: del.route_distance !== '' && del.route_distance !== undefined ? del.route_distance : null,
        staffPayRate: del.staff_pay_rate !== '' && del.staff_pay_rate !== undefined ? del.staff_pay_rate : null,
        transportMode: del.mode || 'Road'
      };
      const res = await api.post("/deliveries", reqData);
      if (res.data.success) {
        // Re-fetch to sync
        await fetchDeliveries();

        const delId = `DEL-${String(res.data.data.id).padStart(3, "0")}`;
        addLog({
          action: "Mission Launched",
          detail: `Logistics Protocol ${delId} initiated for ${del.item || "Order " + del.orderId}.`,
          type: "logistics",
        });
      }
    } catch (error) {
      console.error("Failed to add delivery:", error);
      const msg = error.response?.data?.message || "Failed to create delivery.";
      alert(msg);
    }
  };

  const normalizeDeliveryDbId = (d) => {
    if (d?.db_id != null && d.db_id !== "") return d.db_id;
    if (d?.id != null && d.id !== "") return d.id;
    return null;
  };

  const toApiDeliveryStatus = (s) => {
    const x = String(s || "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    const map = {
      in_transit: "en_route",
      pending_pickup: "pending",
      pending_review: "pending",
      /** Admin approved — still awaiting driver on logistics row */
      approved: "pending",
      accepted: "assigned",
      declined: "cancelled",
      delivered: "delivered",
      completed: "delivered",
      cancelled: "cancelled",
    };
    return map[x] || x;
  };

  const updateDelivery = async (updated) => {
    const patchId = normalizeDeliveryDbId(updated);
    const apiStatus = toApiDeliveryStatus(updated.status);

    const isChauffeurOrder = updated.mission_type === "Chauffeur" || String(updated.id).startsWith("CH-ORD-");
    if (isChauffeurOrder) {
      try {
        let detail = {};
        if (updated.remarks) {
          try {
            detail = JSON.parse(updated.remarks);
          } catch {
            detail = {};
          }
        }
        const payload = {
          clientId: updated.clientId || updated.client_id || detail.clientId || '',
          status: apiStatus,
          items: [{
            ...detail,
            driverName: updated.driver || detail.driverName || "",
            driver_user_id: updated.driverId || detail.driver_user_id || null,
            plateNumber: updated.vehicleId || detail.plateNumber || "",
            status: apiStatus
          }]
        };
        await api.put(`/orders/${patchId}`, payload);
        await fetchDeliveries();
        return;
      } catch (e) {
        console.error("Failed to update Chauffeur order:", e);
      }
    }

    const applyLocal = () => {
      setDeliveries((prev) =>
        prev.map((x) => {
          if (patchId != null && x.db_id === patchId)
            return { ...x, ...updated, status: updated.status };
          if (String(x.id) === String(updated.id))
            return { ...x, ...updated, status: updated.status };
          return x;
        }),
      );
    };

    if (!patchId) {
      applyLocal();
      return;
    }

    try {
      const patchBody = {
        status: apiStatus,
        vehicle_id: updated.vehicle_db_id,
        route_distance: updated.route_distance !== '' ? updated.route_distance : null,
        staff_pay_rate: updated.staff_pay_rate !== '' ? updated.staff_pay_rate : null,
        delivery_fee: updated.delivery_fee !== '' ? updated.delivery_fee : 0,
        mode: updated.mode || null,
      };
      if (updated.driver !== undefined || updated.driver_name !== undefined) {
        patchBody.driver_name = updated.driver ?? updated.driver_name ?? null;
        patchBody.driver = patchBody.driver_name; // for mock API compatibility
      }
      if (updated.vehicleId !== undefined || updated.plate_number !== undefined) {
        patchBody.plate_number = updated.vehicleId ?? updated.plate_number ?? null;
      }
      const assignId = updated.assigned_driver !== undefined ? updated.assigned_driver : (updated.driverId !== undefined ? updated.driverId : updated.driver_id);
      if (assignId !== undefined) {
        const n = Number(assignId);
        patchBody.assigned_driver = (assignId !== null && Number.isFinite(n) && !Number.isNaN(n)) ? n : assignId;
        patchBody.driverId = patchBody.assigned_driver; // for mock API compatibility
      }

      console.log('Sending PUT to /deliveries/' + patchId, patchBody);
      const res = await api.put(`/deliveries/${patchId}`, patchBody);
      console.log('PUT response:', res.data);

      await fetchDeliveries();
      if (updated.status === "Delivered" || updated.status === "Completed") {
        // Auto-update the linked order status to 'delivered'
        const numericOrderId =
          updated.order_id_raw ||
          (updated.orderId
            ? parseInt(String(updated.orderId).replace(/[^0-9]/g, ""), 10)
            : null);
        if (numericOrderId && !isNaN(numericOrderId)) {
          try {
            await api.patch(`/orders/${numericOrderId}/status`, {
              status: "completed",
            });
          } catch (e) {
            console.warn("Could not auto-update order status:", e.message);
          }
        }
        await fetchOrders();
        const rawId =
          updated.order_id_raw ||
          (updated.orderId
            ? parseInt(String(updated.orderId).replace(/[^0-9]/g, ""), 10)
            : null);
        if (rawId) {
          const matchingOrder = orders.find(
            (o) => Number(o.id) === Number(rawId),
          );
          if (matchingOrder) {
            await generateInvoiceFromOrder(matchingOrder);
          }
        }
      } else {
        await fetchOrders();
      }
    } catch (error) {
      console.error(
        "Delivery status API failed:",
        error?.response?.data || error?.message,
      );
    }
  };

  const deleteDelivery = async (id) => {
    try {
      const numericId =
        typeof id === "string" && id.includes("-") ? id.split("-")[1] : id;
      await api.delete(`/deliveries/${numericId}`);
      setDeliveries((prev) =>
        prev.filter((d) => d.id !== id && d.db_id !== id),
      );
      addLog({
        action: "Mission Decommissioned",
        detail: `Logistics Protocol ${id} terminated and removed from active operations.`,
        type: "alert",
      });
    } catch (error) {
      console.error("Failed to delete delivery:", error);
    }
  };

  const updateInvoice = async (updated) => {
    try {
      // Handle string vs numeric ID
      const numericId =
        typeof updated.id === "string" && updated.id.startsWith("INV-")
          ? updated.id.split("-")[1]
          : updated.id;

      const reqData = {
        amount: updated.totalAmount, // Map frontend structural property
        due_date: updated.dueDate,
        status: updated.status
          ? updated.status.toLowerCase().replace(" ", "_")
          : "unpaid",
      };

      await api.put(`/finance/invoices/${numericId}`, reqData);

      await fetchFinance();
      addLog({
        action: "Invoice Updated",
        detail: `Institutional ledger ${updated.id} parameters recalibrated.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update invoice:", error);
    }
  };

  const deleteInvoice = async (id) => {
    try {
      // Handle string vs numeric ID
      const numericId =
        typeof id === "string" && id.startsWith("INV-") ? id.split("-")[1] : id;

      await api.delete(`/finance/invoices/${numericId}`);
      await fetchFinance();
      addLog({
        action: "Invoice Terminated",
        detail: `Financial record ${id} removed from ledger.`,
        type: "alert",
      });
    } catch (error) {
      console.error("Failed to delete invoice:", error);
    }
  };

  const confirmDeliveryReceipt = async (id, signature) => {
    try {
      // id might be 'DEL-001' or 'DEL-PENDING-53' or numeric. The API expects numeric ID.
      const numericId =
        typeof id === "string" && id.includes("-")
          ? (id.includes("PENDING") ? id.split("-").pop() : id.split("-")[1])
          : id;

      await api.put(`/deliveries/${numericId}`, {
        status: "delivered",
        signature,
      });

      // Sync local state
      await fetchDeliveries();
      await fetchOrders();

      addLog({
        action: "Delivery Confirmed",
        detail: `Client signature received for shipment ${id}.`,
        type: "success",
      });
    } catch (error) {
      console.error("Failed to confirm delivery:", error);
    }
  };

  // --- UNIVERSAL CRUD PROTOCOLS ---
  const addVendor = async (vendor) => {
    try {
      const companyId = currentUser?.company_id ?? currentUser?.companyId;
      const vendorWithGate = { ...vendor, status: "inactive" };
      const reqData = buildVendorApiBody(vendorWithGate, companyId);
      reqData.status = "inactive";
      const res = await api.post("/vendors", reqData);

      // Re-fetch to ensure correct mapping and sync
      await fetchVendors();

      addLog({
        action: "Vendor Onboarding",
        detail: `${vendor.name || "Vendor"} saved as pending — hidden from marketplace until a Super Admin approves (Active).`,
        type: "system",
      });
      await swalInfo(
        "Awaiting Super Admin approval",
        "This vendor is saved as pending. It will appear in the marketplace and vendor pickers only after a Super Admin approves it from Vendor directory.",
      );
      return res.data;
    } catch (error) {
      console.error("Failed to add vendor:", error);
      throw error;
    }
  };

  const updateVendor = async (updated) => {
    try {
      const pathId = vendorPathId(updated.id);
      if (!pathId) {
        const err = new Error("Invalid vendor ID.");
        err.code = "VALIDATION";
        throw err;
      }
      const companyId = currentUser?.company_id ?? currentUser?.companyId;
      const reqData = buildVendorApiBody(updated, companyId);
      const res = await api.put(`/vendors/${pathId}`, reqData);
      const nextStatus = String(updated?.status || "")
        .trim()
        .toLowerCase();
      if (nextStatus === "active") {
        const nextOverrides = (pendingVendorOverrideIds || []).filter(
          (id) => String(id) !== String(updated.id),
        );
        setPendingVendorOverrideIds(nextOverrides);
        writePendingVendorOverrides(nextOverrides);
        const nextDrafts = (pendingVendorDrafts || []).filter(
          (x) => String(x?.id) !== String(updated.id),
        );
        setPendingVendorDrafts(nextDrafts);
        writePendingVendorDrafts(nextDrafts);
      }

      // Re-fetch to ensure sync
      await fetchVendors();

      addLog({
        action: "Vendor Update",
        detail: `Recalibrated profile for ${updated.name}.`,
        type: "system",
      });
      return res.data;
    } catch (error) {
      console.error("Failed to update vendor:", error);
      throw error;
    }
  };

  const deleteVendor = async (id) => {
    try {
      const pathId = vendorPathId(id);
      await api.delete(`/vendors/${pathId}`);

      setVendors((prev) => prev.filter((v) => v.id !== id));
      addLog({
        action: "Vendor Removal",
        detail: `Decommissioned vendor reference ID ${id}.`,
        type: "system",
      });

      // Re-fetch to be absolutely sure
      await fetchVendors();
    } catch (error) {
      console.error("Failed to delete vendor:", error);
      throw error;
    }
  };

  const addInventory = async (item) => {
    try {
      const imageUrl = item.image_url || item.imageUrl || item.image || null;
      let res;

      if (item.imageFile) {
        const formData = new FormData();
        formData.append("name", item.name || "");
        formData.append(
          "category",
          canonicalMarketplaceCategory(item.category),
        );
        formData.append("price", String(parseFloat(item.price) || 0));
        formData.append("quantity", String(parseInt(item.qty) || 0));
        appendInventoryFk(
          formData,
          "warehouse_id",
          item.warehouse_id ?? item.warehouseId,
        );
        appendInventoryFk(
          formData,
          "vendor_id",
          item.vendorId ?? item.vendor_id,
        );
        formData.append("inventory_type", item.inventoryType || "Marketplace");
        appendInventoryFk(formData, "client_id", item.clientId);
        formData.append(
          "sku",
          item.sku || `SKU-${Math.floor(Math.random() * 10000)}`,
        );
        if (imageUrl) formData.append("image_url", String(imageUrl));
        formData.append(
          "company_id",
          String(
            resolveInventoryCompanyId(
              currentUser,
              item.company_id ?? item.companyId,
            ),
          ),
        );
        formData.append("image", item.imageFile);

        res = await api.post("/inventory", formData);
      } else {
        const reqData = {
          name: item.name,
          category: canonicalMarketplaceCategory(item.category),
          price: parseFloat(item.price) || 0,
          quantity: parseInt(item.qty) || 0,
          warehouse_id: nullablePositiveInt(
            item.warehouse_id ?? item.warehouseId,
          ),
          vendor_id: nullablePositiveInt(item.vendorId ?? item.vendor_id),
          inventory_type: item.inventoryType || "Marketplace",
          client_id: nullablePositiveInt(item.clientId),
          company_id: resolveInventoryCompanyId(
            currentUser,
            item.company_id ?? item.companyId,
          ),
          image_url: imageUrl,
          sku: item.sku || `SKU-${Math.floor(Math.random() * 10000)}`,
        };
        res = await api.post("/inventory", reqData);
      }

      if (!inventoryWriteResponseOk(res)) {
        const msg =
          res?.data?.message ||
          res?.data?.error ||
          "Inventory create was not accepted by the server.";
        throw new Error(msg);
      }

      // Re-fetch to sync and map
      await fetchInventory();

      addLog({
        action: "Asset Intake",
        detail: `Ingested ${item.name} into Warehouse.`,
        type: "system",
      });
      return res.data;
    } catch (error) {
      console.error("Failed to add inventory item:", error);
      throw error;
    }
  };

  const updateInventory = async (updated) => {
    try {
      const imageUrl =
        updated.image_url || updated.imageUrl || updated.image || null;

      if (updated.imageFile) {
        const formData = new FormData();
        formData.append("name", updated.name || "");
        formData.append(
          "category",
          canonicalMarketplaceCategory(updated.category),
        );
        formData.append("price", String(parseFloat(updated.price) || 0));
        formData.append("quantity", String(parseInt(updated.qty) || 0));
        appendInventoryFk(
          formData,
          "warehouse_id",
          updated.warehouse_id ?? updated.warehouseId,
        );
        appendInventoryFk(
          formData,
          "vendor_id",
          updated.vendorId ?? updated.vendor_id,
        );
        appendInventoryFk(formData, "client_id", updated.clientId);
        if (imageUrl) formData.append("image_url", String(imageUrl));
        formData.append(
          "company_id",
          String(
            resolveInventoryCompanyId(
              currentUser,
              updated.company_id ?? updated.companyId,
            ),
          ),
        );
        formData.append("image", updated.imageFile);
        formData.append(
          "inventory_type",
          updated.inventoryType || updated.inventory_type || "Marketplace",
        );
        if (updated.sku) formData.append("sku", String(updated.sku));

        const putRes = await api.put(`/inventory/${updated.id}`, formData);
        if (!inventoryWriteResponseOk(putRes)) {
          throw new Error(
            putRes?.data?.message ||
            putRes?.data?.error ||
            "Inventory update failed.",
          );
        }
      } else {
        const reqData = {
          name: updated.name,
          category: canonicalMarketplaceCategory(updated.category),
          price: parseFloat(updated.price) || 0,
          quantity: parseInt(updated.qty) || 0,
          warehouse_id: nullablePositiveInt(
            updated.warehouse_id ?? updated.warehouseId,
          ),
          vendor_id: nullablePositiveInt(updated.vendorId ?? updated.vendor_id),
          client_id: nullablePositiveInt(updated.clientId),
          company_id: resolveInventoryCompanyId(
            currentUser,
            updated.company_id ?? updated.companyId,
          ),
          inventory_type:
            updated.inventoryType || updated.inventory_type || "Marketplace",
          sku: updated.sku || undefined,
          image_url: imageUrl,
        };
        const putRes = await api.put(`/inventory/${updated.id}`, reqData);
        if (!inventoryWriteResponseOk(putRes)) {
          throw new Error(
            putRes?.data?.message ||
            putRes?.data?.error ||
            "Inventory update failed.",
          );
        }
      }

      // Re-fetch to sync
      await fetchInventory();

      addLog({
        action: "Inventory Update",
        detail: `Asset ${updated.name} protocol modified.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update inventory item:", error);
      throw error;
    }
  };

  const deleteInventory = async (id) => {
    try {
      await api.delete(`/inventory/${id}`);
      setInventory((prev) => prev.filter((i) => i.id !== id));
      await fetchInventory();
      addLog({
        action: "Asset Decommission",
        detail: `Removed asset ID ${id} from ledger.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete inventory item:", error);
    }
  };

  const issueInventory = (id, qty, issuedTo) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(0, item.qty - qty);
          return {
            ...item,
            qty: newQty,
            stockValue: newQty * item.price,
            issuedTo: issuedTo,
            lastIssuedDate: new Date().toISOString().split("T")[0],
          };
        }
        return item;
      }),
    );
    const item = inventory.find((i) => i.id === id);
    addLog({
      action: "Asset Issued",
      detail: `Issued ${qty} of ${item?.name || id} to ${issuedTo}.`,
      type: "system",
    });
  };

  const addClient = async (client) => {
    try {
      const res = await api.post("/clients", {
        ...client,
        clientCode: `CLT-${Date.now().toString().slice(-6)}`,
        companyName: client.companyName || client.name || "Unknown Company",
        contactPerson: client.contact || client.contactPerson || "Admin",
        email: client.email,
        phone: client.phone || "0000000000",
        address: client.location || "N/A",
        country: client.country || "Bahamas",
        client_type: client.clientType || 'Business',
        password: client.password || null,
        billing_cycle: client.billingCycle,
        payment_method: client.paymentMethod,
        logo_url: client.logo,
      });

      // Re-fetch to ensure perfect sync and correct mapping
      await fetchClients();

      addLog({
        action: "Client Onboarding",
        detail: `Registered ${client.name} via ${client.source || "Admin Dashboard"}.`,
        type: "system",
      });
      return res.data;
    } catch (error) {
      console.error("Failed to add client:", error);
      throw error;
    }
  };

  const updateClient = async (updated) => {
    try {
      const reqData = {
        ...updated,
        phone: updated.phone, // Ensure phone is mapped
        client_type: updated.clientType,
        billing_cycle: updated.billingCycle,
        payment_method: updated.paymentMethod,
        contact_person: updated.contact,
        business_name: updated.companyName,
        logo_url: updated.logo,
      };
      const res = await api.put(`/clients/${updated.id}`, reqData);

      // Re-fetch to ensure sync
      await fetchClients();

      addLog({
        action: "Client Update",
        detail: `Recalibrated profile for ${updated.name || updated.business_name || updated.id}.`,
        type: "system",
      });
      return res.data;
    } catch (error) {
      console.error("Failed to update client:", error);
      throw error;
    }
  };

  const updateClientBranding = async (clientId, branding) => {
    try {
      // Map frontend naming to backend database fields
      const reqData = {
        business_name: branding.businessName,
        tagline: branding.tagline,
        logo_url: branding.logo,
      };

      const res = await api.put(`/clients/${clientId}`, reqData);
      if (res.data?.success) {
        setClients((prev) =>
          prev.map((c) => (c.id === clientId ? { ...c, ...reqData } : c)),
        );
        addLog({
          action: "Branding Updated",
          detail: `Institutional identity recalibrated for ${clientId}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to update client branding:", error);
    }
  };

  const updateDeliveryPricingTier = async (id, price) => {
    try {
      const res = await api.put(`/logistics/pricing/${id}`, { price });
      if (res.data?.success) {
        setDeliveryPricing((prev) =>
          prev.map((tier) => (tier.id === id ? { ...tier, price } : tier)),
        );
        addLog({
          action: "Pricing Updated",
          detail: `Logistics Protocol Rate ID ${id} adjusted to $${price}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to update delivery pricing:", error);
    }
  };

  const deleteClient = async (id) => {
    try {
      await api.delete(`/clients/${id}`);
      setClients((prev) => prev.filter((c) => c.id !== id));
      addLog({
        action: "Client Decommission",
        detail: `Removed client reference ${id}.`,
        type: "system",
      });
      return { success: true, deletedFrom: "clients" };
    } catch (error) {
      console.error("Failed to delete client:", error);
      const msg = String(
        error?.response?.data?.message || error?.message || "",
      ).toLowerCase();
      if (msg.includes("client record not found")) {
        await api.delete(`/users/${id}`);
        setClients((prev) =>
          prev.filter(
            (c) =>
              String(c.id) !== String(id) &&
              String(c.signup_user_id) !== String(id),
          ),
        );
        await fetchStaff();
        addLog({
          action: "Client Decommission",
          detail: `Removed signup user ${id} from users ledger.`,
          type: "alert",
        });
        return { success: true, deletedFrom: "users" };
      }
      throw error;
    }
  };

  const addProject = async (project) => {
    const mapStatusToBackend = (status) => {
      switch (String(status || '').toLowerCase().trim()) {
        case "pending":
        case "planned":
          return "planned";
        case "active":
        case "in progress":
        case "in_progress":
          return "in_progress";
        case "completed":
          return "completed";
        case "cancelled":
        case "on_hold":
        case "on hold":
          return "on_hold";
        default:
          return "planned";
      }
    };

    try {
      let resolvedCompanyId = project.companyId || project.company_id || null;
      let resolvedCustomerId = project.customerId || project.customer_id || null;
      let resolvedClientUserId = project.clientUserId || project.client_user_id || null;

      if (typeof project.clientId === 'string' && project.clientId.includes('_')) {
        const [type, idStr] = project.clientId.split('_');
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          if (type === 'company') {
            resolvedCompanyId = id;
          } else if (type === 'customer') {
            resolvedCustomerId = id;
          } else if (type === 'user') {
            resolvedClientUserId = id;
          }
        }
      }

      const reqData = {
        name: project.name || project.projectName,
        description:
          project.description || `Tactical deployment for ${project.client}`,
        manager_id:
          project.manager_id || project.assignedLeaderId || currentUser?.id,
        startDate: project.start || project.startDate,
        location: project.location,
        status: mapStatusToBackend(project.status),
        company_id:
          resolvedCompanyId ||
          currentUser?.company_id ||
          currentUser?.companyId ||
          null,
        customer_id: resolvedCustomerId || null,
        client_user_id: resolvedClientUserId || null,
        client_name: project.client || project.clientName || null,
        delivery_type: project.deliveryType || project.delivery_type || "Road",
      };

      const res = await api.post("/orders/projects", reqData);
      if (res.data?.success) {
        await fetchProjects();
        const newProject = res.data.data;

        // Automatically create a corresponding Logistics/Delivery Mission (UI state only for now as per current logic)
        const deliveryId = `DEL-P-${Math.floor(1000 + Math.random() * 999)}`;
        setDeliveries((prev) => [
          {
            id: deliveryId,
            projectId: newProject?.id,
            item: `Project Setup: ${project.name}`,
            status: "Pending",
            location: project.location || "Client Hub",
            mode: project.deliveryType || "Road",
            pod: { signature: null, image: null, actualTime: null },
            clientId: project.clientId || 1,
            assignedStaff: project.assignedLeader || "Operational Queue",
          },
          ...prev,
        ]);

        addLog({
          action: "Project Deployment",
          detail: `Initiated ${project.name} for ${project.client}. Distribution protocol ${project.deliveryType || "Road"} initialized under ${deliveryId}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add project:", error);
    }
  };

  const updateProject = async (updated) => {
    const mapStatusToBackend = (status) => {
      switch (String(status || '').toLowerCase().trim()) {
        case "pending":
        case "planned":
          return "planned";
        case "active":
        case "in progress":
        case "in_progress":
          return "in_progress";
        case "completed":
          return "completed";
        case "cancelled":
        case "on_hold":
        case "on hold":
          return "on_hold";
        default:
          return "planned";
      }
    };

    try {
      let resolvedCompanyId = updated.companyId || updated.company_id || null;
      let resolvedCustomerId = updated.customerId || updated.customer_id || null;
      let resolvedClientUserId = updated.clientUserId || updated.client_user_id || null;

      if (typeof updated.clientId === 'string' && updated.clientId.includes('_')) {
        const [type, idStr] = updated.clientId.split('_');
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          if (type === 'company') {
            resolvedCompanyId = id;
          } else if (type === 'customer') {
            resolvedCustomerId = id;
          } else if (type === 'user') {
            resolvedClientUserId = id;
          }
        }
      }

      const reqData = {
        name: updated.name || updated.projectName,
        description: updated.description,
        status: mapStatusToBackend(updated.status),
        location: updated.location,
        startDate: updated.start || updated.startDate,
        manager_id: updated.manager_id || updated.managerId,
        delivery_type: updated.deliveryType || updated.delivery_type || "Road",
        company_id: resolvedCompanyId || currentUser?.company_id || currentUser?.companyId || null,
        customer_id: resolvedCustomerId || null,
        client_user_id: resolvedClientUserId || null,
        client_name: updated.client || updated.clientName || null,
      };
      await api.put(`/orders/projects/${updated.id}`, reqData);
      await fetchProjects();
      addLog({
        action: "Project Redesign",
        detail: `Updated parameters for ${updated.name}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update project:", error);
    }
  };

  const deleteProject = async (id) => {
    try {
      await api.delete(`/orders/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      addLog({
        action: "Project Decommission",
        detail: `Archived project reference ${id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  const updateAssignment = async (updated) => {
    try {
      await api.put(`/staff/assignments/${updated.id}`, updated);
      setStaffAssignments((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
    } catch (error) {
      console.error("Failed to update assignment:", error);
    }
  };

  const updateMission = async (updated) => {
    try {
      if (updated.status === 'in_progress' || updated.status === 'assigned') {
        await api.put(`/missions/${updated.rawId}/assign`, { driverId: updated.assigneeId, vehicleId: 1 });
      }

      if (updated.status === 'Completed' || updated.status === 'Delivered') {
        const podPayload = {
          receiverName: updated.receiverName || 'System Verified',
          deliveryPhoto: updated.photo,
          remarks: updated.notes ? `${updated.notes}\n[GPS]: ${updated.gps}` : `[GPS]: ${updated.gps}`
        };
        await api.post(`/missions/${updated.rawId}/pod`, podPayload);
      } else {
        await api.put(`/missions/${updated.rawId}/status`, { status: updated.status });
      }

      if (typeof fetchSupportingDocs === 'function') {
        await fetchSupportingDocs();
      }
      if (typeof fetchDeliveries === 'function') {
        await fetchDeliveries();
      }
      if (typeof fetchOrders === 'function') {
        await fetchOrders();
      }

      setStaffAssignments((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
      );
    } catch (error) {
      console.error("Failed to update mission:", error);
    }
  };

  const clockStorageKey = () => {
    const uid = currentUser?.id ?? currentUser?.email ?? "guest";
    return `zz_clock_${uid}`;
  };

  const clockIn = async (location) => {
    const loc = location || currentUser?.location || "Central Hub";
    const payload = { location: loc };
    let shiftRef = null;

    try {
      const res = await api.post("/staff/clock-in", payload);
      const root = res.data;
      const inner =
        root?.data !== undefined && typeof root.data === "object"
          ? root.data
          : null;
      shiftRef =
        inner?.shiftId ?? inner?.shift_id ?? inner?.id ?? root?.shiftId;
      const ok = root?.success !== false && root?.error == null;
      if (ok) {
        const ref = shiftRef ?? true;
        if (currentUser?.id) toggleAvailability(currentUser.id, true);
        localStorage.setItem(
          clockStorageKey(),
          JSON.stringify({
            in: true,
            at: new Date().toISOString(),
            location: loc,
            shiftRef: ref,
          }),
        );
        return ref;
      }
    } catch (error) {
      console.warn(
        "Clock-in API unavailable, using local session:",
        error?.response?.data?.message || error.message,
      );
    }

    shiftRef = shiftRef || `local-${Date.now()}`;
    if (currentUser?.id) toggleAvailability(currentUser.id, true);
    localStorage.setItem(
      clockStorageKey(),
      JSON.stringify({
        in: true,
        at: new Date().toISOString(),
        location: loc,
        shiftRef,
      }),
    );
    return shiftRef;
  };

  const clockOut = async () => {
    try {
      const res = await api.post("/staff/clock-out");
      const root = res.data;
      const ok = root?.success !== false && root?.error == null;
      if (ok) {
        localStorage.removeItem(clockStorageKey());
        if (currentUser?.id) toggleAvailability(currentUser.id, false);
        try {
          await fetchPayHistory();
        } catch {
          /* optional */
        }
        return root?.data || root || { ok: true };
      }
    } catch (error) {
      console.warn(
        "Clock-out API unavailable, clearing local session:",
        error?.response?.data?.message || error.message,
      );
    }
    localStorage.removeItem(clockStorageKey());
    if (currentUser?.id) toggleAvailability(currentUser.id, false);
    return { ok: true, local: true };
  };

  const addStaffAssignment = async (asg) => {
    try {
      const reqData = {
        assigneeId: asg.assigneeId,
        task: asg.task,
        location: asg.location,
        status: asg.status || "Pending",
        priority: asg.priority || "Normal",
        missionType: asg.missionType,
        passengerName: asg.passengerName,
        pickupTime: asg.pickupTime,
        dropLocation: asg.dropLocation,
        luggage: asg.luggage,
        goodsDetails: asg.goodsDetails,
        weight: asg.weight,
        pickupLocation: asg.pickupLocation,
        deliveryLocation: asg.deliveryLocation,
      };
      const res = await api.post("/missions", reqData);
      if (res.data?.success) {
        const newAsg = {
          ...asg,
          id: res.data.data.missionNumber || res.data.data.id,
          db_id: res.data.data.id,
        };
        setStaffAssignments((prev) => [newAsg, ...prev]);
        addLog({
          action: "Mission Delegated",
          detail: `${asg.missionType || "General"} mission assigned to ${asg.assignee}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add assignment:", error);
    }
  };

  const addAudit = async (audit) => {
    try {
      const res = await api.post("/support/audits", audit); // Need to check if POST exists, implementation plan said maps to audit_logs
      setAudits((prev) => [res.data.data, ...prev]);
      addLog({
        action: "Audit Initialized",
        detail: `Started ${audit.title || "Inventory"} compliance screening.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to add audit:", error);
    }
  };

  const updateAudit = async (updated) => {
    try {
      await api.put(`/support/audits/${updated.id}`, updated);
      setAudits((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      addLog({
        action: "Audit Updated",
        detail: `Recalibrated metrics for ${updated.id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update audit:", error);
    }
  };

  const deleteAudit = async (id) => {
    try {
      await api.delete(`/support/audits/${id}`);
      setAudits((prev) => prev.filter((a) => a.id !== id));
      addLog({
        action: "Audit Removal",
        detail: `Decommissioned audit record ${id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete audit:", error);
    }
  };

  const addQuote = async (quote) => {
    try {
      const parsedVendorId = parseInt(
        String(quote.vendorId ?? quote.vendor_id ?? "").trim(),
        10,
      );
      const normalizedVendorId =
        Number.isFinite(parsedVendorId) && parsedVendorId > 0
          ? parsedVendorId
          : null;
      const res = await api.post("/procurement/quotes", {
        ...quote,
        vendor_id: normalizedVendorId,
        vendor_name: quote.vendor_name || quote.vendor || "",
        quote_type: quote.quoteType ?? quote.quote_type ?? "client",
        payment_terms: quote.paymentTerms ?? quote.payment_terms ?? "Net 30",
      });
      if (res.data?.success) {
        await fetchQuotes();
        addLog({
          action: "Quote Manifest",
          detail: `Received procurement offer from Vendor ${quote.vendorId}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add quote:", error);
    }
  };

  const updateQuote = async (updated) => {
    try {
      const qid = quotePathId(updated.id);
      const payload = {
        vendor_id: updated.vendorId ?? updated.vendor_id,
        vendor_name: updated.vendor_name || updated.vendor,
        items: updated.items,
        total_amount: updated.total ?? updated.total_amount,
        lead_time: updated.leadTime ?? updated.lead_time,
        validity_date: updated.validity ?? updated.validity_date,
        status: updated.status,
        quote_type: updated.quoteType ?? updated.quote_type ?? "client",
        payment_terms: updated.paymentTerms ?? updated.payment_terms,
        notes: updated.notes,
      };
      await api.put(`/procurement/quotes/${qid}`, payload);
      setQuotes((prev) =>
        prev.map((q) => (q.id === updated.id ? { ...updated, ...payload } : q)),
      );
      addLog({
        action: "Quote Revision",
        detail: `Updated terms for ${updated.id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update quote:", error);
      setQuotes((prev) =>
        prev.map((q) => (q.id === updated.id ? { ...q, ...updated } : q)),
      );
    }
  };

  const deleteQuote = async (id) => {
    try {
      await api.delete(`/procurement/quotes/${id}`);
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      addLog({
        action: "Quote Discarded",
        detail: `Removed quote reference ${id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete quote:", error);
    }
  };

  const addPurchaseRequest = async (req) => {
    try {
      const uniqueId = Date.now();
      const body = {
        ...req,
        items: Array.isArray(req.items) ? req.items : [],
        id: req.id ?? uniqueId,
        requestId: req.requestId ?? `REQ-${Math.floor(100 + Math.random() * 900)}`,
        status:
          req.status && String(req.status).trim() !== ""
            ? req.status
            : "Pending",
      };
      // Send estimated_cost to backend since backend reads estimated_cost on creation
      body.estimated_cost = req.total ?? req.estimated_cost ?? 0;

      const res = await api.post("/purchase-requests", body);
      if (res.data?.success) {
        // Fetch the fresh requests from the backend to get the actual auto-incremented ID and keep state correct!
        await fetchPurchaseRequests();
        addLog({
          action: "Request Initialized",
          detail: `New purchase manifest submitted by ${req.requester}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add purchase request:", error);
    }
  };

  const updatePurchaseRequest = async (updated) => {
    try {
      const identifier = updated.id ?? updated.requestId;

      // Optimistic update for instant UI feedback
      setPurchaseRequests((prev) =>
        prev.map((r) => {
          if (r.id === identifier || r.requestId === identifier) {
            const newTotal = updated.total !== undefined ? updated.total : r.total;
            return { ...r, ...updated, total: newTotal };
          }
          return r;
        })
      );

      await api.put(`/purchase-requests/${identifier}`, updated);
      await fetchPurchaseRequests();
      addLog({
        action: "Request Updated",
        detail: `Modified procurement request ${identifier}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update purchase request:", error);
      // Revert if needed by fetching again
      await fetchPurchaseRequests();
    }
  };

  const deletePurchaseRequest = async (id) => {
    try {
      await api.delete(`/purchase-requests/${id}`);
      setPurchaseRequests((prev) => prev.filter((r) => r.id !== id && r.requestId !== id));
      addLog({
        action: "Request Purged",
        detail: `Removed request ID ${id} from queue.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete purchase request:", error);
    }
  };

  const addPurchaseOrder = async (po) => {
    try {
      const reqData = {
        vendor_id:
          po.vendorId != null
            ? parseInt(String(po.vendorId).replace(/\D/g, ""), 10) ||
            po.vendorId
            : po.vendorId,
        vendorId: po.vendorId,
        payment_terms: po.paymentTerms || po.payment_terms || "Net 30",
        notes: po.notes || "",
        total_amount: po.total || po.total_amount,
        status: "Pending",
        items: po.items.map((item) => ({
          name: item.name,
          category: item.category,
          quantity: item.orderedQty ?? item.quantity,
          unit_price: item.price,
        })),
      };
      const res = await api.post("/purchase-orders", reqData);
      if (res.data?.success) {
        await fetchPurchaseOrders();
        // Refresh purchase requests to reflect status/total changes automatically
        await fetchPurchaseRequests();
        addLog({
          action: "PO Issued",
          detail: `Purchase Order ${res.data.data.id} sent to ${po.vendorName}.`,
          type: "procurement",
        });
      }
    } catch (error) {
      console.error("Failed to add PO:", error);
    }
  };

  const updatePurchaseOrder = async (updated) => {
    try {
      const pid = poNumericId(updated.id);
      const payload = {
        payment_terms:
          updated.paymentTerms ?? updated.payment_terms ?? "Net 30",
        total_amount: updated.total ?? updated.total_amount,
        items: (updated.items || []).map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.orderedQty ?? item.quantity,
          unit_price: item.price,
          received_qty: item.receivedQty ?? item.received_qty,
        })),
        vendor_name: updated.vendorName ?? updated.vendor_name,
      };
      await api.put(`/purchase-orders/${pid}`, payload);
      const merged = {
        ...updated,
        payment_terms: payload.payment_terms,
        paymentTerms: payload.payment_terms,
      };
      // After updating PO, refresh purchase requests to keep totals/status in sync
      await fetchPurchaseRequests();
      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === updated.id ? merged : po)),
      );
      addLog({
        action: "PO Revised",
        detail: `Purchase Order ${updated.id} parameters adjusted for ${updated.vendorName}.`,
        type: "procurement",
      });
    } catch (error) {
      console.error("Failed to update PO:", error);
      setPurchaseOrders((prev) =>
        prev.map((po) => (po.id === updated.id ? { ...po, ...updated } : po)),
      );
    }
  };

  const receiveGoodsAgainstPO = async (poId, receivedData, options = {}) => {
    try {
      // Extract numeric ID if it's "PO-1002" format
      const numericId =
        typeof poId === "string" && poId.includes("-")
          ? poId.split("-")[1]
          : poId;

      const reqData = {
        items: receivedData.map((r) => ({
          id: r.id, // Expecting item database ID
          name: r.name,
          receivedQty: Number(r.receivedNow),
        })),
      };
      if (options.packingSlip) reqData.packingSlip = options.packingSlip;
      if (options.adminApproved) reqData.adminApproved = true;

      const res = await api.put(
        `/purchase-orders/${numericId}/receive`,
        reqData,
      );
      if (res.data?.success) {
        await fetchPurchaseOrders();

        addLog({
          action: "Goods Receiving",
          detail: `Shipment received against PO ${poId}.`,
          type: "inventory",
        });
      }
    } catch (error) {
      console.error("Failed to receive goods against PO:", error);
      throw error;
    }
  };

  const approvePOReceipt = async (poId) => {
    try {
      const numericId = typeof poId === "string" && poId.includes("-") ? poId.split("-")[1] : poId;
      const res = await api.put(`/purchase-orders/${numericId}/approve-receipt`);
      if (res.data?.success) {
        await fetchPurchaseOrders();

        addLog({
          action: "Receipt Approved",
          detail: `Admin approved receipt for PO ${poId}.`,
          type: "inventory",
        });
      }
    } catch (error) {
      console.error("Failed to approve PO receipt:", error);
      throw error;
    }
  };

  /** Reduce received quantities when goods were registered incorrectly (local sync if API missing). */
  const reverseGoodsReceipt = async (poId, lineAdjustments) => {
    const pid = poNumericId(poId);
    try {
      await api.post(`/purchase-orders/${pid}/reverse-receipt`, {
        lines: lineAdjustments,
      });
      await fetchPurchaseOrders();
    } catch (error) {
      console.error("reverse-receipt API failed", error);
      throw error;
    }
  };

  const addWarehouse = async (wh) => {
    try {
      const managerId =
        wh.manager_id !== "" && wh.manager_id != null
          ? parseInt(wh.manager_id, 10)
          : null;
      const warehouseData = {
        name: wh.name,
        location: wh.location,
        capacity: wh.capacity,
        status: wh.status || "active",
        company_id: currentUser?.company_id || wh.company_id,
        manager_id: Number.isFinite(managerId) ? managerId : null,
      };
      const res = await api.post("/warehouses", warehouseData);
      if (res.data?.success) {
        await fetchWarehouses();
        addLog({
          action: "Facility Added",
          detail: `Commissioned ${wh.name} into the network.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add warehouse:", error);
    }
  };

  const updateWarehouse = async (updated) => {
    try {
      const managerId =
        updated.manager_id !== "" && updated.manager_id != null
          ? parseInt(updated.manager_id, 10)
          : null;
      const payload = {
        name: updated.name,
        location: updated.location,
        capacity: updated.capacity,
        status: updated.status,
        manager_id: Number.isFinite(managerId) ? managerId : null,
        company_id: updated.company_id,
      };
      const res = await api.put(`/warehouses/${updated.id}`, payload);
      if (res.data?.success) {
        await fetchWarehouses();
        addLog({
          action: "Facility Updated",
          detail: `Modified configurations for ${updated.name}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to update warehouse:", error);
    }
  };

  const deleteWarehouse = async (id) => {
    try {
      await api.delete(`/warehouses/${id}`);
      setWarehouses((prev) => prev.filter((w) => w.id !== id));
      addLog({
        action: "Facility Decommission",
        detail: `Removed warehouse reference ID ${id} from ledger.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete warehouse:", error);
    }
  };

  const [luxuryItems, setLuxuryItems] = useState([]);

  const addLuxuryItem = async (item) => {
    try {
      const reqData = {
        item_name: item.item,
        owner_name: item.owner,
        vault_location: item.vault,
        estimated_value: item.value,
        status: item.status,
        notes: item.notes,
      };
      const res = await api.post("/concierge/luxury-items", reqData);
      if (res.data?.success) {
        await fetchLuxuryItems();
      } else {
        setLuxuryItems((prev) => [
          { ...item, id: res.data?.data?.id || Date.now() },
          ...prev,
        ]);
      }
      addLog({
        action: "Luxury Item Registered",
        detail: `New vault entry: ${item.item}`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to add luxury item:", error);
    }
  };

  const updateLuxuryItem = async (updated) => {
    try {
      const reqData = {
        item_name: updated.item,
        owner_name: updated.owner,
        vault_location: updated.vault,
        estimated_value: updated.value,
        status: updated.status,
        notes: updated.notes,
      };
      const res = await api.put(`/concierge/luxury-items/${updated.id}`, reqData);
      if (res.data?.success) {
        await fetchLuxuryItems();
      } else {
        setLuxuryItems((prev) =>
          prev.map((i) => (i.id === updated.id ? updated : i)),
        );
      }
      addLog({
        action: "Luxury Item Updated",
        detail: `Recalibrated details for vault entry: ${updated.item}`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update luxury item:", error);
    }
  };

  const fetchChauffeurRequests = React.useCallback(async () => {
    try {
      const res = await api.get("/orders", { params: { orderType: 'CHAUFFEUR', limit: 100 } });
      const orders = Array.isArray(res.data?.data)
        ? res.data.data
        : (res.data?.data?.orders || []);

      const mapped = orders.map((order) => {
        const detail = order.metadata?.customItems?.[0] || order.metadata || {};
        return {
          id: order.id,
          db_id: order.id,
          clientId: order.clientId,
          company_id: order.companyId,
          created_by: order.createdById,
          clientName: order.client?.companyName || order.client?.name || detail.clientName || 'Guest Client',
          driverName: order.driverName || detail.driverName || null,
          plateNumber: order.plateNumber || detail.plateNumber || null,
          driverPhotoUrl: detail.driverPhotoUrl || null,
          driver_user_id: order.driver_user_id || detail.driver_user_id || null,
          serviceType: detail.serviceType || "One Way",
          pickupLocation: detail.pickupLocation || "Nassau Area",
          dropLocation: detail.dropLocation || "Destination",
          dueDate: detail.eta || detail.dueDate || null,
          pickupDate: detail.eta || detail.dueDate || null,
          pickupTime: detail.pickupTime || null,
          status: order.status,
          chauffeurFee: parseFloat(detail.chauffeurFee ?? detail.chauffeur_fee ?? 0) || 0,
          chauffeur_fee_mode: detail.chauffeur_fee_mode || "separate",
          numberOfPassengers: detail.numberOfPassengers || 1,
          bags: detail.bags || 0,
          stops: detail.stops || "No",
          stopLocations: detail.stopLocations || "",
          amenities: detail.amenities || [],
          passenger_info: detail,
          _passengerInfo: detail,
          remarks: JSON.stringify(detail),
          adminApproved: !!detail.adminApproved,
        };
      });
      setChauffeurRequests(filterDataForCurrentUser(mapped));
    } catch (error) {
      console.error("Failed to fetch chauffeur requests:", error);
    }
  }, [currentUser]);

  const fetchAudits = React.useCallback(async () => {
    try {
      const res = await api.get("/support/audits");
      if (res.data?.success) {
        setAudits(filterDataForCurrentUser(res.data.data));
      }
    } catch (error) {
      console.error("Failed to fetch audits:", error);
    }
  }, [currentUser]);

  const toggleAvailability = async (userId, forcedStatus = null) => {
    try {
      const user = users.find((u) => u.id === userId);
      const newStatus =
        forcedStatus !== null ? forcedStatus : user ? !user.isAvailable : true;

      await api.put(`/staff/${userId}`, { is_available: newStatus });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isAvailable: newStatus } : u,
        ),
      );
      if (currentUser?.id === userId) {
        const updatedUser = { ...currentUser, isAvailable: newStatus };
        setCurrentUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
      addLog({
        action: "Status Update",
        detail: `${user?.name || "Staff"} availability updated to ${newStatus ? "Active" : "Offline"}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to toggle availability:", error);
    }
  };

  const fetchPayHistory = React.useCallback(async () => {
    try {
      const res = await api.get("/finance/payroll");
      if (res.data?.success) {
        const mapped = (res.data.data || []).map((p) => ({
          id: p.id,
          period: new Date(p.payment_date || p.created_at).toLocaleDateString(
            "en-US",
            { month: "long", year: "numeric" },
          ),
          date: (p.payment_date || p.created_at)?.split("T")[0],
          hours: p.hours || "Variable",
          total: `$${parseFloat(p.net_amount || p.netAmount || p.amount || 0).toLocaleString()}`,
          status: p.status || "Processed",
          userId: p.user_id || p.userId,
          userName: p.user_name || p.userName,
        }));
        setPayHistory(mapped);
      }
    } catch (error) {
      console.error("Failed to fetch pay history:", error);
    }
  }, []);


  const deleteLuxuryItem = async (id) => {
    try {
      await api.delete(`/concierge/luxury-items/${id}`);
      setLuxuryItems((prev) => prev.filter((i) => i.id !== id));
      addLog({
        action: "Luxury Item Decommissioned",
        detail: `Removed vault entry ID ${id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete luxury item:", error);
    }
  };

  const dispatchVehicle = async (data) => {
    try {
      // data.id is plate_number, data.db_id is the integer ID
      // data.deliveryId is the DEL-00x formatted ID, data.delivery_db_id is the integer ID
      const deliveryDbId =
        data.delivery_db_id ||
        (typeof data.deliveryId === "string"
          ? parseInt(String(data.deliveryId).replace(/[^0-9]/g, ""), 10)
          : data.deliveryId);
      if (!deliveryDbId) {
        throw new Error("No delivery selected for dispatch.");
      }

      await api.put(`/deliveries/${deliveryDbId}`, {
        status: "en_route",
        vehicle_id: data.db_id, // Ensure it's assigned if not already
        route_id: data.routeId || null,
      });

      // Update vehicle status to En Route in the real DB
      await api.put(`/vehicles/${data.db_id}`, { status: "En Route" });

      // Re-fetch to sync
      await fetchFleet();
      const dRes = await api.get("/deliveries");

      if (dRes.data.success) {
        const dRaw = dRes.data?.data;
        const dArr = Array.isArray(dRaw) ? dRaw : Array.isArray(dRaw?.deliveries) ? dRaw.deliveries : [];
        const mappedDeliveries = dArr.map((d) => ({
          id: `DEL-${String(d.id).padStart(3, "0")}`,
          db_id: d.id,
          orderId: d.order_id,
          order_id_raw: d.order_id,
          status: d.status,
          driver: d.driver_name,
          vehicleId: d.plate_number,
          location: d.route || "In Transit",
          route: d.route,
          items: d.package_details ? JSON.parse(d.package_details) : [],
        }));
        setDeliveries(mappedDeliveries);

        // Auto-sync tracking row for dispatched mission so Tracking tab reflects immediately.
        const dispatched =
          mappedDeliveries.find(
            (d) => Number(d.db_id) === Number(deliveryDbId),
          ) ||
          mappedDeliveries.find(
            (d) => String(d.id) === String(data.deliveryId),
          );
        if (dispatched) {
          const trackingRow = {
            id: `TRK-DEL-${dispatched.db_id}`,
            asset: dispatched.vehicleId || data.id || "Assigned Vehicle",
            location:
              data.routeName ||
              dispatched.route ||
              dispatched.location ||
              "In Transit",
            signal: "Strong",
            eta: dispatched.eta || "Live",
            status:
              String(dispatched.status || "").toLowerCase() === "en_route"
                ? "En Route"
                : "Active",
            deliveryId: dispatched.id,
          };
          setTracking((prev) => {
            const idx = prev.findIndex(
              (t) => String(t.id) === String(trackingRow.id),
            );
            if (idx === -1) return [trackingRow, ...prev];
            const next = [...prev];
            next[idx] = { ...next[idx], ...trackingRow };
            return next;
          });
        }
      }

      if (data.markUrgent) {
        setUrgentTasks((prev) => [
          {
            id: `URG-${Date.now()}`,
            task: data.mission || "High-priority dispatch",
            time: "Immediate",
            priority: "Critical",
            location: data.routeName || "Dispatch Route",
            assignee: data.driver || "Logistics Team",
          },
          ...prev,
        ]);
      }

      addLog({
        action: "Fleet Dispatch",
        detail: `Vehicle ${data.id} launched for ${data.mission}. Pilot: ${data.driver}`,
        type: "system",
      });

      alert(`Asset "${data.id}" successfully dispatched and status updated to "En Route"!`);
    } catch (error) {
      console.error("Failed to dispatch vehicle:", error);
      alert(error.message || "Failed to dispatch vehicle.");
    }
  };

  const TRACKING_ENDPOINTS = ["/logistics/tracking"];
  const URGENT_ENDPOINTS = ["/logistics/urgent"];

  const fetchTracking = React.useCallback(async () => {
    try {
      const res = await api.get('/logistics/tracking');
      if (res.data?.success) {
        setTracking(res.data.data.map(t => ({
          ...t,
          id: t.trackerId || t.id,
        })));
      }
    } catch (error) {
      console.error("Failed to fetch tracking data:", error);
    }
  }, []);

  const addTracking = async (t) => {
    try {
      const res = await api.post('/logistics/tracking', t);
      if (res.data?.success) {
        setTracking((prev) => [{ ...t, id: res.data.data.id }, ...prev]);
        addLog({
          action: "Tracker Linked",
          detail: `Connected asset ${t.asset} to Geo-Spatial Network.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to link tracker:", error);
    }
  };

  // --- FLEET ACTIONS ---
  const addFleet = async (vehicle) => {
    try {
      const reqData = {
        vehicleId: vehicle.id,
        type: vehicle.type || 'Luxury Truck',
        model: vehicle.model,
        fuel: vehicle.fuel || '100%',
        status: vehicle.status || 'Active',
        capacity: vehicle.capacity || '',
        location: vehicle.location || '',
        insurancePolicy: vehicle.insurancePolicy || '',
        registrationExpiry: vehicle.registrationExpiry || null,
        inspectionDate: vehicle.inspectionDate || null,
        diagnosticStatus: vehicle.diagnosticStatus || 'Healthy',
      };
      const res = await api.post("/vehicles", reqData);
      if (res.data?.success) {
        const saved = res.data.data;
        setFleet((prev) => [{
          id: saved.vehicleId,
          db_id: saved.id,
          type: saved.type,
          model: saved.model,
          fuel: saved.fuel,
          status: saved.status,
          capacity: saved.capacity,
          location: saved.location,
          insurancePolicy: saved.insurancePolicy,
          registrationExpiry: saved.registrationExpiry || '',
          inspectionDate: saved.inspectionDate || '',
          diagnosticStatus: saved.diagnosticStatus,
        }, ...prev]);
        addLog({ action: "Asset Induction", detail: `Commissioned ${vehicle.id} into active fleet.`, type: "system" });
      }
    } catch (error) {
      console.error("Failed to add fleet asset:", error);
      alert(error.response?.data?.message || "Failed to add vehicle.");
    }
  };

  const updateFleet = async (updated) => {
    try {
      const reqData = {
        vehicleId: updated.id,
        type: updated.type,
        model: updated.model,
        fuel: updated.fuel,
        status: updated.status,
        capacity: updated.capacity,
        location: updated.location,
        insurancePolicy: updated.insurancePolicy,
        registrationExpiry: updated.registrationExpiry || null,
        inspectionDate: updated.inspectionDate || null,
        diagnosticStatus: updated.diagnosticStatus,
      };
      const res = await api.put(`/vehicles/${updated.db_id}`, reqData);
      if (res.data?.success) {
        setFleet((prev) => prev.map((v) => v.db_id === updated.db_id ? { ...v, ...updated } : v));
        addLog({ action: "Asset Recalibration", detail: `Updated telemetry for ${updated.id}.`, type: "system" });
      }
    } catch (error) {
      console.error("Failed to update fleet asset:", error);
    }
  };

  const deleteFleet = async (id) => {
    try {
      const vehicle = fleet.find((v) => v.id === id);
      if (vehicle && vehicle.db_id) {
        await api.delete(`/vehicles/${vehicle.db_id}`);
        setFleet((prev) => prev.filter((v) => v.id !== id));
        addLog({ action: "Asset Decommissioned", detail: `Removed ${id} from active fleet operations.`, type: "alert" });
      }
    } catch (error) {
      console.error("Failed to delete fleet asset:", error);
    }
  };

  // --- ROUTE ACTIONS ---
  const addRoute = async (route) => {
    try {
      // Send the entire route object directly so that dist, time, type, status, and id are preserved
      const res = await api.post("/logistics/routes", route);
      if (res.data.success) {
        setRoutes((prev) => [{ ...route, id: res.data.data.id }, ...prev]);
        addLog({
          action: "Route Mapping",
          detail: `Charted new logistics corridor: ${route.name}`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add route:", error);
    }
  };

  const updateRoute = async (updated) => {
    try {
      await api.put(`/logistics/routes/${updated.id}`, updated);
      setRoutes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      addLog({
        action: "Route Updated",
        detail: `Corridor ${updated.name} parameters recalibrated.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update route:", error);
    }
  };

  const fetchRoutes = React.useCallback(async () => {
    try {
      const res = await api.get("/logistics/routes");
      if (res.data?.success) {
        setRoutes(
          res.data.data.map((r) => ({
            id: r.id, // mapped from routeId
            name: r.name,
            dist: r.dist || r.distance || "",
            time: r.time || r.avgTime || "",
            type: r.type || "Land",
            status: r.status || "Active",
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch routes:", error);
    }
  }, []);

  const deleteRoute = async (id) => {
    try {
      await api.delete(`/logistics/routes/${id}`);
      setRoutes((prev) => prev.filter((r) => r.id !== id));
      addLog({
        action: "Route Decommissioned",
        detail: `Path ID ${id} removed from distribution network.`,
        type: "alert",
      });
    } catch (error) {
      console.error("Failed to delete route:", error);
    }
  };

  const addChauffeurRequest = async (request) => {
    try {
      const fee =
        Number(request.chauffeurFee ?? request.chauffeur_fee ?? 0) || 0;
      const passengerPayload = {
        passengers: request.numberOfPassengers,
        luggage: request.luggage,
        amenities: request.amenities,
        chauffeurFee: fee,
        chauffeur_fee: fee,
        chauffeur_fee_mode: request.chauffeur_fee_mode || "separate",
        serviceType: request.serviceType,
        returnDate: request.returnDate || null,
        returnTime: request.returnTime || null,
        numberOfDays: request.numberOfDays || null,
        stops: request.stops || "No",
        stopLocations: request.stopLocations || null,
        bags: request.bags || 0,
        clientName: request.clientName || null,
        chauffeur_status: request.status || (request.driverName ? "assigned" : "pending"),
      };
      const reqData = {
        mission_type: "Chauffeur",
        company_id:
          request.clientId && request.clientId !== "CLT-GUEST"
            ? request.clientId
            : null,
        pickup_location: request.pickupLocation,
        drop_location: request.dropLocation,
        delivery_date: request.dueDate || null,
        pickup_time: request.pickupTime || null,
        total_amount: fee,
        estimated_total: fee,
        driver_name: request.driverName || null,
        plate_number: request.plateNumber || null,
        passenger_info: JSON.stringify(passengerPayload),
        status: request.driverName ? "assigned" : "pending",
      };
      const res = await api.post("/orders", { clientId: request.clientId || null, orderType: "CHAUFFEUR", status: reqData.status, items: [reqData] });
      if (res.data?.success) {
        await fetchChauffeurRequests();
        await fetchDeliveries();
        addLog({
          action: "Chauffeur Dispatched",
          detail: `VIP Transport secured for ${request.clientName}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add chauffeur request:", error);
      const msg =
        error.response?.data?.message || "Failed to create chauffeur request.";
      alert(msg);
    }
  };

  const updateChauffeurRequest = async (updated) => {
    try {
      const apiStatus = toApiDeliveryStatus(updated.status);
      const patch = { status: apiStatus };
      if (updated.driverName != null || updated.driver_name != null) {
        patch.driver_name = updated.driverName ?? updated.driver_name ?? "";
      }
      if (updated.plateNumber != null || updated.plate_number != null) {
        patch.plate_number = updated.plateNumber ?? updated.plate_number ?? "";
      }
      if (
        updated.passenger_info !== undefined &&
        updated.passenger_info !== null
      ) {
        patch.passenger_info =
          typeof updated.passenger_info === "string"
            ? updated.passenger_info
            : JSON.stringify(updated.passenger_info);
      }
      let piObj = {};
      try {
        const rawPi = updated.passenger_info ?? updated._passengerInfo;
        if (typeof rawPi === "string") {
          piObj = JSON.parse(rawPi || "{}");
        } else if (rawPi && typeof rawPi === "object") {
          piObj = rawPi;
        }
      } catch {
        piObj = {};
      }

      piObj.chauffeur_status = updated.status;
      patch.passenger_info = JSON.stringify(piObj);

      const driverUid =
        piObj.driver_user_id ?? piObj.driverUserId ?? updated.driver_user_id;
      if (driverUid != null && driverUid !== "") {
        const n = Number(driverUid);
        patch.assigned_driver =
          Number.isFinite(n) && !Number.isNaN(n) ? n : driverUid;
      }
      if (String(updated.id).startsWith("CH-ORD-") || updated.mission_type === "Chauffeur") {
        const patchId = updated.db_id || updated.id;
        const payload = {
          clientId: updated.clientId || updated.client_id || '',
          status: updated.status,
          items: [{
            ...piObj,
            driverName: updated.driverName || updated.driver || piObj.driverName || "",
            driver_user_id: driverUid || null,
            plateNumber: updated.plateNumber || updated.vehicleId || piObj.plateNumber || "",
            status: updated.status
          }]
        };
        await api.put(`/orders/${patchId}`, payload);
      } else {
        await api.put(`/deliveries/${updated.id}`, patch);
      }
      await fetchChauffeurRequests();
      await fetchDeliveries();
      addLog({
        action: "Chauffeur Updated",
        detail: `Protocol ID ${updated.id} status recalibrated.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update chauffeur request:", error);
    }
  };

  const deleteChauffeurRequest = async (id) => {
    try {
      await api.delete(`/orders/${id}`);
      setChauffeurRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error("Failed to delete chauffeur request:", error);
    }
  };
  const updateTracking = async (updated) => {
    const payload = {
      asset: updated.asset,
      location: updated.location,
      signal: updated.signal,
      eta: updated.eta,
      status: updated.status,
      delivery_id: updated.deliveryId || null,
      tracker_id: updated.id,
    };
    if (!trackingApiUnavailableRef.current)
      for (const ep of TRACKING_ENDPOINTS) {
        try {
          await api.put(
            `${ep}/${encodeURIComponent(updated.db_id || updated.id)}`,
            payload,
          );
          await fetchTracking();
          return;
        } catch (_) {
          /* try next endpoint */
        }
      }
    trackingApiUnavailableRef.current = true;
    setTracking((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const deleteTracking = async (id) => {
    if (!trackingApiUnavailableRef.current)
      for (const ep of TRACKING_ENDPOINTS) {
        try {
          const row = tracking.find(
            (t) =>
              String(t.id) === String(id) || String(t.db_id) === String(id),
          );
          await api.delete(`${ep}/${encodeURIComponent(row?.db_id || id)}`);
          await fetchTracking();
          addLog({
            action: "Signal Severed",
            detail: `Decommissioned tracker ${id}.`,
            type: "alert",
          });
          return;
        } catch (_) {
          /* try next endpoint */
        }
      }
    trackingApiUnavailableRef.current = true;
    setTracking((prev) => prev.filter((t) => t.id !== id));
    addLog({
      action: "Signal Severed",
      detail: `Decommissioned tracker ${id}.`,
      type: "alert",
    });
  };

  const addEvent = async (event) => {
    try {
      const rawClientId =
        event.client_id ||
        clients.find((c) => c.name === event.client)?.id ||
        null;
      const clientId = rawClientId
        ? String(rawClientId).replace("CLT-", "")
        : "";

      const payload = {
        title: event.title || "",
        name: event.name || event.title || "",
        event_date: event.date || "",
        location: event.location || "",
        client_id: clientId,
        manager_id: currentUser?.id || "",
        status: event.status || "planned",
        special_requests: event.specialRequests || "",
        planner_name: event.plannerName || "",
        guest_count: event.guestCount || event.guests || 0,
        mood_board_url: event.moodBoardUrl || ""
      };

      const res = await api.post("/support/events", payload);
      if (res.data?.success) {
        const newEvt = {
          ...res.data.data,
          title: res.data.data.name,
          client: res.data.data.client_name,
          date: res.data.data.event_date
            ? res.data.data.event_date.split("T")[0]
            : "",
          imageUrl: res.data.data.image_url,
          moodBoardUrl: res.data.data.mood_board_url,
          plannerName: res.data.data.planner_name,
          specialRequests: res.data.data.special_requests,
          guestCount: res.data.data.guest_count,
          client_id: res.data.data.clientId || res.data.data.client_id,
          manager_id: res.data.data.managerId || res.data.data.manager_id,
        };
        setEvents((prev) => [newEvt, ...prev]);
        await fetchTickets();
        addLog({
          action: "Event Registry",
          detail: `New event request: ${event.title}`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add event:", error);
    }
  };

  const updateEvent = async (updated) => {
    try {
      // Only include fields that are explicitly provided (undefined means "no change").
      let clientId;
      if (updated.client_id !== undefined) {
        clientId = String(updated.client_id).replace("CLT-", "");
      } else if (updated.client !== undefined) {
        const found =
          clients.find((c) => c.name === updated.client)?.id || null;
        clientId = found ? String(found).replace("CLT-", "") : undefined;
      }

      const payload = {
        title: updated.title || "",
        name: updated.name || updated.title || "",
        event_date: updated.date || "",
        location: updated.location || "",
        client_id: clientId,
        manager_id: updated.manager_id || updated.managerId || currentUser?.id || "",
        status: updated.status || "planned",
        special_requests: updated.specialRequests || "",
        planner_name: updated.plannerName || "",
        guest_count: updated.guestCount || updated.guests || 0,
        mood_board_url: updated.moodBoardUrl || ""
      };

      const res = await api.put(`/support/events/${updated.id}`, payload);

      try {
        console.debug(
          `PUT /support/events/${updated.id} payload:`,
          payload,
          "response:",
          res?.data || res,
        );
      } catch (e) { }

      // Optimistically update local state so UI reflects changes immediately.
      const uiUpdate = {};
      if (updated.title !== undefined) uiUpdate.title = updated.title;
      if (updated.date !== undefined) uiUpdate.date = updated.date;
      if (updated.location !== undefined) uiUpdate.location = updated.location;
      if (updated.plannerName !== undefined)
        uiUpdate.plannerName = updated.plannerName;
      if (updated.specialRequests !== undefined)
        uiUpdate.specialRequests = updated.specialRequests;
      if (updated.guestCount !== undefined)
        uiUpdate.guestCount = updated.guestCount;
      if (updated.moodBoardUrl !== undefined)
        uiUpdate.moodBoardUrl = updated.moodBoardUrl;

      if (Object.keys(uiUpdate).length > 0) {
        setEvents((prev) =>
          prev.map((e) =>
            String(e.id) === String(updated.id) ? { ...e, ...uiUpdate } : e,
          ),
        );
      }

      await fetchTickets();
      addLog({
        action: "Event Update",
        detail: `Synchronized details for ${updated.title || updated.id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update event:", error);
    }
  };

  const deleteEvent = async (id) => {
    try {
      await api.delete(`/support/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      addLog({
        action: "Event Cancellation",
        detail: `Removed event reference ID ${id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete event:", error);
    }
  };

  const [deliveryPricing, setDeliveryPricing] = useState([]);
  const [shippingModePricing, setShippingModePricing] = useState({ Road: 0, Sea: 150, Air: 300 });

  React.useEffect(() => {
    const s = systemSettings || {};
    if (s.shipping_modes) {
      setShippingModePricing(s.shipping_modes);
    }
    if (s.delivery_tiers) {
      setDeliveryPricing(s.delivery_tiers);
    }
  }, [systemSettings]);

  const updateShippingModePricing = async (nextPricing) => {
    const normalized = {
      Road: Number(nextPricing?.Road) >= 0 ? Number(nextPricing.Road) : 0,
      Sea: Number(nextPricing?.Sea) >= 0 ? Number(nextPricing.Sea) : 150,
      Air: Number(nextPricing?.Air) >= 0 ? Number(nextPricing.Air) : 300,
    };
    setShippingModePricing(normalized);
    writeShippingModePricing(normalized); // Optional: keep for offline backup
    try {
      const res = await api.put("/settings/system", {
        type: 'shipping_modes',
        data: normalized
      });
      if (res.data?.success) {
        setSystemSettings(prev => ({
          ...prev,
          shipping_modes: normalized
        }));
      }
    } catch (e) {
      console.warn("Could not persist shipping pricing to backend:", e?.response?.data || e?.message);
    }
    return true;
  };

  const updateDeliveryTiers = async (tiers) => {
    setDeliveryPricing(tiers);
    try {
      const res = await api.put("/settings/system", {
        type: 'delivery_tiers',
        data: tiers
      });
      if (res.data?.success) {
        setSystemSettings(prev => ({
          ...prev,
          delivery_tiers: tiers
        }));
      }
    } catch (e) {
      console.warn("Could not persist delivery tiers to backend:", e?.response?.data || e?.message);
    }
    return true;
  };

  const getVacationBalance = (userId) => {
    const user = users.find((u) => u.id === userId);
    if (!user || user.role === "client") return 0;

    const join = new Date(user.joinedDate || "2024-01-01");
    const now = new Date();
    const diffYears = (now - join) / (1000 * 60 * 60 * 24 * 365);
    const diffMonths = diffYears * 12;

    if (user.isSalaried) {
      if (diffYears > 10) return 15; // 3 weeks
      if (diffYears >= 1) return 10; // 2 weeks
      if (diffMonths >= 6) return 5; // 1 week
      return 0;
    } else {
      // Hourly
      if (diffYears >= 1) return 10; // 2 weeks
      return 0;
    }
  };

  const submitSaaSRequest = async (data) => {
    try {
      const res = await api.post("/clients", {
        ...data,
        clientCode: `CLT-${Date.now().toString().slice(-6)}`,
        companyName: data.companyName || data.name || "Unknown Company",
        contactPerson: data.contact || data.contactPerson || "Admin",
        email: data.email,
        phone: data.phone || "0000000000",
        address: data.location || "N/A",
        country: data.country || "Bahamas",
        password: data.password || null,
        client_type: data.clientType,
        billing_cycle: data.billingCycle,
        payment_method: data.paymentMethod,
        logo_url: data.logo,
        status: "pending",
      });
      if (res.data?.success) {
        setClients((prev) => [res.data.data, ...prev]);
        addLog({
          action: "SaaS Invite Request",
          detail: `New request from ${data.name} for ${data.plan} plan.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to submit SaaS request:", error);
    }
  };

  const processSaaSRequest = async (id, action) => {
    try {
      const newStatus = action === "approve" ? "active" : "rejected";
      await api.put(`/clients/${id}`, { status: newStatus });
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)),
      );
      addLog({
        action: "SaaS Request Processed",
        detail: `Request ${id} marked as ${newStatus}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to process SaaS request:", error);
    }
  };

  const addSupportTicket = async (ticket) => {
    try {
      const payload = {
        subject: ticket.subject,
        category: ticket.category || "General",
        description: ticket.messages?.[0]?.text || "",
        messages: ticket.messages,
        priority: (ticket.priority || "medium").toLowerCase(),
        client_id:
          ticket.clientId ||
          currentUser?.clientId ||
          currentUser?.company_id ||
          null,
        created_by: ticket.createdById || currentUser?.id || null,
        createdByName: ticket.createdByName || currentUser?.name || null,
        createdByEmail: ticket.createdByEmail || currentUser?.email || null,
      };
      const res = await api.post("/support/tickets", payload);
      if (res.data?.success) {
        await fetchTickets();
        addLog({
          action: "Ticket Creation",
          detail: `Ticket opened: ${ticket.subject}`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add support ticket:", error);
    }
  };

  const updateSupportTicket = async (ticketOrId, status = null) => {
    try {
      let id, payload;
      if (typeof ticketOrId === "object") {
        id = ticketOrId.db_id || ticketOrId.id;
        id = ticketOrId.db_id || ticketOrId.id;
        // Ensure ID has TKT- prefix if it's supposed to
        if (typeof id === "string" && !id.startsWith("TKT-")) id = `TKT-${id}`;

        payload = {
          status: (ticketOrId.status || "open").toLowerCase().replace(" ", "_"),
          messages: ticketOrId.messages,
          dispute_status: ticketOrId.dispute_status || "none",
          refund_amount: ticketOrId.refund_amount || 0,
        };
      } else {
        id = ticketOrId;
        if (typeof id === "string" && !id.startsWith("TKT-")) id = `TKT-${id}`;
        payload = { status: status.toLowerCase().replace(" ", "_") };
      }
      await api.put(`/support/tickets/${id}`, payload);
      await fetchTickets();
      addLog({
        action: "Ticket Update",
        detail: `Synchronized support ticket ${id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update ticket:", error);
    }
  };

  const addGuestRequest = async (request) => {
    try {
      const formattedTime = formatDateTime(request.date, request.time);
      const userRole = String(currentUser?.role?.name || currentUser?.role || "")
        .toLowerCase()
        .replace(/\s+/g, "_");
      const isClientRole = [
        "client",
        "customer",
        "admin",
        "saas_client",
      ].includes(userRole);
      const payload = {
        client_id:
          request.clientId ||
          (isClientRole
            ? currentUser.clientId || currentUser.company_id
            : clients.find((c) => c.name === request.client)?.id || null),
        guest: request.guest || "Guest",
        requested_by: request.requestedBy || currentUser?.name || "Staff",
        request_details: request.request || request.details || "",
        delivery_time: formattedTime,
        priority: (request.priority || "medium").toLowerCase(),
        status: (request.status || "pending").toLowerCase(),
      };
      console.log('[GuestRequest] Creating:', payload);
      const res = await api.post("/support/guest-requests", payload);
      if (res.data?.success) {
        await fetchTickets(); // Re-fetch all tickets to include new one with mapped fields
        addLog({
          action: "Concierge Request",
          detail: `New guest requirement logged for ${request.guest}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add guest request:", error);
    }
  };

  const updateGuestRequest = async (data) => {
    try {
      const { id, requestId, ...updateData } = data;
      // Use requestId (GRQ-XXXX) if available, fall back to id
      const reqId = requestId || id;
      const formattedTime = formatDateTime(updateData.date, updateData.time);
      const reqData = {
        guest: updateData.guest || updateData.guestName || "Guest",
        requested_by: updateData.requestedBy || updateData.requested_by || "",
        request_details:
          updateData.request || updateData.request_details || "",
        delivery_time: formattedTime,
        priority: (updateData.priority || "medium").toLowerCase(),
        status: (updateData.status || "pending").toLowerCase(),
      };
      console.log('[GuestRequest] Updating:', reqId, reqData);
      await api.put(`/support/guest-requests/${reqId}`, reqData);
      await fetchTickets(); // Sync state
      addLog({
        action: "Concierge Update",
        detail: `Request ${reqId} parameters updated.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to update guest request:", error);
    }
  };

  const deleteGuestRequest = async (id) => {
    try {
      await api.delete(`/support/guest-requests/${id}`);
      setGuestRequests((prev) => prev.filter((r) => r.id !== id));
      addLog({
        action: "Concierge Request Cancelled",
        detail: `Removed guest requirement reference ${id}.`,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to delete guest request:", error);
    }
  };

  const recordWorkSession = (session) => {
    // session = { userId, userName, start, end, durationHours }
    const entry = {
      id: `SESS-${Date.now()}`,
      userId: session.userId,
      userName: session.userName,
      period: `${new Date(session.start).toLocaleDateString()} ${new Date(session.start).toLocaleTimeString()} - ${new Date(session.end).toLocaleTimeString()}`,
      date: new Date().toISOString().split("T")[0],
      hours: Number(session.durationHours).toFixed(2),
      total: `$${(session.durationHours * 25).toFixed(2)}`, // Base calculated rate $25/hr
      status: "Logged",
      type: "Service Record",
    };
    setPayHistory((prev) => [entry, ...prev]);
    addLog({
      action: "Shift Hours Logged",
      detail: `${session.userName} completed ${session.durationHours.toFixed(2)}h shift. Pay added to cycle.`,
      type: "system",
    });
  };

  const addLeaveRequest = async (requestData) => {
    try {
      const payload = {
        user_id: requestData.userId,
        company_id: requestData.tenantId || currentUser?.tenantId || currentUser?.company_id,
        leave_type: requestData.type,
        start_date: requestData.start,
        end_date: requestData.end,
        hours: requestData.hours,
        reason: requestData.reason || "No reason provided",
      };
      const res = await api.post("/staff/leave", payload);
      if (res.data?.success) {
        await fetchLeaveRequests();
        addLog({
          action: "Leave Requested",
          detail: `Submitted ${requestData.type} request.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to add leave request:", error);
    }
  };

  const fetchUrgentTasks = React.useCallback(async () => {
    try {
      const res = await api.get('/logistics/urgent');
      if (res.data?.success) {
        setUrgentTasks(res.data.data.map(t => ({
          ...t,
          id: t.alertId || t.id,
        })));
      }
    } catch (error) {
      console.error("Failed to fetch urgent tasks:", error);
    }
  }, []);

  const addUrgentTask = async (task) => {
    try {
      const res = await api.post('/logistics/urgent', task);
      if (res.data?.success) {
        setUrgentTasks((prev) => [{ ...task, id: res.data.data.id }, ...prev]);
        addLog({
          action: "Urgent Task Logged",
          detail: task.task,
          type: "alert",
        });
      }
    } catch (error) {
      console.error("Failed to add urgent task:", error);
    }
  };

  const updateUrgentTask = async (updated) => {
    try {
      await api.put(`/logistics/urgent/${updated.id}`, updated);
      setUrgentTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (error) {
      console.error("Failed to update urgent task:", error);
    }
  };

  const deleteUrgentTask = async (id) => {
    try {
      await api.delete(`/logistics/urgent/${id}`);
      setUrgentTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error("Failed to delete urgent task:", error);
    }
  };

  const updateLeaveRequest = async (reqData) => {
    try {
      const statusMap = {
        Approved: "approved",
        Rejected: "rejected",
        Pending: "pending",
      };
      const postData = {
        status: reqData.status ? (statusMap[reqData.status] || reqData.status.toLowerCase()) : undefined,
        leave_type: reqData.type || reqData.leave_type,
        start_date: reqData.start || reqData.start_date,
        end_date: reqData.end || reqData.end_date,
        hours: reqData.hours,
        reason: reqData.reason,
      };
      const res = await api.put(`/staff/leave/${reqData.id}`, postData);
      if (res.data?.success) {
        await fetchLeaveRequests();
        addLog({
          action: "Leave Updated",
          detail: `Leave request ${reqData.id} updated.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to update leave request:", error);
    }
  };

  const deleteLeaveRequest = async (id) => {
    try {
      const res = await api.delete(`/staff/leave/${id}`);
      if (res.data?.success) {
        await fetchLeaveRequests();
        addLog({
          action: "Leave Request Deleted",
          detail: `Deleted leave request ${id}.`,
          type: "system",
        });
      }
    } catch (error) {
      console.error("Failed to delete leave request:", error);
      throw error;
    }
  };

  const generateSaaSInvoice = (client) => {
    const invId = `SaaS-${Math.floor(1000 + Math.random() * 9000)}`;
    const newInvoice = {
      id: invId,
      clientId: client.id,
      clientName: client.name,
      totalAmount:
        client.plan === "Platinum"
          ? 4999
          : client.plan === "Executive"
            ? 2499
            : 999,
      paidAmount: 0,
      status: "Unpaid",
      date: new Date().toISOString().split("T")[0],
      type: "SaaS Subscription",
      orderId: `WS-${client.id}`,
    };
    setInvoices((prev) => [newInvoice, ...prev]);
    addLog({
      action: "SaaS Invoice Generated",
      detail: `Subscription invoice ${invId} issued for ${client.name}.`,
      type: "finance",
    });
    return newInvoice;
  };

  console.log("GlobalData Provider providing:", {
    fetchSubscriptionRequests,
    fetchSupportingDocs,
  });
  const reportSecurityEvent = useCallback(async (data) => {
    try {
      await api.post('/security', data);
      addLog({
        action: data.eventType === 'PANIC' ? 'Emergency Panic' : 'Security Breach',
        detail: `Security event logged: ${data.eventType}`,
        type: 'alert'
      });
      fetchSecurityEvents();
      return true;
    } catch (error) {
      console.error("Failed to report security event:", error);
      return false;
    }
  }, [addLog]);

  const fetchSecurityEvents = useCallback(async () => {
    try {
      const res = await api.get('/security');
      if (res.data?.success) {
        setSecurityEvents(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch security events:", error);
    }
  }, []);

  const resolveSecurityEvent = useCallback(async (id) => {
    try {
      await api.put(`/security/${id}/resolve`);
      setSecurityEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'Resolved' } : e));
      return true;
    } catch (error) {
      console.error("Failed to resolve security event:", error);
      return false;
    }
  }, []);

  return (
    <GlobalDataContext.Provider
      value={{
        // Auth & User
        currentUser,
        setCurrentUser,
        activatePersonalMembership,
        cancelPersonalMembership,
        hasPermission,
        menuPermissions,
        setMenuPermissions,
        hasMenuPermission,
        roles,

        // Notifications
        notifications,
        unreadCount,
        fetchNotifications,
        markNotificationRead,
        markAllNotificationsRead,

        // Clients
        clients,
        setClients,
        fetchClients,
        addClient,
        updateClient,
        deleteClient,
        updateClientBranding,

        // Staff & Assignments
        users,
        setUsers,
        fetchStaff,
        addUser,
        updateUser,
        deleteUser,
        toggleAvailability,
        reviewStaff,
        customerUsers,
        fetchCustomerUsers,
        staffAssignments,
        addStaffAssignment,
        updateAssignment,
        updateMission,
        fetchSupportingDocs,
        clockIn,
        clockOut,
        payHistory,
        setPayHistory,
        fetchPayHistory,
        recordWorkSession,
        getVacationBalance,
        workStatusOptions: ["Probation", "Full Time", "Part Time", "Inactive"],
        leaveRequests,
        fetchLeaveRequests,
        addLeaveRequest,
        updateLeaveRequest,
        deleteLeaveRequest,
        teams,
        setTeams,
        // Inventory
        inventory,
        setInventory,
        fetchInventory,
        addInventory,
        updateInventory,
        deleteInventory,
        issueInventory,
        recordLoss,
        fetchInventoryAlerts,
        inventoryAlerts,
        acknowledgeInventoryAlert,
        luxuryItems,
        setLuxuryItems,
        fetchLuxuryItems,
        addLuxuryItem,
        updateLuxuryItem,
        deleteLuxuryItem,
        stockMovements,
        fetchStockMovements,
        addStockEntry,
        issueStock,

        // Procurement
        vendors,
        marketplaceVendors,
        setVendors,
        fetchVendors,
        addVendor,
        updateVendor,
        deleteVendor,
        purchaseRequests,
        setPurchaseRequests,
        addPurchaseRequest,
        updatePurchaseRequest,
        deletePurchaseRequest,
        fetchPurchaseRequests,
        quotes,
        setQuotes,
        addQuote,
        updateQuote,
        deleteQuote,
        fetchProcurement,
        fetchQuotes,
        purchaseOrders,
        setPurchaseOrders,
        addPurchaseOrder,
        updatePurchaseOrder,
        receiveGoodsAgainstPO,
        approvePOReceipt,
        reverseGoodsReceipt,
        fetchPurchaseOrders,
        cart,
        addToCart,
        removeFromCart,
        clearCart,

        // Orders, Missions & Projects
        orders,
        setOrders,
        fetchOrders,
        addOrder,
        updateOrder,
        deleteOrder,
        launchMissionFromOrder,
        assignOrderToStage,
        missions,
        setMissions,
        fetchMissions,
        updateMissionStatus,
        assignMissionDriver,
        deleteMission,
        projects,
        setProjects,
        fetchProjects,
        addProject,
        updateProject,
        deleteProject,
        convertOrderToProject,
        convertProjectToMission,

        // Logistics & Fleet
        fleet,
        setFleet,
        fetchFleet,
        addFleet,
        updateFleet,
        deleteFleet,
        dispatchVehicle,
        deliveries,
        setDeliveries,
        fetchDeliveries,
        addDelivery,
        updateDelivery,
        deleteDelivery,
        confirmDeliveryReceipt,
        routes,
        setRoutes,
        fetchRoutes,
        addRoute,
        updateRoute,
        deleteRoute,
        urgentTasks,
        fetchUrgentTasks,
        addUrgentTask,
        updateUrgentTask,
        deleteUrgentTask,
        deliveryPricing,
        setDeliveryPricing,
        updateDeliveryPricing: updateDeliveryPricingTier,
        shippingModePricing,
        updateShippingModePricing,
        updateDeliveryTiers,
        tracking,
        fetchTracking,
        addTracking,
        updateTracking,
        deleteTracking,
        warehouses,
        setWarehouses,
        fetchWarehouses,
        addWarehouse,
        updateWarehouse,
        deleteWarehouse,

        // Concierge & Support
        guestRequests,
        setGuestRequests,
        fetchTickets,
        addGuestRequest,
        updateGuestRequest,
        deleteGuestRequest,
        events,
        setEvents,
        addEvent,
        updateEvent,
        deleteEvent,
        chauffeurRequests,
        setChauffeurRequests,
        fetchChauffeurRequests,
        addChauffeurRequest,
        updateChauffeurRequest,
        deleteChauffeurRequest,
        supportTickets,
        addSupportTicket,
        updateSupportTicket,

        // Finance
        invoices,
        setInvoices,
        fetchFinance,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        generateSaaSInvoice,
        settleInvoice,
        generateInvoiceFromOrder,
        payments,
        setPayments,
        getRevenueChartData,
        revenueFilter,
        setRevenueFilter,

        // Admin & Plans
        accessPlans,
        setAccessPlans,
        fetchAccessPlans,
        addPlan,
        updatePlan,
        deletePlan,
        activePlan,
        setActivePlan,
        saasRequests,
        submitSaaSRequest,
        processSaaSRequest,
        subscriptionRequests,
        fetchSubscriptionRequests,
        dispatchSubscriptionRequest,
        updateSubscriptionRequest,
        deleteSubscriptionRequest,

        // Audits & Logs
        audits,
        fetchAudits,
        addAudit,
        updateAudit,
        deleteAudit,
        logs,
        addLog,
        fetchDashboardLogs,

        // Dashboard & Settings
        dashboardStats,
        fetchDashboardStats,
        lossAssessments,
        fetchLossAssessments,
        systemSettings,
        fetchSystemSettings,
        setSystemSettings,

        // Utility
        refreshData: fetchInitialData,
        fetchInitialData,
        reportSecurityEvent,
        securityEvents,
        fetchSecurityEvents,
        resolveSecurityEvent,
      }}
    >
      {children}
    </GlobalDataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(GlobalDataContext);
  if (!context)
    throw new Error("useData must be used within GlobalDataProvider");
  return context;
};
