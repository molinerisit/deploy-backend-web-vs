// src/database/models/MpToken.js
const { DataTypes } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define("MpToken", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    remote_id: { type: DataTypes.STRING, unique: true }, // id lógico (server)
    alias: DataTypes.STRING,
    access_token: DataTypes.TEXT, // podés cifrarlo antes de guardar si querés
    tenant_id: DataTypes.STRING,
  }, { tableName: "mp_tokens" });
