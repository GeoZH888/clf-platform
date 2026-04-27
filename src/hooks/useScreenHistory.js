// src/hooks/useScreenHistory.js
// Drop-in replacement for useState that syncs screen state with browser history.
// Lets the phone hardware back button (and PWA back gesture) navigate back
// through screens instead of exiting the entire app.
//
// Usage:
//   const [screen, setScreen] = useScreenHistory('home', 'poetry');
//
// Args:
//   initialScreen — same as useState initial value
//   levelKey      — namespace for this hook instance (e.g. 'app', 'poetry',
//                   'chengyu'). Different namespaces don't interfere.
//
// Behavior:
// 1. Calling setScreen pushes a new entry onto window.history with state
//    { levelKey, screen }. Hash is set to "#<levelKey>:<screen>" for debugging.
// 2. When user presses phone back button, browser fires popstate. The hook
//    listens, and if the popped state's levelKey matches ours, syncs internal
//    state. Otherwise it lets the event bubble (parent hook can handle).
// 3. Initial mount does NOT push history (it just records initial state).
//
// IMPORTANT: This hook should only be used inside the student-facing app
// tree. Admin app uses normal useState — different UX expectations.

import { useState, useEffect, useCallback, useRef } from 'react';

const STATE_KEY = '_clfNav';   // marker so we know it's our state, not router's

export function useScreenHistory(initialScreen, levelKey) {
  const [screen, setScreenInternal] = useState(initialScreen);

  // Track if the most recent change came from popstate (to avoid double-push)
  const fromPopstate = useRef(false);

  // ── setScreen wrapper: push history state when changing ──────────────────
  const setScreen = useCallback((next) => {
    setScreenInternal(prev => {
      // Support functional updates: setScreen(s => s + 1)
      const value = typeof next === 'function' ? next(prev) : next;
      if (value === prev) return prev;          // no-op if same
      if (fromPopstate.current) {
        // Don't push history when called from popstate handler
        fromPopstate.current = false;
        return value;
      }
      try {
        window.history.pushState(
          { [STATE_KEY]: true, levelKey, screen: value },
          '',
          `#${levelKey}:${value}`,
        );
      } catch (e) { /* fail silent — state update still works */ }
      return value;
    });
  }, [levelKey]);

  // ── popstate listener: roll back internal state when user presses back ───
  useEffect(() => {
    function handlePopstate(e) {
      const state = e.state || {};
      // Only react if either:
      //  (a) popped state belongs to our level, OR
      //  (b) popped state is null/undefined (back beyond our pushes)
      // and current internal screen is not the new history target.
      if (state[STATE_KEY] && state.levelKey === levelKey) {
        // Browser is back to a state we pushed earlier — sync to it
        if (state.screen !== screen) {
          fromPopstate.current = true;
          setScreenInternal(state.screen);
        }
      } else if (!state[STATE_KEY] || state.levelKey !== levelKey) {
        // Popped past our entries — reset to initial
        if (initialScreen !== screen) {
          fromPopstate.current = true;
          setScreenInternal(initialScreen);
        }
      }
    }
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [levelKey, screen, initialScreen]);

  return [screen, setScreen];
}

// ── Top-level back-button-to-exit handler ──────────────────────────────────
// Used in App.jsx top level. When user is on platform home and presses back,
// shows a confirmation toast. Pressing back again within 2 seconds exits the
// app (or rather, lets the browser handle the back).
//
// Usage:
//   useExitConfirm(screen === 'platform', t('再按一次退出', 'Press again to exit', 'Premi di nuovo per uscire'));

export function useExitConfirm(isAtRoot, message = 'Press back again to exit') {
  const armedRef = useRef(false);
  const timerRef = useRef(null);
  const toastRef = useRef(null);

  useEffect(() => {
    if (!isAtRoot) return;

    function handlePopstate(e) {
      // Only intercept if we're at root
      if (!armedRef.current) {
        // First press: arm the exit, show toast, push state to "consume" the back
        armedRef.current = true;
        try {
          window.history.pushState(
            { _clfNavRoot: true },
            '',
            window.location.pathname,
          );
        } catch {}

        // Show simple inline toast
        if (!toastRef.current) {
          const div = document.createElement('div');
          div.textContent = message;
          div.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: rgba(20,15,10,0.92); color: #fdf6e3;
            padding: 10px 22px; border-radius: 22px; font-size: 13px;
            z-index: 9999; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            font-family: inherit;
          `;
          document.body.appendChild(div);
          toastRef.current = div;
        }

        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          armedRef.current = false;
          if (toastRef.current) {
            toastRef.current.remove();
            toastRef.current = null;
          }
        }, 2000);
      }
      // If armedRef.current is true, don't preventDefault — browser will go back
    }

    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
      clearTimeout(timerRef.current);
      if (toastRef.current) {
        toastRef.current.remove();
        toastRef.current = null;
      }
    };
  }, [isAtRoot, message]);
}
