import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Store, Package, ShoppingCart,
  Truck, Calendar, BarChart3, UserCog, Settings, X, Menu,
  Box, LogOut, Briefcase, Navigation, Activity, AlertCircle,
  ShieldCheck, ClipboardList, Gift, Heart, Headphones,
  ShoppingBag, Map, History, FileText, Smartphone, CreditCard,
  Globe, Car, Sparkles, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const menuItems = {
  superadmin: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    // { icon: Activity, label: 'Analytics', path: '/dashboard/analytics' },
    { icon: Users, label: 'Clients', path: '/dashboard/clients' },
    { icon: Store, label: 'Vendors', path: '/dashboard/vendors' },
    { icon: UserCog, label: 'HQ Personnel', path: '/dashboard/users' },
    { icon: BarChart3, label: 'Audit Protocol', path: '/dashboard/audits' },
    { icon: Globe, label: 'Plans', path: '/dashboard/plans' },
    { icon: ShieldAlert, label: 'Security Incidents', path: '/dashboard/security-events' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
  ],
  operations: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    // { icon: Activity, label: 'Analytics', path: '/dashboard/analytics' },
    { icon: Briefcase, label: 'Projects', path: '/dashboard/projects' },
    { icon: ShoppingCart, label: 'Orders', path: '/dashboard/orders' },
    { icon: Navigation, label: 'Missions', path: '/dashboard/missions' },
    { icon: Truck, label: 'Deliveries', path: '/dashboard/deliveries' },
    { icon: FileText, label: 'Invoices', path: '/dashboard/invoices' },
    // { icon: CreditCard, label: 'Payments', path: '/dashboard/payments' },
    { icon: Smartphone, label: 'Staff Terminal', path: '/dashboard/staff-terminal' },
    { icon: Calendar, label: 'Leave & Absence', path: '/dashboard?tab=leave' },
    { icon: History, label: 'Pay & Records', path: '/dashboard?tab=pay' },
  ],
  procurement: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: ShoppingCart, label: 'Purchase Requests', path: '/dashboard/purchase-requests' },
    { icon: Store, label: 'Vendors', path: '/dashboard/vendors' },
    { icon: Box, label: 'Quotes', path: '/dashboard/quotes' },
    { icon: FileText, label: 'Purchase Orders', path: '/dashboard/purchase-orders' },
    { icon: FileText, label: 'Invoices', path: '/dashboard/invoices' },
    { icon: BarChart3, label: 'Audit Log', path: '/dashboard/audits' },
    { icon: Calendar, label: 'Leave & Absence', path: '/dashboard?tab=leave' },
    { icon: History, label: 'Pay & Records', path: '/dashboard?tab=pay' },
  ],
  logistics: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Navigation, label: 'Active Missions', path: '/dashboard/missions' },
    { icon: Truck, label: 'Deliveries', path: '/dashboard/deliveries' },
    { icon: Truck, label: 'Fleet', path: '/dashboard/fleet' },
    { icon: Navigation, label: 'Routes', path: '/dashboard/logistics-routes' },
    { icon: Activity, label: 'Tracking', path: '/dashboard/logistics-tracking' },
    { icon: AlertCircle, label: 'Urgent', path: '/dashboard/logistics-urgent' },
    { icon: Smartphone, label: 'Staff Terminal', path: '/dashboard/staff-terminal' },
    { icon: Calendar, label: 'Leave & Absence', path: '/dashboard?tab=leave' },
    { icon: History, label: 'Pay & Records', path: '/dashboard?tab=pay' },
  ],
  inventory: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Package, label: 'StockHub', path: '/dashboard/inventory' },
    { icon: Store, label: 'Warehouse', path: '/dashboard/warehouses' },
    { icon: AlertCircle, label: 'Alerts', path: '/dashboard/inventory-alerts' },
    { icon: BarChart3, label: 'Audit Protocol', path: '/dashboard/audits' },
    { icon: Smartphone, label: 'Staff Terminal', path: '/dashboard/staff-terminal' },
    { icon: Calendar, label: 'Leave & Absence', path: '/dashboard?tab=leave' },
    { icon: History, label: 'Pay & Records', path: '/dashboard?tab=pay' },
  ],
  concierge: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: ShoppingCart, label: 'Orders', path: '/dashboard/orders' },
    { icon: Calendar, label: 'Events', path: '/dashboard/events' },
    { icon: Heart, label: 'Guest Requests', path: '/dashboard/guest-requests' },
    { icon: Gift, label: 'Luxury Items', path: '/dashboard/luxury-items' },
    { icon: Package, label: 'Storage Hub', path: '/dashboard/inventory' },
    { icon: ShieldCheck, label: 'Access Plans', path: '/dashboard/vip-access' },
    { icon: Car, label: 'Chauffeur Protocol', path: '/dashboard/chauffeur' },
    { icon: Calendar, label: 'Leave & Absence', path: '/dashboard?tab=leave' },
    { icon: History, label: 'Pay & Records', path: '/dashboard?tab=pay' },
  ],
  admin: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    // { icon: Activity, label: 'Analytics', path: '/dashboard/analytics' },
    { icon: Users, label: 'Customers', path: '/dashboard/clients' },
    { icon: ShoppingCart, label: 'Orders', path: '/dashboard/orders' },
    { icon: Briefcase, label: 'Projects', path: '/dashboard/projects' },
    { icon: Navigation, label: 'Missions', path: '/dashboard/missions' },
    { icon: Truck, label: 'Deliveries', path: '/dashboard/deliveries' },
    { icon: Package, label: 'Inventory', path: '/dashboard/inventory' },
    { icon: UserCog, label: 'Staff Management', path: '/dashboard/users' },
    { icon: FileText, label: 'Invoices', path: '/dashboard/invoices' },
    // { icon: CreditCard, label: 'Payments', path: '/dashboard/payments' },
    { icon: CreditCard, label: 'Payroll', path: '/dashboard/payroll' },
    { icon: BarChart3, label: 'Reports', path: '/dashboard/reports' },
    { icon: Headphones, label: 'Support', path: '/dashboard/support-tickets' },
    { icon: Car, label: 'Chauffeur', path: '/dashboard/chauffeur' },
    { icon: Calendar, label: 'Events', path: '/dashboard/events' },
    { icon: Heart, label: 'Guest Requests', path: '/dashboard/guest-requests' },
    { icon: Gift, label: 'Luxury Items', path: '/dashboard/luxury-items' },
    { icon: Store, label: 'Vendors', path: '/dashboard/vendors' },
    { icon: ShoppingCart, label: 'Purchase Requests', path: '/dashboard/purchase-requests' },
    { icon: Box, label: 'Quotes', path: '/dashboard/quotes' },
    { icon: FileText, label: 'Purchase Orders', path: '/dashboard/purchase-orders' },
    { icon: Truck, label: 'Fleet', path: '/dashboard/fleet' },
    { icon: Store, label: 'Warehouses', path: '/dashboard/warehouses' },
    { icon: BarChart3, label: 'Audit Protocol', path: '/dashboard/audits' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
    { icon: ShieldCheck, label: 'Security Protocol', path: '/dashboard/roles-permissions' },
    { icon: ShieldAlert, label: 'Security Incidents', path: '/dashboard/security-events' },
    { icon: Calendar, label: 'Leave & Absence', path: '/dashboard/leave' },
  ],
  client: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Customers', path: '/dashboard/clients' },
    { icon: ShoppingCart, label: 'Orders', path: '/dashboard/orders' },
    { icon: Briefcase, label: 'Projects', path: '/dashboard/projects' },
    { icon: Navigation, label: 'Missions', path: '/dashboard/missions' },
    { icon: Truck, label: 'Deliveries', path: '/dashboard/deliveries' },
    { icon: Package, label: 'Inventory', path: '/dashboard/inventory' },
    { icon: UserCog, label: 'Staff Management', path: '/dashboard/users' },
    { icon: FileText, label: 'Invoices', path: '/dashboard/invoices' },
    { icon: CreditCard, label: 'Payroll', path: '/dashboard/payroll' },
    { icon: BarChart3, label: 'Reports', path: '/dashboard/reports' },
    { icon: Headphones, label: 'Support', path: '/dashboard/support' },
    { icon: Car, label: 'Chauffeur', path: '/dashboard/chauffeur' },
    { icon: Calendar, label: 'Events', path: '/dashboard/events' },
    { icon: Heart, label: 'Guest Requests', path: '/dashboard/guest-requests' },
    { icon: Gift, label: 'Luxury Items', path: '/dashboard/luxury-items' },
    { icon: Store, label: 'Vendors', path: '/dashboard/vendors' },
    { icon: ShoppingCart, label: 'Purchase Requests', path: '/dashboard/purchase-requests' },
    { icon: Box, label: 'Quotes', path: '/dashboard/quotes' },
    { icon: FileText, label: 'Purchase Orders', path: '/dashboard/purchase-orders' },
    { icon: Truck, label: 'Fleet', path: '/dashboard/fleet' },
    { icon: Store, label: 'Warehouses', path: '/dashboard/warehouses' },
    { icon: BarChart3, label: 'Audit Protocol', path: '/dashboard/audits' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
    { icon: ShieldCheck, label: 'Security Protocol', path: '/dashboard/roles-permissions' },
    { icon: Calendar, label: 'Leave & Absence', path: '/dashboard/leave' },
  ],
  saas_client: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Customers', path: '/dashboard/clients' },
    { icon: ShoppingCart, label: 'Orders', path: '/dashboard/orders' },
    { icon: Briefcase, label: 'Projects', path: '/dashboard/projects' },
    { icon: Navigation, label: 'Missions', path: '/dashboard/missions' },
    { icon: Truck, label: 'Deliveries', path: '/dashboard/deliveries' },
    { icon: Package, label: 'Inventory', path: '/dashboard/inventory' },
    { icon: UserCog, label: 'Staff Management', path: '/dashboard/users' },
    { icon: FileText, label: 'Invoices', path: '/dashboard/invoices' },
    { icon: CreditCard, label: 'Payroll', path: '/dashboard/payroll' },
    { icon: BarChart3, label: 'Reports', path: '/dashboard/reports' },
    { icon: Headphones, label: 'Support', path: '/dashboard/support' },
    { icon: Car, label: 'Chauffeur', path: '/dashboard/chauffeur' },
    { icon: Calendar, label: 'Events', path: '/dashboard/events' },
    { icon: Heart, label: 'Guest Requests', path: '/dashboard/guest-requests' },
    { icon: Gift, label: 'Luxury Items', path: '/dashboard/luxury-items' },
    { icon: Store, label: 'Vendors', path: '/dashboard/vendors' },
    { icon: ShoppingCart, label: 'Purchase Requests', path: '/dashboard/purchase-requests' },
    { icon: Box, label: 'Quotes', path: '/dashboard/quotes' },
    { icon: FileText, label: 'Purchase Orders', path: '/dashboard/purchase-orders' },
    { icon: Truck, label: 'Fleet', path: '/dashboard/fleet' },
    { icon: Store, label: 'Warehouses', path: '/dashboard/warehouses' },
    { icon: BarChart3, label: 'Audit Protocol', path: '/dashboard/audits' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
    { icon: ShieldCheck, label: 'Security Protocol', path: '/dashboard/roles-permissions' },
    { icon: Calendar, label: 'Leave & Absence', path: '/dashboard/leave' },
  ],
  customer: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: ShoppingBag, label: 'Marketplace', path: '/dashboard/store' },
    { icon: ShoppingCart, label: 'My Orders', path: '/dashboard/client-orders' },
    { icon: Truck, label: 'Track Delivery', path: '/dashboard/track-delivery' },
    { icon: Car, label: 'Chauffeur', path: '/dashboard/chauffeur' },
    { icon: Sparkles, label: 'Membership', path: '/dashboard/membership' },
    { icon: Calendar, label: 'Events', path: '/dashboard/events' },
    { icon: Heart, label: 'Guest Requests', path: '/dashboard/guest-requests' },
    { icon: Gift, label: 'Luxury Items', path: '/dashboard/luxury-items' },
    { icon: Headphones, label: 'Support', path: '/dashboard/support' },
    { icon: ShoppingCart, label: 'Purchase Requests', path: '/dashboard/purchase-requests' },
    { icon: BarChart3, label: 'Audit Protocol', path: '/dashboard/audits' },
  ],
  staff: [
    { icon: LayoutDashboard, label: 'Staff Terminal', path: '/dashboard' },
    { icon: Smartphone, label: 'My Assignments', path: '/dashboard?tab=assignments' },
    { icon: Map, label: 'Field Map', path: '/dashboard?tab=map' },
    { icon: Calendar, label: 'Leave & Absence', path: '/dashboard?tab=leave' },
    { icon: History, label: 'Pay & Records', path: '/dashboard?tab=pay' },
  ]
};

