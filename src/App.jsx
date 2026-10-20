// ============================================
// BIKE DANGLER INDUSTRIES - FARM MANAGEMENT SYSTEM
// React + Supabase
// ============================================
// This is a complete, working React app. 
// Deploy to Vercel or Netlify with environment variables set.

import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, arrivedFromEmailLink } from './supabaseClient';
import { resetFarmCache } from './data';
import DashboardPage from './pages/DashboardPage';
import PoultryPage from './pages/PoultryPage';
import CropsPage from './pages/CropsPage';
import TasksPage from './pages/TasksPage';
import EquipmentPage from './pages/EquipmentPage';
import InventoryPage from './pages/InventoryPage';
import PartnerPage from './pages/PartnerPage';
import ReportPage from './pages/ReportPage';
import TeamPage from './pages/TeamPage';

// Pages and which roles can open them. Partner Dashboard shows money,
// so workers don't get it; the database enforces the same rules.
const NAV_ITEMS = [
  { page: 'dashboard', icon: '📊', label: 'Dashboard', roles: ['OWNER', 'PARTNER', 'WORKER'], Component: DashboardPage },
  { page: 'tasks', icon: '✓', label: 'Tasks', roles: ['OWNER', 'PARTNER', 'WORKER'], Component: TasksPage },
  { page: 'poultry', icon: '🐔', label: 'Poultry', roles: ['OWNER', 'PARTNER', 'WORKER'], Component: PoultryPage },
  { page: 'crops', icon: '🌱', label: 'Crops', roles: ['OWNER', 'PARTNER', 'WORKER'], Component: CropsPage },
  { page: 'inventory', icon: '📦', label: 'Inventory', roles: ['OWNER', 'PARTNER', 'WORKER'], Component: InventoryPage },
  { page: 'equipment', icon: '⚙️', label: 'Equipment', roles: ['OWNER', 'PARTNER', 'WORKER'], Component: EquipmentPage },
  { page: 'partner', icon: '👥', label: 'Partner Dashboard', roles: ['OWNER', 'PARTNER'], Component: PartnerPage },
  { page: 'report', icon: '📄', label: 'Report', roles: ['OWNER', 'PARTNER'], Component: ReportPage },
  { page: 'team', icon: '🔑', label: 'Team', roles: ['OWNER'], Component: TeamPage },
];

// ============================================
// MAIN APP COMPONENT
// ============================================

export default function FurrowApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null); // row from `users`, incl. role
  const [profileError, setProfileError] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(arrivedFromEmailLink);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data: { session } }) => loadUser(session?.user || null));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore token refreshes; only react when who's logged in changes.
      // Deferred: calling Supabase inside this callback can deadlock supabase-js.
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => loadUser(session?.user || null), 0);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // The profile row is created by a database trigger on sign-up
  // (supabase/01_security_and_roles.sql); the app never creates it.
  const loadUser = async (user) => {
    setCurrentUser(user);
    setProfileError('');
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .select('user_id, email, full_name, role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) setProfileError(error.message);
    setProfile(data || null);
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetFarmCache();
    setNeedsPassword(false);
    setCurrentPage('dashboard');
    setMenuOpen(false);
  };

  if (!isSupabaseConfigured) {
    return (
      <CenteredMessage title="App not configured">
        REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY are missing or still placeholders.
        Set them in <code>.env.local</code> (local) or in the Vercel project settings, then rebuild.
      </CenteredMessage>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-green-50"><div className="text-xl">Loading Bike Dangler...</div></div>;
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  if (needsPassword) {
    return (
      <SetPasswordPage
        email={currentUser.email}
        onSignOut={signOut}
        onDone={() => {
          setNeedsPassword(false);
          window.history.replaceState(null, '', window.location.pathname);
        }}
      />
    );
  }

  const role = profile?.role;

  if (!role || role === 'PENDING') {
    return (
      <CenteredMessage title={profile ? 'Waiting for approval' : 'Account not set up'} onSignOut={signOut}>
        {profile ? (
          <>You're signed in as <strong>{currentUser.email}</strong>. The farm owner needs to approve your
          account before you can see anything. Ask them to open the Team page.</>
        ) : (
          <>No profile found for <strong>{currentUser.email}</strong>. If you're the owner, run
          <code> supabase/01_security_and_roles.sql</code> in Supabase.
          {profileError && <span className="block mt-2 text-red-600">{profileError}</span>}</>
        )}
      </CenteredMessage>
    );
  }

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const page = navItems.some((item) => item.page === currentPage) ? currentPage : 'dashboard';
  const goTo = (p) => {
    setCurrentPage(p);
    setMenuOpen(false);
  };
  const pageProps = { currentUser, role, onNavigate: goTo };
  const Page = navItems.find((item) => item.page === page).Component;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100">
      {/* Mobile top bar */}
      <header className="md:hidden bg-green-800 text-white no-print">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">🚲 Bike Dangler</h1>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="px-3 py-1 rounded border border-green-600 text-sm font-semibold"
            aria-expanded={menuOpen}
          >
            {menuOpen ? 'Close' : '☰ Menu'}
          </button>
        </div>
        {menuOpen && (
          <nav className="pb-2 border-t border-green-700">
            {navItems.map((item) => (
              <NavItem key={item.page} icon={item.icon} label={item.label}
                onClick={() => goTo(item.page)} active={page === item.page} />
            ))}
            <div className="px-6 py-3 text-sm text-green-200 flex justify-between items-center">
              <span className="truncate">{currentUser.email} · {role}</span>
              <button onClick={signOut} className="ml-3 bg-red-600 px-3 py-1 rounded text-white font-semibold">
                Sign Out
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-green-800 text-white shadow-lg hidden md:flex md:flex-col no-print">
        <div className="p-6 border-b border-green-700">
          <h1 className="text-2xl font-bold">🚲 Bike Dangler</h1>
          <p className="text-green-200 text-sm mt-1">Farm Management</p>
        </div>
        <nav className="mt-6 flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem key={item.page} icon={item.icon} label={item.label}
              onClick={() => goTo(item.page)} active={page === item.page} />
          ))}
        </nav>
        <div className="p-6 border-t border-green-700">
          <div className="text-sm mb-3">
            <p className="text-green-200">Logged in as</p>
            <p className="font-semibold truncate">{currentUser.email}</p>
            <p className="text-green-200 text-xs mt-1">{role}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full bg-red-600 hover:bg-red-700 py-2 rounded text-sm font-semibold transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Page key={page} {...pageProps} />
      </main>
    </div>
  );
}

