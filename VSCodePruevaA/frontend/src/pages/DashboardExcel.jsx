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
  const [resumen, setResumen] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [stock, setStock] = useState([]);
  const [graficos, setGraficos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumen');
  const [exporting, setExporting] = useState(null);
  const [oeeConfig, setOeeConfig] = useState(0.85);
  const [machines, setMachines] = useState([]);

useEffect(() => {
  fetchData();
}, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resumenRes, pedidosRes, stockRes, graficosRes, configRes] = await Promise.all([
        fetch('/api/dashboard-excel/resumen'),
        fetch('/api/dashboard-excel/pedidos'),
        fetch('/api/dashboard-excel/stock'),
        fetch('/api/dashboard-excel/graficos'),
        fetch('/api/configuracion')
      ]);

      const resumenData = await resumenRes.json();
      const pedidosData = await pedidosRes.json();
      const stockData = await stockRes.json();
      const graficosData = await graficosRes.json();
      const configData = await configRes.json();

      // Obtener OEE de configuración
      const oeeValor = parseFloat(
        configData.data?.find(c => c.clave === 'oee_objetivo')?.valor || '0.85'
      );
      setOeeConfig(oeeValor);

      // Calcular utilización de máquinas
      const machineUtilization = calcularUtilizacionMaquinas(pedidosData.pedidos || [], oeeValor);
      setMachines(machineUtilization);

      setResumen(resumenData.resumen);
      setPedidos(pedidosData.pedidos || []);
      setStock(stockData.stock || []);
      setGraficos(graficosData.graficos);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const calcularUtilizacionMaquinas = (pedidosList, oee) => {
    // Simular datos de máquinas - en producción se calcularía de verdad
    const machinesConfig = [
      { id: 'm1', name: 'M1', type: 'G1 (AL)', generacion: 'G1' },
      { id: 'm2', name: 'M2', type: 'G1 (AL)', generacion: 'G1' },
      { id: 'm3', name: 'M3', type: 'G1 (AL)', generacion: 'G1' },
      { id: 'm4', name: 'M4', type: 'G2 (AC)', generacion: 'G2' }
    ];

    return machinesConfig.map(machine => {
      // Calcular órdenes asignadas a esta máquina
      const orders = pedidosList.filter(p => {
        const isG1 = p.no_sales_line?.startsWith('AL');
        return (machine.generacion === 'G1' && isG1) || 
               (machine.generacion === 'G2' && !isG1);
      }).length;

      // Calcular unidades totales
      const units = pedidosList
        .filter(p => {
          const isG1 = p.no_sales_line?.startsWith('AL');
          return (machine.generacion === 'G1' && isG1) || 
                 (machine.generacion === 'G2' && !isG1);
        })
        .reduce((sum, p) => sum + (p.qty_pending || 0), 0);

      // Calcular tiempo estimado (simulado)
      const time = units > 0 ? Math.ceil(units / (machine.generacion === 'G1' ? 1683 : 280.5)) : 0;

      // Calcular utilización (simulada)
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
      const response = await fetch(`/api/dashboard-excel/exportar/${tipo}`);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading"></div>
        <span className="ml-3 text-lg">Cargando dashboard...</span>
      </div>
    );
  }

  // Calcular métricas adicionales
  const pedidosRequierenProduccion = pedidos.filter(p => 
    (p.stock_disponible || 0) < p.qty_pending
  ).length;
  
  const stockPorGeneracion = {
    G1: stock.filter(s => s.item_no?.startsWith('AL')).length,
    G2: stock.filter(s => s.item_no?.startsWith('AC')).length
  };

  const tabs = [
    { id: 'resumen', label: 'Resumen General', icon: Database },
    { id: 'pedidos', label: 'Pedidos', icon: Package, badge: pedidos.length },
    { id: 'stock', label: 'Stock', icon: HardHat, badge: stock.length },
    { id: 'maquinas', label: 'Máquinas', icon: Cpu }
  ];

  return (
    <div className="space-y-6">
      {/* Header Responsivo */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
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
          <div className="flex items-center text-sm text-secondary">
            <Clock size={16} className="mr-1" />
            Última actualización: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* KPIs Responsivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          title="Pedidos Totales"
          value={resumen?.pedidos.total || 0}
          subtitle={`${resumen?.pedidos.cantidad_total?.toLocaleString() || 0} unidades`}
          icon={Package}
          color="text-accent-blue"
        />
        
        <KpiCard
          title="Requieren Producción"
          value={pedidosRequierenProduccion}
          subtitle={`${pedidosRequierenProduccion > 0 ? 'Necesitan planificación' : 'Todos cubiertos'}`}
          icon={AlertTriangle}
          color={pedidosRequierenProduccion > 0 ? "text-accent-red" : "text-accent-green"}
        />
        
        <KpiCard
          title="Stock Total"
          value={resumen?.stock.productos_unicos || 0}
          subtitle={`${resumen?.stock.cantidad_total?.toLocaleString() || 0} unidades`}
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
              <div className="card">
                <div className="card-header">
                  <div className="card-title flex items-center gap-2">
                    <BarChart3 size={20} />
                    Pedidos por Cliente (Top 10)
                  </div>
                </div>
                <div className="h-80">
                  {graficos?.pedidos_por_cliente && graficos.pedidos_por_cliente.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={graficos.pedidos_por_cliente.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                        <XAxis dataKey="customer_name" stroke="#8b949e" tick={{ fontSize: 10 }} interval={0} />
                        <YAxis stroke="#8b949e" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1a1f29', 
                            border: '1px solid #30363d',
                            borderRadius: '8px'
                          }}
                          labelStyle={{ color: '#e6edf3' }}
                        />
                        <Legend />
                        <Bar dataKey="total_cantidad" name="Cantidad Total" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-secondary">
                      No hay datos de pedidos para mostrar
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title flex items-center gap-2">
                    <PieChart size={20} />
                    Stock por Generación
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'G1 (AL)', value: stockPorGeneracion.G1 },
                          { name: 'G2 (AC)', value: stockPorGeneracion.G2 }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell key="cell-0" fill="#3b82f6" />
                        <Cell key="cell-1" fill="#8b5cf6" />
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1f29', 
                          border: '1px solid #30363d',
                          borderRadius: '8px'
                        }}
                        labelStyle={{ color: '#e6edf3' }}
                      />
                      <Legend 
                        layout="vertical" 
                        align="right" 
                        verticalAlign="middle"
                        wrapperStyle={{ color: '#8b949e' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Alertas y Recomendaciones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <div className="card-header">
                  <div className="card-title flex items-center gap-2">
                    <AlertTriangle size={20} className="text-yellow-400" />
                    Alertas del Sistema
                  </div>
                </div>
                <div className="space-y-4">
                  {pedidosRequierenProduccion > 0 && (
                    <div className="alert alert-warning">
                      <AlertTriangle size={20} />
                      <div>
                        <strong>{pedidosRequierenProduccion} pedidos requieren producción</strong>
                        <p className="text-sm mt-1">
                          Estos pedidos no tienen stock suficiente y necesitan ser planificados en producción.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {resumen?.alertas.stock_bajo > 0 && (
                    <div className="alert alert-error">
                      <AlertTriangle size={20} />
                      <div>
                        <strong>{resumen.alertas.stock_bajo} productos con stock bajo</strong>
                        <p className="text-sm mt-1">
                          Por debajo del stock mínimo definido. Requiere reposición prioritaria.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {oeeConfig < 0.70 && (
                    <div className="alert alert-warning">
                      <Settings size={20} />
                      <div>
                        <strong>OEE por debajo del objetivo</strong>
                        <p className="text-sm mt-1">
                          El OEE actual ({(oeeConfig * 100).toFixed(0)}%) está por debajo del objetivo recomendado (70%).
                          Considere revisar la configuración en la sección de Configuración.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="card">
                <div className="card-header">
                  <div className="card-title flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-400" />
                    Estado del Sistema
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary">Total Pedidos Registrados:</span>
                    <span className="font-bold">{resumen?.pedidos.total || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Productos con Stock:</span>
                    <span className="font-bold">{resumen?.stock.productos_unicos || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Alertas Activas:</span>
                    <span className="font-bold text-accent-red">
                      {(resumen?.alertas.stock_bajo || 0) + (resumen?.alertas.sin_stock || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">OEE Configurado:</span>
                    <span className={`font-bold ${
                      oeeConfig >= 0.85 ? 'text-accent-green' : 
                      oeeConfig >= 0.70 ? 'text-accent-yellow' : 'text-accent-red'
                    }`}>
                      {(oeeConfig * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Máquinas Activas:</span>
                    <span className="font-bold">4/4</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Última Actualización:</span>
                    <span>{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Pedidos Pendientes ({pedidos.length})</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleExport('pedidos-atrasados')}
                  disabled={exporting === 'pedidos-atrasados'}
                  className="btn btn-secondary btn-sm flex items-center gap-2"
                >
                  <Download size={16} />
                  {exporting === 'pedidos-atrasados' ? 'Exportando...' : 'Exportar Pedidos'}
                </button>
              </div>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Producto</th>
                    <th className="hidden md:table-cell">Código</th>
                    <th className="text-right">Pendiente</th>
                    <th className="text-right hidden sm:table-cell">Stock Disp.</th>
                    <th className="text-right">A Producir</th>
                    <th className="hidden lg:table-cell">Generación</th>
                    <th className="hidden lg:table-cell">Estado</th>
                  </tr>
                </thead>
                <tbody>
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
                        <tr key={pedido.id} className={necesitaProduccion ? 'bg-yellow-900/20' : ''}>
                          <td className="font-medium">{pedido.customer_name}</td>
                          <td>
                            <div>{pedido.producto_nombre || pedido.no_sales_line}</div>
                            <div className="text-xs text-secondary md:hidden mt-1">
                              {necesitaProduccion ? `${aProducir.toLocaleString()} u a producir` : 'Stock suficiente'}
                            </div>
                          </td>
                          <td className="hidden md:table-cell font-mono">{pedido.no_sales_line}</td>
                          <td className="text-right font-bold">{pedido.qty_pending.toLocaleString()}</td>
                          <td className="text-right hidden sm:table-cell">
                            {(pedido.stock_disponible || 0).toLocaleString()}
                          </td>
                          <td className={`text-right font-bold ${
                            necesitaProduccion ? 'text-accent-yellow' : 'text-secondary'
                          }`}>
                            {aProducir.toLocaleString()}
                          </td>
                          <td className="hidden lg:table-cell">
                            <span className={`badge ${
                              pedido.no_sales_line?.startsWith('AL') ? 
                              'bg-blue-900/30 border-blue-800 text-blue-400' : 
                              'bg-purple-900/30 border-purple-800 text-purple-400'
                            }`}>
                              {pedido.no_sales_line?.startsWith('AL') ? 'G1 (AL)' : 'G2 (AC)'}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell">
                            {necesitaProduccion ? (
                              <span className="badge badge-proximo">Requiere Producción</span>
                            ) : (
                              <span className="badge badge-completado">Stock Suficiente</span>
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
              <div className="text-center py-4 text-secondary text-sm">
                Mostrando primeros 20 pedidos. Ve a la página de Pedidos para ver todos.
              </div>
            )}
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Inventario Físico ({stock.length})</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => handleExport('stock-critico')}
                  disabled={exporting === 'stock-critico'}
                  className="btn btn-secondary btn-sm flex items-center gap-2"
                >
                  <Download size={16} />
                  {exporting === 'stock-critico' ? 'Exportando...' : 'Exportar Stock'}
                </button>
              </div>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="hidden md:table-cell">Código</th>
                    <th className="text-right">Cantidad</th>
                    <th className="hidden sm:table-cell">Ubicación</th>
                    <th className="hidden lg:table-cell">Nivel Stock</th>
                    <th className="hidden lg:table-cell">Generación</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-secondary">
                        No hay inventario registrado. Importa un archivo de Inventario Físico para ver datos.
                      </td>
                    </tr>
                  ) : (
                    stock.slice(0, 20).map((item) => {
                      const nivelStock = item.nivel_stock || 'normal';
                      const getColor = () => {
                        if (nivelStock === 'critico') return 'text-accent-red';
                        if (nivelStock === 'bajo') return 'text-accent-yellow';
                        return 'text-accent-green';
                      };
                      
                      return (
                        <tr key={item.id} className={nivelStock === 'critico' ? 'bg-red-900/20' : ''}>
                          <td className="font-medium">{item.producto_nombre || 'Sin nombre'}</td>
                          <td className="hidden md:table-cell font-mono">{item.item_no}</td>
                          <td className={`text-right font-bold ${getColor()}`}>
                            {item.qty_base.toLocaleString()}
                          </td>
                          <td className="hidden sm:table-cell">{item.bin_code || '-'}</td>
                          <td className="hidden lg:table-cell">
                            <span className={`badge ${
                              nivelStock === 'critico' ? 'badge-atrasado' :
                              nivelStock === 'bajo' ? 'badge-proximo' : 'badge-completado'
                            }`}>
                              {nivelStock.toUpperCase()}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell">
                            <span className={`badge ${
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
              <div className="text-center py-4 text-secondary text-sm">
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