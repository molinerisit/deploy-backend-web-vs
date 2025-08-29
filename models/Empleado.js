const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Empleado = sequelize.define('Empleado', {
    id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    nombre:  { type: DataTypes.STRING, allowNull: false },
    funcion: { type: DataTypes.STRING, allowNull: true },
    sueldo:  { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'empleados',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['nombre'] },
      { fields: ['funcion'] },

      // sync/operacional
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return Empleado;
};
