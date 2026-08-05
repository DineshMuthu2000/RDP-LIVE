const { getDb } = require('../config/db');

class LicenseModel {
  static async create({ licenseKey, customerName, customerEmail, maxPcs = 1, expiresAt = null, notes = null }) {
    const db = getDb();
    const result = await db.run(
      `INSERT INTO licenses (license_key, customer_name, customer_email, max_pcs, expires_at, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [licenseKey, customerName, customerEmail, maxPcs, expiresAt, notes]
    );
    return this.findById(result.lastID);
  }

  static async findAll({ search = '', status = '' } = {}) {
    const db = getDb();
    let query = `
      SELECT l.*, 
        (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id AND a.status = 'active') as active_devices_count
      FROM licenses l
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (l.license_key LIKE ? OR l.customer_name LIKE ? OR l.customer_email LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status) {
      query += ` AND l.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY l.id DESC`;

    return await db.all(query, params);
  }

  static async findById(id) {
    const db = getDb();
    const license = await db.get(
      `SELECT l.*, 
        (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id AND a.status = 'active') as active_devices_count
       FROM licenses l 
       WHERE l.id = ?`,
      [id]
    );
    if (!license) return null;

    const activations = await db.all(
      `SELECT * FROM activations WHERE license_id = ? ORDER BY id DESC`,
      [id]
    );
    license.activations = activations;
    return license;
  }

  static async findByKey(licenseKey) {
    const db = getDb();
    const license = await db.get(
      `SELECT l.*, 
        (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id AND a.status = 'active') as active_devices_count
       FROM licenses l 
       WHERE l.license_key = ?`,
      [licenseKey]
    );
    if (!license) return null;

    const activations = await db.all(
      `SELECT * FROM activations WHERE license_id = ? ORDER BY id DESC`,
      [license.id]
    );
    license.activations = activations;
    return license;
  }

  static async update(id, { customerName, customerEmail, maxPcs, expiresAt, notes }) {
    const db = getDb();
    await db.run(
      `UPDATE licenses 
       SET customer_name = COALESCE(?, customer_name),
           customer_email = COALESCE(?, customer_email),
           max_pcs = COALESCE(?, max_pcs),
           expires_at = ?,
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [customerName, customerEmail, maxPcs, expiresAt, notes, id]
    );
    return this.findById(id);
  }

  static async updateStatus(id, status) {
    const db = getDb();
    await db.run(
      `UPDATE licenses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );
    return this.findById(id);
  }

  static async delete(id) {
    const db = getDb();
    await db.run(`DELETE FROM activations WHERE license_id = ?`, [id]);
    const result = await db.run(`DELETE FROM licenses WHERE id = ?`, [id]);
    return result.changes > 0;
  }

  // --- Activations logic ---

  static async getActiveDeviceCount(licenseId) {
    const db = getDb();
    const row = await db.get(
      `SELECT COUNT(*) as count FROM activations WHERE license_id = ? AND status = 'active'`,
      [licenseId]
    );
    return row ? row.count : 0;
  }

  static async findActivationByHwid(licenseId, hwid) {
    const db = getDb();
    return await db.get(
      `SELECT * FROM activations WHERE license_id = ? AND hwid = ?`,
      [licenseId, hwid]
    );
  }

  static async createActivation({ licenseId, hwid, computerName, ipAddress }) {
    const db = getDb();
    const result = await db.run(
      `INSERT INTO activations (license_id, hwid, computer_name, ip_address, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [licenseId, hwid, computerName, ipAddress]
    );
    return await db.get(`SELECT * FROM activations WHERE id = ?`, [result.lastID]);
  }

  static async reactivateActivation(id, { computerName, ipAddress }) {
    const db = getDb();
    await db.run(
      `UPDATE activations 
       SET status = 'active', 
           computer_name = ?, 
           ip_address = ?, 
           last_validated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [computerName, ipAddress, id]
    );
    return await db.get(`SELECT * FROM activations WHERE id = ?`, [id]);
  }

  static async touchLastValidated(id, { computerName, ipAddress }) {
    const db = getDb();
    await db.run(
      `UPDATE activations 
       SET computer_name = COALESCE(?, computer_name),
           ip_address = COALESCE(?, ip_address),
           last_validated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [computerName, ipAddress, id]
    );
  }

  static async deactivateByHwid(licenseId, hwid) {
    const db = getDb();
    const result = await db.run(
      `UPDATE activations SET status = 'deactivated' WHERE license_id = ? AND hwid = ? AND status = 'active'`,
      [licenseId, hwid]
    );
    return result.changes > 0;
  }
}

module.exports = LicenseModel;
