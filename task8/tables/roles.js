const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });

function isRole(value) {
  return Object.values(ROLES).includes(value);
}

module.exports = { ROLES, isRole };
