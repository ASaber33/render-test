# Blog Backend

REST API for the existing PostgreSQL database `blog_db`, using its `users`, `posts`, `comments`, and `reactions` tables. The app does not create or alter database tables.

## Project structure

- `server.js` — Express app and API routes
- `user.js` — registration, login, profile, and user administration handlers
- `tables/post.js`, `tables/comment.js`, `tables/reaction.js` — database operations and handlers for the blog tables
- `middleware/auth_middleware.js` — token validation and current-user lookup
- `middleware/role_middleware.js` — role authorization
- `tables/userDb.js` — PostgreSQL pool; `tables/roles.js` — shared role names
- `utils/api.js` — input, ownership, and database error helpers
- `postman/` — Postman collection and local environment

## Setup

The `.env` file contains the PostgreSQL connection and token secret. It is ignored by Git; do not commit it.

```powershell
npm install
npm run dev
```

The API uses `http://localhost:3100` by default. `GET /health` reports whether PostgreSQL is reachable.

## First admin

Public registration always creates a `user`. After registering the intended admin account, promote it in DBeaver:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

Log in again after changing the role. The API reads the current role from the database on authenticated requests.

## Permissions

- **user / unauthenticated visitor**: read posts, comments, and reactions. A signed-in user can create posts/comments/reactions and edit/delete only their own posts and comments; they can change or remove their own reaction.
- **admin**: all content access; edit/delete any post or comment; view, edit, or delete any reaction; list/read/delete users and change user roles.
- Passwords are bcrypt hashes stored in the existing `BYTEA` column. API responses never include password hashes.

## Routes

Protected routes require `Authorization: Bearer <token>`.

### Authentication and users

- `POST /register` — `{ "username": "...", "email": "...", "password": "..." }`
- `POST /login` — `{ "email": "...", "password": "..." }`
- `GET /profile` — authenticated
- `GET /users`, `GET /users/:id` — admin
- `PATCH /users/:id/role` — admin; `{ "role": "user" | "admin" }`
- `DELETE /users/:id` — admin; cannot delete the last admin

### Posts

- `GET /posts`, `GET /posts/:id` — public
- `POST /posts` — authenticated; `{ "title": "...", "content": "..." }`
- `PUT /posts/:id`, `PATCH /posts/:id`, `DELETE /posts/:id` — author or admin

### Comments

- `GET /posts/:id/comments` — public
- `POST /posts/:id/comments` — authenticated; `{ "content": "..." }`
- `GET /comments`, `GET /comments/:id` — public
- `PUT /comments/:id`, `PATCH /comments/:id`, `DELETE /comments/:id` — comment author or admin

### Reactions

- `GET /posts/:id/reactions` — public counts by type
- `PUT /posts/:id/reaction` — authenticated; `{ "type": "like" }` or `{ "type": "dislike" }`
- `DELETE /posts/:id/reaction` — removes the caller's reaction
- `GET /reactions`, `GET /reactions/:id` — public
- `PUT /reactions/:id`, `PATCH /reactions/:id`, `DELETE /reactions/:id` — admin

Reaction writes are serialized per user/post pair so repeated requests update the user's reaction instead of creating another one.
