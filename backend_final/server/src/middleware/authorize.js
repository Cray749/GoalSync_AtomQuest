// server/src/middleware/authorize.js
// Role guard — use AFTER authenticate middleware.
// Usage: router.get('/admin-route', authenticate, authorize('admin'), handler)
//        router.get('/mgr-route',   authenticate, authorize('admin', 'manager'), handler)

'use strict';

const { sendForbidden } = require('../utils/response');

/**
 * Returns middleware that allows only the specified roles.
 * @param {...string} roles - allowed role strings
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendForbidden(res, 'Not authenticated');
    }
    if (!roles.includes(req.user.role)) {
      return sendForbidden(res, `Role '${req.user.role}' is not permitted to access this resource`);
    }
    next();
  };
}

module.exports = authorize;
