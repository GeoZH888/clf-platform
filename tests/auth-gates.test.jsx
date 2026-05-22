// tests/auth-gates.test.jsx
// Unit tests for the frontend role gates — RequireRole and RoleRedirect.
// These tests mock useAuth so they don't need a real Supabase session.
//
// What this catches:
//   - A regression in RequireRole's role check (e.g. allow list logic broken)
//   - A regression in RoleRedirect's per-role home mapping
// What this does NOT catch:
//   - Anything DB-side. See tests/rls.integration.test.js for that.

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub the AuthContext module so we can control useAuth's return per test.
vi.mock('../src/school/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '../src/school/contexts/AuthContext';

import RequireRole   from '../src/auth/RequireRole.jsx';
import RoleRedirect  from '../src/auth/RoleRedirect.jsx';

// jsdom's window.location is non-configurable per-property, so we swap the
// whole object. vi.stubGlobal('location', ...) is restored by unstubAllGlobals.
let replaceMock;
beforeEach(() => {
  vi.clearAllMocks();
  replaceMock = vi.fn();
  vi.stubGlobal('location', { replace: replaceMock });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequireRole', () => {
  test('denies user whose role is NOT in the allow list', () => {
    useAuth.mockReturnValue({ user: { role: 'student' }, loading: false });
    render(<RequireRole allow={['teacher']}>secret content</RequireRole>);
    expect(screen.getByText(/Access denied/i)).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  test('renders children when role matches the allow list', () => {
    useAuth.mockReturnValue({ user: { role: 'teacher' }, loading: false });
    render(<RequireRole allow={['super_admin', 'teacher']}>secret content</RequireRole>);
    expect(screen.getByText('secret content')).toBeInTheDocument();
    expect(screen.queryByText(/Access denied/i)).not.toBeInTheDocument();
  });

  test('super_admin passes every teacher/student/parent gate', () => {
    // This is the "god mode" check — super_admin appears in every
    // RequireRole allow list across the role apps.
    useAuth.mockReturnValue({ user: { role: 'super_admin' }, loading: false });

    for (const allow of [['teacher'], ['student'], ['parent'], ['school_master']]) {
      const { unmount } = render(
        <RequireRole allow={['super_admin', ...allow]}>passed</RequireRole>
      );
      expect(screen.getByText('passed')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('RoleRedirect', () => {
  test.each([
    ['super_admin',   '/admin-v2'],
    ['school_master', '/community'],
    ['teacher',       '/community'],
    ['student',       '/community'],
    ['parent',        '/community'],
  ])('redirects %s to %s', (role, expected) => {
    useAuth.mockReturnValue({ user: { id: 'u1', role }, loading: false });
    render(<RoleRedirect />);
    expect(replaceMock).toHaveBeenCalledWith(expected);
  });

  test('unknown role falls back to "/" (and does NOT crash)', () => {
    // Regression guard against the gap flagged in the audit:
    // an invalid role shouldn't land a user on a privileged route.
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'hacker' }, loading: false });
    render(<RoleRedirect />);
    expect(replaceMock).toHaveBeenCalledWith('/');
  });
});
