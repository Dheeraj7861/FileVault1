import React, { createContext, useContext, useEffect, useState } from 'react';
import { authAPI } from '@/lib/api';

// Define type for our User
interface User {
  id: string;
  email: string | null;
  name: string | null;
  profilePicture?: string | null;
}

interface AuthContextProps {
  currentUser: User | null;
  loading: boolean;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserData: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch current user data from the API
  async function fetchCurrentUser() {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    try {
      const response = await authAPI.getCurrentUser();
      
      if (response.success && response.user) {
        const user = {
          id: response.user.id || response.user._id,
          email: response.user.email,
          name: response.user.name,
          profilePicture: response.user.profilePicture
        };
        
        // Update localStorage with latest user data
        localStorage.setItem('auth_user', JSON.stringify(user));
        
        return user;
      }
      return null;
    } catch (error) {
      console.error("Error fetching current user:", error);
      // If there's an error (like token expired), clear the stored data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      return null;
    }
  }

  async function refreshUserData() {
    const userData = await fetchCurrentUser();
    setCurrentUser(userData);
    return userData;
  }

  async function signup(email: string, password: string, name: string) {
    try {
      const response = await authAPI.register(name, email, password);
      
      if (response.success) {
        // Save token
        localStorage.setItem('auth_token', response.token);
        
        // Set current user
        const user = {
          id: response.user.id || response.user._id,
          email: response.user.email,
          name: response.user.name,
          profilePicture: response.user.profilePicture
        };
        
        localStorage.setItem('auth_user', JSON.stringify(user));
        setCurrentUser(user);
      } else {
        throw new Error(response.message || 'Failed to create account');
      }
    } catch (error) {
      console.error("Error during signup:", error);
      throw error;
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await authAPI.login(email, password);
      
      if (response.success) {
        // Set current user (token is saved in the API service)
        const user = {
          id: response.user.id || response.user._id,
          email: response.user.email,
          name: response.user.name,
          profilePicture: response.user.profilePicture
        };
        
        localStorage.setItem('auth_user', JSON.stringify(user));
        setCurrentUser(user);
        
        return response.user;
      } else {
        throw new Error(response.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error("Error during login:", error);
      throw error;
    }
  }

  async function logout() {
    try {
      authAPI.logout();
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setCurrentUser(null);
    } catch (error) {
      console.error("Error during logout:", error);
      throw error;
    }
  }

  function resetPassword(email: string) {
    return authAPI.forgotPassword(email)
      .then(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to send reset email');
        }
      });
  }

  useEffect(() => {
    async function initializeAuth() {
      // First try to get user from localStorage for immediate UI update
      const userJSON = localStorage.getItem('auth_user');
      const token = localStorage.getItem('auth_token');
      
      if (userJSON && token) {
        try {
          const user = JSON.parse(userJSON);
          setCurrentUser({
            id: user.id,
            email: user.email,
            name: user.name || user.displayName,
            profilePicture: user.profilePicture || user.photoURL
          });
          
          // In background, refresh the user data from API
          refreshUserData().catch(console.error);
        } catch (error) {
          console.error("Error parsing user from localStorage:", error);
          localStorage.removeItem('auth_user');
          localStorage.removeItem('auth_token');
          
          // Try to get fresh user data from API
          await refreshUserData();
        }
      } else if (token) {
        // If we have a token but no user data, try to fetch user
        await refreshUserData();
      }
      
      setLoading(false);
    }
    
    initializeAuth();
  }, []);

  const value = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
