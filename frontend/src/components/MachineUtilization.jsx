import React from 'react';
import { Cpu, AlertTriangle } from 'lucide-react';

const MachineUtilization = ({ machines = [] }) => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title flex items-center gap-2">
          <Cpu size={20} />
          Utilización de Máquinas
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {machines.map((machine) => {
          const utilization = machine.utilization || 0;
          const getColor = () => {
            if (utilization > 85) return 'bg-red-500';
            if (utilization > 60) return 'bg-yellow-500';
            return 'bg-green-500';
          };
          
          return (
            <div key={machine.id} className="border border-border-color rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-bold text-lg flex items-center gap-2">
                    <Cpu size={20} className={machine.generacion === 'G1' ? 'text-blue-400' : 'text-purple-400'} />
                    {machine.name}
                  </div>
                  <div className="text-sm text-secondary">{machine.type}</div>
                </div>
                <span className={`badge ${
                  utilization > 85 ? 'badge-atrasado' : 
                  utilization > 60 ? 'badge-proximo' : 'badge-completado'
                }`}>
                  {utilization}% utilización
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Órdenes:</span>
                  <span className="font-bold">{machine.orders || 0}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Unidades:</span>
                  <span className="font-bold">{(machine.units || 0).toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Tiempo Est.:</span>
                  <span className="font-bold">
                    {machine.time ? `${Math.floor(machine.time / 60)}h ${machine.time % 60}m` : '-'}
                  </span>
                </div>
                
                <div className="mt-2">
                  <div className="w-full bg-bg-secondary rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getColor()}`}
                      style={{ width: `${Math.min(100, utilization)}%` }}
                    ></div>
                  </div>
                </div>
                
                {utilization > 85 && (
                  <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded-lg text-xs">
                    <div className="flex items-center gap-1 text-red-400">
                      <AlertTriangle size={14} />
                      <span>ALTA SATURACIÓN - Requiere atención</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MachineUtilization;