/** Business-account (`client`) sidebar: matches portal + invoices + procurement + inventory + concierge — not full HQ/staff ops menu */
const businessClientMenu = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Customers', path: '/dashboard/clients' },
  { icon: UserCog, label: 'Staff & Users', path: '/dashboard/users' },
  { icon: ShoppingCart, label: 'Orders', path: '/dashboard/orders' },
  { icon: Truck, label: 'Deliveries', path: '/dashboard/deliveries' },
  { icon: FileText, label: 'Invoices', path: '/dashboard/invoices' },
  { icon: ClipboardList, label: 'Purchase Requests', path: '/dashboard/purchase-requests' },
  { icon: Box, label: 'Quotes', path: '/dashboard/quotes' },
  { icon: FileText, label: 'Purchase Orders', path: '/dashboard/purchase-orders' },
  { icon: Truck, label: 'Fleet', path: '/dashboard/fleet' },
  { icon: Package, label: 'Inventory', path: '/dashboard/inventory' },
  { icon: BarChart3, label: 'Audit Protocol', path: '/dashboard/audits' },
  { icon: Store, label: 'Warehouses', path: '/dashboard/warehouses' },
  { icon: Store, label: 'Vendors', path: '/dashboard/vendors' },
  { icon: Calendar, label: 'Events', path: '/dashboard/events' },
  { icon: Heart, label: 'Guest Requests', path: '/dashboard/guest-requests' },
  { icon: Gift, label: 'Luxury Items', path: '/dashboard/luxury-items' },
  { icon: Car, label: 'Chauffeur', path: '/dashboard/chauffeur' },
  { icon: Headphones, label: 'Support', path: '/dashboard/support' },
  { icon: ShieldAlert, label: 'Security Incidents', path: '/dashboard/security-events' },
  { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
  { icon: Calendar, label: 'Leave & Absence', path: '/dashboard/leave' },
];

