import React from 'react';
import { Lock, CheckCircle2, Clock, CircleDashed, XCircle } from 'lucide-react';

export const STATUS_STYLES = {
  locked: { label: 'Locked', className: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200', icon: Lock },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', icon: CheckCircle2 },
  'in-progress': { label: 'In progress', className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', icon: Clock },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', icon: CircleDashed },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 ring-1 ring-red-200', icon: XCircle },
};

const StatusBadge = ({ status, size = 'sm' }) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const Icon = style.icon;
  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses} ${style.className}`}>
      <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />
      {style.label}
    </span>
  );
};

export default StatusBadge;
