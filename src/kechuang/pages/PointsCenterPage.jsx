import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const PointsCenterPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [userPoints, setUserPoints] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showRedeemModal, setShowRedeemModal] = useState(null);
  const [shippingInfo, setShippingInfo] = useState({ name: '', phone: '', address: '' });

  const txt = {
    zh: {
      title: '🎯 积分中心',
      overview: '我的积分',
      rewards: '积分商城',
      history: '积分记录',
      leaderboard: '排行榜',
      myRedemptions: '我的兑换',
      totalPoints: '总积分',
      availablePoints: '可用积分',
      level: '等级',
      streak_student: '连续学习',
      streak_teacher: '连续工作',
      streak: '连续学习',
      days: '天',
      earnMore: '赚取更多积分',
      todayEarned: '今日获得',
      thisWeek: '本周获得',
      thisMonth: '本月获得',
      pointsHistory: '积分明细',
      date: '日期',
      description: '描述',
      points: '积分',
      balance: '余额',
      noHistory: '暂无记录',
      rewardsShop: '积分商城',
      pointsRequired: '所需积分',
      stock: '库存',
      unlimited: '不限',
      outOfStock: '已售罄',
      redeem: '兑换',
      redeemConfirm: '确认兑换',
      redeemSuccess: '兑换成功！',
      insufficientPoints: '积分不足',
      physical: '实物',
      virtual: '虚拟',
      coupon: '优惠券',
      experience: '体验',
      shippingInfo: '收货信息',
      recipientName: '收件人',
      recipientPhone: '联系电话',
      recipientAddress: '收货地址',
      cancel: '取消',
      confirm: '确认',
      rank: '排名',
      userName: '用户',
      myRank: '我的排名',
      daily: '今日',
      weekly: '本周',
      monthly: '本月',
      allTime: '总榜',
      redemptionStatus: '状态',
      pending: '待处理',
      processing: '处理中',
      shipped: '已发货',
      completed: '已完成',
      trackingNumber: '快递单号',
      howToEarn: '如何获得积分',
      earnRules: [
        { icon: '📝', action: '提交作业', points: '+10' },
        { icon: '⭐', action: '优秀作业', points: '+30' },
        { icon: '✅', action: '签到', points: '+5' },
        { icon: '📊', action: '完成测验', points: '+20' },
        { icon: '🔥', action: '连续学习', points: '+10/天' },
        { icon: '🏆', action: 'HSK通过', points: '+200' }
      ],
      teacherEarnRules: [
        { icon: '📂', action: '上传教学材料', points: '+20' },
        { icon: '📊', action: '生成PPT课件', points: '+15' },
        { icon: '❓', action: '创建测验题目', points: '+20' },
        { icon: '📝', action: '布置课后作业', points: '+10' },
        { icon: '🔥', action: '连续工作', points: '+15/天' },
        { icon: '✅', action: '完成班级签到', points: '+10' },
        { icon: '🎓', action: '学生通过考核', points: '+50' }
      ]
    },
    en: {
      title: '🎯 Points Center',
      overview: 'My Points',
      rewards: 'Rewards Shop',
      history: 'History',
      leaderboard: 'Leaderboard',
      myRedemptions: 'My Redemptions',
      totalPoints: 'Total Points',
      availablePoints: 'Available',
      level: 'Level',
      streak: 'Streak',
      days: 'days',
      earnMore: 'Earn More Points',
      todayEarned: 'Today',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      pointsHistory: 'Points History',
      date: 'Date',
      description: 'Description',
      points: 'Points',
      balance: 'Balance',
      noHistory: 'No records',
      rewardsShop: 'Rewards Shop',
      pointsRequired: 'Points Required',
      stock: 'Stock',
      unlimited: 'Unlimited',
      outOfStock: 'Out of Stock',
      redeem: 'Redeem',
      redeemConfirm: 'Confirm Redemption',
      redeemSuccess: 'Redemption successful!',
      insufficientPoints: 'Insufficient points',
      physical: 'Physical',
      virtual: 'Virtual',
      coupon: 'Coupon',
      experience: 'Experience',
      shippingInfo: 'Shipping Info',
      recipientName: 'Name',
      recipientPhone: 'Phone',
      recipientAddress: 'Address',
      cancel: 'Cancel',
      confirm: 'Confirm',
      rank: 'Rank',
      userName: 'User',
      myRank: 'My Rank',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      allTime: 'All Time',
      redemptionStatus: 'Status',
      pending: 'Pending',
      processing: 'Processing',
      shipped: 'Shipped',
      completed: 'Completed',
      trackingNumber: 'Tracking',
      howToEarn: 'How to Earn Points',
      earnRules: [
        { icon: '📝', action: 'Submit Homework', points: '+10' },
        { icon: '⭐', action: 'Excellent Work', points: '+30' },
        { icon: '✅', action: 'Check In', points: '+5' },
        { icon: '📊', action: 'Complete Quiz', points: '+20' },
        { icon: '🔥', action: 'Daily Streak', points: '+10/day' },
        { icon: '🏆', action: 'Pass HSK', points: '+200' }
      ],
      teacherEarnRules: [
        { icon: '📚', action: 'Upload teaching material', points: '+20' },
        { icon: '✅', action: 'Material approved', points: '+50' },
        { icon: '📜', action: 'Create Chengyu content', points: '+30' },
        { icon: '🎬', action: 'Upload video', points: '+50' },
        { icon: '🎮', action: 'Create game', points: '+40' },
        { icon: '❓', action: 'Create quiz', points: '+30' }
      ]
    },
    it: {
      title: '🎯 Centro Punti',
      overview: 'I Miei Punti',
      rewards: 'Negozio Premi',
      history: 'Storico',
      leaderboard: 'Classifica',
      myRedemptions: 'I Miei Riscatti',
      totalPoints: 'Punti Totali',
      availablePoints: 'Disponibili',
      level: 'Livello',
      streak: 'Serie',
      days: 'giorni',
      earnMore: 'Guadagna Più Punti',
      todayEarned: 'Oggi',
      thisWeek: 'Questa Settimana',
      thisMonth: 'Questo Mese',
      pointsHistory: 'Storico Punti',
      date: 'Data',
      description: 'Descrizione',
      points: 'Punti',
      balance: 'Saldo',
      noHistory: 'Nessun record',
      rewardsShop: 'Negozio Premi',
      pointsRequired: 'Punti Richiesti',
      stock: 'Stock',
      unlimited: 'Illimitato',
      outOfStock: 'Esaurito',
      redeem: 'Riscatta',
      redeemConfirm: 'Conferma Riscatto',
      redeemSuccess: 'Riscatto completato!',
      insufficientPoints: 'Punti insufficienti',
      physical: 'Fisico',
      virtual: 'Virtuale',
      coupon: 'Coupon',
      experience: 'Esperienza',
      shippingInfo: 'Info Spedizione',
      recipientName: 'Nome',
      recipientPhone: 'Telefono',
      recipientAddress: 'Indirizzo',
      cancel: 'Annulla',
      confirm: 'Conferma',
      rank: 'Posizione',
      userName: 'Utente',
      myRank: 'La Mia Posizione',
      daily: 'Giornaliera',
      weekly: 'Settimanale',
      monthly: 'Mensile',
      allTime: 'Sempre',
      redemptionStatus: 'Stato',
      pending: 'In Attesa',
      processing: 'In Elaborazione',
      shipped: 'Spedito',
      completed: 'Completato',
      trackingNumber: 'Tracking',
      howToEarn: 'Come Guadagnare Punti',
      earnRules: [
        { icon: '📝', action: 'Consegna Compiti', points: '+10' },
        { icon: '⭐', action: 'Lavoro Eccellente', points: '+30' },
        { icon: '✅', action: 'Check In', points: '+5' },
        { icon: '📊', action: 'Completa Quiz', points: '+20' },
        { icon: '🔥', action: 'Serie Giornaliera', points: '+10/giorno' },
        { icon: '🏆', action: 'Supera HSK', points: '+200' }
      ]
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 获取用户积分
      let { data: pointsData } = await supabase
        .from('dwxz_user_points')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      // 如果没有积分记录，创建一个
      if (!pointsData) {
        const { data: newPoints } = await supabase
          .from('dwxz_user_points')
          .insert([{ user_id: user?.id, total_points: 0, available_points: 0 }])
          .select()
          .single();
        pointsData = newPoints || { total_points: 0, available_points: 0, level: 1, streak_days: 0 };
      }
      setUserPoints(pointsData);

      // 获取积分记录
      const { data: txData } = await supabase
        .from('dwxz_point_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setTransactions(txData || []);

      // 获取奖品列表
      const { data: rewardsData } = await supabase
        .from('dwxz_rewards')
        .select('*')
        .eq('is_active', true)
        .order('points_required', { ascending: true });
      setRewards(rewardsData || []);

      // 获取排行榜
      const { data: lbData } = await supabase
        .from('dwxz_point_leaderboard')
        .select('*')
        .eq('period', 'all_time')
        .order('total_points', { ascending: false })
        .limit(20);
      setLeaderboard(lbData || []);

      // 获取兑换记录
      const { data: redemptionData } = await supabase
        .from('dwxz_reward_redemptions')
        .select('*, rewards(*)')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      setRedemptions(redemptionData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (reward) => {
    if (userPoints?.available_points < reward.points_required) {
      setMessage({ type: 'error', text: t.insufficientPoints });
      return;
    }

    // 实物需要收货信息
    if (reward.category === 'physical' && (!shippingInfo.name || !shippingInfo.phone || !shippingInfo.address)) {
      return;
    }

    try {
      // 创建兑换记录
      await supabase.from('dwxz_reward_redemptions').insert([{
        user_id: user?.id,
        reward_id: reward.id,
        points_spent: reward.points_required,
        status: 'pending',
        shipping_info: reward.category === 'physical' ? shippingInfo : null
      }]);

      // 扣除积分
      await supabase.from('dwxz_user_points').update({
        available_points: userPoints.available_points - reward.points_required
      }).eq('user_id', user?.id);

      // 记录积分变动
      await supabase.from('dwxz_point_transactions').insert([{
        user_id: user?.id,
        points: -reward.points_required,
        balance_after: userPoints.available_points - reward.points_required,
        transaction_type: 'spend',
        action_type: 'redeem_reward',
        description: `兑换: ${reward.name_zh || reward.name_en}`,
        reference_id: reward.id,
        reference_type: 'reward'
      }]);

      // 更新库存
      if (reward.stock > 0) {
        await supabase.from('dwxz_rewards').update({
          stock: reward.stock - 1
        }).eq('id', reward.id);
      }

      setShowRedeemModal(null);
      setShippingInfo({ name: '', phone: '', address: '' });
      setMessage({ type: 'success', text: t.redeemSuccess });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const isTeacher = ['teacher','content_editor'].includes(user?.role);

  const getLevelInfo = (points) => {
    const levels = [
      { level: 1, name: isTeacher ? (language==='zh'?'教学新人':'Newcomer')    : (language === 'zh' ? '学习新手' : 'Beginner'),      icon: isTeacher?'🌱':'🌱', min: 0 },
      { level: 2, name: isTeacher ? (language==='zh'?'助教能手':'Assistant')    : (language === 'zh' ? '初级学员' : 'Junior'),         icon: isTeacher?'📗':'🌿', min: 100 },
      { level: 3, name: isTeacher ? (language==='zh'?'骨干教师':'Core Teacher') : (language === 'zh' ? '中级学员' : 'Intermediate'),   icon: isTeacher?'📘':'🌳', min: 300 },
      { level: 4, name: isTeacher ? (language==='zh'?'资深教师':'Senior')       : (language === 'zh' ? '高级学员' : 'Advanced'),       icon: isTeacher?'📙':'🌲', min: 600 },
      { level: 5, name: isTeacher ? (language==='zh'?'岗位能手':'Expert')       : (language === 'zh' ? '学习达人' : 'Expert'),         icon: isTeacher?'⭐':'⭐', min: 1000 },
      { level: 6, name: isTeacher ? (language==='zh'?'教学专家':'Master')       : (language === 'zh' ? '学习大师' : 'Master'),         icon: isTeacher?'🏅':'🌟', min: 2000 },
      { level: 7, name: isTeacher ? (language==='zh'?'教学名师':'Champion')     : (language === 'zh' ? '学习传奇' : 'Legend'),        icon: isTeacher?'🥇':'💫', min: 5000 },
      { level: 8, name: isTeacher ? (language==='zh'?'首席教师':'Chief')        : (language === 'zh' ? '学习之神' : 'God'),           icon: isTeacher?'👑':'👑', min: 10000 }
    ];
    const current = levels.filter(l => points >= l.min).pop() || levels[0];
    const next = levels.find(l => l.min > points);
    return { current, next, progress: next ? ((points - current.min) / (next.min - current.min)) * 100 : 100 };
  };

  const getCategoryBadge = (category) => {
    const styles = {
      physical: { bg: 'var(--primary)', icon: '📦', text: t.physical },
      virtual: { bg: 'var(--info)', icon: '✨', text: t.virtual },
      coupon: { bg: 'var(--success)', icon: '🎟️', text: t.coupon },
      experience: { bg: 'var(--warning)', icon: '🎯', text: t.experience }
    };
    const s = styles[category] || styles.virtual;
    return <span className="badge" style={{ background: s.bg, color: 'white' }}>{s.icon} {s.text}</span>;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'var(--warning)', text: t.pending },
      processing: { bg: 'var(--info)', text: t.processing },
      shipped: { bg: 'var(--primary)', text: t.shipped },
      completed: { bg: 'var(--success)', text: t.completed }
    };
    const s = styles[status] || styles.pending;
    return <span className="badge" style={{ background: s.bg, color: 'white' }}>{s.text}</span>;
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  const levelInfo = getLevelInfo(userPoints?.total_points || 0);

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

      {/* 标签页 */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          🎯 {t.overview}
        </button>
        <button className={`tab ${activeTab === 'rewards' ? 'active' : ''}`} onClick={() => setActiveTab('rewards')}>
          🎁 {t.rewards}
        </button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          📜 {t.history}
        </button>
        <button className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
          🏆 {t.leaderboard}
        </button>
      </div>

      {/* 概览 */}
      {activeTab === 'overview' && (
        <div>
          {/* 积分卡片 */}
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>{t.availablePoints}</div>
                <div style={{ fontSize: '3rem', fontWeight: '700' }}>{userPoints?.available_points || 0}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>{t.totalPoints}: {userPoints?.lifetime_points || userPoints?.total_points || 0}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '3rem' }}>{levelInfo.current.icon}</div>
                <div style={{ fontWeight: '600' }}>{levelInfo.current.name}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Lv.{levelInfo.current.level}</div>
              </div>
            </div>
            
            {/* 进度条 */}
            {levelInfo.next && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  <span>{levelInfo.current.name}</span>
                  <span>{levelInfo.next.name}</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.3)', borderRadius: '4px' }}>
                  <div style={{ width: `${levelInfo.progress}%`, height: '100%', background: 'white', borderRadius: '4px' }} />
                </div>
                <div style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '0.25rem', opacity: 0.9 }}>
                  {levelInfo.next.min - (userPoints?.total_points || 0)} {language === 'zh' ? '积分升级' : 'points to level up'}
                </div>
              </div>
            )}
          </div>

          {/* 连续学习 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>🔥</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{userPoints?.streak_days || 0}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{isTeacher ? (language==='zh'?'连续工作':'Streak') : t.streak} ({t.days})</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>📅</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>+{transactions.filter(tx => {
                const today = new Date().toDateString();
                return new Date(tx.created_at).toDateString() === today && tx.points > 0;
              }).reduce((sum, tx) => sum + tx.points, 0)}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.todayEarned}</div>
            </div>
          </div>

          {/* 如何获得积分 */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>💡 {t.howToEarn}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {(user?.role === 'teacher' || user?.role === 'content_editor' ? t.teacherEarnRules : t.earnRules).map((rule, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '1.25rem' }}>{rule.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.875rem' }}>{rule.action}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '600' }}>{rule.points}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 积分商城 */}
      {activeTab === 'rewards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {rewards.map(reward => (
            <div key={reward.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '2.5rem' }}>{reward.image_url || '🎁'}</div>
                {getCategoryBadge(reward.category)}
              </div>
              <h4>{language === 'zh' ? reward.name_zh : reward.name_en}</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>
                {language === 'zh' ? reward.description_zh : reward.description_en}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>
                    {reward.points_required} <span style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>{t.points}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t.stock}: {reward.stock === -1 ? t.unlimited : reward.stock > 0 ? reward.stock : t.outOfStock}
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={(userPoints?.available_points || 0) < reward.points_required || (reward.stock === 0)}
                  onClick={() => setShowRedeemModal(reward)}
                >
                  {t.redeem}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 积分记录 */}
      {activeTab === 'history' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>{t.pointsHistory}</h3>
          {transactions.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noHistory}</p>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t.date}</th>
                    <th>{t.description}</th>
                    <th>{t.points}</th>
                    <th>{t.balance}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '0.875rem' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td>{tx.description}</td>
                      <td style={{ fontWeight: '600', color: tx.points > 0 ? 'var(--success)' : 'var(--error)' }}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </td>
                      <td>{tx.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 排行榜 */}
      {activeTab === 'leaderboard' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🏆 {t.leaderboard}</h3>
          {leaderboard.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noHistory}</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {leaderboard.map((item, idx) => (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  background: item.user_id === user?.id ? 'rgba(196, 30, 58, 0.1)' : 'var(--background)',
                  borderRadius: 'var(--radius-md)',
                  border: item.user_id === user?.id ? '2px solid var(--primary)' : 'none'
                }}>
                  <div style={{ fontSize: '1.5rem', width: '40px', textAlign: 'center' }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600' }}>{item.user_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.user_role === 'teacher' ? '👨‍🏫' : item.user_role === 'student' ? '👨‍🎓' : '👤'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{item.total_points}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.points}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 兑换模态框 */}
      {showRedeemModal && (
        <div className="modal-overlay" onClick={() => setShowRedeemModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ marginBottom: '1rem' }}>🎁 {t.redeemConfirm}</h3>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2.5rem' }}>{showRedeemModal.image_url || '🎁'}</div>
              <h4>{language === 'zh' ? showRedeemModal.name_zh : showRedeemModal.name_en}</h4>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)', marginTop: '0.5rem' }}>
                {showRedeemModal.points_required} {t.points}
              </div>
            </div>

            {showRedeemModal.category === 'physical' && (
              <>
                <h4 style={{ marginBottom: '0.5rem' }}>{t.shippingInfo}</h4>
                <div className="form-group">
                  <input
                    className="form-input"
                    placeholder={t.recipientName}
                    value={shippingInfo.name}
                    onChange={e => setShippingInfo({...shippingInfo, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <input
                    className="form-input"
                    placeholder={t.recipientPhone}
                    value={shippingInfo.phone}
                    onChange={e => setShippingInfo({...shippingInfo, phone: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <textarea
                    className="form-textarea"
                    placeholder={t.recipientAddress}
                    rows={2}
                    value={shippingInfo.address}
                    onChange={e => setShippingInfo({...shippingInfo, address: e.target.value})}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setShowRedeemModal(null)}>{t.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleRedeem(showRedeemModal)}>{t.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PointsCenterPage;
