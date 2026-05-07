# replace_login_page.py
# Replaces src/school/pages/LoginPage.jsx with a clean minimal login page.
#
# - Panda image header
# - 大卫学中文 title (David Learns Chinese)
# - Single ZH/EN/IT label toggle (no account-type tabs, no codes, no email)
# - Username + password only
# - Single "登录" button
# - Auto-redirects already-logged-in users via the AuthContext we already wired
#
# Backs up the old file as LoginPage.jsx.bak before overwriting.

import pathlib, sys, shutil

ROOT = pathlib.Path.cwd()
target = ROOT / "src" / "school" / "pages" / "LoginPage.jsx"

if not target.exists():
    print(f"ERROR: {target} not found")
    sys.exit(1)

# Backup
backup = target.with_suffix(".jsx.bak")
if not backup.exists():
    shutil.copy2(target, backup)
    print(f"Backup -> {backup.name}")
else:
    print(f"Backup already exists at {backup.name}")

NEW_LOGIN = '''// src/school/pages/LoginPage.jsx
// Clean minimal login page for the David Learns Chinese platform.
// Username + password only. ZH/EN/IT toggle for labels.
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const TXT = {
  zh: {
    title: "\u5927\u536b\u5b66\u4e2d\u6587",
    subtitle: "\u8bf7\u767b\u5f55\u4ee5\u7ee7\u7eed",
    username: "\u7528\u6237\u540d",
    username_ph: "\u7531\u7ba1\u7406\u5458\u5206\u914d",
    password: "\u5bc6\u7801",
    password_ph: "\u5bc6\u7801",
    login: "\u767b\u5f55",
    logging_in: "\u767b\u5f55\u4e2d\u00b7\u00b7\u00b7",
    error_empty: "\u8bf7\u586b\u5199\u7528\u6237\u540d\u548c\u5bc6\u7801",
  },
  en: {
    title: "David Learns Chinese",
    subtitle: "Please log in to continue",
    username: "Username",
    username_ph: "Provided by your admin",
    password: "Password",
    password_ph: "Password",
    login: "Log in",
    logging_in: "Logging in\u00b7\u00b7\u00b7",
    error_empty: "Please fill in username and password",
  },
  it: {
    title: "David Impara il Cinese",
    subtitle: "Accedi per continuare",
    username: "Nome utente",
    username_ph: "Fornito dall\u2019amministratore",
    password: "Password",
    password_ph: "Password",
    login: "Accedi",
    logging_in: "Accesso in corso\u00b7\u00b7\u00b7",
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
          <LangBtn active={lang === "zh"} onClick={() => setLang("zh")}>\u4e2d\u6587</LangBtn>
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
'''

target.write_text(NEW_LOGIN, encoding="utf-8")
size_kb = target.stat().st_size / 1024
print(f"Wrote new {target.name} ({size_kb:.1f} KB)")
print(f"Old version preserved as {backup.name}")
print()
print("=== DONE ===")
print()
print("NEXT STEPS:")
print("  1. Restart the dev server (it should hot-reload, but to be safe):")
print("       In the terminal running netlify dev/npm run dev: Ctrl+C")
print("       Then re-run it.")
print()
print("  2. Hard-reload localhost:5174/ (Ctrl+Shift+R) in incognito.")
print("     You should see the new clean login page.")
