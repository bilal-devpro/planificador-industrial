import React, { useState, useEffect } from 'react';
import {
  Upload, FileText, CheckCircle, AlertTriangle, X, Download,
  RefreshCw, Database, HardHat, Package, TrendingUp, Info
} from 'lucide-react';

const ImportarAlupak = () => {
  const [archivo, setArchivo] = useState(null);
  const [datosMostrados, setDatosMostrados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState({
    procesado: false,
    guardado: false,
    mensajeProcesado: '',
    mensajeGuardado: ''
  });

  // ✅ URL dinámica para producción/desarrollo
  const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD
      ? 'https://planificador-industrial-1.onrender.com'
      : 'http://localhost:3000');

  useEffect(() => {
    return () => {
      setArchivo(null);
      setDatosMostrados([]);
      setError('');
      setResultado({
        procesado: false,
        guardado: false,
        mensajeProcesado: '',
        mensajeGuardado: ''
      });
    };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
        setError('⚠️ Solo se permiten archivos Excel (.xlsx, .xls)');
        setArchivo(null);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('⚠️ El archivo es demasiado grande (máximo 10MB)');
        setArchivo(null);
        return;
      }
      setArchivo(file);
      setError('');
      setResultado({
        procesado: false,
        guardado: false,
        mensajeProcesado: '',
        mensajeGuardado: ''
      });
    }
  };

  const handleProcesar = async () => {
    if (!archivo) {
      setError('⚠️ Selecciona un archivo Excel primero');
      return;
    }

    setCargando(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('archivo', archivo);

      // ✅ Enviar archivo DIRECTAMENTE al backend para procesarlo
      const response = await fetch(`${API_BASE_URL}/api/alupak/importar`, {
        method: 'POST',
        body: formData
      });


      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setDatosMostrados(data.pedidos || []);
        setResultado(prev => ({
          ...prev,
          procesado: true,
          mensajeProcesado: `✅ Archivo procesado: ${data.pedidos?.length || 0} pedidos extraídos`
        }));
        setError('');
      } else {
        throw new Error(data.error || 'Error desconocido al procesar el archivo');
      }

    } catch (err) {
      console.error('Error procesando archivo:', err);
      setError(`❌ ${err.message || 'Error al procesar el archivo Excel'}`);
      setDatosMostrados([]);
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarDatos = async () => {
    if (!datosMostrados || datosMostrados.length === 0) {
      setError('⚠️ No hay datos procesados para guardar');
      return;
    }

    setCargando(true);
    setError('');

    try {
      const usuario = localStorage.getItem('usuario') || 'system';
      const nombreArchivo = archivo?.name || `alupak_${new Date().toISOString().split('T')[0]}.xlsx`;

      const response = await fetch(`${API_BASE_URL}/api/alupak/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidos: datosMostrados,
          nombreArchivo,
          usuario
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setResultado(prev => ({
          ...prev,
          guardado: true,
          mensajeGuardado: data.mensaje || `Guardados ${data.estadisticas?.guardados || 0} pedidos`
        }));

        alert(`✅ ${data.mensaje || 'Datos guardados correctamente'}`);

        window.dispatchEvent(new Event('datosActualizados'));

        setTimeout(() => {
          setArchivo(null);
          setDatosMostrados([]);
          setResultado({
            procesado: false,
            guardado: true,
            mensajeProcesado: '',
            mensajeGuardado: data.mensaje || 'Datos guardados correctamente'
          });
        }, 500);
      } else {
        throw new Error(data.error || 'Error desconocido al guardar los datos');
      }

    } catch (err) {
      console.error('Error guardando datos:', err);
      setError(`❌ ${err.message || 'Error al guardar los datos'}`);
    } finally {
      setCargando(false);
    }
  };

  const handleReiniciar = () => {
    setArchivo(null);
    setDatosMostrados([]);
    setError('');
    setResultado({
      procesado: false,
      guardado: false,
      mensajeProcesado: '',
      mensajeGuardado: ''
    });
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Upload size={32} className="text-blue-400" />
            <span>Importar Pedidos ALUPAK</span>
          </h1>
          <p className="text-secondary mt-2 max-w-2xl">
            Sube tu archivo Excel de pedidos pendientes de ALUPAK. El sistema procesará automáticamente los datos en el servidor y los guardará en la base de datos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleReiniciar}
            className="btn btn-secondary flex items-center gap-2"
            disabled={cargando}
          >
            <RefreshCw size={18} />
            Reiniciar
          </button>
        </div>
      </div>

      {/* Tarjeta de Subida */}
      <div className="card">
        <div className="p-6 border-2 border-dashed border-border-color rounded-xl text-center">
          {archivo ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="bg-blue-500/20 p-3 rounded-full mb-3">
                  <FileText size={32} className="text-blue-400" />
                </div>
                <p className="font-medium text-text-primary">{archivo.name}</p>
                <p className="text-sm text-secondary">
                  {(archivo.size / 1024).toFixed(1)} KB
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setArchivo(null)}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <X size={16} />
                  Cambiar archivo
                </button>

                <button
                  onClick={handleProcesar}
                  disabled={cargando}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {cargando ? (
                    <>
                      <div className="loading" style={{ width: '18px', height: '18px' }}></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <HardHat size={18} />
                      Procesar Archivo en Servidor
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <div className="bg-blue-500/20 p-4 rounded-full mb-4">
                <Upload size={32} className="text-blue-400" />
              </div>
              <p className="font-medium text-text-primary mb-2">
                Arrastra tu archivo Excel aquí
              </p>
              <p className="text-sm text-secondary mb-4">
                o haz clic para buscar
              </p>
              <span className="text-xs bg-bg-secondary text-text-secondary px-3 py-1 rounded">
                Formatos soportados: .xlsx, .xls (máx. 10MB)
              </span>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={20} />
          <div>{error}</div>
        </div>
      )}

      {resultado.procesado && !error && (
        <div className="alert alert-success">
          <CheckCircle size={20} />
          <div>{resultado.mensajeProcesado}</div>
        </div>
      )}

      {resultado.guardado && !error && (
        <div className="alert alert-success">
          <Database size={20} />
          <div>{resultado.mensajeGuardado}</div>
        </div>
      )}

      {/* Tabla de datos procesados */}
      {datosMostrados && datosMostrados.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-border-color flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Package size={20} className="text-purple-400" />
              Pedidos Extraídos ({datosMostrados.length})
            </h2>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGuardarDatos}
                disabled={cargando || resultado.guardado}
                className={`btn ${resultado.guardado ? 'btn-completado' : 'btn-primary'} flex items-center gap-2`}
              >
                {cargando ? (
                  <>
                    <div className="loading" style={{ width: '18px', height: '18px' }}></div>
                    Guardando...
                  </>
                ) : resultado.guardado ? (
                  <>
                    <CheckCircle size={18} />
                    Guardado Exitosamente
                  </>
                ) : (
                  <>
                    <Database size={18} />
                    Guardar Datos en BD
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-secondary/50">
                  <th className="py-3 px-4 text-left font-medium text-secondary">Fila</th>
                  <th className="py-3 px-4 text-left font-medium text-secondary">Cliente</th>
                  <th className="py-3 px-4 text-left font-medium text-secondary">Producto</th>
                  <th className="py-3 px-4 text-right font-medium text-secondary">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {datosMostrados.slice(0, 20).map((pedido, index) => (
                  <tr
                    key={index}
                    className="hover:bg-bg-secondary/50 transition-colors"
                  >
                    <td className="py-2 px-4 font-mono">{pedido.fila}</td>
                    <td className="py-2 px-4 font-medium max-w-[200px] truncate">{pedido.CustomerName}</td>
                    <td className="py-2 px-4 font-mono max-w-[150px] truncate">{pedido.No_SalesLine}</td>
                    <td className="py-2 px-4 text-right font-bold text-accent-green">
                      {pedido.Qty_pending.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {datosMostrados.length > 20 && (
            <div className="p-4 text-center text-secondary text-sm border-t border-border-color">
              Mostrando primeros 20 de {datosMostrados.length} pedidos
            </div>
          )}
        </div>
      )}

      {/* Ayuda y consejos */}
      <div className="card bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-800/50">
        <div className="flex items-start gap-4 p-4">
          <div className="bg-blue-500/20 p-3 rounded-lg">
            <Info size={24} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <HardHat size={20} />
              Procesamiento en Servidor
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  ✅ <strong>Tu archivo se procesa en el servidor</strong> (Render), no en tu navegador
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  ✅ <strong>No necesitas instalar librerías adicionales</strong> en el frontend
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  ✅ Los datos se guardan automáticamente en <strong>PostgreSQL en Render</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <span>
                  URL del backend: <span className="font-mono bg-bg-secondary px-1 rounded">{API_BASE_URL}</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportarAlupak;