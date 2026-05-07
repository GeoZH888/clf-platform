// src/teacher/pages/ClassesPage.jsx
import React from 'react';
import { PageHero } from '../../shared/RolePanelLayout';
import TeacherHome from './TeacherHome';

export default function ClassesPage() {
  return (
    <div>
      <PageHero icon="🏫" title="班级管理" subtitle="Classes" accentColor="#c41e3a"/>
      <TeacherHome />
    </div>
  );
}
