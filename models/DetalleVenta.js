const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DetalleVenta = sequelize.define('DetalleVenta', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    nombreProducto: { type: DataTypes.STRING, allowNull: false },
    cantidad:       { type: DataTypes.FLOAT, allowNull: false },
    precioUnitario: { type: DataTypes.FLOAT, allowNull: false },
    subtotal:       { type: DataTypes.FLOAT, allowNull: false },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'detalles_venta',
    timestamps: true,
    paranoid: true,
    indexes: [
      // FKs agregadas por asociaciones:
      { fields: ['VentaId'] },
      { fields: ['ProductoId'] },

      // búsquedas por nombre producto (si hacés LIKE):
      { fields: ['nombreProducto'] },

      // sync/operacional
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return DetalleVenta;
};
