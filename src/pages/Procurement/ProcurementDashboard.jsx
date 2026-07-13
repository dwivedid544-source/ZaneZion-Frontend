import React, { useState, useEffect } from 'react';
import Table from '../../components/Table';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import RequestModal from '../../components/RequestModal';
import {
  ShoppingBag, Store, FileText,
  DollarSign, CheckCircle, Eye, Edit2,
  ChevronRight, Plus,
} from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import { Link } from 'react-router-dom';

const ProcurementDashboard = () => {
  const { purchaseRequests, addPurchaseRequest, updatePurchaseRequest, vendors, quotes, fetchProcurement, fetchVendors } = useData();

  useEffect(() => {
    fetchProcurement();
    fetchVendors();
  }, [fetchProcurement, fetchVendors]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalType, setModalType] = useState('add');

  const reqList = purchaseRequests || [];
  const vendorList = vendors || [];
  const quoteList = quotes || [];
  const approvedVendorList = vendorList.filter((v) => String(v?.status ?? '').toLowerCase() === 'active');
  const pendingVendorApprovals = vendorList.filter((v) => String(v?.status ?? '').toLowerCase() === 'inactive').length;

  const pendingRequestsCount = reqList.filter((r) => String(r.status || '').toLowerCase() === 'pending').length;
  const managedVendorsCount = approvedVendorList.length;
  const openQuotesCount = quoteList.filter((q) => String(q.status || '').toLowerCase() === 'pending').length;
  const quotesPipelineUsd = quoteList.reduce((acc, q) => acc + parseFloat(q.total_amount || q.total || 0), 0);
  const formattedPipeline =
    quotesPipelineUsd > 0
      ? `$${quotesPipelineUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : '$0';

  const handleAction = (type, req) => {
    setSelectedRequest(req);
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleSaveRequest = (formData) => {
    if (modalType === 'add') {
      addPurchaseRequest(formData);
    } else {
      updatePurchaseRequest({ ...selectedRequest, ...formData });
    }
    setIsModalOpen(false);
  };

  const topVendors = approvedVendorList.slice(0, 6);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Procurement Center</h1>
          <p className="text-secondary mt-1">Sourcing, vendor selection, and purchase audit headquarters.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link to="/dashboard/purchase-requests" className="btn-secondary text-xs px-6 text-center inline-flex items-center justify-center">
            Purchase requests
          </Link>
          <button type="button" className="btn-primary text-xs px-6" onClick={() => { setModalType('add'); setSelectedRequest(null); setIsModalOpen(true); }}>
            New request
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label="Pending purchase requests" value={String(pendingRequestsCount)} icon={ShoppingBag} compact />
        <KpiCard label="Managed vendors" value={String(managedVendorsCount)} icon={Store} compact />
        <KpiCard label="Open quotes" value={String(openQuotesCount)} icon={FileText} compact />
        <KpiCard label="Quote pipeline (listed)" value={formattedPipeline} icon={DollarSign} compact />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 text-white">
        <div className="xl:col-span-2 glass-card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold">Purchase requests</h3>
            <Link to="/dashboard/purchase-requests" className="text-xs text-accent font-bold hover:underline inline-flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-4">
            {reqList.length === 0 && (
              <p className="text-secondary text-sm py-8 text-center">No purchase requests loaded yet.</p>
            )}
            {reqList.map((req) => {
              const deptName = typeof req.department === 'object' && req.department !== null ? (req.department.name || '—') : (req.department || req.department_name || req.departmentId || '—');
              const itemName = (Array.isArray(req.items) && req.items.length > 0) ? (req.items[0].name || req.items[0].itemName || req.item || 'Unknown Item') : (req.item || req.title || 'Unknown Item');
              return (
                <div
                  key={req.id ?? req.requestId ?? `req-${itemName}-${deptName}`}
                  className="group bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-accent/30 hover:bg-white/[0.04] transition-all duration-300 shadow-xl"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className={`w-12 h-12 bg-background border border-white/10 rounded-xl flex items-center justify-center transition-colors shadow-inner ${String(req.status || '').toLowerCase() === 'approved' ? 'text-success' : 'text-warning'
                          }`}
                      >
                        <CheckCircle size={22} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm sm:text-base group-hover:text-accent transition-colors truncate">
                          {itemName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-muted uppercase tracking-widest">{req.prNumber || req.requestId || req.id}</span>
                          <span className="text-muted/30">•</span>
                          <span className="text-[10px] font-black text-muted uppercase tracking-widest">{deptName}</span>
                        </div>
                      </div>
                    </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-0.5">Priority</p>
                      <p className={`text-[10px] font-bold uppercase ${req.priority === 'Urgent' ? 'text-danger' : 'text-accent'}`}>{req.priority}</p>
                    </div>
                    <StatusBadge status={req.status} />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAction('view', req)}
                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-accent hover:text-black transition-all"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction('edit', req)}
                        className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center hover:bg-white hover:text-black transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
            })}
          </div>
        </div>

        <div className="glass-card p-6 sm:p-8 flex flex-col min-h-[280px]">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h3 className="text-xl font-bold">Approved vendors</h3>
            <Link to="/dashboard/vendors" className="text-xs text-accent font-bold hover:underline inline-flex items-center gap-1">
              Manage <ChevronRight size={14} />
            </Link>
          </div>
          {pendingVendorApprovals > 0 && (
            <p className="text-[10px] font-black uppercase tracking-widest text-warning mb-4">
              {pendingVendorApprovals} vendor{pendingVendorApprovals === 1 ? '' : 's'} awaiting HQ approval (cannot be used on POs yet).
            </p>
          )}
          {topVendors.length === 0 ? (
            <p className="text-secondary text-sm flex-1 flex items-center justify-center py-8">No approved vendors yet — add in directory and wait for HQ activation.</p>
          ) : (
            <ul className="space-y-3 flex-1">
              {topVendors.map((v) => (
                <li key={v.id ?? v.name} className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm font-bold text-white truncate">{v.name || v.business_name || `Vendor ${v.id}`}</span>
                  <span className="text-[10px] font-black text-muted uppercase tracking-wider shrink-0">{v.category || 'Partner'}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/dashboard/vendors"
            className="w-full mt-6 py-3 bg-white/5 border border-border text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all text-center"
          >
            Open vendor directory
          </Link>
        </div>
      </div>

      <div className="glass-card p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h3 className="text-xl font-bold">Quotes</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to="/dashboard/quotes?new=1"
              className="btn-primary text-xs py-2.5 px-4 rounded-xl font-bold uppercase tracking-wider inline-flex items-center gap-2"
            >
              <Plus size={14} /> New quote
            </Link>
            <Link to="/dashboard/quotes" className="text-xs text-accent font-bold hover:underline inline-flex items-center gap-1">
              All quotes <ChevronRight size={14} />
            </Link>
          </div>
        </div>
        <Table
          columns={[
            {
              header: 'Vendor',
              accessor: 'vendorId',
              render: (row) => {
                const vid = row.vendorId ?? row.vendor_id;
                const v =
                  vendorList?.find((x) => String(x.id) === String(vid)) ||
                  vendorList?.find((x) => String(x.id) === `VND-00${vid}`);
                return v?.name || v?.vendor_name || v?.business_name || row.vendorName || row.vendor || '—';
              },
            },
            { 
              header: 'Item', 
              accessor: 'items', 
              render: (row) => {
                const quoteItems = Array.isArray(row.items) ? row.items : (Array.isArray(row.metadata?.items) ? row.metadata.items : []);
                return quoteItems?.[0]?.name || row.item || '—';
              }
            },
            {
              header: 'Amount',
              accessor: 'total',
              render: (row) => (
                <span className="text-accent font-bold">
                  ${parseFloat(row.total || row.total_amount || 0).toLocaleString()}
                </span>
              ),
            },
          ]}
          data={quoteList.slice(0, 5)}
          actions
          customAction={(row) => (
            <Link
              to="/dashboard/quotes"
              className="text-[10px] font-bold uppercase tracking-widest text-accent bg-accent/5 px-3 py-2 rounded-lg border border-accent/20 hover:bg-accent hover:text-black transition-all"
            >
              Open quotes
            </Link>
          )}
        />
      </div>

      <RequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRequest}
        selectedRequest={selectedRequest}
        modalType={modalType}
      />
    </div>
  );
};

export default ProcurementDashboard;
