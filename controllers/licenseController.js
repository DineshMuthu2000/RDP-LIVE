const LicenseModel = require('../models/licenseModel');
const { generateLicenseKey, calculateExpirationDate, isExpired } = require('../utils/licenseUtils');

// ============================================================================
// ADMIN CONTROLLERS (Protected by JWT)
// ============================================================================

async function createLicense(req, res, next) {
  try {
    const { customer_name, customer_email, max_pcs, expires_in_days, expires_at, notes, custom_key } = req.body;

    let finalExpiresAt = null;
    if (expires_at) {
      finalExpiresAt = new Date(expires_at).toISOString();
    } else if (expires_in_days) {
      finalExpiresAt = calculateExpirationDate(expires_in_days);
    }

    const licenseKey = custom_key || generateLicenseKey();

    const license = await LicenseModel.create({
      licenseKey,
      customerName: customer_name,
      customerEmail: customer_email || null,
      maxPcs: max_pcs || 1,
      expiresAt: finalExpiresAt,
      notes: notes || null
    });

    return res.status(201).json({
      success: true,
      message: 'License key created successfully',
      data: license
    });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        success: false,
        message: 'License key already exists'
      });
    }
    next(error);
  }
}

async function getAllLicenses(req, res, next) {
  try {
    const { search, status } = req.query;
    const licenses = await LicenseModel.findAll({ search, status });
    return res.status(200).json({
      success: true,
      count: licenses.length,
      data: licenses
    });
  } catch (error) {
    next(error);
  }
}

async function getLicenseById(req, res, next) {
  try {
    const { id } = req.params;
    const license = await LicenseModel.findById(id);

    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: license
    });
  } catch (error) {
    next(error);
  }
}

async function updateLicenseStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: active, disabled'
      });
    }

    const license = await LicenseModel.updateStatus(id, status);
    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: `License status updated to '${status}'`,
      data: license
    });
  } catch (error) {
    next(error);
  }
}

async function updateLicense(req, res, next) {
  try {
    const { id } = req.params;
    const { customer_name, customer_email, max_pcs, expires_at, expires_in_days, notes } = req.body;

    const existing = await LicenseModel.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }

    let finalExpiresAt = existing.expires_at;
    if (expires_at !== undefined) {
      finalExpiresAt = expires_at ? new Date(expires_at).toISOString() : null;
    } else if (expires_in_days !== undefined) {
      finalExpiresAt = calculateExpirationDate(expires_in_days);
    }

    const updated = await LicenseModel.update(id, {
      customerName: customer_name,
      customerEmail: customer_email,
      maxPcs: max_pcs,
      expiresAt: finalExpiresAt,
      notes: notes
    });

    return res.status(200).json({
      success: true,
      message: 'License updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

async function deleteLicense(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await LicenseModel.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'License deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// CLIENT / PUBLIC ACTIVATION CONTROLLERS
// ============================================================================

async function activateLicense(req, res, next) {
  try {
    const { key, hwid, computer_name, ip_address } = req.body;
    const clientIp = ip_address || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    const license = await LicenseModel.findByKey(key);
    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'Invalid license key'
      });
    }

    if (license.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'License key is disabled. Please contact support.'
      });
    }

    if (isExpired(license.expires_at)) {
      return res.status(403).json({
        success: false,
        message: 'License key has expired',
        expires_at: license.expires_at
      });
    }

    // Check existing activation for this HWID
    const existingActivation = await LicenseModel.findActivationByHwid(license.id, hwid);

    if (existingActivation) {
      if (existingActivation.status === 'active') {
        await LicenseModel.touchLastValidated(existingActivation.id, {
          computerName: computer_name,
          ipAddress: clientIp
        });
        return res.status(200).json({
          success: true,
          message: 'Device already activated',
          data: {
            license_key: license.license_key,
            customer_name: license.customer_name,
            expires_at: license.expires_at,
            max_pcs: license.max_pcs,
            active_devices: license.active_devices_count,
            hwid: hwid,
            computer_name: computer_name
          }
        });
      } else {
        // Was deactivated earlier, reactivate if under limit
        const activeCount = await LicenseModel.getActiveDeviceCount(license.id);
        if (activeCount >= license.max_pcs) {
          return res.status(403).json({
            success: false,
            message: `Activation failed: Maximum PC limit (${license.max_pcs}) reached. Deactivate an existing device first.`
          });
        }
        await LicenseModel.reactivateActivation(existingActivation.id, {
          computerName: computer_name,
          ipAddress: clientIp
        });
        const updatedCount = await LicenseModel.getActiveDeviceCount(license.id);
        return res.status(200).json({
          success: true,
          message: 'Device reactivated successfully',
          data: {
            license_key: license.license_key,
            customer_name: license.customer_name,
            expires_at: license.expires_at,
            max_pcs: license.max_pcs,
            active_devices: updatedCount,
            hwid: hwid,
            computer_name: computer_name
          }
        });
      }
    }

    // New HWID activation check limit
    const activeCount = await LicenseModel.getActiveDeviceCount(license.id);
    if (activeCount >= license.max_pcs) {
      return res.status(403).json({
        success: false,
        message: `Activation failed: Maximum PC limit (${license.max_pcs}) reached. Deactivate an existing device first.`
      });
    }

    await LicenseModel.createActivation({
      licenseId: license.id,
      hwid,
      computerName: computer_name,
      ipAddress: clientIp
    });

    const newActiveCount = activeCount + 1;

    return res.status(200).json({
      success: true,
      message: 'License activated successfully on this PC',
      data: {
        license_key: license.license_key,
        customer_name: license.customer_name,
        expires_at: license.expires_at,
        max_pcs: license.max_pcs,
        active_devices: newActiveCount,
        hwid: hwid,
        computer_name: computer_name
      }
    });
  } catch (error) {
    next(error);
  }
}

