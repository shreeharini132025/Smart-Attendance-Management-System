import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, KeyRound, CheckCircle, ArrowLeft, Camera } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

function getDeviceFingerprint() {
  const nav = navigator;
  return btoa(
    `${nav.userAgent}${nav.language}${window.screen.width}x${window.screen.height}${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  ).slice(0, 64);
}

async function getLocation() {
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation?.getCurrentPosition(res, rej, { timeout: 3000 })
    );
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return { latitude: null, longitude: null };
  }
}

// ── OTP Entry Component ────────────────────────────────────
function OtpEntry({ onSuccess, onBack }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputsRef = useRef([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      inputsRef.current[5]?.focus();
    }
  };

  const handleSubmit = async () => {
    const otpStr = otp.join('');
    if (otpStr.length !== 6) return toast.error('Please enter the complete 6-digit OTP');
    setLoading(true);
    try {
      const { latitude, longitude } = await getLocation();
      await api.post('/student/attendance/mark-otp', {
        otp: otpStr,
        device_fingerprint: getDeviceFingerprint(),
        latitude,
        longitude
      });
      onSuccess('otp');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to mark attendance';
      toast.error(msg);
      if (err.response?.status === 403 || err.response?.status === 400) {
        setOtp(['', '', '', '', '', '']);
        inputsRef.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const filled = otp.join('').length === 6;

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px', boxShadow: '0 0 24px rgba(99,102,241,0.4)'
      }}>
        <KeyRound size={32} color="white" />
      </div>

      <h2 style={{ fontSize: '1.4rem', marginBottom: 8, fontWeight: 700 }}>Enter OTP</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.9rem', lineHeight: 1.6 }}>
        Enter the <strong>6-digit OTP</strong> displayed on your faculty's screen to mark your attendance.
      </p>

      {/* OTP Boxes */}
      <div className="otp-inputs-container" onPaste={handlePaste}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={el => inputsRef.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className="otp-input-box"
            style={{
              background: digit ? 'rgba(99,102,241,0.12)' : 'var(--bg-input)',
              border: `2px solid ${digit ? 'var(--primary)' : 'var(--border)'}`,
              boxShadow: digit ? '0 0 12px rgba(99,102,241,0.35)' : 'none',
              color: 'var(--text-primary)'
            }}
          />
        ))}
      </div>

      {/* Hint */}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 20 }}>
        💡 OTP is shown on the projector/faculty screen — it refreshes every minute
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 2, justifyContent: 'center' }}
          onClick={handleSubmit}
          disabled={loading || !filled}
        >
          {loading
            ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Verifying...</>
            : '✅ Mark Attendance'
          }
        </button>
      </div>
    </div>
  );
}

// ── QR Scanner Component ───────────────────────────────────
function QrScanner({ onSuccess, onBack }) {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
      // Poll frames for QR
      intervalRef.current = setInterval(scanFrame, 500);
    } catch {
      toast.error('Camera permission denied. Please allow camera access.');
    }
  };

  const stopCamera = () => {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopCamera(), []);

  const scanFrame = async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);

      // Use BarcodeDetector if available (modern browsers)
      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const codes = await detector.detect(canvas);
        if (codes.length > 0) {
          stopCamera();
          handleQRResult(codes[0].rawValue);
        }
      }
    } catch {}
  };

  const handleQRResult = async (rawValue) => {
    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed.token) return toast.error('Invalid QR code — no session token found');
      setLoading(true);
      const { latitude, longitude } = await getLocation();
      await api.post('/student/attendance/mark-qr', {
        qr_token: parsed.token,
        device_fingerprint: getDeviceFingerprint(),
        latitude,
        longitude
      });
      onSuccess('qr');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to mark attendance. QR may be expired.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px', boxShadow: '0 0 24px rgba(6,182,212,0.4)'
      }}>
        <QrCode size={32} color="white" />
      </div>

      <h2 style={{ fontSize: '1.4rem', marginBottom: 8, fontWeight: 700 }}>Scan QR Code</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem', lineHeight: 1.6 }}>
        Point your camera at the QR code displayed by your faculty to instantly mark attendance.
      </p>

      {/* Camera View */}
      <div style={{
        position: 'relative', borderRadius: 16, overflow: 'hidden',
        background: 'var(--bg-card2)', border: '2px solid var(--border)',
        marginBottom: 20, aspectRatio: '1/1', maxWidth: 320, margin: '0 auto 20px'
      }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanning ? 'block' : 'none' }}
          muted playsInline
        />
        {!scanning && (
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Camera size={48} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Camera not active</p>
          </div>
        )}
        {scanning && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              width: 180, height: 180, border: '3px solid #06b6d4',
              borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)'
            }} />
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, gap: 8, alignItems: 'center', color: '#10b981' }}>
          <div className="spinner" style={{ width: 20, height: 20 }} /> Marking attendance...
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
        {!scanning ? (
          <button className="btn btn-primary btn-lg" style={{ justifyContent: 'center', width: '100%' }} onClick={startCamera} disabled={loading}>
            <Camera size={18} /> Start Camera
          </button>
        ) : (
          <button className="btn btn-danger" style={{ justifyContent: 'center', width: '100%' }} onClick={stopCamera}>
            Stop Camera
          </button>
        )}
        <button className="btn btn-outline" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      {!('BarcodeDetector' in window) && (
        <p style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: 12 }}>
          ⚠️ QR scanning not supported in this browser. Please use Chrome/Edge or use the OTP method instead.
        </p>
      )}
    </div>
  );
}

// ── Main Attendance Page ────────────────────────────────────
export default function StudentAttendance() {
  const navigate = useNavigate();
  // mode: 'choose' | 'otp' | 'qr' | 'success' | 'error'
  const [mode, setMode] = useState('choose');
  const [successMethod, setSuccessMethod] = useState('');

  const handleSuccess = (method) => {
    setSuccessMethod(method);
    setMode('success');
    toast.success('Attendance marked! ✅');
    // Auto-redirect to subjects page after 2.5 seconds
    setTimeout(() => {
      navigate('/student/subjects');
    }, 2500);
  };

  const reset = () => {
    setMode('choose');
    setSuccessMethod('');
  };

  // Step progress
  const stepIndex = mode === 'choose' ? 0 : mode === 'otp' || mode === 'qr' ? 1 : 2;

  return (
    <div>
      <div className="page-header">
        <h1>📋 Mark Attendance</h1>
        <p>Scan the QR Code or enter the OTP to mark your attendance</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 500 }}>

          {/* Step Indicator */}
          <div style={{ display: 'flex', marginBottom: 28 }}>
            {['Choose Method', 'Verify', 'Confirmed'].map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: done ? '#10b981' : active ? 'var(--primary)' : 'var(--bg-card2)',
                      border: `2px solid ${done ? '#10b981' : active ? 'var(--primary)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 6px', fontSize: '0.85rem', fontWeight: 700, color: 'white',
                      transition: 'all 0.3s ease'
                    }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.72rem', color: active ? 'var(--primary-light)' : 'var(--text-muted)' }}>{s}</div>
                  </div>
                  {i < 2 && (
                    <div style={{
                      width: 40, height: 2,
                      background: done ? '#10b981' : 'var(--border)',
                      flexShrink: 0, margin: '-24px 0 0',
                      transition: 'background 0.4s ease'
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Choose Method ── */}
          {mode === 'choose' && (
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
              <h2 style={{ fontSize: '1.3rem', marginBottom: 8, fontWeight: 700 }}>Mark Attendance</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '0.9rem' }}>
                Choose how you'd like to mark your attendance
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Scan QR */}
                <button
                  onClick={() => setMode('qr')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '18px 20px', borderRadius: 16, cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(8,145,178,0.05))',
                    border: '1.5px solid rgba(6,182,212,0.4)',
                    color: 'var(--text-primary)', textAlign: 'left', width: '100%',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#06b6d4'; e.currentTarget.style.background = 'rgba(6,182,212,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.4)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(8,145,178,0.05))'; }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(6,182,212,0.3)'
                  }}>
                    <QrCode size={26} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 3 }}>Scan QR Code</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Use your camera to scan the QR code on the board</div>
                  </div>
                </button>

                {/* Enter OTP */}
                <button
                  onClick={() => setMode('otp')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '18px 20px', borderRadius: 16, cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))',
                    border: '1.5px solid rgba(99,102,241,0.4)',
                    color: 'var(--text-primary)', textAlign: 'left', width: '100%',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))'; }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.3)'
                  }}>
                    <KeyRound size={26} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 3 }}>Enter OTP</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Type the 6-digit OTP shown on faculty's screen</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── OTP Mode ── */}
          {mode === 'otp' && (
            <OtpEntry onSuccess={handleSuccess} onBack={() => setMode('choose')} />
          )}

          {/* ── QR Mode ── */}
          {mode === 'qr' && (
            <QrScanner onSuccess={handleSuccess} onBack={() => setMode('choose')} />
          )}

          {/* ── Success ── */}
          {mode === 'success' && (
            <div className="card" style={{ textAlign: 'center', borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: 'rgba(16,185,129,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                animation: 'successPulse 0.6s ease-out'
              }}>
                <CheckCircle size={52} color="#10b981" />
              </div>
              <h2 style={{ color: '#10b981', marginBottom: 8, fontSize: '1.6rem', fontWeight: 800 }}>Attendance Marked!</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
                Your attendance has been recorded successfully.
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 28 }}>
                Verified via: <strong style={{ color: successMethod === 'qr' ? '#06b6d4' : '#6366f1' }}>
                  {successMethod === 'qr' ? 'QR Code Scan' : 'OTP Entry'}
                </strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button 
                  className="btn btn-primary btn-lg" 
                  style={{ justifyContent: 'center', width: '100%' }} 
                  onClick={() => navigate('/student/subjects')}
                >
                  📅 View My Subjects
                </button>
                <button 
                  className="btn btn-outline btn-lg" 
                  style={{ justifyContent: 'center', width: '100%' }} 
                  onClick={reset}
                >
                  Mark Another Class
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes successPulse {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
