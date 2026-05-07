// src/school/SchoolApp.jsx
// Migrated from David-Chinese (phase A wholesale mount).
// All routes live under /school/* via the basename prop.
//
// PHASE B TODO: replace this AuthProvider with kechuang's unified one
// PHASE C TODO: super_admin should escape /school and redirect to /admin

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout';

// Auth Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { ForgotPasswordPage, ChangePasswordPage, TeacherResetApproval } from './pages/AuthPages';

// Main Pages
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';
import EventsPage from './pages/EventsPage';
import UserGuidePage from './pages/UserGuidePage';

// Teacher Pages
import TeacherHomeworkPage from './pages/TeacherHomeworkPage';
import TeacherMaterialsPage from './pages/TeacherMaterialsPage';
import TeacherCommunicationPage from './pages/TeacherCommunicationPage';
import ClassesPage from './pages/ClassesPage';
import AttendancePage from './pages/AttendancePage';

// Student Pages
import StudentLearningPage from './pages/StudentLearningPage';
import HomeworkPage from './pages/HomeworkPage';
import HSKPage from './pages/HSKPage';

// Parent Pages
import ParentDashboard from './pages/ParentDashboard';

// Admin Pages
import SuperAdminPage from './pages/SuperAdminPage';
import AdminPage from './pages/AdminPage';
import EnrollmentPage from './pages/EnrollmentPage';
import NotificationsPage from './pages/NotificationsPage';
import CultureManagementPage from './pages/CultureManagementPage';
import SchoolAdminPage from './pages/SchoolAdminPage';
import AITrainingMaterialsPage from './pages/AITrainingMaterialsPage';
import InvitationCodePage from './pages/InvitationCodePage';
import ApplicationReviewPage from './pages/ApplicationReviewPage';
import PointsAdminPage from './pages/PointsAdminPage';
import PointsCenterPage from './pages/PointsCenterPage';
import StudentAIAgentPage from './pages/StudentAIAgentPage';
import TeacherAIAgentPage from './pages/TeacherAIAgentPage';
import MaterialsLibraryPage from './pages/MaterialsLibraryPage';
import RAGManagementPage from './pages/RAGManagementPage';
import BulkPDFProcessorPage from './pages/BulkPDFProcessorPage';
import KnowledgeBaseManagerPage from './pages/KnowledgeBaseManagerPage';
import AITrainingCenterPage from './pages/AITrainingCenterPage';
import SchoolMasterPage from './pages/SchoolMasterPage';
import TeacherToolsPage from './pages/TeacherToolsPage';
import TeacherAssistantPage from './pages/TeacherAssistantPage';
import ContentEditorPage from './pages/ContentEditorPage';
import ChengyuManagementPage from './pages/ChengyuManagementPage';
import VideoManagementPage from './pages/VideoManagementPage';
import GameManagementPage from './pages/GameManagementPage';
import QuizManagementPage from './pages/QuizManagementPage';
import AIImageClassifierPage from './pages/AIImageClassifierPage';
import TeacherPointsPage from './pages/TeacherPointsPage';
import StudentHomeworkPage from './pages/StudentHomeworkPage';
import TeacherGradingPage from './pages/TeacherGradingPage';
import HSKTestManagementPage from './pages/HSKTestManagementPage';
import HSKPracticePage from './pages/HSKPracticePage';

// Shared Pages
import PublicLearningSpace from './pages/PublicLearningSpace';
import ReportsPage from './pages/ReportsPage';
import ChineseCulturePage from './pages/ChineseCulturePage';

// Teacher Application
import { TeacherApplicationPage, TeacherApplicationReview } from './pages/TeacherApplicationPages';

// AI Teacher Agent (智能工作台)
import TeacherAgentPage from './pages/TeacherAgentPage';

import TeacherDashboard from './teacher/TeacherDashboard';
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    switch (user?.role) {
      case 'super_admin': case 'admin': return <Navigate to="/admin" replace />;
      case 'teacher': return <Navigate to="/teacher" replace />;
      case 'student': return <Navigate to="/student" replace />;
      case 'parent': return <Navigate to="/parent" replace />;
      default: return <Navigate to="/dashboard" replace />;
    }
  }
  return children;
};

const RoleBasedRedirect = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  switch (user?.role) {
    case 'super_admin': case 'admin': return <Navigate to="/admin" replace />;
    case 'teacher': return <Navigate to="/teacher" replace />;
    case 'student': return <Navigate to="/student" replace />;
    case 'parent': return <Navigate to="/parent" replace />;
    default: return <Navigate to="/dashboard" replace />;
  }
};

