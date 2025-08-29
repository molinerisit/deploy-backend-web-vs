const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Compra = sequelize.define('Compra', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    fecha:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    nroFactura:{ type: DataTypes.STRING, allowNull: true },
    subtotal:  { type: DataTypes.FLOAT, allowNull: false },
    descuento: { type: DataTypes.FLOAT, defaultValue: 0 },
    recargo:   { type: DataTypes.FLOAT, defaultValue: 0 },
    total:     { type: DataTypes.FLOAT, allowNull: false },
    metodoPago: {
      type: DataTypes.ENUM('Efectivo', 'Transferencia', 'Tarjeta', 'Cuenta Corriente'),
      allowNull: true
    },
    montoAbonado: { type: DataTypes.FLOAT, allowNull: true },
    estadoPago:   { type: DataTypes.ENUM('Pagada', 'Pendiente', 'Parcial'), defaultValue: 'Pendiente' },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'compras',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['fecha'] },
      { fields: ['nroFactura'] },
      { fields: ['estadoPago'] },
      { fields: ['metodoPago'] },

      // sync/operacional
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return Compra;
};
