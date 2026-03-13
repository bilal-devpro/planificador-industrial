import React, { useState } from 'react';
import {
    Upload,
    FileText,
    CheckCircle,
    AlertTriangle,
    XCircle,
    RefreshCw,
    Eye,
    Table,
    AlertCircle,
    Package,
    MapPin,
    Hash,
    Scale
} from 'lucide-react';

const ImportarInventario = () => {
    const [archivo, setArchivo] = useState(null);
    const [cargando, setCargando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [error, setError] = useState(null);
    const [datosMostrados, setDatosMostrados] = useState([]);
    const [mostrarColumnas, setMostrarColumnas] = useState(false);
    const [backendOnline, setBackendOnline] = useState(true);

    // 🔥 URL del backend
    const API = import.meta.env.VITE_API_URL;

    React.useEffect(() => {
        verificarBackend();
    }, []);

    const verificarBackend = async () => {
        try {
            const response = await fetch(`${API}/api/health`, { method: 'GET' });

            if (response.ok) {
                setBackendOnline(true);
            } else {
                setBackendOnline(false);
                setError('⚠️ El servidor backend no está respondiendo.');
            }
        } catch (error) {
            setBackendOnline(false);
            setError(`⚠️ No se puede conectar con el backend en ${API}`);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setArchivo(file);
            setResultado(null);
            setError(null);
            setDatosMostrados([]);
            setMostrarColumnas(false);
        }
    };

    const handleUpload = async () => {
        if (!archivo) return;
        if (!backendOnline) {
            setError('⚠️ El servidor backend no está disponible.');
            return;
        }

        setCargando(true);
        setError(null);

        const formData = new FormData();
        formData.append('archivo', archivo);

        try {
            const response = await fetch(`${API}/api/inventario/importar`, {
                method: 'POST',
                body: formData
            });

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error('El servidor devolvió HTML en lugar de JSON.');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `Error HTTP ${response.status}` }));
                throw new Error(errorData.error || `Error HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                const cleanedInventario = (data.inventario || []).filter(
                    item => Number(item.qty_base) > 0
                );
                const filasFiltradas = (data.inventario?.length || 0) - cleanedInventario.length;

                const updatedResultado = {
                    ...data,
                    estadisticas: {
                        ...data.estadisticas,
                        registros_extraidos: cleanedInventario.length,
                        filas_filtradas: filasFiltradas,
                    cantidad_total: cleanedInventario.reduce((sum, item) => sum + Number(item.qty_base), 0)
                    }
                };

                setResultado(updatedResultado);
                setDatosMostrados(cleanedInventario);
            } else {
                throw new Error(data.error || 'Error desconocido en la respuesta');
            }

        } catch (error) {
            console.error('❌ Error al procesar:', error);

            let mensajeError = error.message;

            if (error.message.includes('Failed to fetch')) {
                mensajeError = `No se puede conectar con el backend en ${API}`;
            }

            setError(`❌ ${mensajeError}`);
        } finally {
            setCargando(false);
        }
    };

    const handleGuardarDatos = async () => {
        if (!datosMostrados || datosMostrados.length === 0) {
            setError('⚠️ No hay datos para guardar');
            return;
        }

        setCargando(true);
        setError(null);

        try {
            const response = await fetch(`${API}/api/inventario/guardar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inventario: datosMostrados,
                    nombreArchivo: archivo?.name || 'inventario_fisico.xlsx'
                })
            });

            let data;
            try {
                data = await response.json();
            } catch {
                throw new Error(`Error del servidor (${response.status}): ${response.statusText}`);
            }

            if (!response.ok) {
                const mensajeError = data.detalle || data.error || `Error ${response.status}: ${response.statusText}`;
                throw new Error(mensajeError);
            }

            if (data.success) {
                setResultado(prev => ({
                    ...prev,
                    guardado: true,
                    mensajeGuardado: data.message
                }));

                setTimeout(() => {
                    alert('✅ Datos guardados correctamente en la base de datos');
                }, 100);
            }

        } catch (error) {
            console.error('❌ Error guardando inventario:', error);
            setError(`❌ Error al guardar: ${error.message || 'Error desconocido'}`);
        } finally {
            setCargando(false);
        }
    };

    const handleClear = () => {
        setArchivo(null);
        setResultado(null);
        setError(null);
        setDatosMostrados([]);
        setMostrarColumnas(false);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1>📦 Importar Inventario Físico</h1>
                <p className="text-secondary">
                    Sube el archivo Excel "Lista del inventario físico" para extraer los datos de stock
                </p>
            </div>

            {/* Estado del Backend */}
            {!backendOnline && (
                <div className="alert alert-error">
                    <AlertCircle size={20} />
                    <div className="flex-1">
                        <strong>⚠️ Backend No Disponible</strong>
                        <p className="text-sm mt-1">
                            El servidor backend no está respondiendo. Por favor, ejecuta <code className="bg-gray-700 px-2 py-1 rounded">npm start</code> en la carpeta backend.
                        </p>
                    </div>
                    <button
                        onClick={verificarBackend}
                        className="btn btn-secondary btn-sm"
                    >
                        <RefreshCw size={16} />
                        Reintentar
                    </button>
                </div>
            )}

            {/* Instrucciones */}
            <div className="card">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                    <Eye size={20} />
                    Información Importante
                </h3>
                <div className="space-y-3">
                    <div className="bg-green-900/30 border border-green-800 rounded-lg p-4">
                        <h4 className="font-bold text-green-400 mb-2">Columnas que Extraemos:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            <li><strong>ItemNo_ItemJournalLine</strong> - Número/Referencia del artículo</li>
                            <li><strong>BinCode_ItemJournalLine</strong> - Código de ubicación/bin</li>
                            <li><strong>ReservEntryBufferLotNo</strong> - Número de lote/serie</li>
                            <li><strong>ReservEntryBufferQtyBase</strong> - Cantidad base</li>
                        </ul>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4">
                        <h4 className="font-bold mb-2">¿Qué hacemos con tu Excel?</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-secondary">
                            <li>✅ Leemos el archivo Excel</li>
                            <li>✅ Buscamos automáticamente las columnas que necesitamos</li>
                            <li>✅ <strong>Ignoramos todas las demás columnas</strong></li>
                            <li>✅ Mostramos solo los datos relevantes en pantalla</li>
                            <li>✅ <strong>No guardamos nada en la base de datos</strong></li>
                            <li>✅ Puedes subir un nuevo archivo mañana para actualizar</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Área de subida */}
            <div className="card">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Arrastrar y soltar */}
                    <div className="flex-1">
                        <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                                <Upload className="w-16 h-16 mx-auto mb-4 text-green-400" />
                                <p className="text-gray-300 mb-2">
                                    {archivo ? (
                                        <span className="text-green-400 flex items-center justify-center gap-2">
                                            <CheckCircle size={20} />
                                            {archivo.name}
                                        </span>
                                    ) : (
                                        <>
                                            <strong>Arrastra tu archivo Excel aquí</strong>
                                            <br />
                                            <span className="text-sm text-gray-500">o haz clic para buscar</span>
                                        </>
                                    )}
                                </p>
                            </label>
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex flex-col gap-4 justify-center">
                        {archivo && !resultado && (
                            <button
                                onClick={handleUpload}
                                disabled={cargando}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {cargando ? (
                                    <>
                                        <div className="loading"></div>
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <Package size={20} />
                                        Extraer Datos
                                    </>
                                )}
                            </button>
                        )}

                        {resultado && !resultado.guardado && (
                            <button
                                onClick={handleGuardarDatos}
                                disabled={cargando}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {cargando ? (
                                    <>
                                        <div className="loading"></div>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={20} />
                                        Guardar Datos en BD
                                    </>
                                )}
                            </button>
                        )}

                        {resultado && resultado.guardado && (
                            <div className="w-full bg-green-900/30 border border-green-800 text-green-400 font-bold py-3 px-6 rounded-lg text-center">
                                <CheckCircle size={18} className="inline mr-2" />
                                {resultado.mensajeGuardado}
                            </div>
                        )}

                        <button
                            onClick={handleClear}
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
                        >
                            <XCircle size={18} />
                            {resultado ? 'Cargar Nuevo Archivo' : 'Limpiar'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mensaje de error */}
            {error && (
                <div className="alert alert-error">
                    <AlertTriangle size={20} />
                    <div className="flex-1">
                        <strong>Error al procesar el archivo</strong>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                    <button
                        onClick={() => setError(null)}
                        className="text-red-400 hover:text-red-300"
                    >
                        <XCircle size={18} />
                    </button>
                </div>
            )}

            {/* Resultados */}
            {resultado && (
                <div className="space-y-6">
                    {/* Resumen */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">📊 Resumen de Extracción</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-green-900/30 border border-green-800 rounded-lg p-4">
                                <div className="flex items-center mb-2">
                                    <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                                    <span className="text-green-400 font-bold">Registros Extraídos</span>
                                </div>
                                <p className="text-3xl font-bold text-green-400">
                                    {resultado.estadisticas.registros_extraidos}
                                </p>
                            </div>

                            <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4">
                                <div className="flex items-center mb-2">
                                    <FileText className="w-5 h-5 text-blue-400 mr-2" />
                                    <span className="text-blue-400 font-bold">Total Filas</span>
                                </div>
                                <p className="text-3xl font-bold text-blue-400">
                                    {resultado.estadisticas.total_filas}
                                </p>
                            </div>

                            <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-4">
                                <div className="flex items-center mb-2">
                                    <Scale className="w-5 h-5 text-yellow-400 mr-2" />
                                    <span className="text-yellow-400 font-bold">Cantidad Total</span>
                                </div>
                                <p className="text-3xl font-bold text-yellow-400">
                                    {resultado.estadisticas.cantidad_total?.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                </p>
                            </div>

                            <div className="bg-purple-900/30 border border-purple-800 rounded-lg p-4">
                                <div className="flex items-center mb-2">
                                    <Table className="w-5 h-5 text-purple-400 mr-2" />
                                    <span className="text-purple-400 font-bold">Columnas Detectadas</span>
                                </div>
                                <button
                                    onClick={() => setMostrarColumnas(!mostrarColumnas)}
                                    className="text-sm text-purple-300 hover:text-purple-200 underline"
                                >
                                    {mostrarColumnas ? 'Ocultar detalles' : 'Ver detalles'}
                                </button>
                            </div>
                        </div>

                        {/* Información de filas filtradas */}
                        {resultado?.estadisticas?.filas_filtradas > 0 && (
                            <div className="alert alert-warning">
                                <AlertTriangle size={20} />
                                <div>
                                    <strong>ℹ️ Datos filtrados</strong>
                                    <p className="text-sm mt-1">
                                        Se omitieron {resultado.estadisticas.filas_filtradas} filas con cantidad = 0.00 para mostrar solo registros con stock.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 alert alert-success">
                            <CheckCircle size={20} />
                            <div>
                                <strong>✓ Extracción completada correctamente</strong>
                                <p className="text-sm mt-1">
                                    Se han extraído {resultado.estadisticas.registros_extraidos} registros del inventario físico con stock disponible.
                                </p>
                            </div>
                        </div>

                        {mostrarColumnas && (
                            <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                                <h4 className="font-bold mb-3">🔍 Columnas Identificadas:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-sm text-secondary mb-1">ItemNo_ItemJournalLine:</div>
                                        <div className={`font-mono ${resultado.estadisticas.columnas_detectadas.ItemNo_ItemJournalLine ? 'text-green-400' : 'text-red-400'}`}>
                                            {resultado.estadisticas.columnas_detectadas.ItemNo_ItemJournalLine || '✗ No encontrada'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-secondary mb-1">BinCode_ItemJournalLine:</div>
                                        <div className={`font-mono ${resultado.estadisticas.columnas_detectadas.BinCode_ItemJournalLine ? 'text-green-400' : 'text-red-400'}`}>
                                            {resultado.estadisticas.columnas_detectadas.BinCode_ItemJournalLine || '✗ No encontrada'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-secondary mb-1">ReservEntryBufferLotNo:</div>
                                        <div className={`font-mono ${resultado.estadisticas.columnas_detectadas.ReservEntryBufferLotNo ? 'text-green-400' : 'text-red-400'}`}>
                                            {resultado.estadisticas.columnas_detectadas.ReservEntryBufferLotNo || '✗ No encontrada'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-secondary mb-1">ReservEntryBufferQtyBase:</div>
                                        <div className={`font-mono ${resultado.estadisticas.columnas_detectadas.ReservEntryBufferQtyBase ? 'text-green-400' : 'text-red-400'}`}>
                                            {resultado.estadisticas.columnas_detectadas.ReservEntryBufferQtyBase || '✗ No encontrada'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 alert alert-success">
                            <CheckCircle size={20} />
                            <div>
                                <strong>✓ Extracción completada correctamente</strong>
                                <p className="text-sm mt-1">
                                    Se han extraído {resultado.estadisticas.registros_extraidos} registros del inventario físico.
                                    Todas las demás columnas han sido ignoradas.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de datos */}
                    {datosMostrados.length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">📋 Datos del Inventario Físico</div>
                                <div className="text-sm text-secondary">
                                    Mostrando {datosMostrados.length} registros con la información relevante
                                </div>
                            </div>

                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Fila</th>
                                            <th>ItemNo</th>
                                            <th>BinCode</th>
                                            <th>Lote/Serie</th>
                                            <th>Cantidad</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {datosMostrados.map((registro, index) => (
                                            <tr key={index}>
                                                <td className="font-medium text-sm text-gray-400">{registro.fila}</td>
                                                <td className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Package className="w-4 h-4 text-green-400" />
                                                        {registro.ItemNo_ItemJournalLine}
                                                    </div>
                                                </td>
                                                <td className="font-mono bg-gray-800/50 px-2 py-1 rounded">
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-yellow-400" />
                                                        {registro.BinCode_ItemJournalLine}
                                                    </div>
                                                </td>
                                                <td className="font-mono">
                                                    {registro.ReservEntryBufferLotNo || '-'}
                                                </td>
                                                <td className="text-right font-bold text-lg text-green-400">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Scale className="w-4 h-4" />
                                                        {registro.ReservEntryBufferQtyBase.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <Eye className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm">
                                        <strong className="text-green-400">Información:</strong>
                                        <p className="mt-1">
                                            Estos datos se muestran en pantalla pero <strong>NO se guardan en la base de datos</strong>.
                                            Mañana puedes subir un nuevo archivo Excel para actualizar esta información.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleClear}
                            className="btn btn-secondary"
                        >
                            <RefreshCw size={18} />
                            Cargar Nuevo Archivo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImportarInventario;