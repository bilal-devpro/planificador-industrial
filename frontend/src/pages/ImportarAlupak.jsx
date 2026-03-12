import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
  const [estadisticas, setEstadisticas] = useState(null);
  const [mostrarTablaCompleta, setMostrarTablaCompleta] = useState(false);

  // ✅ URL dinámica para producción/desarrollo
  const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.PROD 
      ? 'https://planificador-industrial-1.onrender.com' 
      : 'http://localhost:3000');

  useEffect(() => {
    // Limpiar estado al desmontar
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

  // ✅ PROCESAR EXCEL EN EL NAVEGADOR (sin dependencia del backend)
  const procesarExcel = (file) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        // Buscar columnas con lógica robusta
        const headers = Object.keys(jsonData[0] || {});
        
        const buscarColumna = (nombresBusqueda) => {
          for (const nombre of nombresBusqueda) {
            const coincidencia = headers.find(h => 
              h && h.toString().toLowerCase().includes(nombre.toLowerCase())
            );
            if (coincidencia) return coincidencia;
          }
          return null;
        };
        
        const colCustomerName = buscarColumna(['CustomerName', 'customer_name', 'Customer Name']);
        const colNoSalesLine = buscarColumna(['No_SalesLine', 'no_sales_line', 'No.', 'Document No.', 'No']);
        const colQtyPending = buscarColumna(['Qty_pending', 'qty_pending', 'Quantity', 'Pending']);
        
        if (!colCustomerName || !colNoSalesLine || !colQtyPending) {
          setError('❌ Columnas requeridas no encontradas. El archivo debe contener: CustomerName, No_SalesLine y Qty_pending');
          setDatosMostrados([]);
          return;
        }
        
        // Extraer datos válidos
        const pedidos = jsonData
          .map((row, index) => ({
            fila: index + 2,
            CustomerName: (row[colCustomerName] || '').toString().trim(),
            No_SalesLine: (row[colNoSalesLine] || '').toString().trim(),
            Qty_pending: parseInt(row[colQtyPending]) || 0
          }))
          .filter(p => p.CustomerName && p.No_SalesLine && p.Qty_pending > 0);
        
        setDatosMostrados(pedidos);
        setEstadisticas({
          total_filas: jsonData.length,
          pedidos_extraidos: pedidos.length,
          columnas_detectadas: {
            CustomerName: colCustomerName,
            No_SalesLine: colNoSalesLine,
            Qty_pending: colQtyPending
          }
        });
        
        setResultado(prev => ({
          ...prev,
          procesado: true,
          mensajeProcesado: `✅ Archivo procesado exitosamente: ${pedidos.length} pedidos extraídos`
        }));
        
        setError('');
        
      } catch (err) {
        console.error('Error procesando Excel:', err);
        setError(`❌ Error al procesar el archivo: ${err.message || 'Formato inválido'}`);
        setDatosMostrados([]);
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

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
      
      // ✅ Procesar automáticamente al seleccionar archivo
      procesarExcel(file);
    }
  };

  const handleGuardarDatos = async () => {
    // ✅ Validaciones robustas
    if (!datosMostrados || datosMostrados.length === 0) {
      setError('⚠️ No hay datos procesados para guardar');
      return;
    }
    
    if (datosMostrados.length === 0) {
      setError('⚠️ No se encontraron pedidos válidos en el archivo');
      return;
    }
    
    setCargando(true);
    setError('');
    
    try {
      // ✅ Obtener usuario con fallback seguro
      const usuario = localStorage.getItem('usuario') || 'system';
      
      // ✅ Nombre de archivo con fallback
      const nombreArchivo = archivo?.name || `alupak_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // ✅ ENVIAR DATOS YA PROCESADOS AL BACKEND (endpoint /api/alupak/guardar)
      const response = await fetch(`${API_BASE_URL}/api/alupak/guardar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pedidos: datosMostrados,
          nombreArchivo: nombreArchivo,
          usuario: usuario
        })
      });
      
      // ✅ Manejo robusto de errores de red
      if (!response.ok) {
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
          mensajeGuardado: data.mensaje || `Guardados ${data.estadisticas?.guardados || 0} pedidos exitosamente`
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
        setError(`❌ No se pudo conectar con el servidor backend.\n\nVerifica que:\n• El backend esté funcionando en ${API_BASE_URL}\n• Tengas conexión a internet`);
      }
    } finally {
      setCargando(false);
    }
  };

  const handleReiniciar = () => {
    setArchivo(null);
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
                  onClick={handleGuardarDatos}
                  disabled={cargando || !resultado.procesado || resultado.guardado}
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

      {resultado.procesado && !error && !resultado.guardado && (
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
            <div className="text-2xl font-bold text-yellow-400">
              {estadisticas.columnas_detectadas?.CustomerName ? '✓' : '✗'}
              {estadisticas.columnas_detectadas?.No_SalesLine ? '✓' : '✗'}
              {estadisticas.columnas_detectadas?.Qty_pending ? '✓' : '✗'}
            </div>
            <div className="text-sm text-secondary">Columnas detectadas</div>
          </div>
          <div className="card bg-purple-900/20 border-purple-800/50 p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {archivo?.name?.split('.').pop().toUpperCase()}
            </div>
            <div className="text-sm text-secondary">Formato</div>
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
                  El sistema detecta automáticamente variantes de nombres (ej: "Customer Name", "Qty pending")
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  Los datos se procesan <span className="font-bold text-green-400">directamente en tu navegador</span> (sin enviar el archivo al servidor)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span>
                  Al guardar, solo se envían los <span className="font-bold">datos extraídos</span> al backend para almacenarlos en PostgreSQL
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <span>
                  Backend: <span className="font-mono bg-bg-secondary px-1 rounded">{API_BASE_URL}</span>
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