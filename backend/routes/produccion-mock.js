const express = require('express');
const router = express.Router();

// Datos en memoria para pruebas
let planesProduccion = [];
let nextId = 1;

// Obtener planes de producción
router.get('/plan', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'id', sortOrder = 'desc' } = req.query;
    const offset = (page - 1) * limit;

    // Filtrar datos
    let filteredData = [...planesProduccion];

    if (search) {
      filteredData = filteredData.filter(p => 
        p.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        p.no_sales_line.toLowerCase().includes(search.toLowerCase()) ||
        p.producto_nombre.toLowerCase().includes(search.toLowerCase()) ||
        p.linea_asignada.toLowerCase().includes(search.toLowerCase()) ||
        p.maquina_asignada.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Ordenar datos
    const validSortFields = ['id', 'customer_name', 'no_sales_line', 'producto_nombre', 'cantidad_pendiente', 'fecha_inicio', 'linea_asignada', 'estado', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'id';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    filteredData.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (aVal < bVal) return -1 * sortDirection;
      if (aVal > bVal) return 1 * sortDirection;
      return 0;
    });

    // Paginación
    const total = filteredData.length;
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    const datosPaginados = filteredData.slice(offset, offset + parseInt(limit));

    res.json({
      success: true,
      data: datosPaginados,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Error en /api/produccion/plan:', error);
    res.status(500).json({
      success: false,
      error_type: 'DATABASE_ERROR',
      mensaje: 'Error al obtener planes de producción',
      detalles: error.message
    });
  }
});

// Crear o actualizar plan de producción
router.post('/plan', async (req, res) => {
  try {
    const planData = req.body;

    // Validar datos básicos
    if (!planData.customer_name || !planData.no_sales_line || !planData.cantidad_a_producir) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'Datos de plan de producción incompletos'
      });
    }

    // Calcular tiempo estimado (mock)
    const tiempoEstimado = Math.ceil(planData.cantidad_a_producir / 100); // Mock: 100 unidades por hora

    // Preparar datos para guardar
    const planParaGuardar = {
      ...planData,
      tiempo_estimado_min: tiempoEstimado * 60, // Convertir a minutos
      updated_at: new Date().toISOString(),
      created_at: planData.id ? undefined : new Date().toISOString()
    };

    // Si tiene ID, actualizar; si no, crear nuevo
    if (planData.id) {
      // Actualizar plan existente
      const index = planesProduccion.findIndex(p => p.id === planData.id);
      if (index === -1) {
        return res.status(404).json({
          success: false,
          error_type: 'NOT_FOUND',
          mensaje: 'Plan de producción no encontrado'
        });
      }

      planesProduccion[index] = { ...planesProduccion[index], ...planParaGuardar };
      res.json({
        success: true,
        mensaje: 'Plan de producción actualizado exitosamente',
        data: planesProduccion[index]
      });

    } else {
      // Crear nuevo plan
      const nuevoPlan = {
        id: nextId++,
        ...planParaGuardar,
        created_at: new Date().toISOString()
      };

      planesProduccion.push(nuevoPlan);

      res.status(201).json({
        success: true,
        mensaje: 'Plan de producción creado exitosamente',
        data: nuevoPlan
      });
    }

  } catch (error) {
    console.error('Error en POST /api/produccion/plan:', error);
    res.status(500).json({
      success: false,
      error_type: 'DATABASE_ERROR',
      mensaje: 'Error al procesar el plan de producción',
      detalles: error.message
    });
  }
});

// Eliminar plan de producción
router.delete('/plan/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const planId = parseInt(id);

    const index = planesProduccion.findIndex(p => p.id === planId);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error_type: 'NOT_FOUND',
        mensaje: 'Plan de producción no encontrado'
      });
    }

    planesProduccion.splice(index, 1);

    res.json({
      success: true,
      mensaje: 'Plan de producción eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en DELETE /api/produccion/plan:', error);
    res.status(500).json({
      success: false,
      error_type: 'DATABASE_ERROR',
      mensaje: 'Error al eliminar el plan de producción',
      detalles: error.message
    });
  }
});

module.exports = router;