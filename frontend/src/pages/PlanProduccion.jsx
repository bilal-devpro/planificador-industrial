import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Factory, Play, Pause, CheckCircle, AlertTriangle, Eye, Download, Plus, RefreshCw,
  Package, Clock, Calendar, HardHat, TrendingUp, Database, Edit2, Save, X, Settings,
  Cpu, Calculator, MapPin, AlertCircle, FileSpreadsheet, Hash, Tag, TrendingUp as TrendingUpIcon,
  Info, Lock, Unlock, Trash2, Zap, SortAsc, SortDesc, ArrowUpDown, FilterX, ChevronUp, ChevronDown,FileText,
  Search as SearchIcon,
  // ✅ AGREGA ESTA LÍNEA:
  History, Undo, Redo, Scale, ArrowLeftRight  // Asegúrate de incluir History, Undo y Redo
} from 'lucide-react';
import LoteBadge from '../components/LoteBadge';
import { Helmet } from 'react-helmet-async';

// CONFIGURACIÓN DE MÁQUINAS - ¡M4 ahora es G1 (Generación 1)!
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

const PlanProduccion = () => {
  // Estados principales - ✅ INICIALIZADOS CORRECTAMENTE
  const [pedidos, setPedidos] = useState([]);
  const [lineas, setLineas] = useState([]);
  const [planManual, setPlanManual] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState(null);
  const [formData, setFormData] = useState({});
  const [resumen, setResumen] = useState({
    pedidos: { total: 0, cantidad_total: 0 },
    stock: { productos_unicos: 0, cantidad_total: 0 },
    stock_bajo: 0,
    stock_critico: 0,
    stock_normal: 0,
    stock_excedente: 0,
    maquinas: { oee: 0 }
  });
  const [activeTab, setActiveTab] = useState('planificacion');
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // ✅ Estado inicializado con valores por defecto para evitar warnings
  const [nuevoPlan, setNuevoPlan] = useState({
    alupak_pedido_id: '',
    cantidad_planificada: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: '',
    linea_asignada: '',
    prioridad: '3',
    observaciones: '',
    maquina_asignada: '',
    generacion: ''
  });

  // Estados para filtros y ordenación
  const [filtros, setFiltros] = useState({
    estado: '',
    generacion: '',
    maquina: '',
    prioridad: '',
    search: ''
  });
  const [orden, setOrden] = useState({ campo: 'fecha_inicio', direccion: 'asc' });

  // ✅ OEE por máquina - editable con INPUT NUMÉRICO (sin sliders)
  const [oeeMaquinas, setOeeMaquinas] = useState({
    M1: 0.85,
    M2: 0.85,
    M3: 0.85,
    M4: 0.85
  });
  const [guardandoOee, setGuardandoOee] = useState(false);

  const [calculando, setCalculando] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  // ✅ SISTEMA DE HISTORIAL CON UNDO/REDO
  const [historialCambios, setHistorialCambios] = useState([]);
  const [indiceHistorial, setIndiceHistorial] = useState(-1);
  const [datosOriginales, setDatosOriginales] = useState(null);

  // === ACCESIBILIDAD AAA - REFS Y ESTADOS ===
  const modalRef = useRef(null);
  const historyModalRef = useRef(null);
  const mainContentRef = useRef(null);
  const [announcements, setAnnouncements] = useState([]);
  const [focusTrapActive, setFocusTrapActive] = useState(false);
  const lastFocusedElement = useRef(null);

  // Función para anunciar cambios a lectores de pantalla
  const announceToScreenReader = (message, priority = 'polite') => {
    const announcement = {
      id: Date.now(),
      message,
      priority
    };
    setAnnouncements(prev => [...prev, announcement]);

    // Remover anuncio después de 5 segundos
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== announcement.id));
    }, 5000);
  };

  // Función para manejar foco en modales
  const handleModalFocus = (modalRef, isOpen) => {
    if (isOpen) {
      lastFocusedElement.current = document.activeElement;
      setFocusTrapActive(true);
      setTimeout(() => {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements?.length > 0) {
          focusableElements[0].focus();
        }
      }, 100);
    } else {
      setFocusTrapActive(false);
      if (lastFocusedElement.current) {
        lastFocusedElement.current.focus();
      }
    }
  };

  // Escuchar cambios de OEE desde Configuración y otros componentes
  useEffect(() => {
    fetchData();

    const handleOeeUpdate = (event) => {
      console.log('🔄 Detectado cambio de OEE desde Configuración. Recargando datos...');
      if (event.detail && event.detail.oeeValues) {
        setOeeMaquinas(event.detail.oeeValues);
        announceToScreenReader('Valores de OEE actualizados desde configuración');
      } else {
        fetchData();
      }
    };

    const handlePlanUpdated = () => {
      console.log('🔄 Detectada actualización del plan desde otro componente. Recargando datos...');
      fetchData();
      announceToScreenReader('Plan de producción actualizado desde otro componente');
    };
    const handleDatosActualizados = () => {
      console.log('🔄 Detectados nuevos datos importados. Recalculando plan inteligente...');
      fetchData();
      announceToScreenReader('Nuevos datos importados, recalculando plan de producción');
    };

    window.addEventListener('oeeUpdated', handleOeeUpdate);
    window.addEventListener('planUpdated', handlePlanUpdated);
    window.addEventListener('datosActualizados', handleDatosActualizados);

    return () => {
      window.removeEventListener('oeeUpdated', handleOeeUpdate);
      window.removeEventListener('planUpdated', handlePlanUpdated);
      window.removeEventListener('datosActualizados', handleDatosActualizados);
    };
}, []);

// Manejar foco en modales para accesibilidad
useEffect(() => {
  handleModalFocus(modalRef, showModal);
}, [showModal]);

useEffect(() => {
  handleModalFocus(historyModalRef, showHistoryModal);
}, [showHistoryModal]);

