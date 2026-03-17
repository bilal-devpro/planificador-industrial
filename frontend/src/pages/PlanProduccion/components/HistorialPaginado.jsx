/**
 * Componente de Historial con Paginación
 * - 20 registros por página (fijo)
 * - Controles de navegación
 * - Solo órdenes completadas
 */

import React from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { formatearFecha, formatearTiempo } from '../utils/formateo';
import { ESTADOS_PLAN } from '../utils/constantes';

export default function HistorialPaginado({
  pagination = {},
  planes = [],
  onPageChange = () => {},
  loading = false
}) {
  const {
    pagina_actual = 1,
    total_paginas = 1,
    total_registros = 0
  } = pagination;

  const handlePrevious = () => {
    if (pagina_actual > 1) {
      onPageChange(pagina_actual - 1);
    }
  };

  const handleNext = () => {
    if (pagina_actual < total_paginas) {
      onPageChange(pagina_actual + 1);
    }
  };

  if (loading) {
    return (
      <div className="card p-12 text-center">
        <div className="loading mr-3 inline-block"></div>
        <span>Cargando historial...</span>
      </div>
    );
  }

  if (!planes || planes.length === 0) {
    return (
      <div className="card p-12 text-center text-secondary">
        <History size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No hay órdenes completadas</p>
        <p className="text-sm mt-1">El historial mostrará aquí las órdenes una vez sean completadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabla */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary/50 border-b border-border-color">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Producto</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Cliente</th>
              <th className="px-4 py-3 text-right font-medium">Cantidad</th>
              <th className="px-4 py-3 text-left font-medium">Máquina</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Inicio</th>
              <th className="px-4 py-3 text-left font-medium">Fin</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Tiempo</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color">
            {planes.map(plan => (
              <tr key={plan.id} className="hover:bg-bg-secondary/30 opacity-75">
                <td className="px-4 py-3">
                  <div className="font-medium">{plan.no_sales_line}</div>
                  <div className="text-xs text-secondary">{plan.producto_nombre}</div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-sm">{plan.customer_name}</td>
                <td className="px-4 py-3 text-right font-medium">{plan.cantidad_planificada?.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-blue-900/30 text-blue-300">{plan.maquina_asignada}</span>
                </td>
                <td className="px-4 py-3 text-sm hidden sm:table-cell">{formatearFecha(plan.fecha_inicio)}</td>
                <td className="px-4 py-3 text-sm font-medium text-green-300">{formatearFecha(plan.fecha_fin)}</td>
                <td className="px-4 py-3 text-xs hidden lg:table-cell">{formatearTiempo(plan.tiempo_estimado_min)}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-green-900/30 text-green-300 border border-green-700/50">
                    {ESTADOS_PLAN[plan.estado] || 'Completado'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Controles de paginación */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-bg-secondary rounded-lg">
        <div className="text-sm text-secondary">
          Página <span className="font-medium text-text-primary">{pagina_actual}</span> de{' '}
          <span className="font-medium text-text-primary">{total_paginas}</span> •{' '}
          <span className="font-medium text-text-primary">{total_registros}</span> registros totales
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrevious}
            disabled={pagina_actual === 1}
            className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          {/* Indicador de página */}
          <div className="flex items-center gap-2 px-4 py-2 bg-bg-primary rounded border border-border-color">
            {Array.from({ length: Math.min(5, total_paginas) }, (_, i) => {
              let pageNum = pagina_actual - 2 + i;
              if (pageNum < 1) pageNum += 5 - i;
              if (pageNum > total_paginas) return null;

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-2 py-1 rounded text-sm transition-all ${
                    pageNum === pagina_actual
                      ? 'bg-accent-purple text-white font-medium'
                      : 'hover:bg-bg-secondary'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleNext}
            disabled={pagina_actual >= total_paginas}
            className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Info adicional */}
      <div className="text-xs text-secondary text-center">
        Mostrando 20 registros por página (máximo 20 órdenes completadas por vista)
      </div>
    </div>
  );
}
