const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
    // First connect without database to create it if needed
    const adminPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: 'postgres'
    });

    try {
        // Check if database exists
        const dbName = process.env.DB_NAME || 'milestomemories';
        const checkDb = await adminPool.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [dbName]
        );

        if (checkDb.rows.length === 0) {
            console.log(`Creating database: ${dbName}`);
            await adminPool.query(`CREATE DATABASE ${dbName}`);
            console.log('Database created successfully');
        } else {
            console.log(`Database ${dbName} already exists`);
        }

        await adminPool.end();

        // Now connect to our database and run schema
        const pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: dbName,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
        });

        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running database schema...');
        await pool.query(schema);
        console.log('Schema executed successfully');

        await pool.end();
        console.log('Database initialization complete!');

    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

initDatabase();
