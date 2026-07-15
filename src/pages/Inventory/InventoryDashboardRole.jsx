import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import KpiCard from '../../components/KpiCard';
import StatusBadge from '../../components/StatusBadge';
import {
  Package, AlertTriangle, Plus, ClipboardList,
  Warehouse, ArrowRight, Box, Store,
} from 'lucide-react';

import { useData } from '../../context/GlobalDataContext';
import { useNavigate } from 'react-router-dom';
import DepartmentWorkflowSection from '../../components/DepartmentWorkflowSection';


/** Parse qty whether API returns number or string like "50 units". */
function parseQty(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseInt(String(value).replace(/[^\d.-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

const InventoryDashboardRole = () => {
  const navigate = useNavigate();
  const {
    inventory,
    fetchInventory,
    inventoryAlerts,
    fetchInventoryAlerts,
    warehouses,
    fetchWarehouses,
  } = useData();

  React.useEffect(() => {
    fetchInventory();
    fetchInventoryAlerts();
    fetchWarehouses();
  }, [fetchInventory, fetchInventoryAlerts, fetchWarehouses]);

  const lowStockAlerts = useMemo(() => {
    return inventory
      .filter(item => {
        const qty = parseQty(item.qty ?? item.quantity);
        const threshold = item.reorderLevel || 5;
        return qty <= threshold;
      })
      .map(item => {
        const qty = parseQty(item.qty ?? item.quantity);
        return {
          item: item.name || 'Unknown Item',
          count: qty,
          unit: 'Units',
          type: qty === 0 ? 'danger' : 'warning'
        };
      });
  }, [inventory]);

  const totalSkus = inventory.length;
  const totalUnitsOnHand = useMemo(
    () => inventory.reduce((acc, row) => acc + parseQty(row.qty ?? row.quantity), 0),
    [inventory],
  );
  const lowOrCriticalLines = useMemo(
    () => inventory.filter((i) => ['Warning', 'Critical'].includes(String(i.status || ''))).length,
    [inventory],
  );
  const dashboardAttentionCount = Math.max(
    (inventoryAlerts || []).length,
    lowOrCriticalLines,
  );

  const maxQtyDisplay = useMemo(() => {
    const nums = inventory.map((i) => parseQty(i.qty ?? i.quantity));
    const m = Math.max(1, ...nums);
    return m;
  }, [inventory]);

  const topStockRows = useMemo(() => {
    return [...inventory]
      .sort((a, b) => parseQty(b.qty ?? b.quantity) - parseQty(a.qty ?? a.quantity))
      .slice(0, 6);
  }, [inventory]);

  return (
    <div className="space-y-8 w-full min-w-0 max-w-full overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Inventory Hub</h1>
          <p className="text-secondary text-xs md:text-sm mt-1">
            Live stock counts, alerts, and warehouse coverage from your API data.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
          <Link
            to="/dashboard/inventory-alerts"
            className="btn-secondary flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] sm:text-xs py-3 px-6"
          >
            <ClipboardList size={16} /> Alerts &amp; thresholds
          </Link>
          <button
            type="button"
            className="btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] sm:text-xs py-3 px-6"
            onClick={() => navigate('/dashboard/inventory?action=entry&type=Marketplace')}
          >
            <Plus size={16} /> New stock entry
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
        <KpiCard label="SKU count" value={String(totalSkus)} icon={Box} compact type="neutral" />
        <KpiCard label="Units on hand" value={totalUnitsOnHand.toLocaleString()} icon={Package} compact type="info" />
        <KpiCard label="Needs attention" value={String(dashboardAttentionCount)} icon={AlertTriangle} compact type="neutral" />
        <KpiCard label="Warehouses" value={String(warehouses?.length ?? 0)} icon={Store} compact type="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 min-w-0">
        <div className="lg:col-span-2 glass-card p-5 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h3 className="text-lg font-bold">Highest stock lines</h3>
            <Link
              to="/dashboard/inventory"
              className="text-xs font-bold text-accent hover:underline inline-flex items-center gap-1 shrink-0"
            >
              Full inventory <ArrowRight size={14} />
            </Link>
          </div>
          {topStockRows.length === 0 ? (
            <p className="text-secondary text-sm py-8 text-center">
              No inventory rows yet. Add stock or sync your catalog from the Inventory page.
            </p>
          ) : (
            <div className="space-y-6">
              {topStockRows.map((item, idx) => {
                const q = parseQty(item.qty ?? item.quantity);
                const pct = Math.min(100, Math.round((q / maxQtyDisplay) * 100));
                return (
                  <div key={item.id ?? idx} className="space-y-2 min-w-0">
                    <div className="flex justify-between items-center gap-3 min-w-0">
                      <span className="font-bold text-sm truncate">{item.name}</span>
                      <span
                        className={`text-xs font-bold shrink-0 tabular-nums ${
                          item.status === 'Critical' ? 'text-danger' : 'text-accent'
                        }`}
                      >
                        {Number.isFinite(q) ? q.toLocaleString() : item.qty}
                      </span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-700 ${
                          item.status === 'Critical' ? 'bg-danger' : 'bg-accent'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={item.status} />
                      {(item.location || item.warehouse_name) && (
                        <span className="text-[10px] text-secondary truncate">
                          {item.location || item.warehouse_name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link
            to="/dashboard/inventory"
            className="w-full mt-8 btn-secondary py-3 text-xs flex items-center justify-center gap-2"
          >
            Open inventory ledger <ArrowRight size={14} />
          </Link>
        </div>

        <div className="min-w-0">
          <div className="glass-card p-5 sm:p-6 border-danger/10 min-w-0">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="text-danger shrink-0" size={20} /> Low-stock alerts
            </h3>
            {lowStockAlerts.length === 0 ? (
              <p className="text-secondary text-sm py-4">
                No active alerts from the API. When items breach thresholds, they appear here.
              </p>
            ) : (
              <ul className="space-y-3">
                {lowStockAlerts.slice(0, 8).map((alert, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-3 p-4 bg-white/[0.02] border border-border rounded-xl min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{alert.item}</p>
                      <p className="text-xs text-secondary mt-0.5 tabular-nums">
                        {alert.count} {alert.unit}
                      </p>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0 ${
                        alert.type === 'danger'
                          ? 'bg-danger/20 text-danger'
                          : 'bg-warning/20 text-warning'
                      }`}
                    >
                      {alert.type === 'danger' ? 'Critical' : 'Warning'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/dashboard/inventory-alerts"
              className="w-full mt-6 btn-secondary py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
            >
              View all alerts <ArrowRight size={14} />
            </Link>
          </div>

          {(warehouses?.length ?? 0) > 0 && (
            <div className="glass-card p-5 sm:p-6 mt-6 min-w-0">
              <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                <Warehouse size={16} /> Warehouse coverage
              </h3>
              <ul className="space-y-2 text-sm">
                {warehouses.slice(0, 6).map((w) => (
                  <li key={w.id} className="flex justify-between gap-2 py-2 border-b border-white/5 last:border-0 min-w-0">
                    <span className="font-bold truncate">{w.name || w.warehouse_name || `WH-${w.id}`}</span>
                    <span className="text-secondary text-xs shrink-0">
                      {inventory.filter(
                        (i) =>
                          String(i.warehouse_id) === String(w.id) ||
                          (i.location || i.warehouse_name) === (w.name || w.warehouse_name),
                      ).length}{' '}
                      SKUs
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/dashboard/warehouses"
                className="w-full mt-4 text-center text-xs font-bold text-accent hover:underline inline-flex items-center justify-center gap-1"
              >
                Manage warehouses <ArrowRight size={12} />
              </Link>
            </div>
          )}
      </div>

      <DepartmentWorkflowSection departmentKey="inventory" departmentLabel="Inventory" />
    </div>
  );
};

export default InventoryDashboardRole;
