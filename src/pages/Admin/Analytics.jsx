import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  TrendingUp, Users, ShoppingCart, DollarSign,
  Package, Truck, Activity, CreditCard
} from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';

// API Hooks
import { useOrders } from '../../hooks/api/useOrders';
import { useInvoices, usePayments } from '../../hooks/api/useFinance';
import { useClients } from '../../hooks/api/useCRM';
import { useStock } from '../../hooks/api/useInventory';
import { usePurchaseRequests, usePurchaseOrders } from '../../hooks/api/useProcurement';
import { useDeliveries, useMissions } from '../../hooks/api/useLogistics';

const COLORS = ['#C8A96A', '#ffffff', '#6B7280', '#34d399', '#f87171', '#60a5fa'];

const Analytics = () => {
  const { currentUser } = useData();
  const role = normalizeRole(currentUser?.role);
  
  const canViewFinance = ['superadmin', 'admin', 'finance'].includes(role);
  const canViewOperations = ['superadmin', 'admin', 'operations'].includes(role);
  const canViewProcurement = ['superadmin', 'admin', 'operations', 'procurement'].includes(role);
  const canViewInventory = ['superadmin', 'admin', 'operations', 'inventory'].includes(role);
  const canViewLogistics = ['superadmin', 'admin', 'operations', 'logistics'].includes(role);

  // Fetch Data (using high limits as per data strategy)
  const limit = 1000;
  
  const { data: ordersData, isLoading: loadingOrders } = useOrders(1, limit);
  const { data: invoicesData, isLoading: loadingInvoices } = useInvoices(1, limit);
  const { data: paymentsData, isLoading: loadingPayments } = usePayments(1, limit);
  const { data: clientsData, isLoading: loadingClients } = useClients(1, limit);
  const { data: stockData, isLoading: loadingStock } = useStock();
  const { data: prData, isLoading: loadingPR } = usePurchaseRequests(1, limit);
  const { data: poData, isLoading: loadingPO } = usePurchaseOrders(1, limit);
  const { data: deliveriesData, isLoading: loadingDeliveries } = useDeliveries(1, limit);
  const { data: missionsData, isLoading: loadingMissions } = useMissions(1, limit);

  // Data parsing helper
  const getArray = (data) => Array.isArray(data) ? data : (data?.data || data?.items || data?.clients || data?.users || Object.values(data || {}).find(Array.isArray) || []);

  const orders = getArray(ordersData?.data);
  const invoices = getArray(invoicesData?.data);
  const payments = getArray(paymentsData?.data);
  const clients = getArray(clientsData?.data);
  const stock = getArray(stockData);
  const purchaseRequests = getArray(prData?.data);
  const purchaseOrders = getArray(poData?.data);
  const deliveries = getArray(deliveriesData?.data);
  const missions = getArray(missionsData?.data);

  // --- 1. Overview Dashboard Metrics ---
  const totalOrders = orders.length;
  const totalRevenue = useMemo(() => invoices.filter(i => i.status === 'Paid').reduce((sum, inv) => sum + parseFloat(inv.totalAmount || inv.total_amount || inv.amount || 0), 0), [invoices]);
  const activeClients = clients.filter(c => c.status === 'Active' || !c.status).length;
  const totalStockItems = stock.reduce((sum, item) => sum + (item.quantity || item.qty || 1), 0);
  
  // --- 2. Procurement Analytics ---
  const prToPoConversion = useMemo(() => {
    if (purchaseRequests.length === 0) return 0;
    const approvedPRs = purchaseRequests.filter(pr => pr.status === 'Approved' || pr.status === 'Converted' || pr.status === 'PO_Created').length;
    return Math.round((approvedPRs / purchaseRequests.length) * 100);
  }, [purchaseRequests]);

  const vendorPerformance = useMemo(() => {
    // Group POs by vendor
    const vendorMap = {};
    purchaseOrders.forEach(po => {
      const vendorName = po.vendorName || po.vendor?.name || 'Unknown Vendor';
      if (!vendorMap[vendorName]) vendorMap[vendorName] = { name: vendorName, totalOrders: 0, completedOrders: 0 };
      vendorMap[vendorName].totalOrders += 1;
      if (po.status === 'Received' || po.status === 'Completed' || po.status === 'Delivered') {
        vendorMap[vendorName].completedOrders += 1;
      }
    });
    return Object.values(vendorMap).slice(0, 5); // Top 5 vendors
  }, [purchaseOrders]);

  // --- 3. Inventory Analytics ---
  const stockLevels = useMemo(() => {
    const lowStock = stock.filter(item => (item.quantity || item.qty || 0) < 10).length;
    const optimal = stock.length - lowStock;
    return [
      { name: 'Optimal Stock', value: optimal },
      { name: 'Low Stock', value: lowStock }
    ];
  }, [stock]);

  // --- 4. Finance Analytics ---
  const financeMetrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    
    invoices.forEach(inv => {
      const amt = parseFloat(inv.totalAmount || inv.total_amount || inv.amount || 0);
      totalInvoiced += amt;
      if (inv.status === 'Paid') {
        totalPaid += amt;
      } else if (inv.status === 'Partial') {
        totalPaid += parseFloat(inv.paidAmount || inv.paid_amount || 0);
      }
    });
    
    const outstanding = totalInvoiced - totalPaid;
    return {
      totalInvoiced,
      totalPaid,
      outstanding,
      chartData: [
        { name: 'Invoiced', amount: totalInvoiced },
        { name: 'Paid', amount: totalPaid },
        { name: 'Outstanding', amount: outstanding > 0 ? outstanding : 0 }
      ]
    };
  }, [invoices]);

  // --- 5. Logistics Analytics ---
  const deliveryStatusData = useMemo(() => {
    const statusCounts = {};
    deliveries.forEach(d => {
      const st = d.status || 'Pending';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });
    return Object.keys(statusCounts).map(k => ({ name: k, value: statusCounts[k] }));
  }, [deliveries]);

  const missionCompletionRate = useMemo(() => {
    if (missions.length === 0) return 0;
    const completed = missions.filter(m => m.status === 'Completed' || m.status === 'Delivered').length;
    return Math.round((completed / missions.length) * 100);
  }, [missions]);

  // Loading state
  const isGlobalLoading = loadingOrders || loadingInvoices || loadingPayments || loadingClients || loadingStock || loadingPR || loadingPO || loadingDeliveries || loadingMissions;

  if (isGlobalLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Activity className="animate-spin text-accent mb-4" size={32} />
        <p className="text-secondary font-bold text-xs uppercase tracking-widest animate-pulse">Aggregating Analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Analytics Dashboard</h1>
          <p className="text-secondary text-[11px] uppercase font-bold tracking-widest mt-1">Cross-Module Data Intelligence</p>
        </div>
      </div>

      {/* 1. Overview Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="glass-card p-6 border-white/5 relative overflow-hidden group hover:border-accent/30 transition-all">
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <ShoppingCart size={100} />
          </div>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total Orders</p>
          <h3 className="text-3xl font-black font-heading italic text-white tracking-tighter">{totalOrders}</h3>
        </div>
        
        {(canViewFinance || canViewOperations) && (
          <div className="glass-card p-6 border-white/5 relative overflow-hidden group hover:border-success/30 transition-all">
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
              <DollarSign size={100} />
            </div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total Revenue</p>
            <h3 className="text-3xl font-black font-heading italic text-success tracking-tighter">
              ${(totalRevenue / 1000).toFixed(1)}K
            </h3>
          </div>
        )}

        <div className="glass-card p-6 border-white/5 relative overflow-hidden group hover:border-info/30 transition-all">
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
            <Users size={100} />
          </div>
          <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Active Clients</p>
          <h3 className="text-3xl font-black font-heading italic text-info tracking-tighter">{activeClients}</h3>
        </div>

        {canViewInventory && (
          <div className="glass-card p-6 border-white/5 relative overflow-hidden group hover:border-warning/30 transition-all">
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform">
              <Package size={100} />
            </div>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Inventory Stock</p>
            <h3 className="text-3xl font-black font-heading italic text-warning tracking-tighter">{totalStockItems} Units</h3>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        
        {/* 2. Procurement Analytics */}
        {canViewProcurement && (
          <div className="glass-card p-6 border-white/5 flex flex-col h-[350px]">
            <h3 className="text-sm font-bold tracking-widest uppercase text-white mb-4">Procurement & Vendor Performance</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                <p className="text-[9px] text-muted font-bold uppercase tracking-widest mb-1">PR to PO Conversion</p>
                <p className="text-lg font-black text-accent">{prToPoConversion}%</p>
              </div>
            </div>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#6B7280" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#131316', borderColor: '#ffffff10' }} />
                  <Bar dataKey="totalOrders" name="Total POs" fill="#6B7280" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completedOrders" name="Completed POs" fill="#C8A96A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 3. Inventory Analytics */}
        {canViewInventory && (
          <div className="glass-card p-6 border-white/5 flex flex-col h-[350px]">
            <h3 className="text-sm font-bold tracking-widest uppercase text-white mb-4">Inventory Health</h3>
            <div className="flex-1 w-full min-h-0 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockLevels}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stockLevels.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#34d399' : '#f87171'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#131316', borderColor: '#ffffff10' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 4. Finance Analytics */}
        {canViewFinance && (
          <div className="glass-card p-6 border-white/5 flex flex-col h-[350px]">
            <h3 className="text-sm font-bold tracking-widest uppercase text-white mb-4">Financial Overview (Invoices)</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeMetrics.chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                  <XAxis type="number" stroke="#6B7280" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" stroke="#6B7280" tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#131316', borderColor: '#ffffff10' }}
                    formatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <Bar dataKey="amount" fill="#C8A96A" radius={[0, 4, 4, 0]}>
                    {financeMetrics.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Paid' ? '#34d399' : entry.name === 'Outstanding' ? '#f87171' : '#6B7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 5. Logistics Analytics */}
        {canViewLogistics && (
          <div className="glass-card p-6 border-white/5 flex flex-col h-[350px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold tracking-widest uppercase text-white">Logistics & Deliveries</h3>
              <div className="bg-white/5 px-3 py-1 rounded border border-white/10">
                <span className="text-[9px] text-muted uppercase font-bold">Mission Success: </span>
                <span className="text-xs font-black text-success">{missionCompletionRate}%</span>
              </div>
            </div>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deliveryStatusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {deliveryStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#131316', borderColor: '#ffffff10' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Analytics;
