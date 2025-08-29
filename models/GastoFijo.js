const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GastoFijo = sequelize.define('GastoFijo', {
    id:     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    nombre: { type: DataTypes.STRING, allowNull: false, unique: true },
    monto:  { type: DataTypes.FLOAT,  allowNull: false, defaultValue: 0 },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'gastos_fijos',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['nombre'] }, // ya es unique, pero explícito

      // sync/operacional
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return GastoFijo;
};
