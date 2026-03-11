import React, { useState, useEffect } from 'react';
import { 
  Package,
  Plus,
  Download,
  Edit,
  Trash2,
  Search,
  TrendingUp
} from 'lucide-react';

const Productos = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    familia: '',
    formato: '',
    tiempo_estandar_min: '',
    stock_seguridad: ''
  });

  // 🔥 URL del backend
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetchProductos();
  }, []);

  const fetchProductos = async () => {
    try {
      const response = await fetch(`${API}/api/productos`);
      const data = await response.json();
      setProductos(data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching productos:', error);
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredProductos = productos.filter(producto => 
    producto.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    producto.familia.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (producto) => {
    setEditingProducto(producto);
    setFormData({
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      familia: producto.familia || '',
      formato: producto.formato || '',
      tiempo_estandar_min: producto.tiempo_estandar_min || '',
      stock_seguridad: producto.stock_seguridad || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingProducto 
        ? `${API}/api/productos/${editingProducto.id}`
        : `${API}/api/productos`;
      
      const method = editingProducto ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      if (result.success) {
        alert(editingProducto ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente');
        setShowModal(false);
        setEditingProducto(null);
        setFormData({
          codigo: '',
          nombre: '',
          descripcion: '',
          familia: '',
          formato: '',
          tiempo_estandar_min: '',
          stock_seguridad: ''
        });
        fetchProductos();
      } else {
        alert(result.message || 'Error al guardar producto');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar producto');
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1>📦 Catálogo de Productos</h1>
          <p className="text-secondary">Gestión de SKUs, familias y tiempos estándar</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary" size={18} />
            <input
              type="text"
              placeholder="Buscar producto..."
              className="form-control pl-10"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setEditingProducto(null);
              setFormData({
                codigo: '',
                nombre: '',
                descripcion: '',
                familia: '',
                formato: '',
                tiempo_estandar_min: '',
                stock_seguridad: ''
              });
              setShowModal(true);
            }}
          >
            <Plus size={18} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Total Productos</p>
              <p className="text-2xl font-bold">{productos.length}</p>
            </div>
            <Package className="text-accent-blue" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Familias</p>
              <p className="text-2xl font-bold">
                {new Set(productos.map(p => p.familia)).size}
              </p>
            </div>
            <TrendingUp className="text-accent-green" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-secondary text-sm">Formatos</p>
              <p className="text-2xl font-bold">
                {new Set(productos.map(p => p.formato)).size}
              </p>
            </div>
            <Package className="text-accent-purple" size={32} />
          </div>
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 Lista de Productos</div>
          <button className="btn btn-secondary btn-sm">
            <Download size={16} />
            Exportar
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Familia</th>
                <th>Formato</th>
                <th>Tiempo Estándar (min)</th>
                <th>Stock Seguridad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProductos.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-secondary">
                    {searchTerm ? 'No se encontraron productos' : 'No hay productos registrados'}
                  </td>
                </tr>
              ) : (
                filteredProductos.map(producto => (
                  <tr key={producto.id}>
                    <td className="font-medium">{producto.codigo}</td>
                    <td>{producto.nombre}</td>
                    <td>{producto.familia || '-'}</td>
                    <td>{producto.formato || '-'}</td>
                    <td className="text-right">
                      {producto.tiempo_estandar_min ? parseFloat(producto.tiempo_estandar_min).toFixed(3) : '0.000'}
                    </td>
                    <td className="text-right">{producto.stock_seguridad || 0}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(producto)}
                      >
                        <Edit size={16} />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edición/Creación */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-primary rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">
                {editingProducto ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
              </h3>
              <button 
                className="text-secondary hover:text-text-primary"
                onClick={() => setShowModal(false)}
              >
                <Trash2 size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Código *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.codigo}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                    required
                    placeholder="PROD-001"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    required
                    placeholder="Cápsula Café Espresso"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Familia</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.familia}
                    onChange={(e) => setFormData(prev => ({ ...prev, familia: e.target.value }))}
                    placeholder="Cápsulas"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Formato</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.formato}
                    onChange={(e) => setFormData(prev => ({ ...prev, formato: e.target.value }))}
                    placeholder="50 unidades"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Tiempo Estándar (min)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="form-control"
                    value={formData.tiempo_estandar_min}
                    onChange={(e) => setFormData(prev => ({ ...prev, tiempo_estandar_min: e.target.value }))}
                    placeholder="0.005"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Seguridad</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.stock_seguridad}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_seguridad: e.target.value }))}
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-control"
                  value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  rows="3"
                  placeholder="Descripción del producto..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editingProducto ? 'Actualizar Producto' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Productos;