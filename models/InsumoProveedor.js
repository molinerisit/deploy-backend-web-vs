module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  const InsumoProveedor = sequelize.define('InsumoProveedor', {
  }, {
    tableName: 'insumo_proveedor',
    timestamps: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['InsumoId', 'ProveedorId'] },
      { fields: ['ProveedorId'] },
      { fields: ['InsumoId'] },
      { fields: ['updatedAt'] },
      { fields: ['deletedAt'] },
    ]
  });
  return InsumoProveedor;
};
