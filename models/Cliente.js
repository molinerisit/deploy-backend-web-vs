const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Cliente = sequelize.define(
    "Cliente",
    {
      id:  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

      dni:      { type: DataTypes.STRING, allowNull: false, unique: true },
      nombre:   { type: DataTypes.STRING },
      apellido: { type: DataTypes.STRING, allowNull: true },
      descuento:{ type: DataTypes.FLOAT, defaultValue: 0 },
      deuda:    { type: DataTypes.FLOAT, defaultValue: 0 },

      // ---- sync/multi-tenant ----
      cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
      cloud_id:        { type: DataTypes.STRING, allowNull: true },
      dirty:           { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    {
      tableName: "clientes",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["dni"] },                 // ya es unique, pero explícito
        { fields: ["nombre"] },
        { fields: ["apellido"] },
        { fields: ["deuda"] },

        // sync/operacional
        { fields: ["cloud_tenant_id"] },
        { fields: ["updatedAt"] },
        { fields: ["dirty"] },
        { fields: ["deletedAt"] },
      ],
    }
  );

  return Cliente;
};
