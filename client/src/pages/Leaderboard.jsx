import { useMarket } from '../context/MarketContext';

export default function Leaderboard() {
    const { leaderboard, formatCurrency } = useMarket();

    const renderRanking = (title, icon, data, valueColor) => (
        <div className="card flex-1 min-w-[300px]">
            <h3 className="font-heading font-semibold text-text-primary mb-4 flex items-center gap-2">
                <span>{icon}</span> {title}
            </h3>

            {data.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-text-secondary text-sm">No data available</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {data.map((entry, i) => (
                        <div
                            key={entry.companyId}
                            className={`flex items-center justify-between py-3 px-3 rounded-lg transition-all duration-300 ${i === 0 ? 'bg-accent-gold/5 border border-accent-gold/20' :
                                    i === 1 ? 'bg-white/[0.02] border border-transparent' :
                                        i === 2 ? 'bg-white/[0.01] border border-transparent' :
                                            'border border-transparent hover:bg-white/[0.02]'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                {/* Rank Badge */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm ${i === 0 ? 'bg-accent-gold/20 text-accent-gold' :
                                        i === 1 ? 'bg-text-secondary/20 text-text-secondary' :
                                            i === 2 ? 'bg-amber-800/20 text-amber-600' :
                                                'bg-border text-text-secondary'
                                    }`}>
                                    {i + 1}
                                </div>

                                {/* Company Info */}
                                <div>
                                    <span className="font-heading font-medium text-text-primary text-sm">{entry.name}</span>
                                    {i === 0 && <span className="ml-2 text-accent-gold text-xs">👑</span>}
                                </div>
                            </div>

                            {/* Value */}
                            <span className={`font-mono font-bold text-sm ${valueColor}`}>
                                {formatCurrency(entry.value)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="card">
                <h2 className="font-heading font-semibold text-lg text-text-primary">Leaderboard</h2>
                <p className="text-text-secondary text-sm mt-1">Real-time rankings • Updates on every trade and price change</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {renderRanking('Highest Net Stock Value', '📊', leaderboard.stockValueRanking || [], 'text-accent-green')}
                {renderRanking('Highest Liquidity (Cash)', '💰', leaderboard.liquidityRanking || [], 'text-accent-blue')}
            </div>
        </div>
    );
}
