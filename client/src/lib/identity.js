// There is no real authentication in this build — see the README's
// "Identity" section for the full explanation. This module is the single
// place the rest of the app touches "who am I" and "which listings are
// mine," specifically so that swapping in real auth later (UConn NetID /
// @uconn.edu verification) means rewriting this one file plus a server-side
// auth middleware, not hunting down every component that reads a name out
// of localStorage.

const NAME_KEY = 'huskybook.identity.name';
const MY_PROVIDER_IDS_KEY = 'huskybook.identity.myProviderIds';

export function getStoredName() {
  return window.localStorage.getItem(NAME_KEY) || '';
}

export function setStoredName(name) {
  window.localStorage.setItem(NAME_KEY, name.trim());
}

export function getMyProviderIds() {
  try {
    const raw = window.localStorage.getItem(MY_PROVIDER_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addMyProviderId(id) {
  const ids = getMyProviderIds();
  if (!ids.includes(id)) {
    window.localStorage.setItem(MY_PROVIDER_IDS_KEY, JSON.stringify([...ids, id]));
  }
}
