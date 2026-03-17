/**
 * Tabla de Planes de Producción
 * - Sorteable y filtrable
 * - Edición inline
 * - Acciones (editar, eliminar, marcar completado)
 */

import React, { useState } from 'react';
import { Edit2, Trash2, CheckCircle, MoreVertical } from 'lucide-react';
import { formatearFecha, formatearNumero, formatearTiempo } from '../utils/formateo';
import { ESTADOS_PLAN } from '../utils/constantes';

export default function TablaPlanesProduccion({
  planes = [],
  loading = false,
  onEdit = () => {},
  onDelete = () => {},
  onComplete = () => {}
}) {
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});

  if (loading) {
    return (
      <div className="card p-12 text-center">
        <div className="loading mr-3 inline-block"></div>
        <span>Cargando planes...</span>
      </div>
    );
  }

  if (!planes || planes.length === 0) {
    return (
      <div className="card p-12 text-center text-secondary">
        <p>No hay planes para mostrar</p>
      </div>
    );
  }

  const handleEditClick = (plan) => {
    setEditingId(plan.id);
    setFormData({
      cantidad_planificada: plan.cantidad_planificada || '',
      maquina_asignada: plan.maquina_asignada || '',
      fecha_inicio: plan.fecha_inicio || ''
    });
  };

  const handleSave = (plan) => {
    onEdit(plan.id, formData);
    setEditingId(null);
    setFormData({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({});
  };

  const getEstadoBadge = (estado) => {
    const colores = {
      requiere_produccion: 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/50',
      en_produccion: 'bg-blue-900/30 text-blue-300 border border-blue-700/50',
      completado: 'bg-green-900/30 text-green-300 border border-green-700/50',
      stock_suficiente: 'bg-gray-800 text-gray-300 border border-gray-700/50'
    };

    return (
      <span className={`badge text-xs px-2 py-1 ${colores[estado] || colores.stock_suficiente}`}>
        {ESTADOS_PLAN[estado] || estado}
      </span>
    );
  };

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary/50 border-b border-border-color">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Producto</th>
            <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Cliente</th>
            <th className="px-4 py-3 text-right font-medium">Cantidad</th>
            <th className="px-4 py-3 text-left font-medium">Máquina</th>
            <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Inicio</th>
            <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Fin</th>
            <th className="px-4 py-3 text-left font-medium">Tiempo</th>
            <th className="px-4 py-3 text-left font-medium">Estado</th>
            <th className="px-4 py-3 text-center font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-color">
          {planes.map(plan => (
            <tr 
              key={plan.id} 
              className={`hover:bg-bg-secondary/30 transition-colors ${
                plan.estado === 'completado' ? 'opacity-60' : ''
              }`}
            >
              <td className="px-4 py-3">
                <div className="font-medium">{plan.no_sales_line}</div>
                <div className="text-xs text-secondary">{plan.producto_nombre}</div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-sm">{plan.customer_name}</td>
              <td className="px-4 py-3 text-right">
                {editingId === plan.id ? (
                  <input
                    type="number"
                    value={formData.cantidad_planificada}
                    onChange={(e) => setFormData({ ...formData, cantidad_planificada: e.target.value })}
                    className="form-control w-24 text-right px-2 py-1"
                  />
                ) : (
                  <span className="font-medium">{formatearNumero(plan.cantidad_planificada)}</span>
                )}
              </td>
              <td className="px-4 py-3">
                {editingId === plan.id ? (
                  <select
                    value={formData.maquina_asignada}
                    onChange={(e) => setFormData({ ...formData, maquina_asignada: e.target.value })}
                    className="form-control px-2 py-1"
                  >
                    <option value="M1">M1</option>
                    <option value="M2">M2</option>
                    <option value="M3">M3</option>
                    <option value="M4">M4</option>
                  </select>
                ) : (
                  <span className="badge bg-blue-900/30 text-blue-300">{plan.maquina_asignada}</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm hidden sm:table-cell">
                {editingId === plan.id ? (
                  <input
                    type="date"
                    value={formData.fecha_inicio}
                    onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                    className="form-control px-2 py-1 text-sm"
                  />
                ) : (
                  formatearFecha(plan.fecha_inicio, 'DD/MM/YYYY')
                )}
              </td>
              <td className="px-4 py-3 text-sm hidden lg:table-cell">
                {formatearFecha(plan.fecha_fin, 'DD/MM/YYYY')}
              </td>
              <td className="px-4 py-3 text-xs">
                {plan.tiempo_estimado_min ? formatearTiempo(plan.tiempo_estimado_min) : '-'}
              </td>
              <td className="px-4 py-3">
                {getEstadoBadge(plan.estado)}
              </td>
              <td className="px-4 py-3 text-center">
                {editingId === plan.id ? (
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={() => handleSave(plan)}
                      className="btn btn-success btn-xs px-2"
                      title="Guardar"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleCancel}
                      className="btn btn-secondary btn-xs px-2"
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1 justify-center">
                    {plan.estado !== 'completado' && (
                      <>
                        <button
                          onClick={() => handleEditClick(plan)}
                          className="btn btn-secondary btn-xs px-2"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        {plan.estado !== 'completado' && (
                          <button
                            onClick={() => onComplete(plan.id)}
                            className="btn btn-success btn-xs px-2"
                            title="Marcar completado"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm('¿Eliminar este plan?')) {
                          onDelete(plan.id);
                        }
                      }}
                      className="btn btn-error btn-xs px-2"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
