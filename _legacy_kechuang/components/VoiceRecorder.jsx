import React, { useState, useRef, useEffect } from 'react';

/**
 * VoiceRecorder Component
 * 
 * Features:
 * - Record voice (for student homework submission)
 * - Playback recording
 * - Teacher demo reading with TTS
 * - Teacher voice correction recording
 * - Waveform visualization
 * - Download recording
 */

const VoiceRecorder = ({ 
  onRecordingComplete, 
  textToRead = '',
  showDemo = false,
  showCorrection = false,
  existingAudioUrl = null,
  language = 'zh'
}) => {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(existingAudioUrl);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // TTS state (for teacher demo)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.8);
  
  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  const txt = {
    zh: {
      startRecording: '开始录音',
      stopRecording: '停止录音',
      pauseRecording: '暂停',
      resumeRecording: '继续',
      playRecording: '播放录音',
      stopPlaying: '停止播放',
      deleteRecording: '删除录音',
      downloadRecording: '下载录音',
      demoRead: '示范朗读',
      stopDemo: '停止示范',
      recordCorrection: '录制纠正',
      textToRead: '朗读文本',
      recordingTime: '录音时长',
      noMicrophone: '无法访问麦克风',
      recordingComplete: '录音完成',
      slower: '慢速',
      normal: '正常',
      faster: '快速',
      speed: '速度',
      studentRecording: '学生录音',
      teacherDemo: '教师示范',
      teacherCorrection: '教师纠正'
    },
    en: {
      startRecording: 'Start Recording',
      stopRecording: 'Stop Recording',
      pauseRecording: 'Pause',
      resumeRecording: 'Resume',
      playRecording: 'Play',
      stopPlaying: 'Stop',
      deleteRecording: 'Delete',
      downloadRecording: 'Download',
      demoRead: 'Demo Read',
      stopDemo: 'Stop Demo',
      recordCorrection: 'Record Correction',
      textToRead: 'Text to Read',
      recordingTime: 'Duration',
      noMicrophone: 'Cannot access microphone',
      recordingComplete: 'Recording complete',
      slower: 'Slow',
      normal: 'Normal',
      faster: 'Fast',
      speed: 'Speed',
      studentRecording: 'Student Recording',
      teacherDemo: 'Teacher Demo',
      teacherCorrection: 'Teacher Correction'
    },
    it: {
      startRecording: 'Inizia Registrazione',
      stopRecording: 'Ferma',
      pauseRecording: 'Pausa',
      resumeRecording: 'Riprendi',
      playRecording: 'Riproduci',
      stopPlaying: 'Ferma',
      deleteRecording: 'Elimina',
      downloadRecording: 'Scarica',
      demoRead: 'Demo Lettura',
      stopDemo: 'Ferma Demo',
      recordCorrection: 'Registra Correzione',
      textToRead: 'Testo da Leggere',
      recordingTime: 'Durata',
      noMicrophone: 'Impossibile accedere al microfono',
      recordingComplete: 'Registrazione completata',
      slower: 'Lento',
      normal: 'Normale',
      faster: 'Veloce',
      speed: 'Velocità',
      studentRecording: 'Registrazione Studente',
      teacherDemo: 'Demo Insegnante',
      teacherCorrection: 'Correzione Insegnante'
    }
  };
  const t = txt[language] || txt.en;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioUrl && audioUrl !== existingAudioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio analyser for visualization
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Setup media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        if (onRecordingComplete) onRecordingComplete(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Start visualization
      drawWaveform();
      
    } catch (error) {
      console.error('Microphone error:', error);
      alert(t.noMicrophone);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  };

  // Pause/Resume recording
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    
    if (isPaused) {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    }
    setIsPaused(!isPaused);
  };

  // Draw waveform visualization
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!isRecording) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgb(220, 38, 38)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    
    draw();
  };

  // Play recording
  const playRecording = () => {
    if (!audioRef.current || !audioUrl) return;
    
    audioRef.current.src = audioUrl;
    audioRef.current.play();
    setIsPlaying(true);
    
    audioRef.current.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
    };
    
    audioRef.current.ontimeupdate = () => {
      setPlaybackTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    };
  };

  // Stop playing
  const stopPlaying = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setPlaybackTime(0);
    }
  };

  // Delete recording
  const deleteRecording = () => {
    if (audioUrl && audioUrl !== existingAudioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    if (onRecordingComplete) onRecordingComplete(null);
  };

  // Download recording
  const downloadRecording = () => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording_${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Teacher demo: Text-to-Speech
  const speakDemo = () => {
    if (!synthRef.current || !textToRead) return;
    
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'zh-CN';
    utterance.rate = speechRate;
    utterance.pitch = 1;
    
    // Find Chinese voice
    const voices = synthRef.current.getVoices();
    const chineseVoice = voices.find(v => v.lang.includes('zh'));
    if (chineseVoice) utterance.voice = chineseVoice;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current.speak(utterance);
  };

  // Stop demo
  const stopDemo = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div style={{ 
      border: '1px solid var(--border)', 
      borderRadius: 'var(--radius-md)', 
      padding: '1rem',
      background: 'var(--surface)'
    }}>
      {/* Text to read (if provided) */}
      {textToRead && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.75rem', 
          background: 'var(--background)', 
          borderRadius: 'var(--radius-sm)',
          fontSize: '1.1rem',
          lineHeight: '1.8'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            📖 {t.textToRead}:
          </div>
          <div style={{ color: 'var(--text-primary)' }}>{textToRead}</div>
        </div>
      )}

      {/* Waveform visualization */}
      {isRecording && (
        <canvas 
          ref={canvasRef} 
          width="300" 
          height="60" 
          style={{ 
            width: '100%', 
            height: '60px', 
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1rem'
          }} 
        />
      )}

      {/* Recording timer */}
      {(isRecording || audioUrl) && (
        <div style={{ 
          textAlign: 'center', 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          marginBottom: '1rem',
          color: isRecording ? 'var(--error)' : 'var(--text-primary)'
        }}>
          {isRecording ? (
            <>🔴 {formatTime(recordingTime)}</>
          ) : (
            <>🎵 {formatTime(playbackTime)} / {formatTime(duration || recordingTime)}</>
          )}
        </div>
      )}

      {/* Hidden audio element */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {/* Control buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
        
        {/* Teacher Demo Button */}
        {showDemo && textToRead && (
          <>
            <button 
              className={`btn ${isSpeaking ? 'btn-error' : 'btn-outline'}`}
              onClick={isSpeaking ? stopDemo : speakDemo}
            >
              {isSpeaking ? `⏹️ ${t.stopDemo}` : `🔊 ${t.demoRead}`}
            </button>
            
            {/* Speed control */}
            <select 
              className="form-select" 
              value={speechRate} 
              onChange={e => setSpeechRate(parseFloat(e.target.value))}
              style={{ width: 'auto' }}
            >
              <option value="0.6">{t.slower}</option>
              <option value="0.8">{t.normal}</option>
              <option value="1.0">{t.faster}</option>
            </select>
          </>
        )}

        {/* Recording controls */}
        {!isRecording && !audioUrl && (
          <button className="btn btn-primary" onClick={startRecording}>
            🎤 {t.startRecording}
          </button>
        )}

        {isRecording && (
          <>
            <button className="btn btn-error" onClick={stopRecording}>
              ⏹️ {t.stopRecording}
            </button>
            <button className="btn btn-outline" onClick={togglePause}>
              {isPaused ? `▶️ ${t.resumeRecording}` : `⏸️ ${t.pauseRecording}`}
            </button>
          </>
        )}

        {/* Playback controls */}
        {audioUrl && !isRecording && (
          <>
            <button 
              className={`btn ${isPlaying ? 'btn-error' : 'btn-success'}`}
              onClick={isPlaying ? stopPlaying : playRecording}
            >
              {isPlaying ? `⏹️ ${t.stopPlaying}` : `▶️ ${t.playRecording}`}
            </button>
            <button className="btn btn-outline" onClick={deleteRecording}>
              🗑️ {t.deleteRecording}
            </button>
            <button className="btn btn-outline" onClick={downloadRecording}>
              📥 {t.downloadRecording}
            </button>
          </>
        )}

        {/* Teacher correction button */}
        {showCorrection && !isRecording && (
          <button className="btn btn-warning" onClick={startRecording}>
            🎤 {t.recordCorrection}
          </button>
        )}
      </div>

      {/* Recording complete message */}
      {audioUrl && !isRecording && (
        <div style={{ 
          marginTop: '1rem', 
          textAlign: 'center', 
          color: 'var(--success)',
          fontSize: '0.875rem'
        }}>
          ✅ {t.recordingComplete} ({formatTime(recordingTime)})
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
