import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { db } from '@/api/db';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const initialDone = useRef(false);

  // Turn a Supabase session into app state (profile + role).
  const applySession = useCallback(async (session) => {
    if (!session) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      return;
    }
    try {
      const profile = await db.auth.me();
      setUser((prev) =>
        prev && prev.id === profile.id && prev.role === profile.role && prev.full_name === profile.full_name ? prev : profile
      );
      setIsAuthenticated(true);
      // 'pending' = signed up but not approved by an admin yet
      if (!profile.role || profile.role === 'pending') {
        setAuthError({ type: 'user_not_registered', message: 'Your account is waiting for admin approval.' });
      } else {
        setAuthError(null);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      setUser(null);
      setIsAuthenticated(true); // signed in, but profile could not be loaded
      setAuthError({ type: 'profile_error', message: error.message || 'Could not load your profile.' });
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await applySession(session);
    setAuthChecked(true);
    setIsLoadingAuth(false);
  }, [applySession]);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      await applySession(session);
      initialDone.current = true;
      setAuthChecked(true);
      setIsLoadingAuth(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || !initialDone.current) return;
      // defer: don't call supabase from inside the auth callback
      setTimeout(() => active && applySession(session), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    await db.auth.logout(shouldRedirect ? window.location.href : undefined);
  };

  const navigateToLogin = () => db.auth.redirectToLogin();

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: null,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState: checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
