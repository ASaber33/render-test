const pool = require('../db');
const { validText, ownsOrAdmin, handleDatabaseError } = require('../utils/api');

async function listPosts(_req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.user_id, u.username, p.title, p.content, p.created_at, p.updated_at
       FROM posts p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC, p.id DESC`,
    );
    return res.json({ posts: result.rows });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read posts'); }
}

async function getPost(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.user_id, u.username, p.title, p.content, p.created_at, p.updated_at
       FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = $1`, [req.params.id],
    );
    return result.rowCount ? res.json({ post: result.rows[0] }) : res.status(404).json({ error: 'Post not found' });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read post'); }
}

async function createPost(req, res) {
  const { title, content } = req.body || {};
  if (!validText(title, 200)) return res.status(400).json({ error: 'title must be 1 to 200 characters' });
  if (!validText(content, 50000)) return res.status(400).json({ error: 'content must be 1 to 50000 characters' });
  try {
    const result = await pool.query('INSERT INTO posts (user_id, title, content) VALUES ($1, $2, $3) RETURNING *', [req.user.id, title.trim(), content.trim()]);
    return res.status(201).json({ post: result.rows[0] });
  } catch (error) { return handleDatabaseError(res, error, 'Could not create post'); }
}

async function updatePost(req, res) {
  const { title, content } = req.body || {};
  if (!validText(title, 200) || !validText(content, 50000)) return res.status(400).json({ error: 'title (1-200 chars) and content (1-50000 chars) are required' });
  try {
    const existing = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!existing.rowCount) return res.status(404).json({ error: 'Post not found' });
    if (!ownsOrAdmin(req, existing.rows[0].user_id)) return res.status(403).json({ error: 'You can only edit your own posts' });
    const updated = await pool.query('UPDATE posts SET title = $1, content = $2, updated_at = NOW() WHERE id = $3 RETURNING *', [title.trim(), content.trim(), req.params.id]);
    return res.json({ post: updated.rows[0] });
  } catch (error) { return handleDatabaseError(res, error, 'Could not update post'); }
}

async function deletePost(req, res) {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM posts WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!existing.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Post not found' }); }
    if (!ownsOrAdmin(req, existing.rows[0].user_id)) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'You can only delete your own posts' }); }
    await client.query('DELETE FROM reactions WHERE post_id = $1', [req.params.id]);
    await client.query('DELETE FROM comments WHERE post_id = $1', [req.params.id]);
    await client.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    return res.json({ message: 'Post deleted', post: existing.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return handleDatabaseError(res, error, 'Could not delete post');
  } finally { client?.release(); }
}

module.exports = { listPosts, getPost, createPost, updatePost, deletePost };
