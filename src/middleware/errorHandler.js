import { isProduction } from '../config/env.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: `No route found for ${req.method} ${req.originalUrl}`
  });
};

export const errorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;

  if (!isProduction) {
    console.error(error);
  }

  res.status(statusCode).json({
    message: statusCode === 500 ? 'Unexpected server error' : error.message,
    details: error.details || undefined
  });
};
