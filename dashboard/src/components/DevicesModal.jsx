import React from 'react';
import { X, Monitor, Cpu, Globe, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function DevicesModal({ isOpen, onClose, license }) {
  if (!isOpen || !license) return null;

  const activations = license.activations || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor size={22} color="var(--primary)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Bound Devices & Activation History</h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Key: <span className="font-mono" style={{ color: 'var(--gold)' }}>{license.license_key}</span> | Customer: <strong>{license.customer_name}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Devices Summary Bar */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', padding: '12px 16px', background: 'rgba(10, 24, 19, 0.6)', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
          <div style={{ fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Device Allocation: </span>
            <strong style={{ color: 'var(--text-main)' }}>{license.active_devices_count} / {license.max_pcs} PCs</strong>
          </div>
        </div>

        {/* Activations List */}
        {activations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <Monitor size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
            <p>No devices have been activated with this key yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Computer / HWID</th>
                  <th>IP Address</th>
                  <th>Activated</th>
                  <th>Last Validated</th>
                </tr>
              </thead>
              <tbody>
                {activations.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <span className={`badge ${device.status === 'active' ? 'badge-active' : 'badge-disabled'}`}>
                        {device.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{device.computer_name}</div>
                      <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{device.hwid}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <Globe size={14} color="var(--text-dim)" />
                        <span>{device.ip_address}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(device.activated_at).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(device.last_validated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
