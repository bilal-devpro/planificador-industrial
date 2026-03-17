/**
 * validacion.js
 * 
 * Validation service for production plans.
 * Handles data validation, business rule checks, and error normalization.
 */

/**
 * Validate a single production plan object
 * @param {Object} plan - Plan object to validate
 * @param {Object} options - { checkStock: true, checkDates: true }
 * @returns {Object} - { isValid: boolean, errors: {...} }
 */
function validarPlan(plan, options = {}) {
  const errors = {};

  // Required fields
  if (!plan.alupak_pedido_id) {
    errors.alupak_pedido_id = 'Pedido es requerido';
  }

  if (!plan.cantidad_planificada || plan.cantidad_planificada <= 0) {
    errors.cantidad_planificada = 'Cantidad debe ser mayor a 0';
  } else if (!Number.isInteger(plan.cantidad_planificada)) {
    errors.cantidad_planificada = 'Cantidad debe ser un número entero';
  }

  if (!plan.maquina_asignada || !['M1', 'M2', 'M3', 'M4'].includes(plan.maquina_asignada)) {
    errors.maquina_asignada = 'Máquina inválida';
  }

  // Date validation
  if (options.checkDates !== false) {
    if (!plan.fecha_inicio) {
      errors.fecha_inicio = 'Fecha de inicio es requerida';
    } else if (!isValidDate(plan.fecha_inicio)) {
      errors.fecha_inicio = 'Formato de fecha inválido (debe ser YYYY-MM-DD)';
    } else if (isPastDate(plan.fecha_inicio)) {
      errors.fecha_inicio = 'La fecha no puede ser en el pasado';
    }

    if (plan.fecha_fin && !isValidDate(plan.fecha_fin)) {
      errors.fecha_fin = 'Formato de fecha inválido';
    } else if (plan.fecha_inicio && plan.fecha_fin && plan.fecha_fin < plan.fecha_inicio) {
      errors.fecha_fin = 'Fecha fin debe ser después de fecha inicio';
    }
  }

  // OEE validation
  if (plan.oee_aplicado !== undefined) {
    if (typeof plan.oee_aplicado !== 'number' || plan.oee_aplicado < 0 || plan.oee_aplicado > 1) {
      errors.oee_aplicado = 'OEE debe estar entre 0 y 1';
    }
  }

  // Estado validation
  if (plan.estado) {
    const estadosValidos = ['Requiere producción', 'En producción', 'Completado', 'Pausado', 'Cancelado'];
    if (!estadosValidos.includes(plan.estado)) {
      errors.estado = `Estado "${plan.estado}" no es válido`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: errors,
    plan: plan
  };
}

/**
 * Validate if a plan can be edited (not already completed)
 * @param {Object} planOriginal - Current plan in DB
 * @returns {boolean}
 */
function puedeEditarse(planOriginal) {
  if (!planOriginal) return false;
  
  // Cannot edit if already marked as completed
  if (planOriginal.estado_finalizado === true) {
    return false;
  }

  // Cannot edit if status is Completado
  if (planOriginal.estado === 'Completado') {
    return false;
  }

  return true;
}

/**
 * Normalize dates to ISO format
 * Accepts: "2026-03-18", "18/03/2026", "2026-03-18T00:00:00Z"
 * @param {string|Date} fecha - Input date
 * @returns {string|null} - ISO formatted date (YYYY-MM-DD) or null if invalid
 */
function normalizarFecha(fecha) {
  if (!fecha) return null;

  // Already ISO format
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return fecha.slice(0, 10);
  }

  // DD/MM/YYYY format
  if (typeof fecha === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha)) {
    const [day, month, year] = fecha.split('/');
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Date object
  if (fecha instanceof Date && !isNaN(fecha)) {
    return fecha.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Validate date format
 * @param {string|Date} fecha - Date to check
 * @returns {boolean}
 */
function isValidDate(fecha) {
  if (!fecha) return false;

  if (typeof fecha === 'string') {
    // ISO 8601 format
    if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
      const d = new Date(fecha);
      return !isNaN(d.getTime());
    }

    // DD/MM/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha)) {
      const [day, month, year] = fecha.split('/');
      const d = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      return !isNaN(d.getTime());
    }

    return false;
  }

  if (fecha instanceof Date) {
    return !isNaN(fecha.getTime());
  }

  return false;
}

/**
 * Check if date is in the past
 * @param {string|Date} fecha - Date to check
 * @returns {boolean}
 */
