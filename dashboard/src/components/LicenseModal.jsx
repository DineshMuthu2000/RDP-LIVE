import React, { useState, useEffect } from 'react';
import { X, Key, User, Mail, Monitor, Calendar, FileText, CheckCircle2 } from 'lucide-react';

export default function LicenseModal({ isOpen, onClose, onSave, licenseToEdit }) {
  const isEditing = Boolean(licenseToEdit);

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    max_pcs: 1,
    expires_in_days: 30,
    expires_at: '',
    notes: '',
    custom_key: '',
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (licenseToEdit) {
      setFormData({
        customer_name: licenseToEdit.customer_name || '',
        customer_email: licenseToEdit.customer_email || '',
        max_pcs: licenseToEdit.max_pcs || 1,
        expires_in_days: '',
        expires_at: licenseToEdit.expires_at ? licenseToEdit.expires_at.substring(0, 10) : '',
        notes: licenseToEdit.notes || '',
        custom_key: licenseToEdit.license_key || '',
      });
    } else {
      setFormData({
        customer_name: '',
        customer_email: '',
        max_pcs: 1,
        expires_in_days: 30,
        expires_at: '',
        notes: '',
        custom_key: '',
      });
    }
    setError('');
  }, [licenseToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || undefined,
        max_pcs: Number(formData.max_pcs),
        notes: formData.notes || undefined,
      };

      if (!isEditing) {
        if (formData.custom_key) payload.custom_key = formData.custom_key;
        if (formData.expires_at) {
          payload.expires_at = new Date(formData.expires_at).toISOString();
        } else if (formData.expires_in_days) {
          payload.expires_in_days = Number(formData.expires_in_days);
        }
      } else {
        if (formData.expires_at) {
          payload.expires_at = new Date(formData.expires_at).toISOString();
        } else {
          payload.expires_at = null;
        }
      }

      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save license');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Key size={22} color="var(--gold)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
              {isEditing ? 'Edit License Key' : 'Generate New License'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Customer Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Customer Name *
            </label>
            <input
              type="text"
              required
              className="input-field"
              placeholder="e.g. John Doe / Acme Corp"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            />
          </div>

          {/* Customer Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Customer Email (Optional)
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="client@example.com"
              value={formData.customer_email}
              onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
            />
          </div>

          {/* Max PCs & Expiry Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Max PCs / Devices *
              </label>
              <input
                type="number"
                min="1"
                required
                className="input-field"
                value={formData.max_pcs}
                onChange={(e) => setFormData({ ...formData, max_pcs: e.target.value })}
              />
            </div>

            {!isEditing ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Valid Duration (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  placeholder="e.g. 30"
                  value={formData.expires_in_days}
                  onChange={(e) => setFormData({ ...formData, expires_in_days: e.target.value })}
                />
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Expiration Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Custom Key (Create only) */}
          {!isEditing && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Custom License Key (Optional)
              </label>
              <input
                type="text"
                className="input-field font-mono"
                placeholder="Auto-generated if left blank"
                value={formData.custom_key}
                onChange={(e) => setFormData({ ...formData, custom_key: e.target.value })}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Notes / Plan Info
            </label>
            <textarea
              className="input-field"
              rows="3"
              placeholder="e.g. Enterprise Plan 2026"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            ></textarea>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-gold">
              <CheckCircle2 size={16} />
              <span>{submitting ? 'Saving...' : isEditing ? 'Update License' : 'Generate Key'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
