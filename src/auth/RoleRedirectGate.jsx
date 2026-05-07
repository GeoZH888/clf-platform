import React from 'react';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import RoleRedirect from './RoleRedirect';

export default function RoleRedirectGate() {
  return (
    <LanguageProvider><AuthProvider><RoleRedirect /></AuthProvider></LanguageProvider>
  );
}
