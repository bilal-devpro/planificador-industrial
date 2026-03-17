/**
 * Custom hook para operaciones de API (Plan de Producción)
 * Centraliza: fetch, create, update, delete
 * Usa fetch API nativo (sin dependencias externas)
 */

import { useState, useCallback } from 'react';
import { usePlanContext } from '../context/PlanContext';
import { normalizarErrorAPI, mapearCodigoError } from '../utils/erroresHandler';

// Construir URL con /api automáticamente
const BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD 
    ? 'https://planificador-industrial-1.onrender.com' 
    : 'http://localhost:3000');
const API_URL = BASE_URL + '/api';

export function usePlanesProduccion() {
  const context = usePlanContext();
  const [loading, setLoading] = useState(false);

  if (!context) {
    throw new Error('usePlanesProduccion debe ser usado dentro de PlanProvider');
  }

  /**
   * Fetch planes ACTIVOS (no completados)
   */
  const fetchPlanesActuales = useCallback(async () => {
    try {
      setLoading(true);
      context.setLoading(true);

      const response = await fetch(`${API_URL}/plan`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const planes = data.planes || data || [];

      context.setPlanes(planes);

      return { success: true, planes };
    } catch (error) {
      const errorNorm = normalizarErrorAPI(error);
      context.setErrores({ _general: errorNorm.message });
      console.error('Error fetching planes actuales:', errorNorm);
      return { success: false, error: errorNorm };
    } finally {
      setLoading(false);
      context.setLoading(false);
    }
  }, [context]);

  /**
   * Fetch planes del historial CON PAGINACIÓN (completados)
   */
  const fetchPlanesHistorial = useCallback(async (pagina = 1) => {
    try {
      setLoading(true);
      context.setLoading(true);

      const url = new URL(`${API_URL}/plan/historial`);
      url.searchParams.append('pagina', pagina);
      url.searchParams.append('limite', 20);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const { planes = [], pagina_actual = 1, total_paginas = 1, total_registros = 0 } = data;

      context.setPagination({
        pagina_actual,
        total_paginas,
        total_registros
      });

      return { success: true, planes };
    } catch (error) {
      const errorNorm = normalizarErrorAPI(error);
      context.setErrores({ _general: errorNorm.message });
      console.error('Error fetching historial:', errorNorm);
      return { success: false, error: errorNorm };
    } finally {
      setLoading(false);
      context.setLoading(false);
    }
  }, [context]);

  /**
   * Crear plan nuevo: Calcular → Guardar
   */
  const crearPlanDesdeFormulario = useCallback(async (datosFormulario) => {
    try {
      setLoading(true);
      context.setLoading(true);
      context.clearErrores();

      // Step 1: Calcular (preview)
      const calcularResponse = await fetch(`${API_URL}/plan/calcular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosFormulario)
      });

      if (!calcularResponse.ok) {
        throw new Error(`HTTP ${calcularResponse.status}`);
      }

      const calcularData = await calcularResponse.json();

      if (!calcularData.planes || calcularData.planes.length === 0) {
        throw new Error('No se pudieron generar planes');
      }

      // Step 2: Guardar
      const planesAGuardar = calcularData.planes;
      const guardarResponse = await fetch(`${API_URL}/plan/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planes: planesAGuardar })
      });

      if (!guardarResponse.ok) {
        throw new Error(`HTTP ${guardarResponse.status}`);
      }

      const guardarData = await guardarResponse.json();

      if (guardarData.ids_guardados && guardarData.ids_guardados.length > 0) {
        // Asignar IDs a los planes guardados
        const planesGuardados = planesAGuardar.map((plan, idx) => ({
          ...plan,
          id: guardarData.ids_guardados[idx]
        }));

        // Agregar los planes con IDs al contexto
        planesGuardados.forEach(plan => context.addPlan(plan));
        context.setErrores({ _success: `${planesGuardados.length} plan(es) creado(s) exitosamente` });
        return { success: true, ids: guardarData.ids_guardados, planes: planesGuardados };
      }

      throw new Error('No se guardaron los planes');
    } catch (error) {
      const errorNorm = normalizarErrorAPI(error);
      context.setErrores({ _general: errorNorm.message });
      console.error('Error creando plan:', errorNorm);
      return { success: false, error: errorNorm };
    } finally {
      setLoading(false);
      context.setLoading(false);
    }
  }, [context]);

  /**
   * Editar plan existente
   */
  const editarPlan = useCallback(async (idPlan, cambios) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/plan/${idPlan}/editar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        context.updatePlan({ id: idPlan, ...cambios });
        context.setErrores({ _success: 'Plan actualizado' });
        return { success: true };
      }

      throw new Error('No se actualizó el plan');
    } catch (error) {
      const errorNorm = normalizarErrorAPI(error);
      context.setErrores({ _general: errorNorm.message });
      console.error('Error editando plan:', errorNorm);
      return { success: false, error: errorNorm };
    } finally {
      setLoading(false);
    }
  }, [context]);

  /**
   * Marcar plan como completado
   */
  const marcarCompleto = useCallback(async (idPlan) => {
    try {
      const response = await fetch(`${API_URL}/plan/${idPlan}/marcar-completado`, {
        method: 'PUT'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        context.updatePlan({ id: idPlan, estado_finalizado: true });
        return { success: true };
      }

      throw new Error('No se marcó como completado');
    } catch (error) {
      const errorNorm = normalizarErrorAPI(error);
      console.error('Error marcando completo:', errorNorm);
      return { success: false, error: errorNorm };
    }
  }, [context]);

  /**
   * Eliminar plan
   */
  const eliminarPlan = useCallback(async (idPlan) => {
    try {
      if (!window.confirm('¿Estás seguro de que quieres eliminar este plan?')) {
        return { success: false, cancelled: true };
      }

      const response = await fetch(`${API_URL}/plan/${idPlan}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        context.deletePlan(idPlan);
        context.setErrores({ _success: 'Plan eliminado' });
        return { success: true };
      }

      throw new Error('No se eliminó el plan');
    } catch (error) {
      const errorNorm = normalizarErrorAPI(error);
      context.setErrores({ _general: errorNorm.message });
      console.error('Error eliminando plan:', errorNorm);
      return { success: false, error: errorNorm };
    }
  }, [context]);

  return {
    loading,
    fetchPlanesActuales,
    fetchPlanesHistorial,
    crearPlanDesdeFormulario,
    editarPlan,
    marcarCompleto,
    eliminarPlan
  };
}
