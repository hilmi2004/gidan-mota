import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Lock, Phone, ShieldCheck } from 'lucide-react';
import { BRAND_CONFIG } from '@autodey/shared';
import { Badge, BrandLogo, Button, Card, Input, useToast } from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAppStore, type AuthUser } from '../../stores/useAppStore';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const setSession = useAppStore((s) => s.setSession);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('0803 555 0199');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);
  const [ndpaConsent, setNdpaConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{
        message: string;
        phoneMasked: string;
        devOtpCode?: string;
      }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });

      if (res.devOtpCode) {
        setDevOtpPreview(res.devOtpCode);
        setOtpCode(res.devOtpCode);
      }
      setStep('otp');
      pushToast({
        type: 'success',
        title: 'OTP Sent via SMS',
        message: `Enter the 6-digit code sent to ${res.phoneMasked}.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        isNewUser: boolean;
        user: AuthUser;
      }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          code: otpCode,
          displayName: displayName.trim() || undefined,
          email: email.trim() || undefined,
          ndpaConsent,
        }),
      });

      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });

      pushToast({
        type: 'success',
        title: res.isNewUser ? `Welcome to ${BRAND_CONFIG.name}!` : 'Welcome back!',
        message: 'Your phone number is verified.',
      });

      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="text-center mb-6 space-y-3">
        <div className="flex justify-center">
          <BrandLogo size="lg" showText showTagline />
        </div>
        <Badge variant="phone_verified">Phone-First Nigerian Verification</Badge>
        <h1 className="text-2xl md:text-3xl font-bold text-ink">
          Sign in to {BRAND_CONFIG.name}
        </h1>
        <p className="text-sm text-ink-secondary">
          One verified account to buy, sell, chat with dealers, and bid on live auctions.
        </p>
      </div>

      <Card padding="lg" className="space-y-5">
        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <Input
              label="Nigerian Mobile Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0803 123 4567"
              leftAddon={<Phone className="w-4 h-4" />}
              tabular
              error={error ?? undefined}
              helperText="We will send a 6-digit SMS verification code (valid for 5 minutes)."
              required
            />

            <Input
              label="Your Name or Dealership Name (for new accounts)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Chinedu Okafor"
            />

            <Input
              label="Email Address (Optional — for auction alerts)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="chinedu@example.com"
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
              Send 6-Digit SMS Code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {devOtpPreview && (
              <div className="p-3.5 rounded-control bg-emerald-500/10 border border-brand-500/30 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="font-semibold text-brand-700 dark:text-brand-500 block">
                    Local Mock SMS Adapter Active
                  </span>
                  <span className="text-ink-secondary">
                    Generated OTP: <strong className="font-mono">{devOtpPreview}</strong>
                  </span>
                </div>
                <Badge variant="phone_verified">Auto-filled</Badge>
              </div>
            )}

            <Input
              label="6-Digit SMS Verification Code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              leftAddon={<Lock className="w-4 h-4" />}
              tabular
              maxLength={6}
              error={error ?? undefined}
              helperText={`Sent to ${phone}. Expires in 5 minutes.`}
              required
            />

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                }}
              >
                Change Number
              </Button>
              <Button type="submit" variant="primary" fullWidth loading={loading}>
                Verify & Continue
              </Button>
            </div>
          </form>
        )}

        <div className="pt-4 border-t border-line flex items-start gap-2.5 text-xs text-ink-muted">
          <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
          <p>
            Your phone number is masked on your public profile (`0803 *** **99`) until a verified
            buyer taps to reveal it.
          </p>
        </div>
      </Card>
    </div>
  );
};

