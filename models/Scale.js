// src/database/models/Scale.js
const { DataTypes } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define("Scale", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    remote_id: { type: DataTypes.STRING, unique: true },
    name: DataTypes.STRING,
    transport: DataTypes.STRING(8), // 'tcp' | 'bt'
    ip: DataTypes.STRING,
    port: DataTypes.INTEGER,
    btAddress: DataTypes.STRING,
    protocol: DataTypes.STRING,
    tenant_id: DataTypes.STRING,
  }, { tableName: "scales" });
