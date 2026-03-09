import React from 'react';
import { Tag, Hash, CheckCircle, AlertTriangle, Package } from 'lucide-react';

const LoteBadge = ({ valor, showFull = false, showCapsules = false, capsulesCount = null }) => {
  if (!valor) return <span className="text-secondary">-</span>;
  
  const { tipo, ofNumero, loteNumero } = extraerInfoOFLote(valor);
  
  const getBadgeStyle = () => {
    switch(tipo) {
      case 'OF':
        return 'bg-blue-900/30 border-blue-800 text-blue-300';
      case 'Lote':
        return 'bg-purple-900/30 border-purple-800 text-purple-300';
      case 'Papel':
        return 'bg-gray-800/50 text-gray-400 line-through';
      default:
        return 'bg-gray-800 text-gray-400';
    }
  };
  
  const getIcon = () => {
    switch(tipo) {
      case 'OF':
        return <Hash size={12} className="mr-0.5" />;
      case 'Lote':
        return <Tag size={12} className="mr-0.5" />;
      case 'Papel':
        return <Package size={12} className="mr-0.5" />;
      default:
        return <AlertTriangle size={12} className="mr-0.5" />;
    }
  };
  
  return (
    <div className="flex flex-col items-start">
      <span className={`badge inline-flex items-center ${getBadgeStyle()}`}>
        {getIcon()}
        {tipo === 'OF' ? (
          <span className="font-mono text-xs">{showFull ? `OF-${ofNumero}` : ofNumero}</span>
        ) : tipo === 'Lote' ? (
          <span className="font-mono text-xs">
            {showFull ? loteNumero : `${ofNumero}...`}
          </span>
        ) : tipo === 'Papel' ? (
          <span className="text-xs">Papel (excluido)</span>
        ) : (
          <span className="text-xs">Desconocido</span>
        )}
      </span>
      {showCapsules && capsulesCount !== null && (
        <span className="text-[10px] text-secondary mt-0.5">
          {capsulesCount.toLocaleString()} cápsulas
        </span>
      )}
    </div>
  );
};

// Función auxiliar (misma lógica que backend)
function extraerInfoOFLote(valor) {
  if (!valor || typeof valor !== 'string') {
    return { tipo: 'Desconocido', ofNumero: null, loteNumero: null };
  }

  const valorLimpio = valor.trim();
  
  // Detectar papel (empieza con Y)
  if (valorLimpio.startsWith('Y')) {
    return { tipo: 'Papel', ofNumero: null, loteNumero: valorLimpio };
  }
  
  if (/^\d{1,10}$/.test(valorLimpio)) {
    return { tipo: 'OF', ofNumero: valorLimpio, loteNumero: null };
  }
  
  const match = valorLimpio.match(/^(\d{6})/);
  if (match) {
    return { 
      tipo: 'Lote', 
      ofNumero: match[1], 
      loteNumero: valorLimpio 
    };
  }
  
  return { tipo: 'Desconocido', ofNumero: null, loteNumero: valorLimpio };
}

export default LoteBadge;