import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const StatusBadge = ({ status, className }) => {
  const getStatusStyles = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
      case 'active':
      case 'stable':
      case 'approved':
      case 'assigned':
      case 'paid':
        return 'bg-success/10 text-success border-success/20';
      case 'pending':
      case 'pending review':
      case 'pending_review':
      case 'created':
      case 'admin_review':
      case 'concierge':
      case 'preparing':
      case 'warning':
      case 'planning':
      case 'pending receipt approval':
      case 'partially_paid':
      case 'partially paid':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'on way':
      case 'picked up':
      case 'en route':
      case 'en_route':
      case 'in transit':
      case 'info':
      case 'operation':
      case 'operations':
      case 'procurement':
      case 'inventory':
      case 'logistics':
      case 'in progress':
      case 'in_progress':
      case 'partially received':
      case 'generated':
      case 'sent':
      case 'draft':
        return 'bg-info/10 text-info border-info/20';
      case 'danger':
      case 'critical':
      case 'out of stock':
      case 'delayed':
      case 'inactive':
      case 'cancelled':
      case 'rejected':
      case 'overdue':
        return 'bg-danger/10 text-danger border-danger/20';
      case 'received':
        return 'bg-success/10 text-success border-success/20';
      default:
        return 'bg-muted/10 text-muted border-muted/20';
    }
  };

  return (
    <span className={twMerge(
      'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap inline-flex items-center justify-center',
      getStatusStyles(status),
      className
    )}>
      {String(status || '').replace(/_/g, ' ')}
    </span>
  );
};

export default StatusBadge;
