import React, { useState } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Mail, Phone, Lock, Briefcase, CreditCard,
    Shield, CheckCircle, ArrowRight, ArrowLeft, Loader2,
    Calendar, Globe, FileText, Image, Award, AlertCircle, Camera, Truck
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api/setupAxios.js';
import { ageFromBirthday } from '../../utils/dateEst';

const StaffSignup = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [files, setFiles] = useState({
        passport: null,
        license: null,
        nib_doc: null,
        police_record: null,
        profile_pic: null
    });
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        employment_status: 'Full Time',
        birthday: '',
        bank_name: '',
        account_number: '',
        routing_number: '',
        nib_number: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const { name, files: selectedFiles } = e.target;
        if (selectedFiles && selectedFiles[0]) {
            setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (step < 3) {
            setStep(step + 1);
            return;
        }

        const applicantAge = ageFromBirthday(formData.birthday);
        if (applicantAge == null || applicantAge < 18) {
            setError('Applicants must be at least 18 years old.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Using FormData for multipart/form-data upload
            const data = new FormData();
            
            // Append text fields
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });

            // Append file fields
            Object.keys(files).forEach(key => {
                if (files[key]) {
                    data.append(key, files[key]);
                }
            });

            const res = await api.post('/auth/staff-register', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.success) {
                swalSuccess('Success', 'Success: Application submitted for audit. You will receive an email once the ZaneZion HQ reviews your credentials.');
                navigate('/login');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Connection to the Platinum Network failed. Protocol aborted.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={16} />
                                    <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-accent outline-none" placeholder="First & Last Name" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Professional Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={16} />
                                    <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-accent outline-none" placeholder="personal@email.com" />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Primary Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={16} />
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-accent outline-none" placeholder="+1 (242) ..." />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Create Vault Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-accent" size={16} />
                                    <input type="password" name="password" required value={formData.password} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-accent outline-none" placeholder="••••••••" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Date of Birth <span className="text-warning">(minimum age 18)</span></label>
                            <input type="date" name="birthday" required value={formData.birthday} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none" />
                        </div>
                    </motion.div>
                );
            case 2:
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-accent uppercase tracking-widest border-b border-white/5 pb-2">Financial Protocol</h4>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Banking Institution</label>
                                <input type="text" name="bank_name" value={formData.bank_name} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none" placeholder="e.g. Scotiabank, BOB" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Account Number</label>
                                    <input type="text" name="account_number" value={formData.account_number} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Routing / Transit</label>
                                    <input type="text" name="routing_number" value={formData.routing_number} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">NIB Number</label>
                            <input type="text" name="nib_number" value={formData.nib_number} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent outline-none" />
                        </div>
                    </motion.div>
                );
            case 3:
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                        <h4 className="text-xs font-bold text-accent uppercase tracking-widest border-b border-white/5 pb-2">Institutional Verification</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { name: 'passport', label: 'Passport Scan', icon: Globe },
                                { name: 'license', label: 'Driver License', icon: Truck },
                                { name: 'nib_doc', label: 'NIB Document', icon: FileText },
                                { name: 'police_record', label: 'Police Record', icon: Shield },
                                { name: 'profile_pic', label: 'Professional Headshot', icon: Camera },
                            ].map((doc) => (
                                <div key={doc.name} className="relative">
                                    <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all ${files[doc.name] ? 'bg-accent/10 border-accent text-accent' : 'bg-white/5 border-white/10 text-muted hover:border-accent/40'}`}>
                                        <input type="file" name={doc.name} onChange={handleFileChange} className="hidden" accept=".jpg,.jpeg,.png,.pdf" />
                                        <doc.icon size={24} className={files[doc.name] ? 'animate-pulse' : ''} />
                                        <span className="text-[10px] font-black uppercase tracking-widest mt-2">{files[doc.name] ? files[doc.name].name : doc.label}</span>
                                        {files[doc.name] && <CheckCircle className="absolute top-2 right-2 text-accent" size={14} />}
                                    </label>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl flex gap-3">
                            <AlertCircle className="text-accent shrink-0" size={18} />
                            <p className="text-[9px] text-secondary font-bold uppercase leading-relaxed">By finalizing, you verify all credentials are authentic. Unauthorized spoofing will result in immediate protocol blacklisting.</p>
                        </div>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6 relative">
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent"></div>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 md:p-12 shadow-2xl">
                <div className="flex flex-col items-center text-center mb-10">
                    <img src="/logo.png" alt="ZaneZion" className="w-16 h-16 object-contain mb-4 ring-2 ring-accent ring-offset-4 ring-offset-background rounded-full p-2 bg-white" />
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter">Establish <span className="text-accent">Protocol</span></h2>
                    <p className="text-[10px] text-muted font-bold tracking-[0.4em] uppercase mt-2">Institutional Recruitment Portal</p>
                </div>
                <div className="flex gap-2 mb-12">
                    {[1, 2, 3].map(s => <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-700 ${step >= s ? 'bg-accent shadow-[0_0_10px_rgba(200,169,106,0.5)]' : 'bg-white/5'}`} />)}
                </div>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
                    {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-black uppercase tracking-widest text-center">{error}</div>}
                    <div className="flex gap-4">
                        {step > 1 && <button type="button" onClick={() => setStep(step - 1)} className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase hover:bg-white/10 flex items-center gap-2"><ArrowLeft size={14} /> Back</button>}
                        <button type="submit" disabled={isSubmitting} className={`flex-1 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${step === 3 ? 'bg-accent text-black hover:bg-white' : 'bg-white/5 border border-white/10 text-white hover:border-accent'}`}>{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <>{step === 3 ? 'Finalize Protocol' : 'Continue'} <ArrowRight size={14} /></>}</button>
                    </div>
                </form>
                <div className="mt-10 pt-8 border-t border-white/5 text-center text-[10px] font-bold text-muted uppercase tracking-widest">Already have a station? <Link to="/login" className="text-accent hover:underline decoration-accent/30 underline-offset-4">Return to Entry</Link></div>
            </motion.div>
        </div>
    );
};

export default StaffSignup;
