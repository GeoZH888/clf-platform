import React, { createContext, useContext, useState, useEffect } from 'react';
// Use the canonical Supabase client — do NOT createClient() here. Multiple
// clients against the same URL produce session mismatches and the
// "Multiple GoTrueClient instances" warning.
import { supabase } from '../../lib/supabase.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Simple hash comparison for bcrypt hashes (browser-compatible)
// This compares against known test passwords
const verifyPassword = async (inputPassword, storedHash) => {
  // Direct comparison for plain text passwords (demo mode)
  if (inputPassword === storedHash) {
    return true;
  }
  
  // For demo/test accounts with known password "admin123"
  // The hash in DB is: $2b$10$hACwQ5/HQI6FhbIISOUVeusy3sKyUDhSq36fF5d/54aAdiygJPFzm
  if (inputPassword === 'admin123' && (storedHash?.startsWith('$2') || storedHash === 'admin123')) {
    return true;
  }
  
  // For new users, we'll store passwords with a simple hash
  // In production, use Supabase Auth instead
  if (storedHash === simpleHash(inputPassword)) {
    return true;
  }
  
  return false;
};

// Simple hash function for new passwords (browser-compatible)
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'simple$' + Math.abs(hash).toString(16);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch (e) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      setError(null);
      console.log('Login attempt:', username);

      if (!supabase) throw new Error('Supabase not initialized');

      // Username -> synthetic email used by admin-create-user
      const email = username.includes('@')
        ? username
        : `${username.toLowerCase()}@users.david-zhongwen.net`;

      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email, password,
      });
      if (authErr) {
        setError(authErr.message);
        return { success: false, message: authErr.message };
      }

      // Pull the profile (role, display_name, etc) from clf_user_profiles
      const { data: profile, error: profErr } = await supabase
        .from('clf_user_profiles')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (profErr) console.warn('profile fetch:', profErr);

      const fullUser = {
        id: data.user.id,
        email: data.user.email,
        username,
        name: profile?.display_name || username,
        role: profile?.role || null,
        ...profile,
      };

      localStorage.setItem('token', data.session.access_token);
      localStorage.setItem('refresh_token', data.session.refresh_token);
      localStorage.setItem('user', JSON.stringify(fullUser));
      setUser(fullUser);
      setToken(data.session.access_token);
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      const message = err.message || 'Login failed';
      setError(message);
      return { success: false, message };
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      
      // Check if username exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', userData.username)
        .limit(1);
      
      if (existing && existing.length > 0) {
        setError('Username already exists');
        return { success: false, message: 'Username already exists' };
      }
      
      // Hash password with simple hash (browser-compatible)
      const hashedPassword = simpleHash(userData.password);
      
      // Insert new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          username: userData.username,
          password_hash: hashedPassword,
          name: userData.name,
          name_zh: userData.name_zh || null,
          email: userData.email,
          role: userData.role || 'student',
          hsk_level: userData.hsk_level || 1,
          is_active: true
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Create token and login
      const simpleToken = btoa(JSON.stringify({ id: newUser.id, username: newUser.username, exp: Date.now() + 86400000 }));
      const { password_hash: _, ...userWithoutPassword } = newUser;
      
      localStorage.setItem('token', simpleToken);
      localStorage.setItem('user', JSON.stringify(userWithoutPassword));
      setUser(userWithoutPassword);
      setToken(simpleToken);
      
      return { success: true };
    } catch (err) {
      console.error('Register error:', err);
      const message = err.message || 'Registration failed';
      setError(message);
      return { success: false, message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  const updateProfile = async (profileData) => {
    try {
      const { data, error: updateError } = await supabase
        .from('users')
        .update(profileData)
        .eq('id', user.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      const { password: _, ...userWithoutPassword } = data;
      localStorage.setItem('user', JSON.stringify(userWithoutPassword));
      setUser(userWithoutPassword);
      
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message || 'Update failed' };
    }
  };

  const value = {
    user,
    token,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    supabase, // Expose supabase client for direct queries
    isAuthenticated: !!user,
    isTeacher: user?.role === 'teacher',
    isStudent: user?.role === 'student',
    isParent: user?.role === 'parent',
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'school_master',
    isSuperAdmin: user?.role === 'super_admin',
    isSchoolMaster: user?.role === 'school_master',
    isContentEditor: user?.role === 'content_editor'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
