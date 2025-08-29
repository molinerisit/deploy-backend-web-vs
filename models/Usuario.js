// src/database/models/Usuario.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize) => {
  const Usuario = sequelize.define('Usuario', {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    // --- Identidad / login ---
    nombre:           { type: DataTypes.STRING, allowNull: false },   // ya NO unique global
    nombre_canon:     { type: DataTypes.STRING, allowNull: false },   // lower(nombre) p/ unicidad por tenant
    password:         { type: DataTypes.STRING, allowNull: false },
    rol:              { type: DataTypes.STRING, allowNull: false },
    permisos:         { type: DataTypes.JSON },

    // --- Tenancy & Sync ---
    cloud_tenant_id:  { type: DataTypes.STRING, allowNull: true },    // ID de la tienda/empresa en la nube
    cloud_user_id:    { type: DataTypes.STRING, allowNull: true },    // ID del usuario en la nube (para sync)
    sync_enabled:     { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
    sync_api_url:     { type: DataTypes.STRING },
    license_key:      { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    subscription_status: { type: DataTypes.JSON },

    // --- Configs varias (como tenías) ---
    config_puerto_scanner:   { type: DataTypes.STRING },
    config_puerto_impresora: { type: DataTypes.STRING },
    mp_access_token:         { type: DataTypes.STRING },
    mp_pos_id:               { type: DataTypes.STRING },
    mp_user_id:              { type: DataTypes.STRING },
    config_balanza:          { type: DataTypes.JSON },
    config_balanza_conexion: { type: DataTypes.JSON },
    config_recargo_credito:  { type: DataTypes.FLOAT, defaultValue: 0 },
    nombre_negocio:          { type: DataTypes.STRING },
    slogan_negocio:          { type: DataTypes.STRING },
    footer_ticket:           { type: DataTypes.STRING },
    logo_url:                { type: DataTypes.STRING },
    config_descuento_efectivo: { type: DataTypes.FLOAT, defaultValue: 0 },
    facturacion_activa:      { type: DataTypes.BOOLEAN, defaultValue: false },
    config_arqueo_caja:      { type: DataTypes.JSON },

    // AFIP
    afip_cuit:     { type: DataTypes.STRING },
    afip_pto_vta:  { type: DataTypes.INTEGER },
    afip_cert_path:{ type: DataTypes.STRING },
    afip_key_path: { type: DataTypes.STRING },
  }, {
    tableName: 'Usuario',
    timestamps: true,
    paranoid: true,
    defaultScope: {
      attributes: { exclude: ['password'] }
    },
    scopes: {
      withPassword: { attributes: {} }
    },
    indexes: [
      // Unicidad de usuario por tenant y case-insensitive
      { unique: true, fields: ['cloud_tenant_id', 'nombre_canon'] },
      { fields: ['rol'] },
      { fields: ['cloud_user_id'] },
      { fields: ['sync_enabled'] },
      { fields: ['license_key'] },
      { fields: ['updatedAt'] },
      { fields: ['deletedAt'] },
    ]
  });

  // Normalizar nombre antes de validar/guardar
  Usuario.addHook('beforeValidate', (user) => {
    if (user.nombre) {
      user.nombre = String(user.nombre).trim();
      user.nombre_canon = user.nombre.toLowerCase();
    }
  });

  // Método de instancia para validar password
  Usuario.prototype.validPassword = async function (plain) {
    return bcrypt.compare(plain, this.password);
  };

  return Usuario;
};
