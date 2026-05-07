// src/school/pages/LoginPage.jsx
// Clean minimal login page for the David Learns Chinese platform.
// Username + password only. ZH/EN/IT toggle for labels.
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const TXT = {
  zh: {
    title: "大卫学中文",
    subtitle: "请登录以继续",
    username: "用户名",
    username_ph: "由管理员分配",
    password: "密码",
    password_ph: "密码",
    login: "登录",
    logging_in: "登录中···",
    error_empty: "请填写用户名和密码",
  },
  en: {
    title: "David Learns Chinese",
    subtitle: "Please log in to continue",
    username: "Username",
    username_ph: "Provided by your admin",
    password: "Password",
    password_ph: "Password",
    login: "Log in",
    logging_in: "Logging in···",
    error_empty: "Please fill in username and password",
  },
  it: {
    title: "David Impara il Cinese",
    subtitle: "Accedi per continuare",
    username: "Nome utente",
    username_ph: "Fornito dall’amministratore",
    password: "Password",
    password_ph: "Password",
    login: "Accedi",
    logging_in: "Accesso in corso···",
    error_empty: "Inserisci nome utente e password",
  },
};

const PANDA_URL =
  "https://yqcojudvvjntaajnrilr.supabase.co/storage/v1/object/public/site/panda-mascot.png";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const [lang, setLang] = useState(() => localStorage.getItem("lang_pref") || "zh");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const t = TXT[lang] || TXT.zh;

  // Already logged in? Bounce out.
  useEffect(() => {
    if (!loading && user) {
      window.location.replace("/role-redirect");
    }
  }, [user, loading]);

  useEffect(() => {
    localStorage.setItem("lang_pref", lang);
  }, [lang]);

  async function onSubmit(e) {
    e?.preventDefault?.();
    setError("");
    if (!username.trim() || !password) {
      setError(t.error_empty);
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(username.trim(), password);
      if (result?.success) {
        window.location.replace("/role-redirect");
      } else {
        setError(result?.message || "Login failed");
      }
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <img src={PANDA_URL} alt="Panda" style={S.panda}
          onError={(e) => { e.target.style.display = "none"; }}/>

        <h1 style={S.title}>{t.title}</h1>
        <p  style={S.subtitle}>{t.subtitle}</p>

        <div style={S.langRow}>
          <LangBtn active={lang === "zh"} onClick={() => setLang("zh")}>中文</LangBtn>
          <LangBtn active={lang === "en"} onClick={() => setLang("en")}>EN</LangBtn>
          <LangBtn active={lang === "it"} onClick={() => setLang("it")}>IT</LangBtn>
        </div>

        <form onSubmit={onSubmit} style={S.form}>
          <label style={S.label}>{t.username}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t.username_ph}
            autoComplete="username"
            autoFocus
            style={S.input}/>

          <label style={{ ...S.label, marginTop: 12 }}>{t.password}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.password_ph}
            autoComplete="current-password"
            style={S.input}/>

          {error && <div style={S.error}>{error}</div>}

          <button type="submit" disabled={submitting} style={{
            ...S.button,
            background: submitting ? "#aaa" : S.button.background,
            cursor: submitting ? "wait" : "pointer",
          }}>
            {submitting ? t.logging_in : t.login}
          </button>
        </form>
      </div>
    </div>
  );
}

function LangBtn({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "4px 10px",
      fontSize: 12,
      borderRadius: 6,
      cursor: "pointer",
      background: active ? "#c41e3a" : "transparent",
      color: active ? "#fff" : "#a07850",
      border: `1px solid ${active ? "#c41e3a" : "#e8d5b0"}`,
    }}>
      {children}
    </button>
  );
}

const S = {
  page: {
    minHeight: "100dvh",
    background: "#fdf6e3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e8d5b0",
    padding: "32px 28px",
    boxShadow: "0 8px 24px rgba(196, 30, 58, 0.08)",
    textAlign: "center",
  },
  panda: {
    width: 88,
    height: 88,
    margin: "0 auto 12px",
    display: "block",
    objectFit: "contain",
  },
  title: {
    margin: "4px 0 4px",
    fontSize: 26,
    color: "#c41e3a",
    fontFamily: "'STKaiti','KaiTi','Songti SC',serif",
    letterSpacing: 4,
  },
  subtitle: {
    margin: "0 0 18px",
    fontSize: 12,
    color: "#a07850",
  },
  langRow: {
    display: "flex",
    gap: 6,
    justifyContent: "center",
    marginBottom: 18,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    textAlign: "left",
  },
  label: {
    fontSize: 12,
    color: "#5d4630",
    marginBottom: 4,
  },
  input: {
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #e8d5b0",
    borderRadius: 8,
    background: "#fdf6e3",
    color: "#1a0a05",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  error: {
    marginTop: 12,
    padding: "8px 12px",
    background: "#fde8e8",
    border: "1px solid #f5c2c2",
    borderRadius: 8,
    color: "#c41e3a",
    fontSize: 12,
  },
  button: {
    marginTop: 18,
    padding: "11px 16px",
    fontSize: 15,
    fontWeight: 600,
    background: "#c41e3a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    letterSpacing: 2,
  },
};
