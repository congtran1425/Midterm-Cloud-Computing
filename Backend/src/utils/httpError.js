export class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (message, details = null) => new HttpError(400, message, details);
export const unauthorized = (message = 'Authentication required') => new HttpError(401, message);
export const forbidden = (message = 'You do not have permission to perform this action') => new HttpError(403, message);
export const notFound = (message = 'Resource not found') => new HttpError(404, message);
