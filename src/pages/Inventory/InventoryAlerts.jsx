import React, { useState } from 'react';
import { AlertTriangle, Bell, Clock, Filter, CheckCircle2 } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';

const InventoryAlerts = () => {
    const { inventoryAlerts, fetchInventoryAlerts, acknowledgeInventoryAlert } = useData();

    React.useEffect(() => {
        fetchInventoryAlerts();
    }, []);
    const [filter, setFilter] = useState('All');

    // Use alerts from context
    const alerts = inventoryAlerts || [];

    const filteredAlerts = filter === 'All'
        ? alerts
        : alerts.filter(a => a.status === filter);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Active Alerts</h1>
                    <p className="text-secondary mt-1">Real-time infrastructure and stock level warnings.</p>
                </div>
                <div className="flex gap-2">
                    {['All', 'Critical', 'Warning'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === f
                                    ? 'bg-accent text-white shadow-lg shadow-accent/20'
                                    : 'bg-white/5 text-secondary hover:bg-white/10'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredAlerts.length > 0 ? (
                    filteredAlerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`glass-card p-6 border-l-4 flex items-center justify-between transition-all hover:translate-x-1 ${alert.status === 'Critical' ? 'border-l-danger bg-danger/5' : 'border-l-warning bg-warning/5'
                                }`}
                        >
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${alert.status === 'Critical' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                                    }`}>
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${alert.status === 'Critical' ? 'bg-danger text-white' : 'bg-warning text-black'
                                            }`}>
                                            {alert.status}
                                        </span>
                                        <span className="text-xs text-muted">Acknowledge Required</span>
                                    </div>
                                    <h3 className="text-lg font-bold">Stock Depletion: {alert.name}</h3>
                                    <p className="text-secondary text-sm">Location: {alert.location} • Current Level: {alert.qty}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right mr-4 hidden md:block">
                                    <p className="text-xs text-muted flex items-center gap-1 justify-end">
                                        <Clock size={12} /> Detected 12m ago
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => acknowledgeInventoryAlert(alert.id)}
                                    className="p-3 bg-white/5 hover:bg-success/20 hover:text-success rounded-xl text-secondary transition-colors"
                                    title="Dismiss alert"
                                >
                                    <CheckCircle2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="glass-card p-12 flex flex-col items-center justify-center text-center opacity-50">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 size={32} className="text-success" />
                        </div>
                        <h3 className="text-xl font-bold">All Systems Clear</h3>
                        <p className="text-secondary max-w-xs mx-auto mt-2">No active stock alerts or infrastructure warnings detected at this time.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="glass-card p-6 border-accent/10">
                    <h3 className="text-lg font-bold mb-4">Alert Distribution</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-secondary">Fuel Levels</span>
                            <span className="text-xs font-bold text-danger">1 Active</span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-danger" style={{ width: '80%' }} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-secondary">Catering Supplies</span>
                            <span className="text-xs font-bold text-warning">2 Active</span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                            <div className="h-full bg-warning" style={{ width: '30%' }} />
                        </div>
                    </div>
                </div>
                <div className="glass-card p-6 bg-accent/5 border-accent/20">
                    <h3 className="text-lg font-bold mb-2">Automated Provisioning</h3>
                    <p className="text-sm text-secondary mb-4">Based on current burn rates, the system suggests initializing 3 restock orders.</p>
                    <button className="btn-primary w-full flex items-center justify-center gap-2">
                        <Bell size={16} /> Reorder Critical Items
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InventoryAlerts;