function isPastDate(fecha) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let checkDate;
  if (typeof fecha === 'string') {
    checkDate = new Date(normalizarFecha(fecha));
  } else {
    checkDate = new Date(fecha);
  }

  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
}

/**
 * Normalize and validate edit request
 * @param {Object} updates - Fields to update
 * @param {Object} options - Validation options
 * @returns {Object} - { isValid: boolean, data: {...}, errors: {...} }
 */
function validarActualizacion(updates, options = {}) {
  const errors = {};
  const data = {};

  // Cantidad
  if (updates.cantidad_planificada !== undefined) {
    if (!updates.cantidad_planificada || updates.cantidad_planificada <= 0) {
      errors.cantidad_planificada = 'Cantidad debe ser > 0';
    } else if (!Number.isInteger(updates.cantidad_planificada)) {
      errors.cantidad_planificada = 'Cantidad debe ser número entero';
    } else {
      data.cantidad_planificada = updates.cantidad_planificada;
    }
  }

  // Máquina
  if (updates.maquina_asignada !== undefined) {
    if (['M1', 'M2', 'M3', 'M4'].includes(updates.maquina_asignada)) {
      data.maquina_asignada = updates.maquina_asignada;
    } else {
      errors.maquina_asignada = 'Máquina inválida';
    }
  }

  // Fechas
  if (updates.fecha_inicio !== undefined) {
    const fNorm = normalizarFecha(updates.fecha_inicio);
    if (!fNorm || isPastDate(fNorm)) {
      errors.fecha_inicio = 'Fecha inválida o en el pasado';
    } else {
      data.fecha_inicio = fNorm;
    }
  }

  if (updates.fecha_fin !== undefined) {
    const fNorm = normalizarFecha(updates.fecha_fin);
    if (!fNorm || !isValidDate(fNorm)) {
      errors.fecha_fin = 'Fecha inválida';
    } else {
      data.fecha_fin = fNorm;
    }
  }

  // Estado
  if (updates.estado !== undefined) {
    const estadosValidos = ['Requiere producción', 'En producción', 'Completado', 'Pausado', 'Cancelado'];
    if (estadosValidos.includes(updates.estado)) {
      data.estado = updates.estado;
    } else {
      errors.estado = `Estado "${updates.estado}" no es válido`;
    }
  }

  // Observaciones
  if (updates.observaciones !== undefined) {
    data.observaciones = String(updates.observaciones || '').slice(0, 500);
  }

  // OEE
  if (updates.oee_aplicado !== undefined) {
    const oee = Number(updates.oee_aplicado);
    if (!isNaN(oee) && oee >= 0 && oee <= 1) {
      data.oee_aplicado = oee;
    } else {
      errors.oee_aplicado = 'OEE debe estar entre 0 y 1';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    data: data,
    errors: errors
  };
}

/**
 * Normalize error from any source to standard format
 * @param {Error|string|Object} error - Error to normalize
 * @param {string} defaultType - Default error type
 * @returns {Object} - Standardized error object
 */
function normalizarError(error, defaultType = 'UNKNOWN_ERROR') {
  // If already normalized
  if (error.error_type) {
    return error;
  }

  // Handle error objects
  if (error instanceof Error) {
    let error_type = defaultType;
    let message = error.message || 'Error desconocido';

    // Detect common error types
    if (message.includes('validation') || message.includes('invalid')) {
      error_type = 'VALIDATION_ERROR';
    } else if (message.includes('stock') || message.includes('insuficiente')) {
      error_type = 'INSUFFICIENT_STOCK';
    } else if (message.includes('database') || message.includes('query')) {
      error_type = 'DATABASE_ERROR';
    } else if (message.includes('constraint') || message.includes('unique')) {
      error_type = 'CONSTRAINT_VIOLATION';
    }

    return {
      success: false,
      error_type: error_type,
      mensaje: message,
      detalles: error.stack || error.message,
      campo_afectado: null
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      success: false,
      error_type: defaultType,
      mensaje: error,
      detalles: error,
      campo_afectado: null
    };
  }

  // Already an object, ensure required fields
  return {
    success: error.success || false,
    error_type: error.error_type || defaultType,
    mensaje: error.mensaje || error.message || 'Error desconocido',
    detalles: error.detalles || error.details || '',
    campo_afectado: error.campo_afectado || null,
    ...error
  };
}

module.exports = {
  validarPlan,
  puedeEditarse,
  normalizarFecha,
  isValidDate,
  isPastDate,
  validarActualizacion,
  normalizarError
};
