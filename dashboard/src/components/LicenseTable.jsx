import React, { useState } from 'react';
import { Copy, Check, Edit2, Monitor, ToggleLeft, ToggleRight, Trash2, Calendar, Shield, Mail, User } from 'lucide-react';

export default function LicenseTable({ licenses, onEdit, onViewDevices, onToggleStatus, onDelete }) {
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="table-container glass-panel">
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>License Key</th>
            <th>Customer</th>
            <th>Device Limit</th>
            <th>Expiration</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {licenses.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                No licenses found matching criteria.
              </td>
            </tr>
          ) : (
            licenses.map((lic) => {
              const expired = isExpired(lic.expires_at);

              return (
                <tr key={lic.id}>
                  {/* Status */}
                  <td>
                    {expired ? (
                      <span className="badge badge-expired">Expired</span>
                    ) : lic.status === 'active' ? (
                      <span className="badge badge-active">Active</span>
                    ) : (
                      <span className="badge badge-disabled">Disabled</span>
                    )}
                  </td>

                  {/* License Key */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="font-mono" style={{ fontWeight: '600', color: 'var(--gold)', letterSpacing: '0.04em' }}>
                        {lic.license_key}
                      </span>
                      <button
                        onClick={() => handleCopy(lic.license_key)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        title="Copy License Key"
                      >
                        {copiedKey === lic.license_key ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                      </button>
                    </div>
                    {lic.notes && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {lic.notes}
                      </div>
                    )}
                  </td>

                  {/* Customer */}
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{lic.customer_name}</div>
                    {lic.customer_email && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lic.customer_email}</div>
                    )}
                  </td>

                  {/* PC Limit */}
                  <td>
                    <div style={{ fontSize: '0.875rem' }}>
                      <strong style={{ color: lic.active_devices_count >= lic.max_pcs ? 'var(--warning)' : 'var(--primary)' }}>
                        {lic.active_devices_count || 0}
                      </strong>{' '}
                      / {lic.max_pcs} PCs
                    </div>
                  </td>

                  {/* Expiration */}
                  <td>
                    <div style={{ fontSize: '0.85rem' }}>
                      {lic.expires_at ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} color="var(--text-dim)" />
                          <span>{new Date(lic.expires_at).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span style={{ color: '#34d399', fontWeight: '600', fontSize: '0.8rem' }}>Lifetime</span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {/* View Devices */}
                      <button
                        onClick={() => onViewDevices(lic)}
                        className="btn btn-secondary btn-sm"
                        title="View Bound Devices"
                      >
                        <Monitor size={14} />
                        <span>Devices ({lic.active_devices_count || 0})</span>
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => onEdit(lic)}
                        className="btn btn-secondary btn-sm"
                        title="Edit License"
                      >
                        <Edit2 size={14} />
                      </button>

                      {/* Toggle Status */}
                      <button
                        onClick={() => onToggleStatus(lic.id, lic.status === 'active' ? 'disabled' : 'active')}
                        className={`btn btn-sm ${lic.status === 'active' ? 'btn-secondary' : 'btn-gold'}`}
                        title={lic.status === 'active' ? 'Disable License' : 'Enable License'}
                      >
                        {lic.status === 'active' ? <ToggleRight size={16} color="#34d399" /> : <ToggleLeft size={16} />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => onDelete(lic.id, lic.customer_name)}
                        className="btn btn-danger btn-sm"
                        title="Delete License"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
