require('dotenv').config();
const express = require('express');
const pool = require('./db');
const { authenticate } = require('./middleware/auth_middleware');
const { requireAdmin } = require('./middleware/role_middleware');
const { validateId, handleDatabaseError } = require('./utils/api');
const users = require('./user');
const posts = require('./tables/post');
const comments = require('./tables/comment');
const reactions = require('./tables/reaction');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 3100);
app.use(express.json({ limit: '100kb' }));

const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDist));

app.get('/', (_req, res) => res.json({
  message: 'Blog API is running',
  routes: [
    '/register', '/login', '/profile', '/users', '/users/:id', '/users/:id/role', '/posts', '/posts/:id',
    '/posts/:id/comments', '/comments', '/posts/:id/reaction',
    '/posts/:id/reactions', '/reactions', '/reactions/:id', '/health',
  ],
}));

// Authentication and user administration.
app.post('/register', users.register);
app.post('/login', users.login);
app.get('/profile', authenticate, users.profile);
app.get('/users', authenticate, requireAdmin, users.listUsers);
app.get('/users/:id', authenticate, requireAdmin, validateId, users.getUser);
app.patch('/users/:id/role', authenticate, requireAdmin, validateId, users.updateUserRole);
app.delete('/users/:id', authenticate, requireAdmin, validateId, users.deleteUser);

// Posts are public to read; the author or an admin can edit and delete.
app.get('/posts', posts.listPosts);
app.get('/posts/:id', validateId, posts.getPost);
app.post('/posts', authenticate, posts.createPost);
app.put('/posts/:id', authenticate, validateId, posts.updatePost);
app.patch('/posts/:id', authenticate, validateId, posts.updatePost);
app.delete('/posts/:id', authenticate, validateId, posts.deletePost);

// Comments are public to read; their author or an admin can edit/delete.
app.get('/posts/:id/comments', validateId, comments.listPostComments);
app.post('/posts/:id/comments', authenticate, validateId, comments.createComment);
app.get('/comments', comments.listComments);
app.get('/comments/:id', validateId, comments.getComment);
app.put('/comments/:id', authenticate, validateId, comments.updateComment);
app.patch('/comments/:id', authenticate, validateId, comments.updateComment);
app.delete('/comments/:id', authenticate, validateId, comments.deleteComment);

// Each signed-in user has one like/dislike per post.
app.get('/posts/:id/reactions', validateId, reactions.countReactions);
app.put('/posts/:id/reaction', authenticate, validateId, reactions.setReaction);
app.delete('/posts/:id/reaction', authenticate, validateId, reactions.deleteOwnReaction);
app.get('/reactions', reactions.listReactions);
app.get('/reactions/:id', validateId, reactions.getReaction);
app.put('/reactions/:id', authenticate, requireAdmin, validateId, reactions.updateReaction);
app.patch('/reactions/:id', authenticate, requireAdmin, validateId, reactions.updateReaction);
app.delete('/reactions/:id', authenticate, requireAdmin, validateId, reactions.deleteReaction);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check database error:', error.message);
    return res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(frontendDist, 'index.html'));
  }
  return res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});
app.use((error, _req, res, _next) => {
  console.error('Request error:', error.message);
  if (error.code) return handleDatabaseError(res, error, 'Database request failed');
  return res.status(400).json({ error: 'Invalid request' });
});

if (require.main === module) {
  app.listen(port, () => console.log(`Blog API running on http://localhost:${port}`));
}

module.exports = app;
