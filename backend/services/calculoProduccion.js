const { pool } = require('../database');

// Configuración de máquinas - ¡M4 ahora es G1 (Generación 1)!
const CONFIG_MAQUINAS = {
  G1: { // Productos que empiezan con "AL" - INCLUYE M1, M2, M3, M4
    maquinas: ['M1', 'M2', 'M3', 'M4'],
    descripcion: 'Generación 1 (M1, M2, M3, M4)',
    getCapacidad: (maquina, oee) => {
      const pistas = maquina === 'M4' ? 6 : 12;
      return pistas * 55 * oee; // ciclos/minuto * OEE
    }
  },
  G2: { // Productos que empiezan con "AC" - SOLO M1, M2, M3 (M4 NO disponible)
    maquinas: ['M1', 'M2', 'M3'],
    descripcion: 'Generación 2 (M1, M2, M3)',
    getCapacidad: (maquina, oee) => {
      return 12 * 55 * oee; // Todas tienen 12 pistas
    }
  }
};

// ========================================
// HORARIO LABORAL: 24/7 EXCEPTO SÁBADO 14:00 → DOMINGO 20:00 (30h de cierre semanal)
// ========================================
const isInClosure = (date) => {
  const day = date.getDay(); // 0: Domingo, 6: Sábado
  const hour = date.getHours();

  // Cerrado: Sábado desde las 14:00 hasta Domingo antes de las 20:00 (30 horas)
  if (day === 6 && hour >= 14) return true; // Sábado después de las 14:00
  if (day === 0 && hour < 20) return true;  // Domingo antes de las 20:00
  return false;
};

const getNextClosureStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();

  // Si es sábado antes de las 14:00, el próximo cierre empieza hoy a las 14:00
  if (day === 6 && d.getHours() < 14) {
    d.setHours(14, 0, 0, 0);
    return d;
  }

  // Calcular días hasta el próximo sábado
  let daysToAdd = (6 - day + 7) % 7;
  if (daysToAdd === 0 && d.getHours() >= 14) daysToAdd = 7; // Si ya pasó el cierre de hoy, ir al próximo sábado

  d.setDate(d.getDate() + daysToAdd);
  d.setHours(14, 0, 0, 0);
  return d;
};

const getNextClosureEnd = (date) => {
  const d = new Date(date);
  const day = d.getDay();

  // Si estamos en período de cierre, calcular fin del cierre (domingo 20:00)
  if (day === 6 && d.getHours() >= 14) {
    d.setDate(d.getDate() + 1); // Ir al domingo
  }
  d.setHours(20, 0, 0, 0);
  return d;
};

// ✅ FUNCIÓN CLAVE: Calcular fecha fin con horario 24/7 + CIERRE DE FIN DE SEMANA (30h)
const calcularFechaFinConHorarioLaboral = (fechaInicio, minutosNecesarios) => {
  if (minutosNecesarios <= 0) return new Date(fechaInicio);

  let currentDateTime = new Date(fechaInicio);
  let remainingMinutes = minutosNecesarios;

  // Si inicia en período de cierre, saltar al final del cierre (Domingo 20:00)
  if (isInClosure(currentDateTime)) {
    const endClosure = getNextClosureEnd(currentDateTime);
    currentDateTime = endClosure;
  }

  while (remainingMinutes > 0) {
    // Verificar si estamos en período de cierre
    if (isInClosure(currentDateTime)) {
      const endClosure = getNextClosureEnd(currentDateTime);
      currentDateTime = endClosure;
      continue;
    }

    // Calcular próximo período de cierre
    const nextClosureStart = getNextClosureStart(currentDateTime);
    const nextClosureEnd = getNextClosureEnd(currentDateTime);

    // Minutos disponibles hasta el próximo cierre
    const minutesUntilClosure = Math.floor((nextClosureStart - currentDateTime) / 60000);

    if (remainingMinutes <= minutesUntilClosure) {
      // Termina antes del cierre
      currentDateTime.setMinutes(currentDateTime.getMinutes() + remainingMinutes);
      remainingMinutes = 0;
    } else {
      // Trabaja hasta el inicio del cierre
      currentDateTime = new Date(nextClosureStart);
      remainingMinutes -= minutesUntilClosure;
      // Saltar período de cierre automáticamente
      currentDateTime = new Date(nextClosureEnd);
    }
  }

  return currentDateTime;
};

// Calcular tiempo con OEE ESPECÍFICO de la máquina - ACTUALIZADO PARA 24/7
const calcularTiempoProduccion = (cantidad, generacion, maquina, oee, fechaInicio) => {
  if (cantidad <= 0) {
    return { tiempoMinutos: 0, fechaFinCalculada: fechaInicio || '' };
  }

  const capacidadPorMinuto = CONFIG_MAQUINAS[generacion].getCapacidad(maquina, oee);
  const tiempoMinutos = Math.ceil(cantidad / capacidadPorMinuto);

  let fechaFin = '';
  if (fechaInicio) {
    const fecha = new Date(fechaInicio);
    const fechaCalculada = calcularFechaFinConHorarioLaboral(fecha, tiempoMinutos);
    fechaFin = fechaCalculada.toISOString().split('T')[0];
  }

  return { tiempoMinutos, fechaFinCalculada: fechaFin };
};

// Calcular tiempo estimado de producción basado en OEE y disponibilidad
const calcularTiempoEstimado = (cantidad, velocidadPorCaja, oee, disponibilidad) => {
  if (cantidad <= 0 || velocidadPorCaja <= 0 || oee <= 0) {
    return 0;
  }

  // Calcular tiempo base (sin considerar disponibilidad)
  const cajas = cantidad / velocidadPorCaja;
  const tiempoBaseMinutos = cajas * 60; // Asumiendo 1 hora por caja base

  // Aplicar OEE
  const tiempoConOEE = tiempoBaseMinutos / oee;

  // Considerar disponibilidad (si hay fecha de disponibilidad, calcular tiempo hasta esa fecha)
  if (disponibilidad) {
    const fechaDisponibilidad = new Date(disponibilidad);
    const ahora = new Date();
    
    // Si la disponibilidad es en el futuro, sumar ese tiempo de espera
    if (fechaDisponibilidad > ahora) {
      const esperaMinutos = Math.ceil((fechaDisponibilidad - ahora) / 60000);
      return Math.ceil(tiempoConOEE + esperaMinutos);
    }
  }

  return Math.ceil(tiempoConOEE);
};

module.exports = {
  calcularTiempoProduccion,
  calcularTiempoEstimado,
  CONFIG_MAQUINAS
};