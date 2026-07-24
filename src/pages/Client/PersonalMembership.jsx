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
    // Dynamic Personal Plans from API (all live personal membership plans only)
    const personalPlans = React.useMemo(() => {
        const rawPlans = plansResponse?.data?.plans || (Array.isArray(plansResponse?.data) ? plansResponse.data : (Array.isArray(plansResponse) ? plansResponse : []));
        if (Array.isArray(rawPlans) && rawPlans.length > 0) {
            const filtered = rawPlans.filter(p => {
                let featureObj = {};
                if (p.features != null) {
                    try {
                        featureObj = typeof p.features === 'string' ? JSON.parse(p.features) : p.features;
                    } catch {
                        featureObj = {};
                    }
                }
                const typeStr = String(
                    featureObj.planType || p.planType || featureObj.category || p.category || ''
                ).trim().toLowerCase();

                if (typeStr === 'personal') return true;
                if (typeStr === 'saas' || typeStr === 'business' || typeStr === 'enterprise') return false;

                const nameLower = String(p.name || '').toLowerCase();
                const isExplicitPersonal = typeStr.includes('personal') || nameLower.includes('membership') || nameLower.includes('personal');
                const isExplicitSaas = typeStr.includes('saas') || typeStr.includes('business') || nameLower.includes('gold') || nameLower.includes('enterprise');

                return isExplicitPersonal && !isExplicitSaas;
            });
            if (filtered.length > 0) {
                return filtered.map(found => {
                    const priceNum = parseFloat(found.price || 0);
                    return {
                        id: found.id,
                        name: found.name,
                        priceNum,
                        price: priceNum ? `$${priceNum.toLocaleString(undefined, { minimumFractionDigits: priceNum % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : `$${PERSONAL_MEMBERSHIP_FEE_USD}`,
                        description: found.description || found.features?.description || 'Upgrade your personal portal with a monthly membership fee.'
                    };
                });
            }
        }
        return [{
            id: 'default',
            name: 'ZaneZion personal membership',
            priceNum: PERSONAL_MEMBERSHIP_FEE_USD,
            price: `$${PERSONAL_MEMBERSHIP_FEE_USD}`,
            description: 'Upgrade your personal portal with a monthly membership fee.'
        }];
    }, [plansResponse]);

    const handleUpgrade = async (plan) => {
        if (!currentUser) {
            swalWarning('Sign in required', 'Log in to activate membership.');
            return;
        }

        const userPlanLower = String(currentUser?.plan || '').toLowerCase().trim();
        const cardPlanLower = String(plan?.name || '').toLowerCase().trim();
        if (isActive && userPlanLower === cardPlanLower) return;

        const isSwitch = isActive && userPlanLower !== cardPlanLower;

        const confirmPayment = await swalConfirm(
            isSwitch ? 'Switch Membership Plan' : 'Payment Gateway Redirect',
            isSwitch
                ? `Switch your active personal membership plan to ${plan.name} (${plan.price}/month)?`
                : `Redirect to Payment Gateway to process recurring subscription fee (${plan.price}/month) for ${plan.name}?`
        );
        if (!confirmPayment.isConfirmed) return;

        setIsProcessing(true);
        try {
            await activatePersonalMembership(plan.name, plan.priceNum);
            swalSuccess(
                isSwitch ? 'Membership Plan Switched' : 'Payment Authorized & Membership Activated',
                `Your membership plan has been updated to ${plan.name} (${plan.price}/mo) successfully.`
            );
        } catch (error) {
            swalWarning('Upgrade failed', 'Could not sync upgrade with server. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen space-y-8 animate-fade-in pb-12 max-w-[1080px] mx-auto">
            <div>
                <p className="text-[10px] font-black text-accent uppercase tracking-[0.35em] mb-2">Personal account</p>
                <h1 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tight">Membership Plans</h1>
                <p className="text-secondary text-sm mt-2 max-w-xl">
                    Upgrade your personal portal with a monthly membership. The fee unlocks concierge coordination; each job (events, errands, chauffeur, etc.) is quoted and charged separately.
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center p-12 text-muted">
                    <Loader2 className="animate-spin mr-2" size={24} />
                    <span>Loading membership plans...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {personalPlans.map((plan, index) => {
                        const userPlanLower = String(currentUser?.plan || '').toLowerCase().trim();
                        const cardPlanLower = String(plan.name || '').toLowerCase().trim();

                        const isCurrentPlanActive = isActive && (
                            (userPlanLower && userPlanLower !== 'free' && userPlanLower !== 'premium')
                                ? userPlanLower === cardPlanLower
                                : index === 0
                        );

                        return (
                            <motion.div
                                key={plan.id || index}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`glass-card p-8 border rounded-3xl relative overflow-hidden flex flex-col justify-between ${
                                    isCurrentPlanActive ? 'border-success/40 bg-success/[0.03]' : 'border-accent/20 bg-accent/[0.03]'
                                }`}
                            >
                                <div className="absolute top-0 right-0 w-48 h-48 bg-accent/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                                
                                <div className="relative z-10 space-y-6">
                                    <div>
                                        <div className="flex justify-between items-center gap-2 mb-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">Personal Plan</p>
                                            {isCurrentPlanActive && (
                                                <span className="px-3 py-1 rounded-full bg-success/20 text-success text-[9px] font-black uppercase tracking-wider border border-success/30">
                                                    Active Plan
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">{plan.name}</h2>
                                        <p className="text-accent text-3xl font-black mt-3">
                                            {plan.price}
                                            <span className="text-xs text-muted font-bold not-italic"> / month</span>
                                        </p>
                                        <p className="text-secondary text-xs mt-3 leading-relaxed border-l-2 border-accent/40 pl-4">
                                            <strong className="text-white">Note:</strong> {plan.price}/mo is the membership fee only. Actual service charges (marketplace, logistics, chauffeur hours, sourcing, events, etc.) are billed separately when used.
                                        </p>
                                    </div>
                                </div>

                                <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex flex-col gap-3">
                                    {isCurrentPlanActive ? (
                                        <div className="flex flex-col gap-3">
                                            <div className="px-6 py-4 rounded-2xl border border-success/30 bg-success/10 text-success text-[10px] font-black uppercase tracking-widest text-center">
                                                Active Member
                                                {currentUser?.concierge_membership_since && (
                                                    <p className="text-[9px] font-bold text-secondary normal-case mt-1 tracking-normal">
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
                                                    className="w-full px-6 py-3.5 rounded-2xl bg-danger/10 text-danger border border-danger/30 text-[10px] font-black uppercase tracking-widest hover:bg-danger hover:text-white transition-all shadow-xl shadow-danger/10 flex items-center justify-center"
                                                >
                                                    Cancel Membership
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleUpgrade(plan)}
                                            disabled={isProcessing}
                                            className="relative group overflow-hidden w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#C8A96A] via-[#E2C788] to-[#C8A96A] text-black text-xs font-black uppercase tracking-[0.2em] shadow-[0_4px_20px_rgba(200,169,106,0.25)] hover:shadow-[0_6px_28px_rgba(200,169,106,0.45)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
                                        >
                                            <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
                                            {isProcessing ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin text-black" />
                                                    <span>Processing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={16} className="text-black group-hover:rotate-12 transition-transform duration-300" />
                                                    <span>{isActive ? `Switch to ${plan.name}` : `Activate ${plan.name}`}</span>
                                                    <ChevronRight size={16} className="text-black group-hover:translate-x-1 transition-transform duration-300" />
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <p className="text-[9px] text-muted text-center">
                                        Membership status is securely saved to your account.
                                    </p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

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

