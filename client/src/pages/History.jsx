import { useState, useEffect } from 'react';
import { useMarket } from '../context/MarketContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function History() {
    const { formatCurrency } = useMarket();
    const { user } = useAuth();
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('IPO'); // 'IPO' | 'P2P'
    const [recentlyAdded, setRecentlyAdded] = useState(new Set());

    useEffect(() => {
        loadTrades();
    }, []);

    const loadTrades = async () => {
        try {
            setLoading(true);
            const data = await api.getMyTrades();
            
            // Mark new trades for animation if we already had loaded trades
            if (trades.length > 0) {
                const existingIds = new Set(trades.map(t => t.id));
                const newIds = new Set(data.filter(t => !existingIds.has(t.id)).map(t => t.id));
                if (newIds.size > 0) {
                    setRecentlyAdded(newIds);
                    setTimeout(() => setRecentlyAdded(new Set()), 1500); // Clear animation flag after 1.5s
                }
            }

            setTrades(data);
        } catch (err) {
            console.error('Load trades error:', err);
        } finally {
            setLoading(false);
        }
    };

    const ipoTrades = trades.filter(t => t.type === 'IPO');
    const p2pTrades = trades.filter(t => t.type === 'P2P');
    const displayTrades = activeTab === 'IPO' ? ipoTrades : p2pTrades;

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="skeleton h-12 rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="card flex items-center justify-between">
                <div>
                    <h2 className="font-heading font-semibold text-lg text-text-primary">Trade History</h2>
                    <p className="text-text-secondary text-sm mt-1">{trades.length} trades recorded</p>
                </div>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                <button
                    onClick={() => setActiveTab('IPO')}
                    className={`px-4 py-2.5 text-sm font-heading font-medium transition-colors border-b-2 -mb-[1px] ${activeTab === 'IPO' ? 'text-accent-gold border-accent-gold' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                >
                    Company Purchases
                    <span className="ml-2 text-[10px] bg-white/10 px-1.5 py-0.5 rounded">{ipoTrades.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('P2P')}
                    className={`px-4 py-2.5 text-sm font-heading font-medium transition-colors border-b-2 -mb-[1px] ${activeTab === 'P2P' ? 'text-accent-gold border-accent-gold' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                >
                    P2P Trades
                    <span className="ml-2 text-[10px] bg-white/10 px-1.5 py-0.5 rounded">{p2pTrades.length}</span>
                </button>
            </div>

            {displayTrades.length === 0 ? (
                <div className="card text-center py-16">
                    <div className="text-5xl mb-4">📜</div>
                    <p className="font-heading text-text-secondary text-lg">No trades yet</p>
                    <p className="text-text-secondary text-sm mt-1">Your trading activity will appear here</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Transaction ID</th>
                                <th>Time</th>
                                <th>Direction</th>
                                <th>Buyer</th>
                                <th>{activeTab === 'IPO' ? 'Company' : 'Seller'}</th>
                                <th className="num">Shares</th>
                                <th className="num">Price/Share</th>
                                <th className="num">Total</th>
                                <th>Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayTrades.map((t) => {
                                const isBuyer = t.buyerCompanyId === user.companyId;
                                const isNew = recentlyAdded.has(t.id);
                                return (
                                    <tr key={t.id} className={isNew ? 'animate-slide-in-flash' : ''}>
                                        <td className="font-mono text-xs text-text-secondary">
                                            TXN-{String(t.serialNumber).padStart(6, '0')}
                                        </td>
                                        <td className="text-text-secondary text-xs">
                                            {new Date(t.timestamp).toLocaleString()}
                                        </td>
                                        <td>
                                            <span className={`status-badge text-[10px] ${isBuyer ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                                                {isBuyer ? '↑ BOUGHT' : '↓ SOLD'}
                                            </span>
                                        </td>
                                        <td className="font-heading text-text-primary">{t.buyer?.name || 'Unknown'}</td>
                                        <td className="font-heading text-text-primary">{t.seller?.name || 'Unknown'}</td>
                                        <td className="num">{t.shares?.toLocaleString()}</td>
                                        <td className="num">{formatCurrency(t.pricePerShare)}</td>
                                        <td className={`num font-semibold ${isBuyer ? 'text-accent-red' : 'text-accent-green'}`}>
                                            {isBuyer ? '-' : '+'}{formatCurrency(t.total)}
                                        </td>
                                        <td>
                                            <span className={`status-badge text-[10px] bg-white/5 text-text-secondary`}>
                                                {t.type}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
