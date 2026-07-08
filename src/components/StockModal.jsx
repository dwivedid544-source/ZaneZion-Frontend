import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Package, Hash, Warehouse, Tag, Activity } from 'lucide-react';
import { useData } from '../context/GlobalDataContext';
import { marketplaceCategorySelectOptions } from '../utils/data';

const StockModal = ({ isOpen, onClose, onSave }) => {
  const { warehouses } = useData();
  const defaultWh = (warehouses && warehouses.length > 0) ? warehouses[0].name : 'Warehouse A';

  const [formData, setFormData] = useState({
    productName: '',
    quantity: '',
    warehouseLocation: defaultWh,
    warehouseId: (warehouses && warehouses.length > 0) ? warehouses[0].id : null,
    category: 'General',
    status: 'Stable'
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        productName: '',
        quantity: '',
        warehouseLocation: defaultWh,
        warehouseId: (warehouses && warehouses.length > 0) ? warehouses[0].id : null,
        category: 'General',
        status: 'Stable'
      });
    }
  }, [isOpen, defaultWh, warehouses]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Stock"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Product Name</label>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                placeholder="Enter product name"
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Quantity</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <input
                type="text"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="e.g. 50 Units"
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none"
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Warehouse Location</label>
            <div className="relative">
              <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <select
                value={formData.warehouseLocation}
                onChange={(e) => {
                  const name = e.target.value;
                  const wh = warehouses.find(w => w.name === name);
                  setFormData({ ...formData, warehouseLocation: name, warehouseId: wh ? wh.id : null });
                }}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none appearance-none font-bold"
                required
              >
                {warehouses.length > 0 ? (
                  warehouses.map(wh => <option key={wh.id} value={wh.name}>{wh.name}</option>)
                ) : (
                  <option value="General Storage">General Storage</option>
                )}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Category</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-muted z-10 pointer-events-none" size={14} />
              <select
                value={(() => {
                  const opts = marketplaceCategorySelectOptions(formData.category);
                  const v = String(formData.category ?? '').trim() || 'General';
                  return opts.includes(v) ? v : 'General';
                })()}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none appearance-none font-bold"
                required
              >
                {marketplaceCategorySelectOptions(formData.category).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="col-span-full space-y-1">
            <label className="text-[10px] font-bold text-muted uppercase">Status</label>
            <div className="relative">
              <Activity className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:border-accent outline-none appearance-none"
              >
                <option value="Stable">Stable</option>
                <option value="Low">Low</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-6 border-t border-border/50">
          <button type="button" onClick={onClose} className="btn-secondary h-11 px-8 rounded-xl font-bold">Cancel</button>
          <button type="submit" className="btn-primary h-11 px-8 rounded-xl font-bold">Save Changes</button>
        </div>
      </form>
    </Modal>
  );
};

export default StockModal;


