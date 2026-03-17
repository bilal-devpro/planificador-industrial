/**
 * Custom hook para operaciones de API (Plan de Producción)
 * Centraliza: fetch, create, update, delete
 */

import { useState, useCallback } from 'react';
import { usePlanContext } from '../context/PlanContext';
import { normalizarErrorAPI, mapearCodigoError } from '../utils/erroresHandler';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function usePlanesProduccion() {
  const context = usePlanContext();
  const [loading, setLoading] = useState(false);

  if (!context) {
    throw new Error('usePlanesProduccion debe ser usado dentro de PlanProvider');
  }

  /**
   * Fetch planes del historial con paginación
   */
  const fetchPlanesHistorial = useCallback(async (pagina = 1) => {
    try {
      setLoading(true);
      context.setLoading(true);

      const response = await axios.get(
        `${API_URL}/plan/historial`,
        { params: { pagina, limite: 20 } }
      );

      const { planes = [], pagina_actual = 1, total_paginas = 1, total_registros = 0 } = response.data;

      context.setPlanes(planes);
      context.setPagination({
        pagina_actual,
        total_paginas,
        total_registros
      });

      return { success: true, planes };
    } catch (error) {
      const errorNorm = normalizarErrorAPI(error);
      context.setErrores({ _general: errorNorm.message });
      console.error('Error fetching planes:', errorNorm);
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
      const calcularResponse = await axios.post(
        `${API_URL}/plan/calcular`,
        datosFormulario
      );

      if (!calcularResponse.data.planes || calcularResponse.data.planes.length === 0) {
        throw new Error('No se pudieron generar planes');
      }

      // Step 2: Guardar
      const planesAGuardar = calcularResponse.data.planes;
      const guardarResponse = await axios.post(
        `${API_URL}/plan/guardar`,
        { planes: planesAGuardar }
      );

      if (guardarResponse.data.ids_guardados) {
        // Agregar los nuevos planes al contexto
        planesAGuardar.forEach(plan => context.addPlan(plan));
        context.setErrores({ _success: 'Plan creado exitosamente' });
        return { success: true, ids: guardarResponse.data.ids_guardados };
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
      const response = await axios.put(
        `${API_URL}/plan/${idPlan}/editar`,
        cambios
      );

      if (response.data.success) {
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
      const response = await axios.put(
        `${API_URL}/plan/${idPlan}/marcar-completado`
      );

      if (response.data.success) {
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

      const response = await axios.delete(
        `${API_URL}/plan/${idPlan}`
      );

      if (response.data.success) {
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
    fetchPlanesHistorial,
    crearPlanDesdeFormulario,
    editarPlan,
    marcarCompleto,
    eliminarPlan
  };
}
