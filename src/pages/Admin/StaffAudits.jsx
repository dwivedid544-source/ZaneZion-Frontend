import React, { useState, useEffect } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Shield, User, Mail, Phone, Calendar, Banknote, 
    FileText, CheckCircle, XCircle, Eye, Download, 
    Search, Filter, Loader2, AlertCircle, ExternalLink,
    MapPin, Smartphone, Briefcase
} from 'lucide-react';
import api from '../../services/api/setupAxios.js';
import { BACKEND_ORIGIN } from '../../utils/apiHelpers.js';
import { addBlockedStaffEmail, removeBlockedStaffEmail } from '../../utils/staffLoginGate';

const StaffAudits = () => {
    const [pendingStaff, setPendingStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [isReviewing, setIsReviewing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPendingStaff();
    }, []);

    const fetchPendingStaff = async () => {
        try {
            setLoading(true);
            const res = await api.get('/auth/staff-pending');
            if (res.data.success) {
                setPendingStaff(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch pending staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (id, status) => {
        try {
            setIsReviewing(true);
            const res = await api.put(`/auth/staff-review/${id}`, { status });
            if (res.data.success) {
                const staff = pendingStaff.find(s => s.id === id) || selectedStaff;
                const em = staff?.email;
                if (em) {
                    const st = String(status).toLowerCase();
                    if (st === 'active') removeBlockedStaffEmail(em);
                    if (['inactive', 'not_selected', 'rejected', 'not selected'].includes(st)) addBlockedStaffEmail(em);
                }
                setPendingStaff(prev => prev.filter(s => s.id !== id));
                setSelectedStaff(null);
                swalSuccess("Updated", res.data.message);
            }
        } catch (error) {
            swalError('Update Failed', error.response?.data?.message || error.message);
        } finally {
            setIsReviewing(false);
        }
    };

    const filteredStaff = pendingStaff.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getFullUrl = (path) => {
        if (!path) return null;
        if (String(path).startsWith('http')) return path;
        return `${BACKEND_ORIGIN}${String(path).startsWith('/') ? '' : '/'}${path}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-accent" size={48} />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8 space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter italic italic">Recruitment <span className="text-accent underline decoration-accent/20 underline-offset-8">Audit</span></h1>
                    <p className="text-secondary text-xs font-bold uppercase tracking-widest mt-3">Review and Authorize Field Staff Credentials</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search Agents..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-accent w-64"
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* List of Pending Staff */}
                <div className="xl:col-span-2 space-y-4">
                    {filteredStaff.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 glass-card bg-white/[0.02] border-white/5 text-center">
                            <Shield size={48} className="text-muted mb-4 opacity-20" />
                            <p className="text-secondary text-xs font-black uppercase tracking-widest">No Pending Protocols for Audit</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredStaff.map((staff) => (
                                <motion.div 
                                    key={staff.id} 
                                    layoutId={`staff-${staff.id}`}
                                    onClick={() => setSelectedStaff(staff)}
                                    className={`p-6 glass-card border transition-all cursor-pointer relative overflow-hidden group ${selectedStaff?.id === staff.id ? 'border-accent bg-accent/5' : 'border-white/5 bg-white/[0.02] hover:border-accent/40'}`}
                                >
                                    <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                                        <Briefcase size={80} />
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center overflow-hidden border border-accent/20">
                                            {staff.profile_pic_url ? (
                                                <img src={getFullUrl(staff.profile_pic_url)} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="text-accent" size={24} />
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-white uppercase tracking-tight">{staff.name}</h3>
                                            <p className="text-[10px] text-muted font-bold uppercase flex items-center gap-2"><Mail size={10} /> {staff.email}</p>
                                            <p className="text-[10px] text-muted font-bold uppercase flex items-center gap-2"><Smartphone size={10} /> {staff.phone}</p>
                                        </div>
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full">Pending Audit</span>
                                        <div className="flex gap-2">
                                            <button className="p-2 hover:bg-accent hover:text-black rounded-lg transition-colors"><Eye size={16} /></button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Staff Detail Panel */}
                <div className="xl:col-span-1">
                    <AnimatePresence mode="wait">
                        {selectedStaff ? (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0, x: 20 }}
                                className="glass-card bg-white/[0.03] border-accent/20 overflow-hidden sticky top-8 shadow-2xl"
                            >
                                <div className="p-8 space-y-8">
                                    <div className="text-center">
                                        <div className="w-24 h-24 bg-accent/10 rounded-[32px] flex items-center justify-center mx-auto mb-4 border-2 border-accent/20 overflow-hidden">
                                            {selectedStaff.profile_pic_url ? (
                                                <img src={getFullUrl(selectedStaff.profile_pic_url)} alt="Headshot" className="w-full h-full object-cover" />
                                            ) : (
                                                <User className="text-accent" size={40} />
                                            )}
                                        </div>
                                        <h2 className="text-xl font-black uppercase tracking-tighter">{selectedStaff.name}</h2>
                                        <span className="text-[10px] text-accent font-black uppercase tracking-[0.3em]">Institutional Verification</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted">Bank Institution</p>
                                            <p className="text-xs font-bold text-white">{selectedStaff.bank_name || 'N/A'}</p>
                                        </div>
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted">NIB Registry</p>
                                            <p className="text-xs font-bold text-white">{selectedStaff.nib_number || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted border-b border-white/5 pb-2">Manifest Documents</h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {[
                                                { label: 'Passport Scan', key: 'passport_url' },
                                                { label: 'Carrier License', key: 'license_url' },
                                                { label: 'NIB Protocol', key: 'nib_document_url' },
                                                { label: 'Police Clearance', key: 'police_record_url' }
                                            ].map((doc) => (
                                                <div key={doc.key} className="flex items-center justify-between p-3 bg-white/5 rounded-xl group/doc">
                                                    <div className="flex items-center gap-3">
                                                        <FileText size={16} className="text-accent" />
                                                        <span className="text-[11px] font-bold text-secondary uppercase group-hover/doc:text-white transition-colors">{doc.label}</span>
                                                    </div>
                                                    {selectedStaff[doc.key] ? (
                                                        <a 
                                                            href={getFullUrl(selectedStaff[doc.key])} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 text-[10px] font-black text-accent hover:underline uppercase"
                                                        >
                                                            View <ExternalLink size={12} />
                                                        </a>
                                                    ) : (
                                                        <span className="text-[10px] text-muted italic">Missing</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 pt-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => handleReview(selectedStaff.id, 'Inactive')}
                                            disabled={isReviewing}
                                            className="flex-1 py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={16} /> Deny Entry
                                        </button>
                                        <button 
                                            onClick={() => handleReview(selectedStaff.id, 'Not_Selected')}
                                            disabled={isReviewing}
                                            className="flex-1 py-4 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-black transition-all flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={16} /> Not selected
                                        </button>
                                        </div>
                                        <button 
                                            onClick={() => handleReview(selectedStaff.id, 'Active')}
                                            disabled={isReviewing}
                                            className="w-full py-4 bg-accent text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={16} /> Authorize (activate)
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center space-y-4 p-8 glass-card border-white/5 opacity-40">
                                <AlertCircle size={40} />
                                <p className="text-[10px] font-black uppercase tracking-widest text-center">Select an agent profile to initiate auditing protocol</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default StaffAudits;

