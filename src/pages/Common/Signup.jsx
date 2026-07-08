import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User, Mail, Lock, Phone, Building,
  ArrowRight, ArrowLeft, CheckCircle, Upload,
  ShieldCheck, Globe, CreditCard, AlertCircle, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api/setupAxios.js';

// ─── Account type definitions ─────────────────────────────────────────────────
const ACCOUNT_TYPES = [
  {
    id: 'personal',
    label: 'Personal Account',
    subtitle: 'For individuals & general public',
    icon: User,
    color: 'bg-info',
    description: 'Order premium products from local grocery stores, track deliveries, and request package pickup/delivery support.',
    features: ['Marketplace access', 'Track own orders', 'Request chauffeur service', 'No concierge module access'],
    badge: 'Free • No signup fee',
  },
  {
    id: 'business',
    label: 'Business Account',
    subtitle: 'For registered companies & enterprises',
    icon: Building,
    color: 'bg-accent',
    description:
      'A complete business system: full portal to run your company from one dashboard — invoices to create and manage client bills, purchase orders to order from suppliers, inventory to track stock, sales, and what is left, plus exclusive concierge services (priority help and personal assistance for business users only).',
    features: [
      'Full business portal — one dashboard for the whole business',
      'Invoices — create and manage bills for your clients',
      'Purchase orders — formal orders and documents for suppliers',
      'Inventory management — stock, what sold, balances on hand',
      'Exclusive concierge services — priority support for businesses',
    ],
    badge: 'Free • Business license required',
  },
  {
    id: 'saas',
    label: 'SaaS Membership',
    subtitle: 'Subscription-based full platform access',
    icon: Globe,
    color: 'bg-success',
    description: 'Full access to the ZaneZion platform including all modules, analytics, and premium integrations.',
    features: ['Full system access', 'All modules unlocked', 'Priority support', 'Admin approval required'],
    badge: 'Signup fee required',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Input = ({ icon: Icon, label, error, ...props }) => (
  <div className="space-y-1.5">
    {label && (
      <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">
        {label}
      </label>
    )}
    <div className="relative group">
      {Icon && (
        <Icon
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors"
        />
      )}
      <input
        {...props}
        className={`w-full bg-white/5 border ${error ? 'border-danger' : 'border-border'} rounded-2xl py-3.5 ${Icon ? 'pl-11' : 'pl-4'} pr-4 text-sm text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-muted/50`}
      />
    </div>
    {error && <p className="text-danger text-[10px] font-bold uppercase">{error}</p>}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Signup = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState('choose');   // choose | saas-info | form | tac | paying | done
  const [accountType, setAccountType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [tacAccepted, setTacAccepted] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', companyName: '', businessLicense: null,
    saasSignupFeePaid: false,
  });
  const [errors, setErrors] = useState({});

  // ── Field change ──────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Min 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (accountType === 'business' && !form.companyName.trim()) errs.companyName = 'Company name is required';
    if (accountType === 'business' && !form.businessLicense) errs.businessLicense = 'Business license upload is required';
    return errs;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = validateForm();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!tacAccepted) { setApiError('You must accept the Terms & Conditions.'); return; }

    setLoading(true);
    setApiError('');

    try {
      const roleMap = { personal: 'customer', business: 'client', saas: 'saas_client' };

      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('email', form.email.trim().toLowerCase());
      fd.append('password', form.password);
      fd.append('phone', form.phone.trim());
      fd.append('accountType', accountType);
      fd.append('role', roleMap[accountType]);
      if (accountType === 'business') {
        fd.append('companyName', form.companyName.trim());
        if (form.businessLicense) fd.append('businessLicense', form.businessLicense);
      }

      await api.post('/auth/signup', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setStep('done');
    } catch (err) {
      setApiError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation helpers ────────────────────────────────────────────────────
  const selectType = (id) => {
    setAccountType(id);
    if (id === 'saas') {
      setStep('saas-info');
    } else {
      setStep('form');
    }
  };

  const goBack = () => {
    if (step === 'form' || step === 'saas-info') setStep('choose');
    else if (step === 'tac') setStep('form');
    setApiError('');
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {/* Visual side */}
      <div
        className="hidden lg:flex lg:w-[45%] relative p-14 flex-col justify-between overflow-hidden"
        style={{
          background: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.8)), url('/luxury_lifestyle_1.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-[0_0_18px_rgba(200,169,106,0.45)] overflow-hidden shrink-0 ring-2 ring-accent">
            <img src="/logo.png" alt="ZaneZion" className="w-full h-full object-contain scale-[2.4]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-white">ZaneZion</h1>
            <p className="text-[10px] text-accent font-black uppercase tracking-[0.3em]">Access The Platinum Network</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-5xl font-black text-white leading-tight tracking-tighter">
            Join The <span className="text-accent underline decoration-accent/30 lowercase italic">Platinum</span><br />Network Today
          </h2>
          <p className="text-secondary max-w-sm leading-relaxed text-base">
            Choose your account type and get the right access for personal orders or full business operations.
          </p>
          <div className="flex items-center gap-3">
            {ACCOUNT_TYPES.map(t => (
              <div
                key={t.id}
                className={`w-2.5 h-2.5 rounded-full transition-all ${accountType === t.id ? 'bg-accent scale-125' : 'bg-white/20'}`}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 border-t border-white/10 pt-8">
          <div className="flex -space-x-3">
            {['/partner_cn.png', '/partner_aura.png', '/partner_musha.png', '/partner_p2p.png'].map((src, i) => (
              <div key={i} className="w-9 h-9 rounded-full border-2 border-accent/40 bg-white overflow-hidden">
                <img src={src} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <p className="text-xs text-secondary">
            Trusted by <span className="text-white font-bold">50+ Premium Partners</span><br />Across Luxury Hospitality
          </p>
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto px-6 py-8 lg:px-14 bg-[#0a0a0a] custom-scrollbar">
        <div className="max-w-lg w-full mx-auto my-auto space-y-8 py-8">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden ring-2 ring-accent">
              <img src="/logo.png" alt="ZaneZion" className="w-full h-full object-contain scale-[2.4]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">ZaneZion</h2>
              <p className="text-[9px] text-accent font-black uppercase tracking-[0.3em]">Platinum Network</p>
            </div>
          </div>

          <AnimatePresence mode="wait">

            {/* ── STEP: CHOOSE ACCOUNT TYPE ─────────────────────────────── */}
            {step === 'choose' && (
              <motion.div key="choose" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tight">Create Account</h3>
                  <p className="text-secondary text-sm mt-1">Select the account type that best fits your needs.</p>
                </div>

                <div className="space-y-4">
                  {ACCOUNT_TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => selectType(t.id)}
                      className="w-full text-left p-5 bg-white/[0.03] border border-border rounded-2xl hover:border-accent/50 hover:bg-white/[0.06] transition-all group"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${t.color}/10 shrink-0 group-hover:scale-105 transition-transform`}>
                          <t.icon size={22} className={`${t.color.replace('bg-', 'text-')}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-black text-white text-sm">{t.label}</p>
                            <ArrowRight size={16} className="text-muted group-hover:text-accent group-hover:translate-x-1 transition-all shrink-0" />
                          </div>
                          <p className="text-secondary text-[11px] mt-0.5">{t.subtitle}</p>
                          <p className="text-muted text-[10px] mt-2 leading-relaxed">{t.description}</p>
                          <span className="inline-block mt-2 px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[9px] font-black uppercase tracking-widest text-accent">{t.badge}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <p className="text-center text-[11px] text-muted">
                  Already have an account?{' '}
                  <Link to="/login" className="text-accent hover:text-white font-bold transition-colors">Sign in here</Link>
                </p>
              </motion.div>
            )}

            {/* ── STEP: SAAS INFO ───────────────────────────────────────── */}
            {step === 'saas-info' && (
              <motion.div key="saas-info" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
                <button onClick={goBack} className="flex items-center gap-2 text-muted hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                  <ArrowLeft size={16} /> Back
                </button>

                <div className="p-6 bg-success/5 border border-success/20 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                      <Globe size={20} className="text-success" />
                    </div>
                    <div>
                      <h4 className="font-black text-white text-base uppercase tracking-tight">ZaneZion SaaS Membership</h4>
                      <p className="text-[10px] text-success font-bold uppercase tracking-widest">Full Platform Access</p>
                    </div>
                  </div>
                  <p className="text-secondary text-sm leading-relaxed">
                    The SaaS Membership gives you <strong className="text-white">complete access</strong> to the ZaneZion ecosystem — including all modules, operational dashboards, procurement tools, logistics tracking, concierge services, and premium analytics.
                  </p>
                  <ul className="space-y-2">
                    {ACCOUNT_TYPES[2].features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm text-secondary">
                        <CheckCircle size={15} className="text-success shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-5 bg-accent/5 border border-accent/20 rounded-2xl space-y-3">
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} className="text-accent" />
                    <p className="font-black text-white text-sm uppercase tracking-wide">Signup Fee Required</p>
                  </div>
                  <p className="text-secondary text-xs leading-relaxed">
                    A one-time signup fee is required to activate your SaaS membership. Payment will be processed securely before your account is submitted for admin review.
                  </p>
                  <p className="text-accent font-black text-2xl">$299 <span className="text-muted text-xs font-bold">/ one-time</span></p>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3">
                  <AlertCircle size={16} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-secondary text-xs leading-relaxed">
                    After payment, your account will be submitted for <strong className="text-white">manual admin review</strong>. You will receive a notification once approved.
                  </p>
                </div>

                <button
                  onClick={() => setStep('form')}
                  className="w-full bg-success text-black py-4 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 hover:bg-success/90 transition-all group"
                >
                  I Understand — Continue <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            {/* ── STEP: FORM ────────────────────────────────────────────── */}
            {step === 'form' && (
              <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
                <button onClick={goBack} className="flex items-center gap-2 text-muted hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                  <ArrowLeft size={16} /> Back
                </button>

                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">
                    {ACCOUNT_TYPES.find(t => t.id === accountType)?.label}
                  </h3>
                  <p className="text-secondary text-sm mt-1">Fill in your details to create your account.</p>
                </div>

                <div className="space-y-4">
                  <Input icon={User} label="Full Name *" name="name" value={form.name} onChange={handleChange} placeholder="John Doe" error={errors.name} required />
                  <Input icon={Mail} label="Email Address *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="john@example.com" error={errors.email} required />
                  <Input icon={Phone} label="Phone Number" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+1 (000) 000-0000" />

                  {accountType === 'business' && (
                    <Input icon={Building} label="Company Name *" name="companyName" value={form.companyName} onChange={handleChange} placeholder="Acme Corp Ltd." error={errors.companyName} required />
                  )}

                  <Input icon={Lock} label="Password *" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 8 characters" error={errors.password} required />
                  <Input icon={Lock} label="Confirm Password *" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat password" error={errors.confirmPassword} required />

                  {accountType === 'business' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">Business License *</label>
                      <label className={`flex items-center gap-3 p-4 bg-white/5 border ${errors.businessLicense ? 'border-danger' : 'border-border'} rounded-2xl cursor-pointer hover:border-accent/50 transition-all group`}>
                        <Upload size={18} className="text-muted group-hover:text-accent transition-colors shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {form.businessLicense ? form.businessLicense.name : 'Click to upload license document'}
                          </p>
                          <p className="text-[10px] text-muted">PDF, JPG, PNG — max 10MB</p>
                        </div>
                        {form.businessLicense && (
                          <CheckCircle size={16} className="text-success shrink-0" />
                        )}
                        <input type="file" name="businessLicense" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} className="hidden" />
                      </label>
                      {errors.businessLicense && <p className="text-danger text-[10px] font-bold uppercase">{errors.businessLicense}</p>}
                    </div>
                  )}
                </div>

                {apiError && (
                  <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl flex items-start gap-3">
                    <X size={16} className="text-danger shrink-0 mt-0.5" />
                    <p className="text-danger text-xs font-bold">{apiError}</p>
                  </div>
                )}

                <button
                  onClick={() => {
                    const errs = validateForm();
                    if (Object.keys(errs).length) { setErrors(errs); return; }
                    setStep('tac');
                    setApiError('');
                  }}
                  className="w-full bg-accent text-black py-4 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 hover:bg-accent/90 transition-all group"
                >
                  Continue to Terms <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            {/* ── STEP: T&C ─────────────────────────────────────────────── */}
            {step === 'tac' && (
              <motion.div key="tac" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
                <button onClick={goBack} className="flex items-center gap-2 text-muted hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
                  <ArrowLeft size={16} /> Back
                </button>

                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Terms & Conditions</h3>
                  <p className="text-secondary text-sm mt-1">Please read and accept before creating your account.</p>
                </div>

                <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl h-60 overflow-y-auto custom-scrollbar space-y-4 text-xs text-secondary leading-relaxed">
                  <p className="font-black text-white uppercase tracking-widest text-[10px]">1. Account Usage</p>
                  <p>By creating an account on ZaneZion, you agree to use the platform only for lawful purposes. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account.</p>
                  <p className="font-black text-white uppercase tracking-widest text-[10px]">2. Business Accounts</p>
                  <p>Business accounts require manual admin approval. A valid business license must be uploaded during registration. Providing false documentation may result in immediate account termination.</p>
                  <p className="font-black text-white uppercase tracking-widest text-[10px]">3. SaaS Membership</p>
                  <p>SaaS membership requires payment of the signup fee before review. Fees are non-refundable once the account is activated. If rejected during review, a full refund will be issued within 7 business days.</p>
                  <p className="font-black text-white uppercase tracking-widest text-[10px]">4. Personal Accounts</p>
                  <p>Personal accounts provide immediate access to the marketplace. Concierge services are not included on personal accounts. All purchases must be paid in full at checkout, and no invoice-based billing is available.</p>
                  <p className="font-black text-white uppercase tracking-widest text-[10px]">5. Privacy</p>
                  <p>ZaneZion collects and processes personal data in accordance with our Privacy Policy. Data is not sold to third parties and is used only to provide and improve our services.</p>
                  <p className="font-black text-white uppercase tracking-widest text-[10px]">6. Termination</p>
                  <p>ZaneZion reserves the right to suspend or terminate accounts that violate these terms without prior notice.</p>
                </div>

                <label className="flex items-start gap-4 cursor-pointer group">
                  <div
                    onClick={() => setTacAccepted(v => !v)}
                    className={`w-6 h-6 rounded-lg border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${tacAccepted ? 'bg-accent border-accent' : 'border-border group-hover:border-accent/50'}`}
                  >
                    {tacAccepted && <CheckCircle size={14} className="text-black" />}
                  </div>
                  <p className="text-sm text-secondary leading-relaxed">
                    I have read and agree to the <span className="text-accent font-bold">Terms & Conditions</span> and <span className="text-accent font-bold">Privacy Policy</span>. I understand my account type and its requirements.
                  </p>
                </label>

                {apiError && (
                  <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl flex items-start gap-3">
                    <X size={16} className="text-danger shrink-0 mt-0.5" />
                    <p className="text-danger text-xs font-bold">{apiError}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading || !tacAccepted}
                  className="w-full bg-accent text-black py-4 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 hover:bg-accent/90 transition-all disabled:opacity-40 group"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>{accountType === 'saas' ? 'Proceed to Payment & Submit' : 'Create Account'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                  )}
                </button>

                <p className="text-center text-[10px] text-muted uppercase tracking-widest">
                  {accountType === 'personal' && 'Account activates immediately after signup.'}
                  {accountType === 'business' && 'Account is pending admin review after signup.'}
                  {accountType === 'saas' && 'Signup fee payment + admin review required.'}
                </p>
              </motion.div>
            )}

            {/* ── STEP: DONE ────────────────────────────────────────────── */}
            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 text-center py-8">
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-success/10 border-2 border-success/30 rounded-full flex items-center justify-center">
                    <CheckCircle size={40} className="text-success" />
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-3xl font-black text-white tracking-tight">
                    {accountType === 'personal' ? 'Welcome Aboard!' : 'Application Submitted!'}
                  </h3>
                  <p className="text-secondary text-sm max-w-sm mx-auto leading-relaxed">
                    {accountType === 'personal' && 'Your personal account is ready. You can now log in and start using the marketplace immediately.'}
                    {accountType === 'business' && 'Your business account application is under review. You will receive a notification once approved by our admin team.'}
                    {accountType === 'saas' && 'Your SaaS membership application has been submitted. Please check your email for payment instructions and review timeline.'}
                  </p>
                </div>

                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl text-left space-y-3">
                  <p className="text-[10px] font-black text-accent uppercase tracking-widest">What happens next?</p>
                  {accountType === 'personal' && (
                    <ul className="space-y-2 text-sm text-secondary">
                      <li className="flex items-center gap-2"><CheckCircle size={14} className="text-success shrink-0" /> Account created instantly</li>
                      <li className="flex items-center gap-2"><CheckCircle size={14} className="text-success shrink-0" /> Log in with your email & password</li>
                      <li className="flex items-center gap-2"><CheckCircle size={14} className="text-success shrink-0" /> Start browsing the marketplace</li>
                    </ul>
                  )}
                  {(accountType === 'business' || accountType === 'saas') && (
                    <ul className="space-y-2 text-sm text-secondary">
                      <li className="flex items-center gap-2"><CheckCircle size={14} className="text-success shrink-0" /> Application received</li>
                      <li className="flex items-center gap-2"><ShieldCheck size={14} className="text-accent shrink-0" /> Admin review in progress (1–3 business days)</li>
                      <li className="flex items-center gap-2"><Mail size={14} className="text-info shrink-0" /> Notification sent to your email upon approval</li>
                    </ul>
                  )}
                </div>

                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-accent text-black py-4 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 hover:bg-accent/90 transition-all group"
                >
                  {accountType === 'personal' ? 'Go to Login' : 'Back to Login'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Signup;
