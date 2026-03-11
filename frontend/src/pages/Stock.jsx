import React, { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  HardHat,
  Database,
  CheckCircle,
  Clock,
  MapPin,
  Scale,
  FileSpreadsheet
} from 'lucide-react';

const Stock = () => {
  const [stockConsolidado, setStockConsolidado] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState(null);
  const [activeTab, setActiveTab] = useState('consolidado');
  const [filters, setFilters] = useState({
    nivel_stock: '',
    con_demanda: false
  });

  // 🔥 URL del backend
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const stockRes = await fetch(`${API}/api/dashboard-excel/stock`);
      const stockData = await stockRes.json();

      const resumenRes = await fetch(`${API}/api/dashboard-excel/resumen`);
      const resumenData = await resumenRes.json();

      const consolidado = procesarStockConsolidado(stockData.stock || []);

      setStockConsolidado(consolidado);
      setResumen(resumenData.resumen);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stock:', error);
      setLoading(false);
    }
  };

  const procesarStockConsolidado = (stockDetalle) => {
    const agrupado = {};

    stockDetalle.forEach(item => {
      if (!agrupado[item.item_no]) {
        agrupado[item.item_no] = {
          item_no: item.item_no,
          producto_nombre: item.producto_nombre || item.item_no,
          familia: item.producto_familia || '-',
          stock_total: 0,
          ubicaciones: new Set(),
          lotes: new Set(),
          stock_seguridad: item.stock_seguridad || 0,
          nivel_stock: 'normal',
          demanda_pendiente: 0,
          cobertura: null
        };
      }

      agrupado[item.item_no].stock_total += item.qty_base || 0;
      if (item.bin_code) agrupado[item.item_no].ubicaciones.add(item.bin_code);
      if (item.lot_no) agrupado[item.item_no].lotes.add(item.lot_no);

      if (item.stock_seguridad) {
        if (agrupado[item.item_no].stock_total < item.stock_seguridad) {
          agrupado[item.item_no].nivel_stock = 'critico';
        } else if (agrupado[item.item_no].stock_total < item.stock_seguridad * 1.5) {
          agrupado[item.item_no].nivel_stock = 'bajo';
        }
      }
    });

    return Object.values(agrupado).map(item => ({
      ...item,
      ubicaciones: Array.from(item.ubicaciones),
      lotes: Array.from(item.lotes),
      ubicaciones_count: item.ubicaciones.length,
      lotes_count: item.lotes.length
    }));
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const stockFiltrado = stockConsolidado.filter(item => {
    if (filters.nivel_stock && item.nivel_stock !== filters.nivel_stock) return false;
    if (filters.con_demanda && item.demanda_pendiente === 0) return false;
    return true;
  });

  const getNivelStockBadge = (nivel) => {
    const badges = {
      critico: <span className="badge badge-atrasado">CRÍTICO</span>,
      bajo: <span className="badge badge-proximo">BAJO</span>,
      normal: <span className="badge badge-completado">NORMAL</span>,
      excedente: <span className="badge badge-completado">EXCEDENTE</span>
    };
    return badges[nivel] || badges.normal;
  };

  const getStockColor = (nivel) => {
    const colors = {
      critico: 'text-accent-red',
      bajo: 'text-accent-yellow',
      normal: 'text-accent-green',
      excedente: 'text-accent-blue'
    };
    return colors[nivel] || colors.normal;
  };

  const exportToExcel = async () => {
    try {
      const response = await fetch(`${API}/api/dashboard-excel/exportar/stock-critico`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock_consolidado_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setTimeout(() => {
        alert('✅ Exportación completada: stock_consolidado.xlsx');
      }, 100);
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Error al exportar los datos');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading"></div>
        <span className="ml-3 text-lg">Cargando inventario...</span>
      </div>
    );
  }

  // Calcular métricas para el resumen
  // const totalItems = stockConsolidado.length;
  // const totalStock = stockConsolidado.reduce((sum, item) => sum + item.stock_total, 0);
  // const itemsCriticos = stockConsolidado.filter(i => i.nivel_stock === 'critico').length;
  // const itemsBajos = stockConsolidado.filter(i => i.nivel_stock === 'bajo').length;
  // const itemsSinDemanda = stockConsolidado.filter(i => i.demanda_pendiente === 0).length;
  // Calcular métricas para el resumen - ✅ CON VALIDACIONES SEGURAS
  const totalItems = stockConsolidado.length;
  const totalStock = stockConsolidado.reduce((sum, item) => sum + (item.qty_base || 0), 0); // ✅ CORREGIDO
  const itemsCriticos = stockConsolidado.filter(i => {
    const qty = i.qty_base || 0;
    const seguridad = i.stock_seguridad || 0;
    return seguridad > 0 && qty < seguridad;
  }).length;
  const itemsBajos = stockConsolidado.filter(i => {
    const qty = i.qty_base || 0;
    const seguridad = i.stock_seguridad || 0;
    return seguridad > 0 && qty >= seguridad && qty < seguridad * 1.5;
  }).length;
  const itemsSinDemanda = stockConsolidado.filter(i => (i.demanda_pendiente || 0) === 0).length;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <HardHat size={32} className="text-yellow-400" />
            Stock Consolidado - Inventario Físico
          </h1>
          <p className="text-secondary mt-1">
            Visión única del almacén basada en datos reales del inventario físico. Información esencial para Planning.
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
            onClick={exportToExcel}
            className="btn btn-primary flex items-center gap-2"
          >
            <Download size={18} />
            Exportar a Excel
          </button>
        </div>
      </div>

      {/* Resumen Ejecutivo */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Total Ítems</p>
              <p className="text-2xl font-bold">{totalItems}</p>
            </div>
            <Package className="text-accent-blue" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            Productos con stock disponible
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Stock Total</p>
              <p className="text-2xl font-bold">{totalStock.toLocaleString()}</p>
            </div>
            <Scale className="text-accent-green" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            Unidades en almacén
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Stock Crítico</p>
              <p className="text-2xl font-bold text-accent-red">{itemsCriticos}</p>
            </div>
            <AlertTriangle className="text-accent-red" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            Por debajo del mínimo
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Stock Bajo</p>
              <p className="text-2xl font-bold text-accent-yellow">{itemsBajos}</p>
            </div>
            <Clock className="text-accent-yellow" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            Próximo al mínimo
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Sin Demanda</p>
              <p className="text-2xl font-bold text-accent-blue">{itemsSinDemanda}</p>
            </div>
            <FileSpreadsheet className="text-accent-blue" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            Ítems sin pedidos pendientes
          </div>
        </div>
      </div>

      {/* Alertas Importantes */}
      {(itemsCriticos > 0 || itemsBajos > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {itemsCriticos > 0 && (
            <div className="alert alert-error">
              <AlertTriangle size={24} />
              <div>
                <strong>⚠️ {itemsCriticos} ítems con stock CRÍTICO</strong>
                <p className="text-sm mt-1">
                  Estos productos están por debajo del stock mínimo definido. Requieren atención inmediata para evitar paros en producción.
                </p>
              </div>
            </div>
          )}

          {itemsBajos > 0 && (
            <div className="alert alert-warning">
              <Clock size={24} />
              <div>
                <strong>⚠️ {itemsBajos} ítems con stock BAJO</strong>
                <p className="text-sm mt-1">
                  Estos productos están próximos al stock mínimo. Planificar reposición en el próximo ciclo de compras.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs y Filtros */}
      <div className="card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div className="flex gap-2 border-b border-border-color">
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'consolidado' ? 'text-accent-blue border-b-2 border-accent-blue' : 'text-secondary'}`}
              onClick={() => setActiveTab('consolidado')}
            >
              Vista Consolidada
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'detalle' ? 'text-accent-blue border-b-2 border-accent-blue' : 'text-secondary'}`}
              onClick={() => setActiveTab('detalle')}
            >
              Vista Detallada (Ubicaciones)
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              className="form-control w-auto"
              value={filters.nivel_stock}
              onChange={(e) => handleFilterChange('nivel_stock', e.target.value)}
            >
              <option value="">Todos los niveles</option>
              <option value="critico">Stock Crítico</option>
              <option value="bajo">Stock Bajo</option>
              <option value="normal">Stock Normal</option>
            </select>

            <button
              className={`btn ${filters.con_demanda ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => handleFilterChange('con_demanda', !filters.con_demanda)}
            >
              {filters.con_demanda ? (
                <>
                  <CheckCircle size={16} />
                  Solo con demanda
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  Todos los ítems
                </>
              )}
            </button>
          </div>
        </div>

        {/* Vista Consolidada - LO QUE PLANNING NECESITA SABER */}
        {activeTab === 'consolidado' && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th>Producto</th>
                  <th>Familia</th>
                  <th className="text-right">Cantidad (cápsulas)</th>
                  <th className="text-center">Ubicaciones</th>
                  <th className="text-center">Nivel Stock</th>
                  <th className="text-right">Stock Mínimo</th>
                  <th className="text-center">Cobertura</th>
                  <th className="text-center">Generación</th>
                </tr>
              </thead>
              <tbody>
                {stockFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-secondary">
                      <Database size={48} className="mx-auto mb-4 text-gray-600" />
                      <p className="text-lg font-medium mb-2">No hay datos de inventario</p>
                      <p>Importa un archivo de Inventario Físico para ver el stock consolidado</p>
                    </td>
                  </tr>
                ) : (
                  stockFiltrado.map((item) => {
                    // ✅ VALIDACIONES SEGURAS PARA TODOS LOS CAMPOS
                    const qtyBase = item.qty_base || 0;
                    const stockSeguridad = item.stock_seguridad || 0;
                    const itemNo = item.item_no || '';

                    // Determinar generación desde item_no
                    const esG1 = itemNo.startsWith('AL');
                    const esG2 = itemNo.startsWith('AC');
                    const generacion = esG1 ? 'G1' : (esG2 ? 'G2' : 'Desconocida');

                    // Calcular cajas equivalentes de forma segura
                    const unidadesPorCaja = esG1 ? 16380 : (esG2 ? 15600 : 1);
                    const cajasEquivalentes = Math.round(qtyBase / unidadesPorCaja);

                    // Calcular nivel de stock de forma segura
                    let nivelStock = 'normal';
                    if (stockSeguridad > 0) {
                      if (qtyBase < stockSeguridad) nivelStock = 'critico';
                      else if (qtyBase < stockSeguridad * 1.5) nivelStock = 'bajo';
                    }

                    return (
                      <tr
                        key={item.id || item.item_no}
                        className={nivelStock === 'critico' ? 'bg-red-900/20' : nivelStock === 'bajo' ? 'bg-yellow-900/20' : ''}
                      >
                        <td className="font-mono font-bold">
                          <div className="flex items-center gap-2">
                            <Package size={16} className="text-yellow-400" />
                            {itemNo}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium">{item.producto_nombre || 'Sin nombre'}</div>
                          {item.lotes_count > 0 && (
                            <div className="text-xs text-secondary mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin size={10} />
                                {item.lotes_count} lote{item.lotes_count > 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          {item.familia && item.familia !== '-' ? (
                            <span className="badge badge-completado">{item.familia}</span>
                          ) : (
                            <span className="text-secondary">Sin familia</span>
                          )}
                        </td>
                        <td className={`text-right font-bold text-lg ${getStockColor(nivelStock)}`}>
                          {qtyBase.toLocaleString()} {/* ✅ AHORA SEGURO */}
                          <div className="text-xs text-secondary mt-0.5">
                            ({cajasEquivalentes.toLocaleString()} caja{cajasEquivalentes !== 1 ? 's' : ''})
                          </div>
                        </td>
                        <td className="text-center font-medium">
                          <div className="flex justify-center items-center gap-1">
                            <MapPin size={16} className="text-yellow-400" />
                            {item.ubicaciones_count || 0}
                          </div>
                        </td>
                        <td className="text-center">
                          {getNivelStockBadge(nivelStock)}
                        </td>
                        <td className="text-right font-medium">
                          {stockSeguridad > 0 ? (
                            <span className="font-bold">{stockSeguridad.toLocaleString()}</span>
                          ) : (
                            <span className="text-secondary">No definido</span>
                          )}
                        </td>
                        <td className="text-center">
                          {stockSeguridad > 0 ? (
                            <div className="w-16 mx-auto">
                              <div className="text-xs font-bold mb-1">
                                {Math.min(100, Math.round((qtyBase / stockSeguridad) * 100))}%
                              </div>
                              <div className="w-full bg-bg-secondary rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-2 rounded-full ${nivelStock === 'critico' ? 'bg-red-500' :
                                    nivelStock === 'bajo' ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}
                                  style={{
                                    width: `${Math.min(100, (qtyBase / stockSeguridad) * 100)}%`
                                  }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-secondary">-</span>
                          )}
                        </td>
                        <td className="text-center">
                          <span className={`badge ${generacion === 'G1' ? 'bg-blue-900/30 border-blue-800 text-blue-300' :
                            generacion === 'G2' ? 'bg-purple-900/30 border-purple-800 text-purple-300' :
                              'bg-gray-800 text-gray-400'
                            }`}>
                            {generacion}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Vista Detallada - UBICACIONES ESPECÍFICAS */}
        {activeTab === 'detalle' && (
          <div className="space-y-4">
            {stockFiltrado.length === 0 ? (
              <div className="text-center py-12 text-secondary">
                <Database size={48} className="mx-auto mb-4 text-gray-600" />
                <p className="text-lg font-medium mb-2">No hay datos de inventario</p>
                <p>Importa un archivo de Inventario Físico para ver las ubicaciones detalladas</p>
              </div>
            ) : (
              stockFiltrado.map((item) => (
                <div key={item.item_no} className="border border-border-color rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3 pb-3 border-b border-border-color">
                    <div>
                      <div className="font-bold text-lg flex items-center gap-2">
                        <Package size={20} className="text-yellow-400" />
                        {item.item_no}
                      </div>
                      <div className="text-xl font-bold mt-1">{item.producto_nombre}</div>
                      <div className="text-sm text-secondary mt-1">
                        Stock Total: <span className="font-bold text-lg ml-1">{item.stock_total.toLocaleString()}</span> unidades
                      </div>
                    </div>
                    <div className="text-right">
                      {getNivelStockBadge(item.nivel_stock)}
                      <div className="text-sm text-secondary mt-1">
                        {item.ubicaciones_count} ubicacion{item.ubicaciones_count !== 1 ? 'es' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {item.ubicaciones.map((ubicacion, idx) => (
                      <div
                        key={idx}
                        className="border border-border-color rounded-lg p-3 bg-bg-secondary"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              <MapPin size={14} className="text-yellow-400" />
                              {ubicacion}
                            </div>
                            {item.lotes_count > 0 && (
                              <div className="text-xs text-secondary mt-1">
                                {item.lotes_count} lote{item.lotes_count > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`font-bold text-lg ${getStockColor(item.nivel_stock)}`}>
                              {item.stock_total.toLocaleString()}
                            </div>
                            <div className="text-xs text-secondary">unidades</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Información para Planning */}
      <div className="card bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-800/50">
        <div className="flex items-start gap-4">
          <div className="bg-blue-500/20 p-3 rounded-lg">
            <HardHat size={28} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <HardHat size={20} />
              Información Clave para Planning
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>{totalItems} ítems</strong> con stock disponible en almacén
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>{itemsCriticos} ítems críticos</strong> requieren atención inmediata para evitar paros
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Clock size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>{itemsBajos} ítems bajos</strong> deben planificarse en el próximo ciclo de compras
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Package size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <span>
                  Datos actualizados desde el último inventario físico importado
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};


export default Stock;