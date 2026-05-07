// Auto-generated CRUD page for homework
import React from 'react';
import ContentCRUD from './ContentCRUD';

export default function HomeworkPage() {
  return (
    <ContentCRUD
      table="clf_homework"
      title="作业"
      columns={[
        { key: 'title', label: '标题', type: 'text', required: true },
        { key: 'description', label: '说明', type: 'textarea' },
        { key: 'due_at', label: '截止时间', type: 'text' },
      ]}
    />
  );
}
