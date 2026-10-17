const bcrypt = require('bcrypt');
const pool = require('./db');
const { createToken } = require('./middleware/auth_middleware');
const { ROLES } = require('./tables/roles');
const { validText, handleDatabaseError } = require('./utils/api');

const PASSWORD_MAX_BYTES = 72;

async function register(req, res) {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!validText(username, 100)) return res.status(400).json({ error: 'username must be 1 to 100 characters' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) return res.status(400).json({ error: 'valid email is required' });
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return res.status(400).json({ error: 'password must be at least 8 and no more than 72 UTF-8 bytes' });
  try {
    const hash = Buffer.from(await bcrypt.hash(password, 10), 'utf8');
    const result = await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
      [username, email, hash, ROLES.USER],
    );
    return res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
  } catch (error) { return handleDatabaseError(res, error, 'Could not register user'); }
}

async function login(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password || Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return res.status(400).json({ error: 'valid email and password are required' });
  try {
    const result = await pool.query('SELECT id, username, email, password, role FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    const storedHash = user?.password ? Buffer.from(user.password).toString('utf8') : '$2b$10$C6UzMDM.H6dfI/f/IKcEe.7Do6Qj0gM9n7eR2V0J9n2h0S9oX8Y0K';
    const matches = await bcrypt.compare(password, storedHash);
    if (!user || !matches) return res.status(401).json({ error: 'invalid email or password' });
    let token;
    try { token = createToken(user.id); }
    catch (error) { console.error(error.message); return res.status(500).json({ error: 'Authentication is not configured' }); }
    return res.json({ message: 'Login successful', token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
  } catch (error) { return handleDatabaseError(res, error, 'Could not login'); }
}

function profile(req, res) {
  return res.json({ user: req.user });
}

async function listUsers(_req, res) {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY id');
    return res.json({ users: result.rows });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read users'); }
}

async function getUser(req, res) {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM users WHERE id = $1', [req.params.id]);
    return result.rowCount ? res.json({ user: result.rows[0] }) : res.status(404).json({ error: 'User not found' });
  } catch (error) { return handleDatabaseError(res, error, 'Could not read user'); }
}

async function updateUserRole(req, res) {
  const { role } = req.body || {};
  if (![ROLES.USER, ROLES.ADMIN].includes(role)) return res.status(400).json({ error: 'role must be user or admin' });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
    const current = await client.query('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!current.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (current.rows[0].role === ROLES.ADMIN && role === ROLES.USER) {
      const count = await client.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
      if (count.rows[0].count <= 1) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Cannot demote the last admin' }); }
    }
    const updated = await client.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, email, role, created_at', [role, req.params.id]);
    await client.query('COMMIT');
    return res.json({ message: 'User role updated', user: updated.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return handleDatabaseError(res, error, 'Could not update user role');
  } finally { client?.release(); }
}

async function deleteUser(req, res) {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('LOCK TABLE users IN EXCLUSIVE MODE');
    const current = await client.query('SELECT id, username, email, role FROM users WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!current.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    if (current.rows[0].role === ROLES.ADMIN) {
      const count = await client.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
      if (count.rows[0].count <= 1) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Cannot delete the last admin' }); }
    }
    await client.query('DELETE FROM reactions WHERE user_id = $1 OR post_id IN (SELECT id FROM posts WHERE user_id = $1)', [req.params.id]);
    await client.query('DELETE FROM comments WHERE user_id = $1 OR post_id IN (SELECT id FROM posts WHERE user_id = $1)', [req.params.id]);
    await client.query('DELETE FROM posts WHERE user_id = $1', [req.params.id]);
    await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    return res.json({ message: 'User deleted', user: current.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return handleDatabaseError(res, error, 'Could not delete user');
  } finally { client?.release(); }
}

module.exports = { register, login, profile, listUsers, getUser, updateUserRole, deleteUser };
