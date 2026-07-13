import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';

// Base Dashboards
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const OperationsDashboard = lazy(() => import('./pages/Operations/OperationsDashboard'));
const ProcurementDashboard = lazy(() => import('./pages/Procurement/ProcurementDashboard'));
const LogisticsDashboard = lazy(() => import('./pages/Logistics/LogisticsDashboard'));
const InventoryDashboardRole = lazy(() => import('./pages/Inventory/InventoryDashboardRole'));
const ConciergeDashboard = lazy(() => import('./pages/Concierge/ConciergeDashboard'));
const ClientDashboard = lazy(() => import('./pages/Client/ClientDashboard'));

// Management Pages
const Clients = lazy(() => import('./pages/Admin/Clients'));
const Vendors = lazy(() => import('./pages/Common/Vendors'));
const Orders = lazy(() => import('./pages/Common/Orders'));
const Inventory = lazy(() => import('./pages/Common/Inventory'));
const Reports = lazy(() => import('./pages/Admin/Reports'));
const Analytics = lazy(() => import('./pages/Admin/Analytics'));
const Users = lazy(() => import('./pages/Admin/Users'));
const RolesPermissions = lazy(() => import('./pages/Admin/RolesPermissions'));
const Settings = lazy(() => import('./pages/Common/Settings'));
const Profile = lazy(() => import('./pages/Common/Profile'));
const Projects = lazy(() => import('./pages/Operations/Projects'));
const Deliveries = lazy(() => import('./pages/Operations/Deliveries'));
const Missions = lazy(() => import('./pages/Operations/Missions'));

// Procurement Pages
const PurchaseRequests = lazy(() => import('./pages/Procurement/PurchaseRequests'));
const Quotes = lazy(() => import('./pages/Procurement/Quotes'));
const PurchaseOrders = lazy(() => import('./pages/Procurement/PurchaseOrders'));

// Logistics Pages
const Fleet = lazy(() => import('./pages/Logistics/Fleet'));
const LogisticsRoutes = lazy(() => import('./pages/Logistics/LogisticsRoutes'));
const LogisticsTracking = lazy(() => import('./pages/Logistics/LogisticsTracking'));
const LogisticsUrgent = lazy(() => import('./pages/Logistics/LogisticsUrgent'));

// Inventory Pages
const Warehouses = lazy(() => import('./pages/Inventory/Warehouses'));
const InventoryAlerts = lazy(() => import('./pages/Inventory/InventoryAlerts'));

// Concierge Pages
const Events = lazy(() => import('./pages/Concierge/Events'));
const GuestRequests = lazy(() => import('./pages/Concierge/GuestRequests'));
const LuxuryItems = lazy(() => import('./pages/Concierge/LuxuryItems'));
const ConciergeAccessPlans = lazy(() => import('./pages/Concierge/ConciergeAccessPlans'));

// Client Pages
const ClientOrders = lazy(() => import('./pages/Client/ClientOrders'));
const ClientEvents = lazy(() => import('./pages/Client/ClientEvents'));
const ClientTracking = lazy(() => import('./pages/Client/ClientTracking'));
const ClientInvoices = lazy(() => import('./pages/Client/ClientInvoices'));
const ClientSupport = lazy(() => import('./pages/Client/ClientSupport'));
const ClientStore = lazy(() => import('./pages/Client/ClientStore'));
const PersonalMembership = lazy(() => import('./pages/Client/PersonalMembership'));

// Core Pages
const Landing = lazy(() => import('./pages/Common/Landing'));
const Plans = lazy(() => import('./pages/Common/Plans'));
const EmployeePortal = lazy(() => import('./pages/Staff/EmployeePortal'));
const Login = lazy(() => import('./pages/Common/Login'));
const Payroll = lazy(() => import('./pages/Admin/Payroll'));
const Invoices = lazy(() => import('./pages/Common/Invoices'));
const Payments = lazy(() => import('./pages/Common/Payments'));
const StaffAudits = lazy(() => import('./pages/Admin/StaffAudits'));
const SecurityEvents = lazy(() => import('./pages/Admin/SecurityEvents'));
const SaaSManagement = lazy(() => import('./pages/Admin/SaaSManagement'));
const SaaSClients = lazy(() => import('./pages/Admin/SaaSClients'));
const SupportDashboard = lazy(() => import('./pages/Admin/SupportDashboard'));
const Chauffeur = lazy(() => import('./pages/Common/Chauffeur'));
const Audits = lazy(() => import('./pages/Common/Audits'));
const StaffSignup = lazy(() => import('./pages/Common/StaffSignup'));
const Signup = lazy(() => import('./pages/Common/Signup'));
const LeaveManagement = lazy(() => import('./pages/Admin/LeaveManagement'));
const Tenants = lazy(() => import('./pages/Admin/Tenants'));
const Departments = lazy(() => import('./pages/Admin/Departments'));
const Employees = lazy(() => import('./pages/Admin/Employees'));

