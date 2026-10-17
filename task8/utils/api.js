function validId(value) {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}

function validateId(req, res, next) {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'id must be a positive integer' });
  return next();
}

function validText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function ownsOrAdmin(req, ownerId) {
  return req.user.role === 'admin' || String(req.user.id) === String(ownerId);
}

function handleDatabaseError(res, error, action) {
  console.error(`${action}:`, error.message);
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '3D000'].includes(error.code)) {
    return res.status(503).json({ error: 'Database unavailable. Check the DB_* settings in .env.' });
  }
  if (error.code === '23505') return res.status(409).json({ error: 'A record with that unique value already exists' });
  if (error.code === '23503') return res.status(404).json({ error: 'Related record not found' });
  return res.status(500).json({ error: action });
}

module.exports = { validId, validateId, validText, ownsOrAdmin, handleDatabaseError };
