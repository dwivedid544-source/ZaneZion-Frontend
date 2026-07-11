import React, { useState } from 'react';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Plus, Search, FileText, Store,
  DollarSign, Clock, CheckCircle, XCircle,
  BarChart3, ShieldCheck, Trash2, Calendar, HardDrive, Printer
} from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';
import CustomDatePicker from '../../components/CustomDatePicker';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Common/Pagination';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuotes, useRFQs, useCreateRFQ, useUpdateRFQ, useDeleteRFQ, useCreateQuotation, useUpdateQuotation, useDeleteQuotation, usePurchaseRequests, useCreatePurchaseOrder } from '../../hooks/api/useProcurement';
import { RefreshCcw } from 'lucide-react';
import { swalSuccess, swalError } from '../../utils/swal';

/** API may return items as JSON string, object, or array — form always uses [{ name, qty, price }]. */
function normalizeQuoteItems(items) {
  const defaultRow = () => ({ name: '', qty: 1, price: 0 });
  if (items == null || items === '') return [defaultRow()];
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return normalizeQuoteItems(parsed);
    } catch {
      return [defaultRow()];
    }
  }
  if (Array.isArray(items)) {
    if (items.length === 0) return [defaultRow()];
    return items.map((row) => ({
      name: row?.name ?? row?.product_name ?? row?.title ?? '',
      qty: row?.qty ?? row?.quantity ?? 1,
      price: row?.price ?? row?.unit_price ?? 0,
    }));
  }
  if (typeof items === 'object') {
    return [{
      name: items.name ?? items.product_name ?? items.title ?? '',
      qty: items.qty ?? items.quantity ?? 1,
      price: items.price ?? items.unit_price ?? 0,
    }];
  }
  return [defaultRow()];
}

