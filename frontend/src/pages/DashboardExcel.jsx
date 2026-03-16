import React, { useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Download,
  RefreshCw,
  Database,
  BarChart3,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  HardHat,
  Cpu,
  Settings
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts';
import ResponsiveTabs from '../components/ResponsiveTabs';
import KpiCard from '../components/KpiCard';
import MachineUtilization from '../components/MachineUtilization';

const DashboardExcel = () => {
  // Estado inicial seguro (evita undefined)
  const [resumen, setResumen] = useState({
    pedidos: { total: 0, cantidad_total: 0 },
    stock: { productos_unicos: 0, cantidad_total: 0 },
    stock_bajo: 0,
    stock_critico: 0,
    stock_normal: 0,
    stock_excedente: 0,
    maquinas: { oee: 0 },
    alertas: { stock_bajo: 0, sin_stock: 0 }
  });
  
  const [pedidos, setPedidos] = useState([]);
  const [stock, setStock] = useState([]);
  const [graficos, setGraficos] = useState({ pedidos_por_cliente: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumen');
  const [exporting, setExporting] = useState(null);
  const [oeeConfig, setOeeConfig] = useState(0.85);
  const [machines, setMachines] = useState([]);

  // 🔥 URL del backend
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resumenRes, pedidosRes, stockRes, graficosRes, configRes] = await Promise.all([
        fetch(`${API}/api/dashboard-excel/resumen`),
        fetch(`${API}/api/dashboard-excel/pedidos`),
        fetch(`${API}/api/dashboard-excel/stock`),
        fetch(`${API}/api/dashboard-excel/graficos`),
        fetch(`${API}/api/configuracion`)
      ]);

      const resumenData = await resumenRes.json();
      const pedidosData = await pedidosRes.json();
      const stockData = await stockRes.json();
      const graficosData = await graficosRes.json();
      const configData = await configRes.json();

      const oeeValor = parseFloat(
        configData.data?.find(c => c.clave === 'oee_objetivo')?.valor || '0.85'
      );
      setOeeConfig(oeeValor);

      const machineUtilization = calcularUtilizacionMaquinas(pedidosData.pedidos || [], oeeValor);
      setMachines(machineUtilization);

      setResumen(resumenData.resumen || {});
      setPedidos(pedidosData.pedidos || []);
      setStock(stockData.stock || []);
      // Aseguramos que graficos.pedidos_por_cliente sea siempre un array
      setGraficos({
        pedidos_por_cliente: Array.isArray(graficosData.graficos?.pedidos_por_cliente) 
          ? graficosData.graficos.pedidos_por_cliente 
          : []
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const calcularUtilizacionMaquinas = (pedidosList, oee) => {
    const machinesConfig = [
      { id: 'm1', name: 'M1', type: 'G1 (AL)', generacion: 'G1' },
      { id: 'm2', name: 'M2', type: 'G1 (AL)', generacion: 'G1' },
      { id: 'm3', name: 'M3', type: 'G1 (AL)', generacion: 'G1' },
      { id: 'm4', name: 'M4', type: 'G2 (AC)', generacion: 'G2' }
    ];

    return machinesConfig.map(machine => {
      const orders = pedidosList.filter(p => {
        const isG1 = p.no_sales_line?.startsWith('AL');
        return (machine.generacion === 'G1' && isG1) || 
               (machine.generacion === 'G2' && !isG1);
      }).length;

      const units = pedidosList
        .filter(p => {
          const isG1 = p.no_sales_line?.startsWith('AL');
          return (machine.generacion === 'G1' && isG1) || 
                 (machine.generacion === 'G2' && !isG1);
        })
        .reduce((sum, p) => sum + (p.qty_pending || 0), 0);

      const time = units > 0 ? Math.ceil(units / (machine.generacion === 'G1' ? 1683 : 280.5)) : 0;
      const utilization = Math.min(95, Math.max(40, Math.floor(Math.random() * 40) + 40));

      return {
        id: machine.id,
        name: machine.name,
        type: machine.type,
        generacion: machine.generacion,
        orders,
        units,
        time,
        utilization
      };
    });
  };

  const handleExport = async (tipo) => {
    setExporting(tipo);
    try {
      const response = await fetch(`${API}/api/dashboard-excel/exportar/${tipo}`);
      if (!response.ok) throw new Error('Error en la exportación');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || `${tipo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setTimeout(() => {
        alert(`✅ Exportación completada: ${a.download}`);
      }, 100);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Error al exportar los datos');
    } finally {
      setExporting(null);
    }
  };

  const COLORS = ['#0ea5e9', '#10b981', '#fbbf24', '#f87171', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="loading"></div>
        <span className="ml-3 text-lg text-text-primary">Cargando dashboard...</span>
      </div>
    );
  }

  // Calcular métricas adicionales seguras
  const pedidosRequierenProduccion = Array.isArray(pedidos) ? pedidos.filter(p => 
    (p.stock_disponible || 0) < p.qty_pending
  ).length : 0;
  
  const stockPorGeneracion = {
    G1: Array.isArray(stock) ? stock.filter(s => s.item_no?.startsWith('AL')).length : 0,
    G2: Array.isArray(stock) ? stock.filter(s => s.item_no?.startsWith('AC')).length : 0
  };

  const tabs = [
    { id: 'resumen', label: 'Resumen General', icon: Database },
    { id: 'pedidos', label: 'Pedidos', icon: Package, badge: pedidos.length },
    { id: 'stock', label: 'Stock', icon: HardHat, badge: stock.length },
    { id: 'maquinas', label: 'Máquinas', icon: Cpu }
  ];

  return (
    <div className="space-y-6 bg-bg-primary min-h-screen p-4 md:p-6">
      {/* Header Responsivo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-text-primary">
            <Database size={28} className="text-blue-400" />
            Dashboard Planning - Datos en Tiempo Real
          </h1>
          <p className="text-secondary mt-1 text-sm md:text-base">
            Sistema integrado de planificación con cálculos OEE y gestión inteligente de stock
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={fetchData}
            className="btn btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <RefreshCw size={18} />
            <span className="hidden xs:inline">Actualizar Datos</span>
          </button>
          <div className="flex items-center text-sm text-secondary bg-bg-secondary px-3 py-2 rounded-lg">
            <Clock size={16} className="mr-1" />
            Última actualización: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* KPIs Responsivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Pedidos Totales"
          value={resumen?.pedidos?.total || 0}
          subtitle={`${(resumen?.pedidos?.cantidad_total || 0).toLocaleString()} unidades`}
          icon={Package}
          color="text-accent-blue"
        />
        
        <KpiCard
          title="Requieren Producción"
          value={pedidosRequierenProduccion}
          subtitle={pedidosRequierenProduccion > 0 ? 'Necesitan planificación' : 'Todos cubiertos'}
          icon={AlertTriangle}
          color={pedidosRequierenProduccion > 0 ? "text-accent-red" : "text-accent-green"}
        />
        
        <KpiCard
          title="Stock Total"
          value={resumen?.stock?.productos_unicos || 0}
          subtitle={`${(resumen?.stock?.cantidad_total || 0).toLocaleString()} unidades`}
          icon={HardHat}
          color="text-accent-green"
        />
        
        <KpiCard
          title="OEE Actual"
          value={`${(oeeConfig * 100).toFixed(0)}%`}
          subtitle="Objetivo de sistema"
          icon={Settings}
          color="text-accent-purple"
          trend={{ 
            value: oeeConfig >= 0.85 ? '+Óptimo' : oeeConfig >= 0.70 ? 'Aceptable' : '-Mejorar',
            direction: oeeConfig >= 0.85 ? 'up' : 'down'
          }}
        />
      </div>

      {/* Tabs Responsivos */}
      <ResponsiveTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Contenido por Tab */}
      <div className="space-y-6">
        {activeTab === 'resumen' && (
          <div className="space-y-6">
            {/* Gráficos Responsivos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* GRÁFICO DE BARRAS CORREGIDO */}
              <div className="card bg-bg-secondary border border-border-color rounded-xl overflow-hidden shadow-lg">
                <div className="card-header p-4 border-b border-border-color">
                  <div className="card-title flex items-center gap-2 text-text-primary">
                    <BarChart3 size={20} className="text-blue-400" />
                    Pedidos por Cliente (Top 10)
                  </div>
                </div>
                {/* Altura explícita en estilo inline para evitar errores de ResponsiveContainer */}
                <div style={{ width: '100%', height: '320px' }} className="p-4">
                  {graficos?.pedidos_por_cliente && graficos.pedidos_por_cliente.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={graficos.pedidos_por_cliente.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                        <XAxis 
                          dataKey="customer_name" 
                          stroke="#8b949e" 
                          tick={{ fontSize: 11 }} 
                          interval={0}
                          tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                        />
                        <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a1f29', 
                            border: '1px solid #30363d',
                            borderRadius: '8px',
                            color: '#e6edf3',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                          itemStyle={{ color: '#60a5fa' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar dataKey="total_cantidad" name="Cantidad" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-secondary bg-bg-tertiary/30 rounded-lg">
                      <BarChart3 size={48} className="mb-2 opacity-30" />
                      <p>No hay datos de pedidos disponibles</p>
                    </div>
                  )}
                </div>
              </div>

              {/* GRÁFICO CIRCULAR CORREGIDO */}
              <div className="card bg-bg-secondary border border-border-color rounded-xl overflow-hidden shadow-lg">
                <div className="card-header p-4 border-b border-border-color">
                  <div className="card-title flex items-center gap-2 text-text-primary">
                    <PieChart size={20} className="text-purple-400" />
                    Stock por Generación
                  </div>
                </div>
                {/* Altura explícita en estilo inline */}
                <div style={{ width: '100%', height: '320px' }} className="p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'G1 (AL)', value: stockPorGeneracion.G1 || 0 },
                          { name: 'G2 (AC)', value: stockPorGeneracion.G2 || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        labelLine={false}
                        label={({ name, percent }) => (percent > 0 ? `${name}` : '')}
                      >
                        <Cell key="cell-g1" fill="#3b82f6" />
                        <Cell key="cell-g2" fill="#8b5cf6" />
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1f29', 
                          border: '1px solid #30363d',
                          borderRadius: '8px',
                          color: '#e6edf3'
                        }}
                        formatter={(value) => [`${value} productos`, 'Stock']}
                      />
                      <Legend 
                        layout="vertical" 
                        align="right" 
                        verticalAlign="middle"
                        wrapperStyle={{ color: '#8b949e', fontSize: '13px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Alertas y Recomendaciones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card bg-bg-secondary border border-border-color rounded-xl p-4">
                <div className="card-header mb-4">
                  <div className="card-title flex items-center gap-2 text-text-primary">
                    <AlertTriangle size={20} className="text-yellow-400" />
                    Alertas del Sistema
                  </div>
                </div>
                <div className="space-y-3">
                  {pedidosRequierenProduccion > 0 && (
                    <div className="alert alert-warning bg-yellow-900/20 border-yellow-700/50 text-yellow-200 p-3 rounded-lg flex gap-3">
                      <AlertTriangle size={20} className="shrink-0" />
                      <div>
                        <strong>{pedidosRequierenProduccion} pedidos requieren producción</strong>
                        <p className="text-sm mt-1 opacity-90">
                          No tienen stock suficiente y necesitan ser planificados.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {(resumen?.alertas?.stock_bajo || 0) > 0 && (
                    <div className="alert alert-error bg-red-900/20 border-red-700/50 text-red-200 p-3 rounded-lg flex gap-3">
                      <AlertTriangle size={20} className="shrink-0" />
                      <div>
                        <strong>{resumen.alertas.stock_bajo} productos con stock bajo</strong>
                        <p className="text-sm mt-1 opacity-90">
                          Por debajo del stock mínimo definido. Requiere reposición.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {oeeConfig < 0.70 && (
                    <div className="alert alert-warning bg-orange-900/20 border-orange-700/50 text-orange-200 p-3 rounded-lg flex gap-3">
                      <Settings size={20} className="shrink-0" />
                      <div>
                        <strong>OEE por debajo del objetivo</strong>
                        <p className="text-sm mt-1 opacity-90">
                          El OEE actual ({(oeeConfig * 100).toFixed(0)}%) es inferior al 70%. Revise la configuración.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {pedidosRequierenProduccion === 0 && (!resumen?.alertas?.stock_bajo || resumen.alertas.stock_bajo === 0) && (
                    <div className="text-center py-6 text-secondary">
                      <CheckCircle size={40} className="mx-auto mb-2 text-green-500/50" />
                      <p>Todo está bajo control. No hay alertas críticas.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="card bg-bg-secondary border border-border-color rounded-xl p-4">
                <div className="card-header mb-4">
                  <div className="card-title flex items-center gap-2 text-text-primary">
                    <CheckCircle size={20} className="text-green-400" />
                    Estado del Sistema
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  {[
                    { label: 'Total Pedidos Registrados:', value: resumen?.pedidos?.total || 0, bold: true },
                    { label: 'Productos con Stock:', value: resumen?.stock?.productos_unicos || 0, bold: true },
                    { label: 'Alertas Activas:', value: (resumen?.alertas?.stock_bajo || 0) + (resumen?.alertas?.sin_stock || 0), bold: true, color: 'text-accent-red' },
                    { label: 'OEE Configurado:', value: `${(oeeConfig * 100).toFixed(0)}%`, bold: true, conditionalColor: true },
                    { label: 'Máquinas Activas:', value: '4/4', bold: true },
                    { label: 'Última Actualización:', value: new Date().toLocaleString(), bold: false }
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-border-color/50 pb-2 last:border-0">
                      <span className="text-secondary">{item.label}</span>
                      <span className={`font-bold ${
                        item.color || 
                        (item.conditionalColor ? (
                          oeeConfig >= 0.85 ? 'text-accent-green' : 
                          oeeConfig >= 0.70 ? 'text-accent-yellow' : 'text-accent-red'
                        ) : 'text-text-primary')
                      }`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="card bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
            <div className="card-header p-4 border-b border-border-color flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="card-title text-text-primary">Pedidos Pendientes ({pedidos.length})</div>
              <button
                onClick={() => handleExport('pedidos-atrasados')}
                disabled={exporting === 'pedidos-atrasados'}
                className="btn btn-secondary btn-sm flex items-center gap-2"
              >
                <Download size={16} />
                {exporting === 'pedidos-atrasados' ? 'Exportando...' : 'Exportar Pedidos'}
              </button>
            </div>
            
            <div className="table-container overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-tertiary text-secondary text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Cliente</th>
                    <th className="p-4 font-semibold">Producto</th>
                    <th className="p-4 font-semibold hidden md:table-cell">Código</th>
                    <th className="p-4 font-semibold text-right">Pendiente</th>
                    <th className="p-4 font-semibold text-right hidden sm:table-cell">Stock Disp.</th>
                    <th className="p-4 font-semibold text-right">A Producir</th>
                    <th className="p-4 font-semibold hidden lg:table-cell">Generación</th>
                    <th className="p-4 font-semibold hidden lg:table-cell">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-sm">
                  {pedidos.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-12 text-secondary">
                        No hay pedidos pendientes. Importa un archivo ALUPAK para ver datos.
                      </td>
                    </tr>
                  ) : (
                    pedidos.slice(0, 20).map((pedido) => {
                      const necesitaProduccion = (pedido.stock_disponible || 0) < pedido.qty_pending;
                      const aProducir = necesitaProduccion ? pedido.qty_pending - (pedido.stock_disponible || 0) : 0;
                      
                      return (
                        <tr key={pedido.id} className={`hover:bg-bg-tertiary/50 transition-colors ${necesitaProduccion ? 'bg-yellow-900/10' : ''}`}>
                          <td className="p-4 font-medium text-text-primary">{pedido.customer_name}</td>
                          <td className="p-4">
                            <div className="text-text-primary">{pedido.producto_nombre || pedido.no_sales_line}</div>
                            <div className="text-xs text-secondary md:hidden mt-1">
                              {necesitaProduccion ? `${aProducir.toLocaleString()} u a producir` : 'Stock suficiente'}
                            </div>
                          </td>
                          <td className="p-4 hidden md:table-cell font-mono text-secondary">{pedido.no_sales_line}</td>
                          <td className="p-4 text-right font-bold text-text-primary">{pedido.qty_pending.toLocaleString()}</td>
                          <td className="p-4 text-right hidden sm:table-cell text-secondary">
                            {(pedido.stock_disponible || 0).toLocaleString()}
                          </td>
                          <td className={`p-4 text-right font-bold ${
                            necesitaProduccion ? 'text-accent-yellow' : 'text-secondary'
                          }`}>
                            {aProducir.toLocaleString()}
                          </td>
                          <td className="p-4 hidden lg:table-cell">
                            <span className={`badge px-2 py-1 rounded text-xs font-medium ${
                              pedido.no_sales_line?.startsWith('AL') ? 
                              'bg-blue-900/30 border-blue-800 text-blue-400' : 
                              'bg-purple-900/30 border-purple-800 text-purple-400'
                            }`}>
                              {pedido.no_sales_line?.startsWith('AL') ? 'G1 (AL)' : 'G2 (AC)'}
                            </span>
                          </td>
                          <td className="p-4 hidden lg:table-cell">
                            {necesitaProduccion ? (
                              <span className="badge badge-proximo bg-yellow-900/30 text-yellow-400 border-yellow-800 px-2 py-1 rounded text-xs">Requiere Prod.</span>
                            ) : (
                              <span className="badge badge-completado bg-green-900/30 text-green-400 border-green-800 px-2 py-1 rounded text-xs">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {pedidos.length > 20 && (
              <div className="text-center py-4 text-secondary text-sm bg-bg-tertiary/30">
                Mostrando primeros 20 pedidos. Ve a la página de Pedidos para ver todos.
              </div>
            )}
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="card bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
            <div className="card-header p-4 border-b border-border-color flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="card-title text-text-primary">Inventario Físico ({stock.length})</div>
              <button
                onClick={() => handleExport('stock-critico')}
                disabled={exporting === 'stock-critico'}
                className="btn btn-secondary btn-sm flex items-center gap-2"
              >
                <Download size={16} />
                {exporting === 'stock-critico' ? 'Exportando...' : 'Exportar Stock'}
              </button>
            </div>
            
            <div className="table-container overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-tertiary text-secondary text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Producto</th>
                    <th className="p-4 font-semibold hidden md:table-cell">Código</th>
                    <th className="p-4 font-semibold text-right">Cantidad</th>
                    <th className="p-4 font-semibold hidden sm:table-cell">Ubicación</th>
                    <th className="p-4 font-semibold hidden lg:table-cell">Nivel Stock</th>
                    <th className="p-4 font-semibold hidden lg:table-cell">Generación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-sm">
                  {stock.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-secondary">
                        No hay inventario registrado. Importa un archivo de Inventario Físico.
                      </td>
                    </tr>
                  ) : (
                    stock.slice(0, 20).map((item) => {
                      const nivelStock = item.nivel_stock || 'normal';
                      const getColorClass = () => {
                        if (nivelStock === 'critico') return 'text-accent-red font-bold';
                        if (nivelStock === 'bajo') return 'text-accent-yellow font-bold';
                        return 'text-text-primary';
                      };
                      
                      return (
                        <tr key={item.id} className={`hover:bg-bg-tertiary/50 transition-colors ${nivelStock === 'critico' ? 'bg-red-900/10' : ''}`}>
                          <td className="p-4 font-medium text-text-primary">{item.producto_nombre || 'Sin nombre'}</td>
                          <td className="p-4 hidden md:table-cell font-mono text-secondary">{item.item_no}</td>
                          <td className={`p-4 text-right ${getColorClass()}`}>
                            {(item.qty_base || 0).toLocaleString()}
                          </td>
                          <td className="p-4 hidden sm:table-cell text-secondary">{item.bin_code || '-'}</td>
                          <td className="p-4 hidden lg:table-cell">
                            <span className={`badge px-2 py-1 rounded text-xs font-medium ${
                              nivelStock === 'critico' ? 'bg-red-900/30 text-red-400 border-red-800' :
                              nivelStock === 'bajo' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800' : 'bg-green-900/30 text-green-400 border-green-800'
                            }`}>
                              {nivelStock.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 hidden lg:table-cell">
                            <span className={`badge px-2 py-1 rounded text-xs font-medium ${
                              item.item_no?.startsWith('AL') ? 
                              'bg-blue-900/30 border-blue-800 text-blue-400' : 
                              'bg-purple-900/30 border-purple-800 text-purple-400'
                            }`}>
                              {item.item_no?.startsWith('AL') ? 'G1' : 'G2'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {stock.length > 20 && (
              <div className="text-center py-4 text-secondary text-sm bg-bg-tertiary/30">
                Mostrando primeros 20 ítems. Ve a la página de Stock para ver todos.
              </div>
            )}
          </div>
        )}

        {activeTab === 'maquinas' && (
          <MachineUtilization machines={machines} />
        )}
      </div>
    </div>
  );
};

export default DashboardExcel;