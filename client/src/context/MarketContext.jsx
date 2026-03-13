import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { api } from '../api';

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
    const { socket } = useSocket();
    const { user } = useAuth();

    const [marketOpen, setMarketOpen] = useState(false);
    const [marketConfig, setMarketConfig] = useState({ sellWithdrawCooldownSec: 60 });
    const [companies, setCompanies] = useState([]);
    const [myCompany, setMyCompany] = useState(null);
    const [holdings, setHoldings] = useState([]);
    const [leaderboard, setLeaderboard] = useState({ stockValueRanking: [], liquidityRanking: [] });
    const [recentTrades, setRecentTrades] = useState([]);
    const [activeEvents, setActiveEvents] = useState([]);
    const [events, setEvents] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [priceFlashes, setPriceFlashes] = useState({});
    const [toasts, setToasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [eventBanner, setEventBanner] = useState(null);
    const [feed, setFeed] = useState([]);

    const flashTimeouts = useRef({});

    // Format currency
    const formatCurrency = useCallback((value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    }, []);

    // Add toast
    const addToast = useCallback((message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    // Bootstrap — initial load
    const bootstrap = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await api.bootstrap();
            setMarketOpen(data.market?.isOpen || false);
            setMarketConfig(data.market || { sellWithdrawCooldownSec: 60 });
            setCompanies(data.companies || []);
            setLeaderboard(data.leaderboard || { stockValueRanking: [], liquidityRanking: [] });
            setActiveEvents(data.activeEvents || []);

            if (data.myCompany) setMyCompany(data.myCompany);
            if (data.holdings) setHoldings(data.holdings);
            if (data.recentTrades) setRecentTrades(data.recentTrades);
            if (data.events) setEvents(data.events);
            if (data.participants) setParticipants(data.participants);

            // Fetch initial feed (Announcements + Events)
            try {
                const announcements = await api.getAnnouncements();
                const feedItems = announcements.map(a => {
                    if (a.type === 'FLUCTUATION') {
                        try {
                            const data = JSON.parse(a.message);
                            return {
                                id: `evt-ann-${a.id}`,
                                type: 'EVENT_FIRED',
                                data: { name: data.name, description: data.description },
                                timestamp: new Date(a.createdAt).getTime()
                            };
                        } catch (e) { return null; }
                    }
                    return {
                        id: `ann-${a.id}`,
                        type: 'ANNOUNCEMENT',
                        data: a,
                        timestamp: new Date(a.createdAt).getTime()
                    };
                }).filter(Boolean);

                setFeed(feedItems.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20));
            } catch (err) {
                console.error('Failed to fetch initial feed', err);
            }
        } catch (err) {
            console.error('Bootstrap error:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Bootstrap on mount and reconnect
    useEffect(() => {
        bootstrap();
    }, [bootstrap]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) return;

        const onMarketStatus = ({ isOpen }) => {
            setMarketOpen(isOpen);
            addToast(isOpen ? 'Market is now OPEN' : 'Market is now CLOSED', isOpen ? 'success' : 'error');
        };

        const onPriceUpdate = ({ companyId, newPrice, delta, deltaPercent }) => {
            setCompanies(prev => prev.map(c =>
                c.id === companyId ? { ...c, sharePrice: newPrice } : c
            ));

            // Flash effect
            const direction = delta >= 0 ? 'up' : 'down';
            setPriceFlashes(prev => ({ ...prev, [companyId]: direction }));

            if (flashTimeouts.current[companyId]) {
                clearTimeout(flashTimeouts.current[companyId]);
            }
            flashTimeouts.current[companyId] = setTimeout(() => {
                setPriceFlashes(prev => {
                    const next = { ...prev };
                    delete next[companyId];
                    return next;
                });
            }, 600);

            // Update holdings value if we hold this company
            setHoldings(prev => prev.map(h =>
                h.targetCompanyId === companyId
                    ? { ...h, targetCompany: { ...h.targetCompany, sharePrice: newPrice } }
                    : h
            ));
        };

        const onTradeExecuted = (trade) => {
            setRecentTrades(prev => [trade, ...prev].slice(0, 100));
            addToast(`Trade: ${trade.buyerName} bought ${trade.shares} shares of ${trade.sellerName}`, 'success');
        };

        const onLeaderboardUpdate = (data) => {
            setLeaderboard(data);
        };

        const onPortfolioUpdate = ({ holdings: newHoldings }) => {
            setHoldings(newHoldings);
        };

        const onEventFired = ({ eventId, name, description, affectedCompanyIds }) => {
            setEventBanner({ eventId, name, description });
            setActiveEvents(prev => [...prev, { id: eventId, name, description }]);
        };

        const onEventTick = ({ eventId, currentStep, totalSteps }) => {
            setActiveEvents(prev => prev.map(e =>
                e.id === eventId ? { ...e, currentStep, totalSteps } : e
            ));
            setFeed(prev => [{
                id: `evt-tick-${eventId}-${currentStep}`,
                type: 'EVENT_TICK',
                data: { eventId, currentStep, totalSteps },
                timestamp: Date.now()
            }, ...prev].slice(0, 20));
        };

        const onEventEnded = ({ eventId }) => {
            setActiveEvents(prev => prev.filter(e => e.id !== eventId));
            setEventBanner(prev => prev?.eventId === eventId ? null : prev);
            
            setFeed(prev => [{
                id: `evt-end-${eventId}-${Date.now()}`,
                type: 'EVENT_ENDED',
                data: { eventId },
                timestamp: Date.now()
            }, ...prev].slice(0, 20));
        };

        const onAnnouncementNew = (announcement) => {
            let feedItem = {
                id: `ann-${announcement.id}`,
                type: 'ANNOUNCEMENT',
                data: announcement,
                timestamp: new Date(announcement.createdAt).getTime()
            };

            if (announcement.type === 'FLUCTUATION') {
                try {
                    const data = JSON.parse(announcement.message);
                    feedItem = {
                        id: `evt-ann-${announcement.id}`,
                        type: 'EVENT_FIRED',
                        data: { name: data.name, description: data.description },
                        timestamp: new Date(announcement.createdAt).getTime()
                    };
                } catch (e) { return; }
            }

            setFeed(prev => [feedItem, ...prev].slice(0, 20));
        };

        socket.on('market:status', onMarketStatus);
        socket.on('price:update', onPriceUpdate);
        socket.on('trade:executed', onTradeExecuted);
        socket.on('leaderboard:update', onLeaderboardUpdate);
        socket.on('portfolio:update', onPortfolioUpdate);
        socket.on('event:fired', onEventFired);
        socket.on('event:tick', onEventTick);
        socket.on('event:ended', onEventEnded);
        socket.on('announcement:new', onAnnouncementNew);

        // Re-bootstrap on reconnect
        socket.on('connect', () => {
            bootstrap();
        });

        return () => {
            socket.off('market:status', onMarketStatus);
            socket.off('price:update', onPriceUpdate);
            socket.off('trade:executed', onTradeExecuted);
            socket.off('leaderboard:update', onLeaderboardUpdate);
            socket.off('portfolio:update', onPortfolioUpdate);
            socket.off('event:fired', onEventFired);
            socket.off('event:tick', onEventTick);
            socket.off('event:ended', onEventEnded);
            socket.off('announcement:new', onAnnouncementNew);
        };
    }, [socket, bootstrap, addToast]);

    const dismissEventBanner = useCallback(() => {
        setEventBanner(null);
    }, []);

    const refreshCompanies = useCallback(async () => {
        try {
            const data = await api.getMarketCompanies();
            setCompanies(data);
        } catch (err) {
            console.error('Refresh companies error:', err);
        }
    }, []);

    const refreshMyCompany = useCallback(async () => {
        if (!user || user.role !== 'PARTICIPANT') return;
        try {
            const data = await api.getMyCompany();
            setMyCompany(data);
        } catch (err) {
            console.error('Refresh my company error:', err);
        }
    }, [user]);

    return (
        <MarketContext.Provider value={{
            marketOpen,
            marketConfig,
            companies,
            myCompany,
            holdings,
            leaderboard,
            recentTrades,
            activeEvents,
            events,
            participants,
            priceFlashes,
            toasts,
            loading,
            eventBanner,
            feed,
            formatCurrency,
            addToast,
            dismissEventBanner,
            refreshCompanies,
            refreshMyCompany,
            setCompanies,
            setMyCompany,
            setHoldings,
            setEvents,
            setParticipants,
            setRecentTrades,
            bootstrap,
        }}>
            {children}
        </MarketContext.Provider>
    );
}

export function useMarket() {
    const context = useContext(MarketContext);
    if (!context) throw new Error('useMarket must be used within MarketProvider');
    return context;
}
