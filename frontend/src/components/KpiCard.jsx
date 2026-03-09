import React from 'react';

const KpiCard = ({ title, value, subtitle, icon: Icon, trend, color = 'text-accent-blue' }) => {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-secondary text-sm">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-sm text-secondary mt-1">{subtitle}</p>}
        </div>
        {Icon && <Icon className={`${color}`} size={32} />}
      </div>
      {trend && (
        <div className={`mt-2 text-sm font-medium ${
          trend.direction === 'up' ? 'text-accent-green' : 'text-accent-red'
        }`}>
          {trend.value} {trend.label}
        </div>
      )}
    </div>
  );
};

export default KpiCard;