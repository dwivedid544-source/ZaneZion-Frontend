import React, { useState, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import OrderModal from '../../components/OrderModal';
import {
  Package, Truck, History, CreditCard, Wallet,
  MapPin, CheckCircle,
  ArrowUpRight, ShoppingBag, ShoppingCart, TrendingUp, Landmark,
  HelpCircle, FileText, Eye, Download, Link, ChevronRight, Zap, Car, Sparkles, Edit3, X
} from 'lucide-react';
import Modal from '../../components/Modal';
import { motion } from 'framer-motion';

import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';

const ClientDashboard = () => {
  const {
    orders, invoices, settleInvoice, currentUser, clients, inventory = [], deliveries = [],
    chauffeurRequests = [], fetchChauffeurRequests,
    fetchOrders, fetchFinance, fetchInventory, fetchClients, fetchDeliveries, fetchDashboardStats,
    events = [], fetchTickets, updateClient
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
  }, [fetchOrders, fetchFinance, fetchInventory, fetchClients, fetchDeliveries, fetchDashboardStats, fetchTickets, fetchChauffeurRequests]);

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

  // Personal Assets (Inventory items issued to this client)
  const personalAssets = (inventory || []).filter(item =>
    item.inventoryType === 'Client' && (
      String(item.clientId) === String(clientData.id) ||
      item.issuedTo === clientData.name
    )
  );

  // Marketplace Highlights
  const marketplaceAssets = (inventory || []).filter(item =>
    item.inventoryType === 'Marketplace' || !item.inventoryType
  ).slice(0, 4);

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

  const handleSave = (formData) => {
    setIsModalOpen(false);
  };

  const handleDelete = (id) => {
    setIsModalOpen(false);
  };

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

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase">{clientData?.business_name || clientData?.name || "Client"} Portal</h1>
            <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70">{clientData?.tagline || "Institutional management and luxury asset tracking."}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {(() => {
              const role = normalizeRole(currentUser?.role);
              const clientType = currentUser?.client_type || 'Individual';
              const isPremium = currentUser?.plan?.toLowerCase().includes('premium') || currentUser?.is_upgraded;
              const canPR = role !== 'customer' || clientType === 'Company' || (clientType === 'Individual' && isPremium);

              if (canPR) {
                return (
                  <button
                    onClick={() => navigate('/dashboard/purchase-requests')}
                    className="px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.25em] hover:bg-accent hover:text-black hover:border-accent transition-all font-body active:scale-[0.98] flex items-center gap-2 group shadow-xl"
                  >
                    <FileText size={14} className="group-hover:rotate-12 transition-transform" />
                    Custom Requisition
                  </button>
                );
              }
              return null;
            })()}
            <button
              onClick={() => navigate('/dashboard/store')}
              className="btn-primary text-[10px] px-8 py-2.5 md:px-12 flex items-center gap-3 shadow-[0_0_30px_rgba(200,169,106,0.3)]"
            >
              <ShoppingBag size={14} />
              Open Marketplace
            </button>
          </div>
        </div>

        {normalizeRole(currentUser?.role) === 'customer' && (
          <div className="glass-card p-6 border border-accent/15 bg-accent/[0.04]">
            <p className="text-[10px] font-black text-accent uppercase tracking-[0.3em] mb-4">Your tasks</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard/chauffeur')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-accent hover:text-black hover:border-accent transition-all"
              >
                <Car size={16} /> Chauffeur
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/support')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-accent hover:text-black hover:border-accent transition-all"
              >
                <HelpCircle size={16} /> Support
              </button>
              <button
                type="button"
                onClick={async () => {
                  const confirmed = await swalConfirm('Upgrade Account', 'Upgrade to Premium Plan for $10/mo to unlock Strategic Purchase Requests?');
                  if (confirmed.isConfirmed) {
                    swalSuccess('Success', 'Account upgraded to Premium. Procurement features unlocked!');
                    // In a real app, we'd call an API here.
                    // For now, we'll mock the UI update if possible or just inform.
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-accent hover:text-black hover:border-accent transition-all"
              >
                <Sparkles size={16} /> Upgrade account
              </button>
            </div>
          </div>
        )}

        {/* KPI Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-card p-6">
            <p className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">Active Orders</p>
            <p className="text-2xl font-black text-white italic font-heading tracking-tighter">{activeOrders.length.toString().padStart(2, '0')}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-1">Total Deliveries</p>
            <p className="text-2xl font-black text-info italic font-heading tracking-tighter">{(deliveries.filter(d => d.orderId && clientOrders.some(o => o.id === d.orderId)).length).toString().padStart(2, '0')}</p>
          </div>
          <div className="glass-card p-6 border-accent/20 bg-accent/[0.03]">
            <p className="text-[10px] text-accent font-black uppercase tracking-widest mb-1">Asset Reserve</p>
            <p className="text-2xl font-black text-white italic font-heading tracking-tighter">{personalAssets.length.toString().padStart(2, '0')}</p>
          </div>
          <div className="glass-card p-6">
            <p className="text-[10px] text-secondary font-black uppercase tracking-widest mb-1">Unpaid Ledgers</p>
            <p className="text-2xl font-black text-info italic font-heading tracking-tighter">
              {clientInvoices.filter(inv => inv.status !== 'Paid').length.toString().padStart(2, '0')}
            </p>
          </div>
        </div>

        {/* Client Profile Section */}
        <div className="glass-card p-6 sm:p-10 relative">
          <button
            onClick={() => { setProfileForm({ id: clientData.id, business_name: clientData.business_name || '', contact_person: clientData.contact_person || clientData.name || '', email: clientData.email || '', location: clientData.location || '', phone: clientData.phone || '' }); setIsProfileModalOpen(true); }}
            className="absolute top-6 right-6 p-2 text-white/50 hover:text-accent transition-colors"
          >
            <Edit3 size={18} />
          </button>
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
              <img src={clientData.logo_url || "/logo.png"} className="w-full h-full object-contain scale-[2.2]" alt={clientData.name} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-1 w-full">
              <div className="space-y-1">
                <p className="text-[10px] text-accent font-black uppercase tracking-widest">Institutional ID</p>
                <p className="text-lg font-black text-white italic font-heading tracking-tighter">ZN-CLT-{clientData.id?.toString().slice(-4) || 'XXXX'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest">Primary Contact</p>
                <p className="text-sm font-black text-white italic">{clientData.contact_person || clientData.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest">Account email</p>
                <p className="text-sm font-black text-white italic truncate">{clientData.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted font-black uppercase tracking-widest">Location</p>
                <p className="text-sm font-black text-white italic truncate">{clientData.location || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Edit Modal */}
        <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black text-white uppercase italic">Edit Profile</h2>
              <button onClick={() => setIsProfileModalOpen(false)}><X size={20} className="text-white" /></button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Business Name" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={profileForm.business_name} onChange={e => setProfileForm({ ...profileForm, business_name: e.target.value })} />
              <input type="text" placeholder="Contact Person" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={profileForm.contact_person} onChange={e => setProfileForm({ ...profileForm, contact_person: e.target.value })} />
              <input type="email" placeholder="Email" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} />
              <input type="text" placeholder="Location" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={profileForm.location} onChange={e => setProfileForm({ ...profileForm, location: e.target.value })} />
              <input type="text" placeholder="Phone" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
              <button onClick={handleProfileUpdate} className="w-full py-3 bg-accent text-black font-black uppercase rounded-xl">Save Changes</button>
            </div>
          </div>
        </Modal>

        {/* Main Operational Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8">

          {/* Left Column - Active Protocols */}
          <div className="xl:col-span-8 space-y-6 sm:space-y-8 text-white">

            {/* Orders Section */}
            <div className="glass-card p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Requisition History</h3>
                <div className="flex bg-background border border-border p-1 rounded-xl">
                  <button
                    onClick={() => setOrderTab('open')}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${orderTab === 'open' ? 'bg-accent text-black' : 'text-muted hover:text-white'}`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setOrderTab('closed')}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${orderTab === 'closed' ? 'bg-accent text-black' : 'text-muted hover:text-white'}`}
                  >
                    Archived
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {(clientOrders || []).filter(o => orderTab === 'open' ? !['Delivered', 'Completed'].includes(o.status) : ['Delivered', 'Completed'].includes(o.status)).map((order, idx) => (
                  <motion.div
                    layout
                    key={idx}
                    className="group bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-accent/30 hover:bg-white/[0.04] transition-all duration-300 shadow-xl"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-background border border-white/10 rounded-xl flex items-center justify-center text-accent/40 group-hover:text-accent transition-colors shadow-inner">
                          <Package size={22} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-white text-sm sm:text-base group-hover:text-accent transition-colors truncate italic">
                            {order.type || "Custom Requisition"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest italic">ORD-{order.id}</span>
                            <span className="text-muted/30">•</span>
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest italic">{order.date}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <p className="text-lg font-black text-white font-heading italic tracking-tighter">${parseFloat(order.total || 0).toLocaleString()}</p>
                          <StatusBadge status={order.status} />
                        </div>
                        <button
                          onClick={() => handleAction('view', order)}
                          className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-accent hover:text-black hover:border-accent transition-all duration-300 shadow-lg"
                        >
                          <ArrowUpRight size={20} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {(clientOrders || []).filter(o => orderTab === 'open' ? !['Delivered', 'Completed'].includes(o.status) : ['Delivered', 'Completed'].includes(o.status)).length === 0 && (
                  <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[2rem] bg-white/[0.01]">
                    <History size={64} strokeWidth={1} className="mx-auto mb-4 text-white/5" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted italic">No Requisition Logs Found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Open Requisitions" value={clientOrders.filter(o => !['Delivered', 'Completed'].includes(o.status)).length.toString()} change="" type="neutral" color="text-info" icon={ShoppingCart} />
              <KpiCard label="Account Status" value={clientData.status?.toUpperCase() || "ACTIVE"} change="" type="neutral" color="text-success" icon={TrendingUp} />
              <KpiCard label="Active Deliveries" value={deliveries.filter(d => d.status !== 'Delivered' && clientOrders.some(o => o.id === d.orderId)).length.toString()} change="" type="neutral" color="text-accent" icon={Truck} />
              <KpiCard label="Total Expenditure" value={`$${clientOrders.reduce((acc, o) => acc + (parseFloat(o.total || 0)), 0).toLocaleString()}`} change="" type="neutral" color="text-success" icon={Landmark} />
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-6">Financial Reconcile</h3>
              <div className="flex bg-background border border-border p-1 rounded-xl w-fit mb-6">
                <button
                  onClick={() => setInvoiceTab('unpaid')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${invoiceTab === 'unpaid' ? 'bg-danger text-white' : 'text-muted hover:text-white'}`}
                >
                  Unpaid
                </button>
                <button
                  onClick={() => setInvoiceTab('paid')}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${invoiceTab === 'paid' ? 'bg-success text-white' : 'text-muted hover:text-white'}`}
                >
                  Paid
                </button>
              </div>

              <div className="space-y-3">
                {(clientInvoices || []).filter(inv => invoiceTab === 'paid' ? inv.status === 'Paid' : inv.status !== 'Paid').map((inv, idx) => (
                  <motion.div
                    layout
                    key={idx}
                    className="group bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-accent/30 hover:bg-white/[0.04] transition-all duration-300 shadow-xl"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-background border border-white/10 rounded-xl flex items-center justify-center text-muted/40 group-hover:text-accent transition-colors shadow-inner">
                          <FileText size={22} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-white text-sm sm:text-base group-hover:text-accent transition-colors truncate italic">
                            {inv.id}
                          </p>
                          <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-1 italic">{inv.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <p className="text-lg font-black text-white font-heading italic tracking-tighter">${parseFloat(inv.totalAmount || 0).toLocaleString()}</p>
                          <StatusBadge status={inv.status} />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setViewingInvoice(inv);
                              setIsInvoiceModalOpen(true);
                            }}
                            className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-accent/10 hover:text-accent transition-all shadow-lg"
                          >
                            <Eye size={18} />
                          </button>
                          {inv.status !== 'Paid' && (
                            <button
                              onClick={() => handlePayment(inv)}
                              className="px-6 h-10 bg-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                              Settle
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Logistics & Inventory */}
          <div className="xl:col-span-4 space-y-6 sm:space-y-8">
            <div className="glass-card p-6 sm:p-8">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6">Concierge Active Requests</h3>
              <div className="space-y-3">
                {events.filter(e => e.clientId === clientData.id || e.client === clientData.name).slice(0, 2).map((event, i) => (
                  <div key={i} className="p-4 bg-white/5 border border-border rounded-xl">
                    <p className="text-sm font-black text-white italic">{event.title || event.name}</p>
                    <p className="text-[10px] text-accent font-black uppercase tracking-widest mt-1">{event.date} - {event.status || 'Scheduled'}</p>
                  </div>
                ))}
                {events.filter(e => e.clientId === clientData.id || e.client === clientData.name).length === 0 && (
                  <div className="p-4 bg-white/[0.02] border border-border rounded-xl opacity-40 text-xs text-center italic py-10">
                    <p className="text-muted text-[10px] font-black uppercase">No active concierge logs found.</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate('/dashboard/client-events')}
                className="w-full mt-6 py-2.5 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                Initiate Request
              </button>
            </div>

            <div className="glass-card p-6 sm:p-8">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Car size={18} className="text-accent" /> Active Chauffeur Requests
              </h3>
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
                {clientChauffeurRequests.length === 0 && (
                  <div className="p-4 bg-white/[0.02] border border-border rounded-xl opacity-40 text-xs text-center italic py-10">
                    <p className="text-muted text-[10px] font-black uppercase">No active chauffeur protocols.</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate('/dashboard/chauffeur')}
                className="w-full mt-6 py-2.5 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                Manage Protocols
              </button>
            </div>

            <div className="glass-card p-6 sm:p-8 border-accent/20 bg-accent/[0.02]">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                <Package size={18} className="text-accent" /> Private Asset Reserve
              </h3>
              <div className="space-y-3 mb-6">
                {personalAssets.slice(0, 3).map((item, i) => (
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
                {personalAssets.length === 0 && (
                  <p className="text-[10px] text-muted uppercase italic text-center py-4">No personal assets issued.</p>
                )}
              </div>
              <button
                onClick={() => navigate('/dashboard/client-inventory')}
                className="w-full py-3 bg-accent text-black rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/10 hover:scale-[1.02] transition-all"
              >
                Access Full Manifest
              </button>
            </div>

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
              </div>
              <button
                onClick={() => navigate('/dashboard/store')}
                className="w-full py-3 border border-white/10 bg-white/5 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-info hover:text-white hover:border-info transition-all"
              >
                Open Catalog
              </button>
            </div>

            <div className="glass-card p-6 sm:p-8">
              <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-6">Quick Protocols</h3>
              <div className="space-y-2">
                {[
                  { label: "Marketplace Entry", path: "/dashboard/store?tab=catalog" },
                  ...(currentUser?.role !== 'customer' ? [{ label: "Custom Requisition", path: "/dashboard/store?tab=sheet" }] : []),
                  { label: "Security Settings", path: "/dashboard/settings" }
                ].map((action, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(action.path)}
                    className="w-full py-3 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-accent/40 transition-all flex items-center justify-between px-4 group font-body active:scale-[0.98]"
                  >
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

      <Modal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title={`Institutional Invoice: ${viewingInvoice?.id}`}
      >
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
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] text-muted font-black uppercase tracking-widest">Logistics Surcharge</span>
                <span className="text-sm font-black text-white tabular-nums">$0.00</span>
              </div>
              <div className="flex justify-between items-center px-1 pt-4 border-t border-white/10 mt-2">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-black text-accent uppercase tracking-[0.2em] block">Total Valuation</span>
                  <div className="flex items-center gap-1.5 text-[9px] text-success font-bold uppercase">
                    <Zap size={10} className="fill-success" /> Institutional Protocol
                  </div>
                </div>
                <span className="text-2xl font-black text-accent tabular-nums shadow-accent/5 shadow-2xl">${parseFloat(viewingInvoice?.totalAmount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              onClick={() => setIsInvoiceModalOpen(false)}
              className="flex-1 py-4 bg-white/5 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all font-body active:scale-[0.98]"
            >
              Close Ledger
            </button>
            <button
              onClick={() => {
                handlePayment(viewingInvoice);
                setIsInvoiceModalOpen(false);
              }}
              className="flex-1 py-4 bg-accent text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:shadow-[0_15px_30px_-5px_rgba(200,169,106,0.3)] transition-all font-body active:scale-[0.98]"
            >
              Finalize Settlement
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientDashboard;
