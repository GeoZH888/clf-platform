import { supabase, db, storage } from './supabase';
import bcrypt from 'bcryptjs';

// ============================================================
// API SERVICE FOR SUPABASE
// ============================================================

const api = {
  // ==================== AUTH ====================
  auth: {
    async login(username, password) {
      // Get user by username
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('is_active', true)
        .single();

      if (error || !user) {
        throw new Error('Invalid credentials');
      }

      // Verify password (compare with bcrypt hash)
      // Note: In production, you might want to use Supabase Auth instead
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        throw new Error('Invalid credentials');
      }

      // Store user in localStorage (simple auth)
      const userData = {
        id: user.id,
        username: user.username,
        name: user.name,
        name_zh: user.name_zh,
        email: user.email,
        role: user.role,
        hsk_level: user.hsk_level
      };
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', btoa(JSON.stringify({ userId: user.id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })));

      return { user: userData };
    },

    async register(userData) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const { data, error } = await supabase
        .from('users')
        .insert({
          username: userData.username,
          password_hash: hashedPassword,
          name: userData.name,
          email: userData.email,
          role: userData.role || 'student',
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return { user: data };
    },

    async logout() {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    },

    async getCurrentUser() {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      return JSON.parse(userStr);
    },

    async changePassword(userId, currentPassword, newPassword) {
      const { data: user } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single();

      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) throw new Error('Current password incorrect');

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const { error } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('id', userId);

      if (error) throw error;
      return { message: 'Password changed' };
    }
  },

  // ==================== USERS ====================
  users: {
    async getProfile(userId) {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, name, name_zh, email, phone, role, hsk_level, avatar_url')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },

    async updateProfile(userId, updates) {
      const { data, error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select();
      if (error) throw error;
      return data;
    },

    async getTeachers() {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, name_zh')
        .eq('role', 'teacher')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },

    async getAll() {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, name, name_zh, email, role, hsk_level, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async update(userId, updates) {
      const { data, error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select();
      if (error) throw error;
      return data;
    },

    async getStats() {
      // Get user counts by role
      const { data: users, error } = await supabase
        .from('users')
        .select('role, is_active');
      
      if (error) throw error;

      const stats = {
        total: users.length,
        active: users.filter(u => u.is_active).length,
        byRole: {}
      };

      users.forEach(u => {
        stats.byRole[u.role] = (stats.byRole[u.role] || 0) + 1;
      });

      return stats;
    }
  },

  // ==================== CLASSES ====================
  classes: {
    async getAll() {
      const { data, error } = await supabase
        .from('classes')
        .select(`*, teacher:users!teacher_id(id, name, name_zh)`)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },

    async getById(id) {
      const { data, error } = await supabase
        .from('classes')
        .select(`*, teacher:users!teacher_id(id, name, name_zh)`)
        .eq('id', id)
        .single();
      if (error) throw error;

      // Get enrolled students
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select(`student:users!student_id(id, name, name_zh, email)`)
        .eq('class_id', id)
        .eq('status', 'active');

      return { ...data, students: enrollments?.map(e => e.student) || [] };
    },

    async getByTeacher(teacherId) {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },

    async getByStudent(studentId) {
      const { data, error } = await supabase
        .from('class_enrollments')
        .select(`class:classes(*, teacher:users!teacher_id(name, name_zh))`)
        .eq('student_id', studentId)
        .eq('status', 'active');
      if (error) throw error;
      return data?.map(e => e.class) || [];
    },

    async create(classData) {
      const { data, error } = await supabase
        .from('classes')
        .insert(classData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async enroll(classId, studentId) {
      const { data, error } = await supabase
        .from('class_enrollments')
        .upsert({ class_id: classId, student_id: studentId, status: 'active' })
        .select();
      if (error) throw error;
      return data;
    }
  },

  // ==================== HOMEWORK ====================
  homework: {
    async getByTeacher(teacherId) {
      const { data, error } = await supabase
        .from('homework')
        .select(`*, class:classes(name, name_zh)`)
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async getByStudent(studentId) {
      // Get student's classes
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('class_id')
        .eq('student_id', studentId)
        .eq('status', 'active');

      const classIds = enrollments?.map(e => e.class_id) || [];

      const { data, error } = await supabase
        .from('homework')
        .select(`*, teacher:users!teacher_id(name)`)
        .in('class_id', classIds)
        .eq('is_active', true)
        .order('due_date');

      if (error) throw error;

      // Get submissions
      const { data: submissions } = await supabase
        .from('homework_submissions')
        .select('homework_id, id, score, status')
        .eq('student_id', studentId);

      const submissionMap = {};
      submissions?.forEach(s => { submissionMap[s.homework_id] = s; });

      return data?.map(h => ({ ...h, submission: submissionMap[h.id] })) || [];
    },

    async create(homeworkData) {
      const { data, error } = await supabase
        .from('homework')
        .insert(homeworkData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getSubmissions(homeworkId) {
      const { data, error } = await supabase
        .from('homework_submissions')
        .select(`*, student:users!student_id(id, name, name_zh)`)
        .eq('homework_id', homeworkId);
      if (error) throw error;
      return data;
    },

    async submit(homeworkId, studentId, submission) {
      const { data, error } = await supabase
        .from('homework_submissions')
        .upsert({
          homework_id: homeworkId,
          student_id: studentId,
          ...submission,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async grade(submissionId, graderId, score, feedback) {
      const { data, error } = await supabase
        .from('homework_submissions')
        .update({
          score,
          feedback,
          status: 'graded',
          graded_at: new Date().toISOString(),
          graded_by: graderId
        })
        .eq('id', submissionId)
        .select();
      if (error) throw error;
      return data;
    }
  },

  // ==================== ATTENDANCE ====================
  attendance: {
    async getByClass(classId, date = null) {
      let query = supabase
        .from('attendance')
        .select(`*, student:users!student_id(id, name, name_zh)`)
        .eq('class_id', classId);
      if (date) query = query.eq('date', date);
      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      return data;
    },

    async getByStudent(studentId) {
      const { data, error } = await supabase
        .from('attendance')
        .select(`*, class:classes(name, name_zh)`)
        .eq('student_id', studentId)
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },

    async record(classId, studentId, date, status, recordedBy) {
      const { data, error } = await supabase
        .from('attendance')
        .upsert({
          class_id: classId,
          student_id: studentId,
          date,
          status,
          recorded_by: recordedBy,
          check_in_time: new Date().toISOString()
        })
        .select();
      if (error) throw error;
      return data;
    }
  },

  // ==================== HSK ====================
  hsk: {
    async getQuestions(level, type = null, limit = 10) {
      let query = supabase
        .from('hsk_questions')
        .select('*')
        .eq('level', level)
        .eq('is_active', true);
      if (type) query = query.eq('type', type);
      const { data, error } = await query.limit(limit);
      if (error) throw error;
      return data;
    },

    async recordPractice(studentId, questionId, userAnswer, isCorrect, timeSpent) {
      const { data, error } = await supabase
        .from('hsk_practice')
        .insert({
          student_id: studentId,
          question_id: questionId,
          user_answer: userAnswer,
          is_correct: isCorrect,
          time_spent: timeSpent
        })
        .select();
      if (error) throw error;
      return data;
    },

    async getProgress(studentId) {
      const { data, error } = await supabase
        .from('hsk_practice')
        .select(`
          is_correct,
          question:hsk_questions(level, type)
        `)
        .eq('student_id', studentId);
      if (error) throw error;

      // Aggregate stats
      const stats = {};
      data?.forEach(p => {
        const key = `${p.question?.level}-${p.question?.type}`;
        if (!stats[key]) stats[key] = { level: p.question?.level, type: p.question?.type, total: 0, correct: 0 };
        stats[key].total++;
        if (p.is_correct) stats[key].correct++;
      });

      return Object.values(stats);
    },

    async getRegistrations(studentId) {
      const { data, error } = await supabase
        .from('hsk_registrations')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async register(studentId, level, examDate, examLocation) {
      const { data, error } = await supabase
        .from('hsk_registrations')
        .insert({
          student_id: studentId,
          level,
          exam_date: examDate,
          exam_location: examLocation
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // ==================== CULTURE ====================
  culture: {
    async getChengyu() {
      const { data, error } = await supabase
        .from('chengyu')
        .select('*')
        .eq('is_active', true)
        .order('hsk_level');
      if (error) throw error;
      return data;
    },

    async createChengyu(chengyuData) {
      const { data, error } = await supabase
        .from('chengyu')
        .insert(chengyuData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async updateChengyu(id, updates) {
      const { data, error } = await supabase
        .from('chengyu')
        .update(updates)
        .eq('id', id)
        .select();
      if (error) throw error;
      return data;
    },

    async deleteChengyu(id) {
      const { error } = await supabase
        .from('chengyu')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },

    async getVideos() {
      const { data, error } = await supabase
        .from('culture_videos')
        .select('*')
        .eq('is_active', true)
        .order('views', { ascending: false });
      if (error) throw error;
      return data;
    },

    async getKnowledge() {
      const { data, error } = await supabase
        .from('culture_knowledge')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    }
  },

  // ==================== MESSAGES ====================
  messages: {
    async getInbox(userId) {
      const { data, error } = await supabase
        .from('messages')
        .select(`*, sender:users!sender_id(id, name, name_zh)`)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async getSent(userId) {
      const { data, error } = await supabase
        .from('messages')
        .select(`*, recipient:users!recipient_id(id, name, name_zh)`)
        .eq('sender_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async send(senderId, recipientId, subject, content, options = {}) {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: senderId,
          recipient_id: recipientId,
          subject,
          content,
          ...options
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async markRead(messageId) {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) throw error;
    }
  },

  // ==================== TEACHER APPLICATIONS ====================
  teacherApplications: {
    async getMyApplication(userId) {
      const { data, error } = await supabase
        .from('teacher_applications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // Ignore not found
      return data;
    },

    async submit(application) {
      const { data, error } = await supabase
        .from('teacher_applications')
        .insert(application)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getAll(status = null) {
      let query = supabase
        .from('teacher_applications')
        .select(`*, user:users!user_id(username, name)`);
      if (status && status !== 'all') query = query.eq('status', status);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async approve(id, reviewerId, notes) {
      // Update application
      const { data: app } = await supabase
        .from('teacher_applications')
        .update({
          status: 'approved',
          reviewer_id: reviewerId,
          reviewer_notes: notes,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('user_id')
        .single();

      // Upgrade user to teacher
      if (app?.user_id) {
        await supabase
          .from('users')
          .update({ role: 'teacher' })
          .eq('id', app.user_id);
      }

      return { message: 'Approved' };
    },

    async reject(id, reviewerId, notes) {
      const { error } = await supabase
        .from('teacher_applications')
        .update({
          status: 'rejected',
          reviewer_id: reviewerId,
          reviewer_notes: notes,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
      return { message: 'Rejected' };
    }
  },

  // ==================== ADMIN ====================
  admin: {
    async getStats() {
      const [users, students, teachers, classes, homework, applications] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('users').select('id', { count: 'exact' }).eq('role', 'student'),
        supabase.from('users').select('id', { count: 'exact' }).eq('role', 'teacher'),
        supabase.from('classes').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('homework').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('teacher_applications').select('id', { count: 'exact' }).eq('status', 'pending')
      ]);

      return {
        total_users: users.count || 0,
        students: students.count || 0,
        teachers: teachers.count || 0,
        classes: classes.count || 0,
        homework: homework.count || 0,
        pending_applications: applications.count || 0
      };
    },

    async createUser(userData) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const { data, error } = await supabase
        .from('users')
        .insert({ ...userData, password: hashedPassword })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async updateUser(userId, updates) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select();
      if (error) throw error;
      return data;
    },

    async toggleUserActive(userId) {
      const { data: user } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', userId)
        .single();

      const { error } = await supabase
        .from('users')
        .update({ is_active: !user?.is_active })
        .eq('id', userId);
      if (error) throw error;
    }
  },

  // ==================== STORAGE ====================
  storage: {
    async uploadFile(bucket, path, file) {
      const { data, error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) throw error;
      return data;
    },

    getPublicUrl(bucket, path) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    }
  }
};

export default api;
