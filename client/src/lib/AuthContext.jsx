import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  fetchCurrentUser,
  requestLoginLink,
  verifyLoginToken,
  updateDisplayName as updateDisplayNameRequest,
  logoutRequest,
} from './auth.js';

// The one place the rest of the app reads/changes "who is signed in." Every
// page reads identity through useAuth() instead of touching cookies or the
// API directly, the same seam identity.js used to be for the old
// localStorage-based stand-in.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const requestLink = useCallback((email) => requestLoginLink(email), []);

  const verify = useCallback(async (token) => {
    const data = await verifyLoginToken(token);
    setUser(data.user);
    return data.user;
  }, []);

  const setDisplayName = useCallback(async (displayName) => {
    const data = await updateDisplayNameRequest(displayName);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, requestLink, verify, setDisplayName, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
