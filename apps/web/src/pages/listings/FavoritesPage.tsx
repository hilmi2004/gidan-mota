import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { EmptyState, Skeleton } from '../../components/ui';
import { ListingCard, type ListingSummaryItem } from '../../components/listings/ListingCards';
import { apiRequest } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

export const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const [items, setItems] = useState<ListingSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setLoading(true);
    apiRequest<{ items: ListingSummaryItem[] }>('/favorites')
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-ink">Saved Cars & Watchlist</h1>
        <p className="text-sm text-ink-secondary mt-1">
          Vehicles and auctions you have saved for comparison or inspection.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="aspect-[4/3] w-full rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart className="w-6 h-6" />}
          title="Your watchlist is empty"
          description="Tap the heart icon on any car listing or live auction to save it here."
          actionLabel="Explore Verified Cars"
          onAction={() => navigate('/search')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((item) => (
            <ListingCard
              key={item.id}
              item={item}
              onFavoriteToggled={(id, fav) => {
                if (!fav) {
                  setItems((prev) => prev.filter((i) => i.id !== id));
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

