const express = require('express');
const { z } = require('zod');
const validate = require('../middlewares/validateMiddleware');
const { protect } = require('../middlewares/authMiddleware');
const {
  createLicense,
  getAllLicenses,
  getLicenseById,
  updateLicenseStatus,
  updateLicense,
  deleteLicense,
  activateLicense,
  validateLicense,
  deactivateLicense
} = require('../controllers/licenseController');

const router = express.Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createLicenseSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required').trim(),
  customer_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  max_pcs: z.number().int().min(1, 'max_pcs must be at least 1').optional().default(1),
  expires_in_days: z.number().int().min(1).optional(),
  expires_at: z.string().datetime().optional().or(z.null()),
  notes: z.string().optional(),
  custom_key: z.string().trim().optional()
});

const updateLicenseSchema = z.object({
  customer_name: z.string().min(1).trim().optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  max_pcs: z.number().int().min(1).optional(),
  expires_in_days: z.number().int().min(1).optional(),
  expires_at: z.string().datetime().optional().or(z.null()),
  notes: z.string().optional()
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'disabled'], {
    errorMap: () => ({ message: "Status must be either 'active' or 'disabled'" })
  })
});

const activateSchema = z.object({
  key: z.string().min(1, 'License key is required').trim(),
  hwid: z.string().min(1, 'Hardware ID (hwid) is required').trim(),
  computer_name: z.string().min(1, 'Computer name is required').trim(),
  ip_address: z.string().optional()
});

const validateSchema = z.object({
  key: z.string().min(1, 'License key is required').trim(),
  hwid: z.string().min(1, 'Hardware ID (hwid) is required').trim(),
  computer_name: z.string().optional(),
  ip_address: z.string().optional()
});

const deactivateSchema = z.object({
  key: z.string().min(1, 'License key is required').trim(),
  hwid: z.string().min(1, 'Hardware ID (hwid) is required').trim()
});

// ============================================================================
// PUBLIC / CLIENT ENDPOINTS
// ============================================================================

router.post('/activate', validate(activateSchema), activateLicense);
router.post('/validate', validate(validateSchema), validateLicense);
router.post('/deactivate', validate(deactivateSchema), deactivateLicense);

// ============================================================================
// PROTECTED ADMIN ENDPOINTS
// ============================================================================

router.post('/', protect, validate(createLicenseSchema), createLicense);
router.get('/', protect, getAllLicenses);
router.get('/:id', protect, getLicenseById);
router.patch('/:id/status', protect, validate(updateStatusSchema), updateLicenseStatus);
router.put('/:id', protect, validate(updateLicenseSchema), updateLicense);
router.delete('/:id', protect, deleteLicense);

module.exports = router;
