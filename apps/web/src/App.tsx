import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/home/HomePage';
import { SearchPage } from './pages/search/SearchPage';
import { ListingDetailPage } from './pages/listings/ListingDetailPage';
import { CreateListingWizardPage } from './pages/listings/CreateListingWizardPage';
import { FavoritesPage } from './pages/listings/FavoritesPage';
import { ComparePage } from './pages/listings/ComparePage';
import { ChatPage } from './pages/chat/ChatPage';
import { SellerDashboardPage } from './pages/dashboard/SellerDashboardPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { AuctionsHubPage } from './pages/auctions/AuctionsHubPage';
import { AuctionDetailPage } from './pages/auctions/AuctionDetailPage';
import { WalletPage } from './pages/wallet/WalletPage';
import { AuthPage } from './pages/auth/AuthPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { PublicProfilePage } from './pages/profile/PublicProfilePage';
import { DealerStorefrontPage } from './pages/dealer/DealerStorefrontPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { DesignSystemPage } from './pages/_design/DesignSystemPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/sell" element={<CreateListingWizardPage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/dashboard" element={<SellerDashboardPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/auctions" element={<AuctionsHubPage />} />
              <Route path="/auctions/:id" element={<AuctionDetailPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/cars/:state/:slug" element={<ListingDetailPage />} />
              <Route path="/listings/:slug" element={<ListingDetailPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/users/:id" element={<PublicProfilePage />} />
              <Route path="/dealers" element={<DealerStorefrontPage />} />
              <Route path="/dealer/:slug" element={<DealerStorefrontPage />} />
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/_design" element={<DesignSystemPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
};
