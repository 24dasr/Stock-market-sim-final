import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMarket } from '../context/MarketContext';
import { api } from '../api';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

export default function CompanyDetail() {
    const { id } = useParams();
    const { formatCurrency, socket, companies } = useMarket();
    
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const company = companies.find(c => c.id === parseInt(id));

    useEffect(() => {
        if (!company) return;

        const loadHistory = async () => {
            try {
                setLoading(true);
                const data = await api.getCompanyPriceHistory(company.id);
                setHistory(data);
            } catch (err) {
                console.error('Load company history error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadHistory();

        // Subscribe to real-time price updates for this specific company
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
                    <p className="text-xl font-mono font-medium">{formatCurrency(company.totalValuation)}</p>
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
        </div>
    );
}
