import React, { useState } from 'react';
import { swalSuccess, swalWarning, swalConfirm } from '../../utils/swal';
import { ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useData } from '../../context/GlobalDataContext';
import { PERSONAL_MEMBERSHIP_FEE_USD } from '../../utils/data';
import MembershipConciergeAfterJoin from '../../components/MembershipConciergeAfterJoin';
import { normalizeRole } from '../../utils/authUtils';
import { usePlans } from '../../hooks/api/usePlans';

const PersonalMembership = () => {
    const { currentUser, activatePersonalMembership, cancelPersonalMembership } = useData();
    const { data: plansResponse, isLoading } = usePlans(1, 50);
    const [isProcessing, setIsProcessing] = useState(false);

    const isActive = !!(currentUser?.concierge_member || currentUser?.conciergeMembership);
    const isAdmin = ['admin', 'superadmin'].includes(normalizeRole(currentUser?.role));

    // Dynamic Personal Plan from API (or fallback to default)
    const personalPlan = React.useMemo(() => {
        const rawPlans = plansResponse?.data?.plans || (Array.isArray(plansResponse?.data) ? plansResponse.data : []);
        if (Array.isArray(rawPlans) && rawPlans.length > 0) {
            const found = rawPlans.find(p => (p.planType || p.category || p.name || '').toLowerCase().includes('personal'));
            if (found) {
                const priceNum = parseFloat(found.price || 0);
                return {
                    name: found.name,
                    price: priceNum ? `$${priceNum.toLocaleString(undefined, { minimumFractionDigits: priceNum % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : `$${PERSONAL_MEMBERSHIP_FEE_USD}`,
                    description: found.description || ''
                };
            }
        }
        return {
            name: 'ZaneZion personal membership',
            price: `$${PERSONAL_MEMBERSHIP_FEE_USD}`,
            description: ''
        };
    }, [plansResponse]);

    const handleUpgrade = async () => {
        if (!currentUser) {
            swalWarning('Sign in required', 'Log in to activate membership.');
            return;
        }
        if (isActive) return;

        const confirmPayment = await swalConfirm(
            'Payment Gateway Redirect',
            `Redirect to Payment Gateway to process recurring subscription fee (${personalPlan.price}/month) for ${personalPlan.name}?`
        );
        if (!confirmPayment.isConfirmed) return;

        setIsProcessing(true);
        try {
            await activatePersonalMembership();
            swalSuccess(
                'Payment Authorized & Membership Activated',
                `Your transaction for ${personalPlan.name} (${personalPlan.price}/mo) was authorized successfully. Access to Strategic Procurement and Concierge Services is now unlocked!`
            );
        } catch (error) {
            swalWarning('Upgrade failed', 'Could not sync upgrade with server. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen space-y-8 animate-fade-in pb-12 max-w-[960px] mx-auto">
            <div>
                <p className="text-[10px] font-black text-accent uppercase tracking-[0.35em] mb-2">Personal account</p>
                <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tight">Membership</h1>
                <p className="text-secondary text-sm mt-2 max-w-xl">
                    Upgrade your personal portal with a monthly membership. The fee unlocks concierge coordination; each job (events, errands, chauffeur, etc.) is quoted and charged separately.
                </p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-8 lg:p-10 border border-accent/20 bg-accent/[0.03] rounded-3xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-start gap-10 justify-between">
                    <div className="space-y-6 max-w-lg">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent mb-2">Upgrade my account</p>
                            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">{personalPlan.name}</h2>
                            <p className="text-accent text-3xl font-black mt-3">
                                {personalPlan.price}
                                <span className="text-sm text-muted font-bold not-italic"> / month</span>
                            </p>
                            <p className="text-secondary text-xs mt-3 leading-relaxed border-l-2 border-accent/40 pl-4">
                                <strong className="text-white">Note:</strong> {personalPlan.price}/mo is the membership fee only. Actual service charges (marketplace, logistics, chauffeur hours, sourcing, events, etc.) are billed separately when you use them.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-4 lg:items-end shrink-0 w-full lg:w-auto">
                        {isActive ? (
                            <div className="flex flex-col gap-3">
                                <div className="px-8 py-4 rounded-2xl border border-success/30 bg-success/10 text-success text-[10px] font-black uppercase tracking-widest text-center lg:text-right w-full lg:w-auto">
                                    Active member
                                    {currentUser?.concierge_membership_since && (
                                        <p className="text-[9px] font-bold text-secondary normal-case mt-2 tracking-normal">
                                            Since {currentUser.concierge_membership_since}
                                        </p>
                                    )}
                                </div>
                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (window.confirm("Are you sure you want to cancel the membership?")) {
                                                try {
                                                    await cancelPersonalMembership();
                                                    swalSuccess('Membership Cancelled', 'The membership has been cancelled.');
                                                } catch (err) {
                                                    swalWarning('Error', 'Failed to cancel membership.');
                                                }
                                            }
                                        }}
                                        className="w-full lg:w-auto px-8 py-4 rounded-2xl bg-danger/10 text-danger border border-danger/30 text-[10px] font-black uppercase tracking-widest hover:bg-danger hover:text-white transition-all shadow-xl shadow-danger/10 inline-flex items-center justify-center"
                                    >
                                        Cancel Membership
                                    </button>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleUpgrade}
                                disabled={isProcessing}
                                className="w-full lg:w-auto px-10 py-5 rounded-2xl bg-accent text-black text-[11px] font-black uppercase tracking-[0.25em] hover:brightness-110 transition-all shadow-xl shadow-accent/20 inline-flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Redirecting...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} />
                                        Upgrade my account
                                        <ChevronRight size={18} />
                                    </>
                                )}
                            </button>
                        )}
                        <p className="text-[10px] text-muted text-center lg:text-right max-w-[280px] lg:ml-auto">
                            Membership status is securely saved to your account and persists across sessions.
                        </p>
                    </div>
                </div>
            </motion.div>

            <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="glass-card p-8 lg:p-10 border border-white/10 rounded-3xl"
            >
                <MembershipConciergeAfterJoin
                    heading="Concierge services (available after membership)"
                    intro="After you subscribe, these service categories are opened for you through the concierge workflow. Membership is access and coordination; each request is scoped and priced on its own."
                />
            </motion.section>
        </div>
    );
};

export default PersonalMembership;

