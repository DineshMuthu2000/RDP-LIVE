require('dotenv').config();
const app = require('./app');
const { initDb } = require('./config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initDb();
    console.log('[Database] SQLite initialized successfully.');

    app.listen(PORT, () => {
      console.log(`[Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server Initialization Error]', error);
    process.exit(1);
  }
}

startServer();
