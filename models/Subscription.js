module.exports = (sequelize) => {
  const { DataTypes } = require("sequelize");

  const Subscription = sequelize.define("Subscription", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    license_key: { type: DataTypes.STRING, allowNull: false },

    plan:   { type: DataTypes.STRING },
    status: { type: DataTypes.STRING, defaultValue: "inactive" },
    expires_at: { type: DataTypes.DATE },
    days_left:  { type: DataTypes.INTEGER, defaultValue: 0 },
    features:   { type: DataTypes.JSON, defaultValue: {} },

    last_checked_at: { type: DataTypes.DATE },
    last_sync_at:    { type: DataTypes.DATE },

    cloud_tenant_id: { type: DataTypes.STRING },

    mp_preapproval_id: { type: DataTypes.STRING }
  }, {
    tableName: 'subscriptions',
    timestamps: true,
    paranoid: true,
    indexes: [
      { fields: ["license_key"] },
      { fields: ["cloud_tenant_id"] },
      { fields: ["status"] },
      { fields: ['updatedAt'] },
      { fields: ['deletedAt'] },
    ]
  });

  return Subscription;
};
