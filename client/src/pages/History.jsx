import { useState, useEffect } from 'react';
import { useMarket } from '../context/MarketContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function History() {
    const { formatCurrency } = useMarket();
    const { user } = useAuth();
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTrades();
    }, []);

    const loadTrades = async () => {
        try {
            setLoading(true);
            const data = await api.getMyTrades();
            setTrades(data);
        } catch (err) {
            console.error('Load trades error:', err);
        } finally {
            setLoading(false);
        }
    };

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

            {trades.length === 0 ? (
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
                                <th>Time</th>
                                <th>Direction</th>
                                <th>Counterparty</th>
                                <th className="num">Shares</th>
                                <th className="num">Price/Share</th>
                                <th className="num">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map((t, i) => {
                                const isBuyer = t.buyerCompanyId === user.companyId;
                                const counterparty = isBuyer ? (t.seller?.name || 'Unknown') : (t.buyer?.name || 'Unknown');
                                return (
                                    <tr key={t.id || i}>
                                        <td className="text-text-secondary text-xs">
                                            {new Date(t.timestamp).toLocaleString()}
                                        </td>
                                        <td>
                                            <span className={`status-badge text-[10px] ${isBuyer ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                                                {isBuyer ? '↑ Bought' : '↓ Sold'}
                                            </span>
                                        </td>
                                        <td className="font-heading text-text-primary">{counterparty}</td>
                                        <td className="num">{t.shares?.toLocaleString()}</td>
                                        <td className="num">{formatCurrency(t.pricePerShare)}</td>
                                        <td className={`num font-semibold ${isBuyer ? 'text-accent-red' : 'text-accent-green'}`}>
                                            {isBuyer ? '-' : '+'}{formatCurrency(t.total)}
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
