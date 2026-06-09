import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 5000
    });
    console.log('Successfully connected to DB from localhost!');
    await conn.end();
  } catch (error) {
    console.error('Failed to connect from localhost:', error.message);
  }
}

testConnection();
