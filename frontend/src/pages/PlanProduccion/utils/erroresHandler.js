/**
 * Centraliza el manejo de errores
 * Normaliza errores de API, validación y red
 */

import { ERROR_TYPES, MENSAJES_ERROR } from './constantes';

/**
 * Normaliza errores de cualquier origen (API, validación, red)
 * @param {Error|AxiosError|Object} error - Error a normalizar
 * @returns {Object} {code, message, tipo, detalles}
 */
export const normalizarErrorAPI = (error) => {
  if (!error) {
    return {
      code: 'UNKNOWN',
      message: 'Error desconocido',
      tipo: ERROR_TYPES.UNKNOWN,
      detalles: {}
    };
  }

  // Error de axios/request
  if (error.response) {
    const { status, data } = error.response;

    return {
      code: `HTTP_${status}`,
      message: data?.message || data?.error || mapearCodigoError(`HTTP_${status}`),
      tipo: mapearTipoError(status),
      detalles: data,
      status
    };
  }

  // Error de red (sin respuesta del servidor)
  if (error.request && !error.response) {
    return {
      code: 'NETWORK_ERROR',
      message: MENSAJES_ERROR.ERROR_NETWORK,
      tipo: ERROR_TYPES.NETWORK,
      detalles: { original: error.message }
    };
  }

  // Error de validación (lista de campos)
  if (error.validaciones && Array.isArray(error.validaciones)) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Errores de validación',
      tipo: ERROR_TYPES.VALIDATION,
      detalles: { campos: error.validaciones }
    };
  }

  // Error genérico de JavaScript
  if (error instanceof Error) {
    return {
      code: 'ERROR',
      message: error.message,
      tipo: ERROR_TYPES.UNKNOWN,
      detalles: { stack: error.stack }
    };
  }

  return {
    code: 'UNKNOWN',
    message: String(error),
    tipo: ERROR_TYPES.UNKNOWN,
    detalles: { original: error }
  };
};

/**
 * Mapea códigos HTTP a tipos de error
 */
const mapearTipoError = (status) => {
  if (status === 400 || status === 422) return ERROR_TYPES.VALIDATION;
  if (status === 401) return ERROR_TYPES.AUTH;
  if (status === 403) return ERROR_TYPES.AUTH;
  if (status === 404) return ERROR_TYPES.NOT_FOUND;
  if (status >= 500) return ERROR_TYPES.SERVER;
  return ERROR_TYPES.UNKNOWN;
};

/**
 * Traduce códigos de error a mensajes en español
 */
export const mapearCodigoError = (codigo) => {
  const mapa = {
    HTTP_400: 'Solicitud inválida',
    HTTP_401: 'No autorizado - debes iniciar sesión',
    HTTP_403: 'No tienes permisos para esta acción',
    HTTP_404: 'El recurso no fue encontrado',
    HTTP_422: MENSAJES_ERROR.ERROR_CALCULO,
    HTTP_500: 'Error del servidor - intenta más tarde',
    NETWORK_ERROR: MENSAJES_ERROR.ERROR_NETWORK,
    STOCK_INSUFICIENTE: MENSAJES_ERROR.STOCK_INSUFICIENTE,
    VALIDATION_ERROR: 'Los datos no son válidos'
  };

  return mapa[codigo] || 'Ocurrió un error. Por favor intenta de nuevo.';
};

/**
 * Sincroniza errores de API a estado del formulario
 * @param {Object} error - Error normalizado
 * @param {Function} setErrores - Setter del estado de errores
 */
export const manejarErrorEnFormulario = (error, setErrores) => {
  const errorNormalizado = normalizarErrorAPI(error);

  if (errorNormalizado.tipo === ERROR_TYPES.VALIDATION && errorNormalizado.detalles?.campos) {
    const erroresPorCampo = {};

    errorNormalizado.detalles.campos.forEach(campo => {
      erroresPorCampo[campo.nombre] = campo.mensaje;
    });

    setErrores(erroresPorCampo);
  } else {
    setErrores({
      _general: errorNormalizado.message
    });
  }
};

/**
 * Prepara mensaje de error para mostrar en UI
 */
export const formatearMensajeError = (error) => {
  const normalizado = normalizarErrorAPI(error);

  if (normalizado.tipo === ERROR_TYPES.VALIDATION) {
    return 'Por favor verifica los campos requeridos';
  }

  return normalizado.message;
};
