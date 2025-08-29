const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductoDepartamento = sequelize.define('ProductoDepartamento', {
    id:     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nombre: { type: DataTypes.STRING, allowNull: false, unique: true },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING },
    cloud_id:        { type: DataTypes.STRING },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'ProductoDepartamento',  // <— explícito
    freezeTableName: true,  
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['nombre'] },
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return ProductoDepartamento;
};
