import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Server,
  Shield,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Package,
  Cpu
} from 'lucide-react';

const Configuracion = () => {
  const [configuracion, setConfiguracion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});

  // 🔥 IMPORTANTE: URL del backend
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetchConfiguracion();
  }, []);

  const fetchConfiguracion = async () => {
    try {
      const response = await fetch(`${API}/api/configuracion`);
      const data = await response.json();

      const configMap = {};
      data.data?.forEach(config => {
        configMap[config.clave] = config.valor;
      });

      setConfiguracion(data.data || []);
      setFormData(configMap);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching configuración:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (clave, valor) => {
    setFormData(prev => ({ ...prev, [clave]: valor }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(formData).map(([clave, valor]) =>
          fetch(`${API}/api/configuracion`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clave, valor })
          })
        )
      );

      alert('✅ Configuración guardada exitosamente');
      setSaving(false);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar configuración: ' + error.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="loading mr-3"></div>
        <span>Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-3">
          <Settings size={32} className="text-blue-400" />
          Configuración del Sistema
        </h1>
        <p className="text-secondary">
          Información y configuración del sistema
        </p>
      </div>

      {/* Sistema */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🔧 Configuración del Sistema</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="form-label">Versión del Sistema</label>
            <input
              type="text"
              className="form-control"
              value={formData.version_sistema || '1.0.0'}
              readOnly
            />
            <p className="text-sm text-secondary mt-1">
              Versión actual del sistema Planificador Industrial
            </p>
          </div>

          <div className="alert alert-info">
            <Settings size={20} />
            <div>
              <strong>Nota Importante</strong>
              <div className="text-sm mt-1">
                La configuración de OEE por máquina se gestiona directamente en la página de Plan de Producción, donde puedes ajustar los valores en tiempo real y ver su impacto inmediatamente en los cálculos.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Base de Datos */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🗄️ Base de Datos</div>
        </div>

        <div className="space-y-4">
          <div className="alert alert-info">
            <Database size={20} />
            <div>
              <strong>PostgreSQL</strong>
              <div className="text-sm mt-1">
                El sistema utiliza PostgreSQL para almacenamiento de datos en producción, garantizando alta disponibilidad y rendimiento.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-bold mb-2">Estado de la Base de Datos</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Estado:</span>
                  <span className="font-medium text-accent-green">✓ Conectada</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Última actualización:</span>
                  <span className="font-medium">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-2">Tablas Principales</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">alupak_pedidos</span>
                  <span>Pedidos de ALUPAK</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">planes_produccion</span>
                  <span>Planes de producción</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">inventario_fisico</span>
                  <span>Inventario</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">configuracion</span>
                  <span>Configuración</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Servidor */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🌐 Servidor</div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-bold mb-2">Backend</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Entorno:</span>
                  <span>Producción</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Node.js:</span>
                  <span>v20.19.0</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-2">Frontend</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Framework:</span>
                  <span>React + Vite</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Despliegue:</span>
                  <span>Vercel</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Información del Sistema */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📊 Tecnologías</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-bold mb-3">Stack Técnico</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Backend:</span>
                <span>Node.js + Express</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Base de Datos:</span>
                <span>PostgreSQL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Frontend:</span>
                <span>React + Vite</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">UI:</span>
                <span>Tailwind CSS</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-3">Características</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span>Planificación inteligente 24/7</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span>Cálculo automático con OEE</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span>Gestión de pedidos ALUPAK</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-400" />
                <span>Control de inventario</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Botones de Guardar */}
      <div className="flex justify-end gap-3">
        <button
          className="btn btn-secondary"
          onClick={fetchConfiguracion}
        >
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <div className="loading" style={{ width: '18px', height: '18px' }}></div>
              Guardando...
            </>
          ) : (
            <>
              <Save size={18} />
              Guardar Cambios
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Configuracion;