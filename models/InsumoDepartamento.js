const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InsumoDepartamento = sequelize.define('InsumoDepartamento', {
    id:     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nombre: { type: DataTypes.STRING, allowNull: false, unique: true },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'insumo_departamentos',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['nombre'] },

      // sync/operacional
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return InsumoDepartamento;
};
