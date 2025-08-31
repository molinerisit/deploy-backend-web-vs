// src/database/models/Device.js
const { DataTypes } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define("Device", {
    device_id: { type: DataTypes.STRING(64), primaryKey: true },
    hostname: DataTypes.STRING,
    platform: DataTypes.STRING(32),
    arch: DataTypes.STRING(16),
    app_version: DataTypes.STRING(32),
    last_seen_at: DataTypes.DATE,
  }, { tableName: "devices" });
