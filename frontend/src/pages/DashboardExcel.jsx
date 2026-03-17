import React, { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  Download,
  RefreshCw,
  Database,
  BarChart3,
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
  // Estados inicializados con valores seguros para evitar undefined
  const [resumen, setResumen] = useState({
    pedidos: { total: 0, cantidad_total: 0 },
    stock: { productos_unicos: 0, cantidad_total: 0 },
    alertas: { stock_bajo: 0, sin_stock: 0 }
  });

  const [pedidos, setPedidos] = useState([]);
  const [stock, setStock] = useState([]);
  // Inicializamos graficos como objeto con array vacío
  const [graficos, setGraficos] = useState({ pedidos_por_cliente: [] });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumen');
  const [exporting, setExporting] = useState(null);
  const [oeeConfig, setOeeConfig] = useState(0.85);
  const [machines, setMachines] = useState([]);

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

      // Procesar configuración OEE
      const oeeValor = parseFloat(
        configData.data?.find(c => c.clave === 'oee_objetivo')?.valor || '0.85'
      );
      setOeeConfig(oeeValor);

      // Calcular máquinas
      const machineUtilization = calcularUtilizacionMaquinas(pedidosData.pedidos || [], oeeValor);
      setMachines(machineUtilization);

      // Actualizar estados con validación de arrays
      setResumen(resumenData.resumen || {});
      setPedidos(Array.isArray(pedidosData.pedidos) ? pedidosData.pedidos : []);
      setStock(Array.isArray(stockData.stock) ? stockData.stock : []);

      // CRÍTICO: Asegurar que pedidos_por_cliente sea siempre un array
      const datosGraficos = graficosData.graficos || {};
      setGraficos({
        pedidos_por_cliente: Array.isArray(datosGraficos.pedidos_por_cliente)
          ? datosGraficos.pedidos_por_cliente
          : []
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
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
      if (!response.ok) throw new Error('Error en exportación');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tipo}_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alert(`✅ Exportación completada`);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Error al exportar');
    } finally {
      setExporting(null);
    }
  };

  // Cálculos derivados seguros
  const pedidosRequierenProduccion = Array.isArray(pedidos)
    ? pedidos.filter(p => (p.stock_disponible || 0) < p.qty_pending).length
    : 0;

  const stockPorGeneracion = {
    G1: Array.isArray(stock) ? stock.filter(s => s.item_no?.startsWith('AL')).length : 0,
    G2: Array.isArray(stock) ? stock.filter(s => s.item_no?.startsWith('AC')).length : 0
  };

  // Datos preparados para el gráfico circular (siempre válidos)
  const pieData = [
    { name: 'G1 (AL)', value: stockPorGeneracion.G1 },
    { name: 'G2 (AC)', value: stockPorGeneracion.G2 }
  ].filter(item => item.value > 0); // Filtrar ceros para evitar errores en PieChart

  const tabs = [
    { id: 'resumen', label: 'Resumen General', icon: Database },
    { id: 'pedidos', label: 'Pedidos', icon: Package, badge: pedidos.length },
    { id: 'stock', label: 'Stock', icon: HardHat, badge: stock.length },
    { id: 'maquinas', label: 'Máquinas', icon: Cpu }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="loading"></div>
        <span className="ml-3 text-lg text-text-primary">Cargando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-bg-primary min-h-screen p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-text-primary">
            <Database size={28} className="text-blue-400" />
            Dashboard Planning
          </h1>
          <p className="text-secondary mt-1 text-sm">Datos en tiempo real</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="btn btn-secondary flex items-center gap-2">
            <RefreshCw size={18} />
            <span>Actualizar</span>
          </button>
          <div className="flex items-center text-sm text-secondary bg-bg-secondary px-3 rounded-lg">
            <Clock size={16} className="mr-2" />
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Pedidos Totales" value={resumen?.pedidos?.total || 0} subtitle={`${(resumen?.pedidos?.cantidad_total || 0).toLocaleString()} u.`} icon={Package} color="text-blue-400" />
        <KpiCard title="A Producir" value={pedidosRequierenProduccion} subtitle={pedidosRequierenProduccion > 0 ? 'Requiere atención' : 'Todo OK'} icon={AlertTriangle} color={pedidosRequierenProduccion > 0 ? "text-red-400" : "text-green-400"} />
        <KpiCard title="Productos Stock" value={resumen?.stock?.productos_unicos || 0} subtitle={`${(resumen?.stock?.cantidad_total || 0).toLocaleString()} u.`} icon={HardHat} color="text-green-400" />
        <KpiCard title="OEE Objetivo" value={`${(oeeConfig * 100).toFixed(0)}%`} subtitle="Configurado" icon={Settings} color="text-purple-400" />
      </div>

      <ResponsiveTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Contenido Tabs */}
      <div className="space-y-6">
        {activeTab === 'resumen' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            

            {/* GRÁFICO PIE - STOCK POR GENERACIÓN */}
            <div className="card bg-[#0d1117] border border-[#30363d] rounded-xl overflow-hidden shadow-xl">
              {/* HEADER */}
              <div className="p-4 border-b border-[#30363d]">
                <h3 className="font-semibold text-[#f9fafb] flex items-center gap-2 tracking-wide">
                  <PieChart size={20} className="text-[#a78bfa]" />
                  Stock por Generación
                </h3>
              </div>

              {/* BODY */}
              <div style={{ width: '100%', height: '350px' }} className="relative">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={110}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => (
                          `${name} ${(percent * 100).toFixed(0)}%`
                        )}
                        labelStyle={{
                          fill: '#e5e7eb',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={['#60a5fa', '#a78bfa'][index % 2]}
                            stroke="#0d1117"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>

                      {/* TOOLTIP ACCESIBLE */}
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#161b22',
                          borderColor: '#30363d',
                          color: '#f9fafb',
                          borderRadius: '8px',
                          padding: '8px 12px',
                        }}
                        itemStyle={{ color: '#f9fafb' }}
                      />

                      {/* LEYENDA ACCESIBLE */}
                      <Legend
                        verticalAlign="bottom"
                        height={40}
                        wrapperStyle={{
                          color: '#e5e7eb',
                          fontSize: 13,
                          paddingTop: 10,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-[#9ca3af]">
                    <PieChart size={48} className="mb-2 opacity-20" />
                    <p className="text-sm tracking-wide">Sin stock registrado</p>
                  </div>
                )}
              </div>
            </div>
{/* GRÁFICO BARRAS - BLINDADO */}
            <div className="card bg-bg-secondary border border-border-color rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-border-color">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <BarChart3 size={20} className="text-blue-400" /> Pedidos por Cliente
                </h3>
              </div>
              <div style={{ width: '100%', height: '350px' }} className="relative">
                {graficos.pedidos_por_cliente.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficos.pedidos_por_cliente.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
                      <XAxis
                        dataKey="customer_name"
                        stroke="#8b949e"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                      />
                      <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1f29', borderColor: '#30363d', color: '#fff' }}
                      />
                      <Legend />
                      <Bar dataKey="total_cantidad" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Cantidad" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-secondary">
                    <BarChart3 size={48} className="mb-2 opacity-20" />
                    <p>Sin datos disponibles</p>
                  </div>
                )}
              </div>
            </div>

            {/* Alertas */}
            <div className="card bg-bg-secondary border border-border-color rounded-xl p-4 lg:col-span-2">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <AlertTriangle className="text-yellow-400" /> Alertas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pedidosRequierenProduccion > 0 && (
                  <div className="bg-yellow-900/20 border border-yellow-700/50 p-3 rounded-lg text-yellow-200 flex gap-3">
                    <AlertTriangle className="shrink-0" />
                    <div>
                      <strong>{pedidosRequierenProduccion} pedidos requieren producción</strong>
                      <p className="text-sm opacity-80">No hay stock suficiente para cubrir la demanda.</p>
                    </div>
                  </div>
                )}
                {(resumen?.alertas?.stock_bajo || 0) > 0 && (
                  <div className="bg-red-900/20 border border-red-700/50 p-3 rounded-lg text-red-200 flex gap-3">
                    <AlertTriangle className="shrink-0" />
                    <div>
                      <strong>{resumen.alertas.stock_bajo} productos con stock bajo</strong>
                      <p className="text-sm opacity-80">Por debajo del mínimo de seguridad.</p>
                    </div>
                  </div>
                )}
                {pedidosRequierenProduccion === 0 && (resumen?.alertas?.stock_bajo || 0) === 0 && (
                  <div className="col-span-full text-center py-4 text-green-400 bg-green-900/10 rounded-lg">
                    <CheckCircle className="inline mr-2" /> Todo el sistema está operativo sin alertas críticas.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="card bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border-color flex justify-between items-center">
              <h3 className="font-bold text-text-primary">Pedidos ({pedidos.length})</h3>
              <button onClick={() => handleExport('pedidos')} className="btn btn-secondary btn-sm flex items-center gap-2">
                <Download size={16} /> Exportar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-tertiary text-secondary uppercase text-xs">
                  <tr>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3 text-right">Pendiente</th>
                    <th className="p-3 text-right">Stock</th>
                    <th className="p-3 text-right">A Producir</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {pedidos.slice(0, 50).map((p, i) => {
                    const falta = Math.max(0, p.qty_pending - (p.stock_disponible || 0));
                    return (
                      <tr key={i} className={falta > 0 ? 'bg-yellow-900/10' : ''}>
                        <td className="p-3 font-medium">{p.customer_name}</td>
                        <td className="p-3">{p.no_sales_line}</td>
                        <td className="p-3 text-right">{p.qty_pending.toLocaleString()}</td>
                        <td className="p-3 text-right text-secondary">{(p.stock_disponible || 0).toLocaleString()}</td>
                        <td className={`p-3 text-right font-bold ${falta > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{falta.toLocaleString()}</td>
                        <td className="p-3">
                          {falta > 0 ? <span className="badge badge-proximo text-xs">Producción</span> : <span className="badge badge-completado text-xs">OK</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {pedidos.length === 0 && (
                    <tr><td colSpan="6" className="p-8 text-center text-secondary">No hay pedidos cargados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="card bg-bg-secondary border border-border-color rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border-color flex justify-between items-center">
              <h3 className="font-bold text-text-primary">Inventario ({stock.length})</h3>
              <button onClick={() => handleExport('stock')} className="btn btn-secondary btn-sm flex items-center gap-2">
                <Download size={16} /> Exportar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-tertiary text-secondary uppercase text-xs">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Ubicación</th>
                    <th className="p-3 text-right">Cantidad</th>
                    <th className="p-3">Nivel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {stock.slice(0, 50).map((item, i) => (
                    <tr key={i}>
                      <td className="p-3 font-mono text-xs">{item.item_no}</td>
                      <td className="p-3">{item.bin_code}</td>
                      <td className="p-3 text-right font-bold">{(item.qty_base || 0).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded ${item.nivel_stock === 'critico' ? 'bg-red-900/30 text-red-400' :
                            item.nivel_stock === 'bajo' ? 'bg-yellow-900/30 text-yellow-400' :
                              'bg-green-900/30 text-green-400'
                          }`}>{item.nivel_stock || 'Normal'}</span>
                      </td>
                    </tr>
                  ))}
                  {stock.length === 0 && (
                    <tr><td colSpan="4" className="p-8 text-center text-secondary">No hay inventario cargado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'maquinas' && <MachineUtilization machines={machines} />}
      </div>
    </div>
  );
};

export default DashboardExcel;