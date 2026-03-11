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
  Scale
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>💾 Datos Guardados</h1>
        <p className="text-secondary">
          Visualiza los datos de ALUPAK e Inventario Físico guardados en la base de datos
        </p>
      </div>

      {/* Controles */}
      <div className="card">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <button
              className={`btn ${activeTab === 'alupak' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('alupak')}
            >
              <Package size={18} />
              ALUPAK Pedidos
            </button>
            <button
              className={`btn ${activeTab === 'inventario' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('inventario')}
            >
              <FileText size={18} />
              Inventario Físico
            </button>
          </div>
          <button
            onClick={refreshData}
            className="btn btn-secondary"
          >
            <RefreshCw size={18} />
            Actualizar
          </button>
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
                    <th>ID</th>
                    <th>CustomerName</th>
                    <th>No_SalesLine</th>
                    <th>Qty_pending</th>
                    <th>Fecha Importación</th>
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
                    <th>ID</th>
                    <th>Item No</th>
                    <th>Bin Code</th>
                    <th>Lote/Serie</th>
                    <th>Cantidad</th>
                    <th>Fecha Importación</th>
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