import { useData } from '../context/GlobalDataContext';
import { normalizeRole } from '../utils/authUtils';

const ROLE_DISPLAY = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  operations: 'Operations',
  procurement: 'Procurement',
  logistics: 'Logistics',
  inventory: 'Inventory',
  concierge: 'Concierge',
  client: 'Business Client',
  saas_client: 'SaaS Admin',
  customer: 'Personal User',
  staff: 'Field Staff',
};

const Sidebar = ({ isOpen, toggleSidebar, role }) => {
  const { currentUser, menuPermissions, hasMenuPermission } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const userRole = normalizeRole(role || 'superadmin');

  const dbRoleName = typeof currentUser?.role === 'object' ? currentUser?.role?.name : currentUser?.role;
  const displayRole = dbRoleName ? String(dbRoleName).replace(/_/g, ' ') : userRole;

  const userInitials = currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'ZN';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('user');
    localStorage.removeItem('menuPermissions');
    window.location.href = '/login';
  };

  // Dynamic menu: if menuPermissions are loaded from the DB, use them.
  // Otherwise fall back to the static menuItems map.
  const isSuperAdmin = ['superadmin', 'super_admin'].includes(userRole);
  const { clients } = useData();

  // Plan-based access for customer role
  const userPlan = (currentUser?.plan || 'Free').toLowerCase();
  // Personal (customer) users: no Events, no Concierge, no Invoices — pay at checkout; chauffeur + membership
  const planMenuAccess = {
    free: ['Dashboard', 'Marketplace', 'My Orders', 'Track Delivery', 'Chauffeur', 'Membership', 'Support'],
    basic: ['Dashboard', 'Marketplace', 'My Orders', 'Track Delivery', 'Chauffeur', 'Membership', 'Support'],
    standard: ['Dashboard', 'Marketplace', 'My Orders', 'Track Delivery', 'Chauffeur', 'Membership', 'Support'],
    executive: ['Dashboard', 'Marketplace', 'My Orders', 'Track Delivery', 'Chauffeur', 'Membership', 'Support'],
    platinum: ['Dashboard', 'Marketplace', 'My Orders', 'Track Delivery', 'Chauffeur', 'Membership', 'Support'],
    premium: ['Dashboard', 'Marketplace', 'My Orders', 'Track Delivery', 'Chauffeur', 'Membership', 'Support', 'Purchase Requests', 'Audit Protocol'],
    enterprise: ['Dashboard', 'Marketplace', 'My Orders', 'Track Delivery', 'Chauffeur', 'Membership', 'Support', 'Purchase Requests', 'Audit Protocol'],
  };

  const currentMenu = (() => {
    let baseMenu = [];
    if (userRole === 'client' || userRole === 'saas_client') {
      baseMenu = businessClientMenu;
    } else {
      baseMenu = menuItems[userRole] || menuItems.superadmin;
    }

    if (userRole === 'customer') {
      let allowed = planMenuAccess[userPlan] || planMenuAccess.free;
      if (currentUser?.concierge_member || currentUser?.conciergeMembership) {
        allowed = [...allowed, 'Events', 'Guest Requests', 'Luxury Items'];
      }
      return baseMenu.filter(item => allowed.includes(item.label));
    }

    return baseMenu.filter(item => {
      // 1. Remove 'Settings' from forced inclusion so it can be hidden from personal clients
      if (['Dashboard', 'Profile', 'Sign Out'].includes(item.label)) {
        return true;
      }

      // 2. Bypass DB permissions for external roles, forcing them to use our hardcoded arrays
      if (['staff', 'customer', 'client', 'saas_client', 'concierge', 'inventory', 'logistics'].includes(userRole)) {
        return true;
      }

      // 3. Keep DB permission check only for internal staff (admin, procurement, etc.)
      if (hasMenuPermission) {
        return hasMenuPermission(item.label, 'can_view');
      }
      return true;
    });
  })();
  // For SaaS tenant admins and business clients — show their company name as branding
  const tenantCompanyName = currentUser?.company_name || currentUser?.companyName || null;
  const tenantType = currentUser?.tenant_type || null;

  const clientBranding = (userRole === 'client' || userRole === 'admin' || userRole === 'saas_client')
    ? (clients || []).find(c =>
      String(c.id).replace('CLT-', '') === String(currentUser?.clientId).replace('CLT-', '') ||
      String(c.id) === String(currentUser?.company_id) ||
      c.name === currentUser?.name
    )?.branding
    : null;

  // Determine display name and tagline for sidebar header
  const sidebarBrandName = clientBranding?.businessName
    || tenantCompanyName
    || 'ZANEZION';

  const sidebarTagline = clientBranding?.tagline
    || (userRole === 'concierge' ? 'Concierge Services' : null)
    || (tenantType === 'saas' ? 'Workspace' : null)
    || (tenantType === 'business' ? 'Business Portal' : null)
    || 'Institutional';

  return (
    <>
      <AnimatePresence>
        {isMobile && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: (isMobile && !isOpen) ? '-100%' : 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="fixed top-0 left-0 h-[100dvh] w-72 max-[320px]:w-[260px] bg-sidebar border-r border-border z-50 flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="p-4 md:p-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="w-10 h-10 md:w-11 md:h-11 bg-white border border-white/10 rounded-xl flex items-center justify-center shadow-2xl overflow-hidden shrink-0 transition-transform group-hover:scale-105 p-1.5">
              <img
                src={clientBranding?.logo || "/logo.png"}
                alt={sidebarBrandName}
                className={`w-full h-full object-contain ${!clientBranding?.logo ? 'scale-[2.2]' : ''} transition-all duration-300`}
              />
            </div>
            <div className="flex flex-col min-w-0 pr-2 overflow-hidden">
              <span className="text-xs md:text-sm font-black tracking-tight text-white group-hover:text-accent transition-colors uppercase leading-tight truncate">
                {sidebarBrandName}
              </span>
              <span className="text-[7px] md:text-[8px] font-bold tracking-[0.1em] text-accent/80 uppercase opacity-70 group-hover:opacity-100 italic truncate">
                {sidebarTagline}
              </span>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSidebar();
              }}
              className="p-2 ml-auto text-secondary hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
              aria-label="Close Sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {currentMenu.map((item) => {
            const currentPathWithSearch = location.pathname + location.search;
            const isActive =
              currentPathWithSearch === item.path ||
              (item?.path && item.path !== '/dashboard' && !item.path.includes('?tab=') &&
                (location.pathname === item.path || location.pathname.startsWith(item.path + '/')));

            return (
              <NavLink
                key={item.label}
                to={item.path}
                onClick={() => isMobile && toggleSidebar()}
                className={`
                    flex items-center gap-4 px-4 py-3.5 md:py-3 rounded-xl transition-all duration-300 group touch-manipulation
                    ${isActive
                    ? 'bg-accent text-black font-bold shadow-[0_8px_20px_-4px_rgba(200,169,106,0.3)]'
                    : 'text-secondary hover:text-white hover:bg-white/5 active:bg-white/10'
                  }
                  `}
              >
                <item.icon size={22} className={`shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
                <span className="text-sm md:text-sm tracking-wide">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 md:p-4 pb-6 md:pb-8 border-t border-border mt-auto bg-sidebar/50 backdrop-blur-md shrink-0">
          <div
            onClick={() => navigate('/dashboard/profile')}
            className="bg-white/5 border border-white/[0.08] rounded-2xl p-3 md:p-4 mb-3 md:mb-4 cursor-pointer hover:bg-white/10 transition-all duration-300"
            title="View Profile"
          >
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-10 h-10 md:w-10 md:h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold shadow-inner text-sm uppercase">
                  {userInitials}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success border-2 border-sidebar rounded-full"></div>
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{currentUser?.name || 'Guest'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-muted truncate uppercase tracking-widest font-black">{displayRole}</p>
                  {userRole === 'customer' && currentUser?.plan && (
                    <span className="px-1.5 py-0.5 bg-accent/20 text-accent text-[8px] font-black uppercase rounded tracking-wider">{currentUser.plan}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3.5 md:py-3 rounded-xl text-secondary hover:text-danger hover:bg-danger/10 active:bg-danger/20 transition-all duration-300 group touch-manipulation"
          >
            <LogOut size={22} className="group-hover:-translate-x-1 shrink-0 transition-transform" />
            <span className="text-sm font-bold">Sign Out</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
