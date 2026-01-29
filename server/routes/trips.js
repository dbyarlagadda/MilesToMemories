const express = require('express');
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all trips
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { location, year, limit = 20, offset = 0 } = req.query;

        let query = `
            SELECT t.*, u.name as author_name, u.avatar_url as author_avatar,
                   (SELECT COUNT(*) FROM trip_likes WHERE trip_id = t.id) as likes_count
            FROM trips t
            JOIN users u ON t.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (location) {
            paramCount++;
            query += ` AND t.location ILIKE $${paramCount}`;
            params.push(`%${location}%`);
        }

        if (year) {
            paramCount++;
            query += ` AND t.date ILIKE $${paramCount}`;
            params.push(`%${year}%`);
        }

        query += ` ORDER BY t.created_at DESC`;

        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(parseInt(offset));

        const result = await db.query(query, params);

        // If user is logged in, check if they liked/saved each trip
        if (req.user) {
            for (let trip of result.rows) {
                const likeCheck = await db.query(
                    'SELECT 1 FROM trip_likes WHERE trip_id = $1 AND user_id = $2',
                    [trip.id, req.user.id]
                );
                trip.liked = likeCheck.rows.length > 0;

                const saveCheck = await db.query(
                    'SELECT 1 FROM trip_saves WHERE trip_id = $1 AND user_id = $2',
                    [trip.id, req.user.id]
                );
                trip.saved = saveCheck.rows.length > 0;
            }
        }

        res.json(result.rows);

    } catch (error) {
        console.error('Get trips error:', error);
        res.status(500).json({ error: 'Failed to get trips' });
    }
});

// Get featured trips (must be before /:id)
router.get('/featured', optionalAuth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT t.*, u.name as author_name, u.avatar_url as author_avatar,
                    (SELECT COUNT(*) FROM trip_likes WHERE trip_id = t.id) as likes_count
             FROM trips t
             JOIN users u ON t.user_id = u.id
             WHERE t.is_public = true OR t.is_public IS NULL
             ORDER BY likes_count DESC, t.created_at DESC
             LIMIT 5`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get featured trips error:', error);
        res.status(500).json({ error: 'Failed to get featured trips' });
    }
});

// Get "On This Day" memories (must be before /:id)
router.get('/on-this-day', authenticateToken, async (req, res) => {
    try {
        const today = new Date();
        const month = today.toLocaleString('en-US', { month: 'long' });

        const result = await db.query(
            `SELECT t.*,
                    EXTRACT(YEAR FROM t.created_at) as trip_year,
                    EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM t.created_at) as years_ago
             FROM trips t
             WHERE t.user_id = $1
             AND t.date ILIKE $2
             ORDER BY t.created_at DESC`,
            [req.user.id, `%${month}%`]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get on-this-day error:', error);
        res.status(500).json({ error: 'Failed to get memories' });
    }
});

// Get yearly recap (must be before /:id)
router.get('/yearly-recap/:year', authenticateToken, async (req, res) => {
    try {
        const { year } = req.params;

        const tripsResult = await db.query(
            `SELECT COUNT(*) as total_trips,
                    COUNT(DISTINCT location) as unique_destinations
             FROM trips
             WHERE user_id = $1 AND date ILIKE $2`,
            [req.user.id, `%${year}%`]
        );

        const topDestinations = await db.query(
            `SELECT location, COUNT(*) as visit_count
             FROM trips
             WHERE user_id = $1 AND date ILIKE $2
             GROUP BY location
             ORDER BY visit_count DESC
             LIMIT 5`,
            [req.user.id, `%${year}%`]
        );

        const moodBreakdown = await db.query(
            `SELECT mood, COUNT(*) as count
             FROM trips
             WHERE user_id = $1 AND date ILIKE $2
             GROUP BY mood`,
            [req.user.id, `%${year}%`]
        );

        res.json({
            year: year,
            total_trips: parseInt(tripsResult.rows[0]?.total_trips) || 0,
            unique_destinations: parseInt(tripsResult.rows[0]?.unique_destinations) || 0,
            top_destinations: topDestinations.rows,
            mood_breakdown: moodBreakdown.rows
        });
    } catch (error) {
        console.error('Get yearly recap error:', error);
        res.status(500).json({ error: 'Failed to get yearly recap' });
    }
});

// Get all available tags (must be before /:id)
router.get('/tags', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT DISTINCT unnest(tags) as tag FROM trips WHERE tags IS NOT NULL`
        );
        res.json(result.rows.map(r => r.tag));
    } catch (error) {
        res.json(['beach', 'mountain', 'city', 'food', 'adventure', 'culture', 'nature', 'romantic']);
    }
});

// Get single trip
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT t.*, u.name as author_name, u.avatar_url as author_avatar,
                    (SELECT COUNT(*) FROM trip_likes WHERE trip_id = t.id) as likes_count
             FROM trips t
             JOIN users u ON t.user_id = u.id
             WHERE t.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        const trip = result.rows[0];

        // Get photos
        const photos = await db.query(
            'SELECT * FROM trip_photos WHERE trip_id = $1 ORDER BY sort_order',
            [id]
        );
        trip.photos = photos.rows;

        // Get comments
        const comments = await db.query(
            `SELECT c.*, u.name as author_name, u.avatar_url as author_avatar
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.trip_id = $1
             ORDER BY c.created_at DESC`,
            [id]
        );
        trip.comments = comments.rows;

        // Check if user liked/saved
        if (req.user) {
            const likeCheck = await db.query(
                'SELECT 1 FROM trip_likes WHERE trip_id = $1 AND user_id = $2',
                [id, req.user.id]
            );
            trip.liked = likeCheck.rows.length > 0;

            const saveCheck = await db.query(
                'SELECT 1 FROM trip_saves WHERE trip_id = $1 AND user_id = $2',
                [id, req.user.id]
            );
            trip.saved = saveCheck.rows.length > 0;
        }

        res.json(trip);

    } catch (error) {
        console.error('Get trip error:', error);
        res.status(500).json({ error: 'Failed to get trip' });
    }
});

// Create trip
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, location, latitude, longitude, date, description, mood, image_url } = req.body;

        if (!title || !location) {
            return res.status(400).json({ error: 'Title and location are required' });
        }

        const result = await db.query(
            `INSERT INTO trips (user_id, title, location, latitude, longitude, date, description, mood, image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [req.user.id, title, location, latitude, longitude, date, description, mood, image_url]
        );

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('Create trip error:', error);
        res.status(500).json({ error: 'Failed to create trip' });
    }
});

