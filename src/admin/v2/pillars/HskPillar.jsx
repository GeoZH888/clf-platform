// src/admin/v2/pillars/HskPillar.jsx
// HSK pillar wrapper. Currently just wraps HSKAdminTab.
// Future: add tabs for 题库 / 等级配置 / 统计.
import React from 'react';
import HSKAdminTab from '../../HSKAdminTab';

export default function HskPillar() {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8d5b0',
      borderRadius: 12,
      padding: 16,
    }}>
      <HSKAdminTab/>
    </div>
  );
}
