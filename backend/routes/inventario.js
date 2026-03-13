router.get('/ultimos', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT 
        id,
        customer_name,
        no_sales_line,
        qty_pending,
        archivo_original,
        usuario_carga,
        fecha_importacion
      FROM alupak_pedidos
      ORDER BY fecha_importacion DESC
      LIMIT 200
    `);

    res.json({
      success: true,
      pedidos: resultado.rows
    });

  } catch (error) {
    console.error("❌ Error obteniendo últimos pedidos ALUPAK:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
