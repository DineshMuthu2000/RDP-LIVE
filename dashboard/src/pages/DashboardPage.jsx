import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import LicenseTable from '../components/LicenseTable';
import LicenseModal from '../components/LicenseModal';
import DevicesModal from '../components/DevicesModal';
import { api } from '../services/api';
import { Key, ShieldCheck, ShieldAlert, Clock, Monitor, Plus, Search, Filter, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [licenseToEdit, setLicenseToEdit] = useState(null);
  const [selectedLicenseForDevices, setSelectedLicenseForDevices] = useState(null);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const res = await api.getLicenses(search, statusFilter);
      setLicenses(res.data || []);
    } catch (err) {
      console.error('Failed to fetch licenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, [search, statusFilter]);

  // Computed Stats
  const stats = useMemo(() => {
    const total = licenses.length;
    let active = 0;
    let disabled = 0;
    let expired = 0;
    let activeDevices = 0;

    const now = new Date();

    licenses.forEach((lic) => {
      activeDevices += lic.active_devices_count || 0;
      if (lic.expires_at && new Date(lic.expires_at) < now) {
        expired++;
      } else if (lic.status === 'active') {
        active++;
      } else if (lic.status === 'disabled') {
        disabled++;
      }
    });

    return { total, active, disabled, expired, activeDevices };
  }, [licenses]);

  // Handlers
  const handleOpenCreateModal = () => {
    setLicenseToEdit(null);
    setIsLicenseModalOpen(true);
  };

  const handleOpenEditModal = (license) => {
    setLicenseToEdit(license);
    setIsLicenseModalOpen(true);
  };

  const handleSaveLicense = async (payload) => {
    if (licenseToEdit) {
      await api.updateLicense(licenseToEdit.id, payload);
    } else {
      await api.createLicense(payload);
    }
    fetchLicenses();
  };

  const handleToggleStatus = async (id, newStatus) => {
    try {
      await api.updateLicenseStatus(id, newStatus);
      fetchLicenses();
    } catch (err) {
      alert(err.message || 'Failed to update license status');
    }
  };

  const handleDeleteLicense = async (id, customerName) => {
    if (window.confirm(`Are you sure you want to delete the license for "${customerName}"? This will also remove all device activation logs.`)) {
      try {
        await api.deleteLicense(id);
        fetchLicenses();
      } catch (err) {
        alert(err.message || 'Failed to delete license');
      }
    }
  };

  const handleViewDevices = async (license) => {
    try {
      const res = await api.getLicenseById(license.id);
      setSelectedLicenseForDevices(res.data);
    } catch (err) {
      alert('Failed to load device details');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        {/* Metric Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <StatCard title="Total Licenses" value={stats.total} icon={Key} color="gold" subtitle="All generated keys" />
          <StatCard title="Active Licenses" value={stats.active} icon={ShieldCheck} color="primary" subtitle="Valid & enabled keys" />
          <StatCard title="Disabled Licenses" value={stats.disabled} icon={ShieldAlert} color="danger" subtitle="Manually disabled" />
          <StatCard title="Expired Licenses" value={stats.expired} icon={Clock} color="warning" subtitle="Past subscription date" />
          <StatCard title="Active Devices" value={stats.activeDevices} icon={Monitor} color="info" subtitle="Total bound PCs" />
        </div>

        {/* Controls Bar: Search, Filters & Generate Button */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
          {/* Left: Search & Filter */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: 1, minWidth: '300px' }}>
            {/* Search */}
            <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
              <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '38px' }}
                placeholder="Search key, customer, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} color="var(--text-muted)" />
              <select
                className="input-field"
                style={{ width: '150px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            {/* Refresh */}
            <button onClick={fetchLicenses} className="btn btn-secondary btn-sm" title="Refresh List">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
          </div>

          {/* Right: Generate Key Button */}
          <button onClick={handleOpenCreateModal} className="btn btn-gold">
            <Plus size={18} />
            <span>Generate License Key</span>
          </button>
        </div>

        {/* License Table */}
        <LicenseTable
          licenses={licenses}
          onEdit={handleOpenEditModal}
          onViewDevices={handleViewDevices}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDeleteLicense}
        />
      </main>

      {/* Modals */}
      <LicenseModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        onSave={handleSaveLicense}
        licenseToEdit={licenseToEdit}
      />

      <DevicesModal
        isOpen={Boolean(selectedLicenseForDevices)}
        onClose={() => setSelectedLicenseForDevices(null)}
        license={selectedLicenseForDevices}
      />
    </div>
  );
}
