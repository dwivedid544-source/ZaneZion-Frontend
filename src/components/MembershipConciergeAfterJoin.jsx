import React from 'react';
import { Check, Calendar, ClipboardList, Gem } from 'lucide-react';
import { PERSONAL_MEMBERSHIP_CONCIERGE_SERVICES } from '../utils/data';

const BLOCK_ICONS = {
    events: Calendar,
    guest: ClipboardList,
    other: Gem,
};

/**
 * Lists concierge-style services that are coordinated for the member after they subscribe.
 * Copy is driven from `utils/data.js` — `PERSONAL_MEMBERSHIP_CONCIERGE_SERVICES`.
 */
const MembershipConciergeAfterJoin = ({
    heading = 'Concierge services (after membership)',
    intro = 'Once you are an active member, you can request these through your concierge channel. Service fulfilment is quoted and billed separately from the monthly membership fee.',
}) => (
    <div className="space-y-5">
        <div>
            <h3 className="text-lg md:text-xl font-black text-white tracking-tight">{heading}</h3>
            <p className="text-secondary text-xs mt-2 max-w-3xl leading-relaxed">{intro}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PERSONAL_MEMBERSHIP_CONCIERGE_SERVICES.map((block) => {
                const Icon = BLOCK_ICONS[block.key] || Check;
                return (
                    <div
                        key={block.key}
                        className="glass-card p-6 border border-white/10 rounded-2xl bg-white/[0.02] flex flex-col gap-4"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0">
                                <Icon size={20} />
                            </div>
                            <h4 className="text-sm font-black text-white uppercase tracking-widest leading-tight">{block.title}</h4>
                        </div>
                        {block.tagline && (
                            <p className="text-[11px] text-muted -mt-2 leading-snug">{block.tagline}</p>
                        )}
                        <ul className="space-y-2.5 flex-1">
                            {block.items.map((line) => (
                                <li key={line} className="flex items-start gap-2 text-[11px] text-secondary leading-relaxed">
                                    <Check className="text-accent shrink-0 mt-0.5" size={14} />
                                    <span>{line}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    </div>
);

export default MembershipConciergeAfterJoin;


