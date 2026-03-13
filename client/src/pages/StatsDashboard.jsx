import React, { useState, useEffect } from 'react';
import { useMarket } from '../context/MarketContext';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { api } from '../api';

const GOLD_ACCENT = '#ffc107';
const DARK_BG = '#080b12';
const PANEL_BG = 'rgba(255, 193, 7, 0.05)';

const COMPANY_COLORS = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', 
  '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', 
  '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', 
  '#ff5722', '#795548', '#9e9e9e', '#607d8b', '#ffffff'
];

const StatsDashboard = () => {
    const { bootstrapData, companies, activeEvents } = useMarket();
    const { socket } = useSocket();
    const { logout } = useAuth();

    const [networthHistory, setNetworthHistory] = useState([]);
    const [liquidityHistory, setLiquidityHistory] = useState([]);
    const [mostTraded, setMostTraded] = useState([]);
    const [recentTrades, setRecentTrades] = useState([]);
    const [sessionSnapshot, setSessionSnapshot] = useState({});
    const [heatmap, setHeatmap] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (bootstrapData?.role === 'STATS') {
            setNetworthHistory(bootstrapData.networthHistory || []);
            setMostTraded(bootstrapData.mostTraded || []);
            setRecentTrades(bootstrapData.recentTrades || []);
            setSessionSnapshot(bootstrapData.sessionSnapshot || {});
            setHeatmap(bootstrapData.heatmap || []);
            setAchievements(bootstrapData.recentAchievements || []);
        }
    }, [bootstrapData]);

    useEffect(() => {
        if (!socket) return;

        socket.on('trade:executed', (trade) => {
            setRecentTrades(prev => [trade, ...prev].slice(0, 15));
            // Trigger refresh of snapshot/traded stats
            refreshStats();
        });

        socket.on('price:update', () => refreshStats());
        socket.on('announcement:new', (ann) => {
            if (ann.type === 'ACHIEVEMENT') setAchievements(prev => [ann, ...prev].slice(0, 10));
        });

        return () => {
            socket.off('trade:executed');
            socket.off('price:update');
            socket.off('announcement:new');
        };
    }, [socket]);

    const refreshStats = async () => {
        try {
            const [hw, snp, mt] = await Promise.all([
                api.get('/stats/heatmap'),
                api.get('/stats/session-snapshot'),
                api.get('/stats/most-traded')
            ]);
            setHeatmap(hw.data);
            setSessionSnapshot(snp.data);
            setMostTraded(mt.data);
        } catch (e) {
            console.error('Stats refresh error', e);
        }
    };

    // Data formatting for charts
    const getChartData = (history) => {
        // Flatten into recharts format
        const timeMap = {};
        history.forEach(c => {
            c.snapshots.forEach(s => {
                const time = new Date(s.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (!timeMap[time]) timeMap[time] = { time };
                timeMap[time][c.companyName] = s.netWorth || s.cash;
            });
        });
        return Object.values(timeMap).sort((a,b) => a.time.localeCompare(b.time));
    };

    return (
        <div className="min-h-screen bg-[#080b12] text-white p-4 font-mono select-none overflow-hidden" style={{ height: '100vh' }}>
            {/* Top Bar */}
            <div className="flex justify-between items-center border-b border-[#ffc107]/30 pb-2 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#ffc107] rotate-45 flex items-center justify-center text-[#080b12] font-black">S</div>
                    <span className="text-xl font-bold tracking-widest text-[#ffc107]">STATS ADMIN MISSION CONTROL</span>
                </div>
                <div className="text-3xl font-mono text-[#ffc107] font-bold tabular-nums">{currentTime}</div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-red-500 font-bold tracking-tighter">LIVE MONITORING</span>
                    </div>
                    <button 
                        onClick={logout}
                        className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 text-red-500 text-xs font-bold uppercase tracking-widest transition-colors rounded"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            {/* dashboard Grid */}
            <div className="grid grid-cols-12 gap-3 h-[calc(100vh-80px)]">
                
                {/* Panel 1: Leaderboard */}
                <div className="col-span-3 bg-[#ffc107]/5 border border-[#ffc107]/20 p-3 rounded-lg flex flex-col">
                    <h3 className="text-xs uppercase tracking-widest mb-2 border-b border-[#ffc107]/20 pb-1 text-[#ffc107]">Net Worth Leaderboard</h3>
                    <div className="flex-1 overflow-hidden">
                        {[...companies].sort((a,b) => b.totalValuation - a.totalValuation).map((c, i) => (
                            <div key={c.id} className={`flex justify-between items-center p-2 mb-1 border-l-2 ${i < 3 ? 'border-[#ffc107]' : 'border-transparent'} bg-white/5`}>
                                <span className="text-xs opacity-50">#{i+1}</span>
                                <span className="flex-1 ml-3 font-bold truncate">{c.name}</span>
                                <span className="text-[#ffc107] font-bold">${c.totalValuation.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Panel 2: Net Worth Chart */}
                <div className="col-span-6 bg-[#ffc107]/5 border border-[#ffc107]/20 p-3 rounded-lg">
                    <h3 className="text-xs uppercase tracking-widest mb-2 border-b border-[#ffc107]/20 pb-1 text-[#ffc107]">Net Worth Over Time</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <LineChart data={getChartData(networthHistory)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,193,7,0.1)" />
                            <XAxis dataKey="time" stroke="#ffc107" fontSize={10} />
                            <YAxis stroke="#ffc107" fontSize={10} />
                            <Tooltip contentStyle={{ backgroundColor: '#080b12', borderColor: '#ffc107', borderRadius: '4px' }} />
                            {networthHistory.map((c, i) => (
                                <Line key={c.companyId} type="monotone" dataKey={c.companyName} stroke={COMPANY_COLORS[i % COMPANY_COLORS.length]} dot={false} strokeWidth={2} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Panel 10: Snapshot Stats */}
                <div className="col-span-3 flex flex-col gap-2">
                    {Object.entries(sessionSnapshot).map(([key, value]) => (
                        <div key={key} className="bg-[#ffc107]/5 border border-[#ffc107]/20 p-2 rounded flex flex-col justify-center">
                            <span className="text-[10px] uppercase opacity-50">{key.replace(/([A-Z])/g, ' $1')}</span>
                            <span className={`text-lg font-bold ${key === 'marketStatus' ? (value === 'OPEN' ? 'text-green-500' : 'text-red-500') : 'text-[#ffc107]'}`}>{value}</span>
                        </div>
                    ))}
                </div>

                {/* Panel 7: Heatmap */}
                <div className="col-span-5 bg-[#ffc107]/5 border border-[#ffc107]/20 p-3 rounded-lg overflow-hidden">
                    <h3 className="text-xs uppercase tracking-widest mb-2 border-b border-[#ffc107]/20 pb-1 text-[#ffc107]">Market Heatmap</h3>
                    <div className="grid grid-cols-4 gap-2 h-full overflow-y-auto pr-1">
                        {heatmap.map(item => {
                            const intensity = Math.min(Math.abs(item.changePercent) * 10, 255);
                            const color = item.changePercent > 0 
                                ? `rgb(0, ${intensity}, 0)` 
                                : item.changePercent < 0 ? `rgb(${intensity}, 0, 0)` : '#222';
                            return (
                                <div key={item.id} className="p-2 text-center rounded relative overflow-hidden" style={{ backgroundColor: color }}>
                                    <div className="absolute inset-0 bg-black/20"></div>
                                    <div className="relative z-10">
                                        <div className="text-[10px] truncate">{item.name}</div>
                                        <div className="text-sm font-bold">${item.currentPrice.toFixed(2)}</div>
                                        <div className="text-[10px] font-bold">{item.changePercent > 0 ? '↑' : '↓'} {Math.abs(item.changePercent).toFixed(1)}%</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Panel 6: Trade Feed */}
                <div className="col-span-4 bg-[#ffc107]/5 border border-[#ffc107]/20 p-3 rounded-lg flex flex-col">
                    <h3 className="text-xs uppercase tracking-widest mb-2 border-b border-[#ffc107]/20 pb-1 text-[#ffc107]">Live Trade Feed</h3>
                    <div className="flex-1 overflow-hidden space-y-1">
                        {recentTrades.map((t, i) => (
                            <div key={i} className="text-[10px] font-mono border-b border-white/5 pb-1 flex gap-2 items-center">
                                <span className="opacity-40">TXN-{String(t.serialNumber).padStart(6, '0')}</span>
                                <span className="flex-1">
                                    {t.total > 50000 && <span className="text-[#ffc107]">💰</span>}
                                    <span className="font-bold">{t.buyerName}</span> bought {t.shares} from <span className="font-bold">{t.sellerName}</span> @ ${t.pricePerShare}
                                </span>
                                <span className={`px-1 rounded text-[8px] ${t.type === 'P2P' ? 'bg-blue-900' : 'bg-gray-800'}`}>{t.type}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* active events */}
                 <div className="col-span-3 bg-[#ffc107]/5 border border-[#ffc107]/20 p-3 rounded-lg">
                    <h3 className="text-xs uppercase tracking-widest mb-2 border-b border-[#ffc107]/20 pb-1 text-[#ffc107]">Events</h3>
                    <div className="space-y-2">
                        {activeEvents.length > 0 ? activeEvents.map(e => (
                             <div key={e.id} className="bg-black/20 p-2 border-l-2 border-[#ffc107]">
                                <div className="text-xs font-bold truncate">{e.name}</div>
                                <div className="w-full bg-gray-800 h-1 mt-1">
                                    <div className="bg-[#ffc107] h-full" style={{ width: `${(e.currentStep/e.totalSteps)*100}%` }}></div>
                                </div>
                                <div className="text-[9px] opacity-60 mt-1">Step {e.currentStep}/{e.totalSteps}</div>
                             </div>
                        )) : (
                            <div className="h-20 flex flex-col items-center justify-center opacity-30 italic">
                                <span>Market is calm</span>
                                <div className="w-full h-[1px] bg-white mt-1"></div>
                            </div>
                        )}
                    </div>
                 </div>

            </div>
        </div>
    );
};

export default StatsDashboard;
