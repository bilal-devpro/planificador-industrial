/**
 * calculoProduccion.js
 * 
 * Backend service for production plan calculations.
 * Contains all scheduling logic previously in PlanProduccion.jsx frontend component.
 * 
 * Key Features:
 * - Load balancing across machines
 * - 24/7 operation with weekend closures
 * - Capacity calculation per machine (G1 vs G2)
 * - Automatic end-date scheduling
 */

/**
 * CONFIGURACIÓN DE MÁQUINAS
 * G1: Productos AL* (M1, M2, M3, M4 disponibles)
 * G2: Productos AC* (M1, M2, M3 disponibles - M4 NO)
 */
const CONFIG_MAQUINAS = {
  G1: {
    maquinas: ['M1', 'M2', 'M3', 'M4'],
    descripcion: 'Generación 1 (M1, M2, M3, M4)',
    getCapacidad: (maquina, oee) => {
      const pistas = maquina === 'M4' ? 6 : 12;
      return pistas * 55 * oee; // ciclos/minuto * OEE
    }
  },
  G2: {
    maquinas: ['M1', 'M2', 'M3'],
    descripcion: 'Generación 2 (M1, M2, M3)',
    getCapacidad: (maquina, oee) => {
      return 12 * 55 * oee; // 12 pistas para todas
    }
  }
};

/**
 * Determine product generation from product code
 * @param {string} productCode - Product code (e.g., "AL001", "AC002")
 * @returns {string} - Generation: "G1" or "G2"
 */
function obtenerGeneracion(productCode) {
  if (!productCode) return 'G1'; // Default to G1
  
  const codigo = String(productCode).toUpperCase();
  if (codigo.startsWith('AC')) return 'G2';
  return 'G1'; // Default for AL* and others
}

/**
 * Check if current datetime is in weekend closure window
 * Closure: Sat 14:00 → Sun 20:00 (30 hours)
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
function isInClosure(date) {
  const day = date.getDay(); // 0: Domingo, 6: Sábado
  const hour = date.getHours();

  if (day === 6 && hour >= 14) return true; // Sábado desde 14:00
  if (day === 0 && hour < 20) return true; // Domingo antes de 20:00
  return false;
}

/**
 * Get timestamp when next closure starts
 * @param {Date} date - Reference date
 * @returns {Date}
 */
function getNextClosureStart(date) {
  const d = new Date(date);
  const day = d.getDay();

  // Si es sábado antes de las 14:00, el cierre empieza hoy
  if (day === 6 && d.getHours() < 14) {
    d.setHours(14, 0, 0, 0);
    return d;
  }

  // Calcular días hasta próximo sábado
  let daysToAdd = (6 - day + 7) % 7;
  if (daysToAdd === 0 && d.getHours() >= 14) daysToAdd = 7;

  d.setDate(d.getDate() + daysToAdd);
  d.setHours(14, 0, 0, 0);
  return d;
}

/**
 * Get timestamp when closure ends (always Sunday 20:00)
 * @param {Date} date - Reference date
 * @returns {Date}
 */
