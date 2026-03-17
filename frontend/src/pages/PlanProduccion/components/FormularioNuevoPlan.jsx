/**
 * Formulario Modal para crear nueva orden de producción
 * - Cálculo remoto vía API
 * - Validación real-time
 * - Integración con PlanContext
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, Calendar, Box, Cpu } from 'lucide-react';
import { usePlanContext } from '../context/PlanContext';
import { useValidacion, esquemaValidacionPlan } from '../hooks/useValidacion';
import { InputConValidacion, ErrorCampo } from './AlertasValidacion';
import { MAQUINAS } from '../utils/constantes';

export default function FormularioNuevoPlan({ onClose = () => {}, onCreate = () => {} }) {
  const { setErrores } = usePlanContext();
  const { errores, touched, handleChange, validarFormulario, limpiar } = useValidacion(esquemaValidacionPlan);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cantidad_planificada: '',
    maquina_asignada: 'M1',
    fecha_inicio: new Date().toISOString().split('T')[0],
    observaciones: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validación en tiempo real
    handleChange(e);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar todos los campos
    if (!validarFormulario(formData)) {
      return;
    }

    try {
      setLoading(true);
      const resultado = await onCreate(formData);

      if (resultado.success) {
        limpiar();
        setFormData({
          cantidad_planificada: '',
          maquina_asignada: 'M1',
          fecha_inicio: new Date().toISOString().split('T')[0],
          observaciones: ''
        });
        onClose();
      }
    } catch (error) {
      setErrores({ _general: 'Error al crear el plan: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-bg-primary rounded-lg p-6 w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-color">
          <h3 className="text-xl font-bold flex items-center gap-2 text-accent-purple">
            <Plus size={24} />
            Nueva Orden de Producción
          </h3>
          <button
            onClick={onClose}
            className="btn btn-ghost p-2 hover:bg-bg-secondary rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Grid de campos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cantidad */}
            <div>
              <label htmlFor="cantidad" className="form-label block flex items-center gap-2 mb-2">
                <Box size={16} className="text-yellow-400" />
                Cantidad <span className="text-red-400">*</span>
              </label>
              <input
                id="cantidad"
                name="cantidad_planificada"
                type="number"
                value={formData.cantidad_planificada}
                onChange={handleInputChange}
                onBlur={() => {}}
                className={`form-control w-full ${touched.cantidad_planificada && errores.cantidad_planificada ? 'border-red-500' : ''}`}
                placeholder="Ej: 50000"
                min="1"
              />
              <ErrorCampo campo="cantidad_planificada" errores={errores} touched={touched} />
            </div>

            {/* Máquina */}
            <div>
              <label htmlFor="maquina" className="form-label block flex items-center gap-2 mb-2">
                <Cpu size={16} className="text-blue-400" />
                Máquina <span className="text-red-400">*</span>
              </label>
              <select
                id="maquina"
                name="maquina_asignada"
                value={formData.maquina_asignada}
                onChange={handleInputChange}
                className={`form-control w-full ${touched.maquina_asignada && errores.maquina_asignada ? 'border-red-500' : ''}`}
              >
                {MAQUINAS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} ({m.pistas} pistas)
                  </option>
                ))}
              </select>
              <ErrorCampo campo="maquina_asignada" errores={errores} touched={touched} />
            </div>

            {/* Fecha Inicio */}
            <div>
              <label htmlFor="fecha" className="form-label block flex items-center gap-2 mb-2">
                <Calendar size={16} className="text-green-400" />
                Fecha Inicio <span className="text-red-400">*</span>
              </label>
              <input
                id="fecha"
                name="fecha_inicio"
                type="date"
                value={formData.fecha_inicio}
                onChange={handleInputChange}
                className={`form-control w-full ${touched.fecha_inicio && errores.fecha_inicio ? 'border-red-500' : ''}`}
              />
              <ErrorCampo campo="fecha_inicio" errores={errores} touched={touched} />
            </div>

            {/* Observaciones (opcional) */}
            <div>
              <label htmlFor="obs" className="form-label block mb-2">
                Observaciones (opcional)
              </label>
              <input
                id="obs"
                name="observaciones"
                type="text"
                value={formData.observaciones}
                onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                className="form-control w-full"
                placeholder="Notas adicionales..."
                maxLength="200"
              />
              <p className="text-xs text-secondary mt-1">{formData.observaciones.length}/200</p>
            </div>
          </div>

          {/* Info de horario */}
          <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg text-sm text-blue-200">
            <p className="font-medium">ℹ️ Horario: 24/7 con cierre Sáb 14:00 - Dom 20:00 (30h)</p>
            <p>El cálculo considera OEE por máquina y disponibilidad real</p>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-4 border-t border-border-color">
            <button
              type="button"
              onClick={() => {
                limpiar();
                onClose();
              }}
              className="btn btn-secondary flex-1"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loading mr-2"></div>
                  Procesando...
                </>
              ) : (
                <>
                  <Plus size={16} className="mr-2" />
                  Crear Orden
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
