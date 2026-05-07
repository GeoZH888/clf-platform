import { createClient } from '@supabase/supabase-js';

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================
// Get these values from your Supabase project:
// 1. Go to https://app.supabase.com
// 2. Select your project
// 3. Go to Settings > API
// 4. Copy the URL and anon/public key
// ============================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yqcojudvvjntaajnrilr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxY29qdWR2dmpudGFham5yaWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDkxNzQsImV4cCI6MjA5MDkyNTE3NH0.pJuxsTRieYTnZtEysOLcPfUZ9Map0z74o2lKtc8uGAk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// AUTH HELPERS
// ============================================================

export const authHelpers = {
  // Sign up new user
  async signUp(email, password, userData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData // { name, role, etc. }
      }
    });
    return { data, error };
  },

  // Sign in
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Get current user
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Get session
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  // Listen to auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// ============================================================
// DATABASE HELPERS
// ============================================================

export const db = {
  // Generic query helpers
  async select(table, columns = '*', filters = {}) {
    let query = supabase.from(table).select(columns);
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    const { data, error } = await query;
    return { data, error };
  },

  async insert(table, data) {
    const { data: result, error } = await supabase.from(table).insert(data).select();
    return { data: result, error };
  },

  async update(table, id, data) {
    const { data: result, error } = await supabase.from(table).update(data).eq('id', id).select();
    return { data: result, error };
  },

  async delete(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    return { error };
  },

  // Specific table helpers
  users: {
    async getByUsername(username) {
      const { data, error } = await supabase.from('users').select('*').eq('username', username).single();
      return { data, error };
    },
    async getById(id) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
      return { data, error };
    },
    async updateProfile(id, updates) {
      const { data, error } = await supabase.from('users').update(updates).eq('id', id).select();
      return { data, error };
    }
  },

  classes: {
    async getAll() {
      const { data, error } = await supabase.from('classes').select(`
        *,
        teacher:users!teacher_id(id, name, name_zh)
      `).eq('is_active', true);
      return { data, error };
    },
    async getById(id) {
      const { data, error } = await supabase.from('classes').select(`
        *,
        teacher:users!teacher_id(id, name, name_zh),
        enrollments:class_enrollments(
          student:users!student_id(id, name, name_zh, email)
        )
      `).eq('id', id).single();
      return { data, error };
    },
    async getByTeacher(teacherId) {
      const { data, error } = await supabase.from('classes').select('*').eq('teacher_id', teacherId).eq('is_active', true);
      return { data, error };
    },
    async getByStudent(studentId) {
      const { data, error } = await supabase.from('class_enrollments').select(`
        class:classes(*)
      `).eq('student_id', studentId).eq('status', 'active');
      return { data: data?.map(e => e.class), error };
    }
  },

  homework: {
    async getByTeacher(teacherId) {
      const { data, error } = await supabase.from('homework').select(`
        *,
        class:classes(name, name_zh)
      `).eq('teacher_id', teacherId).eq('is_active', true).order('created_at', { ascending: false });
      return { data, error };
    },
    async getByStudent(studentId) {
      const { data, error } = await supabase.from('homework').select(`
        *,
        teacher:users!teacher_id(name),
        submissions:homework_submissions(id, score, status)
      `).eq('is_active', true);
      // Filter by class enrollment or individual assignment
      return { data, error };
    },
    async getSubmissions(homeworkId) {
      const { data, error } = await supabase.from('homework_submissions').select(`
        *,
        student:users!student_id(id, name, name_zh)
      `).eq('homework_id', homeworkId);
      return { data, error };
    },
    async submit(homeworkId, studentId, submission) {
      const { data, error } = await supabase.from('homework_submissions').upsert({
        homework_id: homeworkId,
        student_id: studentId,
        ...submission
      }).select();
      return { data, error };
    },
    async grade(submissionId, score, feedback) {
      const { data, error } = await supabase.from('homework_submissions').update({
        score,
        feedback,
        status: 'graded',
        graded_at: new Date().toISOString()
      }).eq('id', submissionId).select();
      return { data, error };
    }
  },

  attendance: {
    async getByClass(classId, date = null) {
      let query = supabase.from('attendance').select(`
        *,
        student:users!student_id(id, name, name_zh)
      `).eq('class_id', classId);
      if (date) query = query.eq('date', date);
      const { data, error } = await query.order('date', { ascending: false });
      return { data, error };
    },
    async getByStudent(studentId) {
      const { data, error } = await supabase.from('attendance').select(`
        *,
        class:classes(name, name_zh)
      `).eq('student_id', studentId).order('date', { ascending: false });
      return { data, error };
    },
    async record(classId, studentId, date, status) {
      const { data, error } = await supabase.from('attendance').upsert({
        class_id: classId,
        student_id: studentId,
        date,
        status,
        check_in_time: new Date().toISOString()
      }).select();
      return { data, error };
    }
  },

  hsk: {
    async getQuestions(level, type = null, limit = 10) {
      let query = supabase.from('hsk_questions').select('*').eq('level', level).eq('is_active', true);
      if (type) query = query.eq('type', type);
      const { data, error } = await query.limit(limit);
      return { data, error };
    },
    async recordPractice(studentId, questionId, userAnswer, isCorrect, timeSpent) {
      const { data, error } = await supabase.from('hsk_practice').insert({
        student_id: studentId,
        question_id: questionId,
        user_answer: userAnswer,
        is_correct: isCorrect,
        time_spent: timeSpent
      }).select();
      return { data, error };
    },
    async getProgress(studentId) {
      const { data, error } = await supabase.rpc('get_hsk_progress', { p_student_id: studentId });
      return { data, error };
    }
  },

  culture: {
    async getChengyu() {
      const { data, error } = await supabase.from('chengyu').select('*').eq('is_active', true).order('hsk_level');
      return { data, error };
    },
    async getVideos() {
      const { data, error } = await supabase.from('culture_videos').select('*').eq('is_active', true).order('views', { ascending: false });
      return { data, error };
    },
    async getKnowledge() {
      const { data, error } = await supabase.from('culture_knowledge').select('*').eq('is_active', true);
      return { data, error };
    }
  },

  messages: {
    async getInbox(userId) {
      const { data, error } = await supabase.from('messages').select(`
        *,
        sender:users!sender_id(id, name, name_zh)
      `).eq('recipient_id', userId).order('created_at', { ascending: false });
      return { data, error };
    },
    async send(senderId, recipientId, subject, content, options = {}) {
      const { data, error } = await supabase.from('messages').insert({
        sender_id: senderId,
        recipient_id: recipientId,
        subject,
        content,
        ...options
      }).select();
      return { data, error };
    },
    async markRead(messageId) {
      const { data, error } = await supabase.from('messages').update({
        is_read: true,
        read_at: new Date().toISOString()
      }).eq('id', messageId);
      return { data, error };
    }
  },

  teacherApplications: {
    async submit(application) {
      const { data, error } = await supabase.from('teacher_applications').insert(application).select();
      return { data, error };
    },
    async getMyApplication(userId) {
      const { data, error } = await supabase.from('teacher_applications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
      return { data, error };
    },
    async getAll(status = null) {
      let query = supabase.from('teacher_applications').select(`
        *,
        user:users!user_id(username, name)
      `);
      if (status && status !== 'all') query = query.eq('status', status);
      const { data, error } = await query.order('created_at', { ascending: false });
      return { data, error };
    },
    async approve(id, reviewerId, notes) {
      const { data, error } = await supabase.from('teacher_applications').update({
        status: 'approved',
        reviewer_id: reviewerId,
        reviewer_notes: notes,
        reviewed_at: new Date().toISOString()
      }).eq('id', id).select();
      return { data, error };
    },
    async reject(id, reviewerId, notes) {
      const { data, error } = await supabase.from('teacher_applications').update({
        status: 'rejected',
        reviewer_id: reviewerId,
        reviewer_notes: notes,
        reviewed_at: new Date().toISOString()
      }).eq('id', id).select();
      return { data, error };
    }
  }
};

// ============================================================
// STORAGE HELPERS (for file uploads)
// ============================================================

export const storage = {
  async uploadFile(bucket, path, file) {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    return { data, error };
  },

  async getPublicUrl(bucket, path) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  async deleteFile(bucket, path) {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    return { error };
  }
};

export default supabase;
