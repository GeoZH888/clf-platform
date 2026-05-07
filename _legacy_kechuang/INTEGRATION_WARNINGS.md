# Integration Warnings

This kechuang/ subtree contains David's React code copied verbatim from lingua-school.
The code is NOT integrated yet. Below is the checklist of what does not work and what
needs to be done to integrate.

## Will not compile until you fix:

### 1. Auth model mismatch
David's pages use useAuth() from contexts/AuthContext, returns {user, login, logout, isAuthenticated, loading}.
CLF uses useDeviceAuth() returning {label, modules, status, expiresAt, ...}.

Options to integrate:
  (a) Create an adapter hook that wraps useDeviceAuth and presents a David-shaped API
  (b) Replace useAuth() calls in every ported page with useDeviceAuth() and adjust shape
  (c) Keep David's AuthContext but make it call /netlify/functions/student-auth internally

### 2. Routing mismatch
David's pages assume react-router-dom: useNavigate(), useParams(), <Routes>, <Route>.
CLF uses screen-state navigation in App.jsx (no router).

Options:
  (a) Add react-router-dom to CLF's App.jsx, wire up <BrowserRouter>, mount kechuang routes
  (b) Convert each David page to use CLF's screen-state pattern
  (c) Use react-router-dom only for the kechuang subtree

### 3. Supabase client
David's contexts/AuthContext.jsx hardcodes:
  https://wrpyhgklasdtgdtyuief.supabase.co
This is David's OLD Supabase, no longer relevant. Must be changed to CLF's URL.

David's services/supabase.js likely has same hardcoded URL.

### 4. Layout collision
David has src/components/Layout.jsx. CLF likely has src/components/Layout.jsx.
The ported David Layout is at src/kechuang/components/Layout.jsx â€” different file,
no conflict, but imports may resolve to the wrong one if not careful.

### 5. Table references
The David code's table references already use dwxz_ prefix (Stage 3A applied earlier).
This was done on the lingua-school folder before this port. If you re-port from a
different David source, you'll need to re-run the find/replace.

To verify: search ported files for \.from\(' â€” all should be dwxz_* or dwxz_users_view.

### 6. Missing dependencies
David's package.json has dependencies CLF may not have:
  - react-router-dom (definitely needed)
  - bcryptjs (already in CLF as it's used for jgw_registrations auth)
  - any others David specifically uses

Run 
pm ls in CLF after porting to see what's missing.

### 7. Style collisions
David's styles/ may use class names that conflict with CLF's CSS.
Recommendation: namespace David's CSS â€” wrap kechuang routes in a div with
class "kechuang-app" and prefix all David CSS selectors.

## Files to NOT use directly:
- App.jsx.from-david â€” for reference only, do NOT import
- contexts/AuthContext.jsx â€” duplicates CLF auth, must reconcile
- services/supabase.js â€” points at wrong Supabase URL

## Files safe to use after path adjustment:
- pages/* â€” once auth + routing fixed
- components/* â€” likely independent of auth/routing
- styles/* â€” likely independent

## Recommended integration order:
1. Add react-router-dom to CLF, wire <BrowserRouter>
2. Decide auth strategy (adapter or replacement)
3. Pick ONE simple page (e.g. ParentDashboard.jsx) and make it work end-to-end
4. Use that as template for the rest
5. Iterate page by page, testing each

This is a 2-4 week integration project. The bulk port is the easy part; what
follows is the real work.