import { GlobalDataProvider } from './context/GlobalDataContext';
import { normalizeRole, menuPathGrantsAccess } from './utils/authUtils';

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      <p className="text-secondary font-bold text-xs uppercase tracking-widest animate-pulse">Initializing Interface...</p>
    </div>
  </div>
);

const RoleProtectedRoute = ({ role, allowedRoles, children }) => {
  const location = useLocation();
  if (!localStorage.getItem('token') || !localStorage.getItem('userRole')) {
    return <Navigate to="/login" replace />;
  }
  // Full internal access — avoid missing a route in allowedRoles arrays
  if (role === 'superadmin') {
    return children;
  }
  // Company admin: full portal access (sidebar fixed); staff / others use allowedRoles + menuPermissions
  if (role === 'admin') {
    return children;
  }
  if (Array.isArray(allowedRoles) && allowedRoles.includes(role)) {
    return children;
  }
  try {
    const perms = JSON.parse(localStorage.getItem('menuPermissions') || '[]');
    if (perms.length > 0) {
      const hasPermission = perms.some(p =>
        p.can_view &&
        p.path &&
        menuPathGrantsAccess(location.pathname, location.search, p.path)
      );
      if (hasPermission) return children;
    }
  } catch (e) { /* ignore parse errors */ }
  return <Navigate to="/dashboard" replace />;
};

const PrivateDashboardRoute = ({ children, authIsAuthenticated, authRole }) => {
  // Use auth state passed from parent - don't re-check localStorage
  if (!authIsAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children(authRole);
};

const DashboardSelector = ({ role }) => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');

  // Shared staff features (Leave & Pay) for all personnel roles
  if (['operations', 'procurement', 'logistics', 'inventory', 'concierge', 'staff'].includes(role) && (tab === 'leave' || tab === 'pay')) {
    return <EmployeePortal />;
  }

  switch (role) {
    case 'operations': return <OperationsDashboard />;
    case 'procurement': return <ProcurementDashboard />;
    case 'logistics': return <LogisticsDashboard />;
    case 'inventory': return <InventoryDashboardRole />;
    case 'concierge': return <ConciergeDashboard />;
    case 'client': return <Dashboard />;
    case 'saas_client': return <ClientDashboard />;
    case 'customer': return <ClientDashboard />;
    case 'admin': return <Dashboard />;
    case 'staff': return <EmployeePortal />;
    default: return <Dashboard />;
  }
};

