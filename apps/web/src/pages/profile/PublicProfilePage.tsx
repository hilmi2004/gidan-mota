import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, MapPin, MessageSquare, Star } from 'lucide-react';
import type { PublicUserProfileDTO } from '@autodey/shared';
import { Avatar, Badge, Card, EmptyState, Skeleton } from '../../components/ui';
import { apiRequest } from '../../lib/api';

export const PublicProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicUserProfileDTO | null>(null);
  const [reviews, setReviews] = useState<
    Array<{
      id: string;
      rating: number;
      comment: string;
      interactionType: string;
      createdAt: string;
      reviewer: { displayName: string };
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiRequest<{ profile: PublicUserProfileDTO; reviews: typeof reviews }>(`/users/${id}/profile`)
      .then((res) => {
        setProfile(res.profile);
        setReviews(res.reviews);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <EmptyState
          icon={<MessageSquare className="w-6 h-6" />}
          title="Seller profile not found"
          description="This account may have been removed or the URL is incorrect."
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar
              name={profile.displayName}
              src={profile.avatarUrl}
              size="lg"
              verified={profile.badges.idVerified || profile.badges.phoneVerified}
            />
            <div>
              <h1 className="text-2xl font-bold text-ink">{profile.displayName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {profile.badges.phoneVerified && <Badge variant="phone_verified" />}
                {profile.badges.idVerified && <Badge variant="id_verified" />}
                {profile.badges.dealerVerified && <Badge variant="dealer_verified" />}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-control bg-elevated border border-line text-right">
            <span className="text-xs text-ink-secondary block">Masked Contact</span>
            <span className="font-mono tabular-nums text-sm font-semibold text-ink">
              {profile.phoneMasked}
            </span>
          </div>
        </div>

        {profile.bio && <p className="text-sm text-ink-secondary pt-2">{profile.bio}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-line text-xs">
          <div className="p-3 rounded-control bg-elevated">
            <span className="text-ink-muted flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Location
            </span>
            <p className="font-semibold text-ink mt-1">
              {profile.lga || 'Lekki'}, {profile.state || 'Lagos'}
            </p>
          </div>
          <div className="p-3 rounded-control bg-elevated">
            <span className="text-ink-muted flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Response Time
            </span>
            <p className="font-semibold text-ink tabular-nums mt-1">
              {profile.responseRatePercent}% (~{profile.avgResponseMinutes}m)
            </p>
          </div>
          <div className="p-3 rounded-control bg-elevated">
            <span className="text-ink-muted flex items-center gap-1">
              <Star className="w-3.5 h-3.5" /> Rating
            </span>
            <p className="font-semibold text-ink tabular-nums mt-1">
              {profile.ratingAvg.toFixed(1)} ({profile.reviewCount} reviews)
            </p>
          </div>
          <div className="p-3 rounded-control bg-elevated">
            <span className="text-ink-muted flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Member Since
            </span>
            <p className="font-semibold text-ink tabular-nums mt-1">
              {new Date(profile.memberSince).toLocaleDateString('en-NG', {
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Verified Buyer & Bidder Reviews</h2>
        {reviews.length === 0 ? (
          <EmptyState
            icon={<Star className="w-6 h-6" />}
            title="No reviews yet"
            description="Only buyers who have chatted with this seller or completed an auction settlement can leave a verified review."
          />
        ) : (
          <div className="space-y-3">
            {reviews.map((rev) => (
              <Card key={rev.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">
                    {rev.reviewer.displayName}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-brand-600 font-semibold">
                    {rev.rating} / 5.0
                  </span>
                </div>
                <p className="text-sm text-ink-secondary">{rev.comment}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

