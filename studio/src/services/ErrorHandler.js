/** Centralized error handler for API failures and user notifications */
import Mediator from '../components/Mediator';
import { NOTIFY_TYPE } from '../constants';

// ============================================================================
// Error Messages
// ============================================================================

const ERROR_MESSAGES = {
  network: 'Network error. Check your connection.',
  timeout: 'Request timed out. Please try again.',
  server: 'Server error. Please try again later.',
  validation: 'Invalid request.',
  notFound: 'Resource not found.',
  unauthorized: 'Unauthorized. Please log in.',
  default: 'An error occurred.'
};

const getMessageForStatus = status => {
  if (status === 400) {
    return ERROR_MESSAGES.validation;
  }

  if (status === 401 || status === 403) {
    return ERROR_MESSAGES.unauthorized;
  }

  if (status === 404) {
    return ERROR_MESSAGES.notFound;
  }

  if (status >= 500) {
    return ERROR_MESSAGES.server;
  }

  return ERROR_MESSAGES.default;
};

const getMessageForError = error => {
  if (!error) {
    return ERROR_MESSAGES.default;
  }

  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return ERROR_MESSAGES.timeout;
  }

  if (error.name === 'TypeError' || error.message?.includes('NetworkError')) {
    return ERROR_MESSAGES.network;
  }

  // HTTP status in message (e.g., "HTTP 400: ...")
  const statusMatch = error.message?.match(/HTTP (\d{3})/);
  if (statusMatch) {
    return getMessageForStatus(parseInt(statusMatch[1], 10));
  }

  return ERROR_MESSAGES.default;
};

const getTechnicalDetails = error => {
  if (!error) {
    return '';
  }

  const parts = [];

  if (error.code) {
    parts.push(`Code: ${error.code}`);
  }

  if (error.message) {
    parts.push(error.message);
  }

  if (error.cause?.message && error.cause.message !== error.message) {
    parts.push(`Cause: ${error.cause.message}`);
  }

  if (error.stack) {
    const stackLine = error.stack.split('\n')[1]?.trim();

    if (stackLine) {
      parts.push(stackLine);
    }
  }

  return parts.join(' | ');
};

// ============================================================================
// Error Handler
// ============================================================================

class ErrorHandler {
  handle(error, context = '') {
    const message = getMessageForError(error);
    const fullMessage = context ? `${context}: ${message}` : message;
    const details = getTechnicalDetails(error);

    console.error('[ErrorHandler]', context || 'API Error', error);

    Mediator.showToast({
      type: NOTIFY_TYPE.ERROR,
      msg: fullMessage,
      details,
      timeHide: 15000
    });
  }

  show(message, type = NOTIFY_TYPE.ERROR) {
    Mediator.showToast({
      type,
      msg: message,
      timeHide: 4000
    });
  }
}

export default new ErrorHandler();
