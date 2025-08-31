// src/database/models/DevicePreference.js
const { DataTypes } = require("sequelize");
module.exports = (sequelize) =>
  sequelize.define("DevicePreference", {
    device_id: { type: DataTypes.STRING(64), primaryKey: true },
    active_mp_token_remote_id: DataTypes.STRING,  // selección local
    active_pos_external_id: DataTypes.STRING,     // selección local
    active_scale_remote_id: DataTypes.STRING,     // selección local
    selected_printer_name: DataTypes.STRING,      // selección local
    updated_at: DataTypes.DATE,
  }, { tableName: "device_preferences", timestamps: false });
