const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const InsumoFamilia = sequelize.define('InsumoFamilia', {
    id:     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    nombre: { type: DataTypes.STRING, allowNull: false },

    InsumoDepartamentoId: { type: DataTypes.UUID, allowNull: false },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'insumo_familias',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['InsumoDepartamentoId'] },
      { unique: true, fields: ['InsumoDepartamentoId', 'nombre'] },

      // sync/operacional
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return InsumoFamilia;
};
