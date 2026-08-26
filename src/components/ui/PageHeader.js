import React from 'react';

const PageHeader = ({ icon: Icon, title, subtitle, actions }) => (
  <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
    <div className="flex items-start gap-3 min-w-0">
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-900 leading-tight break-words">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5 break-words">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
