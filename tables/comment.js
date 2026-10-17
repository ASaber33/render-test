const pool = require('../db');
const { validText, ownsOrAdmin, handleDatabaseError } = require('../utils/api');

async function listPostComments(req, res) {
  try {
    const post = await pool.query('SELECT 1 FROM posts WHERE id = $1', [req.params.id]);
    if (!post.rowCount) return res.status(404).json({ error: 'Post not found' });
    const result = await pool.query(
      `SELECT c.id, c.post_id, c.user_id, u.username, c.content, c.created_at, c.updated_at
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = $1 ORDER BY c.created_at, c.id`, [req.params.id],
    );
    return res.json({ comments: result.rows });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read comments'); }
}

async function listComments(_req, res) {
  try {
    const result = await pool.query(
      `SELECT c.id, c.post_id, c.user_id, u.username, c.content, c.created_at, c.updated_at
       FROM comments c JOIN users u ON u.id = c.user_id ORDER BY c.created_at DESC, c.id DESC`,
    );
    return res.json({ comments: result.rows });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read comments'); }
}

async function getComment(req, res) {
  try {
    const result = await pool.query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
    return result.rowCount ? res.json({ comment: result.rows[0] }) : res.status(404).json({ error: 'Comment not found' });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read comment'); }
}

async function createComment(req, res) {
  const content = req.body?.content;
  if (!validText(content, 10000)) return res.status(400).json({ error: 'content must be 1 to 10000 characters' });
  try {
    const result = await pool.query('INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING *', [req.params.id, req.user.id, content.trim()]);
    return res.status(201).json({ comment: result.rows[0] });
  } catch (error) { return handleDatabaseError(res, error, 'Could not create comment'); }
}

async function updateComment(req, res) {
  const content = req.body?.content;
  if (!validText(content, 10000)) return res.status(400).json({ error: 'content must be 1 to 10000 characters' });
  try {
    const existing = await pool.query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
    if (!existing.rowCount) return res.status(404).json({ error: 'Comment not found' });
    if (!ownsOrAdmin(req, existing.rows[0].user_id)) return res.status(403).json({ error: 'You can only edit your own comments' });
    const result = await pool.query('UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [content.trim(), req.params.id]);
    return res.json({ comment: result.rows[0] });
  } catch (error) { return handleDatabaseError(res, error, 'Could not update comment'); }
}

async function deleteComment(req, res) {
  try {
    const existing = await pool.query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
    if (!existing.rowCount) return res.status(404).json({ error: 'Comment not found' });
    if (!ownsOrAdmin(req, existing.rows[0].user_id)) return res.status(403).json({ error: 'You can only delete your own comments' });
    await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Comment deleted', comment: existing.rows[0] });
  } catch (error) { return handleDatabaseError(res, error, 'Could not delete comment'); }
}

module.exports = { listPostComments, listComments, getComment, createComment, updateComment, deleteComment };
