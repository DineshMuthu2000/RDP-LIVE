import React from 'react';

export default function StatCard({ title, value, icon: Icon, color = 'primary', subtitle }) {
  const colorStyles = {
    primary: { iconBg: 'rgba(16, 185, 129, 0.15)', iconColor: '#34d399', border: 'rgba(16, 185, 129, 0.2)' },
    gold: { iconBg: 'rgba(212, 175, 55, 0.15)', iconColor: '#d4af37', border: 'rgba(212, 175, 55, 0.2)' },
    danger: { iconBg: 'rgba(239, 68, 68, 0.15)', iconColor: '#fca5a5', border: 'rgba(239, 68, 68, 0.2)' },
    warning: { iconBg: 'rgba(245, 158, 11, 0.15)', iconColor: '#fbbf24', border: 'rgba(245, 158, 11, 0.2)' },
    info: { iconBg: 'rgba(59, 130, 246, 0.15)', iconColor: '#60a5fa', border: 'rgba(59, 130, 246, 0.2)' },
  };

  const style = colorStyles[color] || colorStyles.primary;

  return (
    <div className="glass-panel glass-panel-hover" style={{ padding: '20px 24px', borderColor: style.border }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
            {title}
          </p>
          <h3 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            {value}
          </h3>
          {subtitle && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: style.iconBg,
            color: style.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {Icon && <Icon size={24} />}
        </div>
      </div>
    </div>
  );
}
