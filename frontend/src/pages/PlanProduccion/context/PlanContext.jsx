/**
 * Context API para Plan de Producción
 * Gestiona estado global: planes, máquinas, filtros, errores, paginación
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Crear context
const PlanContext = createContext();

// Action types
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  FETCH_PLANES: 'FETCH_PLANES',
  SET_PLANES: 'SET_PLANES',
  ADD_PLAN: 'ADD_PLAN',
  UPDATE_PLAN: 'UPDATE_PLAN',
  DELETE_PLAN: 'DELETE_PLAN',
  SET_MAQUINAS: 'SET_MAQUINAS',
  SET_FILTROS: 'SET_FILTROS',
  SET_ERRORES: 'SET_ERRORES',
  SET_PAGINATION: 'SET_PAGINATION',
  CLEAR_ERRORES: 'CLEAR_ERRORES'
};

// Estado inicial
const estadoInicial = {
  planes: [],
  máquinas: [],
  filtros: {
    estado: '',
    maquina: '',
    search: ''
  },
  errores: {},
  loading: false,
  pagination: {
    pagina_actual: 1,
    total_paginas: 1,
    total_registros: 0
  }
};

// Reducer
function planReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };

    case ACTIONS.SET_PLANES:
      return { ...state, planes: action.payload };

    case ACTIONS.ADD_PLAN:
      return { ...state, planes: [action.payload, ...state.planes] };

    case ACTIONS.UPDATE_PLAN:
      return {
        ...state,
        planes: state.planes.map(p =>
          p.id === action.payload.id ? action.payload : p
        )
      };

    case ACTIONS.DELETE_PLAN:
      return {
        ...state,
        planes: state.planes.filter(p => p.id !== action.payload)
      };

    case ACTIONS.SET_MAQUINAS:
      return { ...state, máquinas: action.payload };

    case ACTIONS.SET_FILTROS:
      return { ...state, filtros: action.payload };

    case ACTIONS.SET_ERRORES:
      return { ...state, errores: action.payload };

    case ACTIONS.CLEAR_ERRORES:
      return { ...state, errores: {} };

    case ACTIONS.SET_PAGINATION:
      return { ...state, pagination: action.payload };

    default:
      return state;
  }
}

/**
 * Provider component
 * Envuelve la aplicación para proveer context
 */
export function PlanProvider({ children }) {
  const [state, dispatch] = useReducer(planReducer, estadoInicial);

  // Actions
  const setLoading = useCallback((loading) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: loading });
  }, []);

  const setPlanes = useCallback((planes) => {
    dispatch({ type: ACTIONS.SET_PLANES, payload: planes });
  }, []);

  const addPlan = useCallback((plan) => {
    dispatch({ type: ACTIONS.ADD_PLAN, payload: plan });
  }, []);

  const updatePlan = useCallback((plan) => {
    dispatch({ type: ACTIONS.UPDATE_PLAN, payload: plan });
  }, []);

  const deletePlan = useCallback((id) => {
    dispatch({ type: ACTIONS.DELETE_PLAN, payload: id });
  }, []);

  const setMaquinas = useCallback((maquinas) => {
    dispatch({ type: ACTIONS.SET_MAQUINAS, payload: maquinas });
  }, []);

  const setFiltros = useCallback((filtros) => {
    dispatch({ type: ACTIONS.SET_FILTROS, payload: filtros });
  }, []);

  const setErrores = useCallback((errores) => {
    dispatch({ type: ACTIONS.SET_ERRORES, payload: errores });
  }, []);

  const clearErrores = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_ERRORES });
  }, []);

  const setPagination = useCallback((pagination) => {
    dispatch({ type: ACTIONS.SET_PAGINATION, payload: pagination });
  }, []);

  const value = {
    ...state,
    setLoading,
    setPlanes,
    addPlan,
    updatePlan,
    deletePlan,
    setMaquinas,
    setFiltros,
    setErrores,
    clearErrores,
    setPagination
  };

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}

/**
 * Hook para usar el context
 * Uso: const { planes, setPlanes } = usePlanContext();
 */
export function usePlanContext() {
  const context = useContext(PlanContext);

  if (!context) {
    throw new Error('usePlanContext debe ser usado dentro de PlanProvider');
  }

  return context;
}
