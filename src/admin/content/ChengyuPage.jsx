// Auto-generated CRUD page for chengyu
import React from 'react';
import ContentCRUD from './ContentCRUD';

export default function ChengyuPage() {
  return (
    <ContentCRUD
      table="clf_chengyu"
      title="成语"
      columns={[
        { key: 'idiom', label: '成语', type: 'text', required: true },
        { key: 'pinyin', label: '拼音', type: 'text' },
        { key: 'meaning', label: '释义', type: 'textarea' },
        { key: 'story', label: '典故', type: 'textarea' },
        { key: 'source', label: '出处', type: 'text' },
      ]}
    />
  );
}
