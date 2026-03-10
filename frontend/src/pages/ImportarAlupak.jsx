import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle, AlertTriangle, X, Download, 
  RefreshCw, Database, HardHat, Package, TrendingUp, Info
} from 'lucide-react';
import LoteBadge from '../components/LoteBadge';

const ImportarAlupak = () => {
  const [archivo, setArchivo] = useState(null);
  const [datosExtraidos, setDatosExtraidos] = useState(null);
  const [datosMostrados, setDatosMostrados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState({
    procesado: false,
    guardado: false,
    mensajeProcesado: '',
    mensajeGuardado: ''
  });
  const [estadisticas, setEstadisticas] = useState(null);
  const [mostrarTablaCompleta, setMostrarTablaCompleta] = useState(false);

  // ✅ URL dinámica para producción/desarrollo
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD 
      ? 'https://planificador-industrial-1.onrender.com' 
      : 'http://localhost:3000');

  useEffect(() => {
    // Limpiar estado al montar el componente
    return () => {
      setArchivo(null);
      setDatosExtraidos(null);
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
      // ✅ Validar tipo de archivo
      if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
        setError('⚠️ Solo se permiten archivos Excel (.xlsx, .xls)');
        setArchivo(null);
        return;
      }
      
      // ✅ Validar tamaño (máximo 10MB)
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

      // ✅ Usar URL dinámica
      const response = await fetch(`${API_BASE_URL}/api/importar/alupak-pedidos`, {
        method: 'POST',
        body: formData
      });

      // ✅ Manejo robusto de errores de red
      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error en el formato del archivo');
        } else if (response.status === 500) {
          throw new Error('Error interno del servidor. Intenta nuevamente más tarde.');
        } else {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();

      if (data.success) {
        setDatosExtraidos(data);
        setDatosMostrados(data.pedidos || []);
        setEstadisticas(data.estadisticas || null);
        
        setResultado(prev => ({
          ...prev,
          procesado: true,
          mensajeProcesado: `✅ Archivo procesado exitosamente: ${data.pedidos?.length || 0} pedidos extraídos`
        }));
        
        setError('');
      } else {
        throw new Error(data.error || 'Error desconocido al procesar el archivo');
      }

    } catch (err) {
      console.error('Error procesando archivo:', err);
      setError(`❌ ${err.message || 'Error al procesar el archivo Excel'}`);
      setDatosExtraidos(null);
      setDatosMostrados([]);
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarDatos = async () => {
    // ✅ Validaciones robustas antes de guardar
    if (!datosMostrados || datosMostrados.length === 0) {
      setError('⚠️ No hay datos procesados para guardar');
      return;
    }

    // ✅ Validar estructura mínima de los datos
    const tieneEstructuraValida = datosMostrados.every(pedido => 
      pedido.CustomerName && 
      pedido.No_SalesLine && 
      typeof pedido.Qty_pending !== 'undefined'
    );

    if (!tieneEstructuraValida) {
      setError('⚠️ Los datos procesados tienen una estructura inválida. Vuelve a procesar el archivo.');
      return;
    }

    setCargando(true);
    setError('');

    try {
      // ✅ Obtener usuario con fallback seguro
      const usuario = localStorage.getItem('usuario') || 'system';
      
      // ✅ Nombre de archivo con fallback
      const nombreArchivo = archivo?.name || `alupak_${new Date().toISOString().split('T')[0]}.xlsx`;

      // ✅ Usar URL dinámica
      const response = await fetch(`${API_BASE_URL}/api/alupak/guardar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pedidos: datosMostrados,
          usuario: usuario,
          nombreArchivo: nombreArchivo
        })
      });

      // ✅ Manejo robusto de errores
      if (!response.ok) {
        // Intentar leer el cuerpo como JSON primero
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // Si no es JSON, leer como texto
          const text = await response.text();
          throw new Error(`Error ${response.status}: ${text.substring(0, 100)}`);
        }
        
        throw new Error(errorData.error || `Error ${response.status} al guardar los datos`);
      }

      const data = await response.json();

      if (data.success) {
        setResultado(prev => ({
          ...prev,
          guardado: true,
          mensajeGuardado: data.mensaje || `Guardados ${data.guardados} pedidos exitosamente`
        }));

        // ✅ Feedback visual mejorado
        const mensaje = `✅ ${data.mensaje || 'Datos guardados correctamente'}\n\n` +
                       `📊 Estadísticas:\n` +
                       `   • Pedidos guardados: ${data.estadisticas?.guardados || 0}\n` +
                       `   • Errores: ${data.estadisticas?.errores || 0}\n` +
                       `   • Total procesados: ${data.estadisticas?.procesados || 0}`;
        
        alert(mensaje);
        
        // ✅ Notificar a otros componentes
        window.dispatchEvent(new Event('datosActualizados'));
        
        // ✅ Resetear formulario después de guardar exitosamente
        setTimeout(() => {
          setArchivo(null);
          setDatosExtraidos(null);
          setDatosMostrados([]);
          setEstadisticas(null);
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
      setError(`❌ ${err.message || 'Error al guardar los datos en la base de datos'}`);
      
      // ✅ Sugerencia de solución para errores comunes
      if (err.message.includes('network') || err.message.includes('Failed to fetch')) {
        setError(`❌ No se pudo conectar con el servidor.\n\nVerifica que:\n• El backend esté funcionando en ${API_BASE_URL}\n• Tengas conexión a internet\n• No haya bloqueadores de CORS`);
      }
    } finally {
      setCargando(false);
    }
  };

  const handleReiniciar = () => {
    setArchivo(null);
    setDatosExtraidos(null);
    setDatosMostrados([]);
    setEstadisticas(null);
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
            Sube tu archivo Excel de pedidos pendientes de ALUPAK para procesarlo y guardar los datos en la base de datos.
            El sistema extraerá automáticamente los campos CustomerName, No_SalesLine y Qty_pending.
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
          
          <a 
            href="/ejemplos/alupak_ejemplo.xlsx" 
            download
            className="btn btn-primary flex items-center gap-2"
            title="Descargar ejemplo de formato ALUPAK"
          >
            <Download size={18} />
            Descargar Ejemplo
          </a>
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
                      Procesar Archivo
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

      {/* Estadísticas de procesamiento */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-blue-900/20 border-blue-800/50 p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{estadisticas.total_filas}</div>
            <div className="text-sm text-secondary">Total de filas</div>
          </div>
          <div className="card bg-green-900/20 border-green-800/50 p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{estadisticas.pedidos_extraidos}</div>
            <div className="text-sm text-secondary">Pedidos extraídos</div>
          </div>
          <div className="card bg-yellow-900/20 border-yellow-800/50 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{estadisticas.errores}</div>
            <div className="text-sm text-secondary">Errores</div>
          </div>
          <div className="card bg-purple-900/20 border-purple-800/50 p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {estadisticas.columnas_detectadas?.CustomerName ? '✓' : '✗'}
              {estadisticas.columnas_detectadas?.No_SalesLine ? '✓' : '✗'}
              {estadisticas.columnas_detectadas?.Qty_pending ? '✓' : '✗'}
            </div>
            <div className="text-sm text-secondary">Columnas detectadas</div>
          </div>
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
                onClick={() => setMostrarTablaCompleta(!mostrarTablaCompleta)}
                className="btn btn-secondary text-sm flex items-center gap-1"
              >
                {mostrarTablaCompleta ? 'Ver resumen' : 'Ver todo'}
              </button>
              
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
                  {mostrarTablaCompleta && (
                    <>
                      <th className="py-3 px-4 text-left font-medium text-secondary">Columna CustomerName</th>
                      <th className="py-3 px-4 text-left font-medium text-secondary">Columna No_SalesLine</th>
                      <th className="py-3 px-4 text-left font-medium text-secondary">Columna Qty_pending</th>
                    </>
                  )}
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
                    {mostrarTablaCompleta && (
                      <>
                        <td className="py-2 px-4 text-xs text-secondary">{estadisticas?.columnas_detectadas?.CustomerName || 'N/A'}</td>
                        <td className="py-2 px-4 text-xs text-secondary">{estadisticas?.columnas_detectadas?.No_SalesLine || 'N/A'}</td>
                        <td className="py-2 px-4 text-xs text-secondary">{estadisticas?.columnas_detectadas?.Qty_pending || 'N/A'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {datosMostrados.length > 20 && (
            <div className="p-4 text-center text-secondary text-sm border-t border-border-color">
              Mostrando primeros 20 de {datosMostrados.length} pedidos. 
              {mostrarTablaCompleta && ' Usa "Ver resumen" para mejorar el rendimiento.'}
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
              Consejos para importar correctamente
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  El archivo debe contener las columnas: <span className="font-mono bg-bg-secondary px-1 rounded">CustomerName</span>, 
                  <span className="font-mono bg-bg-secondary px-1 rounded">No_SalesLine</span> y 
                  <span className="font-mono bg-bg-secondary px-1 rounded">Qty_pending</span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  El sistema detecta automáticamente variantes de nombres de columnas (ej: "Customer Name", "Qty pending")
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  Los datos se guardan en la base de datos con tu usuario (<span className="font-medium">system</span> si no hay autenticación)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  Al guardar, los datos anteriores del mismo usuario se reemplazan automáticamente (evita duplicados)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <span>
                  URL de la API en producción: <span className="font-mono bg-bg-secondary px-1 rounded">{API_BASE_URL}</span>
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