// Update trip
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, location, latitude, longitude, date, description, mood, image_url } = req.body;

        // Check ownership
        const checkOwner = await db.query(
            'SELECT user_id FROM trips WHERE id = $1',
            [id]
        );

        if (checkOwner.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        if (checkOwner.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to edit this trip' });
        }

        const result = await db.query(
            `UPDATE trips
             SET title = COALESCE($1, title),
                 location = COALESCE($2, location),
                 latitude = COALESCE($3, latitude),
                 longitude = COALESCE($4, longitude),
                 date = COALESCE($5, date),
                 description = COALESCE($6, description),
                 mood = COALESCE($7, mood),
                 image_url = COALESCE($8, image_url)
             WHERE id = $9
             RETURNING *`,
            [title, location, latitude, longitude, date, description, mood, image_url, id]
        );

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Update trip error:', error);
        res.status(500).json({ error: 'Failed to update trip' });
    }
});

// Delete trip
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const checkOwner = await db.query(
            'SELECT user_id FROM trips WHERE id = $1',
            [id]
        );

        if (checkOwner.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        if (checkOwner.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this trip' });
        }

        await db.query('DELETE FROM trips WHERE id = $1', [id]);

        res.json({ message: 'Trip deleted successfully' });

    } catch (error) {
        console.error('Delete trip error:', error);
        res.status(500).json({ error: 'Failed to delete trip' });
    }
});

// Like trip
router.post('/:id/like', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            `INSERT INTO trip_likes (trip_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (trip_id, user_id) DO NOTHING`,
            [id, req.user.id]
        );

        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM trip_likes WHERE trip_id = $1',
            [id]
        );

        res.json({ liked: true, likes_count: parseInt(countResult.rows[0].count) });

    } catch (error) {
        console.error('Like trip error:', error);
        res.status(500).json({ error: 'Failed to like trip' });
    }
});

// Unlike trip
router.delete('/:id/like', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'DELETE FROM trip_likes WHERE trip_id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM trip_likes WHERE trip_id = $1',
            [id]
        );

        res.json({ liked: false, likes_count: parseInt(countResult.rows[0].count) });

    } catch (error) {
        console.error('Unlike trip error:', error);
        res.status(500).json({ error: 'Failed to unlike trip' });
    }
});

// Save trip
router.post('/:id/save', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            `INSERT INTO trip_saves (trip_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (trip_id, user_id) DO NOTHING`,
            [id, req.user.id]
        );

        res.json({ saved: true });

    } catch (error) {
        console.error('Save trip error:', error);
        res.status(500).json({ error: 'Failed to save trip' });
    }
});

// Unsave trip
router.delete('/:id/save', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'DELETE FROM trip_saves WHERE trip_id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        res.json({ saved: false });

    } catch (error) {
        console.error('Unsave trip error:', error);
        res.status(500).json({ error: 'Failed to unsave trip' });
    }
});

// Get trips by destination
router.get('/destination/:name', optionalAuth, async (req, res) => {
    try {
        const { name } = req.params;

        const result = await db.query(
            `SELECT t.*, u.name as author_name, u.avatar_url as author_avatar,
                    (SELECT COUNT(*) FROM trip_likes WHERE trip_id = t.id) as likes_count
             FROM trips t
             JOIN users u ON t.user_id = u.id
             WHERE t.location ILIKE $1
             ORDER BY t.created_at DESC`,
            [`%${name}%`]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Get destination trips error:', error);
        res.status(500).json({ error: 'Failed to get trips' });
    }
});

module.exports = router;
