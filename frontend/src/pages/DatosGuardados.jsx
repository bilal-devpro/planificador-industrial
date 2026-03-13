import React, { useState, useEffect } from 'react';
import { 
  Package, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  RefreshCw,
  Clock,
  Database,
  TrendingUp,
  MapPin,
  Scale,
  Info,
  Trash2
} from 'lucide-react';

const DatosGuardados = () => {
  const [alupakData, setAlupakData] = useState([]);
  const [inventarioData, setInventarioData] = useState([]);
  const [ultimaAlupak, setUltimaAlupak] = useState(null);
  const [ultimaInventario, setUltimaInventario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('alupak');

  // 🔥 URL del backend
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alupakRes, inventarioRes] = await Promise.all([
        fetch(`${API}/api/alupak/ultimos`),
        fetch(`${API}/api/inventario/ultimos`)
      ]);

      const alupakData = await alupakRes.json();
      const inventarioData = await inventarioRes.json();

      setAlupakData(alupakData.pedidos || []);
      setInventarioData(inventarioData.inventario || []);
      setUltimaAlupak(alupakData.ultima_importacion);
      setUltimaInventario(inventarioData.ultima_importacion);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchData();
  };

  const clearDatabase = async (tipo) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar TODOS los datos de ${tipo.toUpperCase()} de la base de datos? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const response = await fetch(`${API}/api/${tipo}/limpiar`, {
        method: 'DELETE'
      });

      if (response.ok) {
        alert(`✅ Datos de ${tipo.toUpperCase()} eliminados correctamente`);
        fetchData();
        window.dispatchEvent(new Event('datosActualizados'));
      } else {
        throw new Error('Error al eliminar datos');
      }
    } catch (error) {
      console.error('Error clearing database:', error);
      alert(`❌ Error al eliminar datos: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mejorado */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Database size={32} className="text-blue-400" />
          <span>Datos Guardados en Base de Datos</span>
        </h1>
        <p className="text-secondary mt-2 max-w-2xl">
          Visualiza y administra los datos de pedidos ALUPAK e inventario físico almacenados en PostgreSQL.
          Mantén tu base de datos actualizada y limpia para cálculos precisos.
        </p>
      </div>

      {/* Controles mejorados */}
      <div className="card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-2">
            <button
              className={`btn ${activeTab === 'alupak' ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
              onClick={() => setActiveTab('alupak')}
            >
              <Package size={18} />
              Pedidos ALUPAK
            </button>
            <button
              className={`btn ${activeTab === 'inventario' ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
              onClick={() => setActiveTab('inventario')}
            >
              <FileText size={18} />
              Inventario Físico
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refreshData}
              className="btn btn-secondary flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
            <button
              onClick={() => clearDatabase(activeTab)}
              className="btn btn-secondary bg-red-900/20 hover:bg-red-900/30 text-red-400 border-red-800 flex items-center gap-2"
              disabled={loading}
            >
              <Trash2 size={18} />
              Limpiar {activeTab === 'alupak' ? 'ALUPAK' : 'Inventario'}
            </button>
          </div>
        </div>
        
        {/* Información adicional */}
        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-2">💡 Gestión de Datos</p>
              <ul className="list-disc list-inside space-y-1 text-secondary">
                <li><strong>Actualizar:</strong> Recarga los datos más recientes desde la base de datos</li>
                <li><strong>Limpiar:</strong> Elimina todos los datos del tipo seleccionado (acción irreversible)</li>
                <li><strong>Importar:</strong> Para agregar nuevos datos, ve a las páginas de importación</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ALUPAK Data */}
      {activeTab === 'alupak' && (
        <div className="space-y-6">
          {/* Última importación */}
          {ultimaAlupak && (
            <div className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database size={32} className="text-blue-400" />
                  <div>
                    <h3 className="font-bold">Última Importación ALUPAK</h3>
                    <p className="text-sm text-secondary">
                      {new Date(ultimaAlupak.fecha_importacion).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-2xl text-green-400">
                    {ultimaAlupak.filas_guardadas}
                  </div>
                  <div className="text-sm text-secondary">Pedidos guardados</div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de datos */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📋 Pedidos ALUPAK Guardados</div>
              <div className="text-sm text-secondary">
                Total: {alupakData.length} pedidos
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th title="ID único en base de datos">ID</th>
                    <th title="Nombre del cliente ALUPAK">Cliente</th>
                    <th title="Código del producto">Producto</th>
                    <th title="Cantidad pendiente de entrega">Cantidad</th>
                    <th title="Fecha de importación a la base de datos">Importación</th>
                  </tr>
                </thead>
                <tbody>
                  {alupakData.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-secondary">
                        No hay datos de ALUPAK guardados. Importa un archivo Excel primero.
                      </td>
                    </tr>
                  ) : (
                    alupakData.map((pedido) => (
                      <tr key={pedido.id}>
                        <td className="font-mono text-sm text-gray-400">{pedido.id}</td>
                        <td className="font-medium">{pedido.customer_name}</td>
                        <td className="font-mono bg-gray-800/50 px-2 py-1 rounded">
                          {pedido.no_sales_line}
                        </td>
                        <td className="text-right font-bold text-lg">
                          {pedido.qty_pending.toLocaleString()}
                        </td>
                        <td className="text-sm text-secondary">
                          {new Date(pedido.fecha_importacion).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inventario Data */}
      {activeTab === 'inventario' && (
        <div className="space-y-6">
          {/* Estadísticas */}
          {ultimaInventario && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-secondary text-sm">Última Importación</p>
                    <p className="text-sm">
                      {new Date(ultimaInventario.fecha_importacion).toLocaleDateString()}
                    </p>
                  </div>
                  <Database className="text-blue-400" size={32} />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-secondary text-sm">Registros Guardados</p>
                    <p className="text-2xl font-bold text-green-400">
                      {ultimaInventario.filas_guardadas}
                    </p>
                  </div>
                  <CheckCircle className="text-green-400" size={32} />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-secondary text-sm">Cantidad Total</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {ultimaInventario.cantidad_total?.toLocaleString('es-ES', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) || '0.00'}
                    </p>
                  </div>
                  <Scale className="text-yellow-400" size={32} />
                </div>
              </div>
            </div>
          )}

          {/* Tabla de datos */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📦 Inventario Físico Guardado</div>
              <div className="text-sm text-secondary">
                Total: {inventarioData.length} registros con stock
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th title="ID único en base de datos">ID</th>
                    <th title="Código del producto">Producto</th>
                    <th title="Código de ubicación">Ubicación</th>
                    <th title="Número de lote o serie">Lote/Serie</th>
                    <th title="Cantidad disponible">Cantidad</th>
                    <th title="Fecha de importación a la base de datos">Importación</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioData.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-secondary">
                        No hay datos de inventario guardados. Importa un archivo Excel primero.
                      </td>
                    </tr>
                  ) : (
                    inventarioData.map((registro) => (
                      <tr key={registro.id}>
                        <td className="font-mono text-sm text-gray-400">{registro.id}</td>
                        <td className="font-medium">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-green-400" />
                            {registro.item_no}
                          </div>
                        </td>
                        <td className="font-mono bg-gray-800/50 px-2 py-1 rounded">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-yellow-400" />
                            {registro.bin_code}
                          </div>
                        </td>
                        <td className="font-mono text-sm">
                          {registro.lot_no || '-'}
                        </td>
                        <td className="text-right font-bold text-lg text-green-400">
                          <div className="flex items-center justify-end gap-1">
                            <Scale className="w-4 h-4" />
                            {registro.qty_base.toLocaleString('es-ES', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })}
                          </div>
                        </td>
                        <td className="text-sm text-secondary">
                          {new Date(registro.fecha_importacion).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatosGuardados;