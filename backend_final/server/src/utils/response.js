// server/src/utils/response.js
// Uniform API response envelope: { success, data, message }

'use strict';

/**
 * 200 OK with data payload.
 */
function sendSuccess(res, data = null, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({ success: true, data, message });
}

/**
 * Error response — never leaks stack traces in production.
 */
function sendError(res, message = 'An error occurred', statusCode = 500, details = null) {
  const payload = { success: false, data: null, message };
  if (process.env.NODE_ENV === 'development' && details) {
    payload.details = details;
  }
  return res.status(statusCode).json(payload);
}

/**
 * 400 Bad Request shorthand.
 */
function sendBadRequest(res, message = 'Bad request') {
  return sendError(res, message, 400);
}

/**
 * 401 Unauthorized shorthand.
 */
function sendUnauthorized(res, message = 'Unauthorized') {
  return sendError(res, message, 401);
}

/**
 * 403 Forbidden shorthand.
 */
function sendForbidden(res, message = 'Access denied') {
  return sendError(res, message, 403);
}

/**
 * 404 Not Found shorthand.
 */
function sendNotFound(res, message = 'Resource not found') {
  return sendError(res, message, 404);
}

module.exports = {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
};
