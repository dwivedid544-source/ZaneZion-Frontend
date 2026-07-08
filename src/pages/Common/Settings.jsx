import React, { useState, useEffect, useMemo } from 'react';
import { swalSuccess, swalError, swalWarning } from '../../utils/swal';
import { User, Shield, Bell, Globe, CreditCard, Save, Lock, RotateCcw, Truck, DollarSign, Camera, Plus, Trash2 } from 'lucide-react';

import { useData } from '../../context/GlobalDataContext';
import { normalizeRole } from '../../utils/authUtils';
import { API_BASE_URL } from '../../utils/apiHelpers.js';


function pickAvatarUrl(user) {
  if (!user || typeof user !== 'object') return '';
  return (
    user.avatarUrl ||
    user.avatar_url ||
    user.photo ||
    user.profile_photo ||
    user.profilePhoto ||
    user.image ||
    ''
  );
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Tabs shown by role (`localStorage.userRole` + normalized role). */
const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile', icon: User, roles: ['superadmin', 'admin', 'client', 'saas_client', 'operations', 'logistics', 'procurement', 'inventory', 'concierge', 'finance', 'field_staff'] },
  { id: 'logistics', label: 'Delivery pricing', icon: Truck, roles: ['superadmin', 'admin', 'logistics'] },
  { id: 'pricing', label: 'Pricing Control', icon: DollarSign, roles: ['superadmin', 'admin'] },
  { id: 'security', label: 'Security', icon: Lock, roles: ['superadmin', 'admin', 'client', 'saas_client', 'operations', 'logistics', 'procurement', 'inventory', 'concierge', 'finance', 'field_staff'] },
  { id: 'branding', label: 'Branding', icon: Globe, roles: ['superadmin', 'admin', 'client', 'saas_client'] },
  { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['superadmin', 'admin', 'client', 'saas_client'] },
  { id: 'billing', label: 'Billing', icon: CreditCard, roles: ['superadmin', 'admin', 'client', 'saas_client'] },
];

