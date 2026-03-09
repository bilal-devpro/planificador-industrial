import React from 'react';

const ResponsiveTabs = ({ tabs, activeTab, setActiveTab, className = '' }) => {
  return (
    <div className={`responsive-tabs ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-4 py-2 font-medium rounded-lg transition ${
            activeTab === tab.id
              ? 'bg-accent-blue text-white shadow-md'
              : 'text-secondary hover:bg-bg-secondary'
          }`}
        >
          {tab.icon && <tab.icon size={16} className="inline mr-1" />}
          {tab.label}
          {tab.badge && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default ResponsiveTabs;