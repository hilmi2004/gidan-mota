import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { BRAND_CONFIG } from '@autodey/shared';
import { Badge, BrandLogo, Button, Card, Input, useToast } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAppStore, type AuthUser } from '../../stores/useAppStore';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const setSession = useAppStore((s) => s.setSession);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [ndpaConsent, setNdpaConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });

      pushToast({
        type: 'success',
        title: `Welcome back, ${res.user.displayName}!`,
        message: 'Signed in successfully.',
      });

      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        isNewUser: boolean;
        user: AuthUser;
      }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          phone: phone.trim() || undefined,
        }),
      });

      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });

      pushToast({
        type: 'success',
        title: `Welcome to ${BRAND_CONFIG.name}!`,
        message: 'Your account is ready. You can now bid, sell, and chat.',
      });

      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass = 'Password123!') => {
    setMode('signin');
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-6 space-y-3">
        <div className="flex justify-center">
          <BrandLogo size="lg" showText showTagline />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Badge variant="id_verified">Fast Email &amp; Password Access</Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">
          {mode === 'signin' ? `Sign in to ${BRAND_CONFIG.name}` : `Create Your Account`}
        </h1>
        <p className="text-xs sm:text-sm text-ink-secondary">
          {mode === 'signin'
            ? 'Access verified Nigerian car classifieds, live timed auctions, and chat.'
            : 'Join verified Nigerian buyers, car owners, and licensed dealers.'}
        </p>
      </div>

      <Card padding="lg" className="space-y-5">
        {/* Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-control bg-elevated border border-line">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-[6px] transition-all ${
              mode === 'signin'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-[6px] transition-all ${
              mode === 'signup'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-control bg-red-500/10 border border-red-500/30 text-xs font-medium text-signal-danger">
            {error}
          </div>
        )}

        {mode === 'signin' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email Address or Phone Number"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. chinedu@autodey.ng or 08031234567"
              leftAddon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftAddon={<Lock className="w-4 h-4" />}
              required
            />

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Sign In
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              label="Full Name or Dealership Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Chinedu Okafor"
              leftAddon={<User className="w-4 h-4" />}
              required
            />

            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. chinedu@example.com"
              leftAddon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password (min 6 characters)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftAddon={<Lock className="w-4 h-4" />}
              required
            />

            <Input
              label="Nigerian Mobile Number (Optional — for WhatsApp chat & contact)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0803 123 4567"
              leftAddon={<Phone className="w-4 h-4" />}
              tabular
            />

            <label className="flex items-start gap-2.5 text-xs text-ink-secondary cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={ndpaConsent}
                onChange={(e) => setNdpaConsent(e.target.checked)}
                className="mt-0.5 rounded border-line text-brand-600 focus:ring-brand-500"
                required
              />
              <span>
                I agree to the {BRAND_CONFIG.name} Terms of Service and Privacy Policy under the
                Nigeria Data Protection Act (NDPA) 2023.
              </span>
            </label>

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Create Free Account
            </Button>
          </form>
        )}

        {/* Demo Accounts Quick-Fill Pill Bar */}
        <div className="pt-3 border-t border-line space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <KeyRound className="w-3.5 h-3.5 text-brand-600" />
            <span className="font-medium">1-Click Test Accounts:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => fillDemoAccount('admin@autodey.ng')}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-elevated hover:bg-brand-600/15 hover:text-brand-700 text-ink-secondary border border-line transition-colors"
            >
              Admin Moderator
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('berger@autodey.ng')}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-elevated hover:bg-brand-600/15 hover:text-brand-700 text-ink-secondary border border-line transition-colors"
            >
              Verified Dealer
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('chinedu@autodey.ng')}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-elevated hover:bg-brand-600/15 hover:text-brand-700 text-ink-secondary border border-line transition-colors"
            >
              Buyer / Seller
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-line flex items-start gap-2.5 text-xs text-ink-muted">
          <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
          <p>
            Your account is secured with scrypt password hashing and JWT sessions. Phone numbers are
            kept masked on public vehicle listings.
          </p>
        </div>
      </Card>
    </div>
  );
};

