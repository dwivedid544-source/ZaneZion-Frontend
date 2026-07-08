import React, { useState, useEffect } from 'react';
import { useData } from '../../context/GlobalDataContext';
import { User, Mail, Phone, Lock, Save, Shield, Calendar, CreditCard, Hash, Briefcase, TrendingUp, Eye, EyeOff } from 'lucide-react';

const Profile = () => {
    const { currentUser, updateUser } = useData();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        birthday: '',
        bankName: '',
        accountNumber: '',
        routingNumber: '',
        nibNumber: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        if (currentUser) {
            setFormData({
                name: currentUser.name || '',
                email: currentUser.email || '',
                phone: currentUser.phone || '',
                password: '',
                birthday: currentUser.birthday ? currentUser.birthday.split('T')[0] : '',
                bankName: currentUser.bankName || currentUser.bank_name || '',
                accountNumber: currentUser.accountNumber || currentUser.account_number || '',
                routingNumber: currentUser.routingNumber || currentUser.routing_number || '',
                nibNumber: currentUser.nibNumber || currentUser.nib_number || currentUser.nib || '',
            });
        }
    }, [currentUser]);

    const handleChange = (e) => {
        let val = e.target.value;
        if (e.target.name === 'phone') {
            val = val.replace(/\D/g, '');
        }
        setFormData({ ...formData, [e.target.name]: val });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.birthday && new Date(formData.birthday) > new Date()) {
            setMessage({ type: 'error', text: 'Birthday cannot be in the future.' });
            setIsLoading(false);
            return;
        }
        if (formData.phone && !/^\d+$/.test(formData.phone)) {
            setMessage({ type: 'error', text: 'Phone number must contain only numeric characters.' });
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const payload = {
                ...currentUser,
                ...formData,
                id: currentUser?.id,
                bank_name: formData.bankName,
                account_number: formData.accountNumber,
                routing_number: formData.routingNumber,
                nib_number: formData.nibNumber,
            };
            const res = await updateUser(payload);
            if (res?.success || res?.data) {
                setMessage({ type: 'success', text: 'Profile updated successfully.' });
                setFormData(prev => ({ ...prev, password: '' }));
            } else {
                setMessage({ type: 'error', text: 'Failed to update profile' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'An error occurred while updating profile' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10 max-w-4xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white uppercase italic">My Profile</h1>
                    <p className="text-secondary mt-1 text-xs uppercase tracking-[0.2em] font-black">Manage your personal credentials and securing settings.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl flex items-center gap-3">
                        <Shield size={16} className="text-accent" />
                        <div>
                            <p className="text-[9px] text-accent uppercase font-black tracking-widest leading-none">Access Level</p>
                            <p className="text-sm text-white font-bold capitalize mt-0.5 leading-none">{String(currentUser?.role?.name || currentUser?.role || 'User')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl border font-bold text-sm ${message.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left side: Avatar & Info */}
                <div className="md:col-span-1 space-y-6">
                    <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center text-accent font-black text-3xl mb-4 shadow-[0_0_20px_rgba(200,169,106,0.2)]">
                            {currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
                        </div>
                        <h2 className="text-xl font-black text-white">{currentUser?.name || 'User Name'}</h2>
                        <p className="text-secondary text-xs uppercase tracking-widest mt-1 font-bold">{String(currentUser?.role?.name || currentUser?.role || 'Role')}</p>
                        <div className="mt-6 w-full pt-6 border-t border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-secondary font-bold">Status</span>
                                <span className="px-2 py-1 bg-success/20 text-success rounded-md text-[10px] font-black uppercase tracking-widest">Active</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-secondary font-bold">Member Since</span>
                                <span className="text-xs text-white font-bold">{currentUser?.joinedDate ? new Date(currentUser.joinedDate).toLocaleDateString() : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right side: Form */}
                <div className="md:col-span-2">
                    <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8">
                        <div className="mb-6 pb-4 border-b border-white/5">
                            <h3 className="text-lg font-black text-white">Personal Information</h3>
                            <p className="text-xs text-secondary mt-1">Update your personal details below.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">Full Name</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                        <User size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                        required
                                        autoComplete="new-name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">Email Address</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                        <Mail size={16} />
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                        required
                                        autoComplete="new-email"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">Phone Number</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                        <Phone size={16} />
                                    </div>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent transition-colors font-mono"
                                        autoComplete="new-phone"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">Date of Birth</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                        <Calendar size={16} />
                                    </div>
                                    <input
                                        type="date"
                                        name="birthday"
                                        value={formData.birthday}
                                        onChange={handleChange}
                                        max={new Date().toISOString().split('T')[0]}
                                        className="w-full bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 mb-6 pb-4 border-b border-white/5">
                            <h3 className="text-lg font-black text-white">Security</h3>
                            <p className="text-xs text-secondary mt-1">Change your password here. Leave blank if you don't want to change it.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2 max-w-sm">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">New Password</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                        className="w-full bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white focus:outline-none focus:border-accent transition-colors font-mono"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Banking & NIB section */}
                        <div className="mt-10 mb-6 pb-4 border-b border-white/5">
                            <h3 className="text-lg font-black text-white">Banking & Identity</h3>
                            <p className="text-xs text-secondary mt-1">Financial details for payroll and verification purposes. Stored securely.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">Banking Institution</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                        <Briefcase size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        name="bankName"
                                        value={formData.bankName}
                                        onChange={handleChange}
                                        placeholder="e.g. First Caribbean Bank"
                                        className="w-full bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">Account Number</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                        <CreditCard size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        name="accountNumber"
                                        value={formData.accountNumber}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                        className="w-full bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">Routing Number</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                        <Hash size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        name="routingNumber"
                                        value={formData.routingNumber}
                                        onChange={handleChange}
                                        placeholder="Routing / Transit number"
                                        className="w-full bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-secondary uppercase tracking-widest block">NIB Number</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                                        <Shield size={16} />
                                    </div>
                                    <input
                                        type="text"
                                        name="nibNumber"
                                        value={formData.nibNumber}
                                        onChange={handleChange}
                                        placeholder="National Insurance Board number"
                                        className="w-full bg-[#141417] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Vacation Balance — read-only display */}
                        {(currentUser?.vacationBalance !== undefined || currentUser?.vacation_balance !== undefined) && (
                            <div className="mt-6 p-4 bg-info/5 border border-info/20 rounded-xl flex items-center gap-4">
                                <TrendingUp size={20} className="text-info shrink-0" />
                                <div>
                                    <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Vacation Balance</p>
                                    <p className="text-lg font-black text-white mt-0.5">
                                        {currentUser?.vacationBalance ?? currentUser?.vacation_balance ?? 0} <span className="text-sm text-secondary font-bold">days remaining</span>
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex justify-end">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`btn-primary flex items-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} /> Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
