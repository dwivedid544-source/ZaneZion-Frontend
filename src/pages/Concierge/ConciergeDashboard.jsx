import React, { useState } from 'react';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import CustomDatePicker from '../../components/CustomDatePicker';
import {
  Sparkles, Heart, Calendar, Users, Star, Gift, Package, Coffee, Clock, Car, AlertCircle
} from 'lucide-react';

import { useData } from '../../context/GlobalDataContext';

const ConciergeDashboard = () => {
  const { 
    guestRequests = [], addGuestRequest, events = [], luxuryItems = [], addLuxuryItem, deliveries = [],
    chauffeurRequests = [], fetchChauffeurRequests,
    fetchTickets, fetchLuxuryItems, fetchDeliveries, fetchClients 
  } = useData();

  React.useEffect(() => {
    fetchTickets();
    fetchLuxuryItems();
    fetchDeliveries();
    fetchClients();
    fetchChauffeurRequests();
  }, [fetchTickets, fetchLuxuryItems, fetchDeliveries, fetchClients, fetchChauffeurRequests]);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isLuxuryModalOpen, setIsLuxuryModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Assuming searchTerm is needed for tracking filter

  const [requestFormData, setRequestFormData] = useState({ guest: '', request: '', time: '', date: new Date().toISOString().split('T')[0], priority: 'Medium', status: 'Pending' });
  const [luxuryFormData, setLuxuryFormData] = useState({ item: '', owner: '', vault: 'Vault Alpha', status: 'Stored', value: '' });

  const handleCreateRequest = () => {
    addGuestRequest(requestFormData);
    setIsRequestModalOpen(false);
    setRequestFormData({ guest: '', request: '', time: '', date: new Date().toISOString().split('T')[0], priority: 'Medium', status: 'Pending' });
  };

  const handleCreateLuxuryItem = () => {
    addLuxuryItem(luxuryFormData);
    setIsLuxuryModalOpen(false);
    setLuxuryFormData({ item: '', owner: '', vault: 'Vault Alpha', status: 'Stored', value: '' });
  };

  // Sort and limit for display
  const activeRequests = (guestRequests || []).filter(r => r.status !== 'Completed').slice(0, 5);
  const nextEvents = (events || []).filter(e => e.status !== 'Completed').slice(0, 3);
  const highValueAssets = (luxuryItems || []).slice(0, 3);

  // Chauffeur-specific stats for Concierge visibility
  const pendingChauffeurs = (chauffeurRequests || []).filter(r => {
    const s = String(r.status || '').toLowerCase().replace(/\s+/g, '_');
    return ['pending', 'pending_review'].includes(s) && !r.driverName;
  });
  const activeChauffeurs = (chauffeurRequests || []).filter(r => {
    const s = String(r.status || '').toLowerCase().replace(/\s+/g, '_');
    return ['assigned', 'en_route', 'in_transit'].includes(s);
  });
  // Chauffeur deliveries from the deliveries array (for the status monitor)
  const chauffeurDeliveries = (deliveries || []).filter(d =>
    String(d.mission_type || '').toLowerCase() === 'chauffeur' &&
    !['delivered', 'completed', 'cancelled'].includes(String(d.status || '').toLowerCase().replace(/\s+/g, '_'))
  );

  return (
    <div className="space-y-8 px-0 sm:px-2">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-bold tracking-tight text-white flex items-center gap-2 md:gap-3">
            <Sparkles className="text-accent shrink-0" size={24} />
            <span className="truncate">Concierge Command Center</span>
          </h1>
          <p className="text-secondary text-xs md:text-sm mt-1 uppercase font-bold tracking-widest leading-relaxed">
            Curating bespoke experiences and managing high-tier guest requests.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-row gap-3 w-full xl:w-auto">
          <button
            className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] sm:text-xs py-3.5 px-6"
            onClick={() => setIsLuxuryModalOpen(true)}
          >
            <Gift size={16} /> Asset Protocol
          </button>
          <button
            className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] sm:text-xs py-3.5 px-6"
            onClick={() => setIsRequestModalOpen(true)}
          >
            <Heart size={16} /> Guest Request
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard label="Active Requests" value={(guestRequests || []).filter(r => r.status !== 'Completed').length} change="+3" type="increase" icon={Heart} />
        <KpiCard label="Upcoming Events" value={(events || []).filter(e => e.status !== 'Completed').length} change="Next 7 Days" type="neutral" icon={Calendar} />
        <KpiCard
          label="Chauffeur Pending"
          value={pendingChauffeurs.length}
          change={pendingChauffeurs.length > 0 ? 'Action Required' : 'All Clear'}
          type={pendingChauffeurs.length > 0 ? 'decrease' : 'neutral'}
          icon={Car}
        />
        <KpiCard label="VIP Guests" value="28" change="+2" type="increase" icon={Users} />
        <KpiCard label="Rating" value="4.9/5" change="+0.1" type="increase" icon={Star} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Guest Requests - Responsive pass */}
        <div className="lg:col-span-2 glass-card p-4 sm:p-6 border-accent/10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-white">Guest Requests Ledger</h3>
            <button className="text-[10px] text-accent font-bold uppercase tracking-widest hover:underline">View All</button>
          </div>
          <div className="space-y-4">
            {activeRequests.map((req, idx) => (
              <div key={idx} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-accent/40 transition-all group">
                <div className="flex flex-col sm:flex-row flex-wrap sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/5 border border-accent/20 flex items-center justify-center text-accent group-hover:scale-105 transition-transform shrink-0">
                      <Coffee size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white tracking-tight text-sm md:text-base">{req.request}</h4>
                      <p className="text-[10px] text-secondary mt-0.5 uppercase tracking-wide">
                        Guest: <span className="text-accent font-bold">{req.guest}</span> <span className="mx-2 opacity-30">|</span> <span className="font-bold">{req.priority} Priority</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                    <StatusBadge status={req.status} />
                    <button className="p-2 bg-white/5 hover:bg-accent hover:text-black rounded-xl text-secondary transition-all">
                      <Clock size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chauffeur Service Monitor */}
        <div className="glass-card p-6 border-accent/10">
          <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
            <Car className="text-accent" size={18} /> Chauffeur Dispatch
          </h3>

          {/* Pending Action Alert */}
          {pendingChauffeurs.length > 0 && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl mb-4 flex items-center gap-3">
              <AlertCircle size={16} className="text-warning shrink-0" />
              <p className="text-[10px] font-black text-warning uppercase tracking-widest">
                {pendingChauffeurs.length} request{pendingChauffeurs.length > 1 ? 's' : ''} awaiting driver assignment
              </p>
            </div>
          )}

          <div className="space-y-4">
            {chauffeurDeliveries.map((del, idx) => (
              <div key={idx} className="p-3 bg-white/[0.02] border border-border rounded-xl hover:border-accent/30 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-[11px] font-bold text-white">{del.item || 'VIP Chauffeur Service'}</p>
                  <StatusBadge status={del.status} />
                </div>
                <div className="flex justify-between text-[9px] text-muted uppercase font-bold tracking-widest">
                  <span>Pilot: {del.driver || <span className="text-warning">Unassigned</span>}</span>
                  <span className="text-accent">{del.eta || 'TBD'}</span>
                </div>
                {del.pickupLocation && (
                  <p className="text-[9px] text-secondary mt-1 truncate">From: {del.pickupLocation} → {del.dropLocation || del.location || 'TBD'}</p>
                )}
              </div>
            ))}
            {chauffeurDeliveries.length === 0 && (
              <p className="text-xs text-secondary italic text-center py-4">No active chauffeur dispatches.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Event Status */}
        <div className="glass-card p-6 border-accent/10">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Calendar className="text-accent" size={20} /> Event Operational Status
          </h3>
          <div className="space-y-6">
            {nextEvents.map((event, idx) => (
              <div key={idx} className="relative pl-6 pb-6 border-l border-border last:pb-0">
                <div className={`absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(200,169,106,0.6)]`} />
                <div className="flex justify-between items-start mb-1">
                  <h5 className="text-sm font-bold text-white tracking-tight">{event.title}</h5>
                  <span className="text-[10px] text-muted font-bold uppercase">{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <p className="text-[11px] text-secondary font-medium">{event.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Luxury Items & Storage */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Gift className="text-accent" size={20} /> On-Hand Luxury Assets
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {highValueAssets.map((item, idx) => (
              <div key={idx} className="p-4 bg-background border border-border rounded-2xl flex items-center justify-between group hover:border-accent/40 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/5 rounded-xl border border-border/50 flex items-center justify-center text-accent group-hover:bg-accent/10 transition-colors">
                    <Package size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.item}</p>
                    <p className="text-[10px] text-muted uppercase tracking-widest">{item.owner}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-accent font-heading tracking-tighter italic">{item.value}</p>
                  <p className="text-[10px] text-muted uppercase">Valuation</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* New Guest Request Modal */}
      <Modal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        title="New Guest Requirement"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase">Guest / Suite</label>
              <input
                type="text"
                value={requestFormData.guest}
                onChange={(e) => setRequestFormData({ ...requestFormData, guest: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase">Priority</label>
              <select
                value={requestFormData.priority}
                onChange={(e) => setRequestFormData({ ...requestFormData, priority: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Immediate</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase">Request Details</label>
              <textarea
                value={requestFormData.request}
                onChange={(e) => setRequestFormData({ ...requestFormData, request: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none h-24 resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase">Target Date</label>
              <input
                type="date"
                value={requestFormData.date}
                onChange={(e) => setRequestFormData({ ...requestFormData, date: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase">Delivery Time</label>
              <input
                type="text"
                value={requestFormData.time}
                placeholder="e.g. 11:30 PM"
                onChange={(e) => setRequestFormData({ ...requestFormData, time: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setIsRequestModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateRequest} className="btn-primary">Execute Request</button>
          </div>
        </div>
      </Modal>

      {/* Order Luxury Item Modal */}
      <Modal
        isOpen={isLuxuryModalOpen}
        onClose={() => setIsLuxuryModalOpen(false)}
        title="New Custody Entry"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase">Asset Description</label>
              <input
                type="text"
                value={luxuryFormData.item}
                onChange={(e) => setLuxuryFormData({ ...luxuryFormData, item: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase">Beneficiary Name</label>
              <input
                type="text"
                value={luxuryFormData.owner}
                onChange={(e) => setLuxuryFormData({ ...luxuryFormData, owner: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase">Value Estimate</label>
              <input
                type="text"
                value={luxuryFormData.value}
                onChange={(e) => setLuxuryFormData({ ...luxuryFormData, value: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setIsLuxuryModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateLuxuryItem} className="btn-primary">Finalize Protocol</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ConciergeDashboard;
