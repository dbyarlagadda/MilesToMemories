const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get comments for a trip
router.get('/trip/:tripId', async (req, res) => {
    try {
        const { tripId } = req.params;

        const result = await db.query(
            `SELECT c.*, u.name as author_name, u.avatar_url as author_avatar
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.trip_id = $1
             ORDER BY c.created_at DESC`,
            [tripId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
});

// Add comment
router.post('/trip/:tripId', authenticateToken, async (req, res) => {
    try {
        const { tripId } = req.params;
        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        const result = await db.query(
            `INSERT INTO comments (trip_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [tripId, req.user.id, content.trim()]
        );

        // Get user info
        const userResult = await db.query(
            'SELECT name, avatar_url FROM users WHERE id = $1',
            [req.user.id]
        );

        const comment = {
            ...result.rows[0],
            author_name: userResult.rows[0].name,
            author_avatar: userResult.rows[0].avatar_url
        };

        res.status(201).json(comment);

    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Update comment
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        // Check ownership
        const checkOwner = await db.query(
            'SELECT user_id FROM comments WHERE id = $1',
            [id]
        );

        if (checkOwner.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (checkOwner.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to edit this comment' });
        }

        const result = await db.query(
            `UPDATE comments SET content = $1 WHERE id = $2 RETURNING *`,
            [content, id]
        );

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

// Delete comment
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Check ownership
        const checkOwner = await db.query(
            'SELECT user_id FROM comments WHERE id = $1',
            [id]
        );

        if (checkOwner.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (checkOwner.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        await db.query('DELETE FROM comments WHERE id = $1', [id]);

        res.json({ message: 'Comment deleted successfully' });

    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

module.exports = router;
