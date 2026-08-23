import React from 'react';

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6">
    {Icon && (
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6" />
      </div>
    )}
    <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
    {description && <p className="text-sm text-slate-400 mt-1 max-w-sm">{description}</p>}
  </div>
);

export default EmptyState;
