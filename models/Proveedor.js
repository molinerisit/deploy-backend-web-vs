const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Proveedor = sequelize.define('Proveedor', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    nombreEmpresa:    { type: DataTypes.STRING, allowNull: false, unique: true },
    nombreRepartidor: { type: DataTypes.STRING },

    tipo: { type: DataTypes.ENUM('producto', 'insumos', 'ambos'), allowNull: false, defaultValue: 'producto' },

    telefono: { type: DataTypes.STRING },

    diasReparto:  { type: DataTypes.STRING },
    limitePedido: { type: DataTypes.STRING },

    deuda: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING },
    cloud_id:        { type: DataTypes.STRING },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'proveedores',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['nombreEmpresa'] },
      { fields: ['tipo'] },
      { fields: ['deuda'] },
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return Proveedor;
};
