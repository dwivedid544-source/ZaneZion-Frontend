import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Calendar, User, Package, ClipboardList, Plus, Trash2, Tag, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import { useData } from '../context/GlobalDataContext';
import { formatDateTimeEst } from '../utils/dateEst';
import { useDepartments } from '../hooks/api/useAdminCore';

const RequestModal = ({ isOpen, onClose, onSave, selectedRequest, modalType = 'add' }) => {
  const { currentUser, users = [], customerUsers = [], clients = [], hasMenuPermission } = useData();
  const { data: deptData } = useDepartments(1, 100, '');
  const departmentsList = deptData?.data?.departments || [];
  const defaultDeptId = departmentsList.length > 0 ? departmentsList[0].id : '';
  
  const rawRole = currentUser?.role;
  const roleStr = typeof rawRole === 'object' ? (rawRole?.name || '') : String(rawRole || '');
  const userRole = roleStr.toLowerCase().replace(/\s+/g, '_');
  const isAdmin = ['admin', 'super_admin', 'procurement', 'procurement_staff', 'operations', 'saas_client'].includes(userRole);

  const [formData, setFormData] = useState({
    requestId: 'REQ-' + Math.floor(100 + Math.random() * 900),
    items: [{ name: '', qty: 1, price: 0 }],
    requester: '',
    requester_id: null,
    requestDate: new Date().toISOString().split('T')[0],
    todayDate: new Date().toISOString().split('T')[0],
    timestamp: new Date().toLocaleTimeString(),
    status: 'Pending',
    department: ['customer', 'client', 'saas_client'].includes(userRole) ? 'Customer' : 'Operations',
    departmentId: defaultDeptId,
    connectedEntity: '',
    requestType: 'Individual' // 'Individual' or 'Company'
  });

  const [userSearch, setUserSearch] = useState('');
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (selectedRequest && (modalType === 'edit' || modalType === 'view')) {
        let normalizedItems = [];
        if (selectedRequest.items && Array.isArray(selectedRequest.items)) {
          // Deep clone each item and map database properties (itemName, quantity, estimatedCost)
          normalizedItems = selectedRequest.items.map(item => ({
            ...item,
            name: item.name || item.itemName || '',
            qty: item.qty ?? item.quantity ?? 1,
            price: item.price ?? item.estimatedCost ?? 0
          }));
        } else if (selectedRequest.item) {
          normalizedItems = [{ name: selectedRequest.item, qty: selectedRequest.qty || 1, price: selectedRequest.price || 0 }];
        } else {
          normalizedItems = [{ name: '', qty: 1, price: 0 }];
        }

        let requesterName = '';
        if (selectedRequest.requester) {
          if (typeof selectedRequest.requester === 'object') {
            requesterName = `${selectedRequest.requester.firstName || ''} ${selectedRequest.requester.lastName || ''}`.trim();
          } else {
            requesterName = selectedRequest.requester;
          }
        }

        const requesterIdVal = selectedRequest.requester_id || selectedRequest.requestedBy || (selectedRequest.requester && typeof selectedRequest.requester === 'object' ? selectedRequest.requester.id : null);

        setFormData({
          requestId: selectedRequest.id || ('REQ-' + Math.floor(100 + Math.random() * 900)),
          items: normalizedItems,
          requester: requesterName,
          requester_id: requesterIdVal,
          requestDate: selectedRequest.date || new Date().toISOString().split('T')[0],
          todayDate: selectedRequest.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          timestamp: selectedRequest.created_at?.split('T')[1]?.split('.')[0] || new Date().toLocaleTimeString(),
          status: selectedRequest.status || 'Pending',
          department: typeof selectedRequest.department === 'object' ? (selectedRequest.department?.name || 'Operations') : (selectedRequest.department || 'Operations'),
          departmentId: selectedRequest.departmentId || 1,
          connectedEntity: selectedRequest.connectedEntity || '',
          requestType: selectedRequest.requestType || 'Individual'
        });
        setUserSearch(requesterName);
      } else {
        const initialRequester = isAdmin ? '' : (currentUser?.name || '');
        const initialRequesterId = isAdmin ? null : (currentUser?.id || null);
        setFormData({
          requestId: 'REQ-' + Math.floor(100 + Math.random() * 900),
          items: [{ name: '', qty: 1, price: 0 }],
          requester: initialRequester,
          requester_id: initialRequesterId,
          requestDate: new Date().toISOString().split('T')[0],
          todayDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleTimeString(),
          status: 'Pending',
          department: ['customer', 'client', 'saas_client'].includes(userRole) ? 'Customer' : 'Operations',
          departmentId: defaultDeptId,
          connectedEntity: '',
          requestType: 'Individual'
        });
        setUserSearch(initialRequester);
      }
    }
  }, [isOpen, selectedRequest?.id, modalType, defaultDeptId]);

  const allUsers = [...users, ...customerUsers];
  const filteredUsers = allUsers.filter(u => {
    // 1. Basic search match (show all if userSearch is empty)
    const matchesSearch = !userSearch || 
                         u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
                         u.email?.toLowerCase().includes(userSearch.toLowerCase());
    if (!matchesSearch) return false;

    // Allow linking to any user found in the system to make it robust and fully functional
    return true;
  });

  const handleSelectUser = (user) => {
    setFormData({ ...formData, requester: user.name, requester_id: user.id });
    setUserSearch(user.name);
    setShowUserSuggestions(false);
  };

  const handleAddItem = () => {
    setFormData({ ...formData, items: [...formData.items, { name: '', qty: 1, price: 0 }] });
  };

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems.length ? newItems : [{ name: '', qty: 1, price: 0 }] });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = formData.items.map((itm, i) => {
        if (i === index) {
          return {
            ...itm,
            [field]: field === 'name' ? value : parseFloat(value) || 0
          };
        }
        return itm;
      });
      setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((acc, item) => acc + (item.price * item.qty), 0).toFixed(2);
  };

  const getNormalizedPayload = (statusOverride) => {
    return {
      ...formData,
      status: statusOverride || formData.status,
      total: parseFloat(calculateTotal()),
      // Backend mapping properties
      title: formData.title || formData.items[0]?.name || 'Purchase Request',
      departmentId: parseInt(formData.departmentId || defaultDeptId || 1, 10),
      priority: 'medium',
      items: formData.items.map(item => ({
        ...item,
        itemName: item.name,
        quantity: Number(item.qty) || 1,
        estimatedCost: Number(item.price) || 0,
        unit: item.unit || 'Pieces'
      }))
    };
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    onSave(getNormalizedPayload());
  };

  const handleStatusChange = (newStatus) => {
    onSave(getNormalizedPayload(newStatus));
  };

  const isView = modalType === 'view';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalType === 'add' ? "New Strategic Purchase Request" : modalType === 'edit' ? `Edit Strategic Request: ${formData.requestId}` : modalType === 'delete' ? `Discard Request: ${formData.requestId}` : `Purchase Request Transcript: ${formData.requestId}`}
    >
      {modalType === 'delete' ? (
        <div className="space-y-6">
          <p className="text-secondary">Are you sure you want to permanently discard the purchase request <span className="text-accent font-bold">{formData.requestId}</span>?</p>
          <div className="flex gap-3 justify-end pt-6 border-t border-border/50">
            <button type="button" onClick={onClose} className="btn-secondary h-11 px-8 rounded-xl font-bold uppercase text-xs">
              Cancel
            </button>
            <button type="button" onClick={() => onSave(formData)} className="btn-primary bg-danger hover:bg-danger/80 border-danger h-11 px-8 rounded-xl font-bold uppercase text-xs">
              Confirm Delete
            </button>
          </div>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
        {isView && (
          <div className="p-3 bg-accent/5 border border-accent/20 rounded-xl flex items-center gap-3">
            <ClipboardList className="text-accent" size={18} />
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest">Read-Only Audit View: Secure Protocol Active</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Requester Account Linking</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setShowUserSuggestions(true);
                  if (isAdmin) setFormData(prev => ({ ...prev, requester: e.target.value, requester_id: null }));
                }}
                onFocus={() => isAdmin && setShowUserSuggestions(true)}
                onBlur={() => setTimeout(() => setShowUserSuggestions(false), 200)}
                placeholder="Search user name (e.g. 'He' for 'Hello')..."
                className="w-full bg-background border border-border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-accent outline-none font-bold disabled:opacity-70"
                disabled={isView || !isAdmin}
                required
              />
            </div>
            {showUserSuggestions && isAdmin && (
              <div className="absolute z-[200] left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden max-h-60 overflow-y-auto backdrop-blur-xl">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectUser(u);
                      }}
                      className="w-full px-4 py-3 text-left text-[11px] font-bold hover:bg-accent hover:text-black transition-all flex items-center justify-between border-b border-white/5 last:border-0 group"
                    >
                      <div className="flex flex-col">
                        <span className="text-white group-hover:text-black transition-colors">{u.name}</span>
                        <span className="text-[9px] opacity-40 group-hover:opacity-60 transition-opacity uppercase">{u.email}</span>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full opacity-60 group-hover:bg-black/10 transition-all uppercase">{String(u.role?.name || u.role || '')}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-[10px] font-bold text-muted uppercase tracking-widest italic">
                    No eligible accounts found
                  </div>
                )}
              </div>
            )}
            {formData.requester_id && (
              <p className="text-[9px] text-green-400 font-bold uppercase mt-1 flex items-center gap-1">
                <CheckCircle size={10} /> Account Linked: #{formData.requester_id}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Asset Manifest</label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                value={formData.items.length === 1 ? (formData.items[0].name || 'New Procurement') : `${formData.items.length} Multiple Assets`}
                readOnly
                placeholder="Items specified below"
                className="w-full bg-background border border-border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:border-accent outline-none font-bold opacity-70 italic"
              />
            </div>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-muted uppercase">Line Item Specifications</label>
              {!isView && (
                <button type="button" onClick={handleAddItem} className="text-accent hover:text-accent/80 text-xs font-bold flex items-center gap-1">
                  <Plus size={14} /> Add Item
                </button>
              )}
            </div>
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="flex gap-3 items-end bg-white/5 p-3 rounded-lg border border-border/50">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] text-muted uppercase">Item Name</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:border-accent outline-none"
                      disabled={isView}
                      required
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    <label className="text-[9px] text-muted uppercase">Qty</label>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:border-accent outline-none"
                      disabled={isView}
                      required
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-[9px] text-muted uppercase">Est. Price</label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" size={12} />
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                        className="w-full bg-background border border-border rounded-lg pl-6 pr-3 py-1.5 text-xs focus:border-accent outline-none"
                        disabled={isView}
                      />
                    </div>
                  </div>
                  {!isView && (
                    <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end p-2">
              <p className="text-sm font-bold">Total Estimated: <span className="text-accent">${calculateTotal()}</span></p>
            </div>
          </div>

          <div className="space-y-1">
            <CustomDatePicker
              label="Request Date"
              selectedDate={formData.requestDate}
              onChange={(date) => setFormData({ ...formData, requestDate: date })}
              disabled={isView}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Status</label>
            {!isAdmin ? (
              <div className="w-full bg-background/50 border border-border rounded-lg px-4 py-2.5 text-sm font-bold text-white flex items-center">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-widest ${
                  String(formData.status).toLowerCase() === 'completed' || String(formData.status).toLowerCase() === 'approved'
                  ? 'bg-success/20 text-success' 
                  : String(formData.status).toLowerCase() === 'rejected'
                  ? 'bg-danger/20 text-danger'
                  : 'bg-warning/20 text-warning'
                }`}>
                  {formData.status || 'Pending'}
                </span>
              </div>
            ) : (
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-primary disabled:opacity-50"
                disabled={isView}
              >
                <option>Pending</option>
                <option>Approved</option>
                <option>Rejected</option>
                <option>Ordered</option>
                <option>Quotes Received</option>
                <option>Partial Receipt</option>
                <option>Completed</option>
              </select>
            )}
          </div>
          {formData.requestType !== 'Individual' && (
          <div className="space-y-1 text-white">
            <label className="text-[10px] font-bold text-muted uppercase">Department</label>
            <select
              value={formData.departmentId}
              onChange={(e) => {
                const deptId = e.target.value;
                const deptName = departmentsList.find(d => String(d.id) === String(deptId))?.name || 'Operations';
                setFormData({ ...formData, departmentId: deptId, department: deptName });
              }}
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold disabled:opacity-50"
              disabled={isView}
            >
              {departmentsList.length > 0 ? (
                departmentsList.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))
              ) : (
                <option value={1}>Operations (Fallback)</option>
              )}
            </select>
          </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Connected Entity / Company</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="requestType"
                  checked={formData.requestType === 'Individual'}
                  onChange={() => setFormData({ ...formData, requestType: 'Individual' })}
                  className="text-accent focus:ring-accent"
                  disabled={isView}
                />
                <span className="text-xs">Individual</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="requestType"
                  checked={formData.requestType === 'Company'}
                  onChange={() => setFormData({ ...formData, requestType: 'Company' })}
                  className="text-accent focus:ring-accent"
                  disabled={isView}
                />
                <span className="text-xs">Company</span>
              </label>
            </div>
            <input
              type="text"
              value={formData.connectedEntity}
              onChange={(e) => setFormData({ ...formData, connectedEntity: e.target.value })}
              placeholder={formData.requestType === 'Company' ? "Enter Company Name" : "Optional Reference"}
              className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold disabled:opacity-50"
              disabled={isView}
            />
          </div>
          <div className="col-span-1 md:col-span-2 p-3 bg-white/5 rounded-lg border border-border/50 text-center">
            <p className="text-[9px] font-bold text-muted uppercase tracking-widest">Submission Timestamp (Institutional Log)</p>
            <p className="text-xs font-mono text-accent">{formData.todayDate} @ {formData.timestamp}</p>
            <p className="text-[8px] text-muted mt-2 uppercase tracking-widest">Displayed in Eastern Time (US): {formatDateTimeEst(new Date().toISOString())}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-6 border-t border-border/50">
          <button type="button" onClick={onClose} className="btn-secondary h-11 px-8 rounded-xl font-bold uppercase text-xs">
            {isView ? 'Close Review' : 'Cancel'}
          </button>
          
          {isView && isAdmin && formData.status === 'Pending' && (
            <>
              <button 
                type="button" 
                onClick={() => handleStatusChange('Rejected')} 
                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 h-11 px-6 rounded-xl font-bold uppercase text-xs flex items-center gap-2 border border-red-500/30"
              >
                <XCircle size={16} /> Reject Request
              </button>
              <button 
                type="button" 
                onClick={() => handleStatusChange('Approved')} 
                className="bg-green-500/10 hover:bg-green-500/20 text-green-500 h-11 px-6 rounded-xl font-bold uppercase text-xs flex items-center gap-2 border border-green-500/30"
              >
                <CheckCircle size={16} /> Approve Request
              </button>
            </>
          )}

          {!isView && (
            <button type="submit" className="btn-primary h-11 px-8 rounded-xl font-bold uppercase text-xs">
              {modalType === 'add' ? 'Submit Request' : 'Update Strategic Request'}
            </button>
          )}
        </div>
      </form>
      )}
    </Modal>
  );
};

export default RequestModal;
