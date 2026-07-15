import React, { useState, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import { useNavigate, Link } from 'react-router-dom';
import {
  Lock, Mail, User, ArrowRight, ShieldCheck,
  LayoutDashboard, Truck, Briefcase, ShoppingCart,
  Package, Heart, Users, Smartphone, Key, Eye, EyeOff
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useData } from '../../context/GlobalDataContext';
import api from '../../services/api/setupAxios.js';
import { resolvePortalRole } from '../../utils/authUtils';
import { shouldDenyStaffLogin } from '../../utils/staffLoginGate';

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const { users, setCurrentUser, setMenuPermissions } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Forgot Password States
  const [view, setView] = useState('login'); // login, forgot, otp, reset
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState(''); // Store OTP momentarily for testing
  const [showPassword, setShowPassword] = useState(false);

  const demoCredentials = {
    'superadmin': { email: 'superadmin@zanezion.com',      password: 'Admin@123' },
    'admin':      { email: 'admin@zanezion.com',           password: 'password123' },
    'procurement': { email: 'procurement@zanezion.com',     password: 'password123' },
    'operations': { email: 'Dog23@gmail.com',              password: 'password123' },
    'logistics':  { email: 'logistics@zanezion.com',       password: 'password123' },
    'inventory':  { email: 'inventory@zanezion.com',       password: 'password123' },
    'concierge':  { email: 'concierge@zanezion.com',       password: 'password123' },
    'client':     { email: 'testcust@gmail.com',           password: 'password123' },
    'staff':      { email: 'fieldstaff@zanezion.com',      password: 'password123' },
  };

  const roles = [
    { id: 'superadmin', label: 'Super Admin', icon: ShieldCheck, color: 'bg-accent' },
    { id: 'admin', label: 'Admin', icon: LayoutDashboard, color: 'bg-purple-500' },
    { id: 'procurement', label: 'Procurement', icon: ShoppingCart, color: 'bg-info' },
    { id: 'operations', label: 'Operations', icon: Briefcase, color: 'bg-primary' },
    { id: 'logistics', label: 'Logistics', icon: Truck, color: 'bg-success' },
    { id: 'inventory', label: 'Inventory', icon: Package, color: 'bg-warning' },
    { id: 'concierge', label: 'Concierge', icon: Heart, color: 'bg-danger' },
    { id: 'client', label: 'Client', icon: Users, color: 'bg-indigo-500' },
    { id: 'staff', label: 'Field Staff', icon: Smartphone, color: 'bg-orange-500' },
  ];

  const performLogin = async (loginEmail, loginPassword) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', {
        email: String(loginEmail || '').trim(),
        password: loginPassword,
      });

      if (res.data?.success) {
        const { token, user, menuPermissions: perms } = res.data.data;
        const normalizedRole = resolvePortalRole(user);

        const userData = {
          ...user,
          role: normalizedRole
        };

        if (shouldDenyStaffLogin(userData)) {
          setError('Access denied: your recruitment application was not approved or you were marked as not selected. Contact HR.');
          setLoading(false);
          return;
        }

        // Store in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('userRole', normalizedRole);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('menuPermissions', JSON.stringify(perms || []));

        setMenuPermissions(perms || []);
        setCurrentUser(userData);
        onLogin(normalizedRole);

        setTimeout(() => {
          navigate('/dashboard');
        }, 50);
      } else {
        setError(res.data?.message || 'Login failed.');
      }
    } catch (err) {
      console.error('Login error:', err);
      const status = err.response?.status;
      const body = err.response?.data;
      const validatorMsg = Array.isArray(body?.errors)
        ? body.errors.map((e) => e.msg || e.message || String(e)).filter(Boolean).join(' ')
        : '';
      const msg =
        (typeof body?.message === 'string' && body.message) ||
        (typeof body?.error === 'string' && body.error) ||
        validatorMsg ||
        (status === 401
          ? 'Invalid email or password (401). The server rejected credentials — password mismatch, inactive account, or user not visible to this app.'
          : 'Login failed. Check your credentials.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    await performLogin(email, password);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/forgot-password', { email: resetEmail });
      if (res.data?.success) {
        setOtpSent(true);
        setOtpValue(res.data.data?.otp || ''); // For testing without SMTP
        setView('otp');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = (e) => {
    e.preventDefault();
    if (otp === otpValue || otp === '123456') { // Allow 123456 as a backdoor for testing
      setView('reset');
      setError(null);
    } else {
      setError('Invalid verification code.');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/reset-password', {
        email: resetEmail,
        otp: otp,
        newPassword
      });
      if (res.data?.success) {
        swalSuccess('Password Reset', 'Please login with your new credentials.');
        setView('login');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    const credentials = demoCredentials[role];
    if (credentials) {
      setEmail(credentials.email);
      setPassword(credentials.password);
      setError(null);
    } else {
      setError(`Credentials for ${role} not found.`);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col lg:flex-row overflow-hidden bg-background">
      {/* Visual Side */}
      <div
        className="hidden lg:flex lg:w-1/2 relative p-12 flex-col justify-between overflow-hidden"
        style={{
          background: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url('/luxury_lifestyle_1.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-[0_0_18px_rgba(200,169,106,0.45)] overflow-hidden shrink-0 ring-2 ring-[#C8A96A] ring-offset-2 ring-offset-black">
            <img src="/logo.png" alt="ZaneZion" className="w-full h-full object-contain scale-[2.4]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-white">ZaneZion</h1>
            <p className="text-[10px] text-accent font-black uppercase tracking-[0.3em] leading-none">Access The Platinum Network</p>
          </div>
        </div>

        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-black text-white leading-tight font-heading mb-6"
          >
            Luxury Concierge <br />Management <span className="text-accent underline decoration-accent/30 lowercase italic">System</span>
          </motion.h2>
          <p className="text-secondary max-w-md text-lg leading-relaxed">
            Elevate your premium operations. Seamlessly manage logistics, procurement, and exclusive guest services within the Platinum network.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-8 border-t border-white/10 pt-8 mt-8">
          <div className="flex -space-x-3">
            {[
              { src: '/partner_cn.png', alt: 'CN Logo' },
              { src: '/partner_aura.png', alt: 'Aura of Opulence' },
              { src: '/partner_musha.png', alt: 'Musha Cay' },
              { src: '/partner_p2p.png', alt: 'Point to Point' },
            ].map((partner, i) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-accent/40 bg-white overflow-hidden shadow-lg shadow-accent/10 ring-1 ring-white/20">
                <img src={partner.src} alt={partner.alt} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <p className="text-xs text-secondary font-medium tracking-wide">
            Trusted by <span className="text-white font-bold">50+ Premium Partners</span> <br />Across Luxury Hospitality Sectors
          </p>
        </div>
      </div>

      {/* Login Side */}
      <div className="flex-1 flex flex-col min-h-screen lg:h-screen overflow-y-auto px-6 py-8 lg:px-16 bg-[#0a0a0a] custom-scrollbar">
        <div className="max-w-md w-full mx-auto my-auto space-y-6 lg:space-y-8 py-8">
          {/* Logo — visible on mobile (left panel is hidden), hidden on desktop */}
          <div className="flex items-center gap-3 lg:hidden mb-2 mt-4">
            <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-[0_0_18px_rgba(200,169,106,0.45)] overflow-hidden shrink-0 ring-2 ring-[#C8A96A] ring-offset-2 ring-offset-[#0a0a0a]">
              <img src="/logo.png" alt="ZaneZion" className="w-full h-full object-contain scale-[2.4]" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white leading-none">ZaneZion</h2>
              <p className="text-[9px] text-accent font-black uppercase tracking-[0.3em] leading-none mt-0.5">Platinum Network</p>
            </div>
          </div>

          {/* Desktop: shown always on right panel */}
          <div className="hidden lg:flex items-center gap-3 mt-2">
            <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-[0_0_18px_rgba(200,169,106,0.45)] overflow-hidden shrink-0 ring-2 ring-[#C8A96A] ring-offset-2 ring-offset-[#0a0a0a]">
              <img src="/logo.png" alt="ZaneZion" className="w-full h-full object-contain scale-[2.4]" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white leading-none">ZaneZion</h2>
              <p className="text-[9px] text-accent font-black uppercase tracking-[0.3em] leading-none mt-0.5">Platinum Network</p>
            </div>
          </div>

          <div className="space-y-3 mt-4 lg:mt-0">
            <h3 className="text-3xl lg:text-4xl font-black text-white tracking-tight">System Login</h3>
            <p className="text-secondary text-sm">Unauthorized access is strictly prohibited and monitored.</p>
          </div>

          {view === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={20} />
                  <input
                    type="email"
                    placeholder="Master ID / Email"
                    className="w-full bg-white/5 border border-border rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-muted/50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={20} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Encryption Key / Password"
                      className="w-full bg-white/5 border border-border rounded-2xl py-4 pl-12 pr-12 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-muted/50"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <div className="flex justify-end pr-2">
                    <button
                      type="button"
                      onClick={() => setView('forgot')}
                      className="text-[10px] text-accent font-bold uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 text-xs font-bold uppercase tracking-wider">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-black py-4 rounded-2xl font-black uppercase text-sm tracking-widest transition-all shadow-xl shadow-accent/10 flex items-center justify-center gap-3 active:scale-95 group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>Initialize Command <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          )}

          {view === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-white uppercase tracking-tighter">Reset Access</h4>
                <p className="text-xs text-secondary">Enter your registered email to receive a verification code.</p>
              </div>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={20} />
                <input
                  type="email"
                  placeholder="Registered Email"
                  className="w-full bg-white/5 border border-border rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              {error && <div className="text-red-500 text-[10px] uppercase font-bold">{error}</div>}
              <div className="flex flex-col gap-3">
                <button type="submit" disabled={loading} className="w-full bg-accent text-black py-4 rounded-2xl font-black uppercase text-xs tracking-widest">
                  {loading ? 'Processing...' : 'Request Credentials'}
                </button>
                <button type="button" onClick={() => setView('login')} className="text-[10px] text-muted font-bold uppercase tracking-widest hover:text-white">
                  Return to Secure Login
                </button>
              </div>
            </form>
          )}

          {view === 'otp' && (
            <form onSubmit={handleOtpVerify} className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success">
                    <ShieldCheck size={18} />
                  </div>
                  <h4 className="text-xl font-bold text-white uppercase tracking-tighter">Security Verification</h4>
                </div>
                <p className="text-xs text-secondary">Code sent to <span className="text-accent">{resetEmail}</span></p>
              </div>
              <div className="relative group">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Enter 6-Digit Code"
                  maxLength={6}
                  className="w-full bg-white/5 border border-border rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-accent text-center tracking-[0.5em] font-black"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
              </div>
              {error && <div className="text-red-500 text-[10px] uppercase font-bold text-center">{error}</div>}
              <div className="flex flex-col gap-3">
                <button type="submit" className="w-full bg-success text-black py-4 rounded-2xl font-black uppercase text-xs tracking-widest">
                  Verify Identity
                </button>
                <button type="button" onClick={() => setView('forgot')} className="text-[10px] text-muted font-bold uppercase tracking-widest hover:text-white">
                  Wrong Email? Try Again
                </button>
              </div>
            </form>
          )}

          {view === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-white uppercase tracking-tighter">Define New Key</h4>
                <p className="text-xs text-secondary">Secure your account with a new encryption password.</p>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-secondary transition-colors" size={20} />
                <input
                  type="password"
                  placeholder="New Encryption Key"
                  className="w-full bg-white/5 border border-border rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-accent"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              {error && <div className="text-red-500 text-[10px] uppercase font-bold">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-accent text-black py-4 rounded-2xl font-black uppercase text-xs tracking-widest">
                {loading ? 'Calibrating...' : 'Update & Re-initialize'}
              </button>
            </form>
          )}

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
            <div className="relative flex justify-center text-[10px]"><span className="bg-[#0a0a0a] px-4 text-muted font-bold uppercase tracking-[0.2em]">Rapid Role Switch</span></div>
          </div>

          <div className="grid grid-cols-3 xs:grid-cols-3 sm:grid-cols-5 lg:grid-cols-5 gap-2 lg:gap-3">
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => handleQuickLogin(role.id)}
                className="flex flex-col items-center gap-2 p-2 lg:p-3 bg-white/[0.03] border border-border rounded-xl lg:rounded-2xl hover:bg-white/[0.08] hover:border-accent/40 transition-all group"
              >
                <div className={`p-1.5 lg:p-2 rounded-lg lg:rounded-xl bg-opacity-10 ${role.color.replace('bg-', 'text-')} group-hover:scale-110 transition-transform`}>
                  <role.icon size={16} className="lg:w-[18px] lg:h-[18px]" />
                </div>
                <span className="text-[8px] lg:text-[9px] font-bold text-secondary group-hover:text-white uppercase tracking-tight text-center">{role.label}</span>
              </button>
            ))}
          </div>

          <div className="pt-4 text-center space-y-2">
            <p className="text-[10px] text-muted font-bold uppercase tracking-[0.2em]">ZaneZion Concierge v2.0.5</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              New user?{' '}
              <Link to="/signup" className="text-accent underline decoration-accent/20 underline-offset-4 hover:text-white transition-colors">Create account</Link>
              <span className="mx-2 text-white/20">•</span>
              <Link to="/staff-signup" className="text-muted hover:text-white transition-colors">Staff signup</Link>
            </p>
          </div>
        </div>
      </div>
    </div>

  );
};

export default Login;
