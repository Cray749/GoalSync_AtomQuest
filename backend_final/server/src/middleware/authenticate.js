// server/src/middleware/authenticate.js
// Validates Bearer JWT and attaches decoded user to req.user

'use strict';

const jwt = require('jsonwebtoken');
const { sendUnauthorized } = require('../utils/response');

/**
 * Middleware — verifies JWT, attaches req.user.
 * Sends 401 if token is missing, malformed, or expired.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'No token provided');
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, role, department, manager_id, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendUnauthorized(res, 'Token expired — please log in again');
    }
    return sendUnauthorized(res, 'Invalid token');
  }
}

module.exports = authenticate;
