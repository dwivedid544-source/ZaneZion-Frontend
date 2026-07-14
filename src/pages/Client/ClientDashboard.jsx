import React, { useState, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import OrderModal from '../../components/OrderModal';
import {
  Package, Truck, History, CreditCard, Wallet,
  MapPin, CheckCircle,
  ArrowUpRight, ShoppingBag, ShoppingCart, TrendingUp, Landmark,
  HelpCircle, FileText, Eye, Download, Link, ChevronRight, Zap, Car, Sparkles, Edit3, X,
  Users, ClipboardList, BarChart3, Boxes, Building2, Tag, AlertTriangle
} from 'lucide-react';
import Modal from '../../components/Modal';
import { motion } from 'framer-motion';

import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';

const StatCard = ({ label, value, icon: Icon, color = 'text-accent', bg = 'bg-accent/10', onClick }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    onClick={onClick}
    className={`glass-card p-5 ${onClick ? 'cursor-pointer' : ''} group transition-all hover:border-accent/30`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${color}`}>{label}</p>
        <p className={`text-3xl font-black italic font-heading tracking-tighter text-white`}>{String(value ?? 0).padStart(2, '0')}</p>
      </div>
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
        <Icon size={18} className={color} />
      </div>
    </div>
    {onClick && (
      <p className="text-[9px] text-muted uppercase tracking-widest mt-2 group-hover:text-accent transition-colors flex items-center gap-1">
        View all <ChevronRight size={10} />
      </p>
    )}
  </motion.div>
);

const SectionCard = ({ title, icon: Icon, children, onViewAll, viewAllPath, navigate }) => (
  <div className="glass-card p-6 sm:p-8">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
        {Icon && <Icon size={18} className="text-accent" />}
        {title}
      </h3>
      {viewAllPath && (
        <button
          onClick={() => navigate(viewAllPath)}
          className="text-[9px] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors flex items-center gap-1"
        >
          View All <ChevronRight size={10} />
        </button>
      )}
    </div>
    {children}
  </div>
);

const EmptyState = ({ text }) => (
  <div className="py-8 text-center border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted italic">{text}</p>
  </div>
);

const ClientDashboard = () => {
  const {
    orders, invoices, settleInvoice, currentUser, clients, inventory = [], deliveries = [],
    chauffeurRequests = [], fetchChauffeurRequests,
    fetchOrders, fetchFinance, fetchInventory, fetchClients, fetchDeliveries, fetchDashboardStats,
    events = [], fetchTickets, updateClient, guestRequests = [], luxuryItems = [], fetchLuxuryItems,
    purchaseOrders = [], fetchPurchaseOrders,
    purchaseRequests = [], fetchPurchaseRequests,
    quotes = [], fetchQuotes,
    warehouses = [], fetchWarehouses,
    fleet = [], fetchFleet,
  } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    fetchFinance();
    fetchInventory();
    fetchClients();
    fetchDeliveries();
    fetchDashboardStats();
    if (fetchTickets) fetchTickets();
    if (fetchChauffeurRequests) fetchChauffeurRequests();
    if (fetchLuxuryItems) fetchLuxuryItems();
    if (fetchPurchaseOrders) fetchPurchaseOrders();
    if (fetchPurchaseRequests) fetchPurchaseRequests();
    if (fetchQuotes) fetchQuotes();
    if (fetchWarehouses) fetchWarehouses();
    if (fetchFleet) fetchFleet();
  }, [
    fetchOrders, fetchFinance, fetchInventory, fetchClients, fetchDeliveries, fetchDashboardStats,
    fetchTickets, fetchChauffeurRequests, fetchLuxuryItems, fetchPurchaseOrders,
    fetchPurchaseRequests, fetchQuotes, fetchWarehouses, fetchFleet
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ id: '', business_name: '', contact_person: '', email: '', location: '', phone: '' });

  const [orderTab, setOrderTab] = useState('open');
  const [invoiceTab, setInvoiceTab] = useState('unpaid');

  const tenantId = currentUser?.clientId || currentUser?.companyId || currentUser?.company_id;
  const clientData = (clients || []).find(c =>
    c.id === tenantId ||
    c.email === currentUser?.email ||
    c.name === currentUser?.name
  ) || currentUser || { id: 'GUEST', name: 'Guest' };

  const clientOrders = (orders || []).filter(o =>
    o.companyId === clientData.id || o.company_id === clientData.id ||
    o.clientId === clientData.id || o.client === clientData.name
  );
  const clientInvoices = (invoices || []).filter(inv =>
    inv.clientId === clientData.id || inv.company_id === clientData.id || inv.client === clientData.name
  );
  const clientChauffeurRequests = (chauffeurRequests || []).filter(req =>
    String(req.clientId) === String(clientData.id) ||
    String(req.company_id) === String(clientData.id) ||
    String(req.clientName) === String(clientData.name) ||
    (req.created_by && String(req.created_by) === String(currentUser?.id)) ||
    (normalizeRole(currentUser?.role) === 'customer' || normalizeRole(currentUser?.role) === 'client')
  );

  const activeOrders = (clientOrders || []).filter(o => !['Delivered', 'Cancelled', 'Completed'].includes(o.status));
  const activeDeliveries = (deliveries || []).filter(d => d.status !== 'Delivered' && clientOrders.some(o => o.id === d.orderId));
  const unpaidInvoices = clientInvoices.filter(inv => inv.status !== 'Paid');

  const clientGuestRequests = (guestRequests || []).filter(req =>
    String(req.clientId) === String(clientData.id) ||
    String(req.company_id) === String(clientData.id) ||
    req.clientName === clientData.name ||
    req.guest === clientData.name
  );

  // Personal Assets (Luxury items stored for this client)
  const personalAssets = (luxuryItems || []).filter(item =>
    String(item.client_id) === String(clientData.id) ||
    String(item.clientId) === String(clientData.id) ||
    item.owner === clientData.name || item.owner === clientData.business_name
  );

  // Marketplace Highlights
  const marketplaceAssets = (inventory || []).filter(item =>
    item.inventoryType === 'Marketplace' || !item.inventoryType
  ).slice(0, 4);

  // Recent POs and PRs
  const recentPOs = (purchaseOrders || []).slice(0, 4);
  const recentPRs = (purchaseRequests || []).slice(0, 4);
  const recentQuotes = (quotes || []).slice(0, 4);

  const totalExpenditure = clientOrders.reduce((acc, o) => acc + (parseFloat(o.total || 0)), 0);
  const totalPOValue = (purchaseOrders || []).reduce((acc, po) => acc + (parseFloat(po.totalAmount || po.total_amount || 0)), 0);

  const handleAction = (type, order) => {
    setSelectedOrder(order);
    setModalType(type);
    setIsModalOpen(true);
  };

  const handlePayment = async (inv) => {
    const amount = inv.totalAmount - (inv.paidAmount || 0);
    if ((await swalConfirm('Settle Balance', `Settle ${amount.toLocaleString()} for ${inv.id}?`)).isConfirmed) {
      settleInvoice(inv.id, { amount, method: 'Dashboard Fast-Pay' });
    }
  };

  const handleSave = (formData) => { setIsModalOpen(false); };
  const handleDelete = (id) => { setIsModalOpen(false); };

  const handleProfileUpdate = async () => {
    if (updateClient) {
      await updateClient(profileForm);
      setIsProfileModalOpen(false);
      swalSuccess('Success', 'Profile updated successfully.');
      fetchClients();
    }
  };

  return (
    <div className="min-h-screen space-y-8 animate-fade-in pb-10">
      <div className="max-w-[1600px] mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase">{clientData?.business_name || clientData?.name || 'Client'} Portal</h1>
            <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70">{clientData?.tagline || 'Institutional management and luxury asset tracking.'}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => navigate('/dashboard/purchase-requests')}
              className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.25em] hover:bg-accent hover:text-black hover:border-accent transition-all font-body active:scale-[0.98] flex items-center gap-2 group shadow-xl">
              <FileText size={14} className="group-hover:rotate-12 transition-transform" />Custom Requisition
            </button>
            <button onClick={() => navigate('/dashboard/store')}
              className="btn-primary text-[10px] px-8 py-2.5 md:px-12 flex items-center gap-3 shadow-[0_0_30px_rgba(200,169,106,0.3)]">
              <ShoppingBag size={14} /> Open Marketplace
            </button>
          </div>
        </div>

        {/* KPI Row 1 — Core Operations */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="col-span-2 md:col-span-2 lg:col-span-2">
            <StatCard label="Active Orders" value={activeOrders.length} icon={ShoppingCart} color="text-accent" bg="bg-accent/10" onClick={() => navigate('/dashboard/orders')} />
          </div>
          <div className="col-span-2 md:col-span-2 lg:col-span-2">
            <StatCard label="In-Transit Deliveries" value={activeDeliveries.length} icon={Truck} color="text-info" bg="bg-info/10" onClick={() => navigate('/dashboard/deliveries')} />
          </div>
          <div className="col-span-2 md:col-span-2 lg:col-span-2">
            <StatCard label="Unpaid Invoices" value={unpaidInvoices.length} icon={CreditCard} color="text-danger" bg="bg-danger/10" onClick={() => navigate('/dashboard/invoices')} />
          </div>
          <div className="col-span-2 md:col-span-2 lg:col-span-2">
            <StatCard label="Asset Reserve" value={personalAssets.length} icon={Package} color="text-success" bg="bg-success/10" onClick={() => navigate('/dashboard/inventory')} />
          </div>
        </div>

        {/* KPI Row 2 — Procurement & Sourcing */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Purchase Orders" value={(purchaseOrders || []).length} icon={ClipboardList} color="text-accent" bg="bg-accent/10" onClick={() => navigate('/dashboard/purchase-orders')} />
          <StatCard label="Purchase Requests" value={(purchaseRequests || []).length} icon={FileText} color="text-blue-400" bg="bg-blue-400/10" onClick={() => navigate('/dashboard/purchase-requests')} />
          <StatCard label="Quotes" value={(quotes || []).length} icon={Tag} color="text-purple-400" bg="bg-purple-400/10" onClick={() => navigate('/dashboard/quotes')} />
          <StatCard label="Warehouses" value={(warehouses || []).length} icon={Building2} color="text-info" bg="bg-info/10" onClick={() => navigate('/dashboard/warehouses')} />
        </div>

        {/* Client Profile Card */}
        <div className="glass-card p-6 sm:p-10 relative">
          <button
            onClick={() => { setProfileForm({ id: clientData.id, business_name: clientData.business_name || '', contact_person: clientData.contact_person || clientData.name || '', email: clientData.email || '', location: clientData.location || '', phone: clientData.phone || '' }); setIsProfileModalOpen(true); }}
            className="absolute top-6 right-6 p-2 text-white/50 hover:text-accent transition-colors"
          >
            <Edit3 size={18} />
          </button>
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
              <img src={clientData.logo_url || '/logo.png'} className="w-full h-full object-contain scale-[2.2]" alt={clientData.name} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 flex-1 w-full">
              <div className="space-y-1">
                <p className="text-[10px] text-accent font-black uppercase tracking-widest">Institutional ID</p>
                <p className="text-lg font-black text-white italic font-heading tracking-tighter">ZN-CLT-{clientData.id?.toString().slice(-4) || 'XXXX'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest">Primary Contact</p>
                <p className="text-sm font-black text-white italic">{clientData.contact_person || clientData.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest">Account Email</p>
                <p className="text-sm font-black text-white italic truncate">{clientData.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest">Location</p>
                <p className="text-sm font-black text-white italic truncate">{clientData.location || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest">Total Expenditure</p>
                <p className="text-sm font-black text-accent italic">${totalExpenditure.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Edit Modal */}
        <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Update Profile</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-1.5 text-muted hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {[['business_name', 'Business Name'], ['contact_person', 'Contact Person'], ['email', 'Email'], ['location', 'Location'], ['phone', 'Phone']].map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">{label}</label>
                  <input
                    type="text"
                    value={profileForm[field] || ''}
                    onChange={e => setProfileForm({ ...profileForm, [field]: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent"
                  />
                </div>
              ))}
              <button onClick={handleProfileUpdate} className="w-full btn-primary py-3 mt-2">Save Changes</button>
            </div>
          </div>
        </Modal>

        {/* Main 2-column content */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8">

          {/* Left Column */}
          <div className="xl:col-span-8 space-y-6 sm:space-y-8">

            {/* Requisition History (Orders) */}
            <SectionCard title="Requisition History" icon={History} viewAllPath="/dashboard/orders" navigate={navigate}>
              <div className="flex bg-background border border-border p-1 rounded-xl w-fit mb-6">
                {['open', 'fulfilled'].map(tab => (
                  <button key={tab} onClick={() => setOrderTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${orderTab === tab ? 'bg-accent text-black' : 'text-muted hover:text-white'}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {clientOrders.filter(o => orderTab === 'open' ? !['Delivered', 'Completed'].includes(o.status) : ['Delivered', 'Completed'].includes(o.status)).slice(0, 5).map((order, idx) => (
                  <motion.div layout key={idx} className="group bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-accent/30 hover:bg-white/[0.04] transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-background border border-white/10 rounded-xl flex items-center justify-center text-accent/40 group-hover:text-accent transition-colors">
                          <Package size={22} />
                        </div>
                        <div>
                          <p className="font-black text-white text-sm group-hover:text-accent transition-colors italic">{order.type || 'Custom Requisition'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest italic">ORD-{order.id}</span>
                            <span className="text-muted/30">•</span>
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest italic">{order.date}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                        <div className="text-right">
                          <p className="text-lg font-black text-white font-heading italic tracking-tighter">${parseFloat(order.total || 0).toLocaleString()}</p>
                          <StatusBadge status={order.status} />
                        </div>
                        <button onClick={() => handleAction('view', order)}
                          className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-accent hover:text-black hover:border-accent transition-all shadow-lg">
                          <ArrowUpRight size={20} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {clientOrders.filter(o => orderTab === 'open' ? !['Delivered', 'Completed'].includes(o.status) : ['Delivered', 'Completed'].includes(o.status)).length === 0 && (
                  <EmptyState text="No Requisition Logs Found" />
                )}
              </div>
            </SectionCard>

            {/* Purchase Orders */}
            <SectionCard title="Purchase Orders" icon={ClipboardList} viewAllPath="/dashboard/purchase-orders" navigate={navigate}>
              <div className="space-y-3">
                {recentPOs.length > 0 ? recentPOs.map((po, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-accent/20 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                        <ClipboardList size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white italic group-hover:text-accent transition-colors">PO-{po.id}</p>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest">{po.vendor?.name || po.vendorName || 'Vendor'} • {po.date || po.createdAt?.slice(0, 10)}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-sm font-black text-white italic">${parseFloat(po.totalAmount || po.total_amount || 0).toLocaleString()}</p>
                        <StatusBadge status={po.status} />
                      </div>
                    </div>
                  </div>
                )) : <EmptyState text="No Purchase Orders found" />}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                  <p className="text-lg font-black text-white">{(purchaseOrders || []).filter(p => p.status === 'Draft').length}</p>
                  <p className="text-[9px] text-muted uppercase font-black tracking-widest">Draft</p>
                </div>
                <div className="p-3 bg-accent/5 border border-accent/10 rounded-xl text-center">
                  <p className="text-lg font-black text-accent">${totalPOValue.toLocaleString()}</p>
                  <p className="text-[9px] text-muted uppercase font-black tracking-widest">Total Value</p>
                </div>
                <div className="p-3 bg-success/5 border border-success/10 rounded-xl text-center">
                  <p className="text-lg font-black text-success">{(purchaseOrders || []).filter(p => p.status === 'Fulfilled' || p.status === 'Received').length}</p>
                  <p className="text-[9px] text-muted uppercase font-black tracking-widest">Fulfilled</p>
                </div>
              </div>
            </SectionCard>

            {/* Purchase Requests */}
            <SectionCard title="Purchase Requests" icon={FileText} viewAllPath="/dashboard/purchase-requests" navigate={navigate}>
              <div className="space-y-3">
                {recentPRs.length > 0 ? recentPRs.map((pr, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-blue-400/20 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-400/10 rounded-xl flex items-center justify-center text-blue-400">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white italic group-hover:text-blue-400 transition-colors">{pr.title || pr.description || `PR-${pr.id}`}</p>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest">{pr.date || pr.createdAt?.slice(0, 10)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={pr.status} />
                    </div>
                  </div>
                )) : <EmptyState text="No Purchase Requests found" />}
              </div>
            </SectionCard>

            {/* Quotes */}
            <SectionCard title="Quotes" icon={Tag} viewAllPath="/dashboard/quotes" navigate={navigate}>
              <div className="space-y-3">
                {recentQuotes.length > 0 ? recentQuotes.map((q, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-purple-400/20 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-400/10 rounded-xl flex items-center justify-center text-purple-400">
                        <Tag size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white italic group-hover:text-purple-400 transition-colors">QT-{q.id}</p>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest">{q.vendor?.name || q.vendorName || q.client || ''} • {q.date || q.createdAt?.slice(0, 10)}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-sm font-black text-white italic">${parseFloat(q.totalAmount || q.amount || 0).toLocaleString()}</p>
                        <StatusBadge status={q.status} />
                      </div>
                    </div>
                  </div>
                )) : <EmptyState text="No Quotes found" />}
              </div>
            </SectionCard>

            {/* Deliveries */}
            <SectionCard title="Deliveries" icon={Truck} viewAllPath="/dashboard/deliveries" navigate={navigate}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-info/5 border border-info/10 rounded-xl text-center">
                  <p className="text-lg font-black text-info">{activeDeliveries.length}</p>
                  <p className="text-[9px] text-muted uppercase font-black tracking-widest">In Transit</p>
                </div>
                <div className="p-3 bg-success/5 border border-success/10 rounded-xl text-center">
                  <p className="text-lg font-black text-success">{deliveries.filter(d => d.status === 'Delivered' && clientOrders.some(o => o.id === d.orderId)).length}</p>
                  <p className="text-[9px] text-muted uppercase font-black tracking-widest">Delivered</p>
                </div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center">
                  <p className="text-lg font-black text-white">{deliveries.filter(d => clientOrders.some(o => o.id === d.orderId)).length}</p>
                  <p className="text-[9px] text-muted uppercase font-black tracking-widest">Total</p>
                </div>
              </div>
              <div className="space-y-3">
                {activeDeliveries.slice(0, 4).map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-info/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-info/10 rounded-xl flex items-center justify-center text-info">
                        <Truck size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white italic">DEL-{d.id}</p>
                        <p className="text-[10px] text-muted uppercase font-black tracking-widest">{d.destination || d.dropLocation || 'N/A'}</p>
                      </div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
                {activeDeliveries.length === 0 && <EmptyState text="No active deliveries" />}
              </div>
            </SectionCard>

            {/* Financial Reconcile */}
            <SectionCard title="Financial Reconcile" icon={Landmark} viewAllPath="/dashboard/invoices" navigate={navigate}>
              <div className="flex bg-background border border-border p-1 rounded-xl w-fit mb-6">
                {['unpaid', 'paid'].map(tab => (
                  <button key={tab} onClick={() => setInvoiceTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${invoiceTab === tab ? (tab === 'unpaid' ? 'bg-danger text-white' : 'bg-success text-white') : 'text-muted hover:text-white'}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {clientInvoices.filter(inv => invoiceTab === 'paid' ? inv.status === 'Paid' : inv.status !== 'Paid').map((inv, idx) => (
                  <motion.div layout key={idx} className="group bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-accent/30 hover:bg-white/[0.04] transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-background border border-white/10 rounded-xl flex items-center justify-center text-muted/40 group-hover:text-accent transition-colors">
                          <FileText size={22} />
                        </div>
                        <div>
                          <p className="font-black text-white text-sm group-hover:text-accent transition-colors italic">{inv.id}</p>
                          <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-1 italic">{inv.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                        <div className="text-right">
                          <p className="text-lg font-black text-white font-heading italic tracking-tighter">${parseFloat(inv.totalAmount || 0).toLocaleString()}</p>
                          <StatusBadge status={inv.status} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setViewingInvoice(inv); setIsInvoiceModalOpen(true); }}
                            className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-accent/10 hover:text-accent transition-all">
                            <Eye size={18} />
                          </button>
                          {inv.status !== 'Paid' && (
                            <button onClick={() => handlePayment(inv)}
                              className="px-6 h-10 bg-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]">
                              Settle
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {clientInvoices.filter(inv => invoiceTab === 'paid' ? inv.status === 'Paid' : inv.status !== 'Paid').length === 0 && (
                  <EmptyState text="No invoices found" />
                )}
              </div>
            </SectionCard>
          </div>

          {/* Right Column */}
          <div className="xl:col-span-4 space-y-6 sm:space-y-8">

            {/* Concierge Active Requests */}
            <SectionCard title="Concierge Active Requests" viewAllPath="/dashboard/client-events" navigate={navigate}>
              <div className="space-y-3">
                {clientGuestRequests.slice(0, 2).map((req, i) => (
                  <div key={i} className="p-4 bg-white/5 border border-border rounded-xl">
                    <p className="text-sm font-black text-white italic">{req.request || req.title || req.name}</p>
                    <p className="text-[10px] text-accent font-black uppercase tracking-widest mt-1">{req.date} - {req.status || 'Pending'}</p>
                  </div>
                ))}
                {clientGuestRequests.length === 0 && (
                  <div className="p-4 bg-white/[0.02] border border-border rounded-xl opacity-40 text-xs text-center italic py-10">
                    <p className="text-muted text-[10px] font-black uppercase">No active concierge logs found.</p>
                  </div>
                )}
              </div>
              <button onClick={() => navigate('/dashboard/client-events')}
                className="w-full mt-6 py-2.5 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
                Initiate Request
              </button>
            </SectionCard>

            {/* Chauffeur Requests */}
            <SectionCard title="Active Chauffeur Requests" icon={Car} viewAllPath="/dashboard/chauffeur" navigate={navigate}>
              <div className="space-y-3">
                {clientChauffeurRequests.slice(0, 3).map((req, i) => (
                  <div key={i} className="p-4 bg-white/5 border border-border rounded-xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-black text-white italic">{req.serviceType || 'Chauffeur Protocol'}</p>
                        <p className="text-[10px] text-muted font-bold mt-1 truncate max-w-[200px]">{req.pickupLocation}</p>
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-[10px] text-accent font-black uppercase tracking-widest mt-2">{req.dueDate || req.requestDate || ''} @ {req.pickupTime || ''}</p>
                  </div>
                ))}
                {clientChauffeurRequests.length === 0 && <EmptyState text="No active chauffeur protocols." />}
              </div>
              <button onClick={() => navigate('/dashboard/chauffeur')}
                className="w-full mt-6 py-2.5 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
                Manage Protocols
              </button>
            </SectionCard>

            {/* Warehouse Network */}
            <SectionCard title="Warehouse Network" icon={Building2} viewAllPath="/dashboard/warehouses" navigate={navigate}>
              <div className="space-y-3">
                {(warehouses || []).slice(0, 4).map((wh, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-info/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center text-info">
                        <Building2 size={14} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white italic">{wh.name}</span>
                        <p className="text-[9px] text-muted uppercase font-black tracking-widest">{wh.location || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={wh.status || 'active'} />
                    </div>
                  </div>
                ))}
                {(warehouses || []).length === 0 && <EmptyState text="No warehouses found" />}
              </div>
              <button onClick={() => navigate('/dashboard/warehouses')}
                className="w-full mt-4 py-2.5 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
                Manage Network
              </button>
            </SectionCard>

            {/* Private Asset Reserve */}
            <div className="glass-card p-6 sm:p-8 border-accent/20 bg-accent/[0.02]">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Package size={18} className="text-accent" /> Private Asset Reserve
              </h3>
              <div className="space-y-3 mb-6">
                {personalAssets.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-accent/40 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                        <Package size={14} />
                      </div>
                      <span className="text-xs font-bold text-white italic">{item.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-accent">x{item.qty}</span>
                  </div>
                ))}
                {personalAssets.length === 0 && <EmptyState text="No personal assets issued." />}
              </div>
              <button onClick={() => navigate('/dashboard/inventory')}
                className="w-full py-3 bg-accent text-black rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/10 hover:scale-[1.02] transition-all">
                Access Full Manifest
              </button>
            </div>

            {/* Marketplace Spotlight */}
            <div className="glass-card p-6 sm:p-8 bg-white/[0.01]">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <ShoppingBag size={14} className="text-info" /> Marketplace Spotlight
              </h3>
              <div className="space-y-4 mb-6">
                {marketplaceAssets.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-background/40 border border-white/5 rounded-2xl group hover:border-info/40 transition-all cursor-pointer" onClick={() => navigate('/dashboard/store')}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-info/40 group-hover:text-info transition-colors">
                        <ShoppingCart size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white italic">{item.name}</p>
                        <p className="text-[9px] text-muted uppercase font-black tracking-widest">${parseFloat(item.price).toLocaleString()}</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted group-hover:text-info transition-all" />
                  </div>
                ))}
                {marketplaceAssets.length === 0 && <EmptyState text="Marketplace catalog loading..." />}
              </div>
              <button onClick={() => navigate('/dashboard/store')}
                className="w-full py-3 border border-white/10 bg-white/5 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-info hover:text-white hover:border-info transition-all">
                Open Catalog
              </button>
            </div>

            {/* Quick Protocols */}
            <div className="glass-card p-6 sm:p-8">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6">Quick Protocols</h3>
              <div className="space-y-2">
                {[
                  { label: 'View Orders', path: '/dashboard/orders' },
                  { label: 'Purchase Requests', path: '/dashboard/purchase-requests' },
                  { label: 'Purchase Orders', path: '/dashboard/purchase-orders' },
                  { label: 'Quotes', path: '/dashboard/quotes' },
                  { label: 'Deliveries', path: '/dashboard/deliveries' },
                  { label: 'Warehouses', path: '/dashboard/warehouses' },
                  { label: 'Inventory', path: '/dashboard/inventory' },
                  { label: 'Fleet', path: '/dashboard/fleet' },
                  { label: 'Marketplace Entry', path: '/dashboard/store?tab=catalog' },
                  { label: 'Security Settings', path: '/dashboard/settings' },
                ].map((action, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(action.path)}
                    className="w-full py-3 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-accent/40 transition-all flex items-center justify-between px-4 group font-body active:scale-[0.98]">
                    <span>{action.label}</span>
                    <ChevronRight size={14} className="text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <OrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        modalType={modalType}
        selectedOrder={selectedOrder}
        onSave={handleSave}
        onDelete={handleDelete}
        role={currentUser?.role || 'client'}
      />

      <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title={`Institutional Invoice: ${viewingInvoice?.id}`}>
        <div className="space-y-6 py-4">
          <div className="p-6 bg-white/[0.02] border border-white/10 rounded-[2rem]">
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <p className="text-[10px] text-accent font-black uppercase tracking-widest">Recipient Manifest</p>
                <p className="text-base font-bold text-white">{clientData.name}</p>
                <p className="text-[10px] text-muted font-bold truncate max-w-[200px]">{clientData.address}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest">Protocol Date</p>
                <p className="text-base font-bold text-white tracking-tight">{viewingInvoice?.date}</p>
              </div>
            </div>
            <div className="space-y-3 pt-6 border-t border-white/5">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] text-muted font-black uppercase tracking-widest">Asset Subtotal</span>
                <span className="text-sm font-black text-white tabular-nums">${parseFloat(viewingInvoice?.totalAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center px-1 pt-4 border-t border-white/10 mt-2">
                <span className="text-[11px] font-black text-accent uppercase tracking-[0.2em]">Total Valuation</span>
                <span className="text-2xl font-black text-accent tabular-nums">${parseFloat(viewingInvoice?.totalAmount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => setIsInvoiceModalOpen(false)}
              className="flex-1 py-4 bg-white/5 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all">
              Close Ledger
            </button>
            <button onClick={() => { handlePayment(viewingInvoice); setIsInvoiceModalOpen(false); }}
              className="flex-1 py-4 bg-accent text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:shadow-[0_15px_30px_-5px_rgba(200,169,106,0.3)] transition-all">
              Finalize Settlement
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientDashboard;
