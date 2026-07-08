import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Truck, ShoppingCart, Shield, Star, Anchor, Globe, CheckCircle, ArrowRight,
    Activity, Map, Briefcase, Award, Send, Loader2, Building, User, Mail,
    Settings, Zap, MessageSquare, ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LIFESTYLE_SERVICES } from '../../utils/data';
import { useData } from '../../context/GlobalDataContext';
import Modal from '../../components/Modal';
import { BACKEND_ORIGIN } from '../../utils/apiHelpers.js';

const Landing = () => {
    const { accessPlans, fetchAccessPlans, dispatchSubscriptionRequest } = useData();
    const [billingCycle, setBillingCycle] = React.useState('monthly');
    const [isRequestModalOpen, setIsRequestModalOpen] = React.useState(false);
    const [selectedPlan, setSelectedPlan] = React.useState(null);
    const [requestFormData, setRequestFormData] = React.useState({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        country: '',
        requirements: '',
        propertyType: 'Luxury Resort',
        throughput: 'Medium',
        addOn: 'None',
        assignedAdminId: null
    });
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [notification, setNotification] = React.useState({ show: false, type: '', title: '', message: '' });
    const [admins, setAdmins] = React.useState([]);

    React.useEffect(() => {
        const fetchAdmins = async () => {
            try {
                // If API URL is not set in env, it maps to backend running locally. Using relative /api path 
                // typically won't work perfectly on landing unless proxy points it, better full fallback.
                const res = await fetch(`${BACKEND_ORIGIN}/api/staff/public/admins`);
                const data = await res.json();
                if (data.success) {
                    setAdmins(data.data);
                }
            } catch (err) {
                console.error("Failed to fetch admins", err);
            }
        };
        fetchAdmins();
    }, []);

    React.useEffect(() => {
        fetchAccessPlans();
    }, [fetchAccessPlans]);

    const handleActivate = (plan) => {
        setSelectedPlan(plan);
        setRequestFormData({ ...requestFormData, email: '', requirements: '' });
        setIsRequestModalOpen(true);
    };

    const showNotification = (type, title, message) => {
        setNotification({ show: true, type, title, message });
        setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 6000);
    };

    const handleRequestSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await dispatchSubscriptionRequest({
                clientName: requestFormData.companyName,
                companyName: requestFormData.companyName,
                plan: selectedPlan.name,
                contactPerson: requestFormData.contactPerson,
                email: requestFormData.email,
                phone: requestFormData.phone,
                country: requestFormData.country,
                requirements: requestFormData.requirements,
                propertyType: requestFormData.propertyType,
                throughput: requestFormData.throughput,
                addOn: requestFormData.addOn,
                assignedAdminId: requestFormData.assignedAdminId
            });

            setIsRequestModalOpen(false);
            setIsSubmitting(false);
            showNotification(
                'success',
                'Protocol Established',
                `Your institutional application for ${selectedPlan.name} is now being audited by ZaneZion HQ. We will contact you at ${requestFormData.email} shortly.`
            );
        } catch (error) {
            console.error("Submission failed:", error);
            setIsSubmitting(false);
            showNotification(
                'error',
                'Protocol Failed',
                'Initiation failed. Please contact ZaneZion HQ directly.'
            );
        }
    };
    return (
        <div className="min-h-screen bg-background text-white selection:bg-accent/30 relative overflow-hidden">
            {/* Premium Notification Overlay */}
            <AnimatePresence>
                {notification.show && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: 30 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="max-w-md w-full mx-4 relative overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={`p-8 rounded-2xl border ${notification.type === 'success' ? 'bg-[#1a1f14] border-[#3d5a1e]/40' : 'bg-[#1f1414] border-[#5a1e1e]/40'}`}>
                                {/* Glow Effect */}
                                <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px] ${notification.type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'}`} />

                                {/* Icon */}
                                <div className="flex items-center justify-center mb-6">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', delay: 0.2, damping: 15 }}
                                        className={`w-16 h-16 rounded-full flex items-center justify-center ${notification.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                    >
                                        {notification.type === 'success' ? (
                                            <CheckCircle size={32} />
                                        ) : (
                                            <Shield size={32} />
                                        )}
                                    </motion.div>
                                </div>

                                {/* Title */}
                                <h3 className={`text-xl font-black uppercase tracking-wider text-center mb-3 ${notification.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                    {notification.title}
                                </h3>

                                {/* Message */}
                                <p className="text-secondary text-sm text-center leading-relaxed mb-8">
                                    {notification.message}
                                </p>

                                {/* Close Button */}
                                <button
                                    onClick={() => setNotification(prev => ({ ...prev, show: false }))}
                                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${notification.type === 'success' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/20' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20'}`}
                                >
                                    Continue
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Institutional Luxury Background System */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                {/* Gold Noise Texture */}
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] z-10"></div>

                {/* Floating Gold Dust Particles */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            y: [0, -100, 0],
                            x: [0, 50, 0],
                            opacity: [0.1, 0.3, 0.1]
                        }}
                        transition={{
                            duration: 10 + i * 5,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        className="absolute w-1 h-1 bg-accent rounded-full blur-[1px]"
                        style={{
                            top: `${Math.random() * 100}% `,
                            left: `${Math.random() * 100}% `,
                        }}
                    />
                ))}

                {/* Platinum Mesh Gradients */}
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-accent/10 rounded-full blur-[150px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-accent/5 rounded-full blur-[150px]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-background via-transparent to-background"></div>
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-[0_0_18px_rgba(200,169,106,0.45)] overflow-hidden transform hover:scale-105 transition-transform shrink-0 ring-2 ring-[#C8A96A] ring-offset-2 ring-offset-background">
                            <img src="/logo.png" alt="ZaneZion" className="w-full h-full object-contain scale-[2.4]" />
                        </div>
                        <span className="text-xl font-black uppercase tracking-widest text-white">ZaneZion <span className="text-accent">Concierge</span></span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-xs font-black uppercase tracking-widest text-secondary">
                        <a href="#about" className="hover:text-accent transition-colors">About</a>
                        <a href="#services" className="hover:text-accent transition-colors">Services</a>
                        <a href="#solutions" className="hover:text-accent transition-colors">Solutions</a>
                        <Link to="/staff-signup" className="hover:text-accent transition-colors">Careers</Link>
                        <Link to="/signup" className="px-6 py-3 bg-accent/10 border border-accent/30 text-accent rounded-full hover:bg-accent hover:text-black transition-all">Sign Up</Link>
                        <Link to="/login" className="px-6 py-3 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 hover:border-accent/40 transition-all">Login</Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] translate-y-1/2"></div>
                </div>

                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-full text-accent text-[10px] font-black uppercase tracking-widest mb-6"
                    >
                        <Shield size={12} /> Excellence in Every Mile
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                        className="text-4xl sm:text-5xl lg:text-7xl font-black mb-8 leading-[1.1]"
                    >
                        Specialized <span className="text-accent underline decoration-accent/20 underline-offset-8">Supply Chain</span> & <br className="hidden sm:block" />
                        Logistics for Luxury Hospitality.
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="max-w-3xl mx-auto text-lg lg:text-xl text-secondary mb-12 leading-relaxed"
                    >
                        Elevating guest experiences through operational precision, white-glove service, and bespoke provisioning.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link to="/signup" className="px-10 py-5 bg-accent text-black font-black uppercase tracking-widest rounded-2xl hover:bg-white transition-all shadow-xl shadow-accent/10 flex items-center gap-2 group">
                            Create Account <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link to="/login" className="px-10 py-5 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 hover:border-accent/40 transition-all">
                            Login
                        </Link>
                        <a href="#services" className="px-10 py-5 bg-transparent border border-white/5 text-secondary font-black uppercase tracking-widest rounded-2xl hover:bg-white/5 transition-all">
                            Explore Services
                        </a>
                    </motion.div>
                </div>
            </section>

            {/* About Section */}
            <section id="about" className="py-24 border-y border-white/5 bg-white/[0.01]">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <h2 className="text-4xl font-bold tracking-tight">Your operations deserve a partner who understands <span className="text-accent">complexity.</span></h2>
                        <p className="text-secondary leading-relaxed text-lg">
                            Every shipment, every vendor relationship, and every deadline matters. We provide tailored solutions for Resorts & Boutique Hotels, Private Estates, Private Islands, & Yachts. Designed to remove friction, increase visibility, and strengthen operational resilience; we deliver seamless supply chain management and bespoke provisioning services that elevate guest experiences and ensure flawless operations.
                        </p>
                        <div className="grid grid-cols-2 gap-6 pt-4">
                            <div className="p-6 glass-card border-white/5">
                                <h4 className="text-accent text-3xl font-black mb-2">100%</h4>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Delivery Security</p>
                            </div>
                            <div className="p-6 glass-card border-white/5">
                                <h4 className="text-accent text-3xl font-black mb-2">24/7</h4>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Concierge Support</p>
                            </div>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="aspect-square rounded-3xl overflow-hidden border border-white/10 relative z-10">
                            <img
                                src="/maritime_logistics_1.png"
                                alt="Maritime Logistics"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
                        </div>
                        <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-accent/20 rounded-full blur-3xl z-0"></div>
                    </div>
                </div>
            </section>

            {/* Who We Serve Section */}
            <section className="py-24 bg-background">
                <div className="max-w-7xl mx-auto px-6 text-center mb-16">
                    <h2 className="text-4xl font-black mb-6">Who We Serve & What We Stand For</h2>
                    <p className="max-w-3xl mx-auto text-secondary leading-relaxed">
                        We are more than supply chain experts; we are partners in creating unforgettable experiences. Our team specialize in end-to-end logistics and luxury provisioning for hospitality destinations, private residences, and luxury yachts for your destination.
                    </p>
                </div>
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { title: "Transparency", detail: "Real-time visibility into every order and delivery movement.", icon: Globe },
                        { title: "Precision", detail: "Bespoke sourcing and accuracy in every line item fulfilled.", icon: Activity },
                        { title: "Proactive", detail: "Early problem solving and mitigation of supply chain friction.", icon: Map },
                    ].map((p, i) => (
                        <div key={i} className="p-8 glass-card border-white/5 hover:border-accent/20 transition-all text-center group">
                            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mx-auto mb-6 group-hover:bg-accent group-hover:text-black transition-all">
                                <p.icon size={32} />
                            </div>
                            <h3 className="text-xl font-bold mb-4">{p.title}</h3>
                            <p className="text-secondary text-sm leading-relaxed">{p.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Services Section */}
            <section id="services" className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                        <div>
                            <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter italic">Bespoke <span className="text-accent underline decoration-accent/20 underline-offset-4">Service</span> Matrix</h2>
                            <p className="text-secondary max-w-xl">Curated operational protocols designed for the most demanding hospitality environments.</p>
                        </div>
                        <div className="h-[2px] flex-1 bg-white/5 max-w-[200px] mb-4 hidden md:block"></div>
                    </div>

                    <div className="relative overflow-hidden py-20 -mx-6 select-none">
                        {/* Luxury Gradient Masks */}
                        <div className="absolute inset-y-0 left-0 w-48 bg-gradient-to-r from-background via-background/80 to-transparent z-20 pointer-events-none"></div>
                        <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-background via-background/80 to-transparent z-20 pointer-events-none"></div>

                        {/* Top Row: Institutional Protcols (Right to Left) */}
                        <div className="flex mb-10 sm:mb-16 px-4">
                            <motion.div
                                animate={{ x: [0, -2200] }}
                                transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                                className="flex gap-6 sm:gap-12 whitespace-nowrap"
                                style={{ width: 'max-content' }}
                            >
                                {[...LIFESTYLE_SERVICES, ...LIFESTYLE_SERVICES].map((section, idx) => (
                                    <div key={idx} className="w-[85vw] sm:w-[500px] p-6 sm:p-10 glass-card bg-white/[0.02] border-white/5 hover:border-accent/40 hover:bg-white/[0.04] transition-all duration-700 relative overflow-hidden group shrink-0 shadow-2xl">
                                        {/* Floating Background Icon */}
                                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-1000">
                                            {idx % 4 === 0 ? <Briefcase size={100} /> : idx % 4 === 1 ? <Star size={100} /> : idx % 4 === 2 ? <Truck size={100} /> : <Award size={100} />}
                                        </div>

                                        <div className="relative z-10">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                                                <h3 className="text-xs font-black text-accent uppercase tracking-[0.4em]">{section.category} Protocol</h3>
                                            </div>
                                            <p className="text-secondary text-sm mb-10 leading-relaxed italic line-clamp-2 font-medium opacity-80">{section.description}</p>
                                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                                {section.services.slice(0, 4).map((service) => (
                                                    <div key={service.id} className="space-y-1 group/item">
                                                        <h4 className="font-bold text-white text-[11px] flex items-center gap-2 group-hover/item:text-accent transition-colors">
                                                            <ArrowRight size={10} className="text-accent/40 opacity-0 group-hover/item:opacity-100 -ml-4 group-hover/item:ml-0 transition-all" />
                                                            {service.title}
                                                        </h4>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Premium Gold Bottom Border Glow */}
                                        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-gradient-to-r from-transparent via-accent to-transparent group-hover:w-full transition-all duration-1000"></div>
                                    </div>
                                ))}
                            </motion.div>
                        </div>

                        {/* Bottom Row: Elite Operations (Left to Right) */}
                        <div className="flex px-4">
                            <motion.div
                                animate={{ x: [-2200, 0] }}
                                transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
                                className="flex gap-6 sm:gap-12 whitespace-nowrap"
                                style={{ width: 'max-content' }}
                            >
                                {[...LIFESTYLE_SERVICES].reverse().concat([...LIFESTYLE_SERVICES].reverse()).map((section, idx) => (
                                    <div key={idx} className="w-[85vw] sm:w-[500px] p-6 sm:p-10 glass-card bg-white/[0.02] border-white/5 hover:border-accent/40 hover:bg-white/[0.04] transition-all duration-700 relative overflow-hidden group shrink-0 shadow-2xl">
                                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-1000">
                                            {idx % 4 === 0 ? <Award size={100} /> : idx % 4 === 1 ? <Truck size={100} /> : idx % 4 === 2 ? <Star size={100} /> : <Briefcase size={100} />}
                                        </div>

                                        <div className="relative z-10">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse"></div>
                                                <h3 className="text-xs font-black text-accent uppercase tracking-[0.4em]">{section.category} Manifest</h3>
                                            </div>
                                            <p className="text-secondary text-sm mb-10 leading-relaxed italic line-clamp-2 font-medium opacity-80">{section.description}</p>
                                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                                {section.services.slice(0, 4).map((service) => (
                                                    <div key={service.id} className="space-y-1 group/item">
                                                        <h4 className="font-bold text-white text-[11px] flex items-center gap-2 group-hover/item:text-accent transition-colors">
                                                            <ArrowRight size={10} className="text-accent/40 opacity-0 group-hover/item:opacity-100 -ml-4 group-hover/item:ml-0 transition-all" />
                                                            {service.title}
                                                        </h4>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-gradient-to-r from-transparent via-accent to-transparent group-hover:w-full transition-all duration-1000"></div>
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Solutions Section - Destination Excellence */}
            <section id="solutions" className="py-24 relative overflow-hidden bg-white/[0.01]">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-20">
                        <motion.span
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            className="text-[10px] font-black text-accent uppercase tracking-[0.5em] mb-4 block"
                        >
                            Local Reach • Local Precision
                        </motion.span>
                        <h2 className="text-4xl lg:text-6xl font-black mb-8 italic uppercase tracking-tighter">
                            Tailored Solutions for <br />
                            <span className="text-accent underline decoration-accent/10 underline-offset-8">Every Destination</span>
                        </h2>
                        <p className="max-w-3xl mx-auto text-secondary leading-relaxed font-medium">
                            Whether provisioning a boutique resort, supplying a private Island, or managing logistics for a heavy-tonnage yacht, our protocols are designed to meet the highest standards of luxury and efficiency.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        {[
                            { name: "Private Estates", icon: Briefcase, image: "/private_estate.png" },
                            { name: "Luxury Resorts", icon: Globe, image: "/luxury_resort.png" },
                            { name: "Private Islands", icon: Anchor, image: "/private_island.png" },
                            { name: "Super Yachts", icon: Activity, image: "/super_yacht.png" }
                        ].map((dest, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: i * 0.1 }}
                                className="group relative aspect-[4/5] sm:aspect-[3/4] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 hover:border-accent/40 transition-all duration-700 cursor-pointer shadow-2xl"
                            >
                                {/* Background Image with Fallback gradient if image not found */}
                                <div className="absolute inset-0 bg-white/5 group-hover:bg-accent/10 transition-colors" />
                                <img
                                    src={dest.image}
                                    alt={dest.name}
                                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-60 group-hover:opacity-80 transition-opacity"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent z-10"></div>

                                {/* Content Overlay */}
                                <div className="absolute inset-0 z-20 p-4 sm:p-8 flex flex-col justify-end">
                                    <div className="mb-2 sm:mb-4 translate-y-2 sm:translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent/10 backdrop-blur-md rounded-lg sm:rounded-xl flex items-center justify-center text-accent mb-2 sm:mb-4 border border-accent/20 group-hover:bg-accent group-hover:text-black transition-all duration-500">
                                            <dest.icon className="w-4 h-4 sm:w-6 sm:h-6" />
                                        </div>
                                        <h3 className="text-xs sm:text-xl font-black uppercase tracking-widest text-white group-hover:text-accent transition-colors leading-tight">{dest.name}</h3>
                                    </div>
                                    <div className="h-[1px] sm:h-[2px] w-0 bg-accent group-hover:w-full transition-all duration-700"></div>
                                    <p className="text-[7px] sm:text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mt-2 sm:mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700 truncate">Explore Protocol</p>
                                </div>

                                {/* Hover Glow */}
                                <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                            </motion.div>
                        ))}
                    </div>

                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <motion.span
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            className="text-[10px] font-black text-accent uppercase tracking-[0.5em] mb-4 block"
                        >
                            SaaS Subscriptions
                        </motion.span>
                        <h2 className="text-4xl lg:text-5xl font-black mb-8 italic uppercase tracking-tighter">
                            Institutional <span className="text-accent underline decoration-accent/10 underline-offset-8">Protocols</span>
                        </h2>
                        <p className="max-w-xl mx-auto text-secondary leading-relaxed font-medium mb-12">
                            Select the operational standard that matches your entity's scale and complexity.
                        </p>

                        {/* Billing Toggle */}
                        <div className="flex items-center justify-center gap-4 mb-12">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${billingCycle === 'monthly' ? 'text-accent' : 'text-muted'}`}>Monthly</span>
                            <button
                                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                                className="w-14 h-7 bg-white/10 rounded-full relative p-1 transition-all border border-white/10"
                            >
                                <div className={`w-5 h-5 bg-accent rounded-full transition-all ${billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'}`} />
                            </button>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${billingCycle === 'yearly' ? 'text-accent' : 'text-muted'}`}>
                                Yearly <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full ml-1">Save 20%</span>
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {accessPlans.map((plan, i) => (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: i * 0.1 }}
                                className={`flex flex-col glass-card relative group transition-all duration-700 overflow-hidden ${plan.id === 'professional' ? 'bg-white/[0.04] border-accent/20 ring-1 ring-accent/10 shadow-[0_20px_50px_-12px_rgba(200,169,106,0.15)]' : 'border-white/5 hover:border-accent/40'} `}
                            >
                                {plan.id === 'professional' && (
                                    <div className="absolute top-0 right-0 px-6 py-2 bg-accent text-black text-[9px] font-black uppercase tracking-widest z-20 rounded-bl-2xl">
                                        Most Popular
                                    </div>
                                )}

                                <div className="p-10 pb-0">
                                    <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-3">{plan.tier || plan.billing_cycle || 'Standard'}</p>
                                    <h3 className="text-3xl font-black uppercase tracking-tighter mb-6">{plan.name}</h3>
                                    <div className="flex items-baseline gap-2 mb-8">
                                        <span className="text-5xl font-black tracking-tight">{billingCycle === 'monthly' ? plan.price : (plan.yearlyPrice || `$${Math.round((parseFloat(String(plan.price).replace(/[^0-9.-]+/g,"")) || 0) * 12 * 0.8).toLocaleString()}`)}</span>
                                        <span className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60">/ {billingCycle === 'monthly' ? 'protocol' : 'annum'}</span>
                                    </div>
                                    <p className="text-[11px] text-secondary leading-relaxed font-medium mb-8 opacity-70">
                                        Comprehensive logistical orchestration for {(plan.tier || plan.name || 'premium').toLowerCase()} entities.
                                    </p>
                                </div>

                                <div className="px-10 space-y-5 mb-12 flex-1 relative">
                                    <div className="absolute left-10 top-0 bottom-0 w-[1px] bg-gradient-to-b from-accent/40 via-accent/10 to-transparent"></div>
                                    {(Array.isArray(plan.features) ? plan.features : (() => { try { return JSON.parse(plan.features || '[]'); } catch { return []; } })()).slice(0, 6).map((f, idx) => (
                                        <div key={idx} className="flex items-start gap-4 pl-6 relative">
                                            <div className="absolute left-[-4px] top-2 w-2 h-2 bg-accent rounded-full border border-black z-10" />
                                            <span className="text-secondary text-xs font-semibold leading-relaxed group-hover:text-white transition-colors">{f}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-10 pt-0">
                                    <button
                                        onClick={() => handleActivate(plan)}
                                        className={`w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3 active:scale-[0.98] ${plan.id === 'platinum' ? 'bg-accent text-black hover:bg-white shadow-[0_10px_30px_-5px_rgba(200,169,106,0.3)]' : 'bg-white/5 border border-white/10 hover:border-accent/50 hover:bg-accent/5 hover:text-accent shadow-xl'} `}
                                    >
                                        Initialize Protocol
                                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>

                                {/* Background Accent Glow */}
                                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-accent/10 transition-all duration-1000"></div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Block Message CTA */}
            <section className="py-32 relative">
                <div className="absolute inset-0 z-0">
                    <img
                        src="/luxury_resort_1.png"
                        alt="Luxury Resort"
                        className="w-full h-full object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background"></div>
                </div>
                <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                    <h2 className="text-4xl lg:text-5xl font-black mb-8 leading-tight">Elevate Your Supply Chain,<br /> <span className="text-accent underline decoration-accent/20 underline-offset-8">Enhance Your Lifestyle</span></h2>
                    <p className="text-lg text-secondary mb-12 leading-relaxed italic">
                        "From logistics to Luxury Provisioning: We serve places where time slows down and standards rise. Executing flawlessly, we curate and coordinate everything that supports your guest experience behind the scenes. Discreet, detailed, and locally connected, we keep your property effortlessly prepared, so every arrival, every stay, and every voyage feels seamless, considered, and unmistakably elevated."
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/signup" className="px-12 py-6 bg-accent text-black font-black uppercase tracking-widest rounded-2xl hover:bg-white transition-all shadow-2xl shadow-accent/20 flex items-center gap-3 group">
                            Join Now <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link to="/login" className="px-12 py-6 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 hover:border-accent/40 transition-all">
                            Login
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-12 text-center md:text-left">
                    <div>
                        <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-[0_0_18px_rgba(200,169,106,0.45)] ring-2 ring-[#C8A96A] ring-offset-2 ring-offset-background">
                                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain scale-[2.4]" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-widest text-[#c8a96a]">ZaneZion</span>
                        </div>
                        <p className="text-xs text-muted max-w-sm">Specialized Supply Chain & Logistics Management for Luxury Hospitality and Maritime.</p>
                    </div>
                    <div className="flex gap-12 font-black uppercase text-[10px] tracking-widest text-secondary">
                        <div className="space-y-4">
                            <p className="text-accent">Operations</p>
                            <Link to="/staff-signup" className="hover:text-white cursor-pointer">Join Our Team</Link>
                            <p className="hover:text-white cursor-pointer">Logistics</p>
                            <p className="hover:text-white cursor-pointer">Procurement</p>
                        </div>
                        <div className="space-y-4">
                            <p className="text-accent">Access</p>
                            <Link to="/signup" className="block hover:text-accent transition-colors">Sign Up</Link>
                            <Link to="/login" className="block hover:text-white transition-colors">Login</Link>
                            <p className="hover:text-white cursor-pointer">Privacy</p>
                        </div>
                    </div>
                </div>
            </footer>

            <Modal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                title={`Mission Protocol Registry: ${selectedPlan?.name} `}
            >
                <form onSubmit={handleRequestSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 group-focus-within:text-accent transition-colors flex items-center gap-2">
                                <Building size={12} className="text-accent" />
                                Corporate Identity
                            </label>
                            <input
                                type="text"
                                required
                                value={requestFormData.companyName}
                                onChange={(e) => setRequestFormData({ ...requestFormData, companyName: e.target.value })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-accent/40 focus:bg-white/[0.07] outline-none text-white transition-all placeholder:text-muted/30"
                                placeholder="Stark Industries / Private Estate"
                            />
                        </div>
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 group-focus-within:text-accent transition-colors flex items-center gap-2">
                                <User size={12} className="text-accent" />
                                Lead Envoy
                            </label>
                            <input
                                type="text"
                                required
                                value={requestFormData.contactPerson}
                                onChange={(e) => setRequestFormData({ ...requestFormData, contactPerson: e.target.value })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-accent/40 focus:bg-white/[0.07] outline-none text-white transition-all placeholder:text-muted/30"
                                placeholder="Head of Operations"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 group-focus-within:text-accent transition-colors flex items-center gap-2">
                                <Mail size={12} className="text-accent" />
                                Secure Communication
                            </label>
                            <input
                                type="email"
                                required
                                value={requestFormData.email}
                                onChange={(e) => setRequestFormData({ ...requestFormData, email: e.target.value })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-accent/40 focus:bg-white/[0.07] outline-none text-white transition-all placeholder:text-muted/30"
                                placeholder="secure@organization.com"
                            />
                        </div>
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 group-focus-within:text-accent transition-colors flex items-center gap-2">
                                <Mail size={12} className="text-accent" />
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={requestFormData.phone}
                                onChange={(e) => setRequestFormData({ ...requestFormData, phone: e.target.value })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-accent/40 focus:bg-white/[0.07] outline-none text-white transition-all placeholder:text-muted/30"
                                placeholder="+1 234 567 890"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 group-focus-within:text-accent transition-colors flex items-center gap-2">
                                <Globe size={12} className="text-accent" />
                                Base of Operations
                            </label>
                            <input
                                type="text"
                                required
                                value={requestFormData.country}
                                onChange={(e) => setRequestFormData({ ...requestFormData, country: e.target.value })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-accent/40 focus:bg-white/[0.07] outline-none text-white transition-all placeholder:text-muted/30"
                                placeholder="e.g. Monaco / Bahamas"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 group-focus-within:text-accent transition-colors flex items-center gap-2">
                                <Settings size={12} className="text-accent" />
                                Entity Classification
                            </label>
                            <div className="relative">
                                <select
                                    value={requestFormData.propertyType}
                                    onChange={(e) => setRequestFormData({ ...requestFormData, propertyType: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-accent/40 focus:bg-white/[0.07] outline-none text-white transition-all appearance-none cursor-pointer"
                                >
                                    <option value="Luxury Resort" className="bg-[#1A1A1A] text-white">Luxury Resort</option>
                                    <option value="Private Estate" className="bg-[#1A1A1A] text-white">Private Estate</option>
                                    <option value="Yacht / Fleet" className="bg-[#1A1A1A] text-white">Yacht / Fleet</option>
                                    <option value="Private Island" className="bg-[#1A1A1A] text-white">Private Island</option>
                                    <option value="Commercial Hub" className="bg-[#1A1A1A] text-white">Commercial Hub</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted/50">
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2 group">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 group-focus-within:text-accent transition-colors flex items-center gap-2">
                                <Zap size={12} className="text-accent" />
                                Projected Throughput
                            </label>
                            <div className="relative">
                                <select
                                    value={requestFormData.throughput}
                                    onChange={(e) => setRequestFormData({ ...requestFormData, throughput: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-accent/40 focus:bg-white/[0.07] outline-none text-white transition-all appearance-none cursor-pointer"
                                >
                                    <option value="Low" className="bg-[#1A1A1A] text-white">Low - Periodic</option>
                                    <option value="Medium" className="bg-[#1A1A1A] text-white">Medium - Regular</option>
                                    <option value="High" className="bg-[#1A1A1A] text-white">High - Continuous</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted/50">
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 group-focus-within:text-accent transition-colors flex items-center gap-2">
                            <Star size={12} className="text-accent" />
                            Institutional Add-ons
                        </label>
                        <div className="relative">
                            <select
                                value={requestFormData.assignedAdminId || ''}
                                onChange={(e) => setRequestFormData({ ...requestFormData, assignedAdminId: e.target.value, addOn: e.target.options[e.target.selectedIndex].text })}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-sm focus:border-accent/40 focus:bg-white/[0.07] outline-none text-white transition-all appearance-none cursor-pointer"
                            >
                                <option value="" className="bg-[#1A1A1A] text-white">No Specific Assignment</option>
                                {admins.map(admin => (
                                    <option key={admin.id} value={admin.id} className="bg-[#1A1A1A] text-white">Assign to: {admin.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted/50">
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 group-focus-within:text-accent transition-colors flex items-center gap-2">
                            <MessageSquare size={12} className="text-accent" />
                            Mission Protocol Requirements
                        </label>
                        <textarea
                            rows={3}
                            value={requestFormData.requirements}
                            onChange={(e) => setRequestFormData({ ...requestFormData, requirements: e.target.value })}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:border-accent/40 focus:bg-white/[0.07] outline-none resize-none text-white transition-all placeholder:text-muted/30"
                            placeholder="Please specify your logistical complexity, fleet volume, or procurement needs..."
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-4 bg-gradient-to-r from-accent via-[#D9C491] to-accent text-black rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 shadow-[0_15px_40px_-8px_rgba(200,169,106,0.35)] hover:shadow-[0_20px_50px_-5px_rgba(200,169,106,0.5)] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden flex items-center justify-center gap-3"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-[-20deg]"></div>
                            {isSubmitting ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                                    <span>Dispatch Institutional Request</span>
                                </>
                            )}
                        </button>

                        <p className="text-[9px] text-center text-muted/40 mt-4 uppercase tracking-[0.1em]">
                            ZaneZion Encryption Active • Secure Channel Protocol 7-Beta
                        </p>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Landing;


