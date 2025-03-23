require('dotenv').config();

module.exports = {
  VG_WEBHOOK_URL: process.env.VG_WEBHOOK_URL,
  VG_AUTH_TOKEN: process.env.VG_AUTH_TOKEN,
  MIDDLEWARE_SERVER_PORT: process.env.MIDDLEWARE_SERVER_PORT || 3000,
};