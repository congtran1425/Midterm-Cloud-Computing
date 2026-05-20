import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

export const signToken = (payload) => jwt.sign(payload, env.jwtSecret, {
  expiresIn: env.jwtExpiresIn
});

export const requireAuth = (req, _res, next) => {
  const header = req.get('authorization') || '';
  const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];

  if (!token) {
    return next(unauthorized());
  }

  try {
    req.auth = jwt.verify(token, env.jwtSecret);
    return next();
  } catch (_error) {
    return next(unauthorized('Invalid or expired token'));
  }
};

export const requirePlatformAdmin = (req, _res, next) => {
  if (req.auth?.scope !== 'platform') {
    return next(forbidden('Platform administrator access required'));
  }

  return next();
};

export const requireTenantUser = (req, _res, next) => {
  if (req.auth?.scope !== 'tenant' || !req.auth?.tenantId) {
    return next(forbidden('Tenant user access required'));
  }

  return next();
};

export const requireTenantAdmin = (req, _res, next) => {
  if (req.auth?.scope !== 'tenant' || req.auth?.role !== 'TENANT_ADMIN') {
    return next(forbidden('Tenant administrator access required'));
  }

  return next();
};
