import React, { useState, useEffect } from 'react';
import { Factory, RefreshCw, Save, Edit2, Check, X, AlertTriangle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

const PlanProduccion = () => {
  const [pedidos, setPedidos] = useState([]);
  const [stock, setStock] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Cargar datos iniciales
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pedidosRes, stockRes, planesRes] = await Promise.all([
        fetch(`${API}/api/dashboard-excel/pedidos`),
        fetch(`${API}/api/dashboard-excel/stock`),
        fetch(`${API}/api/planes`)
      ]);

      const pedidosData = await pedidosRes.json();
      const stockData = await stockRes.json();
      const planesData = await planesRes.json();

      setPedidos(pedidosData.pedidos || []);
      setStock(stockData.stock || []);
      setPlanes(planesData.planes || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular planes inteligentes localmente
  const calcularPlanes = () => {
    if (pedidos.length === 0 || stock.length === 0) return;

    // Consolidar stock por producto
    const stockConsolidado = {};
    stock.forEach(item => {
      if (!stockConsolidado[item.item_no]) {
        stockConsolidado[item.item_no] = 0;
      }
      stockConsolidado[item.item_no] += item.qty_base || 0;
    });

    // Calcular planes para cada pedido
    const nuevosPlanes = pedidos.map(pedido => {
      const stockDisponible = stockConsolidado[pedido.no_sales_line] || 0;
      const cantidadAProducir = Math.max(0, pedido.qty_pending - stockDisponible);

      // Determinar generación y máquina
      const esG1 = pedido.no_sales_line?.startsWith('AL');
      const generacion = esG1 ? 'G1' : 'G2';
      const maquinasDisponibles = esG1 ? ['M1', 'M2', 'M3', 'M4'] : ['M1', 'M2', 'M3'];
      const maquinaAsignada = maquinasDisponibles[0]; // Asignar primera máquina disponible

      return {
        alupak_pedido_id: pedido.id,
        customer_name: pedido.customer_name,
        no_sales_line: pedido.no_sales_line,
        cantidad_pendiente: pedido.qty_pending,
        stock_disponible: stockDisponible,
        cantidad_planificada: cantidadAProducir,
        maquina_asignada: maquinaAsignada,
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: '',
        estado: cantidadAProducir > 0 ? 'requiere_produccion' : 'stock_suficiente',
        oee_aplicado: 0.85,
        observaciones: '',
        tiempo_estimado_min: 0,
        generacion: generacion,
        prioridad: '3',
        es_manual: true
      };
    });

    setPlanes(nuevosPlanes);
  };

  // Guardar planes en la base de datos
  const guardarPlanes = async () => {
    try {
      setGuardando(true);

      // Filtrar solo los planes que necesitan producción
      const planesAGuardar = planes.filter(p => p.cantidad_planificada > 0);

      if (planesAGuardar.length === 0) {
        alert('No hay planes que guardar (todos tienen stock suficiente)');
        return;
      }

      const response = await fetch(`${API}/api/planes/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planes: planesAGuardar })
      });

      const result = await response.json();

      if (result.success) {
        // Actualizar IDs locales con los IDs reales de la BD
        const planesActualizados = planes.map(p => {
          const index = planesAGuardar.findIndex(pg => pg.alupak_pedido_id === p.alupak_pedido_id);
          if (index !== -1 && result.ids_guardados[index]) {
            return { ...p, id: result.ids_guardados[index] };
          }
          return p;
        });

        setPlanes(planesActualizados);
        alert(`✅ ${result.ids_guardados.length} planes guardados exitosamente`);
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error guardando planes:', error);
      alert('❌ Error guardando planes');
    } finally {
      setGuardando(false);
    }
  };

  // Editar un plan
  const iniciarEdicion = (plan) => {
    setEditingId(plan.id);
    setEditForm({
      cantidad_planificada: plan.cantidad_planificada,
      maquina_asignada: plan.maquina_asignada,
      prioridad: plan.prioridad,
      observaciones: plan.observaciones
    });
  };

  // Guardar edición
  const guardarEdicion = async (id) => {
    try {
      const response = await fetch(`${API}/api/planes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      const result = await response.json();

      if (result.success) {
        // Actualizar plan local
        setPlanes(planes.map(p => 
          p.id === id ? { ...p, ...editForm } : p
        ));
        setEditingId(null);
        setEditForm({});
        alert('✅ Plan actualizado exitosamente');
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error actualizando plan:', error);
      alert('❌ Error actualizando plan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading mr-3"></div>
        <span className="text-lg">Cargando plan de producción...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto px-4">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Factory size={32} className="text-purple-400" />
            Plan de Producción Inteligente
          </h1>
          <p className="text-secondary mt-2 max-w-2xl">
            Calcula automáticamente las órdenes de producción basándose en pedidos ALUPAK y stock disponible
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="btn btn-secondary flex items-center gap-2 px-4 py-2"
          >
            <RefreshCw size={18} />
            Actualizar Datos
          </button>

          <button
            onClick={calcularPlanes}
            className="btn btn-primary flex items-center gap-2 px-4 py-2"
            disabled={pedidos.length === 0 || stock.length === 0}
          >
            <Factory size={18} />
            Calcular Planes
          </button>

          <button
            onClick={guardarPlanes}
            className="btn btn-success flex items-center gap-2 px-4 py-2"
            disabled={guardando || planes.filter(p => p.cantidad_planificada > 0).length === 0}
          >
            {guardando ? (
              <div className="loading mr-2" style={{ width: '18px', height: '18px' }}></div>
            ) : (
              <Save size={18} />
            )}
            Guardar Planes
          </button>
        </div>
      </header>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-blue-900/20 border-blue-800">
          <div className="text-sm text-blue-400">Total Pedidos</div>
          <div className="text-2xl font-bold">{pedidos.length}</div>
        </div>
        <div className="card bg-green-900/20 border-green-800">
          <div className="text-sm text-green-400">Productos en Stock</div>
          <div className="text-2xl font-bold">{new Set(stock.map(s => s.item_no)).size}</div>
        </div>
        <div className="card bg-yellow-900/20 border-yellow-800">
          <div className="text-sm text-yellow-400">Planes Calculados</div>
          <div className="text-2xl font-bold">{planes.length}</div>
        </div>
        <div className="card bg-purple-900/20 border-purple-800">
          <div className="text-sm text-purple-400">Requieren Producción</div>
          <div className="text-2xl font-bold">
            {planes.filter(p => p.cantidad_planificada > 0).length}
          </div>
        </div>
      </div>

      {/* Alerta si no hay datos */}
      {pedidos.length === 0 && (
        <div className="alert alert-warning">
          <AlertTriangle size={20} />
          <div>
            <strong>⚠️ No hay pedidos de ALUPAK</strong>
            <p className="text-sm mt-1">
              Importa datos de ALUPAK primero para poder calcular los planes de producción
            </p>
          </div>
        </div>
      )}

      {/* Tabla de planes */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-secondary">
              <th className="py-3 px-4 text-left">Producto</th>
              <th className="py-3 px-4 text-left hidden md:table-cell">Cliente</th>
              <th className="py-3 px-4 text-right">Pendiente</th>
              <th className="py-3 px-4 text-right hidden sm:table-cell">Stock Disp.</th>
              <th className="py-3 px-4 text-right">A Producir</th>
              <th className="py-3 px-4 text-left hidden lg:table-cell">Máquina</th>
              <th className="py-3 px-4 text-left hidden lg:table-cell">Prioridad</th>
              <th className="py-3 px-4 text-left">Estado</th>
              <th className="py-3 px-4 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {planes.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-12 text-secondary">
                  <Factory size={48} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-lg font-medium">No hay planes calculados</p>
                  <p className="text-sm mt-2">Haz clic en "Calcular Planes" para comenzar</p>
                </td>
              </tr>
            ) : (
              planes.map((plan) => (
                <tr key={plan.alupak_pedido_id} className="hover:bg-bg-secondary/50">
                  <td className="py-3 px-4 font-mono font-bold text-sm">{plan.no_sales_line || plan.producto || '-'}</td>
                  <td className="py-3 px-4 hidden md:table-cell">{plan.customer_name || plan.cliente || '-'}</td>
                  <td className="py-3 px-4 text-right font-bold">
                    {plan.cantidad_pendiente?.toLocaleString() || plan.pendiente?.toLocaleString() || '0'}
                  </td>
                  <td className="py-3 px-4 text-right hidden sm:table-cell">
                    <span className={plan.stock_disponible >= plan.cantidad_pendiente ? 'text-green-400' : 'text-yellow-400'}>
                      {plan.stock_disponible?.toLocaleString() || plan.stock?.toLocaleString() || '0'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {editingId === plan.id ? (
                      <input
                        type="number"
                        value={editForm.cantidad_planificada}
                        onChange={(e) => setEditForm(prev => ({ ...prev, cantidad_planificada: parseInt(e.target.value) || 0 }))}
                        className="form-control w-24 text-right"
                        min="0"
                      />
                    ) : (
                      <span className={`font-bold ${plan.cantidad_planificada > 0 ? 'text-accent-yellow' : 'text-green-400'}`}>
                        {plan.cantidad_planificada?.toLocaleString() || '0'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    {editingId === plan.id ? (
                      <select
                        value={editForm.maquina_asignada}
                        onChange={(e) => setEditForm(prev => ({ ...prev, maquina_asignada: e.target.value }))}
                        className="form-control w-20"
                      >
                        <option value="M1">M1</option>
                        <option value="M2">M2</option>
                        <option value="M3">M3</option>
                        {plan.generacion === 'G1' && <option value="M4">M4</option>}
                      </select>
                    ) : (
                      <span className="badge bg-blue-900/30 text-blue-400">{plan.maquina_asignada}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    {editingId === plan.id ? (
                      <select
                        value={editForm.prioridad}
                        onChange={(e) => setEditForm(prev => ({ ...prev, prioridad: e.target.value }))}
                        className="form-control w-20"
                      >
                        <option value="1">Alta</option>
                        <option value="2">Media</option>
                        <option value="3">Baja</option>
                      </select>
                    ) : (
                      <span className={`badge ${
                        plan.prioridad === '1' ? 'bg-red-900/30 text-red-400' :
                        plan.prioridad === '2' ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-green-900/30 text-green-400'
                      }`}>
                        {plan.prioridad === '1' ? 'Alta' : plan.prioridad === '2' ? 'Media' : 'Baja'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${
                      plan.estado === 'requiere_produccion' ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-green-900/30 text-green-400'
                    }`}>
                      {plan.estado === 'requiere_produccion' ? 'Requiere Producción' : 'Stock Suficiente'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {editingId === plan.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => guardarEdicion(plan.id)}
                          className="btn btn-success btn-xs p-2"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditForm({}); }}
                          className="btn btn-secondary btn-xs p-2"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => iniciarEdicion(plan)}
                        className="btn btn-secondary btn-xs px-3 py-2"
                        disabled={!plan.id}
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlanProduccion;