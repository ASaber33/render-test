const { ROLES } = require('../tables/roles');

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    return next();
  };
}

const requireAdmin = requireRoles(ROLES.ADMIN);

module.exports = { requireRoles, requireAdmin };
