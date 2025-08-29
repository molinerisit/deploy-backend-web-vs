const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DetalleCompra = sequelize.define('DetalleCompra', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    cantidad:       { type: DataTypes.FLOAT, allowNull: false },
    precioUnitario: { type: DataTypes.FLOAT, allowNull: false },
    subtotal:       { type: DataTypes.FLOAT, allowNull: false },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'detalle_compras',
    timestamps: true,
    paranoid: true,
    indexes: [
      // FKs agregadas por asociaciones:
      { fields: ['CompraId'] },
      { fields: ['ProductoId'] },

      // sync/operacional
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return DetalleCompra;
};
