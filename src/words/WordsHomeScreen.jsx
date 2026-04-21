// src/words/WordsHomeScreen.jsx
// 词语 module hub — uses unified ModuleTemplate
// Drop-in replacement for the existing WordsApp home screen portion.
// Import this wherever WordsApp currently renders its home.

import ModuleTemplate from '../components/ModuleTemplate.jsx';
import AdaptiveCard from '../components/AdaptiveCard.jsx';

export default function WordsHomeScreen({ onBack, onMode, stats = {}, lang = 'zh' }) {
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? it : en;

  const wordCount     = stats?.totalWords     ?? 35;
  const practicedCount = stats?.practiced     ?? 0;

  const modules = [
    {
      id:     'flash',
      icon:   '🃏',
      title:  t('闪卡', 'Flashcards', 'Flashcard'),
      desc:   t('看词认意思', 'See word, learn meaning', 'Vedi e impara'),
      color:  '#E3F2FD',
      accent: '#1565C0',
      onClick: () => onMode?.('flash'),
    },
    {
      id:     'listen',
      icon:   '👂',
      title:  t('听词选义', 'Listen & Choose', 'Ascolta e Scegli'),
      desc:   t('听发音选意思', 'Hear word, pick meaning', 'Ascolta e scegli il significato'),
      color:  '#FFF8E1',
      accent: '#E65100',
      onClick: () => onMode?.('listen'),
    },
    {
      id:     'fill',
      icon:   '✏️',
      title:  t('看义填词', 'Fill in Blank', 'Completa'),
      desc:   t('看意思写词组', 'See meaning, write the word', 'Vedi e scrivi la parola'),
      color:  '#F3E5F5',
      accent: '#6A1B9A',
      onClick: () => onMode?.('fill'),
    },
  ];

  return (
    <ModuleTemplate
      color="#2E7D32"
      icon="📝"
      title={t('词语', 'Vocabulary', 'Vocabolario')}
      subtitle={t('词汇 · 闪卡 · 听写', 'Vocabulary · flashcards · dictation', 'Vocabolario · flashcard')}
      onBack={onBack}
      backLabel={t('‹ 返回主页', '‹ Back', '‹ Indietro')}
      stats={[
        { value: wordCount,     label: t('个词组', 'words', 'parole') },
        { value: practicedCount, label: t('已练',  'practiced', 'praticate') },
      ]}
      modules={modules}
      lang={lang}
      extra={<AdaptiveCard module="words" lang={lang}/>}
    />
  );
}
