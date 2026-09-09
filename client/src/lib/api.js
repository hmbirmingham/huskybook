const BASE_URL = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function fetchProviders(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.type) params.set('type', filters.type);
  if (filters.availableOnly) params.set('available', 'true');
  const qs = params.toString();
  return request(`/providers${qs ? `?${qs}` : ''}`);
}

export function createProvider(payload) {
  return request('/providers', { method: 'POST', body: JSON.stringify(payload) });
}

// The signed-in account's own listings — server derives "mine" from the
// session, not from anything the client tracks itself.
export function fetchMyProviders() {
  return request('/providers/mine');
}

export function fetchProviderRequests(providerId) {
  return request(`/providers/${providerId}/requests`);
}

export function createRequest(payload) {
  return request('/requests', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchMyRequests() {
  return request('/requests/mine');
}

export function updateRequestStatus(requestId, status) {
  return request(`/requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
