'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MovimientoCuentaCorriente = sequelize.define('MovimientoCuentaCorriente', {
    id:    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    tipo:  { type: DataTypes.ENUM('DEBITO', 'CREDITO'), allowNull: false },
    monto: { type: DataTypes.FLOAT, allowNull: false },
    concepto:      { type: DataTypes.STRING, allowNull: true },
    saldoAnterior: { type: DataTypes.FLOAT, allowNull: false },
    saldoNuevo:    { type: DataTypes.FLOAT, allowNull: false },

    // FK típica
    ClienteId: { type: DataTypes.UUID, allowNull: true },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'movimientos_cuenta_corriente',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['ClienteId'] },
      { fields: ['fecha'] },
      { fields: ['tipo'] },

      // sync/operacional
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return MovimientoCuentaCorriente;
};
