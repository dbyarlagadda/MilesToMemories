require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function seedDatabase() {
    const client = await pool.connect();

    try {
        console.log('Connected to PostgreSQL database');
        console.log('Creating tables...');

        // Create tables
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

        console.log('Tables created successfully');

        // Check if demo user exists
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', ['demo@milestomemories.com']);

        if (existingUser.rows.length === 0) {
            console.log('Creating demo user...');
            const passwordHash = bcrypt.hashSync('demo123', 10);

            const userResult = await client.query(`
                INSERT INTO users (email, password_hash, name, avatar_url)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, ['demo@milestomemories.com', passwordHash, 'Travel Explorer', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop']);

            const userId = userResult.rows[0].id;

            await client.query(`INSERT INTO user_profiles (user_id, bio) VALUES ($1, $2)`,
                [userId, 'Wanderer | Photographer | Storyteller']);

            console.log('Demo user created: demo@milestomemories.com / demo123');

            // Insert demo trips
            console.log('Creating demo trips...');

            const trips = [
                ['Whispers of Ancient Temples', 'Kyoto, Japan', 35.0116, 135.7681, 'November 2024', 'Walking through the vermillion gates of Fushimi Inari at dawn.', 'peaceful', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80', 847],
                ['Lemon Groves & Coastal Dreams', 'Amalfi Coast, Italy', 40.6333, 14.6029, 'September 2024', 'The scent of lemons and sea salt filled every breath.', 'relaxed', 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&q=80', 1203],
                ['Above the Clouds', 'Swiss Alps', 46.8182, 8.2275, 'July 2024', 'At 3,000 meters, the world below disappeared into a sea of clouds.', 'adventurous', 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80', 2156],
                ['Land of Fire and Ice', 'Iceland', 64.9631, -19.0208, 'March 2024', 'Iceland defied every expectation with waterfalls and aurora.', 'adventurous', 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800&q=80', 3421],
                ['Morning Stillness', 'Lake Bled, Slovenia', 46.3625, 14.0936, 'June 2024', 'I woke at 5am to catch the lake in perfect stillness.', 'peaceful', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80', 1567],
                ['Colors of the Medina', 'Marrakech, Morocco', 31.6295, -7.9811, 'April 2024', 'Lost in the maze of the medina, every turn revealed new colors.', 'excited', 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=800&q=80', 982],
                ['Hidden Waterfall', 'Costa Rica', 9.7489, -83.7534, 'February 2024', 'After a 3-hour jungle trek, we found this hidden paradise.', 'adventurous', 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=80', 1834],
                ['Fjord Dreams', 'Norway', 60.4720, 8.4689, 'January 2024', 'Sailing through the Norwegian fjords felt like entering another world.', 'peaceful', 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80', 2891],
                ['Misty Mountains', 'Pacific Northwest, USA', 47.6062, -122.3321, 'December 2023', 'The Pacific Northwest in winter is a study in green and gray.', 'nostalgic', 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80', 1456]
            ];

            for (const trip of trips) {
                await client.query(`
                    INSERT INTO trips (user_id, title, location, latitude, longitude, date, description, mood, image_url, likes_count)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [userId, ...trip]);
            }

            console.log(`Created ${trips.length} demo trips`);

            // Insert demo comments
            console.log('Creating demo comments...');
            await client.query('INSERT INTO comments (trip_id, user_id, content) VALUES (1, $1, $2)', [userId, 'This is absolutely stunning!']);
            await client.query('INSERT INTO comments (trip_id, user_id, content) VALUES (1, $1, $2)', [userId, 'The temples look magical in the mist!']);
            await client.query('INSERT INTO comments (trip_id, user_id, content) VALUES (2, $1, $2)', [userId, 'Italy is always a good idea!']);
            await client.query('INSERT INTO comments (trip_id, user_id, content) VALUES (4, $1, $2)', [userId, 'Did you see the Northern Lights?']);

            console.log('Demo comments created');
        } else {
            console.log('Demo user already exists, skipping seed data');
        }

        console.log('\nDatabase initialization complete!');

    } catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seedDatabase().catch(console.error);
