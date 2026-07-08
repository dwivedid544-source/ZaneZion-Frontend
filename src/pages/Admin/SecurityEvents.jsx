import React, { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, MapPin, User, FileText } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';

const SecurityEvents = () => {
    const { securityEvents, fetchSecurityEvents, resolveSecurityEvent } = useData();
    const [filter, setFilter] = useState('All'); // 'All', 'Active', 'Resolved'

    useEffect(() => {
        if (fetchSecurityEvents) fetchSecurityEvents();
    }, [fetchSecurityEvents]);

    const handleResolve = async (id) => {
        await resolveSecurityEvent(id);
    };

    const filteredEvents = (securityEvents || []).filter(e => {
        if (filter === 'Active') return e.status !== 'Resolved';
        if (filter === 'Resolved') return e.status === 'Resolved';
        return true;
    });

    return (
        <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase mb-2 md:mb-3">
                        Security <span className="text-danger">Incidents</span>
                    </h1>
                    <p className="text-sm text-secondary font-medium tracking-wide">
                        Monitor and resolve security panics and breaches reported by personnel.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 p-1.5 bg-sidebar/50 backdrop-blur-xl border border-white/5 rounded-2xl w-max">
                {['All', 'Active', 'Resolved'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider
                            ${filter === f 
                                ? 'bg-danger text-white shadow-lg' 
                                : 'text-secondary hover:text-white hover:bg-white/5'}`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Events List */}
            <div className="space-y-4">
                {filteredEvents.length === 0 ? (
                    <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
                        <ShieldAlert size={48} className="text-white/10 mb-4" />
                        <h3 className="text-xl font-bold text-white tracking-tight">No Security Events Found</h3>
                        <p className="text-sm text-secondary">All clear. No incidents match the current filter.</p>
                    </div>
                ) : (
                    filteredEvents.map(event => {
                        const isResolved = event.status === 'Resolved';
                        const isPanic = event.eventType === 'PANIC';
                        const colorClass = isResolved ? 'text-success' : (isPanic ? 'text-danger' : 'text-warning');
                        const bgClass = isResolved ? 'bg-success/10 border-success/20' : (isPanic ? 'bg-danger/10 border-danger/30' : 'bg-warning/10 border-warning/30');

                        return (
                            <div key={event.id} className={`p-6 rounded-3xl border transition-all ${bgClass} relative overflow-hidden group`}>
                                {!isResolved && isPanic && (
                                    <div className="absolute top-0 right-0 p-4">
                                        <span className="flex h-3 w-3 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-danger"></span>
                                        </span>
                                    </div>
                                )}
                                
                                <div className="flex flex-col lg:flex-row gap-6">
                                    {/* Icon & Type */}
                                    <div className="flex items-center gap-4 lg:w-1/4 shrink-0">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${isResolved ? 'bg-success/20 border-success/30 text-success' : (isPanic ? 'bg-danger/20 border-danger/30 text-danger' : 'bg-warning/20 border-warning/30 text-warning')}`}>
                                            {isPanic ? <AlertTriangle size={24} /> : <ShieldAlert size={24} />}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-1">Incident Type</p>
                                            <h3 className={`text-xl font-black italic tracking-tight uppercase ${colorClass}`}>
                                                {event.eventType}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-1.5"><MapPin size={12} /> Location</p>
                                            <p className="text-sm font-bold text-white">{event.location || 'Unknown'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-1.5"><User size={12} /> Reporter</p>
                                            <p className="text-sm font-bold text-white">{event.reporter}</p>
                                        </div>
                                        <div className="space-y-1 md:col-span-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-1.5"><FileText size={12} /> Intelligence / Details</p>
                                            <p className="text-sm font-medium text-white bg-black/20 p-3 rounded-xl border border-white/5">{event.details || 'No details provided.'}</p>
                                        </div>
                                    </div>

                                    {/* Actions & Meta */}
                                    <div className="lg:w-48 shrink-0 flex flex-col justify-between items-start lg:items-end gap-4 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
                                        <div className="w-full">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-1 lg:text-right">Timestamp</p>
                                            <p className="text-sm font-bold text-white lg:text-right flex items-center lg:justify-end gap-1.5">
                                                <Clock size={14} className="text-accent" />
                                                {new Date(event.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        
                                        {!isResolved ? (
                                            <button
                                                onClick={() => handleResolve(event.id)}
                                                className="w-full py-3 bg-success hover:bg-success/80 text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-success/20 flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle size={16} /> Mark Resolved
                                            </button>
                                        ) : (
                                            <div className="w-full py-3 bg-white/5 border border-success/20 text-success rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                                <CheckCircle size={16} /> Resolved
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default SecurityEvents;
