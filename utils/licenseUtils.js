const crypto = require('crypto');

/**
 * Generates a formatted unique license key (e.g. RDP-A1B2-C3D4-E5F6-7890)
 */
function generateLicenseKey(prefix = 'RDP') {
  const bytes = crypto.randomBytes(8).toString('hex').toUpperCase();
  const part1 = bytes.substring(0, 4);
  const part2 = bytes.substring(4, 8);
  const part3 = bytes.substring(8, 12);
  const part4 = bytes.substring(12, 16);
  return `${prefix}-${part1}-${part2}-${part3}-${part4}`;
}

/**
 * Calculates expiration date based on days from now, or returns ISO string
 */
function calculateExpirationDate(days) {
  if (!days || isNaN(days) || Number(days) <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + Number(days));
  return d.toISOString();
}

/**
 * Checks if an ISO date string is expired compared to current time
 */
function isExpired(expiresAt) {
  if (!expiresAt) return false; // Null means lifetime license
  return new Date(expiresAt) < new Date();
}

module.exports = {
  generateLicenseKey,
  calculateExpirationDate,
  isExpired
};
