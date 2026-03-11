import React, { useState, useEffect } from 'react';
import { 
  Hash, Tag, Factory, CheckCircle, AlertTriangle, Download, RefreshCw, 
  Plus, Play, Pause, Check, X, TrendingUp, Database
} from 'lucide-react';
import LoteBadge from '../components/LoteBadge';

const GestionOFs = () => {
  const [ofs, setOfs] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('activas');
  const [showModal, setShowModal] = useState(false);
  const [nuevaOF, setNuevaOF] = useState({
    of_numero: '',
    producto_codigo: '',
    cantidad_planificada: '',
    maquina_asignada: 'M1',
    fecha_planificada: ''
  });

  // 🔥 URL del backend
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/of/estadisticas`);
      const data = await res.json();
      
      setOfs(data.ofs || []);
      setEstadisticas(data.estadisticas);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching OFs:', error);
      setLoading(false);
    }
  };

  const handleCrearOF = async () => {
    if (!nuevaOF.of_numero || !nuevaOF.producto_codigo || !nuevaOF.cantidad_planificada) {
      alert('Completa todos los campos obligatorios');
      return;
    }

    try {
      const response = await fetch(`${API}/api/of/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevaOF)
      });
      
      const data = await response.json();
      if (data.success) {
        alert('✅ OF creada correctamente');
        setShowModal(false);
        setNuevaOF({
          of_numero: '',
          producto_codigo: '',
          cantidad_planificada: '',
          maquina_asignada: 'M1',
          fecha_planificada: ''
        });
        fetchData();
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      console.error('Error creando OF:', error);
      alert('Error al crear la OF: ' + error.message);
    }
  };

  const getEstadoBadge = (cantidadTotal) => {
    if (cantidadTotal === 0) return <span className="badge badge-atrasado">Sin Stock</span>;
    if (cantidadTotal < 1000) return <span className="badge badge-proximo">Producción Activa</span>;
    return <span className="badge badge-completado">Completada</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading"></div>
        <span className="ml-3 text-lg">Cargando Órdenes de Fabricación...</span>
      </div>
    );
  }

  // Filtrar OFs según pestaña
  const ofsFiltradas = ofs.filter(of => {
    if (activeTab === 'activas') return of.cantidad_total > 0;
    if (activeTab === 'completadas') return of.cantidad_total >= 1000; // Umbral arbitrario
    return true; // todas
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Factory size={32} className="text-purple-400" />
            Gestión de Órdenes de Fabricación (OF)
          </h1>
          <p className="text-secondary mt-1">
            Seguimiento y control de OFs y lotes desde el inventario físico. Integración completa con planificación.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchData}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={18} />
            Actualizar
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Nueva OF Manual
          </button>
        </div>
      </div>

      {/* Resumen Ejecutivo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Total OFs Detectadas</p>
              <p className="text-2xl font-bold">{estadisticas?.total_ofs || 0}</p>
            </div>
            <Hash className="text-accent-blue" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            Desde inventario físico importado
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">OFs Activas</p>
              <p className="text-2xl font-bold text-accent-green">{estadisticas?.ofs_activas || 0}</p>
            </div>
            <Factory className="text-accent-green" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            Con stock disponible
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">OFs en Producción</p>
              <p className="text-2xl font-bold text-accent-yellow">
                {estadisticas?.ofs_por_estado?.en_produccion || 0}
              </p>
            </div>
            <Play className="text-accent-yellow" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            Órdenes activas actualmente
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Lotes Totales</p>
              <p className="text-2xl font-bold text-accent-purple">
                {ofs.reduce((sum, of) => sum + of.lotes_count, 0)}
              </p>
            </div>
            <Tag className="text-accent-purple" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            Unidades trazables
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-border-color mb-4">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'activas' ? 'text-accent-purple border-b-2 border-accent-purple' : 'text-secondary'}`}
            onClick={() => setActiveTab('activas')}
          >
            <Factory size={18} className="inline mr-1" />
            OFs Activas ({ofs.filter(o => o.cantidad_total > 0).length})
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'completadas' ? 'text-accent-purple border-b-2 border-accent-purple' : 'text-secondary'}`}
            onClick={() => setActiveTab('completadas')}
          >
            <CheckCircle size={18} className="inline mr-1" />
            OFs Completadas ({ofs.filter(o => o.cantidad_total >= 1000).length})
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'todas' ? 'text-accent-purple border-b-2 border-accent-purple' : 'text-secondary'}`}
            onClick={() => setActiveTab('todas')}
          >
            <Database size={18} className="inline mr-1" />
            Todas las OFs ({ofs.length})
          </button>
        </div>

        {/* Tabla de OFs */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>OF Número</th>
                <th>Tipo</th>
                <th>Productos</th>
                <th className="text-right">Cantidad Total</th>
                <th className="text-center">Lotes</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ofsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-secondary">
                    <Factory size={48} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-lg font-medium mb-2">No hay OFs {activeTab === 'activas' ? 'activas' : activeTab === 'completadas' ? 'completadas' : ''}</p>
                    <p>Importa inventario físico para detectar OFs automáticamente</p>
                  </td>
                </tr>
              ) : (
                ofsFiltradas.map((of) => (
                  <tr key={of.of_numero}>
                    <td className="font-mono font-bold text-purple-400">
                      <div className="flex items-center gap-2">
                        <Hash size={16} />
                        {of.of_numero}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        of.tipo === 'OF' ? 'bg-blue-900/30 border-blue-800 text-blue-300' : 
                        of.tipo === 'Lote' ? 'bg-purple-900/30 border-purple-800 text-purple-300' : 
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {of.tipo}
                      </span>
                    </td>
                    <td>
                      <div className="space-y-1">
                        {of.productos.slice(0, 2).map((prod, idx) => (
                          <div key={idx} className="font-medium">{prod}</div>
                        ))}
                        {of.productos.length > 2 && (
                          <div className="text-xs text-secondary">+{of.productos.length - 2} más</div>
                        )}
                      </div>
                    </td>
                    <td className="text-right font-bold text-lg">
                      {of.cantidad_total.toLocaleString()}
                    </td>
                    <td className="text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {of.lotes.slice(0, 3).map((lote, idx) => (
                          <LoteBadge key={idx} valor={lote} showFull={false} />
                        ))}
                        {of.lotes.length > 3 && (
                          <span className="text-xs text-secondary">+{of.lotes.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td>{getEstadoBadge(of.cantidad_total)}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm">
                        <TrendingUp size={16} />
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva OF */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-primary rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Plus size={20} className="text-blue-400" />
                Crear Nueva Orden de Fabricación
              </h3>
              <button onClick={() => setShowModal(false)} className="text-secondary">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="form-label">Número de OF *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: 384370"
                  value={nuevaOF.of_numero}
                  onChange={(e) => setNuevaOF({...nuevaOF, of_numero: e.target.value})}
                />
                <p className="text-xs text-secondary mt-1">
                  Número corto (máx. 10 dígitos) para OF, o código completo para lote
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Producto *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Código producto"
                    value={nuevaOF.producto_codigo}
                    onChange={(e) => setNuevaOF({...nuevaOF, producto_codigo: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="form-label">Cantidad *</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Unidades"
                    value={nuevaOF.cantidad_planificada}
                    onChange={(e) => setNuevaOF({...nuevaOF, cantidad_planificada: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Máquina</label>
                  <select
                    className="form-control"
                    value={nuevaOF.maquina_asignada}
                    onChange={(e) => setNuevaOF({...nuevaOF, maquina_asignada: e.target.value})}
                  >
                    <option value="M1">M1 (G1)</option>
                    <option value="M2">M2 (G1)</option>
                    <option value="M3">M3 (G1)</option>
                    <option value="M4">M4 (G1)</option>
                  </select>
                </div>
                
                <div>
                  <label className="form-label">Fecha Planificada</label>
                  <input
                    type="date"
                    className="form-control"
                    value={nuevaOF.fecha_planificada}
                    onChange={(e) => setNuevaOF({...nuevaOF, fecha_planificada: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-border-color">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCrearOF}
                  className="btn btn-primary flex-1"
                >
                  <Plus size={18} className="mr-2" />
                  Crear OF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información para Planning */}
      <div className="card bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-800/50">
        <div className="flex items-start gap-4">
          <div className="bg-purple-500/20 p-3 rounded-lg">
            <Factory size={28} className="text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <Factory size={20} />
              Sistema de Trazabilidad de OFs y Lotes
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Detección automática:</strong> El sistema identifica OFs y Lotes al importar el inventario físico desde Excel
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Hash size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>OF vs Lote:</strong> OF = número corto (≤10 dígitos), Lote = OF + sufijo (ej: 384370249140020764L03339)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Tag size={16} className="text-purple-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Trazabilidad completa:</strong> Cada lote se vincula a su OF original para seguimiento de producción
                </span>
              </li>
              <li className="flex items-start gap-2">
                <TrendingUp size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Integración planning:</strong> Las OFs detectadas se vinculan automáticamente con el Plan de Producción
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Database size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Persistencia:</strong> Toda la información se guarda en la base de datos para histórico y reporting
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GestionOFs;