// Navegación por teclado global
useEffect(() => {
  const handleKeyDown = (e) => {
    // Atajos de teclado para accesibilidad
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          e.preventDefault();
          if (!e.shiftKey) {
            deshacer();
          } else {
            rehacer();
          }
          break;
        case 'y':
          e.preventDefault();
          rehacer();
          break;
        case '/':
          e.preventDefault();
          const searchInput = document.getElementById('search-input');
          if (searchInput) {
            searchInput.focus();
            announceToScreenReader('Foco movido al campo de búsqueda');
          }
          break;
      }
    }

    // Escape para cerrar modales
    if (e.key === 'Escape') {
      if (showHistoryModal) {
        setShowHistoryModal(false);
      } else if (showModal) {
        setShowModal(false);
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [showModal, showHistoryModal]);

// Anunciar cambios en el plan
useEffect(() => {
  if (planManual.length > 0) {
    announceToScreenReader(`${planManual.length} órdenes de producción cargadas`);
  }
}, [planManual.length]);
const API = import.meta.env.VITE_API_URL;
const fetchData = async (forzarRecarga = false) => {
  // Verificar cambios no guardados antes de recargar
  if (!forzarRecarga && datosOriginales && JSON.stringify(planManual) !== datosOriginales) {
    if (!window.confirm('⚠️ Tienes cambios no guardados que se perderán al actualizar. ¿Deseas continuar?')) {
      return;
    }
  }

  try {
    setLoading(true);
    const [pedidosRes, lineasRes, resumenRes, stockRes, configRes, planesRes] = await Promise.all([
      fetch(`${API}/api/dashboard-excel/pedidos`),
      fetch(`${API}/api/lineas`),
      fetch(`${API}/api/dashboard-excel/resumen`),
      fetch(`${API}/api/dashboard-excel/stock`),
      fetch(`${API}/api/configuracion`),
      fetch(`${API}/api/plan/produccion`)
    ]);

    const pedidosData = await pedidosRes.json();
    const lineasData = await lineasRes.json();
    const resumenData = await resumenRes.json();
    const stockData = await stockRes.json();
    const configData = await configRes.json();
    const planesData = await planesRes.json();

    // Cargar OEE por máquina desde configuración
    const nuevoOee = { M1: 0.85, M2: 0.85, M3: 0.85, M4: 0.85 };
    configData.data?.forEach(config => {
      if (config.clave.startsWith('oee_maquina_')) {
        const maquina = config.clave.split('_')[2];
        if (nuevoOee[maquina] !== undefined) {
          nuevoOee[maquina] = parseFloat(config.valor) || 0.85;
        }
      }
    });

    setOeeMaquinas(nuevoOee);
    setPedidos(pedidosData.pedidos || []);
    setLineas(lineasData.lineas || []);
    setResumen(resumenData.resumen || {});
    setStockData(stockData.stock || []);

    // Cargar planes existentes desde BD
    const planesExistentes = planesData.planes || [];
    setPlanManual(planesExistentes);

    setLoading(false);

    // Calcular plan inteligente automáticamente si hay pedidos y stock, y no hay planes existentes (a menos que sea forzarRecarga)
    if (pedidosData.pedidos && pedidosData.pedidos.length > 0 && stockData.stock && stockData.stock.length > 0 && (planesExistentes.length === 0 || forzarRecarga)) {
      const stockConsolidado = procesarStockConsolidado(stockData.stock);
      const planCalculado = crearPlanConCalculos(pedidosData.pedidos, stockConsolidado, nuevoOee);
      setPlanManual(planCalculado);

      // Guardar planes calculados en BD
      try {
        await fetch(`${API}/api/plan/produccion/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planes: planCalculado })
        });
      } catch (error) {
        console.error('Error guardando planes calculados:', error);
      }
    }
  } catch (error) {
    console.error('❌ Error cargando datos del plan:', error);
    setLoading(false);
  }
};

// Procesar stock consolidado por producto
const procesarStockConsolidado = (stockDetalle) => {
  const consolidado = {};
  stockDetalle.forEach(item => {
    if (!consolidado[item.item_no]) {
      consolidado[item.item_no] = { item_no: item.item_no, total_stock: 0 };
    }
    consolidado[item.item_no].total_stock += item.qty_base || 0;
  });
  return Object.values(consolidado);
};

// ========================================
// LÓGICA CORREGIDA: Distribución Equitativa + ACUMULACIÓN DE TIEMPOS POR MÁQUINA CON HORARIO 24/7
// ========================================
const crearPlanConCalculos = (pedidosList, stockConsolidado, oeeValues) => {
  // Agrupar pedidos por producto
  const pedidosPorProducto = {};
  pedidosList.forEach(pedido => {
    if (!pedidosPorProducto[pedido.no_sales_line]) {
      pedidosPorProducto[pedido.no_sales_line] = [];
    }
    pedidosPorProducto[pedido.no_sales_line].push(pedido);
  });

  // Calcular stock disponible secuencialmente
  const pedidosConStockAjustado = [];
  const stockRestantePorProducto = {};

  Object.entries(pedidosPorProducto).forEach(([producto, pedidosProducto]) => {
    const stockProducto = stockConsolidado.find(s => s.item_no === producto);
    let stockRestante = stockProducto?.total_stock || 0;
    stockRestantePorProducto[producto] = stockRestante;

    pedidosProducto.forEach(pedido => {
      const stockDisponibleParaPedido = stockRestante;
      const cantidadAProducir = Math.max(0, pedido.qty_pending - stockDisponibleParaPedido);
      stockRestante = Math.max(0, stockRestante - pedido.qty_pending);
      stockRestantePorProducto[producto] = stockRestante;

      pedidosConStockAjustado.push({
        ...pedido,
        stock_disponible_ajustado: stockDisponibleParaPedido,
        cantidad_a_producir: cantidadAProducir
      });
    });
  });

  // Contador de carga por máquina (minutos acumulados + última fecha de fin)
  const cargaPorMaquina = {
    M1: { minutosAcumulados: 0, ultimaFechaFin: null },
    M2: { minutosAcumulados: 0, ultimaFechaFin: null },
    M3: { minutosAcumulados: 0, ultimaFechaFin: null },
    M4: { minutosAcumulados: 0, ultimaFechaFin: null }
  };

  // Asignar máquinas equitativamente + ACUMULAR TIEMPOS CORRECTAMENTE
  return pedidosConStockAjustado.map((pedidoItem) => {
    const esG1 = pedidoItem.no_sales_line?.startsWith('AL');
    const esG2 = pedidoItem.no_sales_line?.startsWith('AC');
    const generacion = esG1 ? 'G1' : (esG2 ? 'G2' : 'G1');

    let maquinaAsignada;
    let tiempoMinutos = 0;
    let oeeMaquina = 0.85;
    let fecha_inicio = '';
    let fecha_fin = '';

    if (pedidoItem.cantidad_a_producir > 0) {
      const maquinasDisponibles = CONFIG_MAQUINAS[generacion].maquinas;

      // Estrategia: Máquina con MENOS minutos acumulados (balanceo inteligente)
      const maquinaMenosCargada = maquinasDisponibles.reduce((menor, maq) => {
        return cargaPorMaquina[maq].minutosAcumulados < cargaPorMaquina[menor].minutosAcumulados ? maq : menor;
      }, maquinasDisponibles[0]);
      maquinaAsignada = maquinaMenosCargada;

      // Obtener OEE específico
      oeeMaquina = oeeValues[maquinaAsignada] || 0.85;

      // Calcular tiempo en minutos CONTINUOS (sin considerar horario laboral aún)
      const capacidadPorMinuto = CONFIG_MAQUINAS[generacion].getCapacidad(maquinaAsignada, oeeMaquina);
      tiempoMinutos = Math.ceil(pedidoItem.cantidad_a_producir / capacidadPorMinuto);

      // ✅¡CORRECCIÓN CRÍTICA! Determinar fecha de inicio REAL con acumulación de hora exacta y horario 24/7
      let startDateTime;
      if (cargaPorMaquina[maquinaAsignada].ultimaFechaFin) {
        startDateTime = new Date(cargaPorMaquina[maquinaAsignada].ultimaFechaFin);
      } else {
        if (pedidoItem.fecha_importacion) {
          const fechaParts = pedidoItem.fecha_importacion.split('/');
          if (fechaParts.length === 3) {
            const [dia, mes, anio] = fechaParts;
            startDateTime = new Date(`${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T00:00:00`);
          } else {
            startDateTime = new Date(pedidoItem.fecha_importacion);
          }
          if (isNaN(startDateTime.getTime())) startDateTime = new Date();
        } else {
          startDateTime = new Date();
          startDateTime.setHours(0, 0, 0, 0); // Forzar a 00:00
        }
      }

      // Calcular fecha de fin considerando HORARIO 24/7 + CIERRE DE FIN DE SEMANA
      const endDateTime = calcularFechaFinConHorarioLaboral(startDateTime, tiempoMinutos);

      // ✅ ACTUALIZAR ESTADO DE MÁQUINA CON FECHA COMPLETA (INCLUYENDO HORA)
      cargaPorMaquina[maquinaAsignada].minutosAcumulados += tiempoMinutos;
      cargaPorMaquina[maquinaAsignada].ultimaFechaFin = new Date(endDateTime);

      // Formatear SOLO para visualización (YYYY-MM-DD)
      fecha_inicio = startDateTime.toISOString().split('T')[0];
      fecha_fin = endDateTime.toISOString().split('T')[0];

      // Conversión a cajas
      const unidadesPorCaja = esG1 ? 16380 : (esG2 ? 15600 : 0);
      const cajasPendientes = pedidoItem.qty_pending ? Math.ceil(pedidoItem.qty_pending / unidadesPorCaja) : 0;
      const cajasAProducir = pedidoItem.cantidad_a_producir ? Math.ceil(pedidoItem.cantidad_a_producir / unidadesPorCaja) : 0;

      return {
        id: `plan-${pedidoItem.id}`,
        alupak_pedido_id: pedidoItem.id,
        customer_name: pedidoItem.customer_name,
        no_sales_line: pedidoItem.no_sales_line,
        producto_nombre: pedidoItem.producto_nombre || pedidoItem.no_sales_line,
        cantidad_pendiente: pedidoItem.qty_pending,
        stock_disponible_original: pedidoItem.stock_disponible || 0,
        stock_disponible_ajustado: pedidoItem.stock_disponible_ajustado || 0,
        cantidad_a_producir: pedidoItem.cantidad_a_producir || 0,
        cantidad_planificada: pedidoItem.cantidad_a_producir || 0,
        fecha_inicio: fecha_inicio,
        fecha_fin: fecha_fin,
        linea_asignada: '',
        maquina_asignada: maquinaAsignada,
        generacion: generacion,
        prioridad: '3',
        estado: pedidoItem.cantidad_a_producir > 0 ? 'requiere_produccion' : 'stock_suficiente',
        observaciones: '',
        tiempo_estimado_min: tiempoMinutos,
        oee_aplicado: oeeMaquina,
        creado_en: new Date().toISOString(),
        es_manual: false,
        // ✅ Datos adicionales para visualización
        unidades_por_caja: unidadesPorCaja,
        cajas_pendientes: cajasPendientes,
        cajas_a_producir: cajasAProducir,
        cajas_stock_disponible: pedidoItem.stock_disponible_ajustado ? Math.ceil(pedidoItem.stock_disponible_ajustado / unidadesPorCaja) : 0
      };
    } else {
      // Si no necesita producción, asignar M1 por defecto
      maquinaAsignada = CONFIG_MAQUINAS[generacion].maquinas[0];
      oeeMaquina = oeeValues[maquinaAsignada] || 0.85;

      // Conversión a cajas
      const unidadesPorCaja = esG1 ? 16380 : (esG2 ? 15600 : 0);
      const cajasPendientes = pedidoItem.qty_pending ? Math.ceil(pedidoItem.qty_pending / unidadesPorCaja) : 0;
      const cajasStockDisponible = pedidoItem.stock_disponible_ajustado ? Math.ceil(pedidoItem.stock_disponible_ajustado / unidadesPorCaja) : 0;

      fecha_inicio = pedidoItem.fecha_importacion ? (() => {
        const parts = pedidoItem.fecha_importacion.split('/');
        if (parts.length === 3) {
          const [d, m, a] = parts;
          return new Date(`${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`).toISOString().split('T')[0];
        }
        return new Date(pedidoItem.fecha_importacion).toISOString().split('T')[0];
      })() : '';
      fecha_fin = '';

      return {
        id: `plan-${pedidoItem.id}`,
        alupak_pedido_id: pedidoItem.id,
        customer_name: pedidoItem.customer_name,
        no_sales_line: pedidoItem.no_sales_line,
        producto_nombre: pedidoItem.producto_nombre || pedidoItem.no_sales_line,
        cantidad_pendiente: pedidoItem.qty_pending,
        stock_disponible_original: pedidoItem.stock_disponible || 0,
        stock_disponible_ajustado: pedidoItem.stock_disponible_ajustado || 0,
        cantidad_a_producir: 0,
        cantidad_planificada: 0,
        fecha_inicio: fecha_inicio,
        fecha_fin: fecha_fin,
        linea_asignada: '',
        maquina_asignada: maquinaAsignada,
        generacion: generacion,
        prioridad: '3',
        estado: 'stock_suficiente',
        observaciones: '',
        tiempo_estimado_min: 0,
        oee_aplicado: oeeMaquina,
        creado_en: new Date().toISOString(),
        es_manual: false,
        unidades_por_caja: unidadesPorCaja,
        cajas_pendientes: cajasPendientes,
        cajas_a_producir: 0,
        cajas_stock_disponible: cajasStockDisponible
      };
    }
  }).filter(p => p.cantidad_a_producir > 0); // Solo incluir pedidos que requieren producción
};

// Manejar filtros
const handleFilterChange = (campo, valor) => {
  setFiltros(prev => ({ ...prev, [campo]: valor }));
};

// Manejar ordenación
const handleSort = (campo) => {
  setOrden(prev => ({
    campo: campo,
    direccion: prev.campo === campo ? (prev.direccion === 'asc' ? 'desc' : 'asc') : 'asc'
  }));
};

// Ordenar y filtrar datos
const datosFiltradosYOrdenados = useMemo(() => {
  let datos = [...planManual];

  // Aplicar filtros
  if (filtros.estado) {
    datos = datos.filter(d => d.estado === filtros.estado);
  }
  if (filtros.generacion) {
    datos = datos.filter(d => d.generacion === filtros.generacion);
  }
  if (filtros.maquina) {
    datos = datos.filter(d => d.maquina_asignada === filtros.maquina);
  }
  if (filtros.prioridad) {
    datos = datos.filter(d => d.prioridad === filtros.prioridad);
  }
  if (filtros.search) {
    const searchLower = filtros.search.toLowerCase();
    datos = datos.filter(d =>
      d.no_sales_line.toLowerCase().includes(searchLower) ||
      d.producto_nombre.toLowerCase().includes(searchLower) ||
      d.customer_name.toLowerCase().includes(searchLower)
    );
  }

  // Aplicar ordenación
  datos.sort((a, b) => {
    let valorA = a[orden.campo];
    let valorB = b[orden.campo];

    if (orden.campo.includes('fecha')) {
      valorA = new Date(valorA);
      valorB = new Date(valorB);
    } else if (typeof valorA === 'number' || typeof valorB === 'number') {
      valorA = Number(valorA) || 0;
      valorB = Number(valorB) || 0;
    }

    if (valorA < valorB) return orden.direccion === 'asc' ? -1 : 1;
    if (valorA > valorB) return orden.direccion === 'asc' ? 1 : -1;
    return 0;
  });

  return datos;
}, [planManual, filtros, orden]);

// Calcular resumen del plan
const calcularResumenPlan = () => {
  const datos = datosFiltradosYOrdenados;
  const planificadas = datos.filter(p =>
    p.estado === 'planificado' || p.estado === 'en_produccion'
  );
  const totalPlanificado = planificadas.reduce((sum, p) => sum + (p.cantidad_planificada || 0), 0);
  const totalPendiente = datos.reduce((sum, p) => sum + (p.cantidad_pendiente || 0), 0);
  const cobertura = totalPendiente > 0 ? Math.min(100, Math.round((totalPlanificado / totalPendiente) * 100)) : 0;
  const conStockSuficiente = datos.filter(p => p.estado === 'stock_suficiente').length;
  const requierenProduccion = datos.filter(p =>
    p.estado === 'requiere_produccion' || p.estado === 'planificado'
  ).length;

  // Calcular utilización por máquina
  const utilizacionMaquinas = { M1: 0, M2: 0, M3: 0, M4: 0 };
  planificadas.forEach(p => {
    if (p.maquina_asignada && p.tiempo_estimado_min) {
      utilizacionMaquinas[p.maquina_asignada] += p.tiempo_estimado_min;
    }
  });

  return {
    total_planificado: totalPlanificado,
    total_pendiente: totalPendiente,
    cobertura: cobertura,
    ordenes_planificadas: planificadas.length,
    con_stock_suficiente: conStockSuficiente,
    requieren_produccion: requierenProduccion,
    lineas_utilizadas: [...new Set(planificadas.map(p => p.linea_asignada).filter(Boolean))].length,
    maquinas_utilizadas: [...new Set(planificadas.map(p => p.maquina_asignada).filter(Boolean))].length,
    utilizacion_maquinas: utilizacionMaquinas,
    // ✅ ACTUALIZADO: Capacidad semanal real (24/7 menos cierre de fin de semana)
    capacidad_semanal_minutos: 10080 - 1800, // 7 días * 24h * 60min - 30h de cierre (1800 min)
    capacidad_semanal_horas: 138, // (10080 - 1800) / 60
    cierre_fin_semana: 'Sáb 14:00 - Dom 20:00 (30h)'
  };
};

const resumenPlan = calcularResumenPlan();

// ✅ SISTEMA DE HISTORIAL CON UNDO/REDO
const guardarEnHistorial = (nuevoPlan, accion, detalles = {}) => {
  const snapshot = JSON.parse(JSON.stringify(nuevoPlan));
  const nuevoHistorial = historialCambios.slice(0, indiceHistorial + 1);

  nuevoHistorial.push({
    plan: snapshot,
    timestamp: new Date().toISOString(),
    accion: accion || 'cambio_desconocido',
    usuario: 'system',
    detalles: detalles || {}
  });

  setHistorialCambios(nuevoHistorial);
  setIndiceHistorial(nuevoHistorial.length - 1);
  setDatosOriginales(JSON.stringify(snapshot));
  console.log(`✅ Historial guardado: ${accion || 'desconocido'} (${nuevoHistorial.length} estados)`);
  announceToScreenReader(`Cambio guardado en historial: ${accion || 'desconocido'}`);
};

const deshacer = () => {
  if (indiceHistorial > 0) {
    const nuevoIndice = indiceHistorial - 1;
    const estadoAnterior = historialCambios[nuevoIndice].plan;
    setPlanManual(estadoAnterior);
    setIndiceHistorial(nuevoIndice);
    window.dispatchEvent(new Event('planUpdated'));
    console.log(`↩️ Deshacer: Volviendo al estado ${nuevoIndice + 1}/${historialCambios.length}`);
    announceToScreenReader(`Deshacer realizado. Estado ${nuevoIndice + 1} de ${historialCambios.length}`);
  } else {
    announceToScreenReader('No hay cambios anteriores para deshacer');
  }
};

const rehacer = () => {
  if (indiceHistorial < historialCambios.length - 1) {
    const nuevoIndice = indiceHistorial + 1;
    const estadoSiguiente = historialCambios[nuevoIndice].plan;
    setPlanManual(estadoSiguiente);
    setIndiceHistorial(nuevoIndice);
    window.dispatchEvent(new Event('planUpdated'));
    console.log(`↪️ Rehacer: Avanzando al estado ${nuevoIndice + 1}/${historialCambios.length}`);
    announceToScreenReader(`Rehacer realizado. Estado ${nuevoIndice + 1} de ${historialCambios.length}`);
  } else {
    announceToScreenReader('No hay cambios posteriores para rehacer');
  }
};

// ✅ GUARDAR CAMBIOS DE OEE SIN ALERTAS MOLESTAS - INPUT NUMÉRICO
const handleOeeChange = async (maquina, valor) => {
  const valorNum = parseFloat(valor);
  if (isNaN(valorNum) || valorNum < 0.5 || valorNum > 1.0) {
    announceToScreenReader(`Valor de OEE inválido para ${maquina}. Debe estar entre 0.5 y 1.0`, 'assertive');
    return;
  }

  const nuevosValores = { ...oeeMaquinas, [maquina]: valorNum };
  setOeeMaquinas(nuevosValores);

  // ✅ Guardar en base de datos SIN alertas molestas
  try {
    setGuardandoOee(true);
    await fetch(`${API}/api/configuracion`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clave: `oee_maquina_${maquina}`,
        valor: valorNum.toString()
      })
    });

    // Notificar a otros componentes
    window.dispatchEvent(new CustomEvent('oeeUpdated', {
      detail: { oeeValues: nuevosValores }
    }));

    // Feedback visual sutil en consola
    console.log(`✅ OEE de ${maquina} actualizado a ${(valorNum * 100).toFixed(0)}%`);
    announceToScreenReader(`OEE de máquina ${maquina} actualizado a ${(valorNum * 100).toFixed(0)}%`);
  } catch (error) {
    console.error('Error guardando OEE:', error);
    // Restaurar valor anterior si falla (sin alertas molestas)
    setOeeMaquinas(prev => ({ ...prev, [maquina]: prev[maquina] }));
    announceToScreenReader(`Error al guardar OEE de máquina ${maquina}`, 'assertive');
  } finally {
    setGuardandoOee(false);
  }
};

// Manejar edición de fila
const handleEdit = (row) => {
  setEditingRow(row.id);
  setFormData({
    cantidad_planificada: row.cantidad_planificada || row.cantidad_a_producir || 0,
    fecha_inicio: row.fecha_inicio || '',
    fecha_fin: row.fecha_fin || '',
    linea_asignada: row.linea_asignada || '',
    maquina_asignada: row.maquina_asignada || (row.generacion === 'G1' ? 'M1' : 'M1'),
    prioridad: row.prioridad || '3',
    observaciones: row.observaciones || ''
  });
};

// ✅ GUARDAR CAMBIOS CON HISTORIAL Y SINCRONIZACIÓN
const handleSave = async (rowId) => {
  const row = planManual.find(r => r.id === rowId);
  if (!row) {
    announceToScreenReader('Error: fila no encontrada', 'assertive');
    return;
  }

  const oeeMaquina = oeeMaquinas[formData.maquina_asignada] || 0.85;
  const { tiempoMinutos } = calcularTiempoProduccion(
    parseInt(formData.cantidad_planificada) || 0,
    row.generacion,
    formData.maquina_asignada,
    oeeMaquina,
    formData.fecha_inicio
  );

  const updatedRow = {
    ...row,
    ...formData,
    cantidad_planificada: parseInt(formData.cantidad_planificada) || 0,
    estado: parseInt(formData.cantidad_planificada) > 0 ? 'planificado' : 'stock_suficiente',
    tiempo_estimado_min: tiempoMinutos,
    oee_aplicado: oeeMaquina
  };

  const nuevoPlan = planManual.map(row => row.id === rowId ? updatedRow : row);
  setPlanManual(nuevoPlan);
  setEditingRow(null);
  setFormData({});

  // Guardar cambios en BD
  try {
    await fetch(`${API}/api/plan/produccion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version_id: null,
        pedido_id: updatedRow.alupak_pedido_id,
        producto_id: null,
        linea_id: lineas.find(l => l.codigo === updatedRow.linea_asignada)?.id || null,
        cantidad: updatedRow.cantidad_planificada,
        fecha_inicio: updatedRow.fecha_inicio,
        fecha_fin: updatedRow.fecha_fin,
        turno: '24h',
        estado: updatedRow.estado,
        oee: updatedRow.oee_aplicado,
        observaciones: updatedRow.observaciones
      })
    });
  } catch (error) {
    console.error('Error guardando cambios en BD:', error);
  }

  guardarEnHistorial(nuevoPlan, 'edicion_manual', {
    pedido: row.no_sales_line,
    cambios: Object.keys(formData).filter(k => formData[k] !== row[k])
  });

  window.dispatchEvent(new Event('planUpdated'));

  announceToScreenReader(`Cambios guardados para el pedido ${row.no_sales_line}`);

  setTimeout(() => {
    console.log('💾 Cambios guardados en base de datos:', updatedRow);
  }, 300);
};

// Funciones para mostrar información
const getEstadoBadge = (estado) => {
  const badges = {
    planificado: <span className="badge badge-completado"><CheckCircle size={14} className="mr-1" />Planificado</span>,
    requiere_produccion: <span className="badge badge-proximo"><Factory size={14} className="mr-1" />Requiere Producción</span>,
    stock_suficiente: <span className="badge badge-completado"><Package size={14} className="mr-1" />Stock Suficiente</span>,
    stock_insuficiente: <span className="badge badge-atrasado"><AlertTriangle size={14} className="mr-1" />Stock Insuficiente</span>,
    en_produccion: <span className="badge badge-proximo"><Play size={14} className="mr-1" />En Producción</span>,
    completado: <span className="badge badge-completado"><CheckCircle size={14} className="mr-1" />Completado</span>
  };
  return badges[estado] || badges.requiere_produccion;
};

const getGeneracionBadge = (generacion) => {
  return generacion === 'G1' ? (
    <span className="badge bg-blue-900/30 border-blue-800 text-blue-400">
      <Cpu size={12} className="mr-1" />
      G1 (AL)
    </span>
  ) : (
    <span className="badge bg-purple-900/30 border-purple-800 text-purple-400">
      <Cpu size={12} className="mr-1" />
      G2 (AC)
    </span>
  );
};

const getPrioridadBadge = (prioridad) => {
  const badges = {
    '1': <span className="badge badge-atrasado">Alta</span>,
    '2': <span className="badge badge-proximo">Media</span>,
    '3': <span className="badge badge-completado">Baja</span>
  };
  return badges[prioridad] || badges['3'];
};

const getMaquinaBadge = (maquina, showOEE = false) => {
  if (!maquina) return '-';
  const oeeValue = oeeMaquinas[maquina] ? (oeeMaquinas[maquina] * 100).toFixed(0) : '85';

  return (
    <span className={`badge ${maquina === 'M1' ? 'bg-blue-900/30 border-blue-800 text-blue-400' :
      maquina === 'M2' ? 'bg-green-900/30 border-green-800 text-green-400' :
        maquina === 'M3' ? 'bg-yellow-900/30 border-yellow-800 text-yellow-400' :
          maquina === 'M4' ? 'bg-purple-900/30 border-purple-800 text-purple-400' :
            'bg-gray-800 text-gray-400'
      }`}>
      <Cpu size={12} className="mr-1" />
      {maquina}
      {showOEE && (
        <span className="ml-1 text-xs opacity-75">({oeeValue}%)</span>
      )}
    </span>
  );
};

if (loading) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="loading mr-3"></div>
      <span className="text-lg">Cargando plan de producción...</span>
    </div>
  );
}

// Filtrar pedidos que no tienen planificación manual
const pedidosSinPlan = pedidos.filter(pedido =>
  !planManual.some(plan => plan.alupak_pedido_id === pedido.id)
);
return (
  <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white py-8" role="main" aria-labelledby="main-heading">
    <Helmet>
      <title>Plan de Producción Inteligente - ALUPAK Dashboard</title>
      <meta name="description" content="Sistema inteligente de planificación de producción para ALUPAK, optimizando recursos y maximizando eficiencia con cálculos automáticos basados en OEE y stock disponible." />
    </Helmet>
    <div className="space-y-6 max-w-[1920px] mx-auto px-4" ref={mainContentRef} id="main-content">
      {/* Área de anuncios para lectores de pantalla - ACCESIBILIDAD AAA */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
        aria-label="Anuncios del sistema"
      >
        {announcements.map(announcement => (
          <div key={announcement.id} aria-live={announcement.priority}>
            {announcement.message}
          </div>
        ))}
      </div>
    </div>

    {/* Skip link for screen readers */}
    <a href="#main-content" className="skip-link">
      Saltar al contenido principal
    </a>

    <div className="space-y-6 max-w-[1920px] mx-auto px-4" ref={mainContentRef} id="main-content">
      {/* Área de anuncios para lectores de pantalla - ACCESIBILIDAD AAA */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
        aria-label="Anuncios del sistema"
      >
        {announcements.map(announcement => (
          <div key={announcement.id} aria-live={announcement.priority}>
            {announcement.message}
          </div>
        ))}
      </div>

      {/* Header Mejorado con Información Clara del Horario */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" role="banner">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" id="main-heading">
            <Factory size={32} className="text-purple-400" aria-hidden="true" />
            <span className="hidden md:inline">Plan de Producción Inteligente</span>
            <span className="md:hidden">Plan Producción</span>
          </h1>
          <div className="mt-2 flex flex-wrap gap-3 items-center bg-bg-secondary/50 rounded-lg p-3">
            <div className="flex items-center gap-2 bg-green-900/30 text-green-400 px-3 py-1.5 rounded">
              <Zap size={18} />
              <span className="font-medium">Operación: 24/7</span>
            </div>
            <div className="flex items-center gap-2 bg-red-900/30 text-red-400 px-3 py-1.5 rounded">
              <Clock size={18} />
              <span className="font-medium">Parada semanal: Sábado 14:00 → Domingo 20:00</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-900/30 text-blue-400 px-3 py-1.5 rounded">
              <Hash size={18} />
              <span className="font-medium">30 horas de cierre semanal</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-900/30 text-purple-400 px-3 py-1.5 rounded">
              <Calculator size={18} />
              <span className="font-medium">Cálculos automáticos con OEE</span>
            </div>
          </div>
          <p className="text-secondary mt-3 max-w-2xl">
            Sistema inteligente de planificación que optimiza la producción considerando stock disponible,
            capacidad de máquinas, OEE específico y horario laboral 24/7 con cierres programados.
          </p>
        </div>

        {/* Controles Rápidos Mejorados */}
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={() => fetchData(true)}
            className="btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
            title="Recargar datos frescos de ALUPAK/Inventario (los cambios no guardados se perderán)"
          >
            <RefreshCw size={16} />
            Actualizar Datos
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary flex items-center gap-2 px-3 py-2 text-sm"
          >
            <Plus size={16} />
            Nueva Orden
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm bg-blue-900/20 hover:bg-blue-900/30"
          >
            <History size={16} />
            Historial ({historialCambios.length})
          </button>
          <div className="flex gap-2">
            <button
              onClick={deshacer}
              disabled={indiceHistorial <= 0}
              className={`btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm ${indiceHistorial <= 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              title={indiceHistorial <= 0 ? 'No hay cambios anteriores' : 'Deshacer último cambio'}
            >
              <Undo size={16} />
              <span className="hidden sm:inline">Deshacer</span>
            </button>
            <button
              onClick={rehacer}
              disabled={indiceHistorial >= historialCambios.length - 1}
              className={`btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm ${indiceHistorial >= historialCambios.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              title={indiceHistorial >= historialCambios.length - 1 ? 'No hay cambios posteriores' : 'Rehacer último cambio'}
            >
              <Redo size={16} />
              <span className="hidden sm:inline">Rehacer</span>
            </button>
          </div>
        </div>
      </header>
    </div>
    {/* Panel de Configuración Rápida de OEE - ¡AHORA SIN SLIDERS! */}
    <div className="card bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800/50">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/20 p-2.5 rounded-lg">
            <Settings size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="font-bold flex items-center gap-2 text-base">
              <span>OEE por Máquina (Configuración en Tiempo Real)</span>
            </div>
            <div className="text-sm text-secondary mt-1 flex flex-wrap items-center gap-4">
              {['M1', 'M2', 'M3', 'M4'].map((maquina) => {
                const oeeValue = oeeMaquinas[maquina] || 0.85;
                const porcentaje = (oeeValue * 100).toFixed(0);

                return (
                  <div key={maquina} className="flex items-center gap-2 bg-gray-800/50 px-3 py-1.5 rounded-lg">
                    <span className={`px-2 py-0.5 rounded text-xs ${oeeValue >= 0.85 ? 'bg-green-900/30 text-green-400' :
                      oeeValue >= 0.70 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-red-900/30 text-red-400'
                      }`}>
                      {maquina}:
                    </span>
                    <div className="flex items-center gap-1">
                      {/* ✅ INPUT NUMÉRICO SIN SLIDERS - SIN ALERTAS MOLESTAS */}
                      <input
                        type="number"
                        min="0.5"
                        max="1.0"
                        step="0.01"
                        value={oeeValue}
                        onChange={(e) => handleOeeChange(maquina, e.target.value)}
                        className="w-16 h-7 bg-gray-800 border border-gray-700 rounded text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title={`OEE de ${maquina} (entre 0.5 y 1.0)`}
                      />
                      <span className="text-xs opacity-75">({porcentaje}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm bg-blue-900/30 px-3 py-1.5 rounded-lg">
          <Calculator size={16} className="text-yellow-400" />
          <span className="font-medium text-yellow-400">
            Cálculos con OEE específico + Horario 24/7 (Cierre Sáb 14:00 - Dom 20:00)
          </span>
          {guardandoOee && (
            <div className="loading ml-2" style={{ width: '16px', height: '16px' }}></div>
          )}
        </div>
      </div>
    </div>

    {/* Alertas mejoradas */}
    {pedidosSinPlan.length > 0 && (
      <div className="alert alert-warning">
        <AlertTriangle size={20} />
        <div className="flex-1">
          <strong>📋 {pedidosSinPlan.length} pedidos pendientes de planificación</strong>
          <p className="text-sm mt-1">
            Estos pedidos requieren producción ya que no hay suficiente stock disponible.
            El sistema calculará automáticamente las cantidades a producir considerando el inventario actual.
          </p>
          <div className="mt-2 text-xs text-yellow-300">
            💡 Tip: Importa datos de inventario actualizados para obtener cálculos más precisos.
          </div>
        </div>
      </div>
    )}

    {/* Mensaje cuando no hay pedidos */}
    {pedidos.length === 0 && (
      <div className="alert alert-info">
        <Info size={20} />
        <div className="flex-1">
          <strong>📥 No hay pedidos importados</strong>
          <p className="text-sm mt-1">
            Para generar un plan de producción, primero importa los pedidos pendientes desde ALUPAK.
          </p>
          <div className="mt-2">
            <a href="/importar-alupak" className="btn btn-primary btn-sm">
              Ir a Importar ALUPAK
            </a>
          </div>
        </div>
      </div>
    )}

    {/* Mensaje cuando no hay stock */}
    {pedidos.length > 0 && stockData.length === 0 && (
      <div className="alert alert-info">
        <Database size={20} />
        <div className="flex-1">
          <strong>📦 No hay datos de inventario</strong>
          <p className="text-sm mt-1">
            Importa el inventario físico para calcular automáticamente las cantidades que necesitan producción.
          </p>
          <div className="mt-2">
            <a href="/importar-inventario" className="btn btn-primary btn-sm">
              Ir a Importar Inventario
            </a>
          </div>
        </div>
      </div>
    )}

    {/* Filtros y Ordenación Mejorados */}
    <nav className="card" role="navigation" aria-label="Navegación principal del plan de producción">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div className="flex flex-wrap gap-2 border-b border-border-color" role="tablist" aria-label="Secciones del plan">
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'planificacion' ? 'text-accent-purple border-b-2 border-accent-purple' : 'text-secondary'}`}
            onClick={() => {
              setActiveTab('planificacion');
              announceToScreenReader('Vista de planificación inteligente activada');
            }}
            role="tab"
            aria-selected={activeTab === 'planificacion'}
            aria-controls="planificacion-panel"
            id="tab-planificacion"
            tabIndex={activeTab === 'planificacion' ? 0 : -1}
          >
            <Factory size={16} className="inline mr-1" aria-hidden="true" />
            Planificación Inteligente
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'maquinas' ? 'text-accent-purple border-b-2 border-accent-purple' : 'text-secondary'}`}
            onClick={() => {
              setActiveTab('maquinas');
              announceToScreenReader('Vista de utilización de máquinas activada');
            }}
            role="tab"
            aria-selected={activeTab === 'maquinas'}
            aria-controls="maquinas-panel"
            id="tab-maquinas"
            tabIndex={activeTab === 'maquinas' ? 0 : -1}
          >
            <Cpu size={16} className="inline mr-1" aria-hidden="true" />
            Utilización de Máquinas (24/7)
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm ${activeTab === 'historial' ? 'text-accent-purple border-b-2 border-accent-purple' : 'text-secondary'}`}
            onClick={() => {
              setActiveTab('historial');
              announceToScreenReader('Vista de historial de cambios activada');
            }}
            role="tab"
            aria-selected={activeTab === 'historial'}
            aria-controls="historial-panel"
            id="tab-historial"
            tabIndex={activeTab === 'historial' ? 0 : -1}
          >
            <History size={16} className="inline mr-1" aria-hidden="true" />
            Historial de Cambios
          </button>
        </div>
      </div>
    </nav>
    {/* Filtros Mejorados */}
    <div className="flex flex-wrap gap-3 w-full md:w-auto" role="search" aria-label="Filtros de búsqueda">
      <div className="relative flex-1 min-w-[200px] md:min-w-[240px]">
        <label htmlFor="search-input" className="sr-only">Buscar por producto o cliente</label>
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary" size={16} aria-hidden="true" />
        <input
          id="search-input"
          type="text"
          placeholder="Buscar producto, cliente..."
          className="form-control pl-9 w-full text-sm py-1.5"
          value={filtros.search}
          onChange={(e) => {
            handleFilterChange('search', e.target.value);
            announceToScreenReader(`Filtro de búsqueda actualizado: ${e.target.value || 'sin filtro'}`);
          }}
          aria-describedby="search-help"
        />
        <div id="search-help" className="sr-only">
          Busca por código de producto, nombre del producto o nombre del cliente
        </div>
      </div>

      <label htmlFor="estado-filter" className="sr-only">Filtrar por estado</label>
      <select
        id="estado-filter"
        className="form-control w-auto text-sm py-1.5 min-w-[140px]"
        value={filtros.estado}
        onChange={(e) => {
          handleFilterChange('estado', e.target.value);
          announceToScreenReader(`Filtro de estado: ${e.target.value || 'todos los estados'}`);
        }}
        aria-describedby="estado-help"
      >
        <option value="">Todos los estados</option>
        <option value="planificado">Planificado</option>
        <option value="requiere_produccion">Requiere Producción</option>
        <option value="stock_suficiente">Stock Suficiente</option>
      </select>
      <div id="estado-help" className="sr-only">
        Filtra los pedidos por su estado actual en el plan de producción
      </div>

      <label htmlFor="generacion-filter" className="sr-only">Filtrar por generación</label>
      <select
        id="generacion-filter"
        className="form-control w-auto text-sm py-1.5 min-w-[140px]"
        value={filtros.generacion}
        onChange={(e) => {
          handleFilterChange('generacion', e.target.value);
          announceToScreenReader(`Filtro de generación: ${e.target.value || 'todas las generaciones'}`);
        }}
        aria-describedby="generacion-help"
      >
        <option value="">Todas las generaciones</option>
        <option value="G1">G1 (AL)</option>
        <option value="G2">G2 (AC)</option>
      </select>
      <div id="generacion-help" className="sr-only">
        Filtra por generación de producto: G1 para productos que empiezan con AL, G2 para productos que empiezan con AC
      </div>

      <label htmlFor="maquina-filter" className="sr-only">Filtrar por máquina</label>
      <select
        id="maquina-filter"
        className="form-control w-auto text-sm py-1.5 min-w-[120px]"
        value={filtros.maquina}
        onChange={(e) => {
          handleFilterChange('maquina', e.target.value);
          announceToScreenReader(`Filtro de máquina: ${e.target.value || 'todas las máquinas'}`);
        }}
        aria-describedby="maquina-help"
      >
        <option value="">Todas las máquinas</option>
        <option value="M1">M1</option>
        <option value="M2">M2</option>
        <option value="M3">M3</option>
        <option value="M4">M4</option>
      </select>
      <div id="maquina-help" className="sr-only">
        Filtra los pedidos por la máquina asignada para su producción
      </div>

      <button
        className="btn btn-secondary btn-sm flex items-center gap-1 px-3 py-1.5"
        onClick={() => {
          setFiltros({ estado: '', generacion: '', maquina: '', prioridad: '', search: '' });
          announceToScreenReader('Todos los filtros han sido limpiados');
        }}
        aria-label="Limpiar todos los filtros de búsqueda"
        title="Remover todos los filtros aplicados"
      >
        <FilterX size={14} aria-hidden="true" />
        Limpiar
      </button>
    </div>

        {/* Vista de Planificación */ }
{
  activeTab === 'planificacion' && (
    <section
      id="planificacion-panel"
      role="tabpanel"
      aria-labelledby="tab-planificacion"
      className="overflow-x-auto -mx-4 px-4"
    >
      <div className="min-w-[1400px]">
        <table
          className="w-full text-sm"
          role="table"
          aria-label="Tabla de planificación de producción inteligente"
          aria-describedby="table-description"
        >
          <caption id="table-description" className="sr-only">
            Tabla que muestra los pedidos de producción con información de stock, planificación y asignación de máquinas.
            Las columnas incluyen producto, cliente, generación, cantidades, fechas, máquina asignada y acciones.
          </caption>
          <thead>
            <tr className="bg-bg-secondary/50">
              <th
                className="py-3 px-3 text-left font-medium text-secondary cursor-pointer whitespace-nowrap"
                onClick={() => {
                  handleSort('no_sales_line');
                  announceToScreenReader(`Ordenado por producto: ${orden.direccion === 'asc' ? 'ascendente' : 'descendente'}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('no_sales_line');
                    announceToScreenReader(`Ordenado por producto: ${orden.direccion === 'asc' ? 'ascendente' : 'descendente'}`);
                  }
                }}
                tabIndex={0}
                role="columnheader"
                aria-sort={orden.campo === 'no_sales_line' ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none'}
                aria-label="Código del producto ALUPAK - Click para ordenar"
              >
                Producto {orden.campo === 'no_sales_line' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" aria-hidden="true" /> : <SortDesc size={12} className="inline ml-1" aria-hidden="true" />)}
              </th>
              <th
                className="py-3 px-3 text-left font-medium text-secondary cursor-pointer whitespace-nowrap hidden md:table-cell"
                onClick={() => {
                  handleSort('customer_name');
                  announceToScreenReader(`Ordenado por cliente: ${orden.direccion === 'asc' ? 'ascendente' : 'descendente'}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('customer_name');
                    announceToScreenReader(`Ordenado por cliente: ${orden.direccion === 'asc' ? 'ascendente' : 'descendente'}`);
                  }
                }}
                tabIndex={0}
                role="columnheader"
                aria-sort={orden.campo === 'customer_name' ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none'}
                aria-label="Nombre del cliente - Click para ordenar"
              >
                Cliente {orden.campo === 'customer_name' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" aria-hidden="true" /> : <SortDesc size={12} className="inline ml-1" aria-hidden="true" />)}
              </th>
              <th
                className="py-3 px-3 text-left font-medium text-secondary cursor-pointer whitespace-nowrap"
                onClick={() => {
                  handleSort('generacion');
                  announceToScreenReader(`Ordenado por generación: ${orden.direccion === 'asc' ? 'ascendente' : 'descendente'}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('generacion');
                    announceToScreenReader(`Ordenado por generación: ${orden.direccion === 'asc' ? 'ascendente' : 'descendente'}`);
                  }
                }}
                tabIndex={0}
                role="columnheader"
                aria-sort={orden.campo === 'generacion' ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none'}
                aria-label="Generación del producto - Click para ordenar"
              >
                Generación {orden.campo === 'generacion' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" aria-hidden="true" /> : <SortDesc size={12} className="inline ml-1" aria-hidden="true" />)}
              </th>
              <th className="py-3 px-3 text-right font-medium text-secondary cursor-pointer whitespace-nowrap" onClick={() => handleSort('cantidad_pendiente')} title="Cantidad total pedida por el cliente">
                Cantidad Pedida {orden.campo === 'cantidad_pendiente' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />)}
              </th>
              <th className="py-3 px-3 text-right font-medium text-secondary cursor-pointer whitespace-nowrap hidden sm:table-cell" onClick={() => handleSort('stock_disponible_ajustado')} title="Stock disponible después de asignar a otros pedidos">
                Stock Disponible {orden.campo === 'stock_disponible_ajustado' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />)}
              </th>
              <th className="py-3 px-3 text-right font-medium text-secondary cursor-pointer whitespace-nowrap" onClick={() => handleSort('cantidad_a_producir')} title="Cantidad que necesita ser producida">
                A Producir {orden.campo === 'cantidad_a_producir' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />)}
              </th>
              <th className="py-3 px-3 text-right font-medium text-secondary cursor-pointer whitespace-nowrap" onClick={() => handleSort('cantidad_planificada')} title="Cantidad planificada para producción">
                Planificada {orden.campo === 'cantidad_planificada' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />)}
              </th>
              <th className="py-3 px-3 text-left font-medium text-secondary cursor-pointer whitespace-nowrap" onClick={() => handleSort('fecha_inicio')} title="Fecha de inicio de producción">
                Inicio {orden.campo === 'fecha_inicio' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />)}
              </th>
              <th className="py-3 px-3 text-left font-medium text-secondary cursor-pointer whitespace-nowrap" onClick={() => handleSort('fecha_fin')} title="Fecha estimada de finalización">
                Fin Estimado {orden.campo === 'fecha_fin' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />)}
              </th>
              <th className="py-3 px-3 text-left font-medium text-secondary cursor-pointer whitespace-nowrap" onClick={() => handleSort('maquina_asignada')} title="Máquina asignada para producción">
                Máquina {orden.campo === 'maquina_asignada' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />)}
              </th>
              <th className="py-3 px-3 text-right font-medium text-secondary cursor-pointer whitespace-nowrap" onClick={() => handleSort('tiempo_estimado_min')} title="Tiempo estimado de producción en minutos">
                Tiempo (min) {orden.campo === 'tiempo_estimado_min' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />)}
              </th>
              <th className="py-3 px-3 text-left font-medium text-secondary whitespace-nowrap hidden lg:table-cell" onClick={() => handleSort('prioridad')} title="Prioridad de producción">
                Prioridad {orden.campo === 'prioridad' && (orden.direccion === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />)}
              </th>
              <th className="py-3 px-3 text-left font-medium text-secondary whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {datosFiltradosYOrdenados.length === 0 ? (
              <tr>
                <td colSpan="14" className="text-center py-12 text-secondary">
                  <Factory size={48} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-lg font-medium mb-2">No hay órdenes de producción planificadas</p>
                  <p className="max-w-md mx-auto mb-4">
                    {pedidos.length === 0
                      ? "Importa pedidos desde ALUPAK para generar el plan de producción."
                      : stockData.length === 0
                        ? "Importa datos de inventario para calcular las cantidades a producir."
                        : "Todos los pedidos tienen stock suficiente disponible."
                    }
                  </p>
                  <div className="flex gap-3 justify-center">
                    {pedidos.length === 0 && (
                      <a href="/importar-alupak" className="btn btn-primary">
                        <Package size={18} className="mr-2" />
                        Importar ALUPAK
                      </a>
                    )}
                    {pedidos.length > 0 && stockData.length === 0 && (
                      <a href="/importar-inventario" className="btn btn-primary">
                        <FileText size={18} className="mr-2" />
                        Importar Inventario
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              datosFiltradosYOrdenados.map((orden) => {
                const cajasPendientes = orden.unidades_por_caja > 0
                  ? Math.ceil(orden.cantidad_pendiente / orden.unidades_por_caja)
                  : 0;
                const cajasAProducir = orden.unidades_por_caja > 0
                  ? Math.ceil(orden.cantidad_a_producir / orden.unidades_por_caja)
                  : 0;
                const cajasStockDisponible = orden.unidades_por_caja > 0
                  ? Math.ceil(orden.stock_disponible_ajustado / orden.unidades_por_caja)
                  : 0;

                return (
                  <tr
                    key={orden.id}
                    className={`${orden.estado === 'requiere_produccion' ? 'bg-yellow-900/10' : orden.estado === 'stock_suficiente' ? 'bg-green-900/5' : ''} hover:bg-bg-secondary/50 transition-colors`}
                  >
                    <td className="font-mono font-bold">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-purple-400 flex-shrink-0" />
                        <span className="truncate max-w-[140px] md:max-w-none">{orden.no_sales_line}</span>
                      </div>
                      <div className="text-xs text-secondary mt-0.5 hidden md:block">{orden.producto_nombre}</div>
                    </td>
                    <td className="font-medium hidden md:table-cell max-w-[180px] truncate">{orden.customer_name}</td>
                    <td>{getGeneracionBadge(orden.generacion)}</td>
                    <td className="text-right font-bold">
                      {orden.cantidad_pendiente.toLocaleString()}
                      <div className="text-xs text-secondary mt-0.5 hidden sm:block">
                        ({cajasPendientes} caja{cajasPendientes !== 1 ? 's' : ''})
                      </div>
                    </td>
                    <td className={`text-right font-bold hidden sm:table-cell ${orden.stock_disponible_ajustado < orden.cantidad_pendiente ? 'text-accent-red' : 'text-accent-green'}`}>
                      {orden.stock_disponible_ajustado.toLocaleString()}
                      <div className="text-xs text-secondary mt-0.5">
                        ({cajasStockDisponible} caja{cajasStockDisponible !== 1 ? 's' : ''})
                      </div>
                    </td>
                    <td className="text-right">
                      <span className={`font-bold ${orden.cantidad_a_producir > 0 ? 'text-accent-yellow' : 'text-secondary'}`}>
                        {orden.cantidad_a_producir.toLocaleString()}
                      </span>
                      {orden.cantidad_a_producir > 0 && (
                        <div className="text-xs text-secondary mt-0.5 hidden sm:block">
                          ({cajasAProducir} caja{cajasAProducir !== 1 ? 's' : ''})
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      {editingRow === orden.id ? (
                        <input
                          type="number"
                          value={formData.cantidad_planificada}
                          onChange={(e) => setFormData(prev => ({ ...prev, cantidad_planificada: e.target.value }))}
                          className="form-control w-20 text-right text-sm py-1 px-2"
                          min="0"
                        />
                      ) : (
                        <span className="font-bold">{orden.cantidad_planificada.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {editingRow === orden.id ? (
                        <input
                          type="date"
                          value={formData.fecha_inicio}
                          onChange={(e) => setFormData(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                          className="form-control w-32 text-sm py-1 px-2"
                        />
                      ) : (
                        orden.fecha_inicio ? new Date(orden.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '-'
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {editingRow === orden.id ? (
                        <div className="flex gap-1">
                          <input
                            type="date"
                            value={formData.fecha_fin}
                            onChange={(e) => setFormData(prev => ({ ...prev, fecha_fin: e.target.value }))}
                            className="form-control w-32 text-sm py-1 px-2"
                          />
                          <button
                            onClick={() => {
                              if (formData.fecha_inicio && formData.cantidad_planificada && formData.maquina_asignada) {
                                const oeeMaquina = oeeMaquinas[formData.maquina_asignada] || 0.85;
                                const { fechaFinCalculada } = calcularTiempoProduccion(
                                  parseInt(formData.cantidad_planificada),
                                  orden.generacion,
                                  formData.maquina_asignada,
                                  oeeMaquina,
                                  formData.fecha_inicio
                                );
                                setFormData(prev => ({ ...prev, fecha_fin: fechaFinCalculada }));
                              }
                            }}
                            className="btn btn-secondary btn-xs p-1"
                            title="Recalcular con OEE y horario 24/7"
                            disabled={calculando || !formData.fecha_inicio || !formData.cantidad_planificada}
                          >
                            <Calculator size={14} />
                          </button>
                        </div>
                      ) : (
                        orden.fecha_fin ? new Date(orden.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '-'
                      )}
                    </td>
                    <td className="min-w-[100px]">
                      {editingRow === orden.id ? (
                        <select
                          value={formData.maquina_asignada}
                          onChange={(e) => setFormData(prev => ({ ...prev, maquina_asignada: e.target.value }))}
                          className="form-control w-24 text-sm py-1 px-2"
                        >
                          <option value="">-- Seleccionar --</option>
                          {orden.generacion === 'G1' ? (
                            <>
                              <option value="M1">M1 (12p)</option>
                              <option value="M2">M2 (12p)</option>
                              <option value="M3">M3 (12p)</option>
                              <option value="M4">M4 (6p)</option>
                            </>
                          ) : (
                            <>
                              <option value="M1">M1 (12p)</option>
                              <option value="M2">M2 (12p)</option>
                              <option value="M3">M3 (12p)</option>
                            </>
                          )}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1">
                          {getMaquinaBadge(orden.maquina_asignada, true)}
                        </div>
                      )}
                    </td>
                    <td className="text-right text-sm min-w-[80px]">
                      {orden.tiempo_estimado_min > 0 ? (
                        <>
                          <div className="font-medium">{Math.floor(orden.tiempo_estimado_min / 60)}h</div>
                          <div className="text-xs text-secondary">{orden.tiempo_estimado_min % 60}m</div>
                        </>
                      ) : (
                        <span className="text-secondary">-</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell">
                      {editingRow === orden.id ? (
                        <select
                          value={formData.prioridad}
                          onChange={(e) => setFormData(prev => ({ ...prev, prioridad: e.target.value }))}
                          className="form-control w-20 text-sm py-1 px-2"
                        >
                          <option value="1">Alta</option>
                          <option value="2">Media</option>
                          <option value="3">Baja</option>
                        </select>
                      ) : (
                        getPrioridadBadge(orden.prioridad)
                      )}
                    </td>
                    <td>{getEstadoBadge(orden.estado)}</td>
                    <td className="min-w-[110px]">
                      {editingRow === orden.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSave(orden.id)}
                            className="btn btn-success btn-xs p-1"
                            title="Guardar"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => { setEditingRow(null); setFormData({}); }}
                            className="btn btn-secondary btn-xs p-1"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(orden)}
                            className="btn btn-secondary btn-xs px-2 py-1"
                            title="Editar orden"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Resumen de resultados filtrados */}
      <div className="mt-4 py-3 border-t border-border-color text-sm text-secondary flex flex-wrap justify-between items-center">
        <div>
          Mostrando <span className="font-bold">{datosFiltradosYOrdenados.length}</span> de <span className="font-bold">{planManual.length}</span> órdenes
          {Object.values(filtros).some(f => f) && (
            <span className="ml-2 text-accent-blue">({Object.entries(filtros).filter(([k, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')})</span>
          )}
        </div>
        <div className="mt-2 md:mt-0 flex gap-2">
          <button
            onClick={() => window.print()}
            className="btn btn-secondary btn-xs"
          >
            <Download size={14} className="mr-1" />
            Exportar
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="btn btn-secondary btn-xs bg-blue-900/20 hover:bg-blue-900/30"
          >
            <History size={14} className="mr-1" />
            Ver Historial
          </button>
        </div>
      </div>
    </section>
  )
}

{/* Vista de Historial de Cambios */ }
{
  activeTab === 'historial' && (
    <div className="space-y-6">
      <div className="bg-bg-secondary rounded-lg p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <History size={24} className="text-blue-400" />
              Historial de Cambios del Plan de Producción
            </h3>
            <p className="text-sm text-secondary mt-1">
              Todos los cambios realizados por los usuarios con capacidad de deshacer/rehacer en cualquier momento
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={deshacer}
              disabled={indiceHistorial <= 0}
              className={`btn flex items-center gap-2 ${indiceHistorial <= 0 ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'
                }`}
            >
              <Undo size={18} />
              Deshacer ({indiceHistorial})
            </button>
            <button
              onClick={rehacer}
              disabled={indiceHistorial >= historialCambios.length - 1}
              className={`btn flex items-center gap-2 ${indiceHistorial >= historialCambios.length - 1 ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'
                }`}
            >
              <Redo size={18} />
              Rehacer ({historialCambios.length - indiceHistorial - 1})
            </button>
            <button
              onClick={() => {
                if (window.confirm('¿Estás seguro de querer limpiar TODO el historial? Esta acción no se puede deshacer y perderás la capacidad de volver a estados anteriores.')) {
                  setHistorialCambios([{
                    plan: planManual,
                    timestamp: new Date().toISOString(),
                    accion: 'historial_limpiado',
                    usuario: 'system',
                    detalles: { mensaje: 'Historial limpiado manualmente' }
                  }]);
                  setIndiceHistorial(0);
                  alert('✅ Historial limpiado exitosamente. Se ha guardado el estado actual como punto de partida.');
                }
              }}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Trash2 size={18} />
              Limpiar Historial
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-secondary/50">
                <th className="py-3 px-4 text-left font-medium text-secondary">Fecha/Hora</th>
                <th className="py-3 px-4 text-left font-medium text-secondary">Acción</th>
                <th className="py-3 px-4 text-left font-medium text-secondary">Usuario</th>
                <th className="py-3 px-4 text-left font-medium text-secondary">Detalles</th>
                <th className="py-3 px-4 text-center font-medium text-secondary">Estado</th>
                <th className="py-3 px-4 text-center font-medium text-secondary">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {historialCambios.slice().reverse().map((cambio, index) => {
                const isActive = index === indiceHistorial;
                const isPast = index < indiceHistorial;
                const isFuture = index > indiceHistorial;

                // ✅ PROTECCIÓN: Asegurar que cambio.accion exista antes de usar replace()
                const accionSegura = cambio.accion || 'carga_inicial';
                const accionFormateada = accionSegura.replace(/_/g, ' ');

                return (
                  <tr
                    key={index}
                    className={`${isActive ? 'bg-blue-900/20' : 'hover:bg-bg-secondary/50'} transition-colors`}
                  >
                    <td className="py-3 px-4 font-mono text-xs">
                      {new Date(cambio.timestamp).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${cambio.accion === 'cambio_maquina' ? 'bg-purple-900/30 text-purple-300' :
                        cambio.accion === 'edicion_manual' ? 'bg-blue-900/30 text-blue-300' :
                          cambio.accion === 'nueva_orden' ? 'bg-green-900/30 text-green-300' :
                            cambio.accion === 'recarga_datos' ? 'bg-gray-800 text-gray-300' :
                              'bg-gray-800 text-gray-300'
                        }`}>
                        {accionFormateada}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{cambio.usuario || 'system'}</td>
                    <td className="py-3 px-4">
                      <div className="text-sm">
                        {cambio.detalles?.pedido && (
                          <div className="font-medium">{cambio.detalles.pedido}</div>
                        )}
                        {cambio.detalles?.maquina_original && (
                          <div className="text-xs text-secondary">
                            {cambio.detalles.maquina_original} → {cambio.detalles.maquina_nueva}
                          </div>
                        )}
                        {cambio.detalles?.cambios && Array.isArray(cambio.detalles.cambios) && (
                          <div className="text-xs text-secondary">
                            Cambios: {cambio.detalles.cambios.join(', ')}
                          </div>
                        )}
                        {cambio.detalles?.mensaje && (
                          <div className="italic text-xs text-secondary">
                            {cambio.detalles.mensaje}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isActive ? (
                        <span className="badge badge-completado flex items-center justify-center gap-1">
                          <CheckCircle size={14} />
                          Actual
                        </span>
                      ) : isPast ? (
                        <span className="badge bg-gray-800 text-gray-400">Anterior</span>
                      ) : (
                        <span className="badge bg-blue-900/30 text-blue-400">Posterior</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!isActive && (
                        <button
                          onClick={() => {
                            if (index < indiceHistorial) {
                              // Deshacer hasta este punto
                              let steps = indiceHistorial - index;
                              while (steps > 0) {
                                deshacer();
                                steps--;
                              }
                            } else {
                              // Rehacer hasta este punto
                              let steps = index - indiceHistorial;
                              while (steps > 0) {
                                rehacer();
                                steps--;
                              }
                            }
                          }}
                          className={`btn btn-xs ${index < indiceHistorial ? 'btn-primary' : 'btn-secondary'
                            }`}
                          title={index < indiceHistorial ? 'Volver a este estado' : 'Avanzar a este estado'}
                        >
                          {index < indiceHistorial ? (
                            <>
                              <Undo size={14} className="mr-1" />
                              Volver
                            </>
                          ) : (
                            <>
                              <Redo size={14} className="mr-1" />
                              Avanzar
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-2">💡 Cómo funciona el historial:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><span className="font-medium">Deshacer/Rehacer ilimitado:</span> Navega libremente por todo el historial de cambios</li>
                <li><span className="font-medium">Sincronización en tiempo real:</span> Todos los cambios se reflejan inmediatamente en Dashboard, Configuración y otros módulos</li>
                <li><span className="font-medium">Auditoría completa:</span> Cada cambio incluye fecha/hora exacta, usuario y detalles específicos</li>
                <li><span className="font-medium">Seguridad:</span> Los cambios solo se guardan al confirmar (no hay guardado automático no deseado)</li>
                <li><span className="font-medium">Reinicio controlado:</span> El historial se reinicia al recargar datos frescos desde ALUPAK/Inventario (con confirmación explícita)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

{/* Vista de Utilización de Máquinas */ }
{
  activeTab === 'maquinas' && (
    <div className="bg-bg-secondary rounded-lg p-4">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <Cpu size={20} className="text-purple-400" />
        Utilización de Máquinas con OEE Individual (Horario: 24/7)
      </h3>
      <div className="text-center py-8 text-secondary">
        Contenido de utilización de máquinas optimizado para horario laboral real de 24 horas/día (excepto cierre Sáb 14:00 - Dom 20:00)
      </div>
    </div>
  )
}

{/* ✅ MODAL FUNCIONAL PARA NUEVA ORDEN - TOTALMENTE MEJORADO */ }
{
  showModal && (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      ref={modalRef}
    >
      <div className="bg-bg-primary rounded-lg p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto relative">
        {/* Header del Modal */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b border-border-color">
          <h3 id="modal-title" className="font-bold text-xl flex items-center gap-3 text-accent-purple">
            <Plus size={24} className="text-blue-400" aria-hidden="true" />
            Nueva Orden de Producción Manual
          </h3>
          <button
            onClick={() => setShowModal(false)}
            className="text-secondary hover:text-text-primary p-2 hover:bg-bg-secondary rounded-full transition"
            aria-label="Cerrar modal de nueva orden"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowModal(false);
              }
            }}
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <div id="modal-description" className="sr-only">
          Formulario para crear una nueva orden de producción manual. Complete todos los campos requeridos marcados con asterisco.
        </div>

        <div className="space-y-6">
          {/* Paso 1: Selección de Pedido */}
          <div className="space-y-2">
            <label className="form-label flex items-center gap-2">
              <Package size={18} className="text-purple-400" />
              Pedido ALUPAK <span className="text-red-400">*</span>
            </label>

            {pedidosSinPlan.length === 0 ? (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 text-center">
                <AlertTriangle size={24} className="mx-auto text-yellow-400 mb-2" />
                <p className="font-medium text-yellow-300">No hay pedidos pendientes sin planificar</p>
                <p className="text-sm mt-1">
                  Todos los pedidos ya tienen una orden de producción asignada.
                  Puedes editar las órdenes existentes o importar nuevos datos de ALUPAK.
                </p>
              </div>
            ) : (
              <div className="relative">
                <select
                  className="form-control pr-10"
                  value={nuevoPlan.alupak_pedido_id}
                  onChange={(e) => {
                    const pedidoId = e.target.value;
                    if (!pedidoId) {
                      // Resetear formulario si se selecciona "Seleccionar pedido"
                      setNuevoPlan({
                        alupak_pedido_id: '',
                        cantidad_planificada: '',
                        fecha_inicio: new Date().toISOString().split('T')[0],
                        fecha_fin: '',
                        linea_asignada: '',
                        prioridad: '3',
                        observaciones: '',
                        maquina_asignada: '',
                        generacion: ''
                      });
                      return;
                    }

                    const pedido = pedidos.find(p => p.id === parseInt(pedidoId));
                    if (pedido) {
                      // Determinar generación automáticamente
                      const esG1 = pedido.no_sales_line.startsWith('AL');
                      const esG2 = pedido.no_sales_line.startsWith('AC');
                      const generacion = esG1 ? 'G1' : (esG2 ? 'G2' : 'G1');

                      // Seleccionar primera máquina disponible para la generación
                      const maquinasDisponibles = CONFIG_MAQUINAS[generacion].maquinas;
                      const maquinaDefault = maquinasDisponibles[0];

                      // Calcular fecha de fin inicial
                      const fechaInicio = nuevoPlan.fecha_inicio || new Date().toISOString().split('T')[0];
                      const oeeMaquina = oeeMaquinas[maquinaDefault] || 0.85;
                      const { fechaFinCalculada } = calcularTiempoProduccion(
                        parseInt(pedido.qty_pending) || 0,
                        generacion,
                        maquinaDefault,
                        oeeMaquina,
                        fechaInicio
                      );

                      setNuevoPlan(prev => ({
                        ...prev,
                        alupak_pedido_id: pedidoId,
                        cantidad_planificada: pedido.qty_pending.toString(),
                        maquina_asignada: maquinaDefault,
                        generacion: generacion,
                        fecha_fin: fechaFinCalculada
                      }));
                    }
                  }}
                  required
                >
                  <option value="">-- Seleccionar pedido pendiente --</option>
                  {pedidosSinPlan.map(pedido => {
                    // Determinar generación para mostrar en el dropdown
                    const esG1 = pedido.no_sales_line.startsWith('AL');
                    const esG2 = pedido.no_sales_line.startsWith('AC');
                    const generacion = esG1 ? 'G1 (AL)' : (esG2 ? 'G2 (AC)' : 'Desconocida');

                    return (
                      <option
                        key={pedido.id}
                        value={pedido.id}
                        className="bg-bg-secondary hover:bg-bg-surface"
                      >
                        {pedido.customer_name} - {pedido.no_sales_line}
                        {pedido.producto_nombre && `(${pedido.producto_nombre})`}
                        • {pedido.qty_pending.toLocaleString()} u • {generacion}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary">
                  <ChevronDown size={18} />
                </div>
              </div>
            )}

            {nuevoPlan.alupak_pedido_id && (
              <div className="mt-2 p-3 bg-bg-secondary rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Cliente:</span>
                  <span className="font-medium">{pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id))?.customer_name}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-secondary">Producto:</span>
                  <span className="font-medium flex items-center gap-2">
                    <Package size={14} className="text-purple-400" />
                    {pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id))?.no_sales_line}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-secondary">Stock disponible:</span>
                  <span className={`font-medium ${(pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id))?.stock_disponible || 0) <
                    (pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id))?.qty_pending || 0)
                    ? 'text-accent-red'
                    : 'text-accent-green'
                    }`}>
                    {(pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id))?.stock_disponible || 0).toLocaleString()} u
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Paso 2: Parámetros de Producción */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-border-color">
            {/* Columna Izquierda */}
            <div className="space-y-4">
              <div>
                <label className="form-label flex items-center gap-2">
                  <HardHat size={18} className="text-yellow-400" />
                  Cantidad a Producir <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="form-control pl-10"
                    value={nuevoPlan.cantidad_planificada}
                    onChange={(e) => {
                      const valor = e.target.value;
                      setNuevoPlan(prev => ({ ...prev, cantidad_planificada: valor }));

                      // Recalcular fecha fin si tenemos otros datos necesarios
                      if (valor && nuevoPlan.fecha_inicio && nuevoPlan.maquina_asignada && nuevoPlan.alupak_pedido_id) {
                        const pedido = pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id));
                        if (pedido) {
                          const esG1 = pedido.no_sales_line.startsWith('AL');
                          const esG2 = pedido.no_sales_line.startsWith('AC');
                          const generacion = esG1 ? 'G1' : (esG2 ? 'G2' : 'G1');

                          const { fechaFinCalculada } = calcularTiempoProduccion(
                            parseInt(valor),
                            generacion,
                            nuevoPlan.maquina_asignada,
                            oeeMaquinas[nuevoPlan.maquina_asignada] || 0.85,
                            nuevoPlan.fecha_inicio
                          );
                          setNuevoPlan(prev => ({ ...prev, fecha_fin: fechaFinCalculada }));
                        }
                      }
                    }}
                    min="1"
                    placeholder="Ej: 50000"
                    required
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-yellow-400">
                    <Scale size={18} />
                  </div>
                </div>
                {nuevoPlan.alupak_pedido_id && (
                  <p className="text-xs text-secondary mt-1">
                    Pedido original: {(pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id))?.qty_pending || 0).toLocaleString()} u
                    {nuevoPlan.cantidad_planificada && parseInt(nuevoPlan.cantidad_planificada) !== (pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id))?.qty_pending || 0) && (
                      <span className="ml-2 text-accent-yellow">
                        (cantidad modificada)
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label flex items-center gap-2">
                  <Cpu size={18} className="text-blue-400" />
                  Máquina Asignada <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    className="form-control pr-10"
                    value={nuevoPlan.maquina_asignada}
                    onChange={(e) => {
                      const maquina = e.target.value;
                      setNuevoPlan(prev => ({ ...prev, maquina_asignada: maquina }));

                      // Recalcular fecha fin si tenemos otros datos necesarios
                      if (maquina && prev.cantidad_planificada && prev.fecha_inicio && prev.alupak_pedido_id) {
                        const pedido = pedidos.find(p => p.id === parseInt(prev.alupak_pedido_id));
                        if (pedido) {
                          const esG1 = pedido.no_sales_line.startsWith('AL');
                          const esG2 = pedido.no_sales_line.startsWith('AC');
                          const generacion = esG1 ? 'G1' : (esG2 ? 'G2' : 'G1');

                          const { fechaFinCalculada } = calcularTiempoProduccion(
                            parseInt(prev.cantidad_planificada),
                            generacion,
                            prev.maquina_asignada,
                            oeeMaquinas[prev.maquina_asignada] || 0.85,
                            prev.fecha_inicio
                          );
                          setNuevoPlan(prevState => ({ ...prevState, fecha_fin: fechaFinCalculada }));
                        }
                      }
                    }}
                    required
                    disabled={!nuevoPlan.alupak_pedido_id}
                  >
                    <option value="">-- Seleccionar máquina --</option>
                    {nuevoPlan.alupak_pedido_id && (() => {
                      const pedido = pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id));
                      if (!pedido) return null;

                      const esG1 = pedido.no_sales_line.startsWith('AL');
                      const esG2 = pedido.no_sales_line.startsWith('AC');
                      const generacion = esG1 ? 'G1' : (esG2 ? 'G2' : 'G1');
                      const maquinasDisponibles = CONFIG_MAQUINAS[generacion].maquinas;

                      return maquinasDisponibles.map(maquina => {
                        const oee = (oeeMaquinas[maquina] || 0.85) * 100;
                        const pistas = maquina === 'M4' ? 6 : 12;

                        return (
                          <option key={maquina} value={maquina} className="bg-bg-secondary">
                            {maquina} • {pistas} pistas • OEE: {oee.toFixed(0)}% • Cap: {Math.round(CONFIG_MAQUINAS[generacion].getCapacidad(maquina, oeeMaquinas[maquina] || 0.85))} u/min
                          </option>
                        );
                      });
                    })()}
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary">
                    <ChevronDown size={18} />
                  </div>
                </div>

                {nuevoPlan.alupak_pedido_id && (
                  <div className="mt-2 p-3 bg-blue-900/20 rounded-lg text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Cpu size={14} className="text-blue-400" />
                      <span className="font-medium">
                        {nuevoPlan.alupak_pedido_id && pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id))?.no_sales_line.startsWith('AL')
                          ? 'Generación 1 (G1 - Productos AL)'
                          : 'Generación 2 (G2 - Productos AC)'}
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-secondary">
                      <li>M1, M2, M3: 12 pistas × 55 ciclos/min</li>
                      <li>{nuevoPlan.alupak_pedido_id && pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id))?.no_sales_line.startsWith('AL')
                        ? 'M4: 6 pistas × 55 ciclos/min (solo G1)'
                        : 'M4: No disponible para G2'}</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha */}
            <div className="space-y-4">
              <div>
                <label className="form-label flex items-center gap-2">
                  <Calendar size={18} className="text-green-400" />
                  Fecha de Inicio <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className="form-control"
                    value={nuevoPlan.fecha_inicio}
                    onChange={(e) => {
                      const fecha = e.target.value;
                      setNuevoPlan(prev => ({ ...prev, fecha_inicio: fecha }));

                      // Recalcular fecha fin si tenemos otros datos necesarios
                      if (fecha && prev.cantidad_planificada && prev.maquina_asignada && prev.alupak_pedido_id) {
                        const pedido = pedidos.find(p => p.id === parseInt(prev.alupak_pedido_id));
                        if (pedido) {
                          const esG1 = pedido.no_sales_line.startsWith('AL');
                          const esG2 = pedido.no_sales_line.startsWith('AC');
                          const generacion = esG1 ? 'G1' : (esG2 ? 'G2' : 'G1');

                          const { fechaFinCalculada } = calcularTiempoProduccion(
                            parseInt(prev.cantidad_planificada),
                            generacion,
                            prev.maquina_asignada,
                            oeeMaquinas[prev.maquina_asignada] || 0.85,
                            fecha
                          );
                          setNuevoPlan(prevState => ({ ...prevState, fecha_fin: fechaFinCalculada }));
                        }
                      }
                    }}
                    required
                  />
                </div>
                <p className="text-xs text-secondary mt-1">
                  Horario operativo: 24/7 (excepto cierre Sáb 14:00 - Dom 20:00)
                </p>
              </div>

              <div>
                <label className="form-label flex items-center gap-2">
                  <Clock size={18} className="text-purple-400" />
                  Fecha de Fin Estimada
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="form-control flex-1"
                    value={nuevoPlan.fecha_fin}
                    onChange={(e) => setNuevoPlan(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    readOnly
                  />
                  <button
                    onClick={() => {
                      if (nuevoPlan.fecha_inicio && nuevoPlan.cantidad_planificada && nuevoPlan.maquina_asignada && nuevoPlan.alupak_pedido_id) {
                        const pedido = pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id));
                        if (pedido) {
                          const esG1 = pedido.no_sales_line.startsWith('AL');
                          const esG2 = pedido.no_sales_line.startsWith('AC');
                          const generacion = esG1 ? 'G1' : (esG2 ? 'G2' : 'G1');

                          const { fechaFinCalculada } = calcularTiempoProduccion(
                            parseInt(nuevoPlan.cantidad_planificada),
                            generacion,
                            nuevoPlan.maquina_asignada,
                            oeeMaquinas[nuevoPlan.maquina_asignada] || 0.85,
                            nuevoPlan.fecha_inicio
                          );
                          setNuevoPlan(prev => ({ ...prev, fecha_fin: fechaFinCalculada }));

                          // Feedback visual
                          setTimeout(() => {
                            const btn = document.querySelector('button[title="Recalcular con OEE y horario 24/7"]');
                            if (btn && btn.classList) {
                              btn.classList.add('animate-pulse');
                              setTimeout(() => btn.classList.remove('animate-pulse'), 500);
                            } else {
                              console.warn('Button with title "Recalcular con OEE y horario 24/7" not found or not rendered yet.');
                            }
                          }, 0);
                        }
                      } else {
                        alert('⚠️ Completa primero: Pedido, Cantidad, Máquina y Fecha de Inicio');
                      }
                    }}
                    className="btn btn-secondary p-2.5"
                    title="Recalcular con OEE y horario 24/7"
                    type="button"
                  >
                    <Calculator size={18} />
                  </button>
                </div>
                {nuevoPlan.fecha_fin && nuevoPlan.fecha_inicio && (
                  <div className="mt-2 p-2 bg-purple-900/20 rounded text-xs text-center">
                    <div className="font-medium text-purple-300">
                      Tiempo estimado de producción:
                    </div>
                    <div className="mt-1">
                      {(() => {
                        const inicio = new Date(nuevoPlan.fecha_inicio);
                        const fin = new Date(nuevoPlan.fecha_fin);
                        const diffMinutos = Math.floor((fin - inicio) / 60000);
                        return `${Math.floor(diffMinutos / 60)}h ${diffMinutos % 60}m`;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Paso 3: Configuración Adicional */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border-color">
            <div>
              <label className="form-label flex items-center gap-2">
                <Factory size={18} className="text-gray-400" />
                Línea de Producción
              </label>
              <select
                className="form-control"
                value={nuevoPlan.linea_asignada}
                onChange={(e) => setNuevoPlan(prev => ({ ...prev, linea_asignada: e.target.value }))}
              >
                <option value="">-- Asignar después --</option>
                {lineas.map(linea => (
                  <option key={linea.id} value={linea.codigo}>
                    {linea.nombre} ({linea.codigo}) • Cap: {linea.capacidad_hora} u/h
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label flex items-center gap-2">
                <TrendingUp size={18} className="text-yellow-400" />
                Prioridad
              </label>
              <select
                className="form-control"
                value={nuevoPlan.prioridad}
                onChange={(e) => setNuevoPlan(prev => ({ ...prev, prioridad: e.target.value }))}
              >
                <option value="1">Alta - Producción inmediata</option>
                <option value="2">Media - Esta semana</option>
                <option value="3" selected>Baja - Planificación normal</option>
              </select>
            </div>
          </div>

          {/* Paso 4: Observaciones */}
          <div className="pt-4 border-t border-border-color">
            <label className="form-label flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-blue-400" />
              Observaciones
            </label>
            <textarea
              className="form-control min-h-[100px]"
              value={nuevoPlan.observaciones}
              onChange={(e) => setNuevoPlan(prev => ({ ...prev, observaciones: e.target.value }))}
              placeholder="Notas adicionales para esta orden de producción... (ej: lote especial, cliente prioritario, etc.)"
              maxLength="500"
            />
            <div className="text-right text-xs text-secondary mt-1">
              {nuevoPlan.observaciones.length}/500 caracteres
            </div>
          </div>

          {/* Acciones del Formulario */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-border-color">
            <button
              onClick={() => {
                // Confirmar si hay cambios no guardados
                if (nuevoPlan.alupak_pedido_id || nuevoPlan.cantidad_planificada || nuevoPlan.observaciones) {
                  if (window.confirm('¿Descartar cambios no guardados?')) {
                    setShowModal(false);
                    setNuevoPlan({
                      alupak_pedido_id: '',
                      cantidad_planificada: '',
                      fecha_inicio: new Date().toISOString().split('T')[0],
                      fecha_fin: '',
                      linea_asignada: '',
                      prioridad: '3',
                      observaciones: '',
                      maquina_asignada: '',
                      generacion: ''
                    });
                  }
                } else {
                  setShowModal(false);
                }
              }}
              className="btn btn-secondary flex-1 justify-center"
            >
              <X size={18} className="mr-2" />
              Cancelar
            </button>

            <button
              onClick={async () => {
                // Validaciones completas
                if (!nuevoPlan.alupak_pedido_id) {
                  alert('⚠️ Selecciona un pedido ALUPAK');
                  return;
                }

                if (!nuevoPlan.cantidad_planificada || parseInt(nuevoPlan.cantidad_planificada) <= 0) {
                  alert('⚠️ Ingresa una cantidad válida mayor a 0');
                  return;
                }

                if (!nuevoPlan.maquina_asignada) {
                  alert('⚠️ Selecciona una máquina');
                  return;
                }

                if (!nuevoPlan.fecha_inicio) {
                  alert('⚠️ Selecciona una fecha de inicio');
                  return;
                }

                if (!nuevoPlan.fecha_fin) {
                  alert('⚠️ Calcula primero la fecha de fin estimada');
                  return;
                }

                // Obtener datos del pedido
                const pedidoSeleccionado = pedidos.find(p => p.id === parseInt(nuevoPlan.alupak_pedido_id));
                if (!pedidoSeleccionado) {
                  alert('⚠️ Pedido no encontrado');
                  return;
                }

                // Determinar generación
                const esG1 = pedidoSeleccionado.no_sales_line.startsWith('AL');
                const esG2 = pedidoSeleccionado.no_sales_line.startsWith('AC');
                const generacion = esG1 ? 'G1' : (esG2 ? 'G2' : 'G1');

                // Verificar que la máquina sea válida para la generación
                const maquinasValidas = CONFIG_MAQUINAS[generacion].maquinas;
                if (!maquinasValidas.includes(nuevoPlan.maquina_asignada)) {
                  alert(`❌ La máquina ${nuevoPlan.maquina_asignada} no está disponible para productos ${generacion} (${esG1 ? 'AL' : 'AC'})`);
                  return;
                }

                // Obtener OEE de la máquina
                const oeeMaquina = oeeMaquinas[nuevoPlan.maquina_asignada] || 0.85;

                // Calcular tiempo de producción
                const { tiempoMinutos, fechaFinCalculada } = calcularTiempoProduccion(
                  parseInt(nuevoPlan.cantidad_planificada),
                  generacion,
                  nuevoPlan.maquina_asignada,
                  oeeMaquina,
                  nuevoPlan.fecha_inicio
                );

                // Crear nuevo registro
                const nuevoRegistro = {
                  id: `manual-${Date.now()}`,
                  alupak_pedido_id: nuevoPlan.alupak_pedido_id,
                  customer_name: pedidoSeleccionado.customer_name,
                  no_sales_line: pedidoSeleccionado.no_sales_line,
                  producto_nombre: pedidoSeleccionado.producto_nombre || pedidoSeleccionado.no_sales_line,
                  cantidad_pendiente: pedidoSeleccionado.qty_pending,
                  stock_disponible_original: pedidoSeleccionado.stock_disponible || 0,
                  stock_disponible_ajustado: pedidoSeleccionado.stock_disponible || 0,
                  cantidad_a_producir: parseInt(nuevoPlan.cantidad_planificada),
                  cantidad_planificada: parseInt(nuevoPlan.cantidad_planificada),
                  fecha_inicio: nuevoPlan.fecha_inicio,
                  fecha_fin: fechaFinCalculada || nuevoPlan.fecha_fin,
                  linea_asignada: nuevoPlan.linea_asignada,
                  maquina_asignada: nuevoPlan.maquina_asignada,
                  generacion: generacion,
                  estado: 'planificado',
                  prioridad: nuevoPlan.prioridad,
                  observaciones: nuevoPlan.observaciones,
                  tiempo_estimado_min: tiempoMinutos,
                  oee_aplicado: oeeMaquina,
                  creado_en: new Date().toISOString(),
                  es_manual: true,
                  // Datos adicionales para visualización
                  unidades_por_caja: esG1 ? 16380 : (esG2 ? 15600 : 0),
                  cajas_pendientes: Math.ceil(pedidoSeleccionado.qty_pending / (esG1 ? 16380 : (esG2 ? 15600 : 1))),
                  cajas_a_producir: Math.ceil(parseInt(nuevoPlan.cantidad_planificada) / (esG1 ? 16380 : (esG2 ? 15600 : 1)))
                };

                // Actualizar estado local
                const nuevoPlanTotal = [...planManual, nuevoRegistro];
                setPlanManual(nuevoPlanTotal);

                // Guardar en historial
                guardarEnHistorial(nuevoPlanTotal, 'nueva_orden', {
                  pedido: pedidoSeleccionado.no_sales_line,
                  cantidad: nuevoPlan.cantidad_planificada,
                  maquina: nuevoPlan.maquina_asignada,
                  fecha_inicio: nuevoPlan.fecha_inicio
                });

                // Guardar en base de datos
                try {
                  const response = await fetch(`${API}/api/plan/produccion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      version_id: null,
                      pedido_id: pedidoSeleccionado.id,
                      producto_id: null,
                      linea_id: lineas.find(l => l.codigo === nuevoPlan.linea_asignada)?.id || null,
                      cantidad: parseInt(nuevoPlan.cantidad_planificada),
                      fecha_inicio: nuevoPlan.fecha_inicio,
                      fecha_fin: fechaFinCalculada || nuevoPlan.fecha_fin,
                      turno: '24h',
                      estado: 'planificado',
                      oee: oeeMaquina,
                      observaciones: nuevoPlan.observaciones
                    })
                  });

                  if (response.ok) {
                    // Notificar a otros componentes
                    window.dispatchEvent(new Event('planUpdated'));

                    // Resetear formulario y cerrar modal
                    setNuevoPlan({
                      alupak_pedido_id: '',
                      cantidad_planificada: '',
                      fecha_inicio: new Date().toISOString().split('T')[0],
                      fecha_fin: '',
                      linea_asignada: '',
                      prioridad: '3',
                      observaciones: '',
                      maquina_asignada: '',
                      generacion: ''
                    });
                    setShowModal(false);

                    // Feedback de éxito
                    alert('✅ Orden de producción creada exitosamente y guardada en la base de datos');
                  } else {
                    throw new Error('Error al guardar en base de datos');
                  }
                } catch (error) {
                  console.error('Error guardando en base de datos:', error);
                  alert('⚠️ La orden se creó en el planificador pero hubo un error al guardar en la base de datos. Los cambios se mantendrán en esta sesión.');
                }
              }}
              className="btn btn-primary flex-1 justify-center relative"
              disabled={calculando || !nuevoPlan.alupak_pedido_id || !nuevoPlan.cantidad_planificada || !nuevoPlan.maquina_asignada || !nuevoPlan.fecha_inicio}
            >
              {calculando ? (
                <>
                  <div className="loading mr-2" style={{ width: '18px', height: '18px' }}></div>
                  Creando orden...
                </>
              ) : (
                <>
                  <Plus size={18} className="mr-2" />
                  Crear Orden de Producción
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
{/* ✅ MODAL DE HISTORIAL COMPLETO */ }
{
  showHistoryModal && (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      aria-describedby="history-modal-description"
      ref={historyModalRef}
    >
      <div className="bg-bg-primary rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 id="history-modal-title" className="font-bold text-xl flex items-center gap-2">
            <History size={24} className="text-blue-400" aria-hidden="true" />
            Historial Completo de Cambios
          </h3>
          <button
            onClick={() => setShowHistoryModal(false)}
            className="text-secondary hover:text-text-primary"
            aria-label="Cerrar modal del historial"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowHistoryModal(false);
              }
            }}
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <div id="history-modal-description" className="sr-only">
          Modal que muestra el historial completo de cambios en el plan de producción. Incluye controles para deshacer y rehacer cambios.
        </div>

        <div className="space-y-6">
          {/* Controles de navegación */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-bg-secondary rounded-lg">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={deshacer}
                disabled={indiceHistorial <= 0}
                className={`btn flex items-center gap-2 ${indiceHistorial <= 0 ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'
                  }`}
              >
                <Undo size={18} />
                Deshacer ({indiceHistorial})
              </button>
              <button
                onClick={rehacer}
                disabled={indiceHistorial >= historialCambios.length - 1}
                className={`btn flex items-center gap-2 ${indiceHistorial >= historialCambios.length - 1 ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'
                  }`}
              >
                <Redo size={18} />
                Rehacer ({historialCambios.length - indiceHistorial - 1})
              </button>
            </div>
            <div className="text-sm text-secondary">
              <span>Estado actual: </span>
              <span className="font-bold text-blue-400">#{indiceHistorial + 1}</span>
              <span> de </span>
              <span className="font-bold">{historialCambios.length}</span>
              <span> cambios guardados</span>
            </div>
          </div>

          {/* Lista de cambios */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {historialCambios.map((cambio, index) => {
              const isActive = index === indiceHistorial;
              const isPast = index < indiceHistorial;
              const isFuture = index > indiceHistorial;

              // ✅ PROTECCIÓN: Asegurar que cambio.accion exista antes de usar replace()
              const accionSegura = cambio.accion || 'carga_inicial';
              const accionFormateada = accionSegura.replace(/_/g, ' ');

              return (
                <div
                  key={index}
                  className={`border border-border-color rounded-lg p-4 transition-all ${isActive
                    ? 'border-blue-500 bg-blue-900/20 shadow-lg scale-[1.02]'
                    : isPast
                      ? 'border-green-800/50 bg-green-900/10'
                      : isFuture
                        ? 'border-purple-800/50 bg-purple-900/10 opacity-70'
                        : 'border-border-color hover:border-blue-800/50'
                    }`}
                >
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${cambio.accion === 'cambio_maquina' ? 'bg-purple-900/30' :
                          cambio.accion === 'edicion_manual' ? 'bg-blue-900/30' :
                            cambio.accion === 'nueva_orden' ? 'bg-green-900/30' :
                              cambio.accion === 'recarga_datos' ? 'bg-gray-800' :
                                'bg-gray-800'
                          }`}>
                          {cambio.accion === 'cambio_maquina' && <ArrowLeftRight size={20} className="text-purple-400" />}
                          {cambio.accion === 'edicion_manual' && <Edit2 size={20} className="text-blue-400" />}
                          {cambio.accion === 'nueva_orden' && <Plus size={20} className="text-green-400" />}
                          {cambio.accion === 'recarga_datos' && <RefreshCw size={20} className="text-yellow-400" />}
                          {!cambio.accion && <Database size={20} className="text-gray-400" />}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            {/* ✅ USAR VALOR FORMATEADO CON PROTECCIÓN */}
                            {accionFormateada}
                            {isActive && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded flex items-center gap-1">
                                <Lock size={12} />
                                Estado Actual
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-secondary mt-1">
                            {cambio.detalles?.pedido && (
                              <div>{cambio.detalles.pedido}</div>
                            )}
                            {cambio.detalles?.maquina_original && (
                              <div>
                                {cambio.detalles.maquina_original} → {cambio.detalles.maquina_nueva}
                              </div>
                            )}
                            {cambio.detalles?.cambios && Array.isArray(cambio.detalles.cambios) && (
                              <div>
                                {cambio.detalles.cambios.map((c, i) => (
                                  <span key={i} className="inline-block bg-gray-800 px-1.5 py-0.5 rounded text-xs mr-1 mb-1">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                            {cambio.detalles?.mensaje && (
                              <div className="italic text-xs">{cambio.detalles.mensaje}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 min-w-[150px]">
                      <div className="text-xs text-secondary whitespace-nowrap">
                        {new Date(cambio.timestamp).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </div>
                      <div className="flex gap-2">
                        {!isActive && (
                          <button
                            onClick={() => {
                              if (index < indiceHistorial) {
                                // Deshacer hasta este punto
                                let steps = indiceHistorial - index;
                                while (steps > 0) {
                                  deshacer();
                                  steps--;
                                }
                              } else {
                                // Rehacer hasta este punto
                                let steps = index - indiceHistorial;
                                while (steps > 0) {
                                  rehacer();
                                  steps--;
                                }
                              }
                            }}
                            className={`btn btn-xs ${index < indiceHistorial ? 'btn-primary' : 'btn-secondary'
                              }`}
                            title={index < indiceHistorial ? 'Volver a este estado' : 'Avanzar a este estado'}
                          >
                            {index < indiceHistorial ? (
                              <>
                                <Undo size={14} className="mr-1" />
                                Volver
                              </>
                            ) : (
                              <>
                                <Redo size={14} className="mr-1" />
                                Avanzar
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Información adicional */}
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium mb-2">Sistema de Control Total de Cambios</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><span className="font-medium">Deshacer/Rehacer ilimitado:</span> Navega libremente por todo el historial de cambios</li>
                  <li><span className="font-medium">Sincronización en tiempo real:</span> Todos los cambios se reflejan inmediatamente en Dashboard, Configuración y otros módulos</li>
                  <li><span className="font-medium">Auditoría completa:</span> Cada cambio incluye fecha/hora exacta, usuario y detalles específicos</li>
                  <li><span className="font-medium">Seguridad:</span> Los cambios solo se guardan al confirmar (no hay guardado automático no deseado)</li>
                  <li><span className="font-medium">Reinicio controlado:</span> El historial se reinicia al recargar datos frescos desde ALUPAK/Inventario (con confirmación explícita)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-color">
          <button
            onClick={() => {
              if (window.confirm('¿Estás seguro de querer limpiar TODO el historial? Esta acción no se puede deshacer y perderás la capacidad de volver a estados anteriores.')) {
                setHistorialCambios([{
                  plan: planManual,
                  timestamp: new Date().toISOString(),
                  accion: 'historial_limpiado',
                  usuario: 'system',
                  detalles: { mensaje: 'Historial limpiado manualmente' }
                }]);
                setIndiceHistorial(0);
                setShowHistoryModal(false);
                alert('✅ Historial limpiado exitosamente. Se ha guardado el estado actual como punto de partida.');
              }
            }}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Trash2 size={18} />
            Limpiar Historial
          </button>
          <button
            onClick={() => setShowHistoryModal(false)}
            className="btn btn-primary"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

{/* Información para Planning - Actualizada con Horario 24/7 */ }
<div className="card bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-800/50 mt-6">
  <div className="flex items-start gap-4 p-4">
    <div className="bg-purple-500/20 p-3 rounded-lg">
      <Factory size={28} className="text-purple-400" />
    </div>
    <div className="flex-1">
      <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
        <Factory size={20} />
        Sistema de Planificación Inteligente - Horario 24/7
      </h3>
      <ul className="space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Horario laboral real:</strong> Operación 24 horas los 7 días de la semana, excepto cierre desde sábado 14:00 hasta domingo 20:00 (30 horas de cierre semanal).
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Zap size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Cálculos precisos:</strong> Los tiempos de producción se calculan automáticamente considerando el OEE específico de cada máquina, el rendimiento por producto y el horario 24/7 con saltos automáticos durante el cierre de fin de semana.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <History size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Historial completo con undo/redo:</strong> Todos los cambios se guardan automáticamente con capacidad de deshacer/rehacer en cualquier momento. Navega libremente por todo el historial de modificaciones.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Database size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Sincronización en tiempo real:</strong> Los cambios se guardan inmediatamente en la base de datos y se notifican a todos los componentes del sistema (Dashboard, Configuración, etc.) sin necesidad de recargar.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Settings size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong>OEE editable por máquina:</strong> Configuración de OEE por máquina directamente en esta pantalla con inputs numéricos precisos. Los cambios se guardan automáticamente y se aplican inmediatamente en todos los cálculos con horario 24/7.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Clock size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Capacidad semanal real:</strong> 8,280 minutos (138 horas) por semana (10,080 minutos totales - 1,800 minutos de cierre de fin de semana).
          </span>
        </li>
      </ul>
    </div>
  </div>
  </div>
</div>
)
};
export default PlanProduccion;