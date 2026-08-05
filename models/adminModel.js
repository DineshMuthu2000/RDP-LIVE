const { getDb } = require('../config/db');

class AdminModel {
  static async findByUsername(username) {
    const db = getDb();
    return await db.get('SELECT * FROM admins WHERE username = ?', [username]);
  }

  static async findById(id) {
    const db = getDb();
    return await db.get('SELECT id, username, role, created_at FROM admins WHERE id = ?', [id]);
  }

  static async updatePassword(id, hashedPassword) {
    const db = getDb();
    return await db.run(
      'UPDATE admins SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, id]
    );
  }
}

module.exports = AdminModel;
