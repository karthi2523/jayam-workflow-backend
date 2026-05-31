const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const sslConfig = process.env.DB_SSL === 'true' ? { 
  ca: fs.readFileSync(path.join(__dirname, '../../isrgrootx1.pem')),
  rejectUnauthorized: true 
} : undefined;

const poolConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      ssl: sslConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'workflow_db',
      ssl: sslConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

const pool = mysql.createPool(poolConfig);

module.exports = pool;


