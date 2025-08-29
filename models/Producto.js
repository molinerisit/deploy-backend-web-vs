// src/database/models/Producto.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Producto = sequelize.define('Producto', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    nombre: { type: DataTypes.STRING, allowNull: false, unique: true },
    stock:  { type: DataTypes.FLOAT, defaultValue: 0 },
    unidad: { type: DataTypes.STRING, defaultValue: 'unidad' },

    precioCompra: { type: DataTypes.FLOAT, defaultValue: 0 },
    precioVenta:  { type: DataTypes.FLOAT, defaultValue: 0 },

    codigo_barras: { type: DataTypes.STRING, unique: true },
    imagen_url:    { type: DataTypes.STRING },

    precio_oferta:     { type: DataTypes.FLOAT },
    fecha_fin_oferta:  { type: DataTypes.DATEONLY },
    fecha_vencimiento: { type: DataTypes.DATEONLY, allowNull: true },

    activo:   { type: DataTypes.BOOLEAN, defaultValue: true },
    pesable:  { type: DataTypes.BOOLEAN, defaultValue: false },     // <- NUEVO
    plu:      { type: DataTypes.STRING, allowNull: true, unique: true }, // <- NUEVO (unique si no null)

    DepartamentoId: { type: DataTypes.UUID, allowNull: true },
    FamiliaId:      { type: DataTypes.UUID, allowNull: true },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'productos',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ['nombre'] },
      { fields: ['codigo_barras'] },
      { fields: ['plu'] },                 // <- NUEVO índice (además de unique)
      { fields: ['activo'] },
      { fields: ['DepartamentoId'] },
      { fields: ['FamiliaId'] },
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return Producto;
};
