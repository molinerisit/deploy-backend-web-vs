const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductoFamilia = sequelize.define('ProductoFamilia', {
    id:     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nombre: { type: DataTypes.STRING, allowNull: false },

    // FK agregada por asociación: DepartamentoId

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING },
    cloud_id:        { type: DataTypes.STRING },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'ProductoFamilia',  // <— explícito
    freezeTableName: true,  
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['DepartamentoId'] },
      { unique: true, fields: ['DepartamentoId', 'nombre'] },
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return ProductoFamilia;
};
