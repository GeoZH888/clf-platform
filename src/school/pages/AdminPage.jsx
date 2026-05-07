import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/supabaseApi';

const AdminPage = () => {
  const { user, isSuperAdmin } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', email: '', password: '', name: '', role: 'student', phone: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigned_to: '', priority: 'normal', due_date: '' });

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        console.log('Loading users from Supabase...');
        const users = await api.users.getAll();
        console.log('Users loaded:', users);
        setUsers(users || []);
      } else if (activeTab === 'tasks') {
        // Tasks are not yet implemented in supabaseApi, use empty for now
        setTasks([]);
      } else if (activeTab === 'stats') {
        const stats = await api.users.getStats();
        setStats(stats);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      // Show error to user
      alert(language === 'zh' 
        ? `加载失败: ${error.message}。请检查数据库连接和RLS权限。` 
        : `Load failed: ${error.message}. Check database connection and RLS permissions.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.auth.register({
        username: userForm.username,
        email: userForm.email,
        password: userForm.password,
        name: userForm.name,
        role: userForm.role
      });
      setShowUserModal(false);
      setUserForm({ username: '', email: '', password: '', name: '', role: 'student', phone: '' });
      loadData();
      alert(language === 'zh' ? '✅ 用户创建成功！' : '✅ User created successfully!');
    } catch (error) {
      console.error('Create user error:', error);
      alert(error.message || 'Failed to create user');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createTask(taskForm);
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', assigned_to: '', priority: 'normal', due_date: '' });
      loadData();
    } catch (error) {
      alert('Failed to create task');
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await api.users.update(userId, { is_active: !currentStatus });
      loadData();
    } catch (error) {
      alert('Failed to update user');
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await adminAPI.updateTask(taskId, { status });
      loadData();
    } catch (error) {
      alert('Failed to update task');
    }
  };

  if (loading && !stats && users.length === 0) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header">
        <h1>{t('admin.title')} ⚙️</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 {t('admin.users')}</button>
        <button className={`tab ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>📋 {t('admin.tasks')}</button>
        <button className={`tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>📊 {t('admin.statistics')}</button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('admin.users')}</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowUserModal(true)}>+ {language === 'zh' ? '添加用户' : 'Add User'}</button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('name')}</th>
                  <th>{t('email')}</th>
                  <th>{language === 'zh' ? '角色' : 'Role'}</th>
                  <th>{language === 'zh' ? '状态' : 'Status'}</th>
                  <th>{language === 'zh' ? '操作' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>⏳ {language === 'zh' ? '加载中...' : 'Loading...'}</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    {language === 'zh' ? '暂无用户数据。请检查数据库连接或RLS权限。' : 'No users found. Check database connection or RLS permissions.'}
                    <br/><button className="btn btn-outline btn-sm" style={{ marginTop: '1rem' }} onClick={loadData}>🔄 {language === 'zh' ? '重新加载' : 'Reload'}</button>
                  </td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.name || u.username}</strong><br/><span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>@{u.username}</span></td>
                    <td>{u.email || '-'}</td>
                    <td><span className="badge badge-info">{t(`roles.${u.role}`) || u.role}</span></td>
                    <td><span className={`badge badge-${u.is_active ? 'success' : 'error'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => toggleUserStatus(u.id, u.is_active)}>
                        {u.is_active ? '🚫' : '✓'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('admin.tasks')}</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowTaskModal(true)}>+ {language === 'zh' ? '分配任务' : 'Assign Task'}</button>
          </div>
          {tasks.length > 0 ? (
            <div>
              {tasks.map(task => (
                <div key={task.id} className="list-item">
                  <div>
                    <strong>{task.title}</strong>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{task.assigned_to_name}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`badge badge-${task.priority === 'high' ? 'error' : task.priority === 'low' ? 'info' : 'warning'}`}>{task.priority}</span>
                    <select className="form-select" style={{ width: 'auto', padding: '0.25rem' }} value={task.status} onChange={e => updateTaskStatus(task.id, e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><p>{language === 'zh' ? '暂无任务' : 'No tasks'}</p></div>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && stats && (
        <div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon primary">👥</div><div className="stat-content"><h3>{stats.users?.total || 0}</h3><p>{language === 'zh' ? '总用户数' : 'Total Users'}</p></div></div>
            <div className="stat-card"><div className="stat-icon success">📚</div><div className="stat-content"><h3>{stats.classes?.total || 0}</h3><p>{language === 'zh' ? '总班级数' : 'Total Classes'}</p></div></div>
            <div className="stat-card"><div className="stat-icon warning">📝</div><div className="stat-content"><h3>{stats.homework?.pending_review || 0}</h3><p>{language === 'zh' ? '待批作业' : 'Pending Review'}</p></div></div>
            <div className="stat-card"><div className="stat-icon info">🏆</div><div className="stat-content"><h3>{stats.hsk?.registrations || 0}</h3><p>{language === 'zh' ? 'HSK报名' : 'HSK Registrations'}</p></div></div>
          </div>
          <div className="card">
            <h3>{language === 'zh' ? '用户分布' : 'User Distribution'}</h3>
            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
              {stats.users?.by_role?.map((r, idx) => (
                <div key={idx} style={{ textAlign: 'center' }}>
                  <h2>{r.count}</h2>
                  <p style={{ color: 'var(--text-muted)' }}>{t(`roles.${r.role}`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{language === 'zh' ? '添加用户' : 'Add User'}</h3><button onClick={() => setShowUserModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">{t('username')} *</label><input type="text" className="form-input" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">{t('email')} *</label><input type="email" className="form-input" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">{t('password')} *</label><input type="password" className="form-input" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">{t('name')} *</label><input type="text" className="form-input" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">{language === 'zh' ? '角色' : 'Role'}</label>
                  <select className="form-select" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                    <option value="student">{t('roles.student')}</option>
                    <option value="teacher">{t('roles.teacher')}</option>
                    <option value="parent">{t('roles.parent')}</option>
                    {isSuperAdmin && <option value="admin">{t('roles.admin')}</option>}
                  </select>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowUserModal(false)}>{t('cancel')}</button><button type="submit" className="btn btn-primary">{t('create')}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{language === 'zh' ? '分配任务' : 'Assign Task'}</h3><button onClick={() => setShowTaskModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">{language === 'zh' ? '标题' : 'Title'} *</label><input type="text" className="form-input" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">{language === 'zh' ? '描述' : 'Description'}</label><textarea className="form-textarea" value={taskForm.description} onChange={e => setTaskForm({...taskForm, description: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">{language === 'zh' ? '分配给 (用户ID)' : 'Assign to (User ID)'} *</label><input type="text" className="form-input" value={taskForm.assigned_to} onChange={e => setTaskForm({...taskForm, assigned_to: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">{language === 'zh' ? '优先级' : 'Priority'}</label>
                  <select className="form-select" value={taskForm.priority} onChange={e => setTaskForm({...taskForm, priority: e.target.value})}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">{language === 'zh' ? '截止日期' : 'Due Date'}</label><input type="datetime-local" className="form-input" value={taskForm.due_date} onChange={e => setTaskForm({...taskForm, due_date: e.target.value})} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowTaskModal(false)}>{t('cancel')}</button><button type="submit" className="btn btn-primary">{t('create')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
