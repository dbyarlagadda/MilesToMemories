const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { name, bio, location, website, avatar_url } = req.body;

        // Update user name and avatar
        if (name || avatar_url) {
            await db.query(
                `UPDATE users
                 SET name = COALESCE($1, name),
                     avatar_url = COALESCE($2, avatar_url)
                 WHERE id = $3`,
                [name, avatar_url, req.user.id]
            );
        }

        // Update profile
        await db.query(
            `INSERT INTO user_profiles (user_id, bio, location, website)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id)
             DO UPDATE SET bio = COALESCE($2, user_profiles.bio),
                          location = COALESCE($3, user_profiles.location),
                          website = COALESCE($4, user_profiles.website)`,
            [req.user.id, bio, location, website]
        );

        // Get updated user
        const result = await db.query(
            `SELECT u.id, u.email, u.name, u.avatar_url,
                    p.bio, p.location, p.website
             FROM users u
             LEFT JOIN user_profiles p ON u.id = p.user_id
             WHERE u.id = $1`,
            [req.user.id]
        );

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get social connections
router.get('/social', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT platform, username FROM social_connections WHERE user_id = $1',
            [req.user.id]
        );

        const connections = {};
        result.rows.forEach(row => {
            connections[row.platform] = row.username;
        });

        res.json(connections);

    } catch (error) {
        console.error('Get social error:', error);
        res.status(500).json({ error: 'Failed to get social connections' });
    }
});

// Update social connections
router.put('/social', authenticateToken, async (req, res) => {
    try {
        const { instagram, pinterest, youtube } = req.body;

        // Update each platform
        const platforms = [
            { name: 'instagram', username: instagram },
            { name: 'pinterest', username: pinterest },
            { name: 'youtube', username: youtube }
        ];

        for (const platform of platforms) {
            if (platform.username) {
                await db.query(
                    `INSERT INTO social_connections (user_id, platform, username)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (user_id, platform)
                     DO UPDATE SET username = $3`,
                    [req.user.id, platform.name, platform.username]
                );
            } else {
                await db.query(
                    'DELETE FROM social_connections WHERE user_id = $1 AND platform = $2',
                    [req.user.id, platform.name]
                );
            }
        }

        // Get updated connections
        const result = await db.query(
            'SELECT platform, username FROM social_connections WHERE user_id = $1',
            [req.user.id]
        );

        const connections = {};
        result.rows.forEach(row => {
            connections[row.platform] = row.username;
        });

        res.json(connections);

    } catch (error) {
        console.error('Update social error:', error);
        res.status(500).json({ error: 'Failed to update social connections' });
    }
});

// Get user's trips
router.get('/trips', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT t.*,
                    (SELECT COUNT(*) FROM trip_likes WHERE trip_id = t.id) as likes_count
             FROM trips t
             WHERE t.user_id = $1
             ORDER BY t.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Get user trips error:', error);
        res.status(500).json({ error: 'Failed to get trips' });
    }
});

// Get user's saved trips
router.get('/saved', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT t.*, u.name as author_name, u.avatar_url as author_avatar,
                    (SELECT COUNT(*) FROM trip_likes WHERE trip_id = t.id) as likes_count
             FROM trips t
             JOIN users u ON t.user_id = u.id
             JOIN trip_saves s ON t.id = s.trip_id
             WHERE s.user_id = $1
             ORDER BY s.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Get saved trips error:', error);
        res.status(500).json({ error: 'Failed to get saved trips' });
    }
});

// Get user stats
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const tripsCount = await db.query(
            'SELECT COUNT(*) as count FROM trips WHERE user_id = $1',
            [req.user.id]
        );

        const countriesCount = await db.query(
            'SELECT COUNT(DISTINCT location) as count FROM trips WHERE user_id = $1',
            [req.user.id]
        );

        const photosCount = await db.query(
            `SELECT COUNT(*) as count FROM trip_photos p
             JOIN trips t ON p.trip_id = t.id
             WHERE t.user_id = $1`,
            [req.user.id]
        );

        res.json({
            trips: parseInt(tripsCount.rows[0].count),
            countries: parseInt(countriesCount.rows[0].count),
            photos: parseInt(photosCount.rows[0].count)
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

module.exports = router;
