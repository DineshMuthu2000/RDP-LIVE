const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');

let dbInstance = null;

async function initDb() {
  if (dbInstance) return dbInstance;

  const dbPathSetting = process.env.DB_PATH || './data/database.sqlite';
  const resolvedDbPath = path.isAbsolute(dbPathSetting)
    ? dbPathSetting
    : path.join(__dirname, '../../', dbPathSetting);

  const dir = path.dirname(resolvedDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = await open({
    filename: resolvedDbPath,
    driver: sqlite3.Database
  });

  await dbInstance.run('PRAGMA foreign_keys = ON;');

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      max_pcs INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL,
      hwid TEXT NOT NULL,
      computer_name TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_validated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
    CREATE INDEX IF NOT EXISTS idx_activations_license_id ON activations(license_id);
    CREATE INDEX IF NOT EXISTS idx_activations_hwid ON activations(hwid);
  `);

  const adminCount = await dbInstance.get('SELECT COUNT(*) as count FROM admins');
  if (adminCount.count === 0) {
    const defaultUser = process.env.DEFAULT_ADMIN_USER || 'admin';
    const defaultPass = process.env.DEFAULT_ADMIN_PASS || 'Admin@123456';
    const hashedPassword = await bcrypt.hash(defaultPass, 10);

    await dbInstance.run(
      'INSERT INTO admins (username, password, role) VALUES (?, ?, ?)',
      [defaultUser, hashedPassword, 'admin']
    );
    console.log(`[DB Initialization] Created default admin user: '${defaultUser}'`);
  }

  return dbInstance;
}

function getDb() {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }
  return dbInstance;
}

module.exports = { initDb, getDb };
