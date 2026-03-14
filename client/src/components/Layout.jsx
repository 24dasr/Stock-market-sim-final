import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useMarket } from '../context/MarketContext';

const ADMIN_NAV = [
    { path: '/admin', label: 'Dashboard', icon: '◆' },
    { path: '/market', label: 'Market', icon: '◈' },
    { path: '/leaderboard', label: 'Leaderboard', icon: '◇' },
];

const STATS_NAV = [
    { path: '/stats-dashboard', label: 'Mission Control', icon: '🚀' },
    { path: '/market', label: 'Market', icon: '◈' },
    { path: '/leaderboard', label: 'Leaderboard', icon: '◇' },
];

const PARTICIPANT_NAV = [
    { path: '/dashboard', label: 'My Company', icon: '◆' },
    { path: '/market', label: 'Market', icon: '◈' },
    { path: '/portfolio', label: 'Portfolio', icon: '▣' },
    { path: '/history', label: 'History', icon: '▤' },
    { path: '/leaderboard', label: 'Leaderboard', icon: '◇' },
];

export default function Layout() {
    const { user, logout, isAdmin } = useAuth();
    const { connected } = useSocket();
    const { marketOpen, formatCurrency, eventBanner, dismissEventBanner, feed } = useMarket();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [clock, setClock] = useState(new Date());
    const [leaderboardCollapsed, setLeaderboardCollapsed] = useState(false);

    const navItems = user?.role === 'ADMIN' ? ADMIN_NAV : (user?.role === 'STATS' ? STATS_NAV : PARTICIPANT_NAV);
    const accentColor = ['ADMIN', 'STATS'].includes(user?.role) ? 'accent-gold' : 'accent-blue';

    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const pageTitles = {
        '/admin': 'Admin Dashboard',
        '/dashboard': 'My Company',
        '/market': 'Market',
        '/portfolio': 'Portfolio',
        '/history': 'Trade History',
        '/leaderboard': 'Leaderboard',
        '/stats-dashboard': 'Stats Mission Control',
    };

    return (
        <div className="h-screen flex overflow-hidden bg-base">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[220px] bg-surface border-r border-border flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                {/* Logo */}
                <div className="h-14 flex items-center px-5 border-b border-border">
                    <span className="font-heading font-bold text-lg tracking-tight">
                        <span className={`text-${accentColor}`}>STX</span>
                        <span className="text-text-primary">SIM</span>
                    </span>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 py-4 px-3 space-y-1">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-heading font-medium transition-colors relative ${isActive
                                    ? `text-${accentColor} bg-${accentColor}/10`
                                    : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-${accentColor} rounded-r`} />
                                    )}
                                    <span className="text-xs">{item.icon}</span>
                                    {item.label}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Market Status & User Info */}
                <div className="p-4 border-t border-border space-y-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-accent-green animate-pulse-dot' : 'bg-accent-red'}`} />
                        <span className="font-mono text-xs font-semibold uppercase">
                            Market {marketOpen ? 'Open' : 'Closed'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-green' : 'bg-accent-red'}`} />
                        <span className="font-mono text-xs text-text-secondary">
                            {connected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>

                    <div className="pt-2 border-t border-border">
                        <div className="text-xs text-text-secondary font-mono truncate">{user?.username}</div>
                        <button onClick={logout} className="text-xs text-accent-red hover:underline mt-1 font-heading">
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Bar */}
                <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        {/* Mobile hamburger */}
                        <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-text-secondary hover:text-text-primary">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        </button>

                        <div>
                            <h1 className="font-heading font-semibold text-base text-text-primary">
                                {pageTitles[location.pathname] || 'STXSIM'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Market Status Badge */}
                        <div className={`status-badge ${marketOpen ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-accent-green animate-pulse-dot' : 'bg-accent-red'}`} />
                            {marketOpen ? 'OPEN' : 'CLOSED'}
                        </div>

                        {/* Admin Badge */}
                        {['ADMIN', 'STATS'].includes(user?.role) && (
                            <span className="status-badge bg-accent-gold/10 text-accent-gold">
                                {user.role === 'ADMIN' ? 'ADMIN' : 'STATS'}
                            </span>
                        )}

                        {/* Clock */}
                        <span className="font-mono text-xs text-text-secondary hidden sm:block">
                            {clock.toLocaleTimeString()}
                        </span>
                    </div>
                </header>

                {/* Event Banner */}
                {eventBanner && (
                    <div className="event-banner event-banner-active flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-accent-gold text-lg">⚡</span>
                            <div>
                                <span className="font-heading font-semibold text-sm text-accent-gold">{eventBanner.name}</span>
                                <span className="text-text-secondary text-xs ml-3">{eventBanner.description}</span>
                            </div>
                        </div>
                        <button onClick={dismissEventBanner} className="text-text-secondary hover:text-text-primary text-lg">×</button>
                    </div>
                )}

                {/* Content + Leaderboard Right Panel */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Main Content */}
                    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                        <div className="max-w-[1400px] mx-auto">
                            <Outlet />
                        </div>
                    </main>

                    {/* Right Live Feed Panel (Desktop) */}
                    <aside className={`hidden xl:flex flex-col border-l border-border bg-surface transition-all duration-200 ${leaderboardCollapsed ? 'w-10' : 'w-[280px]'}`}>
                        <button
                            onClick={() => setLeaderboardCollapsed(!leaderboardCollapsed)}
                            className="h-14 flex items-center justify-center border-b border-border text-text-secondary hover:text-text-primary text-xs"
                        >
                            {leaderboardCollapsed ? '◀' : '▶'}
                        </button>

                        {!leaderboardCollapsed && (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="p-3 border-b border-border bg-surface shrink-0">
                                    <h3 className="font-heading text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                        📻 Live Feed
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                                    {feed.map((item) => {
                                        if (item.type === 'EVENT_FIRED') {
                                            return (
                                                <div key={item.id} className="p-3 rounded bg-white/[0.03] border border-border">
                                                    <h4 className="text-xs font-bold text-accent-gold uppercase tracking-wider mb-1">
                                                        {item.data.name}
                                                    </h4>
                                                    <p className="text-sm text-text-primary leading-relaxed">
                                                        {item.data.description}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}
                                    {feed.length === 0 && (
                                        <p className="text-text-secondary text-xs py-4 text-center">No recent activity</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
}
