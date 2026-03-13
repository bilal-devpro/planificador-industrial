import React, { useState, useEffect } from 'react';
import {
  Package,
  Upload,
  Plus,
  Filter,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  Database,
  HardHat,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const Pedidos = () => {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    estado_stock: '',
    cliente: '',
    producto: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [resumen, setResumen] = useState({
    pedidos: { total: 0, cantidad_total: 0 },
    stock: { productos_unicos: 0, cantidad_total: 0 },
    stock_bajo: 0,
    stock_critico: 0,
    stock_normal: 0,
    stock_excedente: 0,
    maquinas: { oee: 0 }
  });
  const [showFilters, setShowFilters] = useState(true);

  // 🔥 URL del backend
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const pedidosRes = await fetch(`${API}/api/dashboard-excel/pedidos`);
      const pedidosData = await pedidosRes.json();

      const resumenRes = await fetch(`${API}/api/dashboard-excel/resumen`);
      const resumenData = await resumenRes.json();

      setPedidos(pedidosData.pedidos || []);
      setResumen(resumenData.resumen);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pedidos:', error);
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const filteredPedidos = pedidos.filter(pedido => {
    if (filters.estado_stock && pedido.estado_stock !== filters.estado_stock) return false;
    if (filters.cliente && !pedido.customer_name.toLowerCase().includes(filters.cliente.toLowerCase())) return false;
    if (filters.producto && !pedido.no_sales_line.toLowerCase().includes(filters.producto.toLowerCase())) return false;
    if (filters.fecha_desde && new Date(pedido.fecha_importacion) < new Date(filters.fecha_desde)) return false;
    if (filters.fecha_hasta && new Date(pedido.fecha_importacion) > new Date(filters.fecha_hasta)) return false;
    return true;
  });

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPedidos.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPedidos.length / itemsPerPage);

  const getEstadoStockBadge = (estado) => {
    const badges = {
      stock_insuficiente: (
        <span className="badge badge-atrasado flex items-center gap-1">
          <AlertTriangle size={14} />
          Stock Insuficiente
        </span>
      ),
      stock_suficiente: (
        <span className="badge badge-completado flex items-center gap-1">
          <CheckCircle size={14} />
          Stock Suficiente
        </span>
      )
    };
    return badges[estado] || badges.stock_suficiente;
  };

  const getStockColor = (stockDisponible, cantidadPendiente) => {
    if (!stockDisponible) return 'text-accent-red';
    if (stockDisponible < cantidadPendiente) return 'text-accent-red';
    if (stockDisponible < cantidadPendiente * 1.5) return 'text-accent-yellow';
    return 'text-accent-green';
  };

  const exportToExcel = async () => {
    try {
      const response = await fetch(`${API}/api/dashboard-excel/exportar/pedidos-atrasados`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedidos_pendientes_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setTimeout(() => {
        alert('✅ Exportación completada: pedidos_pendientes.xlsx');
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
        <span className="ml-3 text-lg">Cargando pedidos...</span>
      </div>
    );
  }

  // ✅ CORRECCIÓN CLAVE: Usar Set en lugar de Map para obtener valores únicos
  const clientesUnicos = [...new Set(filteredPedidos.map(p => p.customer_name))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package size={32} className="text-blue-400" />
            Pedidos Pendientes - ALUPAK
          </h1>
          <p className="text-secondary mt-1">
            Gestión de pedidos importados desde ALUPAK con estado de stock en tiempo real
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Total Pedidos</p>
              <p className="text-2xl font-bold">{resumen?.pedidos.total || 0}</p>
            </div>
            <Package className="text-accent-blue" size={32} />
          </div>
          <div className="text-sm text-secondary mt-1">
            {resumen?.pedidos.cantidad_total?.toLocaleString() || 0} unidades totales
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Clientes Únicos</p>
              <p className="text-2xl font-bold">{resumen?.pedidos.clientes_unicos || 0}</p>
            </div>
            <Users className="text-accent-green" size={32} />
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Stock Insuficiente</p>
              <p className="text-2xl font-bold text-accent-red">
                {pedidos.filter(p => p.estado_stock === 'stock_insuficiente').length}
              </p>
            </div>
            <AlertTriangle className="text-accent-red" size={32} />
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Stock Suficiente</p>
              <p className="text-2xl font-bold text-accent-green">
                {pedidos.filter(p => p.estado_stock === 'stock_suficiente').length}
              </p>
            </div>
            <CheckCircle className="text-accent-green" size={32} />
          </div>
        </div>
      </div>

      {/* Alertas */}
      {pedidos.some(p => p.estado_stock === 'stock_insuficiente') && (
        <div className="alert alert-error">
          <AlertTriangle size={20} />
          <div>
            <strong>⚠️ Pedidos con Stock Insuficiente</strong>
            <p className="text-sm mt-1">
              Hay {pedidos.filter(p => p.estado_stock === 'stock_insuficiente').length} pedidos que no pueden ser atendidos con el stock actual.
              Revisa el inventario y considera reabastecimiento prioritario.
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Filtros de Búsqueda</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary btn-sm"
          >
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="form-label text-sm">Estado Stock</label>
              <select
                className="form-control"
                value={filters.estado_stock}
                onChange={(e) => handleFilterChange('estado_stock', e.target.value)}
              >
                <option value="">Todos</option>
                <option value="stock_suficiente">Stock Suficiente</option>
                <option value="stock_insuficiente">Stock Insuficiente</option>
              </select>
            </div>

            <div>
              <label className="form-label text-sm">Cliente</label>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar cliente..."
                value={filters.cliente}
                onChange={(e) => handleFilterChange('cliente', e.target.value)}
              />
            </div>

            <div>
              <label className="form-label text-sm">Producto</label>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar producto..."
                value={filters.producto}
                onChange={(e) => handleFilterChange('producto', e.target.value)}
              />
            </div>

            <div>
              <label className="form-label text-sm">Fecha Desde</label>
              <input
                type="date"
                className="form-control"
                value={filters.fecha_desde}
                onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
              />
            </div>

            <div>
              <label className="form-label text-sm">Fecha Hasta</label>
              <input
                type="date"
                className="form-control"
                value={filters.fecha_hasta}
                onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Pedidos */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 Listado de Pedidos Pendientes</div>
          <div className="text-sm text-secondary">
            Mostrando {currentItems.length} de {filteredPedidos.length} pedidos
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Producto</th>
                <th>Código</th>
                <th className="text-right">Cantidad Pendiente</th>
                <th className="text-right">Stock Disponible</th>
                <th className="text-center">Cobertura</th>
                <th>Estado Stock</th>
                <th>Fecha Importación</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-secondary">
                    {filteredPedidos.length === 0 ? (
                      <>
                        <Package size={48} className="mx-auto mb-4 text-gray-600" />
                        <p className="text-lg font-medium mb-2">No hay pedidos pendientes</p>
                        <p>Importa un archivo ALUPAK para ver los pedidos</p>
                      </>
                    ) : (
                      'No se encontraron pedidos con los filtros seleccionados'
                    )}
                  </td>
                </tr>
              ) : (
                currentItems.map((pedido) => (
                  <tr
                    key={pedido.id}
                    className={pedido.estado_stock === 'stock_insuficiente' ? 'bg-red-900/20' : ''}
                  >
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-blue-400" />
                        {pedido.customer_name}
                      </div>
                    </td>
                    <td>
                      {pedido.producto_nombre ? (
                        <>
                          <div className="font-medium">{pedido.producto_nombre}</div>
                          <div className="text-xs text-secondary">{pedido.producto_familia || '-'}</div>
                        </>
                      ) : (
                        <span className="text-secondary">Producto no identificado</span>
                      )}
                    </td>
                    <td className="font-mono bg-gray-800/50 px-2 py-1 rounded">
                      {pedido.no_sales_line}
                    </td>
                    <td className="text-right font-bold text-lg">
                      {pedido.qty_pending.toLocaleString()}
                    </td>
                    <td className={`text-right font-bold ${getStockColor(pedido.stock_disponible, pedido.qty_pending)}`}>
                      {pedido.stock_disponible?.toLocaleString() || '0'}
                    </td>
                    <td className="text-center">
                      {pedido.stock_disponible && pedido.qty_pending ? (
                        <div className="flex flex-col items-center">
                          <span className={`font-bold ${getStockColor(pedido.stock_disponible, pedido.qty_pending)}`}>
                            {Math.round((pedido.stock_disponible / pedido.qty_pending) * 100)}%
                          </span>
                          <span className="text-xs text-secondary">
                            {pedido.stock_disponible >= pedido.qty_pending ? '✓' : '✗'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-secondary">-</span>
                      )}
                    </td>
                    <td>{getEstadoStockBadge(pedido.estado_stock)}</td>
                    <td className="text-sm text-secondary">
                      <Clock size={14} className="inline mr-1" />
                      {new Date(pedido.fecha_importacion).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-border-color">
            <div className="text-sm text-secondary">
              Página {currentPage} de {totalPages} -
              Mostrando {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredPedidos.length)} de {filteredPedidos.length} pedidos
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                <ChevronLeft size={16} />
                Anterior
              </button>

              <div className="flex gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, index) => {
                  const pageNum = index + 1;
                  return (
                    <button
                      key={pageNum}
                      className={`px-3 py-1 rounded ${currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-bg-secondary text-text-primary hover:bg-bg-surface'
                        }`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && (
                  <span className="px-3 py-1 text-secondary">...</span>
                )}
              </div>

              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Estadísticas por Cliente */}
      {filteredPedidos.length > 0 && clientesUnicos.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">📊 Estadísticas por Cliente</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientesUnicos.map((cliente, index) => {
              const pedidosCliente = filteredPedidos.filter(
                p => p.customer_name === cliente
              );

              // 🔥 Siempre número seguro
              const totalCantidad = pedidosCliente.reduce(
                (sum, p) => sum + (p.qty_pending || 0),
                0
              );

              // 🔥 Evita -Infinity y undefined
              const maxQty = Math.max(
                ...pedidos.map(p => p.qty_pending || 0),
                0
              );

              // 🔥 Porcentaje seguro
              const porcentaje =
                maxQty > 0 ? Math.min((totalCantidad / maxQty) * 100, 100) : 0;

              // 🔥 Stock insuficiente seguro
              const stockInsuficiente = pedidosCliente.filter(
                p => p.estado_stock === "stock_insuficiente"
              ).length;

              return (
                <div key={index} className="border border-border-color rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-lg">{cliente}</div>
                      <div className="text-sm text-secondary">
                        {pedidosCliente.length} pedidos
                      </div>
                    </div>

                    {stockInsuficiente > 0 && (
                      <AlertTriangle className="text-accent-red" size={24} />
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* Total unidades */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-secondary">Total Unidades</span>

                        {/* 🔥 Siempre número seguro */}
                        <span className="font-bold">
                          {(totalCantidad || 0).toLocaleString()}
                        </span>
                      </div>

                      {/* Barra de progreso */}
                      <div className="w-full bg-bg-secondary rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${porcentaje}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Stock insuficiente */}
                    <div className="flex justify-between text-sm">
                      <span className="text-secondary">Stock Insuficiente</span>
                      <span
                        className={`font-bold ${stockInsuficiente > 0
                            ? "text-accent-red"
                            : "text-accent-green"
                          }`}
                      >
                        {stockInsuficiente}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Pedidos;