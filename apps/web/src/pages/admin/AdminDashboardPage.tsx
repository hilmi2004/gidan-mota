import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Gavel,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { formatKobo } from '@autodey/shared';
import { apiRequest } from '../../lib/api';
import { Badge, Button, Card, EmptyState, Input } from '../../components/ui';

type AdminTab =
  | 'overview'
  | 'moderation'
  | 'dealers'
  | 'documents'
  | 'auctions'
  | 'disputes'
  | 'config';

interface OverviewResponse {
  kpis: {
    totalUsers?: number;
    usersCount?: number;
    activeListings?: number;
    activeListingsCount?: number;
    flaggedListings?: number;
    flaggedListingsCount?: number;
    pendingDealers?: number;
    pendingDealersCount?: number;
    pendingDocuments?: number;
    pendingDocsCount?: number;
    openDisputes?: number;
    openDisputesCount?: number;
    liveAuctions?: number;
    liveAuctionsCount?: number;
    settledAuctionsCount?: number;
    auctionGmvKobo?: number;
    gmvKobo?: number;
    totalPlatformRevenueKobo?: number;
    platformRevenueKobo?: number;
  };
}

interface FlaggedListing {
  _id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  priceKobo: number;
  state: string;
  status: string;
  moderationFlags?: string[];
  reportsCount?: number;
  reportCount?: number;
}

interface UsersDealersResponse {
  users: Array<{
    _id: string;
    phone: string;
    displayName: string;
    roles: string[];
    strikes?: number;
    strikeCount?: number;
    bannedUntil?: string;
    verification?: {
      phoneVerified: boolean;
      idVerified: boolean;
      dealerVerified: boolean;
    };
  }>;
  dealerApplications?: Array<{
    _id: string;
    userId: unknown;
    businessName: string;
    slug: string;
    cacNumber: string;
    status?: 'pending' | 'approved' | 'rejected';
    cacStatus?: 'pending' | 'approved' | 'rejected';
    planTier: string;
    state: string;
  }>;
  dealerProfiles?: Array<{
    _id: string;
    userId: unknown;
    businessName: string;
    slug: string;
    cacNumber: string;
    status?: 'pending' | 'approved' | 'rejected';
    cacStatus?: 'pending' | 'approved' | 'rejected';
    planTier: string;
    state: string;
  }>;
}

interface PendingDocItem {
  _id: string;
  listingId: unknown;
  sellerId: unknown;
  docType?: string;
  type?: string;
  fileUrl: string;
  referenceNumber?: string;
  status: string;
}

interface DisputeItem {
  _id: string;
  auctionId?: string;
  settlementId?: unknown;
  reason: string;
  status: string;
  outcome?: string;
  adminNotes?: string;
}

