/**
 * Custom hook para validación de formulario
 * Real-time field validation con debounce
 */

import { useState, useCallback, useRef } from 'react';
import { MENSAJES_ERROR } from '../utils/constantes';

export function useValidacion(esquemaValidacion) {
  const [errores, setErrores] = useState({});
  const [touched, setTouched] = useState({});
  const debounceRef = useRef({});

  /**
   * Valida un campo individual
   */
  const validarCampo = useCallback((nombre, valor) => {
    const validador = esquemaValidacion?.[nombre];

    if (!validador) {
      return { valido: true, error: null };
    }

    try {
      const resultado = validador(valor);
      return resultado;
    } catch (err) {
      return { valido: false, error: err.message };
    }
  }, [esquemaValidacion]);

  /**
   * Maneja cambio de campo con debounce
   */
  const handleChange = useCallback((e, delayMs = 300) => {
    const { name, value } = e.target;

    // Limpiar debounce anterior si existe
    if (debounceRef.current[name]) {
      clearTimeout(debounceRef.current[name]);
    }

    // Marcar como tocado
    setTouched(prev => ({ ...prev, [name]: true }));

    // Debounced validation
    debounceRef.current[name] = setTimeout(() => {
      const { valido, error } = validarCampo(name, value);

      setErrores(prev => {
        const nuevoErrores = { ...prev };
        if (valido) {
          delete nuevoErrores[name];
        } else {
          nuevoErrores[name] = error;
        }
        return nuevoErrores;
      });
    }, delayMs);
  }, [validarCampo]);

  /**
   * Valida todos los campos (para submit)
   */
  const validarFormulario = useCallback((datos) => {
    const nuevosErrores = {};

    Object.entries(datos).forEach(([nombre, valor]) => {
      const { valido, error } = validarCampo(nombre, valor);
      if (!valido) {
        nuevosErrores[nombre] = error;
      }
    });

    setErrores(nuevosErrores);
    setTouched(
      Object.keys(datos).reduce((acc, k) => ({ ...acc, [k]: true }), {})
    );

    return Object.keys(nuevosErrores).length === 0;
  }, [validarCampo]);

  /**
   * Limpia los errores
   */
  const limpiar = useCallback(() => {
    setErrores({});
    setTouched({});

    // Limpiar todos los timeouts pendientes
    Object.values(debounceRef.current).forEach(clearTimeout);
    debounceRef.current = {};
  }, []);

  /**
   * Marca un campo como tocado (para mostrar errores)
   */
  const marcarTouch = useCallback((nombre) => {
    setTouched(prev => ({ ...prev, [nombre]: true }));
  }, []);

  return {
    errores,
    touched,
    validarCampo,
    validarFormulario,
    handleChange,
    limpiar,
    marcarTouch,
    isValid: Object.keys(errores).length === 0
  };
}

/**
 * Esquema de validación predefinido para Plan de Producción
 */
export const esquemaValidacionPlan = {
  cantidad_planificada: (valor) => {
    const num = parseInt(valor);
    if (!valor || isNaN(num) || num <= 0) {
      return {
        valido: false,
        error: MENSAJES_ERROR.CANTIDAD_REQUERIDA
      };
    }
    return { valido: true };
  },

  fecha_inicio: (valor) => {
    if (!valor) {
      return {
        valido: false,
        error: MENSAJES_ERROR.FECHA_INVALIDA
      };
    }
    const fecha = new Date(valor);
    if (isNaN(fecha.getTime())) {
      return {
        valido: false,
        error: MENSAJES_ERROR.FECHA_INVALIDA
      };
    }
    return { valido: true };
  },

  maquina_asignada: (valor) => {
    if (!valor) {
      return {
        valido: false,
        error: MENSAJES_ERROR.MAQUINA_REQUERIDA
      };
    }
    return { valido: true };
  },

  alupak_pedido_id: (valor) => {
    if (!valor) {
      return {
        valido: false,
        error: MENSAJES_ERROR.PEDIDO_REQUERIDO
      };
    }
    return { valido: true };
  }
};
