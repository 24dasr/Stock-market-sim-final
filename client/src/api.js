const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('stxsim_token');
}

async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    // Handle 401 — token expired
    if (response.status === 401) {
        localStorage.removeItem('stxsim_token');
        localStorage.removeItem('stxsim_user');
        window.location.href = '/login';
        throw new Error('Session expired');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    // Handle CSV downloads
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/csv')) {
        return response.blob();
    }

    return response.json();
}

export const api = {
    // Auth
    login: (username, password) =>
        apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    logout: () =>
        apiRequest('/auth/logout', { method: 'POST' }),

    // Bootstrap
    bootstrap: () => apiRequest('/bootstrap'),

    // Admin
    getUsers: () => apiRequest('/admin/users'),
    createUser: (data) =>
        apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    deleteUser: (id) =>
        apiRequest(`/admin/users/${id}`, { method: 'DELETE' }),
    updateCompany: (id, data) =>
        apiRequest(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    toggleCompanyStock: (id) =>
        apiRequest(`/companies/${id}/toggle`, { method: 'PATCH' }),
    toggleMarket: (isOpen) =>
        apiRequest('/market', { method: 'PATCH', body: JSON.stringify({ isOpen }) }),
    updateMarketConfig: (config) =>
        apiRequest('/admin/config', { method: 'PATCH', body: JSON.stringify(config) }),
    getAdminTrades: (filters = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
        const qs = params.toString();
        return apiRequest(`/admin/trades${qs ? `?${qs}` : ''}`);
    },
    exportTrades: () => apiRequest('/admin/trades/export'),
    resetSystem: () => apiRequest('/admin/reset', { method: 'POST' }),
    getAnalytics: () => apiRequest('/admin/analytics'),
    exportAll: async () => {
        const token = getToken();
        const response = await fetch(`${API_BASE}/admin/export-all`, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            }
        });
        if (!response.ok) throw new Error('Export failed');
        return response.blob();
    },

    // Events
    getEvents: () => apiRequest('/events'),
    createEvent: (data) =>
        apiRequest('/events', { method: 'POST', body: JSON.stringify(data) }),
    fireEvent: (id) =>
        apiRequest(`/events/${id}/fire`, { method: 'POST' }),
    pauseEvent: (id) =>
        apiRequest(`/events/${id}/pause`, { method: 'POST' }),
    stopEvent: (id) =>
        apiRequest(`/events/${id}/stop`, { method: 'POST' }),
    deleteEvent: (id) =>
        apiRequest(`/events/${id}`, { method: 'DELETE' }),

    // Participant
    getMyCompany: () => apiRequest('/companies/me'),
    updateMyShares: (sharesAvailable) =>
        apiRequest('/companies/me/shares', { method: 'PATCH', body: JSON.stringify({ sharesAvailable }) }),
    getMarketCompanies: () => apiRequest('/companies'),
    buyShares: (targetCompanyId, shares) =>
        apiRequest('/trades/buy', { method: 'POST', body: JSON.stringify({ targetCompanyId, shares }) }),
    sellShares: (targetCompanyId, shares, pricePerShare) =>
        apiRequest('/trades/sell', { method: 'POST', body: JSON.stringify({ targetCompanyId, shares, pricePerShare }) }),
    buyP2P: (orderId) =>
        apiRequest('/trades/buy-p2p', { method: 'POST', body: JSON.stringify({ orderId }) }),
    withdrawSellOrder: (orderId) =>
        apiRequest('/trades/sell/withdraw', { method: 'POST', body: JSON.stringify({ orderId }) }),
    getSellOrders: () => apiRequest('/trades/orders'),
    getPortfolio: () => apiRequest('/portfolio'),
    getMyTrades: () => apiRequest('/trades/me'),

    // Shared
    getLeaderboard: () => apiRequest('/leaderboard'),
    getHistory: () => apiRequest('/companies/history'),
};
