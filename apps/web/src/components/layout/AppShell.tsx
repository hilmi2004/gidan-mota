import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  Car,
  ChevronDown,
  Gavel,
  Heart,
  Home,
  LayoutDashboard,
  MessageSquare,
  Moon,
  Palette,
  PlusCircle,
  Scale,
  Search,
  ShieldCheck,
  Store,
  Sun,
  User,
  Wallet,
  Zap,
} from 'lucide-react';
import { BRAND_CONFIG } from '@autodey/shared';
import { useAppStore } from '../../stores/useAppStore';
import { Avatar, BrandLogo, Button } from '../ui';

export const AppShell: React.FC = () => {
  const { user, theme, dataSaver, toggleTheme, toggleDataSaver } = useAppStore();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const primaryNavItems = [
    { to: '/search', label: 'Browse Cars', icon: Car },
    { to: '/auctions', label: 'Live Auctions', icon: Gavel, isLive: true },
    { to: '/dealers', label: 'Dealers', icon: Store },
    { to: '/compare', label: 'Compare', icon: Scale },
  ];

  const workspaceMenuItems = [
    { to: '/wallet', label: 'Deposit Wallet', subtitle: '50x auction bidding power', icon: Wallet },
    {
      to: '/dashboard',
      label: 'Seller Dashboard',
      subtitle: 'Views, leads & ad boosts',
      icon: LayoutDashboard,
    },
    { to: '/favorites', label: 'Saved Watchlist', subtitle: 'Cars & auctions you follow', icon: Heart },
    { to: '/profile', label: 'Account & KYC', subtitle: 'Phone, NIN/BVN & NDPA settings', icon: User },
    { to: '/admin', label: 'Admin Console', subtitle: 'Moderation, CAC & shill audit', icon: ShieldCheck },
    { to: '/_design', label: 'Design System', subtitle: '14 UI primitives & tokens', icon: Palette },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink pb-20 md:pb-0">
      {/* Slim Top Utility & Trust Bar */}
      <div className="bg-surface border-b border-line text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-ink-secondary truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
            <span className="truncate">
              17-digit VIN verified &amp; customs papers reviewed. Never pay before inspecting the vehicle.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleDataSaver}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border whitespace-nowrap ${
                dataSaver
                  ? 'bg-brand-600/15 text-brand-600 border-brand-500/30'
                  : 'bg-elevated text-ink-secondary border-line hover:text-ink'
              }`}
              title="Reduces image payload size for 3G/4G networks"
            >
              <Zap className="w-3 h-3" />
              <span>Data Saver: {dataSaver ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          {/* Left: Brand Logo + 4 Primary Marketplace Links */}
          <div className="flex items-center gap-6 lg:gap-8 min-w-0">
            <Link to="/" className="shrink-0 group" aria-label={BRAND_CONFIG.name}>
              <BrandLogo size="md" showText showTagline />
            </Link>

            <nav className="hidden lg:flex items-center gap-1.5" aria-label="Main navigation">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.to ||
                  (item.to !== '/' && location.pathname.startsWith(item.to));

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`h-10 px-3.5 rounded-control text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-brand-600/10 text-brand-700 dark:text-brand-500 font-semibold'
                        : 'text-ink-secondary hover:text-ink hover:bg-elevated/70'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                    {item.isLive && (
                      <span
                        className="w-2 h-2 rounded-full bg-signal-danger animate-pulse"
                        title="Live timed auctions active"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Action Icons + Sell Car CTA + Account/Tools Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/sell"
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-control bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Sell a Car</span>
            </Link>

            <Link
              to="/chat"
              title="Messages & Offers"
              aria-label="Messages & Offers"
              className={`w-10 h-10 inline-flex items-center justify-center rounded-control border transition-colors ${
                location.pathname.startsWith('/chat')
                  ? 'border-brand-500 bg-brand-600/10 text-brand-600'
                  : 'border-line bg-surface hover:bg-elevated text-ink-secondary hover:text-ink'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
            </Link>

            <Link
              to="/notifications"
              title="Notifications & Bid Alerts"
              aria-label="Notifications & Bid Alerts"
              className={`w-10 h-10 inline-flex items-center justify-center rounded-control border transition-colors ${
                location.pathname.startsWith('/notifications')
                  ? 'border-brand-500 bg-brand-600/10 text-brand-600'
                  : 'border-line bg-surface hover:bg-elevated text-ink-secondary hover:text-ink'
              }`}
            >
              <Bell className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className="w-10 h-10 inline-flex items-center justify-center rounded-control border border-line bg-surface hover:bg-elevated text-ink-secondary hover:text-ink transition-colors"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Account & Workspace Dropdown Menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                className="h-10 pl-2 pr-3 rounded-full border border-line bg-surface hover:bg-elevated inline-flex items-center gap-2 transition-colors"
              >
                {user ? (
                  <>
                    <Avatar
                      name={user.displayName}
                      src={user.avatarUrl}
                      size="sm"
                      verified={user.verification.idVerified || user.verification.phoneVerified}
                    />
                    <span className="hidden xl:inline-block text-xs font-semibold text-ink max-w-[100px] truncate">
                      {user.displayName}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-full bg-elevated text-ink-secondary flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-ink whitespace-nowrap">
                      Menu
                    </span>
                  </>
                )}
                <ChevronDown
                  className={`w-3.5 h-3.5 text-ink-muted transition-transform ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-card bg-surface border border-line shadow-cardHover py-2 z-50">
                  {user ? (
                    <div className="px-4 py-2.5 border-b border-line">
                      <p className="text-xs font-bold text-ink truncate">{user.displayName}</p>
                      <p className="text-[11px] text-brand-600 font-medium">
                        {user.verification.dealerVerified
                          ? 'Verified Dealer Account'
                          : user.verification.idVerified
                            ? 'ID Verified Bidder & Seller'
                            : 'Phone Verified Member'}
                      </p>
                    </div>
                  ) : (
                    <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-ink">Welcome to {BRAND_CONFIG.name}</p>
                        <p className="text-[11px] text-ink-secondary">Sign in via Nigerian Phone OTP</p>
                      </div>
                      <Link to="/auth">
                        <Button variant="primary" size="sm">
                          Sign In
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Tablet/Mobile Primary Links inside dropdown when < lg */}
                  <div className="lg:hidden py-1.5 border-b border-line">
                    {primaryNavItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-ink hover:bg-elevated"
                        >
                          <Icon className="w-4 h-4 text-brand-600" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Workspace & Platform Tools */}
                  <div className="py-1.5">
                    {workspaceMenuItems.map((item) => {
                      const Icon = item.icon;
                      const active = location.pathname.startsWith(item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={`flex items-start gap-3 px-4 py-2 transition-colors ${
                            active ? 'bg-brand-600/10' : 'hover:bg-elevated'
                          }`}
                        >
                          <Icon className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink">{item.label}</p>
                            <p className="text-[11px] text-ink-secondary truncate">
                              {item.subtitle}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {!user && (
              <Link to="/auth" className="hidden md:inline-flex">
                <Button variant="primary" size="sm">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-line mt-16">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <BrandLogo size="sm" showText showTagline={false} />
              <p className="text-xs text-ink-secondary leading-relaxed">
                Nigeria’s trusted marketplace for verified Tokunbo &amp; Nigerian-used cars, plus live
                timed auctions backed by refundable bidding deposits.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink mb-3">
                Popular Markets
              </h4>
              <ul className="space-y-2 text-xs text-ink-secondary">
                <li>Lagos — Lekki, Ikeja &amp; Berger Auto Mart</li>
                <li>Abuja — Maitama, Wuse &amp; Gwarinpa</li>
                <li>Port Harcourt — GRA &amp; Aba Road</li>
                <li>Ibadan, Kano &amp; Enugu Lots</li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink mb-3">
                Trust &amp; Safety
              </h4>
              <ul className="space-y-2 text-xs text-ink-secondary">
                <li>17-Digit ISO VIN Verification</li>
                <li>Customs Duty Papers Review</li>
                <li>Refundable Bidding Deposits</li>
                <li>NDPA 2023 Data Privacy Protection</li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink mb-3">
                Developer &amp; QA Links
              </h4>
              <ul className="space-y-2 text-xs text-ink-secondary">
                <li>
                  <Link to="/_design" className="text-brand-600 hover:underline font-medium">
                    /_design — Living Design System
                  </Link>
                </li>
                <li>
                  <Link to="/admin" className="hover:underline font-medium">
                    /admin — Moderation &amp; Anti-Shill Console
                  </Link>
                </li>
                <li>
                  <a
                    href="http://localhost:4000/api/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    /api/docs — OpenAPI Swagger UI
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted">
            <p>© {new Date().getFullYear()} {BRAND_CONFIG.name} Nigeria. All prices in NGN (₦).</p>
            <p>Compliant with the Nigeria Data Protection Act (NDPA) 2023.</p>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-line px-2 py-1 flex items-center justify-around"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `min-w-[56px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-control text-[11px] font-medium ${
              isActive ? 'text-brand-600' : 'text-ink-secondary'
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            `min-w-[56px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-control text-[11px] font-medium ${
              isActive ? 'text-brand-600' : 'text-ink-secondary'
            }`
          }
        >
          <Search className="w-5 h-5" />
          <span>Browse</span>
        </NavLink>

        <NavLink
          to="/sell"
          className="min-w-[64px] min-h-[44px] -mt-4 flex flex-col items-center justify-center"
        >
          <div className="w-11 h-11 rounded-full bg-brand-600 text-white shadow-md flex items-center justify-center">
            <PlusCircle className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold text-ink mt-0.5">Sell</span>
        </NavLink>

        <NavLink
          to="/auctions"
          className={({ isActive }) =>
            `min-w-[56px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-control text-[11px] font-medium ${
              isActive ? 'text-brand-600' : 'text-ink-secondary'
            }`
          }
        >
          <Gavel className="w-5 h-5" />
          <span>Auctions</span>
        </NavLink>

        <NavLink
          to={user ? '/profile' : '/auth'}
          className={({ isActive }) =>
            `min-w-[56px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-control text-[11px] font-medium ${
              isActive ? 'text-brand-600' : 'text-ink-secondary'
            }`
          }
        >
          <User className="w-5 h-5" />
          <span>{user ? 'Profile' : 'Sign In'}</span>
        </NavLink>
      </nav>
    </div>
  );
};
