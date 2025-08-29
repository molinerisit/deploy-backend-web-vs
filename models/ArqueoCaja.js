const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const ArqueoCaja = sequelize.define(
    "ArqueoCaja",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

      fechaApertura: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      montoInicial:  { type: DataTypes.FLOAT, allowNull: false },
      fechaCierre:   { type: DataTypes.DATE, allowNull: true },
      montoFinalEstimado: { type: DataTypes.FLOAT, allowNull: true },
      montoFinalReal:     { type: DataTypes.FLOAT, allowNull: true },
      diferencia:         { type: DataTypes.FLOAT, allowNull: true },

      totalVentasEfectivo: { type: DataTypes.FLOAT, allowNull: true },
      totalVentasDebito:   { type: DataTypes.FLOAT, allowNull: true },
      totalVentasCredito:  { type: DataTypes.FLOAT, allowNull: true },
      totalVentasQR:       { type: DataTypes.FLOAT, allowNull: true },

      observaciones: { type: DataTypes.TEXT, allowNull: true },
      estado: { type: DataTypes.ENUM("ABIERTA", "CERRADA"), defaultValue: "ABIERTA" },

      UsuarioId: { type: DataTypes.UUID, allowNull: false },

      // ---- sync/multi-tenant ----
      cloud_tenant_id: { type: DataTypes.STRING, allowNull: true },
      cloud_id:        { type: DataTypes.STRING, allowNull: true },
      dirty:           { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    {
      tableName: "arqueos_caja",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["UsuarioId"] },
        { fields: ["fechaApertura"] },
        { fields: ["fechaCierre"] },
        { fields: ["estado"] },

        // sync/operacional
        { fields: ["cloud_tenant_id"] },
        { fields: ["updatedAt"] },
        { fields: ["dirty"] },
        { fields: ["deletedAt"] },
      ],
    }
  );

  return ArqueoCaja;
};
