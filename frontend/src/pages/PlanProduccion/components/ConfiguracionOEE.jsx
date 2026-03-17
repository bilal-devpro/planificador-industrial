/**
 * Modal para configurar OEE por máquina
 * - Inputs numéricos para M1-M4
 * - Rango 0.5 - 1.0
 * - Sincronización con backend
 */

import React, { useState, useEffect } from 'react';
import { X, Save, Settings } from 'lucide-react';
import { usePlanContext } from '../context/PlanContext';
import { MAQUINAS } from '../utils/constantes';

// Construir URL con /api automáticamente
const BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://planificador-industrial-1.onrender.com' 
    : 'http://localhost:3000');
const API_URL = BASE_URL + '/api';

export default function ConfiguracionOEE({ onClose = () => {} }) {
  const { setErrores } = usePlanContext();
  const [oeeValues, setOeeValues] = useState({
    M1: 0.85,
    M2: 0.85,
    M3: 0.85,
    M4: 0.85
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});

  // Cargar valores actuales
  useEffect(() => {
    const fetchOEE = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/maquinas`);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        if (data && Array.isArray(data)) {
          const nuevoOee = { ...oeeValues };
          data.forEach(maquina => {
            if (nuevoOee[maquina.id] !== undefined) {
              nuevoOee[maquina.id] = maquina.oee || 0.85;
            }
          });
          setOeeValues(nuevoOee);
        }
      } catch (error) {
        console.error('Error cargando OEE:', error);
        setErrores({ _general: 'Error al cargar configuración de OEE' });
      } finally {
        setLoading(false);
      }
    };

    fetchOEE();
  }, []);

  const handleChangecaOee = async (maquina, valor) => {
    const numValue = parseFloat(valor);

    // Validación
    if (isNaN(numValue) || numValue < 0.5 || numValue > 1.0) {
      return;
    }

    // Update local state
    setOeeValues(prev => ({ ...prev, [maquina]: numValue }));

    // Save to backend
    try {
      setSaving(prev => ({ ...prev, [maquina]: true }));
      
      const response = await fetch(`${API_URL}/maquinas/${maquina}/oee`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oee: numValue })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setErrores({ _success: `OEE de ${maquina} actualizado a ${(numValue * 100).toFixed(0)}%` });
    } catch (error) {
      console.error('Error guardando OEE:', error);
      setErrores({ _general: `Error al guardar OEE de ${maquina}` });
      
      // Revert on error
      setOeeValues(prev => ({ ...prev, [maquina]: prev[maquina] }));
    } finally {
      setSaving(prev => ({ ...prev, [maquina]: false }));
    }
  };

  const porcentaje = (value) => (value * 100).toFixed(0);
  const getColorBadge = (value) => {
    if (value >= 0.85) return 'bg-green-900/30 text-green-300 border-green-700/50';
    if (value >= 0.70) return 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50';
    return 'bg-red-900/30 text-red-300 border-red-700/50';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-bg-primary rounded-lg p-6 w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-color">
          <h3 className="text-xl font-bold flex items-center gap-2 text-accent-blue">
            <Settings size={24} />
            Configuración OEE por Máquina
          </h3>
          <button
            onClick={onClose}
            className="btn btn-ghost p-2 hover:bg-bg-secondary rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="loading mr-3 inline-block"></div>
            <span>Cargando configuración...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Info */}
            <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg text-sm text-blue-200">
              <p className="font-medium mb-2">📊 OEE (Overall Equipment Effectiveness)</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Rango: 0.50 (50%) a 1.00 (100%)</li>
                <li>&gt;= 0.85: Excelente (verde)</li>
                <li>0.70-0.84: Bueno (amarillo)</li>
                <li>&lt; 0.70: Bajo rendimiento (rojo)</li>
                <li>Se aplica a cada máquina en cálculos de producción</li>
              </ul>
            </div>

            {/* Grid de máquinas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MAQUINAS.map(maquina => {
                const valor = oeeValues[maquina.id] || 0.85;
                const isSaving = saving[maquina.id];

                return (
                  <div
                    key={maquina.id}
                    className="p-4 bg-bg-secondary rounded-lg border border-border-color space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-lg">{maquina.nombre}</div>
                      <span className={`badge text-xs px-2 py-1 border ${getColorBadge(valor)}`}>
                        {porcentaje(valor)}%
                      </span>
                    </div>

                    <div className="text-xs text-secondary">
                      {maquina.pistas} pistas • {maquina.generaciones.join(', ')}
                    </div>

                    {/* Slider + Input */}
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0.5"
                        max="1.0"
                        step="0.01"
                        value={valor}
                        onChange={(e) => handleChangecaOee(maquina.id, e.target.value)}
                        disabled={isSaving}
                        className="w-full slider"
                      />

                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0.5"
                          max="1.0"
                          step="0.01"
                          value={valor}
                          onChange={(e) => handleChangecaOee(maquina.id, e.target.value)}
                          disabled={isSaving}
                          className="form-control flex-1 px-2 py-1 text-sm text-center"
                        />
                        {isSaving && (
                          <div className="flex items-center gap-2">
                            <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rango visual */}
                    <div className="flex justify-between text-xs text-secondary">
                      <span>0.50</span>
                      <span>0.75</span>
                      <span>1.00</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Nota */}
            <div className="text-xs text-secondary text-center p-3 bg-bg-secondary rounded">
              Los cambios se guardan automáticamente en el servidor y se aplican a nuevas órdenes
            </div>

            {/* Cerrar */}
            <div className="flex gap-3 pt-4 border-t border-border-color">
              <button
                onClick={onClose}
                className="btn btn-primary flex-1"
              >
                <X size={16} className="mr-2" />
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
