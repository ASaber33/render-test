const pool = require('../db');
const { handleDatabaseError } = require('../utils/api');

async function countReactions(req, res) {
  try {
    const post = await pool.query('SELECT 1 FROM posts WHERE id = $1', [req.params.id]);
    if (!post.rowCount) return res.status(404).json({ error: 'Post not found' });
    const result = await pool.query('SELECT type, COUNT(*)::int AS count FROM reactions WHERE post_id = $1 GROUP BY type ORDER BY type', [req.params.id]);
    return res.json({ reactions: result.rows });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read reactions'); }
}

async function setReaction(req, res) {
  const type = req.body?.type || 'like';
  if (!['like', 'dislike'].includes(type)) return res.status(400).json({ error: 'type must be like or dislike' });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', [req.params.id, req.user.id]);
    const existing = await client.query(
      'SELECT id FROM reactions WHERE post_id = $1 AND user_id = $2 ORDER BY id LIMIT 1 FOR UPDATE',
      [req.params.id, req.user.id],
    );
    let result;
    if (existing.rowCount) {
      result = await client.query('UPDATE reactions SET type = $1 WHERE post_id = $2 AND user_id = $3 RETURNING *', [type, req.params.id, req.user.id]);
    } else {
      result = await client.query('INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3) RETURNING *', [req.params.id, req.user.id, type]);
    }
    await client.query('COMMIT');
    return res.json({ reaction: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return handleDatabaseError(res, error, 'Could not save reaction');
  } finally { client?.release(); }
}

async function deleteOwnReaction(req, res) {
  try {
    const result = await pool.query('DELETE FROM reactions WHERE post_id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    return result.rowCount ? res.json({ message: 'Reaction deleted', reaction: result.rows[0] }) : res.status(404).json({ error: 'Reaction not found' });
  } catch (error) { return handleDatabaseError(res, error, 'Could not delete reaction'); }
}

async function listReactions(_req, res) {
  try {
    const result = await pool.query('SELECT * FROM reactions ORDER BY created_at DESC, id DESC');
    return res.json({ reactions: result.rows });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read reactions'); }
}

async function getReaction(req, res) {
  try {
    const result = await pool.query('SELECT * FROM reactions WHERE id = $1', [req.params.id]);
    return result.rowCount ? res.json({ reaction: result.rows[0] }) : res.status(404).json({ error: 'Reaction not found' });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read reaction'); }
}

async function updateReaction(req, res) {
  const type = req.body?.type;
  if (!['like', 'dislike'].includes(type)) return res.status(400).json({ error: 'type must be like or dislike' });
  try {
    const result = await pool.query('UPDATE reactions SET type = $1 WHERE id = $2 RETURNING *', [type, req.params.id]);
    return result.rowCount ? res.json({ reaction: result.rows[0] }) : res.status(404).json({ error: 'Reaction not found' });
  } catch (error) { return handleDatabaseError(res, error, 'Could not update reaction'); }
}

async function deleteReaction(req, res) {
  try {
    const result = await pool.query('DELETE FROM reactions WHERE id = $1 RETURNING *', [req.params.id]);
    return result.rowCount ? res.json({ message: 'Reaction deleted', reaction: result.rows[0] }) : res.status(404).json({ error: 'Reaction not found' });
  } catch (error) { return handleDatabaseError(res, error, 'Could not delete reaction'); }
}

module.exports = { countReactions, setReaction, deleteOwnReaction, listReactions, getReaction, updateReaction, deleteReaction };