function CenteredMessage({ title, children, onSignOut }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-green-800">{title}</h1>
        <p className="text-gray-700">{children}</p>
        {onSignOut && (
          <button onClick={onSignOut} className="mt-6 bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded font-semibold">
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// NAVIGATION COMPONENT
// ============================================

function NavItem({ icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-6 py-3 flex items-center gap-3 transition ${
        active ? 'bg-green-700 border-l-4 border-white' : 'hover:bg-green-700'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// ============================================
// LOGIN PAGE
// ============================================

// No public sign-up: the owner invites people from Supabase
// (Authentication → Users → Invite user). After a successful sign-in the
// auth listener in FurrowApp takes over.
function LoginPage() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'error' | 'info', text }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage({ tone: 'info', text: 'If that email has an account, a link to set a new password is on its way.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-4xl font-bold text-center mb-2 text-green-800">🚲 Bike Dangler Industries</h1>
        <p className="text-center text-gray-600 mb-8">
          {mode === 'forgot' ? 'Reset your password' : 'Farm Management System'}
        </p>

        {message && (
          <div className={`p-4 rounded mb-6 ${message.tone === 'info' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
          {mode === 'signin' && (
            <input type="password" placeholder="Password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} className={inputCls} required />
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'forgot' ? 'Send reset link' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          <button
            onClick={() => { setMode(mode === 'forgot' ? 'signin' : 'forgot'); setMessage(null); }}
            className="text-green-600 hover:text-green-700 font-semibold"
          >
            {mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}
          </button>
          <p className="text-sm text-gray-500">Accounts are by invitation only. Ask the farm owner for an invite.</p>
        </div>
      </div>
    </div>
  );
}

// Shown after following an invite or password-reset email link: the person is
// signed in by the link but has no (known) password yet.
function SetPasswordPage({ email, onDone, onSignOut }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }
    setSaving(true);
    setError('');
    const { error: updError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updError) setError(updError.message);
    else onDone();
  };

  const inputCls = 'w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2 text-green-800">Choose a password</h1>
        <p className="text-center text-gray-600 mb-6">for <strong>{email}</strong></p>
        {error && <div className="p-4 rounded mb-6 bg-red-50 text-red-700">{error}</div>}
        <form onSubmit={save} className="space-y-4">
          <input type="password" placeholder="New password (8+ characters)" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} required />
          <input type="password" placeholder="Type it again" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} required />
          <button type="submit" disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save password'}
          </button>
        </form>
        <button onClick={onSignOut} className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700">Sign out</button>
      </div>
    </div>
  );
}
