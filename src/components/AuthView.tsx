import React, { useState } from 'react';
import { ArrowLeft, Lock, UserPlus, KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { apiRequest, setStoredToken } from '../utils/api';
import type { RoleName } from '../types/lms';
import campusHeroImg from '../assets/images/school_campus_hero_1794743578426.jpg';

export type AuthMode = 'login' | 'register' | 'forgot';

interface AuthSuccessPayload {
  token: string;
  user: {
    id: number;
    fullName: string;
    email: string;
    role: RoleName;
    permissions: string[];
  };
}

interface AuthViewProps {
  initialMode: AuthMode;
  onBack: () => void;
  onAuthSuccess: (payload: AuthSuccessPayload) => void;
}

const DEMO_ACCOUNTS = [
  { label: 'Administrator', email: 'admin@lichgogo.edu.et', pass: 'Admin@2026', note: 'Full system control' },
  { label: 'Instructor', email: 'dawit.t@lichgogo.edu.et', pass: 'Teacher@2026', note: 'Physics & Math' },
  { label: 'Student (Fee Cleared)', email: 'sara.m@lichgogo.edu.et', pass: 'Student@2026', note: 'Natural Science' },
  { label: 'Student (Fee Pending)', email: 'yonas.g@lichgogo.edu.et', pass: 'Student@2026', note: 'Tests fee clearance lock' },
  { label: 'Registrar', email: 'registrar@lichgogo.edu.et', pass: 'Registrar@2026', note: 'Admissions & Report Cards' },
  { label: 'Finance Officer', email: 'finance@lichgogo.edu.et', pass: 'Finance@2026', note: 'Payment verification' },
];

export const AuthView: React.FC<AuthViewProps> = ({
  initialMode,
  onBack,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regForm, setRegForm] = useState({
    fullName: '',
    email: '',
    password: '',
    gender: 'Male',
    dateOfBirth: '2008-05-12',
    gradeId: '3',
    streamCode: 'NATURAL_SCIENCE',
    guardianName: '',
    guardianPhone: '',
  });

  // Reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<AuthSuccessPayload>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(res.token);
      onAuthSuccess(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<AuthSuccessPayload & { studentCode: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...regForm,
          gradeId: Number(regForm.gradeId),
        }),
      });
      setStoredToken(res.token);
      onAuthSuccess(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string; resetCodePreview?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: resetEmail }),
        },
      );
      setInfo(
        res.resetCodePreview
          ? `${res.message} Sandbox Reset Code: ${res.resetCodePreview}`
          : res.message,
      );
      setResetStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail, resetCode, newPassword }),
      });
      setInfo(res.message);
      setMode('login');
      setEmail(resetEmail);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent';

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#0B1120] flex flex-col justify-center py-8 lg:py-12 px-4">
      <div className="max-w-5xl w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#163B65] dark:text-slate-200 hover:text-[#2563EB] dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to School Website</span>
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Hosanna, Ethiopia · Grades 9–12 Residential Academy
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Primary Auth Panel */}
          <div className="lg:col-span-7 min-w-0 overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 lg:p-8 space-y-6">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-[#14B8A6]">
                Lich Gogo Excellence Boarding School
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[#163B65] dark:text-white">
                {mode === 'login' && 'Academic Portal Sign In'}
                {mode === 'register' && 'Student Portal Registration'}
                {mode === 'forgot' && 'Password Recovery'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'login' && 'Access courses, gradebooks, attendance registers, and fee clearance records.'}
                {mode === 'register' && 'Create your scholar account and select a single academic stream.'}
                {mode === 'forgot' && 'Verify your institutional email to generate a secure password reset code.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`py-2 px-1.5 text-[11px] sm:text-xs font-medium rounded-md text-center truncate ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-[#163B65] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`py-2 px-1.5 text-[11px] sm:text-xs font-medium rounded-md text-center truncate ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-[#163B65] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Register Student
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError('');
                }}
                className={`py-2 px-1.5 text-[11px] sm:text-xs font-medium rounded-md text-center truncate ${
                  mode === 'forgot'
                    ? 'bg-white dark:bg-slate-900 text-[#163B65] dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Reset Password
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-700 dark:text-red-300"
              >
                {error}
              </div>
            )}
            {info && (
              <div className="p-3.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 text-xs font-medium text-teal-800 dark:text-teal-200">
                {info}
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    School Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@lichgogo.edu.et"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-sm font-semibold disabled:opacity-60"
                >
                  <Lock className="w-4 h-4" />
                  <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Student Full Name
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={regForm.fullName}
                      onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. Dawit Kebede"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={regForm.email}
                      onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                      className={inputClass}
                      placeholder="student@lichgogo.edu.et"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-pass" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Password (min 6 chars)
                    </label>
                    <input
                      id="reg-pass"
                      type="password"
                      required
                      minLength={6}
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-gender" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Gender
                    </label>
                    <select
                      id="reg-gender"
                      value={regForm.gender}
                      onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                      className={inputClass}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-grade" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Grade Level
                    </label>
                    <select
                      id="reg-grade"
                      value={regForm.gradeId}
                      onChange={(e) => setRegForm({ ...regForm, gradeId: e.target.value })}
                      className={inputClass}
                    >
                      <option value="1">Grade 9</option>
                      <option value="2">Grade 10</option>
                      <option value="3">Grade 11</option>
                      <option value="4">Grade 12</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reg-stream" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Academic Stream (Single Stream Only)
                    </label>
                    <select
                      id="reg-stream"
                      value={regForm.streamCode}
                      onChange={(e) => setRegForm({ ...regForm, streamCode: e.target.value })}
                      className={inputClass}
                    >
                      <option value="NATURAL_SCIENCE">Natural Science</option>
                      <option value="SOCIAL_SCIENCE">Social Science</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-guardian" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Parent / Guardian Name
                    </label>
                    <input
                      id="reg-guardian"
                      type="text"
                      value={regForm.guardianName}
                      onChange={(e) => setRegForm({ ...regForm, guardianName: e.target.value })}
                      className={inputClass}
                      placeholder="Guardian Full Name"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Guardian Phone
                    </label>
                    <input
                      id="reg-phone"
                      type="text"
                      value={regForm.guardianPhone}
                      onChange={(e) => setRegForm({ ...regForm, guardianPhone: e.target.value })}
                      className={inputClass}
                      placeholder="+251 911 ..."
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#2563EB] hover:bg-[#163B65] text-white text-sm font-semibold disabled:opacity-60"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{loading ? 'Creating Student Account...' : 'Create Student Account'}</span>
                </button>
              </form>
            )}

            {mode === 'forgot' && (
              <div className="space-y-4">
                {resetStep === 'request' ? (
                  <form onSubmit={handleRequestReset} className="space-y-4">
                    <div>
                      <label htmlFor="reset-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Registered School Email
                      </label>
                      <input
                        id="reset-email"
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className={inputClass}
                        placeholder="user@lichgogo.edu.et"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#163B65] hover:bg-[#2563EB] text-white text-sm font-semibold"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Generate Password Reset Code</span>
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleConfirmReset} className="space-y-4">
                    <div>
                      <label htmlFor="reset-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Reset Verification Code
                      </label>
                      <input
                        id="reset-code"
                        type="text"
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className={`${inputClass} font-mono-tabular`}
                        placeholder="8-character code"
                      />
                    </div>
                    <div>
                      <label htmlFor="reset-new-pass" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        New Password
                      </label>
                      <input
                        id="reset-new-pass"
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#2563EB] hover:bg-[#163B65] text-white text-sm font-semibold"
                    >
                      Confirm Password Reset
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Campus Visual + Sample Demonstration Accounts Panel */}
          <div className="lg:col-span-5 min-w-0 flex flex-col gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-800 relative">
                <img
                  src={campusHeroImg}
                  alt="Lich Gogo Excellence Boarding School Campus"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent flex flex-col justify-end p-4 text-white">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-teal-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Role-Based Academic Portal</span>
                  </div>
                  <p className="text-xs font-medium mt-0.5 text-white/95">
                    Centralized Governance for Scholars, Faculty, Registrar &amp; Finance
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <h2 className="font-display text-base font-semibold text-[#163B65] dark:text-white">
                  Sample Portal Accounts (Demo Data)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Select any role below to populate the sign-in form and test real database
                  permissions, grading workflows, and fee clearance enforcement.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {DEMO_ACCOUNTS.map((acc) => (
                  <div
                    key={acc.email}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {acc.label}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400 truncate">
                        {acc.email} · {acc.note}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setEmail(acc.email);
                        setPassword(acc.pass);
                        setError('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#2563EB] hover:bg-blue-50/50 dark:hover:bg-slate-800 text-[#2563EB] shrink-0 whitespace-nowrap"
                    >
                      Fill Credentials
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
