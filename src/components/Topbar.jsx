import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Menu, User, LogOut, ChevronDown, Package, Users, Briefcase, Box, CheckCheck, ShoppingCart, Truck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/GlobalDataContext';
import { normalizeRole } from '../utils/authUtils';
import { useNavigate } from 'react-router-dom';
import StaffClockBar from './StaffClockBar';

const Topbar = ({ toggleSidebar, role }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const navigate = useNavigate();
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);
  const { currentUser, clients, orders, inventory, users, notifications, unreadCount, fetchNotifications, markNotificationRead, markAllNotificationsRead } = useData();
  const userRole = normalizeRole(role || 'superadmin');

  const clientBranding = userRole === 'client'
    ? (clients || []).find(c => c.id === currentUser?.clientId || c.name === currentUser?.name)?.branding
    : null;

  const userInitials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('user');
    localStorage.removeItem('menuPermissions');
    // Force reload to /login
    window.location.href = '/login';
  };

  const dbRoleName = typeof currentUser?.role === 'object' ? currentUser?.role?.name : currentUser?.role;
  let roleLabel = dbRoleName ? String(dbRoleName).replace(/_/g, ' ') : userRole;

  if (userRole === 'client') {
    roleLabel = currentUser?.company_name || currentUser?.name || 'Admin';
  }

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    setShowResults(term.length > 0);
  };

  const getResults = () => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const results = [];

    // Orders
    orders.filter(o =>
      String(o.id).toLowerCase().includes(term) ||
      o.client?.toLowerCase().includes(term)
    ).forEach(o => results.push({
      id: o.id,
      title: `Order #${o.id}`,
      category: 'Orders',
      icon: Package,
      link: userRole === 'client' ? '/dashboard/client-orders' : '/dashboard/orders'
    }));

    // Admin/Operations only results
    if (['superadmin', 'operations', 'procurement'].includes(userRole)) {
      // Clients
      clients.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.businessName?.toLowerCase().includes(term)
      ).forEach(c => results.push({ id: c.id, title: c.name, category: 'Clients', icon: Users, link: '/dashboard/clients' }));

      // Staff
      users.filter(u =>
        u.name?.toLowerCase().includes(term)
      ).forEach(u => results.push({ id: u.id, title: u.name, category: 'Staff', icon: Briefcase, link: '/dashboard/users' }));
    }

    // Inventory - All roles
    inventory.filter(i =>
      i.name?.toLowerCase().includes(term)
    ).forEach(i => results.push({ id: i.id, title: i.name, category: 'Inventory', icon: Box, link: '/dashboard/inventory' }));

    return results.slice(0, 8);
  };

  const results = getResults();

  return (
    <header className="h-16 border-b border-border bg-background/90 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 gap-4">

      {/* Left: Mobile menu + logo (mobile only) */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-secondary hover:text-white p-2 hover:bg-white/5 rounded-lg"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(200,169,106,0.4)] overflow-hidden ring-2 ring-accent/60 p-1">
            <img
              src={clientBranding?.logo || "/logo.png"}
              alt={clientBranding?.businessName || "ZaneZion"}
              className={`w-full h-full object-contain ${!clientBranding?.logo ? 'scale-[2.4]' : ''}`}
            />
          </div>
          <span className="text-sm font-black text-white tracking-tight uppercase">
            {clientBranding?.businessName || "ZaneZion"}
          </span>
        </div>
      </div>

      {/* Centre: Space filler since search is removed */}
      <div className="flex-1 hidden md:block"></div>

      {/* Right: Clock (operational roles) + Notifications + Profile */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <StaffClockBar role={role} />
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setIsNotifOpen(!isNotifOpen); if (!isNotifOpen) fetchNotifications(); }}
            className="relative p-2 text-secondary hover:text-accent hover:bg-white/5 rounded-xl transition-all"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-danger text-white text-[9px] font-black rounded-full px-1 shadow-lg shadow-danger/30">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotifOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-sidebar border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border/60 bg-white/[0.02] flex items-center justify-between">
                    <p className="text-xs font-black text-white uppercase tracking-widest">Notifications</p>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllNotificationsRead()}
                        className="text-[9px] font-bold text-accent uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1"
                      >
                        <CheckCheck size={12} /> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {(notifications || []).length > 0 ? (
                      notifications.map((n) => {
                        const iconMap = { order: ShoppingCart, delivery: Truck, alert: AlertCircle };
                        const NotifIcon = iconMap[n.type] || Bell;
                        const timeAgo = (() => {
                          const diff = Date.now() - new Date(n.createdAt || n.created_at).getTime();
                          const mins = Math.floor(diff / 60000);
                          if (mins < 1) return 'Just now';
                          if (mins < 60) return `${mins}m ago`;
                          const hrs = Math.floor(mins / 60);
                          if (hrs < 24) return `${hrs}h ago`;
                          return `${Math.floor(hrs / 24)}d ago`;
                        })();
                        const isUnread = !(n.isRead || n.is_read);
                        return (
                          <button
                            key={n.id}
                            onClick={() => {
                              if (isUnread) markNotificationRead(n.id);
                              if (n.link) navigate(n.link);
                              setIsNotifOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-all border-b border-white/[0.03] ${isUnread ? 'bg-accent/[0.03]' : ''}`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isUnread ? 'bg-accent/10 text-accent' : 'bg-white/5 text-muted'}`}>
                              <NotifIcon size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate ${isUnread ? 'text-white' : 'text-secondary'}`}>{n.title}</p>
                              <p className="text-[10px] text-muted truncate mt-0.5">{n.message}</p>
                              <p className="text-[9px] text-muted/50 font-bold uppercase tracking-widest mt-1">{timeAgo}</p>
                            </div>
                            {isUnread && <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-2" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="py-12 text-center">
                        <Bell size={28} className="mx-auto text-muted/20 mb-3" />
                        <p className="text-[10px] text-muted font-bold uppercase tracking-widest">No notifications yet</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <div className="w-px h-6 bg-border mx-2 hidden sm:block"></div>

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-black text-xs flex-shrink-0">
              {userInitials}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-xs font-bold text-white truncate max-w-[100px]">{currentUser?.name || 'User'}</p>
              <p className="text-[10px] text-muted font-bold uppercase tracking-wider">{roleLabel}</p>
            </div>
            <ChevronDown size={14} className={`text-muted transition-transform hidden sm:block ${isProfileOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-sidebar border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-border/60 bg-white/[0.02]">
                    <p className="text-sm font-bold text-white">{currentUser?.name || 'User'}</p>
                    <p className="text-[10px] text-accent font-bold uppercase tracking-widest">{roleLabel}</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { setIsProfileOpen(false); navigate('/dashboard/profile'); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-secondary hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <User size={15} /> My Profile
                    </button>
                    <div className="h-px bg-border my-1.5 mx-2"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/10 rounded-xl transition-colors"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
