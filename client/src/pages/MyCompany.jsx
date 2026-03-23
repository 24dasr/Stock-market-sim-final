import { Link } from 'react-router-dom';
import { useMarket } from '../context/MarketContext';

export default function MyCompany() {
    const { myCompany, formatCurrency } = useMarket();

    if (!myCompany) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-lg" />)}
            </div>
        );
    }

    const sharesSold = myCompany.totalShares - myCompany.sharesAvailable;
    const portfolioValue = myCompany.holdings?.reduce((sum, h) => sum + (h.shares * h.targetCompany.sharePrice), 0) || 0;
    const netWorth = myCompany.cashBalance + portfolioValue + (myCompany.totalShares * myCompany.sharePrice);

    const stats = [
        { label: 'Total Valuation', value: formatCurrency(myCompany.totalValuation), color: 'text-text-primary' },
        { label: 'Stock Price', value: formatCurrency(myCompany.sharePrice), color: 'text-accent-green' },
        { label: 'Cash Balance', value: formatCurrency(myCompany.cashBalance), color: 'text-accent-blue' },
        { label: 'Portfolio Value', value: formatCurrency(portfolioValue), color: 'text-accent-gold' },
        { label: 'Net Worth', value: formatCurrency(netWorth), color: 'text-accent-green' },
        { label: 'Shares Sold', value: `${sharesSold.toLocaleString()} / ${myCompany.totalShares.toLocaleString()}`, color: 'text-text-primary' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Company Header */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="font-heading font-bold text-xl text-text-primary">{myCompany.name}</h2>
                        <p className="text-text-secondary text-sm mt-1">Stock {myCompany.stockEnabled ? 'enabled' : 'disabled'} • {myCompany.stockPercent}% available as stock</p>
                    </div>
                    <span className={`status-badge ${myCompany.stockEnabled ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                        {myCompany.stockEnabled ? 'Trading Active' : 'Trading Halted'}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="card">
                        <p className="text-text-secondary text-xs font-heading uppercase tracking-wider mb-1">{stat.label}</p>
                        <p className={`font-mono font-bold text-lg ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>



            {/* Holdings Preview */}
            {myCompany.holdings && myCompany.holdings.length > 0 && (
                <div className="card">
                    <h3 className="font-heading font-semibold text-text-primary mb-3">My Holdings</h3>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Company</th>
                                    <th className="num">Shares</th>
                                    <th className="num">Current Price</th>
                                    <th className="num">Avg Buy Price</th>
                                    <th className="num">Market Value</th>
                                    <th className="num">P/L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myCompany.holdings.map(h => {
                                    const currentValue = h.shares * h.targetCompany.sharePrice;
                                    const costBasis = h.shares * h.avgBuyPrice;
                                    const pnl = currentValue - costBasis;
                                    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
                                    return (
                                        <tr key={h.id}>
                                            <td>
                                                <Link to={`/company/${h.targetCompanyId}`} className="font-heading font-medium text-accent-blue hover:text-accent-blue/80 hover:underline transition-colors">
                                                    {h.targetCompany.name}
                                                </Link>
                                            </td>
                                            <td className="num">{h.shares.toLocaleString()}</td>
                                            <td className="num">{formatCurrency(h.targetCompany.sharePrice)}</td>
                                            <td className="num">{formatCurrency(h.avgBuyPrice)}</td>
                                            <td className="num">{formatCurrency(currentValue)}</td>
                                            <td className={`num font-semibold ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                                                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnlPercent.toFixed(2)}%)
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
