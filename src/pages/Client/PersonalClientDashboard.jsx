// Personal Client Dashboard – distinct from SaaS client dashboard
import React, { useState, useEffect } from 'react';
import { swalSuccess, swalError, swalConfirm } from '../../utils/swal';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import OrderModal from '../../components/OrderModal';
import Modal from '../../components/Modal';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';
import { ShoppingCart, Truck, CreditCard, ChevronRight, History, Package, ArrowUpRight, Car, HelpCircle, FileText, Eye, ShoppingBag } from 'lucide-react';

// Re‑used UI components (StatCard, SectionCard, EmptyState) are defined inline for clarity
const StatCard = ({ label, value, icon: Icon, color = 'text-accent', bg = 'bg-accent/10', onClick }) => (
  <div
    className={`glass-card p-5 ${onClick ? 'cursor-pointer' : ''} group transition-all hover:border-accent/30`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${color}`}>{label}</p>
        <p className="text-3xl font-black italic font-heading tracking-tighter text-white">{String(value ?? 0).padStart(2, '0')}</p>
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
  </div>
);

const SectionCard = ({ title, icon: Icon, children, viewAllPath, navigate }) => (
  <div className="glass-card p-6">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-2">
        {Icon && <Icon size={18} className="text-accent" />}{title}
      </h3>
      {viewAllPath && (
        <button onClick={() => navigate(viewAllPath)} className="text-[9px] font-black uppercase tracking-widest text-muted hover:text-accent transition-colors flex items-center gap-1">
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

const PersonalClientDashboard = () => {
  const {
    orders,
    invoices,
    settleInvoice,
    currentUser,
    clients,
    inventory = [],
    deliveries = [],
    chauffeurRequests = [],
    fetchChauffeurRequests,
    fetchOrders,
    fetchFinance,
    fetchInventory,
    fetchClients,
    fetchDeliveries,
    fetchDashboardStats,
    events = [],
    fetchTickets,
    updateClient,
    purchaseOrders = [],
    purchaseRequests = [],
    quotes = [],
    warehouses = [],
    fleet = [],
    guestRequests = [],
    luxuryItems = [],
    fetchLuxuryItems,
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
  }, []);

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

  const activeOrders = clientOrders.filter(o => !['Delivered', 'Cancelled', 'Completed'].includes(o.status));
  const activeDeliveries = deliveries.filter(d => d.status !== 'Delivered' && clientOrders.some(o => o.id === d.orderId));
  const unpaidInvoices = clientInvoices.filter(inv => inv.status !== 'Paid');

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
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white italic uppercase">Personal Client Dashboard</h1>
            <p className="text-secondary text-[10px] md:text-xs mt-1 font-black uppercase tracking-[0.2em] opacity-70">{clientData?.tagline || 'Personal client dashboard.'}</p>
          </div>

        </div>

        {/* KPI Row – Core Operations */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <StatCard label="Active Orders" value={activeOrders.length} icon={ShoppingCart} color="text-accent" bg="bg-accent/10" onClick={() => navigate('/dashboard/orders')} />
          <StatCard label="In‑Transit Deliveries" value={activeDeliveries.length} icon={Truck} color="text-info" bg="bg-info/10" onClick={() => navigate('/dashboard/deliveries')} />
          <StatCard label="Unpaid Invoices" value={unpaidInvoices.length} icon={CreditCard} color="text-danger" bg="bg-danger/10" onClick={() => navigate('/dashboard/invoices')} />
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8">
          {/* Left Column */}
          <div className="xl:col-span-8 space-y-6 sm:space-y-8">
            {/* Recent Orders */}
            <SectionCard title="Recent Orders" icon={History} viewAllPath="/dashboard/orders" navigate={navigate}>
              <div className="flex bg-background border border-border p-1 rounded-xl w-fit mb-6">
                {['open', 'fulfilled'].map(tab => (
                  <button key={tab} onClick={() => setOrderTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${orderTab === tab ? 'bg-accent text-black' : 'text-muted hover:text-white'}`}
                  >{tab}</button>
                ))}
              </div>
              <div className="space-y-3">
                {clientOrders.filter(o => orderTab === 'open' ? !['Delivered', 'Completed'].includes(o.status) : ['Delivered', 'Completed'].includes(o.status)).slice(0, 5).map((order, idx) => (
                  <div key={idx} className="group bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-accent/30 hover:bg-white/[0.04] transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-background border border-white/10 rounded-xl flex items-center justify-center text-accent/40 group-hover:text-accent transition-colors"><Package size={22} /></div>
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
                        <button onClick={() => handleAction('view', order)} className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center hover:bg-accent hover:text-black hover:border-accent transition-all shadow-lg"><ArrowUpRight size={20} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {clientOrders.filter(o => orderTab === 'open' ? !['Delivered', 'Completed'].includes(o.status) : ['Delivered', 'Completed'].includes(o.status)).length === 0 && (<EmptyState text="No Requisition Logs Found" />)}
              </div>
            </SectionCard>

            {/* Chauffeur Bookings */}
            <SectionCard title="Chauffeur Bookings" icon={Car} viewAllPath="/dashboard/chauffeur" navigate={navigate}>
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
                    <p className="text-[10px] text-accent font-black uppercase tracking-widest mt-2">Client ID</p>
                    <p className="text-[10px] text-muted font-bold mt-1">{req.dueDate || req.requestDate || ''} @ {req.pickupTime || ''}</p>
                  </div>
                ))}
                {clientChauffeurRequests.length === 0 && <EmptyState text="No active chauffeur protocols." />}
                <button onClick={() => navigate('/dashboard/chauffeur')} className="w-full mt-6 py-2.5 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Manage Protocols</button>
              </div>
            </SectionCard>

            {/* Concierge Requests */}
            <SectionCard title="Concierge Requests" icon={HelpCircle} viewAllPath="/dashboard/client-events" navigate={navigate}>
              <div className="space-y-3">
                {events.filter(e => e.clientId === clientData.id || e.client === clientData.name).slice(0, 3).map((event, i) => (
                  <div key={i} className="p-4 bg-white/5 border border-border rounded-xl">
                    <p className="text-sm font-black text-white italic">{event.request || event.title || event.name}</p>
                    <p className="text-[10px] text-accent font-black uppercase tracking-widest mt-1">{event.date} - {event.status || 'Pending'}</p>
                  </div>
                ))}
                {events.filter(e => e.clientId === clientData.id || e.client === clientData.name).length === 0 && (<EmptyState text="No active concierge logs found." />)}
                <button onClick={() => navigate('/dashboard/client-events')} className="w-full mt-6 py-2.5 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Initiate Request</button>
              </div>
            </SectionCard>

            {/* Delivery Tracking */}
            <SectionCard title="Delivery Tracking" icon={Truck} viewAllPath="/dashboard/deliveries" navigate={navigate}>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-info/5 border border-info/10 rounded-xl text-center"><p className="text-lg font-black text-info">{activeDeliveries.length}</p><p className="text-[9px] text-muted uppercase font-black tracking-widest">In Transit</p></div>
                <div className="p-3 bg-success/5 border border-success/10 rounded-xl text-center"><p className="text-lg font-black text-success">{deliveries.filter(d => d.status === 'Delivered' && clientOrders.some(o => o.id === d.orderId)).length}</p><p className="text-[9px] text-muted uppercase font-black tracking-widest">Delivered</p></div>
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-center"><p className="text-lg font-black text-white">{deliveries.filter(d => clientOrders.some(o => o.id === d.orderId)).length}</p><p className="text-[9px] text-muted uppercase font-black tracking-widest">Total</p></div>
              </div>
              <div className="space-y-3">
                {activeDeliveries.slice(0, 4).map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-info/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-info/10 rounded-xl flex items-center justify-center text-info"><Truck size={16} /></div>
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
          </div>

          {/* Right Column */}
          <div className="xl:col-span-4 space-y-6 sm:space-y-8">
            {/* Billing & Invoices */}
            <SectionCard title="Billing & Invoices" icon={CreditCard} viewAllPath="/dashboard/invoices" navigate={navigate}>
              <div className="flex bg-background border border-border p-1 rounded-xl w-fit mb-6">
                {['unpaid', 'paid'].map(tab => (
                  <button key={tab} onClick={() => setInvoiceTab(tab)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${invoiceTab === tab ? (tab === 'unpaid' ? 'bg-danger text-white' : 'bg-success text-white') : 'text-muted hover:text-white'}`}>{tab}</button>
                ))}
              </div>
              <div className="space-y-3">
                {clientInvoices.filter(inv => invoiceTab === 'paid' ? inv.status === 'Paid' : inv.status !== 'Paid').map((inv, idx) => (
                  <div key={idx} className="group bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-accent/30 hover:bg-white/[0.04] transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-background border border-white/10 rounded-xl flex items-center justify-center text-muted/40 group-hover:text-accent transition-colors"><FileText size={22} /></div>
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
                          <button onClick={() => { setViewingInvoice(inv); setIsInvoiceModalOpen(true); }} className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-accent hover:text-accent transition-all"><Eye size={18} /></button>
                          {inv.status !== 'Paid' && (
                            <button onClick={() => handlePayment(inv)} className="px-6 h-10 bg-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-lg transition-all">Settle</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {clientInvoices.filter(inv => invoiceTab === 'paid' ? inv.status === 'Paid' : inv.status !== 'Paid').length === 0 && (<EmptyState text="No invoices found" />)}
              </div>
            </SectionCard>

            {/* Marketplace Store */}
            <SectionCard title="Marketplace Store" icon={ShoppingBag} viewAllPath="/dashboard/store" navigate={navigate}>
              <button onClick={() => navigate('/dashboard/store')} className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-info hover:text-white hover:border-info transition-all">Open Catalog</button>
            </SectionCard>

            {/* Customer Support */}
            <SectionCard title="Customer Support" icon={HelpCircle} viewAllPath="/dashboard/support" navigate={navigate}>
              <button onClick={() => navigate('/dashboard/support')} className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-accent hover:text-black hover:border-accent transition-all">Open Support</button>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Modals */}
      <OrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} modalType={modalType} selectedOrder={selectedOrder} onSave={() => {}} onDelete={() => {}} role={currentUser?.role || 'client'} />
      <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title={`Invoice: ${viewingInvoice?.id}`}>
        {/* Minimal invoice view – details already displayed in the main list */}
      </Modal>
    </div>
  );
};

export default PersonalClientDashboard;
