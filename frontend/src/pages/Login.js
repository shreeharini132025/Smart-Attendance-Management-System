import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, LogIn } from 'lucide-react';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  // Load & initialise Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') return;

    const scriptId = 'google-gsi-script';
    if (document.getElementById(scriptId)) {
      initGoogle();
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);

    return () => {};
  }, []);

  const initGoogle = () => {
    if (!window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: 'outline',
      size: 'large',
      width: googleBtnRef.current.offsetWidth || 340,
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
    });
  };

  const handleGoogleResponse = async (response) => {
    try {
      const user = await googleLogin(response.credential);
      toast.success(`Welcome, ${user.name}!`);
      const paths = { admin: '/admin/dashboard', faculty: '/faculty/dashboard', student: '/student/dashboard' };
      navigate(paths[user.role] || '/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google sign-in failed. Try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      const paths = { admin: '/admin/dashboard', faculty: '/faculty/dashboard', student: '/student/dashboard' };
      navigate(paths[user.role] || '/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Theme toggle — top right */}
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      {/* Background orbs */}
      <div className="login-bg-orb" style={{ width: 500, height: 500, background: 'radial-gradient(circle, #6366f1, transparent)', top: '-10%', left: '-5%' }} />
      <div className="login-bg-orb" style={{ width: 400, height: 400, background: 'radial-gradient(circle, #06b6d4, transparent)', bottom: '-10%', right: '-5%' }} />
      <div className="login-bg-orb" style={{ width: 300, height: 300, background: 'radial-gradient(circle, #8b5cf6, transparent)', top: '40%', right: '20%' }} />

      <div className="login-card">
        <div className="login-logo">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ width: 120, height: 120, borderRadius: 24, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.05)', boxShadow: 'var(--shadow-glow)' }}>
              <img src="/logo.png" alt="SmartAttend Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </div>
          <h1>SmartAttend</h1>
          <p>Smart Attendance Management System</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="Enter your email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                className="form-input"
                placeholder="Enter your password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ paddingRight: 44 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Signing in...</> : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>

        {/* Google Sign-In */}
        <div className="login-divider">
          <span>or</span>
        </div>

        {GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE' ? (
          <div ref={googleBtnRef} className="google-btn-container" />
        ) : (
          <div className="google-btn-placeholder">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Sign in with Google</span>
            <span className="google-btn-config-note">(Configure Client ID to enable)</span>
          </div>
        )}

      </div>
    </div>
  );
}
