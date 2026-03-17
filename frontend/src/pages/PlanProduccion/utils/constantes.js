/**
 * Constantes centralizadas para módulo PlanProduccion
 * Single source of truth para máquinas, estados, tipos de errores, mensajes
 */

export const MAQUINAS = [
  { id: 'M1', nombre: 'M1', pistas: 12, generaciones: ['G1', 'G2'] },
  { id: 'M2', nombre: 'M2', pistas: 12, generaciones: ['G1', 'G2'] },
  { id: 'M3', nombre: 'M3', pistas: 12, generaciones: ['G1', 'G2'] },
  { id: 'M4', nombre: 'M4', pistas: 6, generaciones: ['G1'] } // Solo G1
];

export const ESTADOS_PLAN = {
  requiere_produccion: 'Requiere Producción',
  en_produccion: 'En Producción',
  planificado: 'Planificado',
  stock_suficiente: 'Stock Suficiente',
  completado: 'Completado',
  cancelado: 'Cancelado'
};

export const PRIORIDADES = {
  '1': 'Alta - Inmediata',
  '2': 'Media - Esta semana',
  '3': 'Baja - Normal'
};

export const ERROR_TYPES = {
  VALIDATION: 'validation',
  API: 'api',
  NETWORK: 'network',
  AUTH: 'auth',
  NOT_FOUND: 'not_found',
  SERVER: 'server',
  UNKNOWN: 'unknown'
};

export const MENSAJES_ERROR = {
  CANTIDAD_REQUERIDA: 'La cantidad es requerida y debe ser mayor a 0',
  FECHA_INVALIDA: 'La fecha de inicio debe ser válida',
  MAQUINA_REQUERIDA: 'Debe seleccionar una máquina',
  STOCK_INSUFICIENTE: 'Stock insuficiente para la cantidad solicitada',
  PEDIDO_REQUERIDO: 'Debe seleccionar un pedido',
  COMPATIBILIDAD_MAQUINA: 'La máquina no es compatible con este producto',
  ERROR_CALCULO: 'Error al calcular la fecha de fin',
  ERROR_GUARDADO: 'Error al guardar el plan',
  ERROR_ACTUALIZACION: 'Error al actualizar el plan',
  ERROR_ELIMINACION: 'Error al eliminar el plan',
  ERROR_NETWORK: 'Error de conexión - verifica tu internet',
  EXITO_CREACION: 'Plan creado exitosamente',
  EXITO_ACTUALIZACION: 'Plan actualizado exitosamente',
  EXITO_ELIMINACION: 'Plan eliminado exitosamente'
};

export const GENERACIONES = {
  G1: {
    nombre: 'Generación 1 (AL)',
    descripcion: 'Productos con prefijo AL',
    ciclosPorMinuto: 55,
    maquinas: ['M1', 'M2', 'M3', 'M4']
  },
  G2: {
    nombre: 'Generación 2 (AC)',
    descripcion: 'Productos con prefijo AC',
    ciclosPorMinuto: 55,
    maquinas: ['M1', 'M2', 'M3'] // M4 NO disponible para G2
  }
};

export const HORARIO_LABORAL = {
  operativo: '24/7',
  cierreInicio: 'Sábado 14:00',
  cierreFin: 'Domingo 20:00',
  horesCierre: 30,
  minutoCierre: 1800
};

export const CONFIG_PAGINA = {
  REGISTROS_POR_PAGINA: 20,
  MAX_PAGINAS: 100
};
