module.exports = (sequelize) => {
  const { DataTypes } = require('sequelize');
  const ProductoProveedor = sequelize.define('ProductoProveedor', {
    // sin PK propia: usá compuesta
  }, {
    tableName: 'producto_proveedor',
    timestamps: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['ProductoId', 'ProveedorId'] },
      { fields: ['ProveedorId'] },
      { fields: ['ProductoId'] },
      { fields: ['updatedAt'] },
      { fields: ['deletedAt'] },
    ]
  });
  return ProductoProveedor;
};
