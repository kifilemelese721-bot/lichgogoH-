import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeDatabase } from './server/db';
import publicRoutes from './server/routes/public';
import authRoutes from './server/routes/auth';
import adminRoutes from './server/routes/admin';
import instructorRoutes from './server/routes/instructor';
import studentRoutes from './server/routes/student';
import registrarRoutes from './server/routes/registrar';
import financeRoutes from './server/routes/finance';
import sharedRoutes from './server/routes/shared';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  initializeDatabase();

  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/instructor', instructorRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/registrar', registrarRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/shared', sharedRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', institution: 'Lich Gogo Excellence Boarding School' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lich Gogo LMS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
