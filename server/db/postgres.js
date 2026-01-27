const { Pool } = require('pg');

// PostgreSQL connection pool for RDS
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
});

const query = async (sql, params = []) => {
    const client = await pool.connect();
    try {
        const result = await client.query(sql, params);
        return result;
    } finally {
        client.release();
    }
};

const initDb = async () => {
    // Create tables if they don't exist
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                avatar_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id),
                bio TEXT,
                location TEXT,
                website TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS social_connections (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                platform TEXT NOT NULL,
                username TEXT NOT NULL,
                access_token TEXT,
                refresh_token TEXT,
                connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, platform)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS trips (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title TEXT NOT NULL,
                location TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                date TEXT,
                description TEXT,
                mood TEXT,
                image_url TEXT,
                likes_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS trip_photos (
                id SERIAL PRIMARY KEY,
                trip_id INTEGER REFERENCES trips(id),
                photo_url TEXT NOT NULL,
                caption TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS trip_likes (
                id SERIAL PRIMARY KEY,
                trip_id INTEGER REFERENCES trips(id),
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(trip_id, user_id)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS trip_saves (
                id SERIAL PRIMARY KEY,
                trip_id INTEGER REFERENCES trips(id),
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(trip_id, user_id)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                trip_id INTEGER REFERENCES trips(id),
                user_id INTEGER REFERENCES users(id),
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        await client.query('CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_trips_location ON trips(location)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_comments_trip_id ON comments(trip_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_trip_likes_trip_id ON trip_likes(trip_id)');

        console.log('PostgreSQL tables initialized');
    } finally {
        client.release();
    }
};

module.exports = { query, initDb, pool };
