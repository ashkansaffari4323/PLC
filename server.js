require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./server/routes/auth');
const hubRoutes = require('./server/routes/hubs');
const folderRoutes = require('./server/routes/folders');
const reviewRoutes = require('./server/routes/reviews');
const gateRoutes = require('./server/routes/gates');

const app = express();
// Named SERVER_PORT (not PORT) because Create React App's dev server also
// reads PORT from this same .env file for its own port - reusing PORT here
// would make the backend and frontend fight over the same port.
const PORT = process.env.SERVER_PORT || process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // required so the session cookie is sent/received cross-origin in dev
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'PLC backend is running', port: PORT });
});

app.use('/api/auth', authRoutes);
app.use('/api/hubs', hubRoutes);
app.use('/api', folderRoutes); // /api/hubs/:hubId/projects/:projectId/top-folders, /api/projects/:projectId/folders/:folderId/contents
app.use('/api', reviewRoutes); // /api/projects/:projectId/reviews, /workflows, etc.
app.use('/api', gateRoutes);   // /api/projects/:projectId/gates, /phases, /api/hub/gates

// In production, serve the built React app and let it handle client-side routing.
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'build');
  app.use(express.static(buildPath));
  app.get('/*splat', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n🚀 PLC backend running on http://localhost:${PORT}`);
  console.log('Available endpoint groups:');
  console.log('  /api/auth/*   - 3-legged login/callback/status, 2-legged status');
  console.log('  /api/hubs/*   - hubs and hub projects');
  console.log('  /api/*folders - top folders and folder contents');
  console.log('  /api/projects/:id/reviews* , /workflows - ACC Reviews proxy');
  console.log('  /api/projects/:id/gates , /phases, /api/hub/gates - gate/phase storage\n');
});
