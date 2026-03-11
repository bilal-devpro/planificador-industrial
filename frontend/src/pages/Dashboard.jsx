import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Package, 
  Clock, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Factory
} from 'lucide-react';

// Función auxiliar segura para formatear números
const formatNumber = (value) => {
  if (value == null || isNaN(value)) return '0';
  return Number(value).toLocaleString();
};

const Dashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [cargaLineas, setCargaLineas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);

  // 🔥 URL del backend
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${API}/api/health`, { method: 'GET' });

      if (response.ok) {
        setBackendOnline(true);
        fetchData();
      } else {
        throw new Error('Backend no responde correctamente');
      }
    } catch (error) {
      console.error('❌ Error conectando al backend:', error);
      setError('No se puede conectar al servidor backend.');
      setLoading(false);
      setBackendOnline(false);
    }
  };

  const fetchData = async () => {
    if (!backendOnline) return;
    
    try {
      console.log('🔄 Obteniendo datos del dashboard...');

      const [kpisRes, alertasRes, cargaRes] = await Promise.all([
        fetch(`${API}/api/dashboard/kpis`),
        fetch(`${API}/api/dashboard/alertas`),
        fetch(`${API}/api/dashboard/carga-lineas`)
      ]);

      if (!kpisRes.ok || !alertasRes.ok || !cargaRes.ok) {
        throw new Error('Una o más llamadas a la API fallaron');
      }

      const kpisData = await kpisRes.json();
      const alertasData = await alertasRes.json();
      const cargaData = await cargaRes.json();

      console.log('✅ Datos recibidos:', { kpisData, alertasData, cargaData });

      setKpis(kpisData);
      setAlertas(alertasData);
      setCargaLineas(cargaData);
      setLoading(false);
      setError(null);

    } catch (error) {
      console.error('❌ Error en fetchData:', error);
      setError(`Error al cargar datos del dashboard: ${error.message}`);
      setLoading(false);
    }
  };

  const retryConnection = () => {
    setError(null);
    setLoading(true);
    checkBackendStatus();
  };

  // Pantalla de error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
        <div className="bg-bg-secondary rounded-lg p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <AlertCircle size={48} className="mx-auto text-accent-red" />
          </div>
          <h2 className="text-2xl font-bold mb-4">⚠️ Error de Conexión</h2>
          <p className="text-secondary mb-6">{error}</p>
          
          <div className="space-y-4">
            <div className="bg-bg-surface p-4 rounded-lg text-left">
              <h3 className="font-bold mb-2">Pasos para solucionar:</h3>
              <ol className="list-decimal list-inside text-sm space-y-2 text-secondary">
                <li>Verifica que el backend esté corriendo en PowerShell:</li>
                <li><code className="bg-gray-700 px-2 py-1 rounded">cd backend && npm start</code></li>
                <li>Deberías ver: <code className="bg-gray-700 px-2 py-1 rounded">🚀 Servidor ejecutándose en http://localhost:3000</code></li>
                <li>Vuelve a esta página y haz clic en "Reintentar"</li>
              </ol>
            </div>

            <button 
              onClick={retryConnection} 
              className="btn btn-primary w-full"
            >
              <RefreshCw size={18} />
              Reintentar Conexión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de carga
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="loading mb-6"></div>
          <h2 className="text-2xl font-bold mb-2">Cargando Dashboard...</h2>
          <p className="text-secondary">
            {backendOnline ? 'Obteniendo datos del servidor...' : 'Conectando al servidor backend...'}
          </p>
          {backendOnline && (
            <div className="mt-4">
              <div className="w-32 h-1 bg-bg-secondary rounded-full mx-auto overflow-hidden">
                <div className="h-full bg-accent-blue animate-pulse"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Calcular estadísticas de forma SEGURA
  const calcularCapacidadTotal = () => {
    try {
      if (!cargaLineas?.data || !Array.isArray(cargaLineas.data)) return 0;
      return cargaLineas.data.reduce((sum, linea) => {
        const valor = Number(linea.capacidad_hora) || 0;
        return sum + (isNaN(valor) ? 0 : valor);
      }, 0);
    } catch (e) {
      console.error('Error calculando capacidad total:', e);
      return 0;
    }
  };

  const calcularProduccionPendiente = () => {
    try {
      if (!cargaLineas?.data || !Array.isArray(cargaLineas.data)) return 0;
      return cargaLineas.data.reduce((sum, linea) => {
        const valor = Number(linea.total_pendiente) || 0;
        return sum + (isNaN(valor) ? 0 : valor);
      }, 0);
    } catch (e) {
      console.error('Error calculando producción pendiente:', e);
      return 0;
    }
  };

  const capacidadTotal = calcularCapacidadTotal();
  const produccionPendiente = calcularProduccionPendiente();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Dashboard de Planificación</h1>
        <p className="text-secondary">Visión general del estado de producción</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="kpi-card">
          <AlertTriangle size={32} className="mx-auto text-accent-red" />
          <div className="kpi-value">{formatNumber(kpis?.data?.stockCritico)}</div>
          <div className="kpi-label">Stock Crítico</div>
          <div className="kpi-trend negative">
            <ArrowDownLeft size={16} />
            Productos bajo mínimo
          </div>
        </div>

        <div className="kpi-card">
          <Clock size={32} className="mx-auto text-accent-red" />
          <div className="kpi-value">{formatNumber(kpis?.data?.pedidosAtrasados)}</div>
          <div className="kpi-label">Pedidos Atrasados</div>
          <div className="kpi-trend negative">
            <ArrowDownLeft size={16} />
            Fuera de fecha
          </div>
        </div>

        <div className="kpi-card">
          <Package size={32} className="mx-auto text-accent-yellow" />
          <div className="kpi-value">{formatNumber(kpis?.data?.pedidosPendientes)}</div>
          <div className="kpi-label">Pedidos Pendientes</div>
          <div className="kpi-trend">
            <ChevronRight size={16} />
            Por programar
          </div>
        </div>

        <div className="kpi-card">
          <TrendingUp size={32} className="mx-auto text-accent-green" />
          <div className="kpi-value">{kpis?.data?.oeePromedio || '0.00'}</div>
          <div className="kpi-label">OEE Promedio</div>
          <div className="kpi-trend positive">
            <ArrowUpRight size={16} />
            Últimos 30 días
          </div>
        </div>
      </div>

      {/* Alertas */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">⚠️ Alertas Críticas</div>
        </div>
        {alertas?.data?.length === 0 ? (
          <p className="text-center py-8 text-secondary">No hay alertas críticas</p>
        ) : (
          <div className="space-y-3">
            {alertas?.data?.map((alerta, index) => (
              <div 
                key={index} 
                className={`alert ${
                  alerta.nivel === 'critico' ? 'alert-error' : 'alert-warning'
                }`}
              >
                <AlertTriangle size={20} />
                <div>
                  <strong>{alerta.mensaje}</strong>
                  <div className="text-sm mt-1">{new Date(alerta.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Carga por Líneas */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🏭 Carga por Líneas de Producción</div>
        </div>
        <div className="space-y-4">
          {cargaLineas?.data?.length > 0 ? (
            cargaLineas.data.map((linea) => {
              const capacidad = Number(linea.capacidad_hora) || 0;
              const pendiente = Number(linea.total_pendiente) || 0;
              const porcentaje = capacidad > 0 
                ? Math.min((pendiente / (capacidad * 16)) * 100, 100)
                : 0;
              
              const getColor = () => {
                if (porcentaje > 80) return 'bg-red-500';
                if (porcentaje > 60) return 'bg-yellow-500';
                return 'bg-green-500';
              };

              return (
                <div key={linea.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{linea.nombre} ({linea.codigo})</span>
                    <span>{Math.round(porcentaje)}%</span>
                  </div>
                  <div className="w-full bg-bg-secondary rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${getColor()}`}
                      style={{ width: `${porcentaje}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-secondary">
                    {linea.ordenes_pendientes || 0} órdenes - {formatNumber(pendiente)} unidades pendientes
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center py-8 text-secondary">No hay líneas de producción configuradas</p>
          )}
        </div>
      </div>

      {/* Acciones Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-bold mb-4">🚀 Acciones Rápidas</h3>
          <div className="space-y-3">
            <button className="btn btn-primary w-full justify-center">
              <Package size={18} />
              Nuevo Pedido
            </button>
            <button className="btn btn-secondary w-full justify-center">
              <Factory size={18} />
              Nuevo Plan
            </button>
            <button className="btn btn-secondary w-full justify-center">
              <Package size={18} />
              Ver Stock
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">📊 Estadísticas</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Líneas activas:</span>
              <span className="font-medium">{cargaLineas?.data?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Capacidad total:</span>
              <span className="font-medium">{formatNumber(capacidadTotal)} u/h</span>
            </div>
            <div className="flex justify-between">
              <span>Producción pendiente:</span>
              <span className="font-medium">{formatNumber(produccionPendiente)} u</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">ℹ️ Información</h3>
          <div className="space-y-3 text-sm text-secondary">
            <p>📅 Última actualización: {new Date().toLocaleString()}</p>
            <p>⚙️ Versión: 1.0.0</p>
            <p>📈 Datos en tiempo real</p>
            <p>🔄 Actualización automática cada 30 segundos</p>
            <p className="mt-4 text-green-400">
              ✅ Backend: {backendOnline ? 'Conectado' : 'Desconectado'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;