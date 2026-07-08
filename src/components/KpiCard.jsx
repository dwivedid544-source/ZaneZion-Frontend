import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const KpiCard = ({ label, value, change, type, icon: Icon, color, compact }) => {
  const getTrendIcon = () => {
    if (type === 'increase') return <TrendingUp size={16} className="text-success" />;
    if (type === 'decrease') return <TrendingDown size={16} className="text-danger" />;
    return <Minus size={16} className="text-warning" />;
  };

  const getValueColor = () => {
    if (color) return color;
    if (type === 'increase') return 'text-accent';
    if (type === 'decrease') return 'text-danger';
    if (type === 'info') return 'text-info';
    if (type === 'success') return 'text-success';
    return 'text-white';
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="glass-card p-4 sm:p-6 flex flex-col justify-between"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-accent/10 rounded-xl text-accent">
          {Icon && <Icon size={24} />}
        </div>
        {!compact && (
        <div className="flex items-center gap-1 text-xs font-semibold">
          {getTrendIcon()}
          <span className={type === 'increase' ? 'text-success' : type === 'decrease' ? 'text-danger' : 'text-warning'}>
            {change}
          </span>
        </div>
        )}
      </div>

      <div>
        <p className="text-secondary text-[9px] sm:text-[10px] uppercase font-black tracking-wider mb-1.5 truncate opacity-70">{label}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className={`text-2xl sm:text-3xl font-black font-heading italic tracking-tighter ${getValueColor()}`}>{value}</h3>
        </div>
      </div>
    </motion.div>
  );
};

export default KpiCard;
