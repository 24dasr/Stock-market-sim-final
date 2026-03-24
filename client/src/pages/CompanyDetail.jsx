import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMarket } from '../context/MarketContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

export default function CompanyDetail() {
    const { id } = useParams();
    const { formatCurrency, socket, companies } = useMarket();
    const { isAdmin } = useAuth();
    
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [auditData, setAuditData] = useState({ holdings: [], trades: [] });

    const company = companies.find(c => c.id === parseInt(id));

    useEffect(() => {
        if (!company) return;

        const loadData = async () => {
            try {
                setLoading(true);
                const historyData = await api.getCompanyPriceHistory(company.id);
                setHistory(historyData);

                if (isAdmin) {
                    const [holdings, trades] = await Promise.all([
                        api.getCompanyPortfolio(company.id),
                        api.getAdminTrades({ companyId: company.id })
                    ]);
                    setAuditData({ holdings, trades });
                }
            } catch (err) {
                console.error('Load data error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();

        if (!socket) return;

        const handlePriceUpdate = (update) => {
            if (update.companyId === company.id) {
                setHistory(prev => {
                    const newPoint = {
                        price: update.newPrice,
                        recordedAt: new Date().toISOString()
                    };
                    
                    // Keep last 100 points
                    const updated = [...prev, newPoint];
                    if (updated.length > 100) updated.shift();
                    return updated;
                });
            }
        };

        socket.on('price:update', handlePriceUpdate);

        return () => {
            socket.off('price:update', handlePriceUpdate);
        };
    }, [company, socket]);

    if (!company) {
        return (
            <div className="card text-center py-16 animate-fade-in">
                <div className="text-4xl mb-4">🏢</div>
                <h2 className="font-heading text-xl text-text-primary mb-2">Company Not Found</h2>
                <Link to="/market" className="btn btn-outline mt-4">Return to Market</Link>
            </div>
        );
    }

    // Format data for Recharts
    const chartData = history.map(h => ({
        time: new Date(h.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price: h.price
    }));

    // Find initial price to draw reference line
    const initialPrice = history.length > 0 ? history[0].price : company.sharePrice;
    
    // Determine overall trend relative to initial price
    const currentPrice = history.length > 0 ? history[history.length - 1].price : company.sharePrice;
    const isUp = currentPrice >= initialPrice;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header / Nav */}
            <div className="flex items-center gap-4">
                <Link to="/market" className="btn btn-outline px-3 py-1 text-xs">
                    ← Back
                </Link>
                <h2 className="font-heading font-semibold text-xl text-text-primary">
                    {company.name} Overview
                </h2>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4">
                    <p className="text-xs font-heading text-text-secondary uppercase tracking-wider mb-1">Current Price</p>
                    <p className={`text-xl font-mono font-semibold ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
                        {formatCurrency(currentPrice)}
                    </p>
                </div>
                <div className="card p-4">
                    <p className="text-xs font-heading text-text-secondary uppercase tracking-wider mb-1">Total Valuation</p>
                    <p className="text-xl font-mono font-medium">{formatCurrency(
                        company.stockPercent > 0
                            ? (company.totalShares * currentPrice) / (company.stockPercent / 100)
                            : company.totalValuation
                    )}</p>
                </div>
                <div className="card p-4">
                    <p className="text-xs font-heading text-text-secondary uppercase tracking-wider mb-1">Shares Available</p>
                    <p className="text-xl font-mono font-medium">
                        {company.sharesAvailable.toLocaleString()} <span className="text-xs text-text-secondary">/ {company.totalShares.toLocaleString()}</span>
                    </p>
                </div>
                <div className="card p-4">
                    <p className="text-xs font-heading text-text-secondary uppercase tracking-wider mb-1">Status</p>
                    <span className={`mt-1 status-badge text-xs ${company.stockEnabled ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                        {company.stockEnabled ? 'Trading Active' : 'Trading Halted'}
                    </span>
                </div>
            </div>

            {/* Price Chart */}
            <div className="card pt-6 pb-2 px-2 md:px-6">
                <h3 className="font-heading font-medium text-text-primary mb-6 px-4">Live Price History</h3>
                
                {loading ? (
                    <div className="h-[350px] flex items-center justify-center">
                        <div className="skeleton w-full h-[300px] rounded-lg opacity-50" />
                    </div>
                ) : error ? (
                    <div className="h-[350px] flex items-center justify-center text-accent-red text-sm font-mono">
                        {error}
                    </div>
                ) : history.length < 2 ? (
                    <div className="h-[350px] flex flex-col items-center justify-center text-text-secondary">
                        <span className="text-4xl mb-3">📈</span>
                        <p className="font-heading">Not enough data</p>
                        <p className="text-sm mt-1">Wait for market events to populate the chart</p>
                    </div>
                ) : (
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 45, 69, 0.4)" vertical={false} />
                                <XAxis 
                                    dataKey="time" 
                                    stroke="#7a8fa6" 
                                    fontSize={10} 
                                    tickMargin={10} 
                                    minTickGap={30}
                                />
                                <YAxis 
                                    domain={['auto', 'auto']} 
                                    stroke="#7a8fa6" 
                                    fontSize={10}
                                    tickFormatter={(val) => `$${val.toLocaleString()}`}
                                    width={60}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(14, 20, 32, 0.9)', 
                                        border: '1px solid #1e2d45',
                                        borderRadius: '6px',
                                        fontFamily: 'IBM Plex Mono, monospace',
                                        fontSize: '12px'
                                    }}
                                    itemStyle={{ color: isUp ? '#00e676' : '#ff1744' }}
                                    formatter={(value) => [`$${value.toLocaleString()}`, 'Price']}
                                    labelStyle={{ color: '#7a8fa6', marginBottom: '4px' }}
                                />
                                <ReferenceLine 
                                    y={initialPrice} 
                                    stroke="rgba(255,255,255,0.2)" 
                                    strokeDasharray="3 3" 
                                    label={{ 
                                        position: 'insideTopLeft', 
                                        value: 'Open', 
                                        fill: 'rgba(255,255,255,0.4)', 
                                        fontSize: 10,
                                        dy: -10
                                    }} 
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="price" 
                                    stroke={isUp ? '#00e676' : '#ff1744'} 
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, strokeWidth: 0 }}
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Admin Audit Section */}
            {isAdmin && auditData && (
                <div className="space-y-6 pt-6 border-t border-border">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🔍</span>
                        <h3 className="font-heading font-bold text-lg text-accent-gold uppercase tracking-wider">Company Audit (Admin Only)</h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Current Portfolio */}
                        <div className="card">
                            <h4 className="font-heading font-semibold text-text-primary mb-4 flex items-center justify-between">
                                Current Portfolio
                                <span className="text-xs text-text-secondary font-mono">
                                    Value: {formatCurrency((auditData?.holdings || []).reduce((sum, h) => sum + ((h?.shares || 0) * (h?.targetCompany?.sharePrice || 0)), 0))}
                                </span>
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="data-table text-xs">
                                    <thead>
                                        <tr>
                                            <th>Target Company</th>
                                            <th className="num">Shares</th>
                                            <th className="num">Market Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(auditData?.holdings || []).map(h => (
                                            <tr key={h.id}>
                                                <td className="font-medium text-accent-blue">{h?.targetCompany?.name || 'Unknown'}</td>
                                                <td className="num font-mono">{(h?.shares || 0).toLocaleString()}</td>
                                                <td className="num font-mono text-accent-green">{formatCurrency((h?.shares || 0) * (h?.targetCompany?.sharePrice || 0))}</td>
                                            </tr>
                                        ))}
                                        {auditData.holdings.length === 0 && (
                                            <tr>
                                                <td colSpan="3" className="text-center py-4 text-text-secondary italic">No holdings</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="card">
                            <h4 className="font-heading font-semibold text-text-primary mb-4">Recent Activity</h4>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                {auditData && auditData.trades ? auditData.trades.map(t => {
                                    const isBuyer = t.buyerCompanyId === company.id;
                                    const buyerName = t.buyer?.name || 'Unknown';
                                    const sellerName = t.seller?.name || 'Unknown';
                                    const totalVal = t.total || 0;
                                    const shares = t.shares || 0;
                                    const price = t.pricePerShare || 0;

                                    return (
                                        <div key={t.id} className="p-3 rounded bg-white/[0.03] border border-border flex items-center justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] px-1.5 rounded font-bold ${isBuyer ? 'bg-accent-blue/20 text-accent-blue' : 'bg-accent-gold/20 text-accent-gold'}`}>
                                                        {isBuyer ? 'BUY' : 'SELL'}
                                                    </span>
                                                    <span className="text-xs font-mono text-text-secondary">
                                                        {new Date(t.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-text-primary">
                                                    {isBuyer 
                                                        ? `Bought ${t.targetCompany?.name || 'shares'} from ${sellerName}` 
                                                        : `Sold ${t.targetCompany?.name || 'shares'} to ${buyerName}`}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold font-mono text-text-primary">{formatCurrency(totalVal)}</p>
                                                <p className="text-[10px] text-text-secondary font-mono">{shares.toLocaleString()} @ {formatCurrency(price)}</p>
                                            </div>
                                        </div>
                                    );
                                }) : null}
                                {auditData.trades.length === 0 && (
                                    <p className="text-center py-4 text-text-secondary text-sm italic">No recent trades</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
