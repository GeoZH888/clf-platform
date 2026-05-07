import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const PointsAdminPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [rules, setRules] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showRewardModal, setShowRewardModal] = useState(null);
  const [rewardForm, setRewardForm] = useState({
    name_zh: '', name_en: '', description_zh: '', category: 'virtual', points_required: 100, stock: -1
  });

  const txt = {
    zh: {
      title: '🎯 积分管理后台',
      overview: '总览',
      rules: '积分规则',
      rewards: '奖品管理',
      redemptions: '兑换订单',
      totalPointsIssued: '已发放积分',
      totalPointsSpent: '已消耗积分',
      totalUsers: '参与用户',
      pendingRedemptions: '待处理订单',
      ruleName: '规则名称',
      ruleAction: '动作类型',
      rulePoints: '积分',
      ruleRoles: '适用角色',
      ruleLimit: '每日上限',
      ruleStatus: '状态',
      active: '启用',
      inactive: '禁用',
      addReward: '添加奖品',
      editReward: '编辑奖品',
      rewardName: '奖品名称',
      rewardNameEn: '英文名称',
      rewardDesc: '描述',
      rewardCategory: '类型',
      rewardPoints: '所需积分',
      rewardStock: '库存',
      unlimited: '不限',
      physical: '实物',
      virtual: '虚拟',
      coupon: '优惠券',
      experience: '体验',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      orderUser: '用户',
      orderReward: '奖品',
      orderPoints: '消耗积分',
      orderStatus: '状态',
      orderTime: '下单时间',
      orderActions: '操作',
      pending: '待处理',
      processing: '处理中',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消',
      process: '处理',
      ship: '发货',
      complete: '完成',
      trackingNumber: '快递单号',
      shippingInfo: '收货信息',
      noData: '暂无数据',
      success: '操作成功！',
      failed: '操作失败',
      manualAdjust: '手动调整积分',
      adjustUser: '选择用户',
      adjustPoints: '积分变动',
      adjustReason: '调整原因',
      adjust: '调整'
    },
    en: {
      title: '🎯 Points Admin',
      overview: 'Overview',
      rules: 'Rules',
      rewards: 'Rewards',
      redemptions: 'Orders',
      totalPointsIssued: 'Points Issued',
      totalPointsSpent: 'Points Spent',
      totalUsers: 'Total Users',
      pendingRedemptions: 'Pending Orders',
      ruleName: 'Rule Name',
      ruleAction: 'Action',
      rulePoints: 'Points',
      ruleRoles: 'Roles',
      ruleLimit: 'Daily Limit',
      ruleStatus: 'Status',
      active: 'Active',
      inactive: 'Inactive',
      addReward: 'Add Reward',
      editReward: 'Edit Reward',
      rewardName: 'Name (CN)',
      rewardNameEn: 'Name (EN)',
      rewardDesc: 'Description',
      rewardCategory: 'Category',
      rewardPoints: 'Points Required',
      rewardStock: 'Stock',
      unlimited: 'Unlimited',
      physical: 'Physical',
      virtual: 'Virtual',
      coupon: 'Coupon',
      experience: 'Experience',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      orderUser: 'User',
      orderReward: 'Reward',
      orderPoints: 'Points',
      orderStatus: 'Status',
      orderTime: 'Order Time',
      orderActions: 'Actions',
      pending: 'Pending',
      processing: 'Processing',
      shipped: 'Shipped',
      completed: 'Completed',
      cancelled: 'Cancelled',
      process: 'Process',
      ship: 'Ship',
      complete: 'Complete',
      trackingNumber: 'Tracking #',
      shippingInfo: 'Shipping Info',
      noData: 'No data',
      success: 'Success!',
      failed: 'Failed',
      manualAdjust: 'Manual Adjust',
      adjustUser: 'Select User',
      adjustPoints: 'Points',
      adjustReason: 'Reason',
      adjust: 'Adjust'
    },
    it: {
      title: '🎯 Admin Punti',
      overview: 'Panoramica',
      rules: 'Regole',
      rewards: 'Premi',
      redemptions: 'Ordini',
      totalPointsIssued: 'Punti Emessi',
      totalPointsSpent: 'Punti Spesi',
      totalUsers: 'Utenti Totali',
      pendingRedemptions: 'Ordini in Attesa',
      ruleName: 'Nome Regola',
      ruleAction: 'Azione',
      rulePoints: 'Punti',
      ruleRoles: 'Ruoli',
      ruleLimit: 'Limite Giornaliero',
      ruleStatus: 'Stato',
      active: 'Attivo',
      inactive: 'Inattivo',
      addReward: 'Aggiungi Premio',
      editReward: 'Modifica Premio',
      rewardName: 'Nome (CN)',
      rewardNameEn: 'Nome (EN)',
      rewardDesc: 'Descrizione',
      rewardCategory: 'Categoria',
      rewardPoints: 'Punti Richiesti',
      rewardStock: 'Stock',
      unlimited: 'Illimitato',
      physical: 'Fisico',
      virtual: 'Virtuale',
      coupon: 'Coupon',
      experience: 'Esperienza',
      save: 'Salva',
      cancel: 'Annulla',
      delete: 'Elimina',
      orderUser: 'Utente',
      orderReward: 'Premio',
      orderPoints: 'Punti',
      orderStatus: 'Stato',
      orderTime: 'Data Ordine',
      orderActions: 'Azioni',
      pending: 'In Attesa',
      processing: 'In Elaborazione',
      shipped: 'Spedito',
      completed: 'Completato',
      cancelled: 'Annullato',
      process: 'Elabora',
      ship: 'Spedisci',
      complete: 'Completa',
      trackingNumber: 'Tracking',
      shippingInfo: 'Info Spedizione',
      noData: 'Nessun dato',
      success: 'Successo!',
      failed: 'Fallito',
      manualAdjust: 'Aggiusta Manuale',
      adjustUser: 'Seleziona Utente',
      adjustPoints: 'Punti',
      adjustReason: 'Motivo',
      adjust: 'Aggiusta'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 统计数据
      const { data: pointsData } = await supabase.from('user_points').select('total_points, available_points');
      const totalIssued = pointsData?.reduce((sum, p) => sum + (p.total_points || 0), 0) || 0;
      const totalSpent = pointsData?.reduce((sum, p) => sum + ((p.total_points || 0) - (p.available_points || 0)), 0) || 0;

      const { count: userCount } = await supabase.from('user_points').select('*', { count: 'exact', head: true });
      const { count: pendingCount } = await supabase.from('reward_redemptions').select('*', { count: 'exact', head: true }).eq('status', 'pending');

      setStats({ totalIssued, totalSpent, totalUsers: userCount || 0, pendingRedemptions: pendingCount || 0 });

      // 规则
      const { data: rulesData } = await supabase.from('point_rules').select('*').order('points', { ascending: false });
      setRules(rulesData || []);

      // 奖品
      const { data: rewardsData } = await supabase.from('rewards').select('*').order('points_required', { ascending: true });
      setRewards(rewardsData || []);

      // 兑换订单
      const { data: redemptionsData } = await supabase.from('reward_redemptions')
        .select('*, rewards(name_zh, name_en), users:user_id(name, name_zh)')
        .order('created_at', { ascending: false })
        .limit(50);
      setRedemptions(redemptionsData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReward = async () => {
    try {
      if (rewardForm.id) {
        await supabase.from('rewards').update(rewardForm).eq('id', rewardForm.id);
      } else {
        await supabase.from('rewards').insert([{ ...rewardForm, is_active: true }]);
      }
      setShowRewardModal(null);
      setRewardForm({ name_zh: '', name_en: '', description_zh: '', category: 'virtual', points_required: 100, stock: -1 });
      setMessage({ type: 'success', text: t.success });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  const handleDeleteReward = async (id) => {
    if (!window.confirm(language === 'zh' ? '确定删除吗？' : 'Confirm delete?')) return;
    await supabase.from('rewards').delete().eq('id', id);
    loadData();
  };

  const handleUpdateOrderStatus = async (id, status, trackingNumber = null) => {
    const update = { status, updated_at: new Date().toISOString() };
    if (trackingNumber) update.tracking_number = trackingNumber;
    await supabase.from('reward_redemptions').update(update).eq('id', id);
    setMessage({ type: 'success', text: t.success });
    loadData();
  };

  const toggleRuleStatus = async (rule) => {
    await supabase.from('point_rules').update({ is_active: !rule.is_active }).eq('id', rule.id);
    loadData();
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'var(--warning)', text: t.pending },
      processing: { bg: 'var(--info)', text: t.processing },
      shipped: { bg: 'var(--primary)', text: t.shipped },
      completed: { bg: 'var(--success)', text: t.completed },
      cancelled: { bg: 'var(--error)', text: t.cancelled }
    };
    const s = styles[status] || styles.pending;
    return <span className="badge" style={{ background: s.bg, color: 'white' }}>{s.text}</span>;
  };

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 {t.overview}
        </button>
        <button className={`tab ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>
          📋 {t.rules}
        </button>
        <button className={`tab ${activeTab === 'rewards' ? 'active' : ''}`} onClick={() => setActiveTab('rewards')}>
          🎁 {t.rewards}
        </button>
        <button className={`tab ${activeTab === 'redemptions' ? 'active' : ''}`} onClick={() => setActiveTab('redemptions')}>
          📦 {t.redemptions} {stats.pendingRedemptions > 0 && <span className="badge badge-error" style={{ marginLeft: '0.25rem' }}>{stats.pendingRedemptions}</span>}
        </button>
      </div>

      {/* 总览 */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>{stats.totalIssued?.toLocaleString()}</div>
            <div style={{ color: 'var(--text-muted)' }}>{t.totalPointsIssued}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--success)' }}>{stats.totalSpent?.toLocaleString()}</div>
            <div style={{ color: 'var(--text-muted)' }}>{t.totalPointsSpent}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--info)' }}>{stats.totalUsers}</div>
            <div style={{ color: 'var(--text-muted)' }}>{t.totalUsers}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', color: 'var(--warning)' }}>{stats.pendingRedemptions}</div>
            <div style={{ color: 'var(--text-muted)' }}>{t.pendingRedemptions}</div>
          </div>
        </div>
      )}

      {/* 规则 */}
      {activeTab === 'rules' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>{t.rules}</h3>
          <div className="table-container">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.ruleName}</th>
                  <th>{t.rulePoints}</th>
                  <th>{t.ruleRoles}</th>
                  <th>{t.ruleLimit}</th>
                  <th>{t.ruleStatus}</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id}>
                    <td>{language === 'zh' ? rule.action_name_zh : rule.action_name_en}</td>
                    <td style={{ fontWeight: '600', color: 'var(--success)' }}>+{rule.points}</td>
                    <td>{rule.applicable_roles?.join(', ')}</td>
                    <td>{rule.daily_limit || '-'}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${rule.is_active ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => toggleRuleStatus(rule)}
                      >
                        {rule.is_active ? t.active : t.inactive}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 奖品 */}
      {activeTab === 'rewards' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>{t.rewards}</h3>
            <button className="btn btn-primary" onClick={() => { setRewardForm({ name_zh: '', name_en: '', description_zh: '', category: 'virtual', points_required: 100, stock: -1 }); setShowRewardModal(true); }}>
              + {t.addReward}
            </button>
          </div>
          <div className="table-container">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.rewardName}</th>
                  <th>{t.rewardCategory}</th>
                  <th>{t.rewardPoints}</th>
                  <th>{t.rewardStock}</th>
                  <th>{t.orderActions}</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map(reward => (
                  <tr key={reward.id}>
                    <td>{reward.name_zh}</td>
                    <td><span className="badge badge-info">{reward.category}</span></td>
                    <td style={{ fontWeight: '600' }}>{reward.points_required}</td>
                    <td>{reward.stock === -1 ? t.unlimited : reward.stock}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => { setRewardForm(reward); setShowRewardModal(true); }}>✏️</button>
                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDeleteReward(reward.id)}>✗</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 兑换订单 */}
      {activeTab === 'redemptions' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>{t.redemptions}</h3>
          {redemptions.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {redemptions.map(order => (
                <div key={order.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>{order.rewards?.name_zh || order.rewards?.name_en}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {order.users?.name_zh || order.users?.name} · {order.points_spent} {language === 'zh' ? '积分' : 'points'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {getStatusBadge(order.status)}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {order.shipping_info && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      📦 {order.shipping_info.name} · {order.shipping_info.phone} · {order.shipping_info.address}
                    </div>
                  )}
                  {order.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleUpdateOrderStatus(order.id, 'processing')}>
                        {t.process}
                      </button>
                    </div>
                  )}
                  {order.status === 'processing' && order.rewards?.category === 'physical' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}>
                      <input
                        className="form-input"
                        placeholder={t.trackingNumber}
                        style={{ flex: 1, padding: '0.375rem 0.75rem' }}
                        id={`tracking-${order.id}`}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => {
                        const tracking = document.getElementById(`tracking-${order.id}`).value;
                        handleUpdateOrderStatus(order.id, 'shipped', tracking);
                      }}>
                        {t.ship}
                      </button>
                    </div>
                  )}
                  {(order.status === 'processing' && order.rewards?.category !== 'physical') || order.status === 'shipped' && (
                    <button className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => handleUpdateOrderStatus(order.id, 'completed')}>
                      {t.complete}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 奖品编辑模态框 */}
      {showRewardModal && (
        <div className="modal-overlay" onClick={() => setShowRewardModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '1rem' }}>{rewardForm.id ? t.editReward : t.addReward}</h3>
            <div className="form-group">
              <label className="form-label">{t.rewardName} *</label>
              <input className="form-input" value={rewardForm.name_zh} onChange={e => setRewardForm({...rewardForm, name_zh: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t.rewardNameEn}</label>
              <input className="form-input" value={rewardForm.name_en || ''} onChange={e => setRewardForm({...rewardForm, name_en: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">{t.rewardDesc}</label>
              <textarea className="form-textarea" rows={2} value={rewardForm.description_zh || ''} onChange={e => setRewardForm({...rewardForm, description_zh: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t.rewardCategory}</label>
                <select className="form-select" value={rewardForm.category} onChange={e => setRewardForm({...rewardForm, category: e.target.value})}>
                  <option value="virtual">{t.virtual}</option>
                  <option value="physical">{t.physical}</option>
                  <option value="coupon">{t.coupon}</option>
                  <option value="experience">{t.experience}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t.rewardPoints}</label>
                <input type="number" className="form-input" value={rewardForm.points_required} onChange={e => setRewardForm({...rewardForm, points_required: parseInt(e.target.value) || 0})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t.rewardStock} (-1 = {t.unlimited})</label>
              <input type="number" className="form-input" value={rewardForm.stock} onChange={e => setRewardForm({...rewardForm, stock: parseInt(e.target.value)})} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowRewardModal(null)}>{t.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveReward}>{t.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PointsAdminPage;
