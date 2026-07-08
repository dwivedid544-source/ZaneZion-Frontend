import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import { useData } from '../../context/GlobalDataContext';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../../hooks/api/useCRM';
import { Search, Plus, Shield, ShieldCheck, Calendar, Check, X as CloseIcon, Radio, Clock, CheckCircle2, XCircle, Briefcase, Truck, MapPin, Car, FileText, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
import { swalConfirm, swalSuccess, swalWarning, swalInfo } from '../../utils/swal';
import Pagination from '../../components/Common/Pagination';
import { normalizeRole, resolvePortalRole } from '../../utils/authUtils';
import api from '../../services/api/setupAxios.js';
import Swal from 'sweetalert2';

const Users = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { leaveRequests, updateLeaveRequest, staffAssignments, addStaffAssignment, updateAssignment, fetchStaff, reviewStaff, currentUser, payHistory, fetchPayHistory, clients, fetchClients, subscriptionRequests, updateSubscriptionRequest, hasMenuPermission, cancelPersonalMembership, roles } = useData();
  const roleNormalized = normalizeRole(currentUser?.role);
  const isSuperAdmin = roleNormalized === 'superadmin';
  const isAdminOrSuper = isSuperAdmin || roleNormalized === 'admin' || roleNormalized === 'client' || roleNormalized === 'saas_client' || hasMenuPermission('Staff Management', 'can_edit') || hasMenuPermission('Staff Management', 'can_add');
  const getRoleName = (u) => (typeof u?.role === 'object' ? u.role?.name || '' : u?.role || '').toString();

  const [searchTerm, setSearchTerm] = useState('');
  const [debounceSearch, setDebounceSearch] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState('add');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', roleId: '', status: 'Active', bankingInfo: { bank: '', account: '', routing: '', method: 'Direct Deposit' } });
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [delegateFormData, setDelegateFormData] = useState({
    assigneeId: '', assignee: '', task: '', location: '', priority: 'Medium', missionType: 'General',
    passengerName: '', pickupTime: '', dropLocation: '', luggage: '', goodsDetails: '', weight: '', pickupLocation: '', deliveryLocation: ''
  });
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientFormData, setClientFormData] = useState({
    companyName: '', contactPerson: '', phone: '', plan: '',
    propertyType: '', throughput: '', addOn: '', requirements: '', password: ''
  });
  const itemsPerPage = 10;

  const { data: usersData, isLoading: isUsersLoading } = useUsers(currentPage, 100, debounceSearch);
  const rawUsersData = usersData?.data || [];
  const users = Array.isArray(rawUsersData) ? rawUsersData : (rawUsersData.users || []);

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounceSearch(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => {
    const loadData = async () => {
      if (activeTab === 'users') {
        await fetchStaff({ status: 'Active', search: debounceSearch });
      } else if (activeTab === 'pending') {
        await fetchStaff({ status: 'Pending', search: debounceSearch });
      } else if (activeTab === 'clients') {
        await fetchClients({ search: debounceSearch });
      } else {
        if (['availability', 'leave', 'documents', 'missions', 'timeLogs'].includes(activeTab)) {
          await fetchStaff();
        }
      }
      if (fetchPayHistory) fetchPayHistory();
    };
    loadData();
  }, [activeTab, currentPage, debounceSearch, fetchStaff, fetchClients, fetchPayHistory]);

  React.useEffect(() => {
    if (!isModalOpen) {
      setSearchTerm('');
    }
  }, [isModalOpen]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    setSearchTerm('');
  };

  const filteredUsers = users.filter(u => {
    const rName = (typeof u?.role === 'object' ? u.role?.name || '' : u?.role || '').toLowerCase();
    return !['customer', 'saas_client', 'business_client', 'client'].includes(rName);
  });
  const currentUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const allPossibleClients = [
    ...clients.map(c => ({ ...c, isRequest: false })),
    ...(subscriptionRequests || [])
      .filter(r => !clients.some(c => c.email === r.email))
      .map(r => ({
        ...r,
        id: `REQ-${r.id}`,
        name: r.clientName || r.name,
        client_type: 'SaaS',
        isRequest: true,
        status: 'Pending'
      }))
  ];

  const filteredClients = allPossibleClients
    .filter(c => {
      const q = searchTerm.toLowerCase();
      return (c.name || c.business_name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
    });
  const currentClients = filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getDisplayRole = (u) => {
    // Backend sometimes returns SaaS users as `admin`.
    // We must preserve access, but show `saas_client` identity in admin tables.
    const resolved = resolvePortalRole(u);
    if (resolved !== 'admin') return resolved;

    // Fallback: infer SaaS from linked workspace/client (if backend didn't include tenant/client type on user row).
    const companyId = u?.company_id ?? u?.companyId ?? u?.clientId ?? u?.client_id ?? null;
    if (companyId && Array.isArray(clients) && clients.length > 0) {
      const c = clients.find(x => String(x?.id) === String(companyId) || String(x?.client_id) === String(companyId));
      const ct = String(c?.client_type ?? c?.clientType ?? '').trim().toLowerCase();
      if (ct === 'saas') return 'saas_client';
    }
    return resolved;
  };

  const handleAction = async (type, user) => {
    setModalType(type);

    if (user.id) {
      try {
        const res = await api.get(`/users/${user.id}`);
        const fullUser = res.data?.data || user;
        setSelectedUser(fullUser);

        let parsedBankingInfo = fullUser.bankingInfo;
        if (typeof parsedBankingInfo === 'string') {
          try { parsedBankingInfo = JSON.parse(parsedBankingInfo); } catch (e) { parsedBankingInfo = {}; }
        }
        // Map backend snake_case fields → frontend form fields
        setFormData({
          ...fullUser,
          roleId: fullUser.roleId || fullUser.role?.id || '',
          // birthday comes as "2026-04-29T00:00:00.000Z" from DB, trim to date only
          birthday: fullUser.birthday ? String(fullUser.birthday).split('T')[0] : '',
          nibNumber: fullUser.nib_number || fullUser.nibNumber || '',
          vacationBalance: fullUser.vacation_balance ?? fullUser.vacationBalance ?? 0,
          employmentStatus: fullUser.employment_status || fullUser.employmentStatus || 'Full Time',
          // Flatten bank fields into bankingInfo object for the form
          bankingInfo: {
            bank: fullUser.bank_name || parsedBankingInfo?.bank || '',
            account: fullUser.account_number || parsedBankingInfo?.account || '',
            routing: fullUser.routing_number || parsedBankingInfo?.routing || '',
            method: parsedBankingInfo?.method || 'Direct Deposit',
          },
        });
      } catch (err) {
        console.error("Failed to fetch user details:", err);
        setSelectedUser(user);
        let parsedBankingInfo = user.bankingInfo;
        if (typeof parsedBankingInfo === 'string') {
          try { parsedBankingInfo = JSON.parse(parsedBankingInfo); } catch (e) { parsedBankingInfo = {}; }
        }
        setFormData({
          ...user,
          roleId: user.roleId || user.role?.id || '',
          birthday: user.birthday ? String(user.birthday).split('T')[0] : '',
          nibNumber: user.nib_number || user.nibNumber || '',
          vacationBalance: user.vacation_balance ?? user.vacationBalance ?? 0,
          employmentStatus: user.employment_status || user.employmentStatus || 'Full Time',
          bankingInfo: {
            bank: user.bank_name || parsedBankingInfo?.bank || '',
            account: user.account_number || parsedBankingInfo?.account || '',
            routing: user.routing_number || parsedBankingInfo?.routing || '',
            method: parsedBankingInfo?.method || 'Direct Deposit',
          },
        });
      }
    } else {
      setSelectedUser(null);
      // New user — empty form
      const adminRole = (roles || []).find(r => r.name === 'ADMIN');
      setFormData({
        name: '', email: '', phone: '', password: '',
        roleId: (isSuperAdmin && adminRole) ? adminRole.id : '',
        status: 'Active',
        birthday: '', nibNumber: '', vacationBalance: 0,
        employmentStatus: 'Full Time',
        bankingInfo: { bank: '', account: '', routing: '', method: 'Direct Deposit' },
      });
    }

    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (modalType === 'add') {
      if (!formData.name || !formData.email || !formData.password) {
        swalWarning('Validation Error', 'Name, Email and Password are required.');
        return;
      }
      if (formData.name.length < 2) {
        swalWarning('Validation Error', 'Name must be at least 2 characters.');
        return;
      }
      if (formData.password.length < 6) {
        swalWarning('Validation Error', 'Password must be at least 6 characters.');
        return;
      }
      let roleIdToSubmit = formData.roleId;
      if (!roleIdToSubmit) {
        swalWarning('Validation Error', 'Please select a role.');
        return;
      }

      if (formData.birthday && new Date(formData.birthday) > new Date()) {
        swalWarning('Validation Error', 'Birthday cannot be in the future.');
        return;
      }
      if (formData.phone && !/^\d+$/.test(formData.phone)) {
        swalWarning('Validation Error', 'Phone number must contain only numeric characters.');
        return;
      }
      if (formData.vacationBalance < 0) {
        swalWarning('Validation Error', 'Vacation balance cannot be negative.');
        return;
      }
      try {
        const payload = { ...formData, roleId: Number(roleIdToSubmit), tenantId: currentUser?.tenantId || 1 };
        const rawCompanyId = payload.company_id ?? payload.companyId;
        const parsedCompanyId = Number(rawCompanyId);
        if (
          rawCompanyId == null ||
          String(rawCompanyId).trim() === '' ||
          !Number.isFinite(parsedCompanyId) ||
          Number.isNaN(parsedCompanyId) ||
          parsedCompanyId <= 0
        ) {
          delete payload.company_id;
          delete payload.companyId;
        } else {
          payload.company_id = parsedCompanyId;
          payload.companyId = parsedCompanyId;
        }

        // Duplicate fields in snake_case for maximum compatibility
        if (formData.vacationBalance !== undefined) {
          payload.vacation_balance = Number(formData.vacationBalance);
          payload.vacationBalance = Number(formData.vacationBalance);
        }
        if (formData.nibNumber !== undefined) {
          payload.nib_number = formData.nibNumber;
          payload.nibNumber = formData.nibNumber;
        }
        if (formData.employmentStatus !== undefined) {
          payload.employment_status = formData.employmentStatus;
          payload.employmentStatus = formData.employmentStatus;
        }
        if (formData.bankingInfo !== undefined) {
          payload.banking_info = formData.bankingInfo;
          payload.bankingInfo = formData.bankingInfo;
        }

        // Sanitize payload: remove null values to prevent production backend validation failures
        Object.keys(payload).forEach(key => {
          if (payload[key] === null) {
            delete payload[key];
          }
        });

        await createMutation.mutateAsync(payload);
        setIsModalOpen(false);
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.message || 'An error occurred';
        swalWarning('Failed to Register User', errorMsg);
      }
    } else if (modalType === 'edit') {
      if (formData.name && formData.name.length < 2) {
        swalWarning('Validation Error', 'Name must be at least 2 characters.');
        return;
      }
      if (formData.password && formData.password.length < 6) {
        swalWarning('Validation Error', 'Password must be at least 6 characters.');
        return;
      }
      if (formData.birthday && new Date(formData.birthday) > new Date()) {
        swalWarning('Validation Error', 'Birthday cannot be in the future.');
        return;
      }
      if (formData.phone && !/^\d+$/.test(formData.phone)) {
        swalWarning('Validation Error', 'Phone number must contain only numeric characters.');
        return;
      }
      if (formData.vacationBalance < 0) {
        swalWarning('Validation Error', 'Vacation balance cannot be negative.');
        return;
      }
      try {
        const mergedData = { ...selectedUser, ...formData };

        // Duplicate fields in snake_case for maximum compatibility
        if (formData.vacationBalance !== undefined) {
          mergedData.vacation_balance = Number(formData.vacationBalance);
          mergedData.vacationBalance = Number(formData.vacationBalance);
        }
        if (formData.nibNumber !== undefined) {
          mergedData.nib_number = formData.nibNumber;
          mergedData.nibNumber = formData.nibNumber;
        }
        if (formData.employmentStatus !== undefined) {
          mergedData.employment_status = formData.employmentStatus;
          mergedData.employmentStatus = formData.employmentStatus;
        }
        if (formData.bankingInfo !== undefined) {
          mergedData.banking_info = formData.bankingInfo;
          mergedData.bankingInfo = formData.bankingInfo;
        }

        // Sanitize payload: remove null values to prevent production backend validation failures
        Object.keys(mergedData).forEach(key => {
          if (mergedData[key] === null) {
            delete mergedData[key];
          }
        });

        if (mergedData.bankingInfo && typeof mergedData.bankingInfo === 'object') {
          Object.keys(mergedData.bankingInfo).forEach(bKey => {
            if (mergedData.bankingInfo[bKey] === null) {
              mergedData.bankingInfo[bKey] = '';
            }
          });
        }

        await updateMutation.mutateAsync({ id: selectedUser.id, data: mergedData });
        setIsModalOpen(false);
      } catch (err) {
        const errorMsg = err.response?.data?.message || err.message || 'An error occurred';
        swalWarning('Failed to Update User', errorMsg);
      }
    }
  };

  const handleDelegateSubmit = (e) => {
    e.preventDefault();
    const assignedUser = users.find(u => String(u.id) === String(delegateFormData.assigneeId));
    if (!assignedUser) return;

    addStaffAssignment({
      ...delegateFormData,
      assignee: assignedUser.name,
      status: 'Pending'
    });

    setDelegateFormData({
      assigneeId: '',
      assignee: '',
      task: '',
      location: '',
      priority: 'Medium',
      missionType: 'General',
      passengerName: '',
      pickupTime: '',
      dropLocation: '',
      luggage: '',
      goodsDetails: '',
      weight: '',
      pickupLocation: '',
      deliveryLocation: ''
    });
    setIsDelegateModalOpen(false);
  };

  const handleDelete = () => {
    deleteMutation.mutate(selectedUser.id);
    setIsModalOpen(false);
  };

  const columns = [
    { header: "User Name", accessor: "name" },
    { header: "Email Address", accessor: "email" },
    { header: "Phone", accessor: "phone" },
    {
      header: "Role",
      accessor: "role",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-accent" />
          <span>{row.role?.name ? row.role.name.replace(/_/g, ' ') : getDisplayRole(row)}</span>
        </div>
      )
    },
    { header: "Status", accessor: "status" },
    {
      header: "Vacation Bal.",
      accessor: "vacation_balance",
      render: (row) => {
        const bal = row.vacation_balance ?? row.vacationBalance ?? 0;
        return (
          <span className={`font-bold ${bal > 20 ? 'text-success' : bal > 0 ? 'text-warning' : 'text-danger'}`}>
            {bal} days
          </span>
        );
      }
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white">HQ Personnel</h1>
            <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em] mt-1 opacity-70">Institutional Control</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-muted">Role: {roleNormalized || '—'}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="p-3 bg-white/5 border border-white/10 rounded-xl text-secondary hover:text-white hover:bg-white/10 transition-all flex items-center justify-center group shadow-lg"
              onClick={() => setIsDelegateModalOpen(true)}
              title="Delegate Task"
            >
              <Briefcase size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            {hasMenuPermission('Staff Management', 'can_add') && (
              <button
                className="px-4 sm:px-6 py-3 bg-accent text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 whitespace-nowrap"
                onClick={() => handleAction('add', {})}
              >
                <Plus size={16} /> <span className="hidden sm:inline">New User</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex overflow-x-auto no-scrollbar">
          {[
            { id: 'users', label: 'Personnel' },
            { id: 'pending', label: 'Pending Staff' },
            isSuperAdmin ? { id: 'clients', label: 'SaaS Requests' } : null,
            { id: 'availability', label: 'Live Status' },
            { id: 'leave', label: 'Absence' },
            { id: 'timeLogs', label: 'Time Logs' },
            { id: 'documents', label: 'Vault' },
            { id: 'missions', label: 'Missions' }
          ].filter(Boolean).map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-none px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'text-secondary hover:text-white hover:bg-white/5'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>





      {activeTab === 'clients' ? (
        <div className="glass-card p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2 italic text-white uppercase">
              <Briefcase size={18} className="text-accent" /> Institutional Clients
            </h3>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Name</th>
                  <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Email</th>
                  <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Phone</th>
                  <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Type</th>
                  <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Plan</th>
                  <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Status</th>
                  <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentClients.map(client => (
                  <tr key={client.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-bold text-white">{client.companyName || client.name || client.business_name || '—'}</td>
                    <td className="p-4 text-secondary text-xs">{client.email}</td>
                    <td className="p-4 text-secondary text-xs">{client.phone || '—'}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-white/10 text-white rounded text-[9px] font-black uppercase">
                        {client.client_type === 'Business' ? 'Business Client' :
                          client.client_type === 'SaaS' ? 'SaaS Client' :
                            client.client_type || 'Personal Client'}
                      </span>
                    </td>
                    <td className="p-4 text-accent font-bold text-xs">{client.plan || '—'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${client.status === 'active' || client.status === 'Active' || client.status === 'Provisioned' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                        {client.status || 'Active'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {client.status === 'Pending' && client.client_type === 'SaaS' && isSuperAdmin && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { value: password } = await Swal.fire({
                                title: 'Set Client Password',
                                input: 'text',
                                inputLabel: `Set a login password for ${client.email}`,
                                inputValue: 'ZaneZion' + Math.floor(Math.random() * 1000) + '!',
                                showCancelButton: true,
                                confirmButtonText: 'Provision',
                                background: '#1a1a2e',
                                color: '#fff',
                                confirmButtonColor: '#C8A96A'
                              });
                              if (!password) return;
                              try {
                                await api.post(`/saas/requests/${String(client.id).replace('REQ-', '')}/provision`, { password });
                                Swal.fire({ icon: 'success', title: 'Provisioned!', html: `<div style="text-align:left;font-size:14px;color:#ccc;"><p><strong style="color:#C8A96A;">Login:</strong> ${client.email}</p><p><strong style="color:#C8A96A;">Password:</strong> ${password}</p><p style="margin-top:8px;color:#888;">Send these credentials to the client.</p></div>`, background: '#1a1a2e', color: '#fff' });
                                fetchClients();
                              } catch (err) {
                                swalWarning('Error', 'Failed to provision client');
                              }
                            }}
                            className="p-2 rounded-lg text-success hover:bg-success/10 transition-all flex items-center justify-center gap-1.5 px-3 border border-success/20 group whitespace-nowrap"
                            title="Provision Protocol"
                          >
                            <CheckCircle2 size={16} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Approve</span>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const html = `
                                <div style="text-align: left; font-size: 14px; color: #ccc;">
                                  <p><strong style="color: #C8A96A;">Company/Name:</strong> ${client.companyName || client.name || client.business_name || '—'}</p>
                                  <p><strong style="color: #C8A96A;">Contact Person:</strong> ${client.contactPerson || client.contact || '—'}</p>
                                  <p><strong style="color: #C8A96A;">Email:</strong> ${client.email}</p>
                                  <p><strong style="color: #C8A96A;">Phone:</strong> ${client.phone || '—'}</p>
                                  <p><strong style="color: #C8A96A;">Country:</strong> ${client.country || client.location || '—'}</p>
                                  <p><strong style="color: #C8A96A;">Plan:</strong> ${client.plan || '—'}</p>
                                  <p><strong style="color: #C8A96A;">Type:</strong> ${client.clientType || client.client_type || '—'}</p>
                                  <p><strong style="color: #C8A96A;">Status:</strong> <span class="uppercase font-bold ${client.status === 'active' || client.status === 'Active' || client.status === 'Provisioned' ? 'text-success' : 'text-warning'}">${client.status}</span></p>
                                </div>
                              `;
                            Swal.fire({ title: 'Client Details', html, background: '#1a1a2e', color: '#fff', confirmButtonColor: '#C8A96A' });
                          }}
                          className="p-2 text-secondary hover:text-accent transition-colors" title="View"><Eye size={16} />
                        </button>
                        {isSuperAdmin && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                let extra = {};
                                try { if (client.address && client.address.startsWith('{')) extra = JSON.parse(client.address); } catch(err){}
                                setSelectedClient(client);
                                setClientFormData({
                                  companyName: client.companyName || client.name || client.business_name || '',
                                  contactPerson: client.contactPerson || client.contact || '',
                                  phone: client.phone || '',
                                  plan: client.plan || '',
                                  propertyType: extra.propertyType || '',
                                  throughput: extra.throughput || '',
                                  addOn: extra.addOn || '',
                                  requirements: extra.requirements || '',
                                  password: ''
                                });
                                setIsClientModalOpen(true);
                              }}
                              className="p-2 text-secondary hover:text-accent transition-colors" title="Edit"><Edit size={16} />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await swalConfirm('Delete Client', 'Are you sure? This will permanently delete the client and disable their login.');
                                if (ok) {
                                  try {
                                    await api.delete('/clients/' + String(client.id).replace('REQ-', ''));
                                    swalSuccess('Deleted', 'Client has been permanently deleted.');
                                    fetchClients();
                                  } catch (err) {
                                    swalWarning('Error', 'Failed to delete client');
                                  }
                                }
                              }}
                              className="p-2 text-secondary hover:text-danger transition-colors" title="Delete"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredClients.length === 0 && (
              <div className="p-12 text-center text-secondary italic">No institutional clients found.</div>
            )}
          </div>
          <Pagination pagination={{ total: filteredClients.length, page: currentPage, limit: itemsPerPage, totalPages: Math.ceil(filteredClients.length / itemsPerPage) }} onPageChange={handlePageChange} />
        </div>
      ) : (activeTab === 'users' || activeTab === 'pending') ? (
        <div className="glass-card p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <Table
            columns={columns}
            data={currentUsers}
            actions={true}
            onView={(item) => handleAction('view', item)}
            onEdit={(item) => handleAction('edit', item)}
            onDelete={(item) => handleAction('delete', item)}
            canEdit={hasMenuPermission('Staff Management', 'can_edit')}
            canDelete={hasMenuPermission('Staff Management', 'can_delete')}
            customAction={(row) => {
              return (
                <div className="flex items-center gap-2">
                  {activeTab === 'pending' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); reviewStaff(row.id, 'Active'); }}
                      className="p-2 rounded-lg text-success hover:bg-success/10 transition-all flex items-center justify-center gap-1.5 px-3 border border-success/20 group"
                      title="Activate Protocol"
                    >
                      <CheckCircle2 size={16} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Activate</span>
                    </button>
                  )}

                  {/* Cancel membership for admins / super_admin */}
                  {((row.concierge_member || row.conciergeMembership || row.is_upgraded || (row.plan && String(row.plan).toLowerCase() !== 'free'))) && isAdminOrSuper && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await swalConfirm('Cancel membership', `Are you sure you want to cancel membership for ${row.name || row.email || 'this user'}?`);
                        if (!ok) return;
                        try {
                          await cancelPersonalMembership(row.id);
                          swalSuccess('Membership cancelled', 'The membership has been cancelled.');
                          // Refresh staff list
                          if (fetchStaff) fetchStaff();
                        } catch (err) {
                          console.error('Cancel membership failed', err);
                          swalWarning('Error', 'Failed to cancel membership.');
                        }
                      }}
                      className="p-2 rounded-lg text-warning hover:bg-warning/10 transition-all flex items-center justify-center gap-1.5 px-3 border border-warning/20"
                      title="Cancel Membership"
                    >
                      <XCircle size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Cancel</span>
                    </button>
                  )}
                </div>
              );
            }}
          />
          <Pagination pagination={{ total: filteredUsers.length, page: currentPage, limit: itemsPerPage, totalPages: Math.ceil(filteredUsers.length / itemsPerPage) }} onPageChange={handlePageChange} />
        </div>
      ) : activeTab === 'availability' ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Field Staff Available', val: users.filter(u => (getRoleName(u) === 'STAFF' || getRoleName(u) === 'FIELD_STAFF') && u.isAvailable).length, color: 'text-success', bg: 'bg-success/10 border-success/20', icon: CheckCircle2 },
              { label: 'Field Staff Offline', val: users.filter(u => (getRoleName(u) === 'STAFF' || getRoleName(u) === 'FIELD_STAFF') && !u.isAvailable).length, color: 'text-danger', bg: 'bg-danger/10 border-danger/20', icon: XCircle },
              { label: 'On Leave Today', val: leaveRequests.filter(r => r.status === 'Approved' && new Date(r.end) >= new Date()).length, color: 'text-warning', bg: 'bg-warning/10 border-warning/20', icon: Calendar },
              { label: 'Active Assignments', val: staffAssignments.filter(a => a.status === 'In Progress' || a.status === 'En Route').length, color: 'text-accent', bg: 'bg-accent/10 border-accent/20', icon: Radio },
            ].map((stat, i) => (
              <div key={i} className={`glass-card p-5 border ${stat.bg} flex items-center gap-4`}>
                <stat.icon size={28} className={stat.color} />
                <div>
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest leading-tight">{stat.label}</p>
                  <p className={`text-3xl font-black ${stat.color}`}>{stat.val}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Field Staff Cards */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Truck size={18} className="text-accent" /> Field Staff — Live Availability
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.filter(u => getRoleName(u) === 'STAFF' || getRoleName(u) === 'FIELD_STAFF' || getRoleName(u) === 'Field Staff').map(user => {
                const activeTask = staffAssignments.find(a => (a.assigneeId === String(user.id) || a.assignee === user.name) && (a.status === 'In Progress' || a.status === 'En Route' || a.status === 'Pending'));
                const onLeave = leaveRequests.find(r => (r.userId === user.id || r.name === user.name) && r.status === 'Approved' && new Date(r.end) >= new Date());
                return (
                  <div key={user.id} className={`p-5 rounded-2xl border-2 transition-all relative overflow-hidden ${onLeave ? 'border-warning/30 bg-warning/5' :
                    user.isAvailable ? 'border-success/30 bg-success/5' : 'border-danger/20 bg-white/[0.02]'
                    }`}>
                    {/* Live pulse indicator */}
                    <div className="absolute top-4 right-4">
                      <span className={`flex h-3 w-3`}>
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${onLeave ? 'bg-warning' : user.isAvailable ? 'bg-success' : 'bg-danger'
                          }`} />
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${onLeave ? 'bg-warning' : user.isAvailable ? 'bg-success' : 'bg-danger'
                          }`} />
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-black text-lg">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-bold text-white">{user.name}</p>
                        <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Field Staff</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* Availability Status */}
                      <div className={`px-3 py-2 rounded-xl flex items-center justify-between ${onLeave ? 'bg-warning/10' : user.isAvailable ? 'bg-success/10' : 'bg-white/5'
                        }`}>
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted">Status</span>
                        <span className={`text-xs font-black uppercase ${onLeave ? 'text-warning' : user.isAvailable ? 'text-success' : 'text-danger'
                          }`}>
                          {onLeave ? '🟡 On Leave' : user.isAvailable ? '🟢 Available' : '🔴 Offline'}
                        </span>
                      </div>

                      {/* Current Task */}
                      {activeTask && (
                        <div className="px-3 py-2 rounded-xl bg-accent/5 border border-accent/10">
                          <p className="text-[9px] font-black text-accent uppercase tracking-widest mb-1">Active Task</p>
                          <p className="text-[11px] text-white font-bold truncate">{activeTask.task}</p>
                          <p className="text-[9px] text-muted">{activeTask.location} • {activeTask.status}</p>
                        </div>
                      )}
                      {!activeTask && user.isAvailable && (
                        <div className="px-3 py-2 rounded-xl bg-success/5 border border-success/10">
                          <p className="text-[10px] text-success font-bold">✅ Ready for Assignment</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {users.filter(u => getRoleName(u) === 'STAFF' || getRoleName(u) === 'FIELD_STAFF' || getRoleName(u) === 'Field Staff').length === 0 && (
                <p className="col-span-3 text-center text-secondary italic py-8">No Field Staff registered.</p>
              )}
            </div>
          </div>

          {/* Operational Staff */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Briefcase size={18} className="text-accent" /> Operational Staff — Office Status
            </h3>
            <div className="space-y-3">
              {users.filter(u => getRoleName(u) === 'OPERATIONS' || getRoleName(u) === 'Operational Staff' || (!['STAFF', 'FIELD_STAFF', 'Field Staff', 'Super Admin', 'SUPER_ADMIN', 'Client'].includes(getRoleName(u)))).map(user => {
                const pendingLeave = leaveRequests.find(r => (r.userId === user.id || r.name === user.name) && r.status === 'Pending');
                const approvedLeave = leaveRequests.find(r => (r.userId === user.id || r.name === user.name) && r.status === 'Approved' && new Date(r.end) >= new Date());
                return (
                  <div key={user.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white/[0.02] border border-border rounded-2xl hover:border-accent/20 transition-all gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-black text-accent">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{user.name}</p>
                        <p className="text-[10px] text-muted uppercase font-bold">{getRoleName(user).replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                      {approvedLeave && (
                        <span className="px-3 py-1 bg-warning/10 border border-warning/20 text-warning text-[10px] font-black uppercase rounded-lg">
                          📅 On Leave: {approvedLeave.type}
                        </span>
                      )}
                      {pendingLeave && !approvedLeave && (
                        <span className="px-3 py-1 bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase rounded-lg">
                          ⏳ Leave Pending
                        </span>
                      )}
                      {!approvedLeave && !pendingLeave && (
                        <span className="px-3 py-1 bg-success/10 border border-success/20 text-success text-[10px] font-black uppercase rounded-lg">
                          ✅ On Duty
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeTab === 'documents' ? (
        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-8 text-white">
            <ShieldCheck size={20} className="text-accent" />
            <h3 className="text-lg font-bold uppercase tracking-tighter italic">Institutional Document Vault</h3>
          </div>
          <div className="space-y-4">
            {users.filter(u => getRoleName(u) !== 'BUSINESS_CLIENT' && getRoleName(u).toLowerCase() !== 'client').map(user => (
              <div key={user.id} className="p-4 sm:p-5 bg-white/[0.02] border border-border rounded-2xl flex flex-col lg:flex-row justify-between gap-6 hover:bg-white/[0.04] transition-all">
                <div className="flex items-center gap-4 min-w-[180px]">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-black shrink-0">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm truncate text-white">{user.name}</h4>
                    <p className="text-[10px] text-muted uppercase font-black tracking-widest truncate">{getRoleName(user).replace(/_/g, ' ')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 flex-1">
                  {[
                    { label: 'Passport', key: 'hasPassport' },
                    { label: 'D. License', key: 'hasLicense' },
                    { label: 'NIB Photo', key: 'hasNIB' },
                    { label: 'Resume', key: 'hasResume' },
                    { label: 'Profile Pic', key: 'hasProfilePic' },
                    { label: 'Certs', key: 'hasCerts' }
                  ].map(doc => (
                    <div key={doc.label} className="space-y-1.5 flex flex-col">
                      <p className="text-[9px] font-black text-muted uppercase tracking-tighter truncate">{doc.label}</p>
                      <label className={`w-full py-2.5 rounded-lg text-[9px] font-black uppercase border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${user[doc.key] ? 'bg-success/20 border-success/40 text-success' : 'bg-white/5 border-white/10 text-muted hover:border-accent/40 hover:text-accent'}`}>
                        <input
                          type="file"
                          className="hidden"
                          onChange={() => updateMutation.mutate({ id: user.id, data: { [doc.key]: true } })}
                        />
                        {user[doc.key] ? <CheckCircle2 size={11} /> : <Plus size={11} />}
                        {user[doc.key] ? 'Verified' : 'Upload'}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'leave' || activeTab === 'documents' ? (
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Calendar size={20} className="text-accent" /> Institutional Absence Registry
          </h3>
          <div className="space-y-4">
            {leaveRequests.map(req => (
              <div key={req.id} className="p-4 bg-white/[0.02] border border-border rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">{req.name}</h4>
                    <p className="text-[10px] text-secondary font-medium tracking-tight whitespace-nowrap">{req.type} Strategy • {req.start} to {req.end}</p>
                    <p className="text-[10px] text-muted italic mt-1 line-clamp-1">"{req.reason}"</p>
                  </div>
                </div>
                <div className="flex items-center justify-between w-full md:w-auto gap-4">
                  <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${req.status?.toLowerCase() === 'approved' ? 'bg-success/20 text-success' :
                    req.status?.toLowerCase() === 'rejected' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                    }`}>
                    {req.status}
                  </span>
                  {(req.status === 'Pending' || req.status === 'pending') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateLeaveRequest({ ...req, status: 'Approved' })}
                        className="p-2.5 bg-success/20 text-success rounded-lg hover:bg-success/40 transition-all border border-success/10"
                        title="Approve Protocol"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => updateLeaveRequest({ ...req, status: 'Rejected' })}
                        className="p-2.5 bg-danger/20 text-danger rounded-lg hover:bg-danger/40 transition-all border border-danger/10"
                        title="Decline Protocol"
                      >
                        <CloseIcon size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'missions' ? (
        <div className="glass-card p-6 border-accent/10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Briefcase size={20} className="text-accent" /> Institutional Mission Ledger
            </h3>
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Global Field Operations</span>
          </div>
          <div className="space-y-4">
            {staffAssignments.length === 0 ? (
              <div className="p-10 text-center glass-card bg-white/5">
                <p className="text-muted text-sm italic">No active missions currently delegated in the field.</p>
              </div>
            ) : (
              staffAssignments.map(asg => (
                <div key={asg.id} className="p-5 bg-white/[0.02] border border-border rounded-2xl flex flex-col gap-4 hover:border-accent/30 transition-all group">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${asg.missionType === 'Chauffeur' ? 'bg-accent/20 text-accent' :
                        asg.missionType === 'Logistics' ? 'bg-info/20 text-info' : 'bg-white/5 text-muted'
                        }`}>
                        {asg.missionType === 'Chauffeur' ? <Car size={24} /> :
                          asg.missionType === 'Logistics' ? <Truck size={24} /> : <Briefcase size={24} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-white">{asg.task}</h4>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${asg.priority === 'Critical' ? 'bg-danger/20 text-danger border border-danger/30' :
                            asg.priority === 'High' ? 'bg-warning/20 text-warning border border-warning/30' :
                              'bg-accent/20 text-accent border border-accent/30'
                            }`}>
                            {asg.priority}
                          </span>
                        </div>
                        <p className="text-[10px] text-secondary font-medium tracking-tight mt-0.5 uppercase">
                          Type: <span className="text-white font-bold">{asg.missionType || 'General'}</span> • Officer: <span className="text-accent font-bold">{asg.assignee}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${asg.status === 'Completed' ? 'bg-success/20 border-success/30 text-success' :
                        asg.status === 'In Progress' ? 'bg-info/20 border-info/30 text-info' :
                          'bg-warning/20 border-warning/30 text-warning'
                        }`}>
                        {asg.status}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Mission Parameters */}
                  {(asg.missionType === 'Chauffeur' || asg.missionType === 'Logistics') && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-white/[0.01] rounded-xl border border-white/5">
                      {asg.missionType === 'Chauffeur' ? (
                        <>
                          <div className="space-y-0.5">
                            <p className="text-[8px] text-muted uppercase font-black">Passenger</p>
                            <p className="text-[11px] text-white font-bold">{asg.passengerName || 'N/A'}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[8px] text-muted uppercase font-black">Time</p>
                            <p className="text-[11px] text-white font-bold">{asg.pickupTime || 'N/A'}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[8px] text-muted uppercase font-black">Drop-off</p>
                            <p className="text-[11px] text-white font-bold">{asg.dropLocation || 'N/A'}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[8px] text-muted uppercase font-black">Luggage</p>
                            <p className="text-[11px] text-white font-bold">{asg.luggage || 'None'}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-0.5">
                            <p className="text-[8px] text-muted uppercase font-black">Asset</p>
                            <p className="text-[11px] text-white font-bold">{asg.goodsDetails || 'N/A'}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[8px] text-muted uppercase font-black">Weight</p>
                            <p className="text-[11px] text-white font-bold">{asg.weight || 'N/A'}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[8px] text-muted uppercase font-black">Pickup</p>
                            <p className="text-[11px] text-white font-bold">{asg.pickupLocation || 'N/A'}</p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[8px] text-muted uppercase font-black">Nexus</p>
                            <p className="text-[11px] text-white font-bold">{asg.deliveryLocation || 'N/A'}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 font-mono text-[9px] text-muted border-t border-white/5 pt-3">
                    <span className="flex items-center gap-1"><Clock size={10} /> Created: {asg.requestDate || new Date().toISOString().split('T')[0]}</span>
                    <span className="flex items-center gap-1"><MapPin size={10} /> Base Hub: {asg.location || 'Global Nexus'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'timeLogs' ? (
        <div className="glass-card p-6 border-accent/10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white italic uppercase tracking-tighter">Institutional Time Registry</h3>
                <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-0.5">Audit log of all registered staff shifts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
                <FileText size={14} /> Export XLS
              </button>
            </div>
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.03] border-b border-border">
                  <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Employee Identifier</th>
                  <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Protocol Window (Start - End)</th>
                  <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Date Registry</th>
                  <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Fiscal Hours</th>
                  <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Valuation</th>
                  <th className="p-4 text-[10px] font-black text-muted uppercase tracking-widest">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payHistory.map((session, i) => (
                  <tr key={session.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent font-black text-[10px]">
                          {session.userName[0]}
                        </div>
                        <span className="text-sm font-bold text-white uppercase">{session.userName}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-medium text-secondary italic">{session.period}</span>
                    </td>
                    <td className="p-4 text-xs text-muted font-bold">{session.date}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-accent/10 text-accent rounded-lg text-xs font-black italic">{session.hours} hrs</span>
                    </td>
                    <td className="p-4 text-sm font-black text-white">{session.total}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-success/10 border border-success/20 text-success text-[9px] font-black uppercase rounded-lg">
                        {session.status || 'Verified'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View for Time Logs */}
          <div className="lg:hidden space-y-4">
            {payHistory.map((session) => (
              <div key={session.id} className="p-5 bg-white/[0.02] border border-border rounded-2xl flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-black">
                      {session.userName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-white uppercase text-sm">{session.userName}</p>
                      <p className="text-[10px] text-muted font-bold tracking-widest uppercase">{session.date}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-success/10 border border-success/20 text-success text-[9px] font-black uppercase rounded-lg">
                    {session.status || 'Verified'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 py-3 border-y border-white/5">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted uppercase font-black">Shift Window</p>
                    <p className="text-xs text-secondary italic">{session.period}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] text-muted uppercase font-black">Duration</p>
                    <p className="text-sm font-black text-accent italic">{session.hours} hrs</p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-black text-muted uppercase tracking-widest">Total Valuation</span>
                  <span className="text-lg font-black text-white">{session.total}</span>
                </div>
              </div>
            ))}
          </div>

          {payHistory.length === 0 && (
            <div className="p-12 text-center text-secondary italic glass-card border-dashed">
              No shift records found in the registry.
            </div>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {[
          { label: "Admins", val: users.filter(u => getRoleName(u).toUpperCase().includes('ADMIN')).length, icon: Shield },
          { label: "Operations", val: users.filter(u => getRoleName(u).toUpperCase().includes('OPERATIONS') || getRoleName(u).toUpperCase().includes('LEAD')).length, icon: Shield },
          { label: "Field Staff", val: users.filter(u => getRoleName(u).toUpperCase() === 'FIELD_STAFF' || getRoleName(u).toLowerCase() === 'staff').length, icon: Shield },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 border-accent/10">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted font-bold uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-3xl font-bold mt-1">{stat.val}</h3>
              </div>
              <stat.icon size={24} className="text-accent/40" />
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === 'view' ? 'User Profile' :
            modalType === 'edit' ? 'Edit User' :
              modalType === 'delete' ? 'Deactivate User' : 'Register New User'
        }
      >
        <div className="space-y-6">
          {modalType === 'delete' ? (
            <div className="space-y-4">
              <p className="text-secondary">Are you sure you want to deactivate <span className="text-primary font-bold">{selectedUser?.name}</span>? They will lose access to the platform immediately.</p>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleDelete} className="px-6 py-2 bg-danger text-white rounded-lg font-bold">Confirm Deactivation</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Full Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-mono"
                    disabled={modalType === 'view'}
                    autoComplete="new-phone-number"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Login Password <span className="text-danger">*</span></label>
                  <input
                    type="password"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-mono"
                    placeholder="••••••••"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Email Address <span className="text-danger">*</span></label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                    autoComplete="new-email"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Role <span className="text-danger">*</span></label>
                  <select
                    value={formData.roleId || ''}
                    onChange={(e) => setFormData({ ...formData, roleId: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  >
                    <option value="" disabled>Select Role...</option>
                    {(roles || [])
                      .filter(r => {
                        if (isSuperAdmin) {
                          return r.name.toUpperCase() === 'ADMIN';
                        }
                        return ['OPERATIONS', 'PROCUREMENT', 'LOGISTICS', 'INVENTORY', 'CONCIERGE', 'FIELD_STAFF', 'STAFF', 'DRIVER'].includes(r.name.toUpperCase());
                      })
                      .map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name === 'ADMIN' ? 'Admin (Internal Manager)' : r.name.replace(/_/g, ' ')}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Employment Status</label>
                  <select
                    value={formData.employmentStatus || 'Full Time'}
                    onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option>Probation</option>
                    <option>Full Time</option>
                    <option>Part Time</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Compensation Type</label>
                  <select
                    value={formData.isSalaried ? 'Salary' : 'Hourly'}
                    onChange={(e) => {
                      const isSalary = e.target.value === 'Salary';
                      setFormData({
                        ...formData,
                        isSalaried: isSalary,
                        vacationBalance: formData.vacationBalance || (isSalary ? 80 : 0)
                      });
                    }}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  >
                    <option value="Salary">Salaried</option>
                    <option value="Hourly">Hourly</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Vacation Balance (Tenure Adjusted)</label>
                  <input
                    type="text"
                    value={formData.vacationBalance ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, vacationBalance: val === '' ? '' : parseInt(val, 10) });
                    }}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-mono text-accent"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Birthday</label>
                  <input
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={formData.birthday || ''}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">NIB Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 123456789"
                    value={formData.nibNumber || ''}
                    onChange={(e) => setFormData({ ...formData, nibNumber: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-mono"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Documents Protocol</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      { label: 'Passport', field: 'hasPassport' },
                      { label: 'DL', field: 'hasLicense' },
                      { label: 'NIB Photo', field: 'hasNIB' },
                      { label: 'Resume', field: 'hasResume' }
                    ].map(doc => (
                      <label
                        key={doc.label}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight border transition-all flex items-center gap-1.5 cursor-pointer ${formData[doc.field]
                          ? 'bg-success/20 border-success text-success'
                          : 'bg-white/5 border-white/10 text-muted hover:border-accent/40'}`}
                      >
                        <input
                          type="file"
                          className="hidden"
                          disabled={modalType === 'view'}
                          onChange={() => setFormData({ ...formData, [doc.field]: true })}
                        />
                        {formData[doc.field] ? <Check size={10} /> : <Plus size={10} />}
                        {doc.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                {isSuperAdmin && (modalType === 'add' || modalType === 'edit') && (
                  <div className="col-span-1 sm:col-span-2 space-y-1 mt-4">
                    <label className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-3">Institutional Workspace (Mandatory for SaaS Staff)</label>
                    <select
                      value={formData.company_id || ''}
                      onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                      className="w-full bg-background border border-accent/20 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold text-white shadow-lg shadow-accent/5"
                    >
                      <option value="">Platform HQ (Super Admin Only)</option>
                      {clients.filter(c => c.clientType === 'SaaS' || c.client_type === 'SaaS').map(company => (
                        <option key={company.id} value={company.id}>{company.business_name || company.name} (WS-{1000 + company.id})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col-span-1 sm:col-span-2 border-t border-white/5 pt-4">
                  <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-3">Institutional Banking Protocol</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Bank Name (Optional)</label>
                  <input
                    type="text"
                    value={formData.bankingInfo?.bank || ''}
                    onChange={(e) => setFormData({ ...formData, bankingInfo: { ...formData.bankingInfo, bank: e.target.value } })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Account Identifier / IBAN</label>
                  <input
                    type="text"
                    value={formData.bankingInfo?.account || ''}
                    onChange={(e) => setFormData({ ...formData, bankingInfo: { ...formData.bankingInfo, account: e.target.value } })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Routing Number</label>
                  <input
                    type="text"
                    value={formData.bankingInfo?.routing || ''}
                    onChange={(e) => setFormData({ ...formData, bankingInfo: { ...formData.bankingInfo, routing: e.target.value } })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-bold font-mono"
                    disabled={modalType === 'view'}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted uppercase">Payment Method</label>
                  <select
                    value={formData.bankingInfo?.method || 'Direct Deposit'}
                    onChange={(e) => setFormData({ ...formData, bankingInfo: { ...formData.bankingInfo, method: e.target.value } })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:border-accent outline-none"
                    disabled={modalType === 'view'}
                  >
                    <option>Direct Deposit</option>
                    <option>Wire Transfer</option>
                    <option>Institutional Check</option>
                    <option>Stripe Payout</option>
                  </select>
                </div>
              </div>

              {modalType === 'view' && (
                <div className="mt-6 p-4 bg-white/5 rounded-xl border border-border space-y-3">
                  <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-2">Stored Details</p>
                  {[
                    { label: 'Birthday', val: formData.birthday || '—' },
                    { label: 'NIB Number', val: formData.nibNumber || '—' },
                    { label: 'Vacation Balance', val: `${formData.vacationBalance ?? 0} days` },
                    { label: 'Bank', val: formData.bankingInfo?.bank || '—' },
                    { label: 'Account No.', val: formData.bankingInfo?.account || '—' },
                    { label: 'Routing No.', val: formData.bankingInfo?.routing || '—' },
                    { label: 'Pay Method', val: formData.bankingInfo?.method || '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <ShieldCheck size={14} className="text-accent shrink-0" />
                      <span className="text-secondary w-32">{label}:</span>
                      <span className="font-bold text-white">{val}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 text-sm pt-1 border-t border-white/5">
                    <Shield size={14} className="text-accent shrink-0" />
                    <span className="text-secondary w-32">Role:</span>
                    <span className="font-bold text-white capitalize">{formData.role?.name || (roles || []).find(r => r.id === formData.roleId)?.name || 'Unknown'}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-6">
                <button onClick={() => setIsModalOpen(false)} className="btn-secondary">{modalType === 'view' ? 'Close' : 'Cancel'}</button>
                {modalType !== 'view' && <button onClick={handleSave} className="btn-primary">Save Changes</button>}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isDelegateModalOpen}
        onClose={() => setIsDelegateModalOpen(false)}
        title="Delegate Institutional Mission"
      >
        <form onSubmit={handleDelegateSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Assignee Profile <span className="text-danger">*</span></label>
              <select
                value={delegateFormData.assigneeId}
                onChange={e => setDelegateFormData({ ...delegateFormData, assigneeId: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-bold"
                required
              >
                <option value="" disabled>Select Staff Member...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} - {getRoleName(u).replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Protocol Type</label>
              <select
                value={delegateFormData.missionType || 'General'}
                onChange={e => setDelegateFormData({ ...delegateFormData, missionType: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-bold text-accent"
              >
                <option value="General">General Task</option>
                <option value="Chauffeur">Chauffeur Mission</option>
                <option value="Logistics">Logistics Mission</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Mission Description <span className="text-danger">*</span></label>
            <textarea
              value={delegateFormData.task}
              onChange={e => setDelegateFormData({ ...delegateFormData, task: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:border-accent outline-none min-h-[80px] italic"
              placeholder="Describe the primary objective..."
              required
            />
          </div>

          {delegateFormData.missionType === 'Chauffeur' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-accent/5 border border-accent/20 rounded-2xl space-y-4 overflow-hidden"
            >
              <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-2 flex items-center gap-2">
                <Shield size={12} /> Chauffeur Protocol Parameters
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase">Passenger Identity</label>
                  <input
                    type="text"
                    placeholder="Passenger Name"
                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    onChange={e => setDelegateFormData({ ...delegateFormData, passengerName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase">Deployment Time</label>
                  <input
                    type="time"
                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    onChange={e => setDelegateFormData({ ...delegateFormData, pickupTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase">Drop Destination</label>
                  <input
                    type="text"
                    placeholder="Drop-off location"
                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    onChange={e => setDelegateFormData({ ...delegateFormData, dropLocation: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase">Luggage Profile</label>
                  <input
                    type="text"
                    placeholder="e.g. 3 Suitcases"
                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    onChange={e => setDelegateFormData({ ...delegateFormData, luggage: e.target.value })}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {delegateFormData.missionType === 'Logistics' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-info/5 border border-info/20 rounded-2xl space-y-4 overflow-hidden"
            >
              <p className="text-[10px] font-black text-info uppercase tracking-widest mb-2 flex items-center gap-2">
                <Truck size={12} /> Logistics Protocol Parameters
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase">Asset Description</label>
                  <input
                    type="text"
                    placeholder="Goods details"
                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    onChange={e => setDelegateFormData({ ...delegateFormData, goodsDetails: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase">Weight/Qty Portfolio</label>
                  <input
                    type="text"
                    placeholder="e.g. 500kg / 20 Cases"
                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    onChange={e => setDelegateFormData({ ...delegateFormData, weight: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase">Pickup Registry</label>
                  <input
                    type="text"
                    placeholder="Pickup location"
                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    onChange={e => setDelegateFormData({ ...delegateFormData, pickupLocation: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted uppercase">Delivery Nexus</label>
                  <input
                    type="text"
                    placeholder="Delivery location"
                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                    onChange={e => setDelegateFormData({ ...delegateFormData, deliveryLocation: e.target.value })}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Base Operation Hub</label>
              <input
                type="text"
                value={delegateFormData.location}
                onChange={e => setDelegateFormData({ ...delegateFormData, location: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-bold"
                placeholder="e.g. LPIA Terminal"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Priority Index</label>
              <select
                value={delegateFormData.priority}
                onChange={e => setDelegateFormData({ ...delegateFormData, priority: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-bold"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-white/5 mt-4">
            <button type="button" onClick={() => setIsDelegateModalOpen(false)} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-white transition-all">Abort Protocol</button>
            <button type="submit" className="btn-primary py-3 px-8 shadow-xl shadow-accent/20">Dispatch Strategic Instruction</button>
          </div>
        </form>
      </Modal>
    
      <Modal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} title="Edit Client Protocol">
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            const extra = {
              propertyType: clientFormData.propertyType,
              throughput: clientFormData.throughput,
              addOn: clientFormData.addOn,
              requirements: clientFormData.requirements
            };
            const payload = {
              companyName: clientFormData.companyName,
              contactPerson: clientFormData.contactPerson,
              phone: clientFormData.phone,
              plan: clientFormData.plan,
              password: clientFormData.password,
              address: JSON.stringify(extra)
            };
            await api.put('/clients/' + String(selectedClient.id).replace('REQ-', ''), payload);
            swalSuccess('Protocol Executed', 'Client updated successfully.');
            setIsClientModalOpen(false);
            if (typeof fetchClients === 'function') fetchClients();
          } catch(err) {
            console.error(err);
            swalWarning('Error', 'Failed to execute protocol.');
          }
        }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted uppercase">Company / Name <span className="text-danger">*</span></label>
              <input type="text" className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={clientFormData.companyName} onChange={e => setClientFormData({...clientFormData, companyName: e.target.value})} required />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted uppercase">Contact Person</label>
              <input type="text" className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={clientFormData.contactPerson} onChange={e => setClientFormData({...clientFormData, contactPerson: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted uppercase">Phone</label>
              <input type="text" className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={clientFormData.phone} onChange={e => setClientFormData({...clientFormData, phone: e.target.value.replace(/\D/g, '')})} autoComplete="new-phone" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted uppercase">Plan</label>
              <input type="text" className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={clientFormData.plan} onChange={e => setClientFormData({...clientFormData, plan: e.target.value})} />
            </div>
          </div>
          
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl space-y-4">
            <p className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2"><Shield size={12} /> SaaS Requirements</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted uppercase">Property Type</label>
                <input type="text" className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={clientFormData.propertyType} onChange={e => setClientFormData({...clientFormData, propertyType: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted uppercase">Throughput</label>
                <input type="text" className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={clientFormData.throughput} onChange={e => setClientFormData({...clientFormData, throughput: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted uppercase">Add-On</label>
                <input type="text" className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={clientFormData.addOn} onChange={e => setClientFormData({...clientFormData, addOn: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted uppercase">Requirements</label>
                <input type="text" className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" value={clientFormData.requirements} onChange={e => setClientFormData({...clientFormData, requirements: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="space-y-1 mt-4">
            <label className="text-[10px] font-bold text-success uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={12} /> Account Provisioning (Password)</label>
            <input type="text" placeholder="Enter password to provision login access..." className="w-full bg-background border border-success/30 rounded-lg px-4 py-3 text-sm focus:border-success outline-none font-bold text-white" value={clientFormData.password} onChange={e => setClientFormData({...clientFormData, password: e.target.value})} />
            <p className="text-[9px] text-muted">If provided, this will create or update the user account for this client.</p>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-white/5 mt-4">
            <button type="button" onClick={() => setIsClientModalOpen(false)} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-white transition-all">Abort</button>
            <button type="submit" className="btn-primary py-3 px-8 shadow-xl shadow-accent/20">Update Details</button>
          </div>
        </form>
      </Modal>
</div >
  );
};

export default Users;
