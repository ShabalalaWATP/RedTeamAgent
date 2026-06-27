import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthState } from '../shared/types';

type AuthContextValue = {
  auth: AuthState | null;
  setAuth: (auth: AuthState | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = 'rta.auth';

function readStoredAuth(): AuthState | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed.userId || !parsed.email || !parsed.workspaceId || !parsed.workspaceName) return null;
    return {
      userId: parsed.userId,
      email: parsed.email,
      workspaceId: parsed.workspaceId,
      workspaceName: parsed.workspaceName,
      workspaceRole: parsed.workspaceRole ?? 'member',
      accountType: parsed.accountType ?? 'user',
      accountStatus: parsed.accountStatus ?? 'active',
      csrfToken: parsed.csrfToken ?? ''
    };
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(() => readStoredAuth());
  const value = useMemo<AuthContextValue>(() => {
    return {
      auth,
      setAuth: (next) => {
        if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        else sessionStorage.removeItem(STORAGE_KEY);
        setAuthState(next);
      }
    };
  }, [auth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
