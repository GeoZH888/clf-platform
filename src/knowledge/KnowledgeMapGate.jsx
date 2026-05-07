// src/knowledge/KnowledgeMapGate.jsx
import React from 'react';
import { AuthProvider } from '../school/contexts/AuthContext';
import { LanguageProvider } from '../school/contexts/LanguageContext';
import KnowledgeMap from './KnowledgeMap';

export default function KnowledgeMapGate() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <KnowledgeMap/>
      </AuthProvider>
    </LanguageProvider>
  );
}
