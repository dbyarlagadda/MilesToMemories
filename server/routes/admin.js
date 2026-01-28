const express = require('express');
const router = express.Router();
const db = require('../db');

// Get dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const usersResult = await db.query('SELECT COUNT(*) as count FROM users');
        const tripsResult = await db.query('SELECT COUNT(*) as count FROM trips');
        const commentsResult = await db.query('SELECT COUNT(*) as count FROM comments');
        const likesResult = await db.query('SELECT COALESCE(SUM(likes_count), 0) as count FROM trips');

        res.json({
            users: parseInt(usersResult.rows[0].count),
            trips: parseInt(tripsResult.rows[0].count),
            comments: parseInt(commentsResult.rows[0].count),
            likes: parseInt(likesResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get all users with trip count
router.get('/users', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                u.id,
                u.email,
                u.name,
                u.avatar_url,
                u.created_at,
                COUNT(t.id) as trip_count
            FROM users u
            LEFT JOIN trips t ON u.id = t.user_id
            GROUP BY u.id, u.email, u.name, u.avatar_url, u.created_at
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get all trips with author info
router.get('/trips', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                t.*,
                u.name as author_name,
                u.email as author_email
            FROM trips t
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ error: 'Failed to fetch trips' });
    }
});

// Delete user (admin only)
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Delete user's trips, comments, etc. first
        await db.query('DELETE FROM comments WHERE user_id = $1', [id]);
        await db.query('DELETE FROM trip_likes WHERE user_id = $1', [id]);
        await db.query('DELETE FROM trip_saves WHERE user_id = $1', [id]);
        await db.query('DELETE FROM trips WHERE user_id = $1', [id]);
        await db.query('DELETE FROM user_profiles WHERE user_id = $1', [id]);
        await db.query('DELETE FROM social_connections WHERE user_id = $1', [id]);
        await db.query('DELETE FROM users WHERE id = $1', [id]);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Delete trip (admin only)
router.delete('/trips/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await db.query('DELETE FROM comments WHERE trip_id = $1', [id]);
        await db.query('DELETE FROM trip_likes WHERE trip_id = $1', [id]);
        await db.query('DELETE FROM trip_saves WHERE trip_id = $1', [id]);
        await db.query('DELETE FROM trip_photos WHERE trip_id = $1', [id]);
        await db.query('DELETE FROM trips WHERE id = $1', [id]);

        res.json({ message: 'Trip deleted successfully' });
    } catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({ error: 'Failed to delete trip' });
    }
});

module.exports = router;