function SchoolApp() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router basename="/school">
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            
            {/* Root Redirect */}
            <Route path="/" element={<RoleBasedRedirect />} />
            
            {/* Protected Routes with Layout */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="dashboard" element={<DashboardPage />} />
              
              {/* Teacher Routes */}
              <Route path="teacher" element={<DashboardPage />} />
              <Route path="teacher/homework" element={<TeacherHomeworkPage />} />
              <Route path="teacher/grading" element={<TeacherGradingPage />} />
              <Route path="teacher/materials" element={<TeacherMaterialsPage />} />
              <Route path="teacher/communication" element={<TeacherCommunicationPage />} />
              <Route path="teacher/classes" element={<ClassesPage />} />
              <Route path="teacher/attendance" element={<AttendancePage />} />
              <Route path="teacher/notifications" element={<NotificationsPage />} />
              <Route path="teacher/ai-workstation" element={<TeacherToolsPage />} />
              
              {/* Student Routes */}
              <Route path="student" element={<StudentLearningPage />} />
              <Route path="student/learning" element={<StudentLearningPage />} />
              <Route path="student/homework" element={<StudentHomeworkPage />} />
              <Route path="student/attendance" element={<AttendancePage />} />
              <Route path="student/hsk" element={<HSKPage />} />
              <Route path="student/hsk-practice" element={<HSKPracticePage />} />
              
              {/* Parent Routes */}
              <Route path="parent" element={<ParentDashboard />} />
              
              {/* Admin Routes */}
              <Route path="admin" element={<SuperAdminPage />} />
              <Route path="admin/users" element={<AdminPage />} />
              <Route path="admin/schools" element={<SuperAdminPage />} />
              <Route path="admin/content" element={<CultureManagementPage />} />
              <Route path="admin/ai-training" element={<AITrainingMaterialsPage />} />
              <Route path="admin/rag" element={<RAGManagementPage />} />
              <Route path="admin/bulk-upload" element={<BulkPDFProcessorPage />} />
              <Route path="admin/knowledge" element={<KnowledgeBaseManagerPage />} />
              <Route path="admin/ai-training" element={<AITrainingCenterPage />} />
              <Route path="teacher/ai-training" element={<AITrainingCenterPage />} />
              <Route path="teacher/tools" element={<TeacherToolsPage />} />
              <Route path="teacher/assistant" element={<TeacherAssistantPage />} />
              
              {/* Content Editor Routes */}
              <Route path="editor" element={<ContentEditorPage />} />
              <Route path="editor/chengyu" element={<ChengyuManagementPage />} />
              <Route path="editor/videos" element={<VideoManagementPage />} />
              <Route path="editor/games" element={<GameManagementPage />} />
              <Route path="editor/quizzes" element={<QuizManagementPage />} />
              <Route path="editor/knowledge" element={<ChengyuManagementPage />} />
              <Route path="editor/materials" element={<AITrainingCenterPage />} />
              <Route path="editor/hsk-tests" element={<HSKTestManagementPage />} />
              <Route path="ai-image-classifier" element={<AIImageClassifierPage />} />
              <Route path="admin/image-classifier" element={<AIImageClassifierPage />} />
              <Route path="admin/hsk-tests" element={<HSKTestManagementPage />} />
              <Route path="teacher/hsk-tests" element={<HSKTestManagementPage />} />
              
              {/* School Master Routes */}
              <Route path="school-master" element={<SchoolMasterPage />} />
              <Route path="school-master/teachers" element={<ClassesPage />} />
              <Route path="school-master/students" element={<ClassesPage />} />
              <Route path="school-master/classes" element={<ClassesPage />} />
              <Route path="school-master/applications" element={<ApplicationReviewPage />} />
              <Route path="school-master/invitation-codes" element={<InvitationCodePage />} />
              <Route path="school-master/ai-training" element={<AITrainingCenterPage />} />
              <Route path="school-master/attendance" element={<AttendancePage />} />
              <Route path="school-master/points" element={<PointsAdminPage />} />
              <Route path="admin/enrollments" element={<EnrollmentPage />} />
              <Route path="admin/notifications" element={<NotificationsPage />} />
              <Route path="admin/applications" element={<ApplicationReviewPage />} />
              <Route path="admin/invitation-codes" element={<InvitationCodePage />} />
              <Route path="admin/points" element={<PointsAdminPage />} />
              <Route path="admin/teacher-applications" element={<TeacherApplicationReview />} />
              
              {/* School Admin Routes */}
              <Route path="school-admin" element={<SchoolAdminPage />} />
              <Route path="school-admin/applications" element={<ApplicationReviewPage />} />
              <Route path="school-admin/invitation-codes" element={<InvitationCodePage />} />
              
              {/* Shared Routes */}
              <Route path="public" element={<PublicLearningSpace />} />
              <Route path="community" element={<PublicLearningSpace />} />
              <Route path="culture" element={<ChineseCulturePage />} />
              <Route path="guide" element={<UserGuidePage />} />
              <Route path="points" element={<PointsCenterPage />} />
              <Route path="materials" element={<MaterialsLibraryPage />} />
              <Route path="ai-assistant" element={<StudentAIAgentPage />} />
              <Route path="student/ai-agent" element={<StudentAIAgentPage />} />
              <Route path="teacher/ai-agent" element={<TeacherAIAgentPage />} />
              
              {/* Common Routes */}
              <Route path="classes" element={<ClassesPage />} />
              <Route path="homework" element={<HomeworkPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="hsk" element={<HSKPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="change-password" element={<ChangePasswordPage />} />
              
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
                    <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
        </Routes>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default SchoolApp;
