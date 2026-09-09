// There is no real authentication in this build — see the README's
// "Identity" section for the full explanation. This module is the single
// place the rest of the app touches "who am I" and "which listings are
// mine," specifically so that swapping in real auth later (UConn NetID /
// @uconn.edu verification) means rewriting this one file plus a server-side
// auth middleware, not hunting down every component that reads a name out
// of localStorage.

const NAME_KEY = 'huskybook.identity.name';
const MY_LISTINGS_KEY = 'huskybook.identity.myListings';

export function getStoredName() {
  return window.localStorage.getItem(NAME_KEY) || '';
}

export function setStoredName(name) {
  window.localStorage.setItem(NAME_KEY, name.trim());
}

// Stored as {id, name} pairs, not bare ids, so Manage Requests can show
// "Marcus T." in a picker instead of "Listing #1" — the name is free
// (List Yourself already knows it at creation time) and saves a round
// trip to the server just to label a dropdown.
export function getMyListings() {
  try {
    const raw = window.localStorage.getItem(MY_LISTINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addMyListing({ id, name }) {
  const listings = getMyListings();
  if (!listings.some((l) => l.id === id)) {
    window.localStorage.setItem(MY_LISTINGS_KEY, JSON.stringify([...listings, { id, name }]));
  }
}

// Needed for the case where a remembered listing id no longer resolves on
// the server (deleted, or a database reset during local development) —
// without this there'd be no way for the browser to forget a dead
// reference short of clearing all site data.
export function removeMyListing(id) {
  const remaining = getMyListings().filter((l) => l.id !== id);
  window.localStorage.setItem(MY_LISTINGS_KEY, JSON.stringify(remaining));
  return remaining;
}
