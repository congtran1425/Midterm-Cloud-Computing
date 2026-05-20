import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { productRouter } from './routes/product.routes.js';
import { tenantRouter } from './routes/tenant.routes.js';
import { tenantUserRouter } from './routes/tenant-user.routes.js';
import { transactionRouter } from './routes/transaction.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { env, isProduction } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');

export const app = express();

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: isProduction ? env.appOrigin : true,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cloud-pos-saas' });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/tenant', tenantRouter);
app.use('/api/tenant/products', productRouter);
app.use('/api/tenant/users', tenantUserRouter);
app.use('/api/tenant/transactions', transactionRouter);

app.use(express.static(publicDir));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);
