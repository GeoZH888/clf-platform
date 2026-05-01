// src/kechuang/KechuangApp.jsx
//
// Entry point for everything under /kechuang/* paths.
// Wraps the kechuang subtree in BrowserRouter (basename /kechuang) so all
// kechuang pages can use react-router-dom hooks (useNavigate, useParams, etc.)
// without affecting CLF's existing screen-state navigation.
//
// Step 3.2: Just a placeholder route at /kechuang/test to verify routing works.
// Real kechuang pages will be mounted incrementally in Steps 3.5+.

import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function KechuangPlaceholder() {
  return (
    <div style={{
      maxWidth: 600,
      margin: '60px auto',
      padding: 24,
      fontFamily: 'system-ui, sans-serif',
      lineHeight: 1.6,
    }}>
      <h1 style={{ marginTop: 0 }}>课堂 (Kechuang) Router OK</h1>
      <p>If you see this page, react-router-dom is working inside the kechuang subtree.</p>
      <p>Path:&nbsp;<code>{window.location.pathname}</code></p>

      <h3>Test routes:</h3>
      <ul>
        <li><Link to="/kechuang/test">/kechuang/test</Link></li>
        <li><Link to="/kechuang/foo">/kechuang/foo</Link></li>
        <li><Link to="/kechuang/whatever/works">/kechuang/whatever/works</Link></li>
      </ul>

      <p style={{ marginTop: 32, fontSize: 13, color: '#888' }}>
        Step 3.2 of merge integration. To return to CLF: <a href="/">go home</a>.
      </p>
    </div>
  );
}

export default function KechuangApp() {
  return (
    <BrowserRouter basename="/kechuang">
      <Routes>
        {/* All routes currently render the placeholder.
            Replace with real kechuang pages in Steps 3.5+. */}
        <Route path="*" element={<KechuangPlaceholder />} />
      </Routes>
    </BrowserRouter>
  );
}
