const BASE_URL = '/api/auth';

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

export function requestLoginLink(email) {
  return request('/request-link', { method: 'POST', body: JSON.stringify({ email }) });
}

export function verifyLoginToken(token) {
  return request(`/verify?token=${encodeURIComponent(token)}`);
}

export function fetchCurrentUser() {
  return request('/me');
}

export function updateDisplayName(displayName) {
  return request('/me', { method: 'PATCH', body: JSON.stringify({ displayName }) });
}

export function logoutRequest() {
  return request('/logout', { method: 'POST' });
}
