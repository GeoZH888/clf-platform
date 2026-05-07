import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data)
};

// Classes API
export const classesAPI = {
  getAll: () => api.get('/classes'),
  getOne: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  addStudent: (classId, data) => api.post(`/classes/${classId}/students`, data),
  removeStudent: (classId, studentId) => api.delete(`/classes/${classId}/students/${studentId}`)
};

// Homework API
export const homeworkAPI = {
  getAll: (params) => api.get('/homework', { params }),
  getOne: (id) => api.get(`/homework/${id}`),
  create: (data) => api.post('/homework', data),
  submit: (id, data) => api.post(`/homework/${id}/submit`, data),
  review: (submissionId, data) => api.put(`/homework/submissions/${submissionId}/review`, data),
  download: (id, filename) => api.get(`/homework/${id}/download/${filename}`, { responseType: 'blob' })
};

// Attendance API
export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
  getSummary: (classId) => api.get(`/attendance/summary/${classId}`),
  generateQR: (data) => api.post('/attendance/qrcode/generate', data),
  checkInQR: (data) => api.post('/attendance/checkin/qr', data),
  checkInManual: (data) => api.post('/attendance/checkin/manual', data),
  bulkUpdate: (data) => api.post('/attendance/bulk', data)
};

// HSK API
export const hskAPI = {
  register: (data) => api.post('/hsk/register', data),
  getRegistrations: () => api.get('/hsk/registrations'),
  updateRegistration: (id, data) => api.put(`/hsk/registrations/${id}`, data),
  getQuestions: (params) => api.get('/hsk/questions', { params }),
  submitAnswer: (data) => api.post('/hsk/practice/submit', data),
  getProgress: (studentId) => api.get('/hsk/practice/progress', { params: { student_id: studentId } }),
  getSelfTest: (level) => api.get(`/hsk/self-test/${level}`),
  getMaterials: (level) => api.get('/hsk/materials', { params: { level } })
};

// Reports API
export const reportsAPI = {
  getStudentReport: (studentId, params) => api.get(`/reports/student/${studentId}`, { params }),
  getClassReport: (classId, params) => api.get(`/reports/class/${classId}`, { params }),
  getTeacherReport: (teacherId) => api.get(`/reports/teacher/${teacherId}`),
  getAll: (params) => api.get('/reports', { params })
};

// AI API
export const aiAPI = {
  chat: (data) => api.post('/ai/chat', data),
  getChatHistory: (params) => api.get('/ai/chat/history', { params }),
  generatePPT: (data) => api.post('/ai/generate/ppt', data),
  generateQuiz: (data) => api.post('/ai/generate/quiz', data),
  generateMaterials: (data) => api.post('/ai/generate/materials', data),
  getGames: (hskLevel) => api.get('/ai/games', { params: { hsk_level: hskLevel } }),
  getGameData: (gameId, hskLevel) => api.get(`/ai/games/${gameId}/data`, { params: { hsk_level: hskLevel } }),
  getKnowledge: (params) => api.get('/ai/knowledge', { params }),
  createKnowledge: (data) => api.post('/ai/knowledge', data)
};

// Messages API
export const messagesAPI = {
  getAll: (params) => api.get('/messages', { params }),
  send: (data) => api.post('/messages', data),
  broadcast: (data) => api.post('/messages/broadcast', data),
  markRead: (id) => api.put(`/messages/${id}/read`)
};

// Events API
export const eventsAPI = {
  getAll: (params) => api.get('/events', { params }),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`)
};

// Admin API
export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getTasks: (params) => api.get('/admin/tasks', { params }),
  createTask: (data) => api.post('/admin/tasks', data),
  updateTask: (id, data) => api.put(`/admin/tasks/${id}`, data),
  getStats: () => api.get('/admin/stats')
};

export default api;
