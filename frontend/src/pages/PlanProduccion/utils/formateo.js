/**
 * Utilidades para formateo de fechas y números
 * Maneja DD/MM/YYYY, ISO, Date objects de forma segura
 */

/**
 * Parsa múltiples formatos de fecha
 * @param {string|Date} fecha - Fecha en formato DD/MM/YYYY, ISO o Date
 * @returns {Date} Objeto Date parseado
 */
export const parsearFecha = (fecha) => {
  if (!fecha) return new Date();

  if (fecha instanceof Date) {
    return fecha;
  }

  if (typeof fecha === 'string') {
    // Intenta formato ISO (YYYY-MM-DD)
    if (fecha.includes('-') && fecha.length === 10) {
      const parsed = new Date(fecha + 'T00:00:00');
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    // Intenta formato DD/MM/YYYY
    if (fecha.includes('/')) {
      const parts = fecha.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts.map(p => parseInt(p));
        const parsed = new Date(year, month - 1, day);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    // Último recurso: parseo genérico
    const parsed = new Date(fecha);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

/**
 * Formatea fecha a string
 * @param {Date|string} date - Fecha a formatear
 * @param {string} formato - 'DD/MM/YYYY' o 'ISO' (YYYY-MM-DD)
 * @returns {string} Fecha formateada
 */
export const formatearFecha = (date, formato = 'DD/MM/YYYY') => {
  try {
    const d = parsearFecha(date);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    if (formato === 'ISO' || formato === 'YYYY-MM-DD') {
      return `${year}-${month}-${day}`;
    }

    // Default DD/MM/YYYY
    return `${day}/${month}/${year}`;
  } catch (err) {
    console.error('Error formateando fecha:', err);
    return '';
  }
};

/**
 * Formatea número con separador de miles
 * @param {number} num - Número a formatear
 * @param {number} decimales - Decimales a mostrar
 * @returns {string} Número formateado
 */
export const formatearNumero = (num, decimales = 0) => {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0';
  }

  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  }).format(num);
};

/**
 * Formatea tiempo en minutos a formato legible
 * @param {number} minutos - Minutos totales
 * @returns {string} Ej: "3h 45m"
 */
export const formatearTiempo = (minutos) => {
  if (!minutos || minutos < 0) return '0m';

  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;

  if (horas === 0) {
    return `${mins}m`;
  }

  return `${horas}h ${mins}m`;
};

/**
 * Calcula diferencia entre dos fechas en días
 * @param {Date|string} fechaInicio
 * @param {Date|string} fechaFin
 * @returns {number} Diferencia en días
 */
export const calcularDiasEntre = (fechaInicio, fechaFin) => {
  const inicio = parsearFecha(fechaInicio);
  const fin = parsearFecha(fechaFin);

  const diffMs = fin - inicio;
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDias;
};