async function validateLicense(req, res, next) {
  try {
    const { key, hwid, computer_name, ip_address } = req.body;
    const clientIp = ip_address || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    const license = await LicenseModel.findByKey(key);
    if (!license) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Invalid license key'
      });
    }

    if (license.status !== 'active') {
      return res.status(403).json({
        success: false,
        valid: false,
        message: 'License key is disabled'
      });
    }

    if (isExpired(license.expires_at)) {
      return res.status(403).json({
        success: false,
        valid: false,
        message: 'License key has expired',
        expires_at: license.expires_at
      });
    }

    const activation = await LicenseModel.findActivationByHwid(license.id, hwid);
    if (!activation || activation.status !== 'active') {
      return res.status(403).json({
        success: false,
        valid: false,
        message: 'Device is not activated for this license key'
      });
    }

    // Touch last validated timestamp
    await LicenseModel.touchLastValidated(activation.id, {
      computerName: computer_name || activation.computer_name,
      ipAddress: clientIp
    });

    let daysRemaining = null;
    if (license.expires_at) {
      const diffMs = new Date(license.expires_at) - new Date();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return res.status(200).json({
      success: true,
      valid: true,
      message: 'License is valid',
      data: {
        customer_name: license.customer_name,
        expires_at: license.expires_at,
        days_remaining: daysRemaining,
        max_pcs: license.max_pcs,
        active_devices: license.active_devices_count,
        hwid: hwid
      }
    });
  } catch (error) {
    next(error);
  }
}

async function deactivateLicense(req, res, next) {
  try {
    const { key, hwid } = req.body;

    const license = await LicenseModel.findByKey(key);
    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'Invalid license key'
      });
    }

    const deactivated = await LicenseModel.deactivateByHwid(license.id, hwid);
    if (!deactivated) {
      return res.status(404).json({
        success: false,
        message: 'No active activation found for this device and license key'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createLicense,
  getAllLicenses,
  getLicenseById,
  updateLicenseStatus,
  updateLicense,
  deleteLicense,
  activateLicense,
  validateLicense,
  deactivateLicense
};