const Quotes = () => {
  const { vendors, fetchVendors, addQuote, updateQuote, deleteQuote, addOrder, hasMenuPermission, currentUser } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: quotesData, isLoading: isLoadingQuotes, error: errorQuotes } = useQuotes(page, 10, searchTerm);
  const { data: rfqsData, isLoading: isLoadingRfqs } = useRFQs(page, 10);
  const { data: prData } = usePurchaseRequests(1, 100);

  React.useEffect(() => {
    if (fetchVendors && (!vendors || vendors.length === 0)) fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const realQuotes = Array.isArray(quotesData) ? quotesData : (quotesData?.quotations || quotesData?.data || []);
  const realRfqs = Array.isArray(rfqsData) ? rfqsData : (rfqsData?.rfqs || rfqsData?.data || []);
  const activePurchaseRequests = Array.isArray(prData) ? prData : (prData?.purchaseRequests || prData?.data || []);

  const createRfqMutation = useCreateRFQ();
  const updateRfqMutation = useUpdateRFQ();
  const deleteRfqMutation = useDeleteRFQ();
  const createQuoteMutation = useCreateQuotation();
  const updateQuoteMutation = useUpdateQuotation();
  const deleteQuoteMutation = useDeleteQuotation();
  const { mutateAsync: createPurchaseOrderMutation } = useCreatePurchaseOrder();

  // Offline Fallback Mechanism: If real API is empty or fails, merge with context mocks
  const resolvedRfqs = realRfqs.length > 0 ? realRfqs.map(r => ({ ...r, id: `RFQ-${r.id}`, quote_type: 'vendor_request', vendor_id: r.vendorId, total_amount: 0 })) : [];
  const resolvedQuotations = realQuotes.length > 0 ? realQuotes.map(q => {
    let parsedRemarks = {};
    try {
      parsedRemarks = JSON.parse(q.remarks || '{}');
    } catch (e) {
      parsedRemarks = { leadTime: q.remarks };
    }
    return {
      ...q,
      id: `QUO-${q.id}`,
      quote_type: 'client',
      vendor_id: q.vendorId,
      purchaseRequestId: q.rfq?.purchaseRequestId || q.purchaseRequestId,
      total_amount: q.amount,
      items: parsedRemarks.items || [],
      leadTime: parsedRemarks.leadTime || '',
      validity_date: parsedRemarks.validity || '',
      paymentTerms: parsedRemarks.paymentTerms || 'Net 30'
    };
  }) : [];
  
  const mergedRfqs = resolvedRfqs;
  const mergedQuotations = resolvedQuotations;

  const combinedQuotes = [...mergedRfqs, ...mergedQuotations].sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));

  const quotes = combinedQuotes;
  const isLoading = isLoadingQuotes || isLoadingRfqs;
  const error = errorQuotes;

  const meta = quotesData?.meta || { totalPages: 1, totalItems: combinedQuotes.length };

  const userRole = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase().replace(/\s+/g, '_');
  const isCustomer = ['customer', 'saas_client', 'client'].includes(userRole);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('view');
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [formData, setFormData] = useState({
    vendor: '',
    vendorId: '',
    purchaseRequestId: '',
    rfqId: '',
    items: [{ name: '', qty: 1, price: 0 }],
    leadTime: '',
    validity: '',
    paymentTerms: 'Net 30',
    status: 'Pending',
    quoteType: 'client',
  });

  // Procurement dashboard "New quote" → /dashboard/quotes?new=1
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') !== '1') return;
    setSelectedQuote({});
    setModalType('add');
    setFormData({
      vendor: '',
      vendorId: '',
      purchaseRequestId: '',
      rfqId: '',
      items: [{ name: '', qty: 1, price: 0 }],
      leadTime: '3 Days',
      validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 30',
      status: 'Pending',
    });
    setIsModalOpen(true);
    navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate]);

  const filteredQuotes = quotes;
  const currentQuotes = quotes; // API already paginates
  const totalPages = meta.totalPages;

  const handleAction = (type, quote) => {
    setSelectedQuote(quote);
    setModalType(type);
    setFormData(quote.id ? {
      ...quote,
      vendorId: quote.vendorId ?? quote.vendor_id ?? '',
      purchaseRequestId: quote.purchaseRequestId || '',
      rfqId: quote.rfqId || '',
      vendor: quote.vendor || quote.vendor_name || '',
      items: normalizeQuoteItems(quote.items || quote.metadata?.items),
      validity: quote.validity ?? quote.metadata?.validity ?? (quote.validity_date?.split?.('T')?.[0] || ''),
      leadTime: quote.leadTime ?? quote.metadata?.leadTime ?? quote.lead_time ?? '',
      paymentTerms: quote.paymentTerms ?? quote.metadata?.paymentTerms ?? quote.payment_terms ?? 'Net 30',
      quoteType: quote.quote_type === 'vendor_request' || quote.quoteType === 'vendor' ? 'vendor' : 'client',
    } : {
      vendor: '',
      vendorId: '',
      purchaseRequestId: '',
      rfqId: '',
      items: [{ name: '', qty: 1, price: 0 }],
      leadTime: '3 Days',
      validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentTerms: 'Net 30',
      status: 'Pending',
      quoteType: 'client',
    });
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    const items = normalizeQuoteItems(formData.items);
    setFormData({ ...formData, items: [...items, { name: '', qty: 1, price: 0 }] });
  };

  const removeItem = (index) => {
    const items = normalizeQuoteItems(formData.items);
    setFormData({ ...formData, items: items.filter((_, i) => i !== index) });
  };

  const handleSave = async () => {
    if (modalType === 'delete') {
      try {
        const isRfq = formData.quoteType === 'vendor';
        const rawId = String(selectedQuote.id).replace('RFQ-', '').replace('QUO-', '');
        if (isRfq) {
          await deleteRfqMutation.mutateAsync(parseInt(rawId, 10));
          swalSuccess('Success', 'RFQ deleted successfully.');
        } else {
          await deleteQuoteMutation.mutateAsync(parseInt(rawId, 10));
          swalSuccess('Success', 'Quotation deleted successfully.');
        }
      } catch (err) {
        swalError('Error', err?.response?.data?.message || 'Failed to process Quotation');
      }
      setIsModalOpen(false);
      return;
    }

    const items = normalizeQuoteItems(formData.items);
    const total = items.reduce((acc, i) => acc + (parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 0), 0);
    const qt = formData.quoteType === 'vendor' ? 'vendor_request' : 'client';
    const parsedVendorId = parseInt(String(formData.vendorId ?? '').trim(), 10);
    const normalizedVendorId = Number.isFinite(parsedVendorId) && parsedVendorId > 0 ? parsedVendorId : null;
    if (!normalizedVendorId) {
      window.alert('Please select a valid supply partner before saving the quote.');
      return;
    }
    const selectedVendor = (vendors || []).find((v) => String(v.id) === String(normalizedVendorId));
    const resolvedVendorName = String(
      selectedVendor?.name ||
      selectedVendor?.vendor_name ||
      selectedVendor?.business_name ||
      selectedVendor?.company_name ||
      formData.vendor ||
      ''
    ).trim();

    const isRfq = formData.quoteType === 'vendor';
    
    if (isRfq && !formData.purchaseRequestId) {
      window.alert('Purchase Request is required to generate an RFQ.');
      return;
    }

    try {
      if (modalType === 'add') {
        if (isRfq) {
          // Send to API
          await createRfqMutation.mutateAsync({
            purchaseRequestId: parseInt(formData.purchaseRequestId, 10),
            vendorId: normalizedVendorId,
            metadata: {
              items: items,
              leadTime: formData.leadTime,
              validity: formData.validity,
              paymentTerms: formData.paymentTerms
            }
          });
          console.log('[REAL_API_SUCCESS] RFQ Created');
        } else {
          await createQuoteMutation.mutateAsync({
            rfqId: formData.rfqId ? parseInt(formData.rfqId, 10) : undefined,
            vendorId: normalizedVendorId,
            amount: total,
            remarks: JSON.stringify(items),
            leadTime: formData.leadTime,
            validity: formData.validity,
            paymentTerms: formData.paymentTerms,
            items: items
          });
          console.log('[REAL_API_SUCCESS] Quotation Created');
        }
      } else if (modalType === 'edit' && selectedQuote?.id) {
        const rawId = String(selectedQuote.id).replace('RFQ-', '').replace('QUO-', '');
        if (isRfq) {
          await updateRfqMutation.mutateAsync({
            id: parseInt(rawId, 10),
            data: { 
              status: formData.status.toLowerCase(),
              metadata: {
                items: items,
                leadTime: formData.leadTime,
                validity: formData.validity,
                paymentTerms: formData.paymentTerms
              }
            }
          });
          console.log('[REAL_API_SUCCESS] RFQ Updated');
        } else {
          await updateQuoteMutation.mutateAsync({
            id: parseInt(rawId, 10),
            data: { status: formData.status.toLowerCase() }
          });
          console.log('[REAL_API_SUCCESS] Quotation Updated');
        }
      }

    } catch (err) {
      swalError('Failed to process Quotation');
    }
    
    setIsModalOpen(false);
  };

  const handleAccept = async () => {
    try {
      const prId = selectedQuote.purchaseRequestId;
      if (!prId) {
        window.alert('Cannot generate Purchase Order: Missing Purchase Request ID on this quote.');
        return;
      }
      await createPurchaseOrderMutation({
        poNumber: `PO-${Date.now()}`,
        vendorId: selectedQuote.vendorId || selectedQuote.vendor_id,
        purchaseRequestId: prId,
        quotationId: selectedQuote.id ? parseInt(String(selectedQuote.id).replace('QUO-', ''), 10) : null,
        totalAmount: selectedQuote.total_amount || selectedQuote.amount || 0
      });
      await updateQuoteMutation.mutateAsync({
        id: parseInt(String(selectedQuote.id).replace('QUO-', ''), 10),
        data: { status: 'approved' }
      });
      console.log('[REAL_API_SUCCESS] Purchase Order Created from Quotation');
    } catch (err) {
      swalError('Failed to generate Purchase Order from Quotation');
    }
    setIsModalOpen(false);
  };

  const handlePrint = (quote) => {
    setSelectedQuote(quote);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleDownloadPdf = (quote) => {
    const rows = normalizeQuoteItems(quote.items || []).map((item) => {
      const qty = parseInt(item.qty, 10) || 0;
      const unit = parseFloat(item.price) || 0;
      const lineTotal = qty * unit;
      return [
        item.name || 'Item',
        String(qty),
        String(quote.quote_type === 'vendor_request' || quote.quoteType === 'vendor' ? 'N/A' : `$${unit.toFixed(2)}`),
        String(quote.quote_type === 'vendor_request' || quote.quoteType === 'vendor' ? 'N/A' : `$${lineTotal.toFixed(2)}`),
      ];
    });
    const total = parseFloat(quote.total_amount || quote.total || 0) || 0;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('ZaneZion Quote', 14, 16);
    doc.setFontSize(10);
    doc.text(`Quote ID: ${quote.id || '-'}`, 14, 24);
    doc.text(`Vendor: ${quote.vendor_name || quote.vendor || '-'}`, 14, 30);
    doc.text(`Type: ${quote.quote_type === 'vendor_request' || quote.quoteType === 'vendor' ? 'Vendor Quote Request' : 'Client Quote'}`, 14, 36);
    autoTable(doc, {
      startY: 42,
      head: [['Item', 'Qty', 'Unit Price', 'Line Total']],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [20, 20, 20] }
    });
    const finalY = doc.lastAutoTable?.finalY || 60;
    doc.text(
      `Total: ${quote.quote_type === 'vendor_request' || quote.quoteType === 'vendor' ? 'N/A' : `$${total.toFixed(2)}`}`,
      14,
      finalY + 10
    );
    doc.save(`quote_${quote.id || 'draft'}.pdf`);
  };

  const columns = [
    { header: "Institutional ID", accessor: "id", render: (row) => <span className="font-mono font-bold text-accent">{row.id}</span> },
    {
      header: "Supply Partner",
      accessor: "vendor_name",
      render: (row) => {
        const vid = row.vendorId ?? row.vendor_id;
        const linkedVendor = (vendors || []).find((v) => String(v.id) === String(vid));
        const fallbackVendor = typeof row.vendor === 'object' && row.vendor !== null 
          ? (row.vendor.companyName || row.vendor.name || row.vendor.vendor_name || 'Unknown Provider')
          : (row.vendor_name || row.vendor || 'Unknown Provider');
          
        return (
          linkedVendor?.name ||
          linkedVendor?.vendor_name ||
          linkedVendor?.business_name ||
          linkedVendor?.company_name ||
          fallbackVendor
        );
      }
    },
    { header: "Request Date", accessor: "date", render: (row) => (row.createdAt || row.created_at || row.date)?.split('T')[0] || 'N/A' },
    { header: "Protocol Validity", accessor: "validity_date", render: (row) => {
        let v = row.validity_date || row.validity || row.metadata?.validity;
        if (!v && typeof row.remarks === 'string') {
          try {
            const parsed = JSON.parse(row.remarks);
            if (parsed.validity) v = parsed.validity;
          } catch(e){}
        }
        return v?.split?.('T')?.[0] || 'N/A';
    } },
    {
      header: "Settlement Value",
      accessor: "total_amount",
      render: (row) => {
        const isVendorQuote = row.quote_type === 'vendor_request' || row.quoteType === 'vendor';
        let parsedItems = [];
        if (isVendorQuote && row.metadata) {
          let metadata = row.metadata;
          if (typeof metadata === 'string') {
            try { metadata = JSON.parse(metadata); } catch(e){}
          }
          parsedItems = metadata.items || [];
        } else {
          parsedItems = normalizeQuoteItems(row.items || row.remarks);
        }
        const computedTotal = parsedItems.reduce((acc, item) => acc + (parseFloat(item.price ?? 0) * parseInt(item.qty ?? 0, 10)), 0);
        const finalValue = parseFloat(row.total_amount || row.total || computedTotal || 0);
        return (
          <span className="font-black text-white">
            {finalValue > 0 ? `$${finalValue.toLocaleString()}` : 'N/A'}
          </span>
        );
      }
    },
    {
      header: "Protocol Status",
      accessor: "status",
      render: (row) => <StatusBadge status={row.status} />
    },
  ];

  const totalValue = quotes.reduce((acc, q) => acc + parseFloat(q.total_amount || q.total || 0), 0);
  const activeQuotes = quotes.filter(q => q.status === 'Pending').length;
  const acceptedQuotes = quotes.filter(q => q.status === 'Accepted').length;
  const compactCurrency = (value) => {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(n);
    }
    return `$${n.toLocaleString()}`;
  };

  return (
    <div className="space-y-8">
      <div className="no-print space-y-8">
      {/* Header */}
      <div className="no-print-logic flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Institutional Quoting</h1>
          <p className="text-secondary mt-1 text-sm">Manage luxury asset acquisition and vendor competitive analysis.</p>
        </div>
        {hasMenuPermission('Quotes', 'can_add') && (
          <button className="btn-primary flex items-center gap-2 self-start" onClick={() => handleAction('add', {})}>
            <Plus size={16} /> New Quote Request
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="no-print-logic grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Quotes', value: quotes.length, icon: FileText, color: 'text-accent' },
          { label: 'Total Value', value: compactCurrency(totalValue), icon: DollarSign, color: 'text-success' },
          { label: 'Active', value: activeQuotes, icon: Clock, color: 'text-info' },
          { label: 'Accepted', value: acceptedQuotes, icon: CheckCircle, color: 'text-success' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-5 flex items-center gap-4 hover:border-accent/20 transition-all group">
            <div className={`w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center ${stat.color} group-hover:scale-110 transition-transform flex-shrink-0`}>
              <stat.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-muted uppercase tracking-widest truncate">{stat.label}</p>
              <p className="text-lg sm:text-xl font-black text-white leading-tight truncate">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="no-print-logic glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Search by ID or Manifest..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12"><RefreshCcw className="animate-spin text-accent" /></div>
        ) : error ? (
          <div className="text-danger p-4">Failed to load quotes.</div>
        ) : (
          <>
            <Table
              columns={columns}
              data={currentQuotes}
              actions={true}
              customAction={(quote) => (
                <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrint(quote); }}
                  className="p-2 rounded-lg text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                  title="Print / download quote"
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownloadPdf(quote); }}
                  className="p-2 rounded-lg text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"
                  title="Download quote PDF"
                >
                  <HardDrive size={16} />
                </button>
                </div>
              )}
              onView={(item) => handleAction('view', item)}
              onEdit={(item) => handleAction('edit', item)}
              onDelete={(item) => handleAction('delete', item)}
              canEdit={!isCustomer && hasMenuPermission('Quotes', 'can_edit')}
              canDelete={!isCustomer && hasMenuPermission('Quotes', 'can_delete')}
            />
            <div className="mt-6 border-t border-white/5 pt-6">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={meta.totalItems}
              />
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'Institutional Quote Manifest' :
            modalType === 'edit' ? 'Update Procurement Terms' :
              modalType === 'delete' ? 'Discard Quote' : 'Initiate Quote Submission'
        }
      >
        <div className="space-y-6">
          {modalType === 'delete' ? (
            <div className="space-y-4">
              <p className="text-secondary">Are you sure you want to permanently discard the quote request <span className="text-accent font-bold">{selectedQuote?.id}</span>?</p>
              <div className="flex gap-3 justify-end pt-6 border-t border-border/50">
                <button onClick={() => setIsModalOpen(false)} className="btn-secondary h-11 px-8 rounded-xl font-bold uppercase text-xs">
                  Cancel
                </button>
                <button onClick={handleSave} className="btn-primary bg-danger hover:bg-danger/80 border-danger h-11 px-8 rounded-xl font-bold uppercase text-xs">
                  Confirm Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-muted uppercase">Supply Partner</label>
                  <select
                    value={String(formData.vendorId || '')}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const selected = (vendors || []).find((v) => String(v.id) === String(nextId));
                      const selectedName = selected?.name || selected?.vendor_name || selected?.business_name || selected?.company_name || '';
                      setFormData({ ...formData, vendorId: nextId, vendor: selectedName });
                    }}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option value="">Select supply partner...</option>
                    {(vendors || []).filter(v => String(v.status || '').toLowerCase() === 'active').map((v) => {
                      const label = v.name || v.vendor_name || v.business_name || v.company_name || `Vendor #${v.id}`;
                      return (
                        <option key={String(v.id)} value={v.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Protocol ID</label>
                  <input type="text" value={formData.id || 'AUTO'} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-mono text-accent" disabled={true} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-muted uppercase">Quote purpose</label>
                  <select
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    value={formData.quoteType || 'client'}
                    onChange={(e) => {
                      setFormData({ ...formData, quoteType: e.target.value, purchaseRequestId: '', rfqId: '' });
                    }}
                    disabled={modalType === 'view' || modalType === 'edit'}
                  >
                    <option value="client">Client quote (with unit pricing)</option>
                    <option value="vendor">Vendor Quote Request (RFQ)</option>
                  </select>
                </div>

                {formData.quoteType === 'vendor' && (
                  <div className="space-y-1 col-span-2 border-l-2 border-accent pl-4 py-2">
                    <label className="text-[10px] font-bold text-accent uppercase">Link Purchase Request (Required for RFQ)</label>
                    <select
                      value={formData.purchaseRequestId || ''}
                      onChange={(e) => {
                        const prId = e.target.value;
                        const selectedPr = activePurchaseRequests.find(pr => String(pr.id) === String(prId));
                        let prItems = [{ name: '', qty: 1, price: 0 }];
                        if (selectedPr && Array.isArray(selectedPr.items) && selectedPr.items.length > 0) {
                          prItems = selectedPr.items.map(item => ({
                            name: item.name || item.itemName || '',
                            qty: item.qty ?? item.quantity ?? 1,
                            price: item.price ?? item.estimatedCost ?? item.estimated_cost ?? 0
                          }));
                        }
                        setFormData({
                          ...formData,
                          purchaseRequestId: prId,
                          items: prItems
                        });
                      }}
                      className="w-full bg-background border border-accent/30 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                      disabled={modalType === 'view' || modalType === 'edit'}
                    >
                      <option value="">Select an approved Purchase Request...</option>
                      {activePurchaseRequests
                        .filter(pr => String(pr.status).toLowerCase() === 'approved' || String(pr.status).toLowerCase() === 'department_approved' || String(pr.status).toLowerCase() === 'procurement_review' || String(pr.status).toLowerCase() === 'pending' || String(pr.status).toLowerCase() === 'rfq_created') // temporarily broadened to show options if none are strictly 'approved'
                        .map(pr => (
                        <option key={pr.id} value={pr.id}>PR-{pr.id} ({pr.title || pr.item || 'Items'}) - {pr.status}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Protocol Status</label>
                  <select className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={modalType === 'view'}>
                    <option value="Pending">Pending</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Projected Lead Time</label>
                  <input type="text" value={formData.leadTime} onChange={(e) => setFormData({ ...formData, leadTime: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={modalType === 'view'} placeholder="e.g. 5 Business Days" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Validity Threshold</label>
                  <input type="date" value={formData.validity} onChange={(e) => setFormData({ ...formData, validity: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none" disabled={modalType === 'view'} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Payment Terms</label>
                  <select
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    value={formData.paymentTerms || 'Net 30'}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    disabled={modalType === 'view'}
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-muted uppercase">Institutional Quote PDF</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex items-center justify-between bg-white/5 border border-dashed border-accent/20 rounded-xl px-4 py-3 cursor-pointer hover:bg-accent/5 transition-all">
                      <div className="flex items-center gap-3">
                        <HardDrive size={18} className="text-accent" />
                        <span className="text-xs text-secondary">{formData.pdfName || 'Upload signed protocol manifest...'}</span>
                      </div>
                      <span className="text-[10px] font-black text-accent uppercase tracking-widest bg-accent/10 px-3 py-1 rounded-lg">Browse</span>
                      <input type="file" className="hidden" onChange={(e) => setFormData({ ...formData, pdfName: e.target.files[0]?.name })} disabled={modalType === 'view'} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Asset Manifest Highlights</label>
                  {modalType !== 'view' && (
                    <button onClick={handleAddItem} className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1">
                      <Plus size={10} /> Add Item
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {normalizeQuoteItems(formData.items).map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-end bg-white/5 p-2 rounded-lg border border-border">
                      <div className="flex-1 space-y-1">
                        <label className="text-[8px] text-muted uppercase">Asset Name</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...normalizeQuoteItems(formData.items)];
                            newItems[idx] = { ...newItems[idx], name: e.target.value };
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="w-full bg-transparent border-0 border-b border-border focus:border-accent text-xs p-0 outline-none"
                          placeholder="Product Title"
                          disabled={modalType === 'view'}
                        />
                      </div>
                      <div className="w-16 space-y-1">
                        <label className="text-[8px] text-muted uppercase">Qty</label>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => {
                            const newItems = [...normalizeQuoteItems(formData.items)];
                            newItems[idx] = { ...newItems[idx], qty: e.target.value };
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="w-full bg-transparent border-0 border-b border-border focus:border-accent text-xs p-0 outline-none"
                          disabled={modalType === 'view'}
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <label className="text-[8px] text-muted uppercase">Unit Price</label>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => {
                              const newItems = [...normalizeQuoteItems(formData.items)];
                              newItems[idx] = { ...newItems[idx], price: e.target.value };
                              setFormData({ ...formData, items: newItems });
                            }}
                            className="w-full bg-transparent border-0 border-b border-border focus:border-accent text-xs p-0 outline-none"
                            disabled={modalType === 'view'}
                            step="0.01"
                          />
                      </div>
                      {modalType !== 'view' && normalizeQuoteItems(formData.items).length > 1 && (
                        <button onClick={() => removeItem(idx)} className="p-1.5 text-danger hover:bg-danger/10 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {modalType === 'view' && (
                <div className="mt-6 p-4 bg-white/5 rounded-xl border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-secondary">
                      <DollarSign size={16} className="text-accent" /> Total Manifest Value
                    </div>
                    <span className="text-xl font-bold font-mono text-accent">
                      {formData.quoteType === 'vendor'
                        ? 'N/A'
                        : `$${normalizeQuoteItems(formData.items).reduce((acc, i) => acc + (parseFloat(i.price) || 0) * (parseInt(i.qty, 10) || 0), 0).toLocaleString()}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-6">
                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                {modalType === 'view' && (
                  <button onClick={() => handlePrint(formData)} className="btn-secondary flex items-center gap-2">
                    <Printer size={16} /> Print Quote
                  </button>
                )}
                {modalType === 'view' && formData.status === 'Active' && (
                  <button onClick={handleAccept} className="btn-primary bg-success hover:bg-success/90 border-success">Accept & Generate Order</button>
                )}
                {(modalType === 'add' || modalType === 'edit') && <button onClick={handleSave} className="btn-primary">Finalize Procurement Offer</button>}
              </div>
            </div>
          )}
        </div>
      </Modal>

            </div>

      {/* Premium Institutional Quote Print Template */}
      <div className="hidden print-quote-container bg-white text-black font-sans">
        {selectedQuote && (
          <div className="w-full flex-1 flex flex-col">
            {/* Sovereign Header */}
            <div className="flex justify-between items-start border-b-[3px] border-black pb-4 mb-4 print-section">
              <div className="flex items-center gap-5">
                {/* Logo removed per user request - watermark used instead */}
                <div>
                  <h1 className="text-xl font-black italic uppercase tracking-tighter leading-none">ZANEZION</h1>
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] mt-0.5 opacity-80">Institutional Sourcing & Supply Chain</p>
                  <div className="mt-1.5 text-[7px] font-bold uppercase text-gray-400 tracking-widest leading-none">
                    Nassau, Bahamas | Sovereign HQ | Procurement Division
                  </div>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-black text-black tracking-tighter italic border-b border-black inline-block mb-1 uppercase">Official Quote</h2>
                <p className="text-[9px] font-black text-gray-400 mt-0.5">PROTOCOL ID: {selectedQuote.id}</p>
                <p className="text-[7px] font-black uppercase tracking-widest leading-none">ISSUED. {(selectedQuote.created_at || selectedQuote.date)?.split('T')[0] || 'N/A'}</p>
              </div>
            </div>

            {/* Counterparty & Status Section */}
            <div className="grid grid-cols-2 gap-8 mb-6 px-1 print-section">
              <div className="border-l-2 border-black pl-4">
                <p className="text-[6px] font-black uppercase tracking-widest opacity-40 mb-0.5 underline italic">Supply Partner:</p>
                <p className="text-base font-black italic tracking-tight uppercase leading-tight">
                  {typeof selectedQuote.vendor === 'object' && selectedQuote.vendor !== null 
                    ? (selectedQuote.vendor.companyName || selectedQuote.vendor.name || selectedQuote.vendor.vendor_name || 'Unknown Provider') 
                    : (selectedQuote.vendor_name || selectedQuote.vendor || 'Unknown Provider')}
                </p>
                <p className="text-[8px] text-gray-500 mt-0.5 font-medium leading-tight italic">Strategic Sourcing Partner</p>
                <p className="text-[7px] font-black mt-1 text-gray-400">REGISTRY: {selectedQuote.vendorId || 'ZN-VND-EXT'}</p>
              </div>
              <div className="text-right">
                <div className="inline-block bg-black text-white px-3 py-1 rounded-sm transform -skew-x-12">
                  <p className="text-[8px] font-black uppercase tracking-widest skew-x-12 leading-none">Status: {selectedQuote.status}</p>
                </div>
                <div className="mt-2">
                  <p className="text-[6px] font-black uppercase tracking-widest opacity-40 mb-0.5 leading-none">Lead Time:</p>
                  <p className="text-sm font-black italic uppercase leading-none">{selectedQuote.leadTime || 'Immediate Fulfillment'}</p>
                </div>
              </div>
            </div>

            {/* High-Resolution Itemized Ledger */}
            <div className="mb-6 print-section">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-y border-black">
                    <th className="text-left py-2 px-2 text-[8px] font-black uppercase tracking-widest">Description of Sourcing / Service Protocol</th>
                    <th className="text-center py-2 px-2 text-[8px] font-black uppercase tracking-widest w-16">Qty</th>
                    <th className="text-right py-2 px-2 text-[8px] font-black uppercase tracking-widest w-32">Valuation (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizeQuoteItems(selectedQuote.items).map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-3 px-2">
                        <div className="flex flex-col gap-0.5">
                          <p className="font-black text-sm italic tracking-tight uppercase leading-tight">{item.name}</p>
                          <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest italic leading-none">Institutional Asset Category</p>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2 font-black italic text-xs opacity-40 leading-none">{item.qty || 1}</td>
                      <td className="text-right py-3 px-2">
                        <span className="text-sm font-black tracking-tighter">
                          {selectedQuote.quote_type === 'vendor_request' || selectedQuote.quoteType === 'vendor'
                            ? 'N/A'
                            : `$${(parseFloat(item.price || 0) * parseInt(item.qty || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Totals & Verification */}
            <div className="flex justify-end mb-6 pr-2 print-section">
              <div className="w-64">
                <div className="flex justify-between items-center py-1.5 border-t border-black mb-1.5">
                  <p className="text-[8px] font-black uppercase tracking-tighter opacity-100 italic">Subtotal</p>
                  <span className="text-sm font-bold italic">
                    {selectedQuote.quote_type === 'vendor_request' || selectedQuote.quoteType === 'vendor'
                      ? 'N/A'
                      : `$${Number(selectedQuote.total_amount || selectedQuote.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-black text-white rounded-none">
                  <div className="flex flex-col">
                    <p className="text-[6px] font-black uppercase tracking-widest opacity-60">Total Offer Value</p>
                    <p className="text-[7px] font-bold leading-none mt-0.5">Fixed Registry Price</p>
                  </div>
                  <h3 className="text-xl font-black italic tracking-tighter">
                    {selectedQuote.quote_type === 'vendor_request' || selectedQuote.quoteType === 'vendor'
                      ? 'N/A'
                      : `$${Number(selectedQuote.total_amount || selectedQuote.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD`}
                  </h3>
                </div>
                <p className="text-[6px] text-gray-400 font-bold italic mt-1.5 text-right uppercase tracking-widest">Valid Until: {(selectedQuote.validity_date || selectedQuote.validity)?.split('T')[0]}</p>
              </div>
            </div>

            {/* Legal & Sovereign Terms */}
            <div className="p-4 bg-gray-50 border-l-[6px] border-black italic print-section mb-6">
              <h4 className="text-[8px] font-black uppercase tracking-[0.05em] mb-2 text-black underline leading-none">Terms of Procurement Offer</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-[6px] text-gray-400 leading-normal uppercase font-bold text-justify">
                  1. <strong>Valuation Thresholds:</strong> This quote is calculated based on current asset indices and is valid strictly until the maturation date.
                  2. <strong>Clearing:</strong> All lead times are institutional estimates subject to logistical throughput efficiency.
                </div>
                <div className="text-[6px] text-gray-400 leading-normal uppercase font-bold text-justify">
                  3. <strong>Jurisdiction:</strong> Governance is restricted to the sovereign laws of the Commonwealth of the Bahamas.
                  4. <strong>Asset Assurance:</strong> All assets verified via master registry for authenticity and jurisdictional compliance.
                </div>
              </div>
            </div>

            {/* Footer Authenticator */}
            <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-end print-section">
              <div>
                <p className="text-[6px] font-black uppercase tracking-[0.2em] opacity-30 mb-0.5 italic">Authorized Sourcing Signature</p>
                <div className="relative">
                  <div className="w-48 h-[1px] bg-black/20" />
                  <p className="absolute -top-3 left-1 font-black italic text-gray-300 text-[10px] opacity-20 select-none uppercase tracking-tighter leading-none">Chief Procurement Officer</p>
                </div>
                <p className="text-[7px] font-black mt-1.5 uppercase tracking-widest leading-none">Sourcing Division | ZANEZION</p>
              </div>
              <div className="text-right">
                <p className="text-[6px] font-black uppercase tracking-[0.3em] opacity-30 mb-0.5">HASH: ZZ-QUO-{Date.now().toString(16).slice(-6).toUpperCase()}</p>
                <p className="text-[8px] font-black tracking-tighter italic leading-none">VERIFIED PROTOCOL v3.0 // NASSAU HQ</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quotes;
