/**
 * Sistema unificado de alertas para Plan de Producción
 * - Inline errors (campo individual)
 * - Toast notifications (temporal)
 * - Modal alerts (crítico)
 */

import React, { useState, useEffect } from 'react';
import { usePlanContext } from '../context/PlanContext';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

export default function AlertasValidacion() {
  const { errores, clearErrores } = usePlanContext();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // Auto-dismiss toast después de 3 segundos
  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => setToastVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  // Mostrar toast cuando hay mensaje de éxito
  useEffect(() => {
    if (errores?._success) {
      setToastMessage(errores._success);
      setToastType('success');
      setToastVisible(true);
      
      // Limpiar después de mostrar
      const timer = setTimeout(() => {
        clearErrores();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [errores?._success]);

  return (
    <>
      {/* Toast Notification */}
      {toastVisible && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in z-40
          ${toastType === 'success' ? 'bg-green-900/80 border border-green-700 text-green-100' : 
            toastType === 'error' ? 'bg-red-900/80 border border-red-700 text-red-100' :
            'bg-blue-900/80 border border-blue-700 text-blue-100'}`}>
          {toastType === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
          <span className="flex-1">{toastMessage}</span>
          <button 
            onClick={() => setToastVisible(false)}
            className="hover:opacity-70 transition"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* General Error Alert */}
      {errores?._general && (
        <div className="alert alert-error flex items-start gap-3">
          <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{errores._general}</p>
          </div>
          <button 
            onClick={clearErrores}
            className="btn btn-ghost btn-sm"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Componentes helper para mostrar errores por campo
 */
export function ErrorCampo({ campo, errores, touched }) {
  if (!touched?.[campo] || !errores?.[campo]) {
    return null;
  }

  return (
    <p className="text-sm text-red-400 mt-1 flex items-center gap-1">
      <AlertTriangle size={14} />
      {errores[campo]}
    </p>
  );
}

/**
 * Wrapper para input con validación inline
 */
export function InputConValidacion({
  label,
  name,
  type = 'text',
  value,
  onChange,
  errores,
  touched,
  required,
  ...props
}) {
  const tieneError = touched?.[name] && errores?.[name];

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={name} className="form-label block">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className={`form-control w-full ${tieneError ? 'border-red-500 focus:ring-red-500' : ''}`}
        {...props}
      />
      <ErrorCampo campo={name} errores={errores} touched={touched} />
    </div>
  );
}
