const express = require('express');
const router = express.Router();
const database = require('../database-local');
const validacion = require('../services/validacion');
const calculoProduccion = require('../services/calculoProduccion');

// Inicializar base de datos
database.initDatabase().catch(console.error);

// Obtener planes de producción
router.get('/plan', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'id', sortOrder = 'desc' } = req.query;
    const offset = (page - 1) * limit;

    // Consulta base
    let query = `
      SELECT 
        p.id,
        p.customer_name,
        p.no_sales_line,
        p.producto_nombre,
        p.cantidad_pendiente,
        p.stock_disponible_original,
        p.stock_disponible_ajustado,
        p.cantidad_a_producir,
        p.cantidad_planificada,
        p.fecha_inicio,
        p.fecha_fin,
        p.linea_asignada,
        p.maquina_asignada,
        p.generacion,
        p.prioridad,
        p.estado,
        p.estado_finalizado,
        p.observaciones,
        p.tiempo_estimado_min,
        p.oee_aplicado,
        p.es_manual,
        p.unidades_por_caja,
        p.cajas_pendientes,
        p.cajas_a_producir,
        p.cajas_stock_disponible,
        p.created_at,
        p.updated_at
      FROM planes_produccion p
      WHERE 1=1
    `;

    // Parámetros para la consulta
    let params = [];

    // Filtros de búsqueda
    if (search) {
      query += ` AND (
        p.customer_name LIKE ? OR 
        p.no_sales_line LIKE ? OR 
        p.producto_nombre LIKE ? OR
        p.linea_asignada LIKE ? OR
        p.maquina_asignada LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Ordenamiento
    const validSortFields = ['id', 'customer_name', 'no_sales_line', 'producto_nombre', 'cantidad_pendiente', 'fecha_inicio', 'linea_asignada', 'estado', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'id';
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortDirection}`;

    // Paginación
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    // Contar total de registros
    let countQuery = `SELECT COUNT(*) as total FROM planes_produccion p WHERE 1=1`;
    let countParams = [];

    if (search) {
      countQuery += ` AND (
        p.customer_name LIKE ? OR 
        p.no_sales_line LIKE ? OR 
        p.producto_nombre LIKE ? OR
        p.linea_asignada LIKE ? OR
        p.maquina_asignada LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Ejecutar consultas
    const [rows, countResult] = await Promise.all([
      new Promise((resolve, reject) => {
        database.db.all(query, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      }),
      new Promise((resolve, reject) => {
        database.db.get(countQuery, countParams, (err, row) => {
          if (err) return reject(err);
          resolve(row ? row.total : 0);
        });
      })
    ]);

    // Calcular paginación
    const total = countResult;
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: rows,
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

    // Validar datos
    const validacionResult = validacion.validarPlanProduccion(planData);
    if (!validacionResult.isValid) {
      return res.status(400).json({
        success: false,
        error_type: 'VALIDATION_ERROR',
        mensaje: 'Datos de plan de producción inválidos',
        errores: validacionResult.errores
      });
    }

    // Calcular tiempo estimado
    const tiempoEstimado = calculoProduccion.calcularTiempoEstimado(
      planData.cantidad_a_producir,
      planData.generacion,
      planData.linea_asignada,
      planData.oee_aplicado
    );

    // Preparar datos para guardar
    const planParaGuardar = {
      ...planData,
      tiempo_estimado_min: tiempoEstimado,
      updated_at: new Date().toISOString()
    };

    // Si tiene ID, actualizar; si no, crear nuevo
    if (planData.id) {
      // Actualizar plan existente
      const updateQuery = `
        UPDATE planes_produccion 
        SET customer_name = ?, no_sales_line = ?, producto_nombre = ?, 
            cantidad_pendiente = ?, stock_disponible_original = ?, stock_disponible_ajustado = ?,
            cantidad_a_producir = ?, cantidad_planificada = ?, fecha_inicio = ?, fecha_fin = ?,
            linea_asignada = ?, maquina_asignada = ?, generacion = ?, prioridad = ?,
            estado = ?, estado_finalizado = ?, observaciones = ?, tiempo_estimado_min = ?,
            oee_aplicado = ?, es_manual = ?, unidades_por_caja = ?, cajas_pendientes = ?,
            cajas_a_producir = ?, cajas_stock_disponible = ?, updated_at = ?
        WHERE id = ?
      `;

      const params = [
        planParaGuardar.customer_name,
        planParaGuardar.no_sales_line,
        planParaGuardar.producto_nombre,
        planParaGuardar.cantidad_pendiente,
        planParaGuardar.stock_disponible_original,
        planParaGuardar.stock_disponible_ajustado,
        planParaGuardar.cantidad_a_producir,
        planParaGuardar.cantidad_planificada,
        planParaGuardar.fecha_inicio,
        planParaGuardar.fecha_fin,
        planParaGuardar.linea_asignada,
        planParaGuardar.maquina_asignada,
        planParaGuardar.generacion,
        planParaGuardar.prioridad,
        planParaGuardar.estado,
        planParaGuardar.estado_finalizado,
        planParaGuardar.observaciones,
        planParaGuardar.tiempo_estimado_min,
        planParaGuardar.oee_aplicado,
        planParaGuardar.es_manual,
        planParaGuardar.unidades_por_caja,
        planParaGuardar.cajas_pendientes,
        planParaGuardar.cajas_a_producir,
        planParaGuardar.cajas_stock_disponible,
        planParaGuardar.updated_at,
        planData.id
      ];

      await new Promise((resolve, reject) => {
        database.db.run(updateQuery, params, function(err) {
          if (err) return reject(err);
          resolve(this.changes);
        });
      });

      res.json({
        success: true,
        mensaje: 'Plan de producción actualizado exitosamente',
        data: { ...planParaGuardar, id: planData.id }
      });

    } else {
      // Crear nuevo plan
      const insertQuery = `
        INSERT INTO planes_produccion (
          customer_name, no_sales_line, producto_nombre, cantidad_pendiente,
          stock_disponible_original, stock_disponible_ajustado, cantidad_a_producir,
          cantidad_planificada, fecha_inicio, fecha_fin, linea_asignada,
          maquina_asignada, generacion, prioridad, estado, estado_finalizado,
          observaciones, tiempo_estimado_min, oee_aplicado, es_manual,
          unidades_por_caja, cajas_pendientes, cajas_a_producir, cajas_stock_disponible,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        planParaGuardar.customer_name,
        planParaGuardar.no_sales_line,
        planParaGuardar.producto_nombre,
        planParaGuardar.cantidad_pendiente,
        planParaGuardar.stock_disponible_original,
        planParaGuardar.stock_disponible_ajustado,
        planParaGuardar.cantidad_a_producir,
        planParaGuardar.cantidad_planificada,
        planParaGuardar.fecha_inicio,
        planParaGuardar.fecha_fin,
        planParaGuardar.linea_asignada,
        planParaGuardar.maquina_asignada,
        planParaGuardar.generacion,
        planParaGuardar.prioridad,
        planParaGuardar.estado,
        planParaGuardar.estado_finalizado,
        planParaGuardar.observaciones,
        planParaGuardar.tiempo_estimado_min,
        planParaGuardar.oee_aplicado,
        planParaGuardar.es_manual,
        planParaGuardar.unidades_por_caja,
        planParaGuardar.cajas_pendientes,
        planParaGuardar.cajas_a_producir,
        planParaGuardar.cajas_stock_disponible,
        planParaGuardar.created_at || new Date().toISOString(),
        planParaGuardar.updated_at
      ];

      const newId = await new Promise((resolve, reject) => {
        database.db.run(insertQuery, params, function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        });
      });

      res.status(201).json({
        success: true,
        mensaje: 'Plan de producción creado exitosamente',
        data: { ...planParaGuardar, id: newId }
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

    await new Promise((resolve, reject) => {
      database.db.run('DELETE FROM planes_produccion WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        if (this.changes === 0) {
          return reject(new Error('Plan no encontrado'));
        }
        resolve();
      });
    });

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