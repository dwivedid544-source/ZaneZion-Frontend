import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Table from '../../components/Table';
import StatusBadge from '../../components/StatusBadge';
import OrderModal from '../../components/OrderModal';
import {
  TrendingUp, Filter, Users, ShoppingCart,
  Truck, Calendar, DollarSign, ChevronDown,
  AlertTriangle, Package, ArrowRight, Landmark,
  CheckCircle2, FileText, Activity, LayoutDashboard, Gift
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';

const Dashboard = () => {

  const {
    orders, addOrder, updateOrder, deleteOrder, logs,
    revenueFilter, setRevenueFilter, getRevenueChartData,
    invoices, users, fleet, inventory, stockMovements,
    fetchOrders, fetchFinance, fetchInventory, fetchStaff, fetchFleet,
    fetchDeliveries, fetchProjects, fetchDashboardStats, fetchDashboardLogs,
    deliveries, projects, dashboardStats, currentUser,
    hasMenuPermission
  } = useData();
  const isSuperAdmin = ['super_admin', 'superadmin', 'super admin'].includes(normalizeRole(currentUser?.role));
  const isB2BClient = normalizeRole(currentUser?.role) === 'client';
  const hasAccess = isSuperAdmin || isB2BClient;

  React.useEffect(() => {
    // Only fetch what is needed for the dashboard indicators
    const loadDashboard = async () => {
      await Promise.all([
        fetchOrders(),
        fetchFinance(),
        fetchInventory(),
        fetchStaff(),
        fetchFleet(),
        fetchDeliveries(),
        fetchProjects(),
        fetchDashboardStats(revenueFilter),
        fetchDashboardLogs()
      ]);
    };
    loadDashboard();
  }, [fetchOrders, fetchFinance, fetchInventory, fetchStaff, fetchFleet, fetchDeliveries, fetchProjects, fetchDashboardStats, fetchDashboardLogs]);

  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const handleAction = (type, order) => {
    setSelectedOrder(order);
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleSave = (formData) => {
    if (modalType === 'add') {
      addOrder(formData);
    } else if (modalType === 'edit') {
      updateOrder(selectedOrder.id, formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    deleteOrder(id);
    setIsModalOpen(false);
  };

  // Handle revenue filter change — re-fetch stats with new filter
  const handleFilterChange = async (option) => {
    setRevenueFilter(option);
    setIsFilterOpen(false);
    await fetchDashboardStats(option);
  };

  // --- Dashboard Intelligence Calibration ---
  const stats = useMemo(() => {
    return {
      openOrders: dashboardStats.openOrders || 0,
      completedOrders: dashboardStats.completedOrders || 0,
      unpaidInvoices: dashboardStats.unpaidInvoices || 0,
      relevantRevenue: dashboardStats.relevantRevenue || 0,
      prevRevenue: dashboardStats.prevRevenue || 0,
      revenueTrend: dashboardStats.revenueTrend || '0%',
      ordersTrend: dashboardStats.ordersTrend || '+0%',
      inventoryValue: dashboardStats.inventoryValue || 0,
      inventoryValueOnHand: dashboardStats.inventoryValueOnHand || 0,
      lowStockItems: dashboardStats.stockWarnings || 0,
      totalSkus: dashboardStats.totalSkus || 0,
      assetLoss: dashboardStats.assetLoss || 0,
      onlineStaff: dashboardStats.onlineStaff || 0,
      totalUsers: dashboardStats.totalPersonnel || dashboardStats.activeStaff || 0,
      birthdayStaff: [],
      activeChauffeurs: dashboardStats.chauffeurRequests || 0,
      activeEvents: dashboardStats.activeEvents || 0,
      openTickets: dashboardStats.openTickets || 0,
      activeClients: dashboardStats.activeClients || 0,
      pendingDeliveries: dashboardStats.pendingDeliveries || 0,
      activeProjects: dashboardStats.activeProjects || 0,
      revenueChartData: dashboardStats.revenueChartData || [],
    };
  }, [dashboardStats]);

  const columns = [
    { header: "Order ID", accessor: "id" },
    {
      header: "Client Entity",
      accessor: "client",
      render: (item) => {
        if (typeof item.client === 'string') return item.client;
        return item.client?.name || item.client?.companyName || item.client?.business_name || "—";
      }
    },
    {
      header: "Items",
      accessor: "items",
      render: (item) => {
        if (!item.items || item.items.length === 0) return item.product || "No Items";
        if (item.items.length === 1) return item.items[0].name;
        return `${item.items[0].name} (+${item.items.length - 1} more)`;
      }
    },
    {
      header: "Total Value",
      accessor: "total",
      render: (item) => (
        <span className="text-accent font-black tracking-tighter">
          ${parseFloat(item.total || 0).toLocaleString()}
        </span>
      )
    },
    {
      header: "Protocol Status",
      accessor: "status",
      render: (item) => <StatusBadge status={item.status} />
    },
  ];

  const recentOrders = useMemo(() => {
    return [...(orders || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  }, [orders]);

  // Use backend chart data if available, otherwise fall back to client-side
  const chartData = useMemo(() => {
    if (stats.revenueChartData && stats.revenueChartData.length > 0) {
      return stats.revenueChartData;
    }
    return getRevenueChartData();
  }, [stats.revenueChartData, getRevenueChartData]);

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      {/* Premium Executive Command Center Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-4 md:gap-5">
          <div className="w-14 h-14 md:w-20 md:h-20 bg-accent/10 border border-accent/20 rounded-2xl md:rounded-[2.5rem] flex items-center justify-center shadow-3xl shadow-accent/10 relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <LayoutDashboard size={isModalOpen ? 24 : 32} className="text-accent relative z-10 group-hover:scale-110 transition-transform md:hidden" />
            <LayoutDashboard size={40} className="text-accent relative z-10 group-hover:scale-110 transition-transform hidden md:block" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-white truncate">
              ZANEZION DASHBOARD
            </h1>
            <div className="flex items-center gap-2 md:gap-3 mt-1">
              <p className="text-secondary text-[10px] md:text-[11px] uppercase font-bold tracking-widest opacity-70 truncate">
                Central Operations Command
              </p>
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
              <span className="text-[10px] md:text-[11px] text-success font-bold uppercase tracking-widest shrink-0">System Live</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <AnimatePresence>
            {(stats.birthdayStaff || []).length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className="glass-card !bg-accent/10 border-accent/30 rounded-2xl px-4 md:px-6 py-2 md:py-3 flex items-center gap-3 md:gap-4 group hover:bg-accent/20 transition-all cursor-help shadow-lg shadow-accent/5 w-full sm:w-auto"
              >
                <div className="p-1.5 md:p-2 bg-accent/20 rounded-xl relative shrink-0">
                  <div className="absolute inset-0 bg-accent rounded-xl blur-md opacity-20 animate-pulse" />
                  <Gift size={16} className="text-accent relative z-10 md:hidden" />
                  <Gift size={20} className="text-accent relative z-10 hidden md:block group-hover:rotate-12 transition-transform" />
                </div>
                <div className="flex flex-col overflow-hidden text-left">
                  <span className="text-[8px] md:text-[10px] font-black text-accent uppercase tracking-[0.2em]">Protocol Celebration</span>
                  <span className="text-xs md:text-sm font-bold text-white whitespace-nowrap truncate">
                    {stats.birthdayStaff[0].name}{stats.birthdayStaff.length > 1 ? ` & ${stats.birthdayStaff.length - 1} Others` : ''}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-10 w-[1px] bg-white/10 mx-2 hidden xl:block" />

          <div className="relative group w-full sm:w-auto">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center justify-between sm:justify-start gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 md:px-6 py-3 md:py-4 hover:bg-white/10 transition-all focus:border-accent shadow-2xl w-full"
            >
              <div className="flex items-center gap-4">
                <TrendingUp size={18} className="text-accent" />
                <div className="text-left">
                  <p className="text-[8px] md:text-[9px] font-black text-muted uppercase tracking-widest">Financial Cycle</p>
                  <p className="text-[10px] md:text-xs font-bold text-white uppercase tracking-wider">{revenueFilter}</p>
                </div>
              </div>
              <ChevronDown size={14} className={`text-muted transition-transform duration-500 shrink-0 ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-64 glass-card border-white/10 z-[100] overflow-hidden shadow-3xl origin-top-right backdrop-blur-3xl"
                >
                  {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual'].map((option) => (
                    <button
                      key={option}
                      onClick={() => handleFilterChange(option)}
                      className={`w-full text-left px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-accent/10 border-b border-white/5 last:border-none ${revenueFilter === option ? 'text-accent bg-accent/5' : 'text-muted'}`}
                    >
                      {option} Revenue Audit
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Primary Analytics Grid - Responsive pass */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: 'Total Warehouse Assets', value: `$${(stats.inventoryValue / 1000).toFixed(1)}K`, icon: Package, color: 'text-accent', trend: stats.lowStockItems > 0 ? `${stats.lowStockItems} Low Stock` : 'Optimal', detail: 'Asset Valuation', show: hasMenuPermission('Inventory', 'can_view') || hasMenuPermission('StockHub', 'can_view') },
          { label: 'Global Revenue flow', value: `$${(stats.relevantRevenue / 1000).toFixed(1)}K`, icon: DollarSign, color: 'text-success', trend: stats.revenueTrend, detail: `${revenueFilter} Settlements`, show: hasMenuPermission('Invoices', 'can_view') || hasMenuPermission('Payments', 'can_view') },
          { label: 'Active Operations', value: stats.openOrders, icon: ShoppingCart, color: 'text-info', trend: stats.ordersTrend, detail: 'Mission Pipeline', show: hasMenuPermission('Orders', 'can_view') },
          { label: 'Global Personnel', value: stats.totalUsers, icon: Users, color: 'text-primary', trend: stats.onlineStaff > 0 ? `${stats.onlineStaff} Online` : 'Active', detail: 'Total HQ Staff', show: hasMenuPermission('Staff Management', 'can_view') || hasMenuPermission('HQ Personnel', 'can_view') },
          { label: 'Chauffeur Requests', value: stats.activeChauffeurs, icon: Truck, color: 'text-accent', trend: stats.activeChauffeurs > 0 ? 'Active' : 'None', detail: 'Pending Rides', show: hasMenuPermission('Chauffeur', 'can_view') || hasMenuPermission('Chauffeur Protocol', 'can_view') },
          { label: 'Active Events', value: stats.activeEvents, icon: Calendar, color: 'text-info', trend: stats.activeEvents > 0 ? 'Scheduled' : 'None', detail: 'Concierge Events', show: hasMenuPermission('Events', 'can_view') },
          { label: 'Open Support Cases', value: stats.openTickets, icon: AlertTriangle, color: 'text-warning', trend: stats.openTickets > 0 ? 'Need Attention' : 'All Clear', detail: 'Support Tickets', show: hasMenuPermission('Support', 'can_view') }
        ].filter(s => s.show || hasAccess).map((stat, idx) => (
          <div key={idx} className="glass-card p-5 sm:p-6 relative overflow-hidden group hover:border-accent/30 transition-all border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent">
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-700 pointer-events-none">
              <stat.icon size={100} />
            </div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 truncate">{stat.label}</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className={`text-2xl sm:text-3xl font-black font-heading italic ${stat.color} tracking-tighter`}>{stat.value}</h3>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-white/5 ${stat.color} border border-white/5`}>{stat.trend}</span>
            </div>
            <p className="text-[10px] text-muted/60 font-medium mt-2 uppercase tracking-tight truncate">{stat.detail}</p>
          </div>
        ))}
      </div>

      {/* Strategic Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Revenue Intelligence */}
          {(hasMenuPermission('Invoices', 'can_view') || hasMenuPermission('Payments', 'can_view') || hasAccess) && (
            <div className="glass-card p-8 border-white/5 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 md:mb-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 md:p-3 bg-primary/10 rounded-2xl text-primary">
                    <Activity size={24} className="md:hidden" />
                    <Activity size={24} className="hidden md:block" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight">Institutional Revenue</h3>
                    <p className="text-[10px] text-muted font-medium uppercase tracking-widest mt-1">Real-time financial flow monitoring.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[8px] font-black text-danger uppercase tracking-widest">Asset Loss</p>
                    <p className="text-sm font-bold text-white">
                      ${stats.assetLoss.toLocaleString()}
                    </p>
                  </div>
                  <Link to="/dashboard/reports" className="text-[9px] md:text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-all group">
                    Access Audit <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
              <div className="h-[250px] md:h-[340px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C8A96A" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#C8A96A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                    <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 9, fontWeight: 900 }} tickFormatter={(val) => val.toUpperCase()} axisLine={false} />
                    <YAxis stroke="#6B7280" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#131316', border: '1px solid #ffffff10', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}
                      itemStyle={{ color: '#C8A96A', fontWeight: 'bold' }}
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#C8A96A" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* INVENTORY LOGISTICS */}
            {(hasMenuPermission('Inventory', 'can_view') || hasMenuPermission('StockHub', 'can_view') || hasAccess) && (
              <div className="glass-card p-6 md:p-8 border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent flex flex-col h-full">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <h3 className="text-xl font-bold tracking-tight">Inventory Pulse</h3>
                  <div className="p-2 bg-accent/10 rounded-xl text-accent">
                    <Package size={18} />
                  </div>
                </div>
                <div className="space-y-4 flex-1">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                      <span className="text-secondary">System-Wide Stock</span>
                      <span className="text-white">{stats.totalSkus} SKUs</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${Math.min(100, (stats.totalSkus / 50) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[8px] font-bold text-muted uppercase tracking-widest mb-1">Low Stock</p>
                      <p className="text-lg font-bold text-danger">{stats.lowStockItems} Items</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[8px] font-bold text-muted uppercase tracking-widest mb-1">Value on Hand</p>
                      <p className="text-lg font-bold text-success">${(stats.inventoryValueOnHand / 1000).toFixed(1)}K</p>
                    </div>
                  </div>
                </div>
                {!isSuperAdmin && (
                  <button onClick={() => navigate('/dashboard/inventory')} className="w-full py-3.5 md:py-4 mt-6 text-[9px] md:text-[10px] font-black text-accent uppercase tracking-widest border border-accent/20 rounded-2xl hover:bg-accent/5 transition-all">
                    Audit All Warehouses
                  </button>
                )}
              </div>
            )}

            {/* OPERATIONS PROTOCOL */}
            {(hasMenuPermission('Orders', 'can_view') || hasMenuPermission('Projects', 'can_view') || hasMenuPermission('Missions', 'can_view') || hasAccess) && (
              <div className="glass-card p-6 md:p-8 border-white/5 bg-gradient-to-tr from-white/[0.02] to-transparent flex flex-col h-full">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <h3 className="text-xl font-black italic font-heading tracking-tight">Active Operations</h3>
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <Activity size={18} />
                  </div>
                </div>
                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                      <span className="text-xs font-bold text-white">Live Dispatches</span>
                    </div>
                    <span className="text-lg font-bold text-white">{stats.pendingDeliveries}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      <span className="text-xs font-bold text-white">Chauffeur Requests</span>
                    </div>
                    <span className="text-lg font-bold text-accent">{stats.activeChauffeurs}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      <span className="text-xs font-bold text-white">Open Support Tickets</span>
                    </div>
                    <span className="text-lg font-bold text-warning">{stats.openTickets}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      <span className="text-xs font-bold text-white">Active Projects</span>
                    </div>
                    <span className="text-lg font-bold text-white">{stats.activeProjects}</span>
                  </div>
                </div>
                {!isSuperAdmin && (
                  <button onClick={() => navigate('/dashboard/projects')} className="w-full py-3.5 md:py-4 mt-6 text-[9px] md:text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 hover:bg-primary hover:text-black rounded-2xl transition-all border border-primary/20">
                    Manage Operations
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Operational Intelligence Feed */}
        <div className="glass-card border-white/5 relative overflow-hidden min-h-[500px] lg:min-h-0">
          <div className="flex flex-col h-full w-full p-5 md:p-8 lg:absolute lg:inset-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent opacity-[0.02] blur-[80px] pointer-events-none" />
            <h3 className="text-xl md:text-2xl font-bold tracking-tight mb-6 md:mb-8 text-white shrink-0">System Activity Log</h3>
            <div className="flex-1 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar pr-2 md:pr-4 min-h-0">
              {(logs || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity size={32} className="text-muted/30 mb-3" />
                <p className="text-xs text-muted/50 font-bold uppercase tracking-widest">No activity yet</p>
                <p className="text-[10px] text-muted/30 mt-1">System actions will appear here in real-time</p>
              </div>
            ) : (logs || []).slice(0, 12).map((log, i) => (
              <div key={i} className="flex gap-6 items-start relative pb-8 last:pb-2 group">
                {i < (logs.slice(0, 12).length - 1) && (
                  <div className="absolute left-[7.5px] top-6 bottom-0 w-[1px] bg-gradient-to-b from-white/10 to-transparent" />
                )}
                <div className="flex flex-col items-center z-10">
                  <div className={`w-4 h-4 rounded-full mt-1 border-2 bg-sidebar ${log.type === 'system' ? 'border-primary' :
                    log.type === 'inventory' ? 'border-accent' :
                      log.type === 'logistics' ? 'border-danger' : 'border-success'
                    } group-hover:scale-125 transition-transform`} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1.5">
                    <p className="text-xs font-bold text-white uppercase tracking-widest">{log.action}</p>
                    <span className="text-[9px] font-bold text-muted uppercase bg-white/5 px-2 py-0.5 rounded">{log.time}</span>
                  </div>
                  <p className="text-[11px] text-secondary/80 leading-relaxed font-medium">{log.detail}</p>
                </div>
              </div>
            ))}
            </div>
            <div className="pt-6 mt-auto border-t border-white/5 shrink-0">
              <button onClick={() => navigate('/dashboard/audits')} className="w-full py-4 text-[10px] font-black text-muted uppercase tracking-widest hover:text-white transition-all flex items-center justify-center gap-2">
                View Full Activity Archive <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Asset Ledger - Role Based */}
      <div className="glass-card p-5 md:p-8 border-white/5 relative overflow-hidden">
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-primary opacity-[0.03] blur-[100px]" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 md:mb-10 relative z-10">
          <div>
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-white truncate">
              Recent Operations Ledger
            </h3>
            <p className="text-[10px] md:text-[11px] text-secondary/70 font-bold uppercase tracking-widest mt-2">
              Real-time supply chain synchronization & audit.
            </p>
          </div>
          <Link to="/dashboard/orders" className="w-full sm:w-auto text-center px-6 md:px-8 py-3 md:py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-accent hover:text-black hover:border-accent transition-all shadow-xl group">
            Full Operations Ledger <ArrowRight size={14} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        <div className="bg-white/[0.01] rounded-2xl md:rounded-[2rem] border border-white/5 overflow-hidden">
          <Table
            columns={columns}
            data={recentOrders}
            actions={true}
            onView={(item) => handleAction('view', item)}
            onEdit={(item) => handleAction('edit', item)}
            onDelete={(item) => handleDelete(item.id)}
            canEdit={hasMenuPermission('Dashboard', 'can_edit')}
            canDelete={hasMenuPermission('Dashboard', 'can_delete')}
          />
        </div>

      </div>

      <OrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        modalType={modalType}
        selectedOrder={selectedOrder}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default Dashboard;
