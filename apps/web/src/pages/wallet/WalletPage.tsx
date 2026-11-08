import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Gavel,
  Lock,
  RefreshCcw,
  ShieldCheck,
  Unlock,
  Wallet,
} from 'lucide-react';
import { formatKobo, nairaToKobo } from '@autodey/shared';
import { apiRequest } from '../../lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PriceTag,
  Skeleton,
  useToast,
} from '../../components/ui';

interface WalletData {
  wallet: {
    _id: string;
    availableKobo: number;
    heldKobo: number;
    forfeitedKobo: number;
    totalDepositKobo: number;
    biddingPowerKobo: number;
    minDepositKobo: number;
    depositMultiplier: number;
    currency: 'NGN';
  };
  transactions: Array<{
    _id: string;
    type: 'deposit' | 'hold' | 'release' | 'forfeit' | 'refund' | 'fee';
    direction: 'credit' | 'debit';
    amountKobo: number;
    balanceAfterAvailableKobo: number;
    balanceAfterHeldKobo: number;
    referenceType: string;
    referenceId: string;
    description: string;
    createdAt: string;
  }>;
}

export function WalletPage() {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [depositNaira, setDepositNaira] = useState<string>('100000');
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawNaira, setWithdrawNaira] = useState<string>('100000');
  const [bankName, setBankName] = useState('GTBank (Guaranty Trust Bank)');
  const [accountNumber, setAccountNumber] = useState('0123456789');

  const { data, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiRequest<WalletData>('/wallet'),
  });

  const fundDepositMutation = useMutation({
    mutationFn: async (amountKobo: number) => {
      const initRes = await apiRequest<{
        reference: string;
        authorizationUrl: string;
        provider: 'mock' | 'paystack';
      }>('/payments/paystack/initialize', {
        method: 'POST',
        body: JSON.stringify({
          amountKobo,
          purpose: 'bidding_deposit',
        }),
      });

      if (initRes.provider === 'mock') {
        await apiRequest('/payments/paystack/webhook', {
          method: 'POST',
          headers: {
            'x-paystack-signature': 'mock-valid-signature',
          },
          body: JSON.stringify({
            event: 'charge.success',
            data: {
              reference: initRes.reference,
              amount: amountKobo,
              status: 'success',
            },
          }),
        });
      }
      return initRes;
    },
    onSuccess: (_res, amountKobo) => {
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      pushToast({
        type: 'success',
        title: 'Refundable Bidding Deposit Funded',
        message: `${formatKobo(amountKobo)} added to your auction wallet. You now have ${formatKobo(
          amountKobo * 50,
        )} in additional bidding power.`,
      });
    },
    onError: (err: Error) => {
      pushToast({
        type: 'error',
        title: 'Deposit Failed',
        message: err.message,
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amountKobo = nairaToKobo(Number(withdrawNaira));
      return apiRequest('/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amountKobo,
          bankName,
          accountNumber,
        }),
      });
    },
    onSuccess: () => {
      setWithdrawModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      pushToast({
        type: 'success',
        title: 'Refund Processed',
        message: 'Your unlocked bidding deposit has been refunded via Paystack.',
      });
    },
    onError: (err: Error) => {
      pushToast({
        type: 'error',
        title: 'Withdrawal Failed',
        message: err.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const wallet = data?.wallet;
  const transactions = data?.transactions ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600 mb-1">
            <ShieldCheck className="w-4 h-4" />
            Serious-Bidder Verification Ledger
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
            Refundable Bidding Deposit Wallet
          </h1>
          <p className="text-sm text-ink-secondary mt-1">
            Every ₦100,000 refundable deposit unlocks up to ₦5,000,000 in live auction bidding
            power (50x multiplier). Non-winning deposits unlock automatically when an auction ends.
          </p>
        </div>
        <Link to="/auctions">
          <Button variant="outline" leftIcon={<Gavel className="w-4 h-4" />}>
            Browse Live Auctions
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border-l-4 border-l-brand-600">
          <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
            <span>AVAILABLE UNLOCKED DEPOSIT</span>
            <Unlock className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-2">
            <PriceTag kobo={wallet?.availableKobo ?? 0} size="lg" />
          </div>
          <p className="text-xs text-ink-secondary mt-2">
            Ready to bid or refund to your bank in one click
          </p>
        </Card>

        <Card className="p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
            <span>LOCKED ON ACTIVE AUCTIONS</span>
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <PriceTag kobo={wallet?.heldKobo ?? 0} size="lg" />
          </div>
          <p className="text-xs text-ink-secondary mt-2">
            Automatically released if you do not win the auction
          </p>
        </Card>

        <Card className="p-5 bg-elevated">
          <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
            <span>AVAILABLE BIDDING POWER (50X)</span>
            <Wallet className="w-4 h-4 text-brand-600" />
          </div>
          <div className="mt-2">
            <PriceTag kobo={wallet?.biddingPowerKobo ?? 0} size="lg" />
          </div>
          <p className="text-xs text-ink-secondary mt-2">
            Maximum vehicle hammer price your unlocked deposit covers
          </p>
        </Card>
      </div>

      {/* Top-Up & Withdraw Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Add Refundable Bidding Deposit</h2>
            <Badge variant="id_verified">Paystack Instant Checkout</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {[100_000, 200_000, 300_000, 500_000].map((presetNaira) => (
              <button
                key={presetNaira}
                type="button"
                onClick={() => setDepositNaira(String(presetNaira))}
                className={`px-3.5 py-2 rounded-control text-xs font-semibold font-mono tabular-nums border transition ${
                  Number(depositNaira) === presetNaira
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-line hover:border-brand-500 text-ink'
                }`}
              >
                ₦{presetNaira.toLocaleString()} (Unlocks ₦{(presetNaira * 50).toLocaleString()})
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <Input
                label="Deposit Amount (NGN)"
                type="number"
                min={100000}
                step={10000}
                value={depositNaira}
                onChange={(e) => setDepositNaira(e.target.value)}
                helperText={`Minimum deposit: ₦100,000. Unlocks ₦${(
                  (Number(depositNaira) || 0) * 50
                ).toLocaleString()} bidding limit.`}
              />
            </div>
            <Button
              size="lg"
              loading={fundDepositMutation.isPending}
              onClick={() => {
                const naira = Number(depositNaira);
                if (!Number.isFinite(naira) || naira < 100_000) {
                  pushToast({
                    type: 'error',
                    title: 'Minimum Deposit is ₦100,000',
                    message: 'Please enter at least ₦100,000.',
                  });
                  return;
                }
                fundDepositMutation.mutate(nairaToKobo(naira));
              }}
            >
              Fund Deposit Now
            </Button>
          </div>

          <div className="p-3.5 rounded-control bg-elevated border border-line text-xs text-ink-secondary leading-relaxed">
            <strong className="text-ink">Important Disclosure:</strong> This is a refundable
            serious-bidder security deposit, not a vehicle purchase escrow. When you win an auction,
            you inspect the car and papers in person and settle the purchase directly with the
            seller within 72 hours. Once both parties confirm handover, 100% of your deposit is
            unlocked.
          </div>
        </Card>

        <Card className="p-6 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">One-Click Deposit Refund</h2>
            <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
              Done bidding? Withdraw your unlocked deposit back to your Nigerian bank account or
              original Paystack card at any time with zero withdrawal fees.
            </p>
          </div>

          <div className="p-4 rounded-control bg-elevated border border-line">
            <div className="text-xs text-ink-muted">Unlocked & Refundable Now</div>
            <div className="text-xl font-bold font-mono tabular-nums mt-1 text-ink">
              {formatKobo(wallet?.availableKobo ?? 0)}
            </div>
          </div>

          <Button
            variant="outline"
            fullWidth
            disabled={!wallet || wallet.availableKobo <= 0}
            leftIcon={<RefreshCcw className="w-4 h-4" />}
            onClick={() => {
              if (wallet) {
                setWithdrawNaira(String(Math.floor(wallet.availableKobo / 100)));
              }
              setWithdrawModalOpen(true);
            }}
          >
            Refund / Withdraw Deposit
          </Button>
        </Card>
      </div>

      {/* Double-Entry Ledger History */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 text-ink">Immutable Wallet Ledger</h2>
        {transactions.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-8 h-8 text-brand-600" />}
            title="No wallet transactions yet"
            description="Fund a refundable bidding deposit above to unlock live auction bidding."
          />
        ) : (
          <div className="divide-y divide-line">
            {transactions.map((tx) => {
              const isCredit = tx.direction === 'credit';
              return (
                <div
                  key={tx._id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 p-2 rounded-full ${
                        isCredit
                          ? 'bg-emerald-500/15 text-brand-600'
                          : 'bg-amber-500/15 text-amber-600'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink">{tx.description}</div>
                      <div className="text-xs text-ink-muted font-mono tabular-nums">
                        {tx.type.toUpperCase()} · Ref: {tx.referenceId} ·{' '}
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div
                      className={`text-sm font-bold ${
                        isCredit ? 'text-brand-600' : 'text-amber-600'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {formatKobo(tx.amountKobo)}
                    </div>
                    <div className="text-xs text-ink-muted">
                      Avail: {formatKobo(tx.balanceAfterAvailableKobo)} · Held:{' '}
                      {formatKobo(tx.balanceAfterHeldKobo)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        title="Refund Unlocked Bidding Deposit"
      >
        <div className="space-y-4">
          <Input
            label="Refund Amount (NGN)"
            type="number"
            value={withdrawNaira}
            onChange={(e) => setWithdrawNaira(e.target.value)}
          />
          <Input
            label="Destination Bank"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <Input
            label="NUBAN Account Number (10 digits)"
            value={accountNumber}
            maxLength={10}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setWithdrawModalOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={withdrawMutation.isPending}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => withdrawMutation.mutate()}
            >
              Confirm Instant Refund
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
