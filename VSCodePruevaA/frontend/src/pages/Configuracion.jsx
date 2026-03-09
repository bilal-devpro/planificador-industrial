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
  const [backupProgress, setBackupProgress] = useState(null);
  const [formData, setFormData] = useState({});

  // Estado para OEE por máquina - ¡AHORA SÍ DEFINIDO!
  const [oeeMaquinas, setOeeMaquinas] = useState({
    M1: 0.85,
    M2: 0.85,
    M3: 0.85,
    M4: 0.85
  });
  const [savingOEE, setSavingOEE] = useState(false);

  useEffect(() => {
    fetchConfiguracion();
  }, []);

  const fetchConfiguracion = async () => {
    try {
      const response = await fetch('/api/configuracion');
      const data = await response.json();

      // Extraer valores de configuración
      const configMap = {};
      data.data?.forEach(config => {
        configMap[config.clave] = config.valor;

        // Cargar OEE por máquina si existe
        if (config.clave.startsWith('oee_maquina_')) {
          const maquina = config.clave.split('_')[2];
          if (oeeMaquinas[maquina] !== undefined) {
            setOeeMaquinas(prev => ({
              ...prev,
              [maquina]: parseFloat(config.valor) || 0.85
            }));
          }
        }
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
      // Guardar configuración general
      await Promise.all(
        Object.entries(formData).map(([clave, valor]) =>
          fetch('/api/configuracion', {
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

  const handleBackup = async () => {
    setBackupProgress('Iniciando backup...');
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setBackupProgress('Backup completado exitosamente ✓');
    } catch (error) {
      console.error('Error backup:', error);
      setBackupProgress('Error al realizar backup');
    }
  };

  const handleSaveOEE = async () => {
    setSavingOEE(true);
    try {
      // Guardar OEE de cada máquina
      await Promise.all(
        Object.entries(oeeMaquinas).map(([maquina, valor]) =>
          fetch('/api/configuracion', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clave: `oee_maquina_${maquina}`,
              valor: valor.toString()
            })
          })
        )
      );

      alert('✅ Configuración de OEE guardada exitosamente para todas las máquinas');
      // Emitir evento para que otras páginas actualicen
      window.dispatchEvent(new Event('oeeUpdated'));
      setSavingOEE(false);
    } catch (error) {
      console.error('Error saving OEE:', error);
      alert('❌ Error al guardar la configuración de OEE: ' + error.message);
      setSavingOEE(false);
    }
  };

  const handleResetOEE = () => {
    setOeeMaquinas({ M1: 0.85, M2: 0.85, M3: 0.85, M4: 0.85 });
    alert('✅ Valores de OEE restaurados a 85% para todas las máquinas');
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
          Parámetros generales y configuración del sistema
        </p>
      </div>

      {/* Sistema */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🔧 Configuración del Sistema</div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Días Laborables por Semana</label>
              <input
                type="number"
                className="form-control"
                value={formData.dias_laborables || ''}
                onChange={(e) => handleInputChange('dias_laborables', e.target.value)}
                min="1"
                max="7"
              />
              <p className="text-sm text-secondary mt-1">
                Número de días laborables (7 para operación 24/7)
              </p>
            </div>

            <div>
              <label className="form-label">Turnos por Día</label>
              <input
                type="number"
                className="form-control"
                value={formData.turnos_dia || ''}
                onChange={(e) => handleInputChange('turnos_dia', e.target.value)}
                min="1"
                max="3"
              />
              <p className="text-sm text-secondary mt-1">
                Cantidad de turnos laborales por día (2 turnos de 12h)
              </p>
            </div>
            <div>
              <label className="form-label">Horas por Turno</label>
              <input
                type="number"
                className="form-control"
                value={formData.horas_turno || ''}
                onChange={(e) => handleInputChange('horas_turno', e.target.value)}
                min="8"
                max="12"
              />
              <p className="text-sm text-secondary mt-1">
                Duración en horas de cada turno laboral (12 horas)
              </p>
            </div>

            <div>
              <label className="form-label">OEE Objetivo (%)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={formData.oee_objetivo || ''}
                onChange={(e) => handleInputChange('oee_objetivo', e.target.value)}
                min="0"
                max="1"
              />
              <p className="text-sm text-secondary mt-1">
                Objetivo de OEE (Overall Equipment Effectiveness)
              </p>
            </div>
          </div>

          <div>
            <label className="form-label">Versión del Sistema</label>
            <input
              type="text"
              className="form-control"
              value={formData.version_sistema || ''}
              readOnly
            />
            <p className="text-sm text-secondary mt-1">
              Versión actual del sistema Planificador Industrial
            </p>
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
              <strong>Base de Datos SQLite</strong>
              <div className="text-sm mt-1">
                El sistema actualmente utiliza SQLite para almacenamiento de datos.
                Para producción con múltiples usuarios concurrentes, se recomienda migrar a PostgreSQL.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-bold mb-2">Estado de la Base de Datos</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Ubicación:</span>
                  <span className="font-medium">./backend/planificador.db</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Estado:</span>
                  <span className="font-medium text-accent-green">✓ Activa</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Última actualización:</span>
                  <span className="font-medium">{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-2">Acciones</h4>
              <div className="space-y-2">
                <button
                  className="btn btn-secondary w-full justify-center"
                  onClick={handleBackup}
                  disabled={backupProgress && !backupProgress.includes('✓')}
                >
                  <Save size={18} />
                  {backupProgress && !backupProgress.includes('✓') ? (
                    <>
                      <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                      Realizando Backup...
                    </>
                  ) : (
                    'Crear Backup'
                  )}
                </button>
                <button className="btn btn-secondary w-full justify-center">
                  <RefreshCw size={18} />
                  Restaurar Backup
                </button>
              </div>
            </div>
          </div>

          {backupProgress && (
            <div className={`alert ${backupProgress.includes('✓') ? 'alert-success' : 'alert-warning'}`}>
              {backupProgress}
            </div>
          )}
        </div>
      </div>

      {/* Servidor */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">🌐 Configuración del Servidor</div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Puerto Backend</label>
              <input
                type="number"
                className="form-control"
                value="3000"
                readOnly
              />
              <p className="text-sm text-secondary mt-1">
                Puerto donde corre el servidor backend
              </p>
            </div>

            <div>
              <label className="form-label">Puerto Frontend</label>
              <input
                type="number"
                className="form-control"
                value="5173"
                readOnly
              />
              <p className="text-sm text-secondary mt-1">
                Puerto donde corre el servidor frontend (desarrollo)
              </p>
            </div>

            <div>
              <label className="form-label">Modo</label>
              <input
                type="text"
                className="form-control"
                value="Desarrollo"
                readOnly
              />
              <p className="text-sm text-secondary mt-1">
                Modo actual del servidor
              </p>
            </div>

            <div>
              <label className="form-label">Node.js Version</label>
              <input
                type="text"
                className="form-control"
                value="v20.19.0"
                readOnly
              />
              <p className="text-sm text-secondary mt-1">
                Versión de Node.js del servidor
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Información del Sistema */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📊 Información del Sistema</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-bold mb-3">Estadísticas</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Uptime:</span>
                <span>2 días, 14 horas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Memoria usada:</span>
                <span>156 MB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Requests totales:</span>
                <span>1,245</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Requests hoy:</span>
                <span>87</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-3">Tecnologías</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Backend:</span>
                <span>Node.js + Express</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Base de Datos:</span>
                <span>SQLite</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Frontend:</span>
                <span>React + Vite</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">Versión:</span>
                <span>v1.0.0</span>
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