function getNextClosureEnd(date) {
  const d = new Date(date);
  const day = d.getDay();

  if (day === 6 && d.getHours() >= 14) {
    // Already in closure, next Sunday at 20:00
    d.setDate(d.getDate() + 1);
  } else if (day === 0 && d.getHours() < 20) {
    // In closure on Sunday morning, same day at 20:00
    d.setHours(20, 0, 0, 0);
    return d;
  } else {
    // Calculate next Sunday
    let daysToAdd = (0 - day + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
    d.setDate(d.getDate() + daysToAdd);
  }

  d.setHours(20, 0, 0, 0);
  return d;
}

/**
 * Calculate final date considering 24/7 operation + weekend closures
 * CORE ALGORITHM: Respect production minutes while skipping closure windows
 * @param {Date} startDate - Start datetime
 * @param {number} minutosNecesarios - Production minutes required
 * @returns {Date} - Calculated end datetime
 */
function calcularFechaFinConHorarioLaboral(startDate, minutosNecesarios) {
  if (minutosNecesarios <= 0) return new Date(startDate);

  let currentDateTime = new Date(startDate);
  let remainingMinutes = minutosNecesarios;

  // Si inicia en período de cierre, saltar al final del cierre
  if (isInClosure(currentDateTime)) {
    currentDateTime = getNextClosureEnd(currentDateTime);
  }

  while (remainingMinutes > 0) {
    // Verificar si estamos en período de cierre
    if (isInClosure(currentDateTime)) {
      currentDateTime = getNextClosureEnd(currentDateTime);
      continue;
    }

    // Calcular próximo período de cierre
    const nextClosureStart = getNextClosureStart(currentDateTime);
    const nextClosureEnd = getNextClosureEnd(currentDateTime);

    // Minutos disponibles hasta próximo cierre
    const minutesUntilClosure = Math.floor((nextClosureStart - currentDateTime) / 60000);

    if (remainingMinutes <= minutesUntilClosure) {
      // Remaining production fits in this window
      currentDateTime.setMinutes(currentDateTime.getMinutes() + remainingMinutes);
      remainingMinutes = 0;
    } else {
      // Jump to after closure
      remainingMinutes -= minutesUntilClosure;
      currentDateTime = nextClosureEnd;
    }
  }

  return currentDateTime;
}

/**
 * Calculate machine capacity in cycles/minute
 * @param {string} maquina - Machine ID (M1-M4)
 * @param {string} generacion - Generation (G1 or G2)
 * @param {number} oee - OEE efficiency factor (0-1)
 * @returns {number} - Capacity in cycles/minute
 */
function calcularCapacidadMaquina(maquina, generacion, oee) {
  const config = CONFIG_MAQUINAS[generacion];
  if (!config) throw new Error(`Generación inválida: ${generacion}`);
  
  const capacidad = config.getCapacidad(maquina, oee);
  return Math.max(0, capacidad);
}

/**
 * Calculate production time in minutes
 * @param {number} cantidad - Quantity to produce
 * @param {string} generacion - Generation (G1 or G2)
 * @param {string} maquina - Machine ID
 * @param {number} oee - OEE factor
 * @returns {{tiempoMinutos: number, capacidadPorMinuto: number}}
 */
function calcularTiempoProduccion(cantidad, generacion, maquina, oee) {
  if (cantidad <= 0) return { tiempoMinutos: 0, capacidadPorMinuto: 0 };

  const capacidadPorMinuto = calcularCapacidadMaquina(maquina, generacion, oee);
  if (capacidadPorMinuto <= 0) {
    throw new Error(`No se puede calcular capacidad para ${maquina} en ${generacion}`);
  }

  const tiempoMinutos = Math.ceil(cantidad / capacidadPorMinuto);
  return { tiempoMinutos, capacidadPorMinuto };
}

/**
 * Get machines available for a given generation
 * @param {string} generacion - G1 or G2
 * @returns {string[]} - Array of compatible machines
 */
function obtenerMaquinasDisponibles(generacion) {
  const config = CONFIG_MAQUINAS[generacion];
  if (!config) return ['M1', 'M2', 'M3', 'M4'];
  return config.maquinas;
}

/**
 * Assign order to least-loaded compatible machine
 * STRATEGY: Load balancing ensures even distribution
 * @param {string} generacion - Product generation
 * @param {Object} machineLoads - { M1: 240, M2: 180, M3: 0, M4: 0 }
 * @returns {string} - Selected machine ID
 */
function asignarMaquinaOptima(generacion, machineLoads) {
  const maquinasCompatibles = obtenerMaquinasDisponibles(generacion);
  
  // Find machine with minimum accumulated minutes
  let maquinaOptima = maquinasCompatibles[0];
  let cargaMinima = machineLoads[maquinaOptima] || 0;

  for (const maquina of maquinasCompatibles) {
    const cargaActual = machineLoads[maquina] || 0;
    if (cargaActual < cargaMinima) {
      cargaMinima = cargaActual;
      maquinaOptima = maquina;
    }
  }

  return maquinaOptima;
}

/**
 * Calculate all production plans for given orders
 * MAIN CALCULATION ENGINE
 * @param {Array} pedidos - List of orders with { id, no_sales_line, qty_pending }
 * @param {Array} stocks - List of available stock with { item_no, qty_base }
 * @param {Object} oeeMaquinas - OEE per machine { M1: 0.85, M2: 0.85, ... }
 * @param {Date} fechaInicio - Start date for calculations
 * @returns {Object} - { planes: [...], carga_máquinas: {...}, validaciones: {...} }
 */
function calcularPlanesProduccion(pedidos, stocks, oeeMaquinas, fechaInicio = null) {
  const planes = [];
  const cargaMaquinas = { M1: 0, M2: 0, M3: 0, M4: 0 };
  const pedidosSinStock = [];
  const warnings = [];

  if (!fechaInicio) {
    fechaInicio = new Date();
    fechaInicio.setHours(0, 0, 0, 0);
  }

  // Group orders by product code
  const pedidosPorProducto = {};
  for (const pedido of pedidos) {
    const productCode = String(pedido.no_sales_line || '').toUpperCase();
    if (!pedidosPorProducto[productCode]) {
      pedidosPorProducto[productCode] = [];
    }
    pedidosPorProducto[productCode].push(pedido);
  }

  // Group stock by item number
  const stockPorItem = {};
  for (const stock of stocks) {
    const itemNo = String(stock.item_no || '').toUpperCase();
    if (!stockPorItem[itemNo]) {
      stockPorItem[itemNo] = 0;
    }
    stockPorItem[itemNo] += stock.qty_base || 0;
  }

  // Generate plans for each order
  for (const productCode in pedidosPorProducto) {
    const ordenesProducto = pedidosPorProducto[productCode];
    const generacion = obtenerGeneracion(productCode);
    const stockDisponible = stockPorItem[productCode] || 0;

    const oeeProducto = oeeMaquinas['M1'] || 0.85; // Primary reference, will be overridden per machine

    for (const pedido of ordenesProducto) {
      const cantidad = pedido.qty_pending || 0;
      
      if (cantidad <= 0) continue;

      // Assign best machine
      const maquinaAsignada = asignarMaquinaOptima(generacion, cargaMaquinas);
      const oeeMaquina = oeeMaquinas[maquinaAsignada] || 0.85;

      // Calculate production time
      let tiempoMinutos = 0;
      try {
        const tiempoCalc = calcularTiempoProduccion(cantidad, generacion, maquinaAsignada, oeeMaquina);
        tiempoMinutos = tiempoCalc.tiempoMinutos;
      } catch (e) {
        warnings.push(`Error calculando tiempo para pedido ${pedido.id}: ${e.message}`);
        continue;
      }

      // Calculate end date
      const fechaFin = calcularFechaFinConHorarioLaboral(fechaInicio, tiempoMinutos);

      // Accumulate machine load
      cargaMaquinas[maquinaAsignada] += tiempoMinutos;

      // Check stock
      if (cantidad > stockDisponible) {
        pedidosSinStock.push(pedido.id);
        warnings.push(`Pedido ${pedido.id}: Se requieren ${cantidad} pero solo hay ${stockDisponible} disponibles`);
      }

      // Create plan object
      planes.push({
        id: null, // Will be set by DB on insert
        alupak_pedido_id: pedido.id,
        cantidad_planificada: cantidad,
        maquina_asignada: maquinaAsignada,
        generacion: generacion,
        fecha_inicio: fechaInicio.toISOString().split('T')[0],
        fecha_fin: fechaFin.toISOString().split('T')[0],
        estado: 'Requiere producción',
        oee_aplicado: oeeMaquina,
        tiempo_estimado_minutos: tiempoMinutos,
        prioridad: '3',
        observaciones: 'Plan auto-calculado',
        es_manual: false,
        created_at: new Date().toISOString()
      });
    }
  }

  return {
    planes,
    carga_máquinas: cargaMaquinas,
    validaciones: {
      pedidos_sin_stock: pedidosSinStock,
      warnings: warnings
    }
  };
}

module.exports = {
  CONFIG_MAQUINAS,
  obtenerGeneracion,
  isInClosure,
  getNextClosureStart,
  getNextClosureEnd,
  calcularFechaFinConHorarioLaboral,
  calcularCapacidadMaquina,
  calcularTiempoProduccion,
  obtenerMaquinasDisponibles,
  asignarMaquinaOptima,
  calcularPlanesProduccion
};
