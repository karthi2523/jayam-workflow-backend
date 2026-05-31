const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const fs = require('fs');
const path = require('path');

async function initDb() {
  console.log('Initializing MySQL database...');
  
  try {
    const sslConfig = process.env.DB_SSL === 'true' ? { 
      ca: fs.readFileSync(path.join(__dirname, '../../isrgrootx1.pem')),
      rejectUnauthorized: true 
    } : undefined;

    let connectionConfig;
    if (process.env.DATABASE_URL) {
      connectionConfig = {
        uri: process.env.DATABASE_URL,
        ssl: sslConfig
      };
    } else {
      connectionConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        ssl: sslConfig
      };
    }

    const connection = await mysql.createConnection(connectionConfig);

    if (!process.env.DATABASE_URL) {
      const dbName = process.env.DB_NAME || 'workflow_db';
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await connection.query(`USE \`${dbName}\``);
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('User', 'Manager', 'Admin') NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        priority ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL,
        status ENUM('Submitted', 'Approved', 'Rejected', 'Needs Clarification', 'Closed', 'Reopened') DEFAULT 'Submitted',
        user_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        old_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        changed_by INT NOT NULL,
        role VARCHAR(20) NOT NULL,
        comment TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES requests (id),
        FOREIGN KEY (changed_by) REFERENCES users (id)
      )
    `);

    const [rows] = await connection.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      console.log('Seeding demo users...');
      
      const hashedPassword = bcrypt.hashSync('Demo@123', 10);
      
      await connection.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Demo User', 'user@demo.com', hashedPassword, 'User']
      );
      await connection.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Demo Manager', 'manager@demo.com', hashedPassword, 'Manager']
      );
      await connection.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Demo Admin', 'admin@demo.com', hashedPassword, 'Admin']
      );
      
      console.log('Users seeded.');
    } else {
      console.log('Users already exist, skipping seed.');
    }

    console.log('Database initialization complete.');
    await connection.end();
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

module.exports = initDb;
