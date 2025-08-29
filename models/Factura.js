const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Factura = sequelize.define('Factura', {
    id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    cae:      { type: DataTypes.STRING, allowNull: false },
    caeVto:   { type: DataTypes.DATEONLY, allowNull: false },
    tipoComp: { type: DataTypes.INTEGER, allowNull: false },
    ptoVta:   { type: DataTypes.INTEGER, allowNull: false },
    nroComp:  { type: DataTypes.INTEGER, allowNull: false },
    docTipo:  { type: DataTypes.INTEGER },
    docNro:   { type: DataTypes.STRING },
    impTotal: { type: DataTypes.FLOAT, allowNull: false },

    // ---- sync/multi-tenant ----
    cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
    cloud_id:        { type: DataTypes.STRING, allowNull: true },
    dirty:           { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'facturas',
    timestamps: true,
    paranoid: true,
    indexes: [
      // búsqueda/orden habitual
      { fields: ['caeVto'] },
      { fields: ['docNro'] },

      // Único por tipo+pto+numero (evita duplicates)
      { unique: true, fields: ['tipoComp', 'ptoVta', 'nroComp'] },

      // sync/operacional
      { fields: ['cloud_tenant_id'] },
      { fields: ['updatedAt'] },
      { fields: ['dirty'] },
      { fields: ['deletedAt'] },
    ]
  });

  return Factura;
};
