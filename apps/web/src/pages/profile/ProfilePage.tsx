import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Download,
  ExternalLink,
  LogOut,
  MapPin,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { NIGERIA_STATES_LGAS } from '@autodey/shared';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  PriceTag,
  Select,
  Skeleton,
  Tabs,
  useToast,
} from '../../components/ui';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

interface MeResponse {
  user: {
    id: string;
    phone: string;
    phoneMasked: string;
    email?: string;
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    state?: string;
    lga?: string;
    whatsappNumber?: string;
    roles: string[];
    verification: {
      phoneVerified: boolean;
      idVerified: boolean;
      dealerVerified: boolean;
    };
    strikes: number;
    responseStats: {
      ratePercent: number;
      avgResponseMinutes: number;
    };
    ratingStats: {
      avg: number;
      count: number;
    };
    memberSince: string;
    activeListingsCount: number;
  };
  kycRecords: Array<{
    id: string;
    provider: string;
    providerReference: string;
    documentType: string;
    status: string;
    verifiedAt?: string;
  }>;
  dealerProfile: {
    id: string;
    slug: string;
    businessName: string;
    cacNumber: string;
    address: string;
    state: string;
    lga: string;
    status: 'pending' | 'approved' | 'rejected';
    planTier: string;
  } | null;
  wallet: {
    availableKobo: number;
    heldKobo: number;
    forfeitedKobo: number;
  };
}

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { user, updateUser, clearSession } = useAppStore();

  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('trust');

  // Edit profile state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [stateName, setStateName] = useState('Lagos');
  const [lga, setLga] = useState('Lekki');
  const [savingProfile, setSavingProfile] = useState(false);

  // KYC form state
  const [docType, setDocType] = useState<'nin' | 'bvn' | 'drivers_license' | 'international_passport'>('nin');
  const [idNumber, setIdNumber] = useState('72910482911');
  const [firstName, setFirstName] = useState('Chinedu');
  const [lastName, setLastName] = useState('Okafor');
  const [submittingKyc, setSubmittingKyc] = useState(false);

  // Dealer form state
  const [businessName, setBusinessName] = useState('Okafor Premier Auto Lot');
  const [cacNumber, setCacNumber] = useState('RC-1849201');
  const [address, setAddress] = useState('Plot 14, Lekki-Epe Expressway, Jakande, Lagos');
  const [shopPhoto, setShopPhoto] = useState(
    'https://images.unsplash.com/photo-1562141989-c5c79ac8f576?w=800&auto=format&fit=crop&q=80',
  );
  const [submittingDealer, setSubmittingDealer] = useState(false);

  const loadMe = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<MeResponse>('/users/me');
      setData(res);
      setDisplayName(res.user.displayName);
      setBio(res.user.bio || '');
      setStateName(res.user.state || 'Lagos');
      setLga(res.user.lga || 'Lekki');
    } catch {
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    void loadMe();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiRequest<{ user: MeResponse['user'] }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName,
          bio,
          state: stateName,
          lga,
        }),
      });
      updateUser({
        displayName: res.user.displayName,
        state: res.user.state,
        lga: res.user.lga,
      });
      await loadMe();
      pushToast({
        type: 'success',
        title: 'Profile Updated',
        message: 'Your seller profile changes are live.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Update Failed',
        message: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingKyc(true);
    try {
      const res = await apiRequest<{
        message: string;
        verification: MeResponse['user']['verification'];
      }>('/users/me/kyc', {
        method: 'POST',
        body: JSON.stringify({
          documentType: docType,
          idNumber,
          firstName,
          lastName,
        }),
      });
      updateUser({ verification: res.verification });
      await loadMe();
      pushToast({
        type: 'success',
        title: 'ID Verified Badge Unlocked',
        message: 'You can now create live timed car auctions.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'KYC Verification Failed',
        message: err instanceof Error ? err.message : 'Could not verify ID.',
      });
    } finally {
      setSubmittingKyc(false);
    }
  };

  const handleSubmitDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDealer(true);
    try {
      await apiRequest('/users/me/dealer-application', {
        method: 'POST',
        body: JSON.stringify({
          businessName,
          cacNumber,
          address,
          state: stateName,
          lga,
          shopPhotos: [shopPhoto],
        }),
      });
      await loadMe();
      pushToast({
        type: 'success',
        title: 'Dealer CAC Application Submitted',
        message: 'Our moderation team will review your CAC document and lot photos.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Dealer Submission Error',
        message: err instanceof Error ? err.message : 'Invalid CAC details.',
      });
    } finally {
      setSubmittingDealer(false);
    }
  };

  const handleExportData = async () => {
    try {
      const exported = await apiRequest<Record<string, unknown>>('/users/me/export');
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autodey-ndpa-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast({
        type: 'info',
        title: 'NDPA Data Package Downloaded',
        message: 'Your personal data archive has been downloaded.',
      });
    } catch {
      pushToast({ type: 'error', title: 'Export Failed' });
    }
  };

  const handleLogout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => null);
    clearSession();
    navigate('/');
  };

  if (loading || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const lgasForState = NIGERIA_STATES_LGAS[stateName] ?? ['Central'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Profile Summary Card */}
      <Card padding="lg" className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <Avatar
            name={data.user.displayName}
            src={data.user.avatarUrl}
            size="lg"
            verified={data.user.verification.idVerified || data.user.verification.phoneVerified}
          />
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-ink">{data.user.displayName}</h1>
              {data.user.verification.phoneVerified && <Badge variant="phone_verified" />}
              {data.user.verification.idVerified && <Badge variant="id_verified" />}
              {data.user.verification.dealerVerified && <Badge variant="dealer_verified" />}
            </div>
            <p className="text-xs text-ink-secondary flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {data.user.lga}, {data.user.state}
              </span>
              <span>•</span>
              <span className="tabular-nums">
                Response rate: {data.user.responseStats.ratePercent}% (~
                {data.user.responseStats.avgResponseMinutes} mins)
              </span>
              <span>•</span>
              <span>Phone: {data.user.phoneMasked}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to={`/users/${data.user.id}`}>
            <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
              Public Profile
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={handleLogout}
          >
            Sign Out
          </Button>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Tabs
          tabs={[
            { id: 'trust', label: 'Trust & Verification Badges' },
            { id: 'profile', label: 'Profile Settings' },
            { id: 'dealer', label: 'Verified Dealer (CAC)' },
            { id: 'privacy', label: 'Wallet & NDPA Privacy' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Tab 1: Trust & KYC Verification */}
      {activeTab === 'trust' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="space-y-4">
            <h2 className="text-base font-semibold text-ink">Your Verification Tiers</h2>
            <div className="space-y-3">
              <div className="p-3.5 rounded-control bg-elevated border border-line flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-ink">Level 1: Phone Verified</p>
                  <p className="text-[11px] text-ink-secondary">
                    Completed via SMS OTP ({data.user.phoneMasked}). Can browse, chat, and post
                    classified listings.
                  </p>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-control border flex items-start gap-3 ${
                  data.user.verification.idVerified
                    ? 'bg-emerald-500/10 border-brand-500/30'
                    : 'bg-surface border-line'
                }`}
              >
                <ShieldCheck
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    data.user.verification.idVerified ? 'text-brand-600' : 'text-ink-muted'
                  }`}
                />
                <div>
                  <p className="text-xs font-semibold text-ink">Level 2: ID Verified (KYC)</p>
                  <p className="text-[11px] text-ink-secondary">
                    {data.user.verification.idVerified
                      ? `Verified (${data.kycRecords[0]?.providerReference}). Unlocked live auction hosting.`
                      : 'Required to run live timed car auctions and unlock higher bidding limits.'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-control bg-surface border border-line flex items-start gap-3">
                <Award
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    data.user.verification.dealerVerified ? 'text-brand-600' : 'text-ink-muted'
                  }`}
                />
                <div>
                  <p className="text-xs font-semibold text-ink">Level 3: Verified Dealer</p>
                  <p className="text-[11px] text-ink-secondary">
                    {data.dealerProfile
                      ? `CAC ${data.dealerProfile.cacNumber} (${data.dealerProfile.status.toUpperCase()})`
                      : 'For Berger, Lekki, Abuja & PH car lots with CAC registration.'}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="md:col-span-2 space-y-5">
            <div>
              <Badge variant="id_verified">KYC Adapter (Dojah / Smile ID / Local Mock)</Badge>
              <h2 className="text-lg font-semibold text-ink mt-2">
                Complete Instant ID Verification
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                NDPA 2023 Guarantee: We never store your raw NIN or BVN in our database—only the
                encrypted verification reference from our KYC provider.
              </p>
            </div>

            <form onSubmit={handleSubmitKyc} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Government ID Type"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as typeof docType)}
                  options={[
                    { value: 'nin', label: 'National Identification Number (NIN)' },
                    { value: 'bvn', label: 'Bank Verification Number (BVN)' },
                    { value: 'drivers_license', label: 'FRSC Driver’s License' },
                    { value: 'international_passport', label: 'Nigerian International Passport' },
                  ]}
                />
                <Input
                  label="ID Number (Discarded after verification)"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  tabular
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Legal First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <Input
                  label="Legal Last Name / Surname"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" variant="primary" loading={submittingKyc}>
                {data.user.verification.idVerified
                  ? 'Re-Verify Identity Reference'
                  : 'Verify Identity & Unlock Badge'}
              </Button>
            </form>

            {data.kycRecords.length > 0 && (
              <div className="pt-4 border-t border-line">
                <p className="text-xs font-semibold text-ink mb-2">
                  Stored KYC References (Zero Raw PII Stored)
                </p>
                <div className="space-y-2">
                  {data.kycRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 rounded-control bg-elevated border border-line flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-ink">
                          {rec.providerReference}
                        </span>
                        <span className="text-ink-muted ml-2 uppercase">
                          ({rec.documentType} via {rec.provider})
                        </span>
                      </div>
                      <Badge variant="id_verified">{rec.status.toUpperCase()}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Profile Settings */}
      {activeTab === 'profile' && (
        <Card className="max-w-2xl space-y-5">
          <h2 className="text-lg font-semibold text-ink">Edit Public Seller Profile</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="State"
                value={stateName}
                onChange={(e) => {
                  const nextState = e.target.value;
                  setStateName(nextState);
                  setLga(NIGERIA_STATES_LGAS[nextState]?.[0] ?? 'Central');
                }}
                options={Object.keys(NIGERIA_STATES_LGAS).map((s) => ({ value: s, label: s }))}
              />
              <Select
                label="LGA / Area"
                value={lga}
                onChange={(e) => setLga(e.target.value)}
                options={lgasForState.map((l) => ({ value: l, label: l }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-ink-secondary">
                Seller Bio (Shown on your listings & dealer page)
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell buyers about your cars, inspection hours, and warranty policy..."
                className="w-full rounded-control bg-surface border border-line p-3.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <Button type="submit" variant="primary" loading={savingProfile}>
              Save Profile Changes
            </Button>
          </form>
        </Card>
      )}

      {/* Tab 3: Verified Dealer CAC Application */}
      {activeTab === 'dealer' && (
        <Card className="max-w-2xl space-y-5">
          <div>
            <Badge variant="dealer_verified" />
            <h2 className="text-lg font-semibold text-ink mt-2">
              Verified Car Dealer Application (CAC + Lot Verification)
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Approved dealers receive a custom storefront (`/dealer/:slug`), higher listing limits,
              and priority trust placement.
            </p>
          </div>

          <form onSubmit={handleSubmitDealer} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Registered Dealership Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
              <Input
                label="CAC Registration Number (RC or BN)"
                value={cacNumber}
                onChange={(e) => setCacNumber(e.target.value)}
                placeholder="RC-1849201"
                required
              />
            </div>
            <Input
              label="Physical Car Lot Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
            <Input
              label="Car Lot Photo URL"
              value={shopPhoto}
              onChange={(e) => setShopPhoto(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" loading={submittingDealer}>
              Submit Dealer Verification
            </Button>
          </form>
        </Card>
      )}

      {/* Tab 4: Refundable Bidding Deposit Wallet & NDPA Privacy */}
      {activeTab === 'privacy' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="space-y-4">
            <div className="flex items-center gap-2 text-brand-600">
              <Wallet className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Refundable Bidding Deposit Ledger
              </span>
            </div>
            <div>
              <span className="text-xs text-ink-secondary block">Available Deposit Balance</span>
              <PriceTag kobo={data.wallet.availableKobo} size="xl" />
            </div>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Your refundable bidding deposit unlocks <strong>50x bidding power</strong> on live
              auctions and can be withdrawn anytime you have no active winning bids.
            </p>
          </Card>

          <Card className="space-y-4">
            <h3 className="text-base font-semibold text-ink">
              NDPA 2023 Data Portability & Privacy
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Under the Nigeria Data Protection Act (NDPA) 2023, you can export a machine-readable
              copy of all your account records, KYC references, listings, and reviews at any time.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleExportData}
              >
                Download My Data (JSON)
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