interface AuditLogItem {
  _id: string;
  actorId: unknown;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

interface AuctionAuditResponse {
  auctionRaw?: {
    _id: string;
    status: string;
    startPrice: number;
    currentPrice: number;
    reservePrice?: number;
  };
  auditLogs?: Array<{
    _id: string;
    bidderId: unknown;
    eventType: string;
    submittedMaxKobo?: number;
    resultingPriceKobo: number;
    ipHash?: string;
    deviceFingerprintHash?: string;
    createdAt: string;
  }>;
  bids?: Array<{
    _id: string;
    bidderId: unknown;
    amountKobo?: number;
    submittedMaxKobo?: number;
    resultingPriceKobo?: number;
    ipHash?: string;
    deviceFingerprintHash?: string;
    createdAt: string;
  }>;
  shillSignals?: string[];
}

export function AdminDashboardPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [auctionIdInput, setAuctionIdInput] = useState('');
  const [inspectedAuctionId, setInspectedAuctionId] = useState('');
  const [configKey, setConfigKey] = useState('minDepositKobo');
  const [configValueJson, setConfigValueJson] = useState('10000000');
  const [feedback, setFeedback] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiRequest<OverviewResponse>('/admin/overview'),
    retry: false,
  });

  const moderationQuery = useQuery({
    queryKey: ['admin-moderation'],
    queryFn: () => apiRequest<{ listings: FlaggedListing[] }>('/admin/moderation/listings'),
    enabled: activeTab === 'moderation' || activeTab === 'overview',
    retry: false,
  });

  const usersDealersQuery = useQuery({
    queryKey: ['admin-users-dealers'],
    queryFn: () => apiRequest<UsersDealersResponse>('/admin/users'),
    enabled: activeTab === 'dealers',
    retry: false,
  });

  const docsQuery = useQuery({
    queryKey: ['admin-documents'],
    queryFn: () => apiRequest<{ documents: PendingDocItem[] }>('/admin/documents'),
    enabled: activeTab === 'documents',
    retry: false,
  });

  const disputesQuery = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: () => apiRequest<{ disputes: DisputeItem[] }>('/admin/disputes'),
    enabled: activeTab === 'disputes',
    retry: false,
  });

  const auditLogsQuery = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiRequest<{ logs: AuditLogItem[] }>('/admin/audit-logs'),
    enabled: activeTab === 'config',
    retry: false,
  });

  const auctionAuditQuery = useQuery({
    queryKey: ['admin-auction-audit', inspectedAuctionId],
    queryFn: () =>
      apiRequest<AuctionAuditResponse>(`/admin/auctions/${inspectedAuctionId}/audit`),
    enabled: Boolean(inspectedAuctionId) && activeTab === 'auctions',
    retry: false,
  });

  const moderateListingMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      apiRequest(`/admin/moderation/listings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: decision, reason: 'Reviewed by moderator' }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-moderation'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });

  const reviewDealerMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      apiRequest(`/admin/dealers/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users-dealers'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) =>
      apiRequest(`/admin/users/${id}/ban`, {
        method: 'PATCH',
        body: JSON.stringify({ banned, durationDays: 30, reason: 'Policy violation' }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users-dealers'] });
    },
  });

  const reviewDocMutation = useMutation({
    mutationFn: ({ docId, status }: { docId: string; status: 'approved' | 'rejected' }) =>
      apiRequest(`/documents/${docId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes: 'Verified against customs duty log' }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-documents'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: ({
      id,
      outcome,
    }: {
      id: string;
      outcome: 'forfeit_deposit' | 'refund_deposit' | 'ban_user';
    }) =>
      apiRequest(`/admin/disputes/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({
          outcome,
          adminNotes: `Admin resolved dispute with ${outcome}`,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: () => {
      const parsedValue: unknown = JSON.parse(configValueJson);
      return apiRequest('/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ key: configKey, value: parsedValue }),
      });
    },
    onSuccess: () => {
      setFeedback(`Updated runtime config key "${configKey}" and logged to AuditLog.`);
      void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
  });

  const kpis = overviewQuery.data?.kpis;
  const dealerList =
    usersDealersQuery.data?.dealerApplications ??
    usersDealersQuery.data?.dealerProfiles ??
    [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust, Safety &amp; Operations Center
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Admin &amp; Moderation Console
          </h1>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3">
        {(
          [
            { id: 'overview', label: 'Overview KPIs', icon: TrendingUp },
            { id: 'moderation', label: 'Flagged Listings', icon: ShieldAlert },
            { id: 'dealers', label: 'Users & Dealer CAC', icon: Users },
            { id: 'documents', label: 'Customs Queue', icon: FileCheck },
            { id: 'auctions', label: 'Auction Audit & Shill Check', icon: Gavel },
            { id: 'disputes', label: 'Disputes', icon: Scale },
            { id: 'config', label: 'Platform Config & Audit Log', icon: Settings },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-elevated text-ink-secondary hover:text-ink'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {overviewQuery.isError && (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/10 p-4 text-xs text-ink">
          Sign in with an Admin or Moderator account (e.g. phone <span className="font-mono">08031000010</span> on <span className="font-mono">/auth</span>) to perform live moderation actions.
        </Card>
      )}

      {/* TAB 1: OVERVIEW KPIs */}
      {activeTab === 'overview' && kpis && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs font-medium text-ink-secondary">Settled Auction GMV</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-ink">
              {formatKobo(kpis.auctionGmvKobo ?? kpis.gmvKobo ?? 0)}
            </p>
            <p className="mt-1 text-xs text-ink-secondary">
              {kpis.liveAuctions ?? kpis.liveAuctionsCount ?? 0} live auctions active
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-ink-secondary">
              Platform Revenue (Fees &amp; Promos)
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-brand-600">
              {formatKobo(kpis.totalPlatformRevenueKobo ?? kpis.platformRevenueKobo ?? 0)}
            </p>
            <p className="mt-1 text-xs text-ink-secondary">All values stored in integer kobo</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-ink-secondary">Active Marketplace</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-ink">
              {kpis.activeListings ?? kpis.activeListingsCount ?? 0} listings /{' '}
              {kpis.liveAuctions ?? kpis.liveAuctionsCount ?? 0} auctions
            </p>
            <p className="mt-1 text-xs text-ink-secondary">
              {kpis.totalUsers ?? kpis.usersCount ?? 0} registered users
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium text-ink-secondary">Action Queues</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge
                variant={
                  (kpis.flaggedListings ?? kpis.flaggedListingsCount ?? 0) > 0
                    ? 'urgent'
                    : 'neutral'
                }
              >
                {kpis.flaggedListings ?? kpis.flaggedListingsCount ?? 0} Flagged
              </Badge>
              <Badge
                variant={
                  (kpis.pendingDealers ?? kpis.pendingDealersCount ?? 0) > 0
                    ? 'reserve_not_met'
                    : 'neutral'
                }
              >
                {kpis.pendingDealers ?? kpis.pendingDealersCount ?? 0} CAC Pending
              </Badge>
              <Badge
                variant={
                  (kpis.pendingDocuments ?? kpis.pendingDocsCount ?? 0) > 0
                    ? 'reserve_not_met'
                    : 'neutral'
                }
              >
                {kpis.pendingDocuments ?? kpis.pendingDocsCount ?? 0} Customs Docs
              </Badge>
              <Badge
                variant={
                  (kpis.openDisputes ?? kpis.openDisputesCount ?? 0) > 0 ? 'live' : 'neutral'
                }
              >
                {kpis.openDisputes ?? kpis.openDisputesCount ?? 0} Disputes
              </Badge>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: FLAGGED LISTINGS MODERATION */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          {(moderationQuery.data?.listings ?? []).length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6" />}
              title="Moderation queue is clear"
              description="No flagged or pending-review listings require human moderation right now."
            />
          ) : (
            (moderationQuery.data?.listings ?? []).map((item) => (
              <Card
                key={item._id}
                className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-ink">{item.title}</span>
                    <Badge variant="reserve_not_met">{item.status}</Badge>
                    {(item.moderationFlags ?? []).map((flag) => (
                      <Badge key={flag} variant="live">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-brand-600">
                    {formatKobo(item.priceKobo)} • {item.state} • Reports:{' '}
                    {item.reportsCount ?? item.reportCount ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    onClick={() =>
                      moderateListingMutation.mutate({ id: item._id, decision: 'approve' })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    leftIcon={<XCircle className="h-4 w-4" />}
                    onClick={() =>
                      moderateListingMutation.mutate({ id: item._id, decision: 'reject' })
                    }
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 3: USERS & DEALER CAC REVIEW */}
      {activeTab === 'dealers' && (
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-base font-bold text-ink">Dealer CAC Verification Queue</h2>
            <div className="space-y-3">
              {dealerList.map((dealer) => {
                const status = dealer.status ?? dealer.cacStatus ?? 'pending';
                return (
                  <Card
                    key={dealer._id}
                    className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{dealer.businessName}</span>
                        <Badge
                          variant={
                            status === 'approved'
                              ? 'dealer_verified'
                              : status === 'rejected'
                                ? 'live'
                                : 'reserve_not_met'
                          }
                        >
                          CAC: {status.toUpperCase()}
                        </Badge>
                        <Badge variant="neutral">{(dealer.planTier || 'pro').toUpperCase()}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-secondary">
                        CAC Number: <span className="font-mono">{dealer.cacNumber}</span> •{' '}
                        {dealer.state}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          reviewDealerMutation.mutate({ id: dealer._id, status: 'approved' })
                        }
                      >
                        Approve CAC
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          reviewDealerMutation.mutate({ id: dealer._id, status: 'rejected' })
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-base font-bold text-ink">
              Registered Users ({usersDealersQuery.data?.users.length ?? 0})
            </h2>
            <div className="space-y-2">
              {(usersDealersQuery.data?.users ?? []).slice(0, 12).map((u) => {
                const strikes = u.strikes ?? u.strikeCount ?? 0;
                return (
                  <Card
                    key={u._id}
                    className="flex flex-col justify-between gap-2 p-3.5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <span className="font-semibold text-ink">{u.displayName}</span>{' '}
                      <span className="font-mono text-xs text-ink-secondary">({u.phone})</span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(u.roles ?? []).map((r) => (
                          <Badge key={r} variant="neutral">
                            {r}
                          </Badge>
                        ))}
                        {strikes > 0 && <Badge variant="live">Strikes: {strikes}</Badge>}
                        {u.bannedUntil && <Badge variant="live">Banned</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          banUserMutation.mutate({
                            id: u._id,
                            banned: !u.bannedUntil,
                          })
                        }
                      >
                        {u.bannedUntil ? 'Unban User' : 'Ban 30 Days'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOMS DOCUMENTS QUEUE */}
      {activeTab === 'documents' && (
        <div className="space-y-3">
          {(docsQuery.data?.documents ?? []).length === 0 ? (
            <EmptyState
              icon={<FileCheck className="h-6 w-6" />}
              title="No pending customs documents"
              description="All uploaded customs duty papers have been reviewed."
            />
          ) : (
            (docsQuery.data?.documents ?? []).map((doc) => (
              <Card
                key={doc._id}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="customs_reviewed">
                      {(doc.docType ?? doc.type ?? 'CUSTOMS').toUpperCase()}
                    </Badge>
                    <span className="font-mono text-xs text-ink-secondary">
                      Ref: {doc.referenceNumber || 'N/A'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-secondary">
                    File:{' '}
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 underline"
                    >
                      Inspect Document
                    </a>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      reviewDocMutation.mutate({ docId: doc._id, status: 'approved' })
                    }
                  >
                    Approve Customs Paper
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      reviewDocMutation.mutate({ docId: doc._id, status: 'rejected' })
                    }
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 5: AUCTION FULL AUDIT LOG & ANTI-SHILL SIGNALS */}
      {activeTab === 'auctions' && (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-base font-bold text-ink">
              Inspect Auction Proxy Bids &amp; Anti-Shill Signals
            </h2>
            <p className="mt-1 text-xs text-ink-secondary">
              Admin-only view revealing sealed proxy maximums (`submittedMaxKobo`), hidden reserve,
              and cross-bidder IP/device fingerprint overlap alerts.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Paste Auction ID..."
                value={auctionIdInput}
                onChange={(e) => setAuctionIdInput(e.target.value)}
              />
              <Button
                variant="primary"
                onClick={() => setInspectedAuctionId(auctionIdInput.trim())}
              >
                Load Audit Log
              </Button>
            </div>
          </Card>

          {auctionAuditQuery.data && (
            <div className="space-y-4">
              {(auctionAuditQuery.data.shillSignals ?? []).length > 0 && (
                <Card className="border-amber-500/40 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    Anti-Shill Overlap Alerts Detected (
                    {(auctionAuditQuery.data.shillSignals ?? []).length})
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                    {(auctionAuditQuery.data.shillSignals ?? []).map((signal, idx) => (
                      <li key={idx} className="font-mono">
                        {signal}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="p-4">
                <h3 className="mb-3 text-sm font-bold text-ink">
                  Sealed Audit Sequence ({(auctionAuditQuery.data.auditLogs ?? []).length} events)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-ink-secondary">
                        <th className="py-2">Event</th>
                        <th className="py-2">Submitted Proxy Max</th>
                        <th className="py-2">Resulting Price</th>
                        <th className="py-2">IP Hash</th>
                        <th className="py-2">Device FP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono tabular-nums">
                      {(auctionAuditQuery.data.auditLogs ?? []).map((b) => (
                        <tr key={b._id}>
                          <td className="py-2">{b.eventType}</td>
                          <td className="py-2 font-bold text-brand-600">
                            {b.submittedMaxKobo ? formatKobo(b.submittedMaxKobo) : '—'}
                          </td>
                          <td className="py-2">{formatKobo(b.resultingPriceKobo)}</td>
                          <td className="py-2 text-ink-secondary">{b.ipHash ?? '—'}</td>
                          <td className="py-2 text-ink-secondary">
                            {b.deviceFingerprintHash ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: DISPUTES RESOLUTION */}
      {activeTab === 'disputes' && (
        <div className="space-y-3">
          {(disputesQuery.data?.disputes ?? []).length === 0 ? (
            <EmptyState
              icon={<Scale className="h-6 w-6" />}
              title="No auction settlement disputes"
              description="All auction settlements are proceeding smoothly."
            />
          ) : (
            (disputesQuery.data?.disputes ?? []).map((dispute) => (
              <Card
                key={dispute._id}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={dispute.status === 'resolved' ? 'phone_verified' : 'live'}
                    >
                      {dispute.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink">{dispute.reason}</p>
                  {dispute.outcome && (
                    <p className="mt-1 text-xs text-brand-600">
                      Resolution: {dispute.outcome} ({dispute.adminNotes})
                    </p>
                  )}
                </div>
                {dispute.status !== 'resolved' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        resolveDisputeMutation.mutate({
                          id: dispute._id,
                          outcome: 'refund_deposit',
                        })
                      }
                    >
                      Refund Buyer Deposit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        resolveDisputeMutation.mutate({
                          id: dispute._id,
                          outcome: 'forfeit_deposit',
                        })
                      }
                    >
                      Forfeit Deposit
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 7: PLATFORM RUNTIME CONFIG & AUDIT LOG */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-base font-bold text-ink">Update Runtime Platform Config</h2>
            <p className="mt-1 text-xs text-ink-secondary">
              Edit promotion prices, dealer plan tiers, or deposit rules in `ConfigEntry` without
              redeploying.
            </p>
            {feedback && (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-brand-700 dark:text-brand-500">
                {feedback}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <Input
                label="Config Key"
                value={configKey}
                onChange={(e) => setConfigKey(e.target.value)}
              />
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-secondary">
                  JSON Value (Kobo integers for money)
                </label>
                <textarea
                  rows={4}
                  value={configValueJson}
                  onChange={(e) => setConfigValueJson(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink"
                />
              </div>
              <Button
                variant="primary"
                loading={updateConfigMutation.isPending}
                onClick={() => updateConfigMutation.mutate()}
              >
                Save Config Entry
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-base font-bold text-ink">Immutable Admin Audit Log</h2>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {(auditLogsQuery.data?.logs ?? []).map((log) => (
                <div key={log._id} className="rounded-xl border border-line p-3 text-xs">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-brand-600">{log.action}</span>
                    <span className="text-ink-muted">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-ink-secondary">
                    {log.entityType} → {log.entityId}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