const Settings = () => {
  const { currentUser, setCurrentUser, updateUser, deliveryPricing, setDeliveryPricing, updateDeliveryTiers, shippingModePricing, updateShippingModePricing, clients, updateClientBranding, systemSettings, fetchSystemSettings, setSystemSettings } = useData();
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(() => ({
    ...currentUser,
    avatarUrl: pickAvatarUrl(currentUser),
  }));
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  // Get current client data if it's a client
  const clientData = ['client', 'saas_client'].includes(normalizeRole(currentUser?.role)) ? clients.find(c => c.id === (currentUser?.clientId || currentUser?.company_id)) : null;

  const [branding, setBranding] = useState({
    businessName: '',
    tagline: '',
    logo: ''
  });

  useEffect(() => {
    const role = normalizeRole(currentUser?.role);
    if (['superadmin', 'admin'].includes(role) && systemSettings?.branding) {
      // Admin/superadmin: load branding from system settings (DB)
      const b = systemSettings.branding;
      setBranding({
        businessName: b.businessName || '',
        tagline: b.tagline || '',
        logo: b.logo || ''
      });
    } else if (clientData) {
      // Client: load from client record
      setBranding({
        businessName: clientData.business_name || '',
        tagline: clientData.tagline || '',
        logo: clientData.logo_url || ''
      });
    }
  }, [clientData, systemSettings?.branding, currentUser?.role]);

  const avatarKey = pickAvatarUrl(currentUser || {});

  useEffect(() => {
    if (!currentUser?.id) return;
    setProfile({
      ...currentUser,
      avatarUrl: pickAvatarUrl(currentUser) || '',
    });
  }, [
    currentUser?.id,
    currentUser?.name,
    currentUser?.email,
    currentUser?.phone,
    currentUser?.location,
    currentUser?.role,
    currentUser?.avatar_url,
    currentUser?.photo,
    avatarKey,
  ]);

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    pushNotifications: false,
    orderUpdates: true,
    securityLogs: true
  });
  const [shippingCharges, setShippingCharges] = useState({
    Road: Number(shippingModePricing?.Road ?? 0),
    Sea: Number(shippingModePricing?.Sea ?? 150),
    Air: Number(shippingModePricing?.Air ?? 300),
  });

  const [pricingSettings, setPricingSettings] = useState({
    chauffeur_base_price: '0.00',
    delivery_base_price: '0.00',
    pickup_charges: '0.00',
    per_km_charges: '0.00'
  });

  const fetchPricing = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/system`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setPricingSettings({
          chauffeur_base_price: data.data.chauffeur_base_price || '50.00',
          delivery_base_price: data.data.delivery_base_price || '25.00',
          pickup_charges: data.data.pickup_charges || '10.00',
          per_km_charges: data.data.per_km_charges || '2.50'
        });
      }
    } catch (err) {
      console.error('Fetch pricing error:', err);
    }
  };

  const savePricing = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/settings/system`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pricingSettings)
      });
      const data = await response.json();
      if (data.success) {
        swalSuccess('Pricing Updated', 'Operational price controls have been synchronized.');
      }
    } catch (err) {
      swalError('Update Failed', 'Internal terminal error during sync.');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/user/notifications`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  useEffect(() => {
    if (activeTab === 'pricing') {
      fetchPricing();
    } else if (activeTab === 'notifications') {
      fetchNotifications();
    }
  }, [activeTab]);

  useEffect(() => {
    setShippingCharges({
      Road: Number(shippingModePricing?.Road ?? 0),
      Sea: Number(shippingModePricing?.Sea ?? 150),
      Air: Number(shippingModePricing?.Air ?? 300),
    });
  }, [shippingModePricing]);

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      swalWarning('Invalid file', 'Please choose an image (JPG, PNG, WebP, or GIF).');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      swalWarning('File too large', 'Please use an image under 2 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      setProfile((p) => ({ ...p, avatarUrl: dataUrl, avatar_url: dataUrl }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearAvatar = () => {
    setProfile((p) => ({ ...p, avatarUrl: '', avatar_url: null }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const avatarStr = String(profile.avatarUrl || profile.avatar_url || '').trim();
      const payload = {
        ...currentUser,
        ...profile,
        id: currentUser.id,
        avatar: avatarStr || undefined,
      };
      const success = await updateUser(payload);
      if (success) {
        swalSuccess('Profile Updated', 'Your profile was updated.');
      }
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new) {
      swalWarning('Missing Fields', 'Please enter current and new passwords.');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      swalWarning('Mismatch', 'New passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new })
      });
      const data = await response.json();

      if (data.success) {
        setPasswords({ current: '', new: '', confirm: '' });
        swalSuccess('Password changed', 'Your password was successfully updated.');
      } else {
        swalError('Update Failed', data.message || 'Could not update password.');
      }
    } catch (error) {
      console.error("Password change failed:", error);
      swalError('Error', 'An unexpected error occurred while saving.');
    }
  };



  const tabs = useMemo(() => {
    const stored = localStorage.getItem('userRole') || '';
    const normalized = normalizeRole(currentUser?.role || stored);
    const roles = new Set([stored, normalized].filter(Boolean));
    if (normalized === 'admin') roles.add('superadmin');
    return SETTINGS_TABS.filter((tab) => [...roles].some((r) => tab.roles.includes(r)));
  }, [currentUser?.role]);

  useEffect(() => {
    if (tabs.length === 0) return;
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  return (
    <div className="w-full max-w-full min-w-0 pb-14 pt-0 sm:pt-1 animate-in fade-in duration-700 overflow-x-hidden">
      <div className="w-full max-w-[1400px] mx-auto space-y-5 md:space-y-6 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black font-heading tracking-tight text-white break-words">Settings</h1>
          <p className="text-secondary max-w-xl text-sm font-medium leading-relaxed opacity-80 mt-2">
            Update your profile, security, and preferences.
          </p>
        </div>

        <div className="w-full min-w-0 space-y-6 lg:space-y-8">
          <div className="glass-card p-2 sm:p-3 shadow-lg shadow-black/40 min-w-0">
            <nav className="flex flex-wrap gap-2 min-w-0" aria-label="Settings sections">
              {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-sm font-bold transition-all duration-300 ${activeTab === tab.id
                      ? 'bg-accent text-black shadow-lg shadow-accent/20'
                      : 'text-secondary bg-white/[0.04] hover:bg-white/10 hover:text-white border border-transparent'
                      }`}
                  >
                    <tab.icon size={16} className={activeTab === tab.id ? 'text-black' : 'text-accent'} />
                    <span>{tab.label}</span>
                  </button>
              ))}
            </nav>
            {tabs.length === 0 && (
              <p className="px-3 py-2 text-sm text-secondary">No settings are available for your account role.</p>
            )}
          </div>

          <div className="w-full min-w-0">
          {activeTab === 'profile' && (
              <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-w-0">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 min-w-0">
                  {/* Left Column: Avatar and Quick Info */}
                  <div className="xl:col-span-1 space-y-6 min-w-0">
                    <div className="glass-card p-6 md:p-8 flex flex-col items-center text-center">
                      <input
                        type="file"
                        id="settings-avatar-upload"
                        className="sr-only"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleAvatarFile}
                      />
                      <div className="relative mb-4">
                        <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-tr from-accent/20 to-accent/5 border-2 border-accent/20 rounded-full flex items-center justify-center text-accent font-heading text-5xl md:text-6xl shadow-xl overflow-hidden">
                          {(profile.avatarUrl || profile.avatar_url) ? (
                            <img
                              src={profile.avatarUrl || profile.avatar_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{profile.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'ZN'}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => document.getElementById('settings-avatar-upload')?.click()}
                          className="absolute bottom-1 right-1 p-2.5 rounded-full bg-accent text-black shadow-lg hover:brightness-105 active:scale-95 transition-all"
                          title="Upload photo"
                          aria-label="Upload profile photo"
                        >
                          <Camera size={18} />
                        </button>
                      </div>
                      {(profile.avatarUrl || profile.avatar_url) && (
                        <button
                          type="button"
                          onClick={clearAvatar}
                          className="text-[10px] font-bold uppercase tracking-wider text-secondary hover:text-white mb-2 transition-colors"
                        >
                          Remove photo
                        </button>
                      )}
                      <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">{profile.name}</h2>
                      <p className="text-accent text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{String(profile.role?.name || profile.role || '')}</p>
                    </div>
                  </div>
                  
                  {/* Right Column: Detailed Info Form */}
                  <div className="xl:col-span-2 min-w-0">
                    <div className="glass-card p-5 sm:p-6 md:p-8 lg:p-10 bg-gradient-to-br from-card to-background min-w-0 overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 md:mb-10 gap-4 pb-6 border-b border-border/50 min-w-0">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent shadow-inner shrink-0">
                            <User size={24} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">Account</h3>
                            <p className="text-xs text-secondary mt-0.5 opacity-70">Profile details</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-6 min-w-0">
                        <div className="space-y-2 group min-w-0">
                          <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-2 group-focus-within:text-accent transition-colors">
                            Name
                          </label>
                          <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            className="w-full min-w-0 max-w-full box-border bg-black/20 border border-white/10 rounded-xl px-4 sm:px-5 py-3 text-sm focus:border-accent outline-none font-semibold transition-all focus:ring-4 focus:ring-accent/5 text-white"
                          />
                        </div>
                        <div className="space-y-2 group min-w-0">
                          <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-2 group-focus-within:text-accent transition-colors">
                            Email
                          </label>
                          <input
                            type="email"
                            value={profile.email}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                            className="w-full min-w-0 max-w-full box-border bg-black/20 border border-white/10 rounded-xl px-4 sm:px-5 py-3 text-sm focus:border-accent outline-none font-semibold transition-all focus:ring-4 focus:ring-accent/5 text-white"
                          />
                        </div>
                        <div className="space-y-2 group min-w-0">
                          <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-2 group-focus-within:text-accent transition-colors">
                            Location
                          </label>
                          <input
                            type="text"
                            value={profile.location}
                            onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                            className="w-full min-w-0 max-w-full box-border bg-black/20 border border-white/10 rounded-xl px-4 sm:px-5 py-3 text-sm focus:border-accent outline-none font-semibold transition-all focus:ring-4 focus:ring-accent/5 text-white"
                          />
                        </div>
                        <div className="space-y-2 group min-w-0">
                          <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-2 group-focus-within:text-accent transition-colors">
                            Role
                          </label>
                          <div className="w-full min-w-0 max-w-full box-border bg-accent/[0.03] border border-accent/20 rounded-xl px-4 sm:px-5 py-3 text-xs text-accent font-black flex flex-wrap items-center gap-2">
                            <Shield size={14} className="shrink-0" />
                            <span className="tracking-wider truncate">{String(profile.role?.name || profile.role || '').toUpperCase()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-10 md:mt-12 flex justify-end pt-8 border-t border-white/5 min-w-0">
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="btn-primary flex items-center justify-center gap-3 px-6 sm:px-8 py-3 text-xs shadow-xl shadow-accent/10 hover:scale-[1.02] active:scale-95 transition-all w-full sm:w-auto shrink-0"
                        >
                          {isSaving ? 'Saving...' : <><Save size={16} /> Save changes</>}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'logistics' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="glass-card p-4 sm:p-6 md:p-8 lg:p-10 min-w-0">

                  <div className="mb-8 md:mb-10 min-w-0">
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold font-heading flex flex-wrap items-center gap-3 sm:gap-4 text-white">
                      <Truck size={28} className="text-accent shrink-0" /> <span>Delivery pricing by distance</span>
                    </h3>
                    <p className="text-secondary mt-2 max-w-2xl text-sm font-medium opacity-70">
                      Set price tiers for each kilometer range.
                    </p>
                  </div>

                  <div className="mb-8 p-4 sm:p-6 border border-accent/20 rounded-2xl bg-accent/[0.04]">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-accent">Shipping mode charges</h4>
                        <p className="text-xs text-secondary mt-1">Super Admin can manually set Road / Sea / Air charges used in customer checkout.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {['Road', 'Sea', 'Air'].map((mode) => (
                        <div key={mode} className="space-y-2">
                          <label className="text-[9px] font-black text-muted uppercase tracking-widest">{mode} charge</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent font-black text-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={shippingCharges[mode]}
                              onChange={(e) => setShippingCharges((prev) => ({ ...prev, [mode]: e.target.value }))}
                              className="bg-black/40 border border-white/10 rounded-lg pl-7 pr-3 py-2.5 w-full text-sm font-black text-white focus:border-accent outline-none transition-all"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={async () => {
                          const payload = {
                            Road: Number(shippingCharges.Road) || 0,
                            Sea: Number(shippingCharges.Sea) || 0,
                            Air: Number(shippingCharges.Air) || 0,
                          };
                          await updateShippingModePricing(payload);
                          swalSuccess('Shipping charges updated', 'Road / Sea / Air pricing has been saved.');
                        }}
                        className="btn-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest"
                      >
                        Save shipping charges
                      </button>
                    </div>
                  </div>

                  <div className="md:hidden space-y-3 min-w-0">
                    {deliveryPricing.map((tier) => (
                      <div key={tier.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3 min-w-0">
                        <div className="flex justify-between items-center text-[9px] font-black text-muted uppercase tracking-wider">
                          <span>Min / Max (km)</span>
                          <button
                            type="button"
                            onClick={async () => {
                              const updated = deliveryPricing.filter(p => p.id !== tier.id);
                              const validatedTiers = updated.map(t => ({
                                id: Number(t.id),
                                min: Number(t.min) || 0,
                                max: Number(t.max) || 0,
                                price: String(t.price || '0')
                              }));
                              await updateDeliveryTiers(validatedTiers);
                            }}
                            className="text-danger hover:underline text-[10px] uppercase font-black tracking-widest"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-white font-bold text-sm">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              value={tier.min}
                              onChange={(e) => {
                                const newMin = e.target.value;
                                setDeliveryPricing(deliveryPricing.map(p => p.id === tier.id ? { ...p, min: newMin } : p));
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 w-full text-sm font-black text-white focus:border-accent outline-none"
                              placeholder="Min"
                            />
                          </div>
                          <span className="text-secondary font-medium">→</span>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              value={tier.max}
                              onChange={(e) => {
                                const newMax = e.target.value;
                                setDeliveryPricing(deliveryPricing.map(p => p.id === tier.id ? { ...p, max: newMax } : p));
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 w-full text-sm font-black text-white focus:border-accent outline-none"
                              placeholder="Max"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-muted uppercase tracking-widest block mb-1.5">Price rate</label>
                          <div className="relative w-full max-w-full min-w-0">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent font-black text-sm">$</span>
                            <input
                              type="number"
                              value={tier.price}
                              onChange={(e) => {
                                const newPrice = e.target.value;
                                setDeliveryPricing(deliveryPricing.map(p => p.id === tier.id ? { ...p, price: newPrice } : p));
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg pl-7 pr-3 py-2.5 w-full min-w-0 text-sm font-black text-white focus:border-accent outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block space-y-3 min-w-0 overflow-x-auto">
                    <div className="grid grid-cols-12 gap-4 min-w-[560px] px-6 py-3 bg-white/5 rounded-xl text-[9px] font-black text-muted uppercase tracking-[0.2em]">
                      <div className="col-span-3">Min Radius</div>
                      <div className="col-span-3">Max Radius</div>
                      <div className="col-span-4 text-center">Price Rate</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {deliveryPricing.map((tier) => (
                      <div key={tier.id} className="grid grid-cols-12 gap-4 items-center min-w-[560px] p-4 md:p-5 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-accent/30 transition-all duration-300">
                        <div className="col-span-3">
                          <div className="relative w-full max-w-[120px] min-w-0 flex items-center gap-1.5">
                            <input
                              type="number"
                              value={tier.min}
                              onChange={(e) => {
                                const newMin = e.target.value;
                                setDeliveryPricing(deliveryPricing.map(p => p.id === tier.id ? { ...p, min: newMin } : p));
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 w-full min-w-0 text-sm font-black text-white focus:border-accent outline-none transition-all"
                            />
                            <span className="text-secondary text-xs">km</span>
                          </div>
                        </div>
                        <div className="col-span-3">
                          <div className="relative w-full max-w-[120px] min-w-0 flex items-center gap-1.5">
                            <input
                              type="number"
                              value={tier.max}
                              onChange={(e) => {
                                const newMax = e.target.value;
                                setDeliveryPricing(deliveryPricing.map(p => p.id === tier.id ? { ...p, max: newMax } : p));
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 w-full min-w-0 text-sm font-black text-white focus:border-accent outline-none transition-all"
                            />
                            <span className="text-secondary text-xs">km</span>
                          </div>
                        </div>
                        <div className="col-span-4 flex justify-center min-w-0">
                          <div className="relative w-full max-w-[120px] min-w-0">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-accent font-black text-sm">$</span>
                            <input
                              type="number"
                              value={tier.price}
                              onChange={(e) => {
                                const newPrice = e.target.value;
                                setDeliveryPricing(deliveryPricing.map(p => p.id === tier.id ? { ...p, price: newPrice } : p));
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg pl-7 pr-3 py-2 w-full min-w-0 text-sm font-black text-white focus:border-accent outline-none transition-all"
                            />
                          </div>
                        </div>
                        <div className="col-span-2 text-right shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              const updated = deliveryPricing.filter(p => p.id !== tier.id);
                              const validatedTiers = updated.map(t => ({
                                id: Number(t.id),
                                min: Number(t.min) || 0,
                                max: Number(t.max) || 0,
                                price: String(t.price || '0')
                              }));
                              await updateDeliveryTiers(validatedTiers);
                              swalSuccess('Tier Deleted', 'Delivery tier removed successfully.');
                            }}
                            className="p-2 bg-danger/10 hover:bg-danger/20 text-danger rounded-lg transition-all"
                            title="Delete Tier"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 flex justify-between items-center gap-4">
                    <button
                      type="button"
                      onClick={async () => {
                        const newId = deliveryPricing.length > 0 ? Math.max(...deliveryPricing.map(p => Number(p.id) || 0)) + 1 : 1;
                        const lastTierMax = deliveryPricing.length > 0 ? Number(deliveryPricing[deliveryPricing.length - 1].max) || 0 : 0;
                        const newTier = { id: newId, min: lastTierMax + 1, max: lastTierMax + 50, price: '10' };
                        const updatedTiers = [
                          ...deliveryPricing,
                          newTier
                        ];
                        const validatedTiers = updatedTiers.map(t => ({
                          id: Number(t.id),
                          min: Number(t.min) || 0,
                          max: Number(t.max) || 0,
                          price: String(t.price || '0')
                        }));
                        await updateDeliveryTiers(validatedTiers);
                      }}
                      className="btn-secondary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                    >
                      <Plus size={14} /> Add Tier
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const validatedTiers = deliveryPricing.map(t => ({
                          id: Number(t.id),
                          min: Number(t.min) || 0,
                          max: Number(t.max) || 0,
                          price: String(t.price || '0')
                        }));
                        await updateDeliveryTiers(validatedTiers);
                        swalSuccess('Tiered Pricing Updated', 'Delivery distance tiers have been saved.');
                      }}
                      className="btn-primary px-6 py-2.5 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-accent/20"
                    >
                      Save Tiered Pricing
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'pricing' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="glass-card p-8 md:p-10">
                  <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">Pricing Control</h3>
                      <p className="text-xs text-secondary mt-0.5 opacity-70">Master override for operational unit costs.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2 group">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-2 group-focus-within:text-accent transition-colors">
                        Chauffeur Base Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent font-black">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={pricingSettings.chauffeur_base_price}
                          onChange={(e) => setPricingSettings({ ...pricingSettings, chauffeur_base_price: e.target.value })}
                          className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-5 py-4 text-sm focus:border-accent outline-none font-bold transition-all text-white"
                        />
                      </div>
                      <p className="text-[10px] text-muted italic">Starting cost for all chauffeur requisition orders.</p>
                    </div>

                    <div className="space-y-2 group">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-2 group-focus-within:text-accent transition-colors">
                        Delivery Base Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent font-black">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={pricingSettings.delivery_base_price}
                          onChange={(e) => setPricingSettings({ ...pricingSettings, delivery_base_price: e.target.value })}
                          className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-5 py-4 text-sm focus:border-accent outline-none font-bold transition-all text-white"
                        />
                      </div>
                      <p className="text-[10px] text-muted italic">Minimum flat fee for standard logistics missions.</p>
                    </div>

                    <div className="space-y-2 group">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-2 group-focus-within:text-accent transition-colors">
                        Pickup Charges
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent font-black">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={pricingSettings.pickup_charges}
                          onChange={(e) => setPricingSettings({ ...pricingSettings, pickup_charges: e.target.value })}
                          className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-5 py-4 text-sm focus:border-accent outline-none font-bold transition-all text-white"
                        />
                      </div>
                      <p className="text-[10px] text-muted italic">Additional surcharge for off-hub collection points.</p>
                    </div>

                    <div className="space-y-2 group">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-2 group-focus-within:text-accent transition-colors">
                        Per Kilometer Charges
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent font-black">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={pricingSettings.per_km_charges}
                          onChange={(e) => setPricingSettings({ ...pricingSettings, per_km_charges: e.target.value })}
                          className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-5 py-4 text-sm focus:border-accent outline-none font-bold transition-all text-white"
                        />
                      </div>
                      <p className="text-[10px] text-muted italic">Variable rate applied to computed route distances.</p>
                    </div>
                  </div>

                  <div className="mt-12 pt-8 border-t border-white/5 flex justify-end">
                    <button
                      onClick={savePricing}
                      disabled={isSaving}
                      className="btn-primary px-10 py-4 text-xs font-black uppercase tracking-widest shadow-xl shadow-accent/20 flex items-center gap-3"
                    >
                      {isSaving ? 'Synchronizing...' : <><Save size={16} /> Deploy Price Update</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
            <div className="glass-card p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                  <Bell size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Notifications</h3>
                  <p className="text-xs text-secondary mt-0.5 opacity-70">Choose which alerts you want.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { key: 'emailAlerts', title: 'Large transaction alerts', desc: 'Email when activity exceeds high-value thresholds.', icon: DollarSign },
                  { key: 'pushNotifications', title: 'Urgent logistics updates', desc: 'Real-time notices for critical routes.', icon: Truck },
                  { key: 'orderUpdates', title: 'Order sync', desc: 'Confirmations when orders move stages.', icon: RotateCcw },
                  { key: 'securityLogs', title: 'Security summaries', desc: 'Periodic summaries of security-related events.', icon: Shield },
                ].map((item) => (
                  <div key={item.key} className={`p-5 border rounded-2xl transition-all duration-500 flex flex-col justify-between h-full group ${notifications[item.key] ? 'bg-accent/5 border-accent/20' : 'bg-white/[0.02] border-white/5'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-2.5 rounded-lg ${notifications[item.key] ? 'bg-accent/10 text-accent' : 'bg-white/5 text-secondary'}`}>
                        <item.icon size={20} />
                      </div>
                      <button
                        onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                        className={`w-12 h-6 rounded-full transition-all relative flex items-center px-1 ${notifications[item.key] ? 'bg-accent shadow-lg shadow-accent/20' : 'bg-white/10'}`}
                      >
                        <div className={`w-4 h-4 rounded-full transition-all duration-300 shadow-md ${notifications[item.key] ? 'translate-x-6 bg-black' : 'translate-x-0 bg-secondary'}`} />
                      </button>
                    </div>
                    <div>
                      <p className={`font-bold text-sm transition-colors ${notifications[item.key] ? 'text-white' : 'text-secondary'}`}>{item.title}</p>
                      <p className="text-[10px] text-secondary mt-1 leading-relaxed opacity-60">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-10 pt-8 border-t border-white/5 flex justify-end">
                <button
                  onClick={async () => {
                    try {
                      await fetch(`${API_BASE_URL}/settings/user/notifications`, {
                        method: 'PUT',
                        headers: { 
                          'Authorization': `Bearer ${localStorage.getItem('token')}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(notifications)
                      });
                      swalSuccess('Success', 'Notification preferences saved.');
                    } catch (e) {
                      swalError('Error', 'Failed to save notifications.');
                    }
                  }}
                  className="btn-primary px-8 py-3 text-xs font-black uppercase tracking-widest shadow-xl shadow-accent/20"
                >
                  Save Notifications
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="glass-card p-8 md:p-10">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                    <Lock size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Password</h3>
                    <p className="text-xs text-secondary mt-0.5 opacity-70">Change your login password.</p>
                  </div>
                </div>

                <form onSubmit={handlePasswordChange} className="max-w-2xl space-y-8">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em]">Current password</label>
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-sm focus:border-accent outline-none font-semibold transition-all text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em]">New password</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={passwords.new}
                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-sm focus:border-accent outline-none font-semibold transition-all text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em]">Confirm new password</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-sm focus:border-accent outline-none font-semibold transition-all text-white"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button type="submit" className="btn-primary px-8 py-3 text-xs w-full sm:w-auto shadow-xl shadow-accent/10">
                      Update password
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="glass-card p-8 md:p-10">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                    <Globe size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Client branding</h3>
                    <p className="text-xs text-secondary mt-0.5 opacity-70">Logo and visible name for your portal.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em]">Business name</label>
                      <input
                        type="text"
                        placeholder="e.g. Goldwynn Residences"
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-sm focus:border-accent outline-none font-semibold transition-all text-white"
                        value={branding.businessName}
                        onChange={(e) => setBranding({ ...branding, businessName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-[0.3em]">Tagline</label>
                      <input
                        type="text"
                        placeholder="e.g. Ultra-Luxury Living"
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-sm focus:border-accent outline-none font-semibold transition-all text-white"
                        value={branding.tagline}
                        onChange={(e) => setBranding({ ...branding, tagline: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-3xl bg-white/[0.01] hover:bg-white/[0.03] transition-all group">
                    <div className="relative mb-4">
                      <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl p-3 group-hover:scale-105 transition-all duration-500">
                        {branding.logo ? <img src={branding.logo} className="w-full h-full object-contain brightness-0" alt="Logo Preview" /> : <span className="text-gray-400 text-xs">No Logo</span>}
                      </div>
                    </div>
                    <input
                      type="file"
                      id="logo-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setBranding({ ...branding, logo: reader.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <button
                      onClick={() => document.getElementById('logo-upload').click()}
                      className="text-[9px] font-black uppercase tracking-[0.2em] text-accent hover:text-white transition-colors"
                    >
                      Upload logo
                    </button>
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-white/5 flex justify-end">
                  <button
                    onClick={async () => {
                      if (['client', 'saas_client'].includes(normalizeRole(currentUser?.role))) {
                        await updateClientBranding(currentUser.clientId || currentUser.company_id, branding);
                        swalSuccess('Success', 'Branding updated.');
                      } else if (['superadmin', 'admin'].includes(normalizeRole(currentUser?.role))) {
                        try {
                          const resp = await fetch(`${API_BASE_URL}/settings/system`, {
                            method: 'PUT',
                            headers: { 
                              'Authorization': `Bearer ${localStorage.getItem('token')}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ type: 'branding', data: branding })
                          });
                          const result = await resp.json();
                          if (result.success) {
                            // Keep systemSettings in sync so branding fields don't reset
                            setSystemSettings(prev => ({ ...prev, branding }));
                            swalSuccess('Saved', 'System branding updated successfully.');
                          } else {
                            swalError('Error', result.message || 'Failed to update branding.');
                          }
                        } catch (e) {
                          swalError('Error', 'Failed to update system branding.');
                        }
                      } else {
                        swalError('Access Denied', 'You do not have permission to change branding.');
                      }
                    }}
                    className="btn-primary px-10 py-3 text-xs shadow-xl shadow-accent/10"
                  >
                    Save branding
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="glass-card p-8 md:p-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4 text-accent">
                  <CreditCard size={32} className="opacity-80" />
                </div>
                <h3 className="text-xl font-bold text-white">Billing</h3>
                <p className="text-secondary text-sm mt-2 opacity-80">
                  Billing tools will be available here when connected to your payment provider.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button type="button" className="btn-primary px-6 py-3 text-xs w-full sm:w-auto opacity-60 cursor-not-allowed" disabled>Request statement</button>
                  <button type="button" className="btn-secondary px-6 py-3 text-xs w-full sm:w-auto opacity-60 cursor-not-allowed" disabled>Payment history</button>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

