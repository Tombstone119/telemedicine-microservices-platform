const { Pool } = require('pg');
const env = require('../config/env');

const pool = env.db.databaseUrl
  ? new Pool({
      connectionString: env.db.databaseUrl,
      ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
      max: env.db.poolMax,
      idleTimeoutMillis: env.db.idleTimeoutMs,
      connectionTimeoutMillis: env.db.connectionTimeoutMs,
    })
  : new Pool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
      max: env.db.poolMax,
      idleTimeoutMillis: env.db.idleTimeoutMs,
      connectionTimeoutMillis: env.db.connectionTimeoutMs,
    });

module.exports = { pool };
