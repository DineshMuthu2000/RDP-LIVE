const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getProfile: () => request('/auth/me'),

  getHealth: () => request('/health'),

  getLicenses: (search = '', status = '') => {
    const query = new URLSearchParams();
    if (search) query.append('search', search);
    if (status) query.append('status', status);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/licenses${queryString}`);
  },

  getLicenseById: (id) => request(`/licenses/${id}`),

  createLicense: (payload) =>
    request('/licenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateLicense: (id, payload) =>
    request(`/licenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  updateLicenseStatus: (id, status) =>
    request(`/licenses/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteLicense: (id) =>
    request(`/licenses/${id}`, {
      method: 'DELETE',
    }),
};
