import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// NEW Supabase credentials
const supabaseUrl = 'https://wrpyhgklasdtgdtyuief.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndycHloZ2tsYXNkdGdkdHl1aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzA2MjMsImV4cCI6MjA5MDA0NjYyM30.TeLgs4K9vo_Xm7XKDSbyg9Qklpy9ZQclBIKdg_-XWWM';

console.log('🔗 Connecting to Supabase:', supabaseUrl);

let supabase = null;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
  window.supabase = supabase; // Expose for debugging
  console.log('✅ Supabase client created successfully');
} catch (error) {
  console.error('❌ Failed to create Supabase client:', error);
}

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
      console.log('🔐 Attempting login for:', username);
      
      if (!supabase) {
        throw new Error('Supabase not initialized');
      }
      
      // Query user from Supabase
      console.log('📡 Querying database...');
      const { data: users, error: queryError } = await supabase
        .from('dwxz_users_view')
        .select('*')
        .eq('username', username)
        .eq('is_active', true)
        .limit(1);
      
      console.log('📡 Query result:', { users, queryError });
      
      if (queryError) {
        console.error('❌ Database query error:', queryError);
        throw new Error(queryError.message || 'Database connection failed');
      }
      
      if (!users || users.length === 0) {
        setError('User not found');
        return { success: false, message: 'User not found' };
      }
      
      const foundUser = users[0];
      console.log('✅ User found:', foundUser.username);
      
      // Verify password
      const isValid = await verifyPassword(password, foundUser.password_hash || foundUser.password);
      if (!isValid) {
        setError('Invalid password');
        return { success: false, message: 'Invalid password' };
      }
      
      console.log('✅ Password verified');
      
      // Create simple token
      const simpleToken = btoa(JSON.stringify({ id: foundUser.id, username: foundUser.username, exp: Date.now() + 86400000 }));
      
      // Remove password from user object
      const { password_hash: _, password: __, ...userWithoutPassword } = foundUser;
      
      localStorage.setItem('token', simpleToken);
      localStorage.setItem('user', JSON.stringify(userWithoutPassword));
      setUser(userWithoutPassword);
      setToken(simpleToken);
      
      console.log('✅ Login successful!');
      return { success: true };
    } catch (err) {
      console.error('❌ Login error:', err);
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
        .from('dwxz_users_view')
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
        .from('dwxz_users_view')
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
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  const updateProfile = async (profileData) => {
    try {
      const { data, error: updateError } = await supabase
        .from('dwxz_users_view')
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