function App() {
  const [auth, setAuth] = useState({
    isAuthenticated: !!localStorage.getItem('token') && !!localStorage.getItem('userRole'),
    role: normalizeRole(localStorage.getItem('userRole'))
  });

  const handleLogin = (role) => {
    const normalizedRole = normalizeRole(role);
    setAuth({
      isAuthenticated: true,
      role: normalizedRole
    });
  };

  // Effect to sync auth state with localStorage - ONLY on mount and storage changes
  useEffect(() => {
    const checkAuthStatus = () => {
      const token = localStorage.getItem('token');
      const userRole = localStorage.getItem('userRole');
      const isAuth = !!token && !!userRole;
      
      setAuth(prevAuth => {
        // Only update if status actually changed
        if (prevAuth.isAuthenticated !== isAuth || prevAuth.role !== normalizeRole(userRole)) {
          return {
            isAuthenticated: isAuth,
            role: normalizeRole(userRole)
          };
        }
        return prevAuth;
      });
    };

    // Check initial auth status on mount
    checkAuthStatus();

    // Listen for storage changes (logout from another tab, etc)
    window.addEventListener('storage', checkAuthStatus);
    
    return () => window.removeEventListener('storage', checkAuthStatus);
  }, []); // Empty dependency - run only once on mount

  const isAdmin = ['superadmin'].includes(auth.role);
  const isProcurement = ['superadmin', 'procurement'].includes(auth.role);
  const isOperations = ['superadmin', 'operations'].includes(auth.role);
  const isLogistics = ['superadmin', 'logistics'].includes(auth.role);
  const isInventory = ['superadmin', 'inventory'].includes(auth.role);
  const isConcierge = ['superadmin', 'concierge'].includes(auth.role);
  const isClient = ['client'].includes(auth.role);
  const isPersonnelRole = ['operations', 'procurement', 'logistics', 'inventory', 'concierge', 'staff'].includes(auth.role);

  return (
    <GlobalDataProvider>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/staff-signup" element={<StaffSignup />} />

            <Route
              path="/dashboard"
              element={
                <PrivateDashboardRoute authIsAuthenticated={auth.isAuthenticated} authRole={auth.role}>
                  {(role) => <DashboardLayout />}
                </PrivateDashboardRoute>
              }
            >
              {/* Role-based index route */}
              <Route index element={<DashboardSelector role={auth.role} />} />

              <Route path="clients" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'operations', 'client', 'admin', 'saas_client']}>
                  <Clients />
                </RoleProtectedRoute>
              } />
              <Route path="vendors" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client', 'procurement', 'operations', 'inventory']}>
                  <Vendors />
                </RoleProtectedRoute>
              } />
              <Route path="orders" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'operations', 'procurement', 'concierge', 'client', 'admin', 'saas_client']}>
                  <Orders />
                </RoleProtectedRoute>
              } />
              <Route path="inventory" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'inventory', 'concierge', 'client', 'admin', 'saas_client']}>
                  <Inventory />
                </RoleProtectedRoute>
              } />
              <Route path="reports" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client']}>
                  <Reports />
                </RoleProtectedRoute>
              } />
              <Route path="analytics" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'admin', 'finance', 'operations']}>
                  <Analytics />
                </RoleProtectedRoute>
              } />
              <Route path="users" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client', 'operations', 'procurement', 'logistics', 'inventory', 'concierge']}>
                  <Users />
                </RoleProtectedRoute>
              } />
              <Route path="tenants" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin']}>
                  <Tenants />
                </RoleProtectedRoute>
              } />
              <Route path="departments" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'admin']}>
                  <Departments />
                </RoleProtectedRoute>
              } />
              <Route path="employees" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'admin']}>
                  <Employees />
                </RoleProtectedRoute>
              } />
              <Route path="staff-audits" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client']}>
                  <StaffAudits />
                </RoleProtectedRoute>
              } />
              <Route path="security-events" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'admin', 'client', 'saas_client']}>
                  <SecurityEvents />
                </RoleProtectedRoute>
              } />
              <Route path="settings" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client', 'customer', 'procurement', 'operations', 'logistics', 'inventory', 'concierge', 'staff']}>
                  <Settings />
                </RoleProtectedRoute>
              } />
              <Route path="profile" element={<Profile />} />
              <Route path="roles-permissions" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client']}>
                  <RolesPermissions />
                </RoleProtectedRoute>
              } />
              <Route path="payroll" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client', 'procurement']}>
                  {isPersonnelRole && auth.role !== 'admin' && auth.role !== 'superadmin' ? <EmployeePortal /> : <Payroll />}
                </RoleProtectedRoute>
              } />
              <Route path="leave" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client', 'procurement', 'operations', 'logistics', 'inventory', 'concierge', 'staff']}>
                  {isPersonnelRole ? <EmployeePortal /> : <LeaveManagement />}
                </RoleProtectedRoute>
              } />
              <Route path="invoices" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client', 'operations', 'procurement', 'logistics', 'inventory', 'concierge', 'staff', 'customer']}>
                  <Invoices />
                </RoleProtectedRoute>
              } />
              <Route path="payments" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client', 'operations', 'procurement', 'logistics', 'inventory', 'concierge', 'staff', 'customer']}>
                  <Payments />
                </RoleProtectedRoute>
              } />
              <Route path="plans" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client', 'customer']}>
                  {auth.role === 'superadmin' ? <SaaSManagement /> : <Plans />}
                </RoleProtectedRoute>
              } />
              <Route path="support-tickets" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client']}>
                  {['client', 'saas_client', 'customer'].includes(auth.role) ? <ClientSupport /> : <SupportDashboard />}
                </RoleProtectedRoute>
              } />
              <Route path="saas-clients" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'client', 'admin', 'saas_client']}>
                  <SaaSClients />
                </RoleProtectedRoute>
              } />

              {/* Operations Specific Routes */}
              <Route path="projects" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'operations', 'client', 'admin', 'saas_client']}>
                  <Projects />
                </RoleProtectedRoute>
              } />
              <Route path="deliveries" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'operations', 'logistics', 'client', 'admin', 'saas_client']}>
                  <Deliveries />
                </RoleProtectedRoute>
              } />
              <Route path="missions" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'operations', 'logistics', 'client', 'admin', 'saas_client']}>
                  <Missions />
                </RoleProtectedRoute>
              } />

              {/* Procurement Specific Routes */}
              <Route path="purchase-requests" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'procurement', 'client', 'admin', 'saas_client', 'customer']}>
                  <PurchaseRequests />
                </RoleProtectedRoute>
              } />
              <Route path="quotes" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'procurement', 'client', 'admin', 'saas_client', 'customer']}>
                  <Quotes />
                </RoleProtectedRoute>
              } />
              <Route path="audits" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'procurement', 'inventory', 'client', 'admin', 'saas_client', 'customer']}>
                  <Audits />
                </RoleProtectedRoute>
              } />
              <Route path="purchase-orders" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'procurement', 'client', 'admin', 'saas_client', 'customer']}>
                  <PurchaseOrders />
                </RoleProtectedRoute>
              } />

              {/* Logistics Specific Routes */}
              <Route path="fleet" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'logistics', 'client', 'admin', 'saas_client']}>
                  <Fleet />
                </RoleProtectedRoute>
              } />
              <Route path="logistics-routes" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'logistics']}>
                  <LogisticsRoutes />
                </RoleProtectedRoute>
              } />
              <Route path="logistics-tracking" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'logistics']}>
                  <LogisticsTracking />
                </RoleProtectedRoute>
              } />
              <Route path="logistics-urgent" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'logistics']}>
                  <LogisticsUrgent />
                </RoleProtectedRoute>
              } />

              {/* Inventory Role Specific */}
              <Route path="warehouses" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'inventory', 'client', 'admin', 'saas_client']}>
                  <Warehouses />
                </RoleProtectedRoute>
              } />
              <Route path="inventory-alerts" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'inventory']}>
                  <InventoryAlerts />
                </RoleProtectedRoute>
              } />
              <Route path="inventory-audits" element={<Navigate to="/dashboard/audits" replace />} />

              {/* Concierge Role Specific */}
              <Route path="events" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'concierge', 'client', 'admin', 'saas_client', 'customer']}>
                  {['customer', 'client'].includes(auth.role) ? <ClientEvents /> : <Events />}
                </RoleProtectedRoute>
              } />
              <Route path="guest-requests" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'concierge', 'client', 'admin', 'saas_client', 'customer']}>
                  <GuestRequests />
                </RoleProtectedRoute>
              } />
              <Route path="luxury-items" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'concierge', 'client', 'admin', 'saas_client', 'customer']}>
                  <LuxuryItems />
                </RoleProtectedRoute>
              } />
              <Route path="vip-access" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'concierge']}>
                  <ConciergeAccessPlans />
                </RoleProtectedRoute>
              } />
              <Route path="chauffeur" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'concierge', 'client', 'admin', 'saas_client', 'customer']}>
                  <Chauffeur />
                </RoleProtectedRoute>
              } />
              <Route path="chauffeur-management" element={<Navigate to="/dashboard/chauffeur" replace />} />

              {/* Employee/Staff Routes */}
              <Route path="staff-terminal" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['superadmin', 'staff', 'operations', 'logistics', 'inventory']}>
                  <EmployeePortal />
                </RoleProtectedRoute>
              } />

              {/* Client Portal Specific */}
              <Route path="customer-list" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['client', 'admin', 'saas_client']}>
                  <ClientOrders />
                </RoleProtectedRoute>
              } />
              <Route path="client-orders" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['client', 'saas_client', 'customer', 'admin']}>
                  <ClientOrders />
                </RoleProtectedRoute>
              } />
              <Route path="chauffeur-service" element={<Navigate to="/dashboard/chauffeur" replace />} />
              <Route path="client-events" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['client', 'saas_client', 'admin']}>
                  <ClientEvents />
                </RoleProtectedRoute>
              } />
              <Route path="order-history" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['saas_client', 'client', 'admin']}>
                  <ClientOrders />
                </RoleProtectedRoute>
              } />
              <Route path="track-delivery" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['client', 'admin', 'saas_client', 'customer']}>
                  <ClientTracking />
                </RoleProtectedRoute>
              } />
              <Route path="client-inventory" element={<Navigate to="/dashboard/inventory" replace />} />
              <Route path="support" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['client', 'admin', 'saas_client', 'customer']}>
                  <ClientSupport />
                </RoleProtectedRoute>
              } />
              <Route path="membership" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['customer', 'client', 'saas_client', 'admin']}>
                  <PersonalMembership />
                </RoleProtectedRoute>
              } />
              <Route path="store" element={
                <RoleProtectedRoute role={auth.role} allowedRoles={['client', 'admin', 'saas_client', 'customer']}>
                  <ClientStore />
                </RoleProtectedRoute>
              } />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </GlobalDataProvider>
  );
}

export default App;
