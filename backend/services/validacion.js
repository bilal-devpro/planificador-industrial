const { pool } = require('../database');

// Validar datos básicos de un plan
function validarPlan(data) {
  const errores = [];
  
  if (!data.alupak_pedido_id) errores.push('alupak_pedido_id es requerido');
  if (!data.cantidad_planificada || data.cantidad_planificada <= 0) errores.push('cantidad_planificada debe ser mayor que 0');
  if (!data.maquina_asignada) errores.push('maquina_asignada es requerida');
  if (!data.fecha_inicio) errores.push('fecha_inicio es requerida');
  
  return errores;
}

// Validar si un plan puede editarse
function puedeEditarse(plan) {
  return plan.estado !== 'completado';
}

// Normalizar fecha
function normalizarFecha(fechaStr) {
  if (!fechaStr) return null;
  
  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return null;
  
  return fecha;
}

// Validar actualización de plan
function validarActualizacion(data) {
  const errores = [];
  
  if (data.cantidad_planificada && data.cantidad_planificada <= 0) errores.push('cantidad_planificada debe ser mayor que 0');
  if (data.fecha_inicio && !normalizarFecha(data.fecha_inicio)) errores.push('fecha_inicio tiene un formato inválido');
  if (data.fecha_fin && !normalizarFecha(data.fecha_fin)) errores.push('fecha_fin tiene un formato inválido');
  
  return errores;
}

// Normalizar error para respuesta JSON
function normalizarError(error, tipo = 'UNKNOWN_ERROR') {
  return {
    success: false,
    error_type: tipo,
    mensaje: error.message || 'Error desconocido',
    detalles: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
}

module.exports = {
  validarPlan,
  puedeEditarse,
  normalizarFecha,
  validarActualizacion,
  normalizarError
};