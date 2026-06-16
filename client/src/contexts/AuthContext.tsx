import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface UserInfo {
  employeeId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  primaryRoleName: string | null;
  privilegeLevel: number | null;
  permissions: string[];
  maxPrivilegeLevel: number;
  roles: Array<{ roleId: number; roleName: string; privilegeLevel: number }>;
  isRoleTesting?: boolean;
}

interface AuthStatus {
  isAuthenticated: boolean;
  employeeId: number | null;
  email: string | null;
  isLinked: boolean;
  samlEnabled: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLinked: boolean;
  email: string | null;
  isLoading: boolean;
  user: UserInfo | null;
  samlEnabled: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: authStatus, isLoading: isStatusLoading } = useQuery<AuthStatus>({
    queryKey: ['/api/auth/status'],
    staleTime: 30 * 1000,
    retry: false,
  });

  const { data: userInfo, isLoading: isUserLoading, refetch: refetchUser } = useQuery<UserInfo>({
    queryKey: ['/api/auth/permissions'],
    enabled: authStatus?.isAuthenticated === true,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: false,
  });

  // If the session-cookie identity flips (e.g., a different user SSO'd in
  // through RSA after the prior user closed the tab), force a refetch so the
  // SPA never paints the prior user's name from a stale cache.
  const currentIdentityKey = authStatus?.employeeId ?? authStatus?.email ?? null;
  useEffect(() => {
    if (authStatus?.isAuthenticated) {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/permissions'] });
    }
  }, [currentIdentityKey, authStatus?.isAuthenticated, queryClient]);

  const isAuthenticated = authStatus?.isAuthenticated ?? false;
  const isLinked = authStatus?.isLinked ?? false;
  const email = authStatus?.email ?? null;
  const samlEnabled = authStatus?.samlEnabled ?? false;
  const isLoading = isStatusLoading || (isAuthenticated && isUserLoading);

  const login = useCallback(() => {
    window.location.href = '/api/auth/login';
  }, []);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        queryClient.clear();
        window.location.href = '/';
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  }, [queryClient]);

  const value: AuthContextType = {
    isAuthenticated,
    isLinked,
    email,
    isLoading: isLoading || isLoggingOut,
    user: userInfo || null,
    samlEnabled,
    login,
    logout,
    refetchUser: () => refetchUser(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useIsAuthenticated() {
  const { isAuthenticated, isLoading } = useAuth();
  return { isAuthenticated, isLoading };
}

export function useUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}
