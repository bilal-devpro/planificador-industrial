const handleGuardarDatos = async () => {
  if (!datosMostrados || datosMostrados.length === 0) {
    setError('⚠️ No hay datos para guardar');
    return;
  }

  setCargando(true);

  try {
    // Obtener usuario actual (puedes implementar autenticación después)
    const usuario = localStorage.getItem('usuario') || 'system';
    
    const response = await fetch('http://localhost:3000/api/alupak/guardar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pedidos: datosMostrados,
        usuario: usuario,
        nombreArchivo: archivo?.name || 'alupak_pedidos.xlsx'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al guardar los datos');
    }

    const data = await response.json();

    if (data.success) {
      setResultado(prev => ({
        ...prev,
        guardado: true,
        mensajeGuardado: data.mensaje
      }));

      // Mostrar mensaje de éxito
      setTimeout(() => {
        alert(`✅ ${data.mensaje}\nGuardados: ${data.guardados}\nErrores: ${data.errores}`);
      }, 100);
      
      // Recargar datos en otras páginas
      window.dispatchEvent(new Event('datosActualizados'));
    }

  } catch (error) {
    console.error('Error guardando datos:', error);
    setError(`❌ Error al guardar los datos: ${error.message}`);
  } finally {
    setCargando(false);
  }
};