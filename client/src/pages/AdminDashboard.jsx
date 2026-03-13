import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../context/MarketContext';
import { api } from '../api';
import StockHistoryChart from '../components/StockHistoryChart';
import ExcelJS from 'exceljs';
import * as htmlToImage from 'html-to-image';

export default function AdminDashboard() {
    const { companies, participants, events, recentTrades, marketOpen, marketConfig, formatCurrency, addToast, setParticipants, setEvents, setCompanies, setRecentTrades, bootstrap } = useMarket();
    const [activeTab, setActiveTab] = useState('companies');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [cooldownSec, setCooldownSec] = useState(60);
    const [isUpdatingCooldown, setIsUpdatingCooldown] = useState(false);
    const [tradeFilters, setTradeFilters] = useState({});
    const [historyData, setHistoryData] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [resetInput, setResetInput] = useState('');
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        loadHistory();
        loadAnalytics();
        const interval = setInterval(() => {
            loadHistory();
            loadAnalytics();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadAnalytics = async () => {
        try {
            const data = await api.getAnalytics();
            setAnalytics(data);
        } catch (err) {
            console.error('Failed to load analytics:', err);
        }
    };

    const loadHistory = async () => {
        try {
            const data = await api.getHistory();
            setHistoryData(data);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    };

    useEffect(() => {
        if (marketConfig?.sellWithdrawCooldownSec) {
            setCooldownSec(marketConfig.sellWithdrawCooldownSec);
        }
    }, [marketConfig]);

    const tabs = [
        { id: 'companies', label: 'Companies', icon: '◆' },
        { id: 'events', label: 'Events', icon: '⚡' },
        { id: 'trades', label: 'Trade History', icon: '▤' },
        { id: 'p2p', label: 'P2P Market', icon: '🛒' },
    ];

    // Toggle market
    const handleToggleMarket = async () => {
        try {
            await api.toggleMarket(!marketOpen);
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    // Toggle company stock
    const handleToggleStock = async (companyId) => {
        try {
            await api.toggleCompanyStock(companyId);
            await bootstrap();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    // Delete user
    const handleDeleteUser = async (userId) => {
        try {
            await api.deleteUser(userId);
            addToast('Company deleted successfully', 'success');
            setShowDeleteConfirm(null);
            await bootstrap();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    // Export CSV
    const handleExportCSV = async () => {
        try {
            const blob = await api.exportTrades();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'trades.csv';
            a.click();
            URL.revokeObjectURL(url);
            addToast('CSV exported', 'success');
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    // Fire event
    const handleFireEvent = async (eventId) => {
        try {
            await api.fireEvent(eventId);
            addToast('Event fired!', 'success');
            await bootstrap();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handlePauseEvent = async (eventId) => {
        try {
            await api.pauseEvent(eventId);
            addToast('Event paused', 'success');
            await bootstrap();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleStopEvent = async (eventId) => {
        try {
            await api.stopEvent(eventId);
            addToast('Event stopped', 'success');
            await bootstrap();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleDeleteEvent = async (eventId) => {
        try {
            await api.deleteEvent(eventId);
            addToast('Event deleted', 'success');
            await bootstrap();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleResetSystem = async () => {
        if (resetInput !== 'MYLITTLEPONY') {
            addToast('You must type MYLITTLEPONY to confirm', 'error');
            return;
        }
        try {
            await api.resetSystem();
            addToast('System reset successfully', 'success');
            setShowResetConfirm(false);
            setResetInput('');
            await bootstrap();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const handleExportAll = async () => {
        try {
            // First check if File System Access API is supported
            if (!window.showSaveFilePicker) {
                addToast('Your browser does not support the File System Access API to pick save locations.', 'error');
                return;
            }

            setExporting(true);

            // 1. Fetch raw data
            const rawDataBlob = await api.exportAll();
            const rawDataText = await rawDataBlob.text();
            const exportData = JSON.parse(rawDataText);

            // 2. Initialize Excel workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'STXSIM Admin';
            workbook.created = new Date();

            // 3. Capture Graph as Image
            const chartNode = document.getElementById('stock-history-chart-container');
            let imageId = null;
            if (chartNode) {
                const dataUrl = await htmlToImage.toPng(chartNode, { backgroundColor: '#13161c' });
                imageId = workbook.addImage({
                    base64: dataUrl,
                    extension: 'png',
                });
            }

            // 4. Create Graph Sheet
            if (imageId !== null) {
                const graphSheet = workbook.addWorksheet('Market Graphs');
                graphSheet.addImage(imageId, {
                    tl: { col: 1, row: 1 },
                    ext: { width: 800, height: 400 } // approximate width/height based on container
                });
            }

            // 5. Create Companies Sheet
            const companiesSheet = workbook.addWorksheet('Companies');
            companiesSheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Name', key: 'name', width: 25 },
                { header: 'Valuation', key: 'totalValuation', width: 20 },
                { header: 'Share Price', key: 'sharePrice', width: 15 },
                { header: 'Cash Balance', key: 'cashBalance', width: 20 },
                { header: 'Shares Available', key: 'sharesAvailable', width: 20 },
            ];
            exportData.companies?.forEach(c => companiesSheet.addRow(c));

            // 6. Create Users Sheet
            const usersSheet = workbook.addWorksheet('Users');
            usersSheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Username', key: 'username', width: 25 },
                { header: 'Role', key: 'role', width: 15 },
            ];
            exportData.users?.forEach(u => usersSheet.addRow(u));

            // 7. Create Trades Sheet
            const tradesSheet = workbook.addWorksheet('Trades');
            tradesSheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Timestamp', key: 'timestamp', width: 25 },
                { header: 'Buyer ID', key: 'buyerCompanyId', width: 15 },
                { header: 'Seller ID', key: 'sellerCompanyId', width: 15 },
                { header: 'Shares', key: 'shares', width: 15 },
                { header: 'Price Per Share', key: 'pricePerShare', width: 20 },
                { header: 'Total Value', key: 'total', width: 20 },
            ];
            exportData.trades?.forEach(t => tradesSheet.addRow({
                ...t,
                timestamp: new Date(t.timestamp).toLocaleString()
            }));

            // 8. Generate Excel Buffer
            const excelBuffer = await workbook.xlsx.writeBuffer();

            // 9. Prompt User for Save Location
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: 'stxsim_market_export.xlsx',
                types: [{
                    description: 'Excel Workbook',
                    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
                }],
            });

            // 10. Write to selected file
            const writableStream = await fileHandle.createWritable();
            await writableStream.write(excelBuffer);
            await writableStream.close();

            addToast('Excel export saved successfully', 'success');
        } catch (err) {
            // User cancelled picker throws an AbortError which we can ignore or toast
            if (err.name === 'AbortError') {
                console.log('User cancelled export');
            } else {
                console.error('Export error:', err);
                addToast(err.message || 'Export failed', 'error');
            }
        } finally {
            setExporting(false);
        }
    };

    const handleCooldownChange = async () => {
        setIsUpdatingCooldown(true);
        try {
            await api.updateMarketConfig({ sellWithdrawCooldownSec: cooldownSec });
            addToast(`Cooldown updated to ${cooldownSec}s`, 'success');
            await bootstrap();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setIsUpdatingCooldown(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Market Control Bar */}
            <div className="card flex flex-col items-start gap-4">
                <div className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center">
                    <div>
                        <h2 className="font-heading font-semibold text-lg text-text-primary">Market Control</h2>
                        <p className="text-text-secondary text-sm mt-1">
                            {companies.length} companies registered • {participants.length} participants
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center justify-end">
                        <button
                            onClick={handleExportAll}
                            disabled={exporting}
                            className="btn btn-outline font-heading"
                        >
                            {exporting ? '⏳ Exporting...' : '📥 Export All Data'}
                        </button>
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            className="btn btn-danger min-w-[140px]"
                        >
                            ⚠️ Reset System
                        </button>
                        <button
                            onClick={handleToggleMarket}
                            className={`btn ${marketOpen ? 'btn-danger' : 'btn-success'} min-w-[140px]`}
                        >
                            {marketOpen ? '⏹ Close Market' : '▶ Open Market'}
                        </button>
                    </div>
                </div>

                <div className="pt-4 border-t border-border w-full flex items-center gap-3">
                    <label className="text-sm text-text-secondary whitespace-nowrap">
                        P2P Sell Withdrawal Cooldown (sec):
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={cooldownSec}
                        onChange={(e) => setCooldownSec(e.target.value)}
                        className="input max-w-[100px] text-sm py-1.5"
                    />
                    <button
                        onClick={handleCooldownChange}
                        disabled={isUpdatingCooldown || cooldownSec === marketConfig?.sellWithdrawCooldownSec}
                        className="btn btn-outline text-sm py-1.5 px-3 disabled:opacity-50"
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* Analytics Overview */}
            {analytics && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card p-4 flex flex-col justify-center">
                        <span className="text-sm text-text-secondary font-heading mb-1">Total Market Cap</span>
                        <span className="text-xl font-mono text-accent-green font-semibold">{formatCurrency(analytics.totalMarketCap)}</span>
                    </div>
                    <div className="card p-4 flex flex-col justify-center">
                        <span className="text-sm text-text-secondary font-heading mb-1">Top Gainer</span>
                        {analytics.topGainer ? (
                            <div className="flex items-center gap-2">
                                <span className="font-heading text-text-primary truncate max-w-[100px]">{analytics.topGainer.company}</span>
                                <span className="font-mono text-accent-green text-sm">+{analytics.topGainer.gainPercent.toFixed(1)}%</span>
                            </div>
                        ) : <span className="text-text-secondary text-sm font-mono">N/A</span>}
                    </div>
                    <div className="card p-4 flex flex-col justify-center">
                        <span className="text-sm text-text-secondary font-heading mb-1">Top Loser</span>
                        {analytics.topLoser ? (
                            <div className="flex items-center gap-2">
                                <span className="font-heading text-text-primary truncate max-w-[100px]">{analytics.topLoser.company}</span>
                                <span className="font-mono text-accent-red text-sm">{analytics.topLoser.lossPercent.toFixed(1)}%</span>
                            </div>
                        ) : <span className="text-text-secondary text-sm font-mono">N/A</span>}
                    </div>
                    <div className="card p-4 flex flex-col justify-center">
                        <span className="text-sm text-text-secondary font-heading mb-1">Most Active Trader</span>
                        {analytics.mostActiveTrader ? (
                            <div>
                                <span className="font-heading text-text-primary block truncate max-w-[150px]">{analytics.mostActiveTrader.company}</span>
                                <span className="font-mono text-text-secondary text-xs">Vol: {formatCurrency(analytics.mostActiveTrader.volume)}</span>
                            </div>
                        ) : <span className="text-text-secondary text-sm font-mono">N/A</span>}
                    </div>
                </div>
            )}

            {/* Stock History Chart */}
            <div id="stock-history-chart-container">
                <StockHistoryChart historyData={historyData} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2.5 text-sm font-heading font-medium transition-colors border-b-2 -mb-[1px] ${activeTab === tab.id
                            ? 'text-accent-gold border-accent-gold'
                            : 'text-text-secondary border-transparent hover:text-text-primary'
                            }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'companies' && (
                <CompaniesTab
                    companies={companies}
                    participants={participants}
                    onToggleStock={handleToggleStock}
                    onDelete={(user) => setShowDeleteConfirm(user)}
                    onEdit={(company) => setShowEditModal(company)}
                    onCreate={() => setShowCreateModal(true)}
                    formatCurrency={formatCurrency}
                />
            )}

            {activeTab === 'events' && (
                <EventsTab
                    events={events}
                    companies={companies}
                    onFire={handleFireEvent}
                    onPause={handlePauseEvent}
                    onStop={handleStopEvent}
                    onDelete={handleDeleteEvent}
                    onCreate={() => setShowEventModal(true)}
                    formatCurrency={formatCurrency}
                />
            )}

            {activeTab === 'trades' && (
                <TradesTab
                    trades={recentTrades}
                    companies={companies}
                    filters={tradeFilters}
                    setFilters={setTradeFilters}
                    onExport={handleExportCSV}
                    formatCurrency={formatCurrency}
                />
            )}

            {activeTab === 'p2p' && (
                <P2PMarketTab
                    companies={companies}
                    formatCurrency={formatCurrency}
                />
            )}

            {/* Create Company Modal */}
            {showCreateModal && (
                <CreateCompanyModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={async () => { setShowCreateModal(false); await bootstrap(); }}
                    addToast={addToast}
                />
            )}

            {/* Edit Company Modal */}
            {showEditModal && (
                <EditCompanyModal
                    company={showEditModal}
                    onClose={() => setShowEditModal(null)}
                    onSuccess={async () => { setShowEditModal(null); await bootstrap(); }}
                    addToast={addToast}
                />
            )}

            {/* Create Event Modal */}
            {showEventModal && (
                <CreateEventModal
                    companies={companies}
                    onClose={() => setShowEventModal(false)}
                    onSuccess={async () => { setShowEventModal(false); await bootstrap(); }}
                    addToast={addToast}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-backdrop" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="font-heading font-semibold text-lg mb-4">Confirm Delete</h3>
                        <p className="text-text-secondary text-sm mb-6">
                            Are you sure you want to delete <span className="text-text-primary font-semibold">{showDeleteConfirm.username}</span> and their company? This action cannot be undone. Trade history will be preserved.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowDeleteConfirm(null)} className="btn btn-outline">Cancel</button>
                            <button onClick={() => handleDeleteUser(showDeleteConfirm.id)} className="btn btn-danger">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="modal-backdrop" onClick={() => { setShowResetConfirm(false); setResetInput(''); }}>
                    <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="font-heading font-semibold text-lg text-accent-red mb-4">⚠️ Reset System</h3>
                        <p className="text-text-secondary text-sm mb-4">
                            Are you sure you want to reset the entire system? This will forcefully delete all companies, users, trades, and events. This action is irreversible.
                        </p>
                        <div className="mb-6">
                            <label className="label text-accent-red text-xs uppercase tracking-wider mb-2">Type "MYLITTLEPONY" to confirm</label>
                            <input
                                type="text"
                                className="input border-accent-red/50 focus:border-accent-red uppercase"
                                value={resetInput}
                                onChange={e => setResetInput(e.target.value.toUpperCase())}
                                placeholder="MYLITTLEPONY"
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => { setShowResetConfirm(false); setResetInput(''); }} className="btn btn-outline">Cancel</button>
                            <button
                                onClick={handleResetSystem}
                                className="btn btn-danger"
                                disabled={resetInput !== 'MYLITTLEPONY'}
                            >
                                Yes, Reset Everything
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ──── Companies Tab ────
function CompaniesTab({ companies, participants, onToggleStock, onDelete, onEdit, onCreate, formatCurrency }) {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-heading font-semibold text-text-primary">All Companies</h3>
                <button onClick={onCreate} className="btn btn-gold">+ Add Company</button>
            </div>

            {companies.length === 0 ? (
                <div className="card text-center py-12">
                    <div className="text-4xl mb-3">🏢</div>
                    <p className="text-text-secondary font-heading">No companies yet</p>
                    <p className="text-text-secondary text-sm mt-1">Create your first company to get started</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th className="num">Valuation</th>
                                <th className="num">Stock Price</th>
                                <th className="num">Shares Avail</th>
                                <th className="num">Cash Balance</th>
                                <th className="num">Stock %</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map(c => {
                                const participant = participants.find(p => p.company?.id === c.id);
                                return (
                                    <tr key={c.id}>
                                        <td>
                                            <div>
                                                <Link to={`/company/${c.id}`} className="font-heading font-medium text-accent-blue hover:text-accent-blue/80 hover:underline transition-colors">
                                                    {c.name}
                                                </Link>
                                                {participant && <div className="text-[10px] text-text-secondary">@{participant.username}</div>}
                                            </div>
                                        </td>
                                        <td className="num">{formatCurrency(c.totalValuation)}</td>
                                        <td className="num font-semibold text-accent-green">{formatCurrency(c.sharePrice)}</td>
                                        <td className="num">{c.sharesAvailable.toLocaleString()} / {c.totalShares.toLocaleString()}</td>
                                        <td className="num">{formatCurrency(c.cashBalance)}</td>
                                        <td className="num">{c.stockPercent}%</td>
                                        <td>
                                            <span className={`status-badge text-[10px] ${c.stockEnabled ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                                                {c.stockEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <Link to={`/company/${c.id}`} className="p-1.5 rounded hover:bg-white/5 text-accent-blue transition-colors" title="Audit Portfolio">
                                                    🔍
                                                </Link>
                                                <button onClick={() => onEdit(c)} className="p-1.5 rounded hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors" title="Edit Company">
                                                    ✎
                                                </button>
                                                <button onClick={() => onToggleStock(c.id)} className="btn btn-outline text-xs py-1 px-2">
                                                    {c.stockEnabled ? 'Disable' : 'Enable'}
                                                </button>
                                                {participant && (
                                                    <button onClick={() => onDelete(participant)} className="btn btn-danger text-xs py-1 px-2">✕</button>
                                                )}
                                            </div>
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

// ──── Events Tab ────
function EventsTab({ events, companies, onFire, onPause, onStop, onDelete, onCreate }) {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-heading font-semibold text-text-primary">Fluctuation Events</h3>
                <button onClick={onCreate} className="btn btn-gold">+ Create Event</button>
            </div>

            {events.length === 0 ? (
                <div className="card text-center py-12">
                    <div className="text-4xl mb-3">⚡</div>
                    <p className="text-text-secondary font-heading">No events created</p>
                    <p className="text-text-secondary text-sm mt-1">Create market events to simulate price fluctuations</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {events.map(event => (
                        <div key={event.id} className={`card ${event.active ? 'border-l-2 border-l-accent-gold' : ''}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-heading font-semibold text-text-primary">{event.name}</h4>
                                        <span className={`status-badge text-[10px] ${event.active ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30 animate-pulse' : 'bg-white/5 text-text-secondary'}`}>
                                            {event.active ? `⚡ ONGOING (${event.currentStep}/${event.totalSteps})` : 'IDLE'}
                                        </span>
                                        {event.lastFiredAt && (
                                            <span className="text-[10px] text-text-secondary font-mono">
                                                Last: {new Date(event.lastFiredAt).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-text-secondary text-sm mb-3">{event.description}</p>

                                    {/* Targets */}
                                    <div className="flex flex-wrap gap-2">
                                        {event.targets?.map(t => {
                                            const company = companies.find(c => c.id === t.companyId);
                                            return (
                                                <div key={t.id} className="text-xs bg-base/50 rounded px-2 py-1 font-mono">
                                                    <span className="text-text-primary">{company?.name || `#${t.companyId}`}</span>
                                                    <span className="mx-1 text-text-secondary">|</span>
                                                    <span className={t.onsetDirection === 'UP' ? 'text-accent-green' : 'text-accent-red'}>
                                                        Onset: {t.onsetDirection} {t.onsetPercent}%
                                                    </span>
                                                    <span className="mx-1 text-text-secondary">|</span>
                                                    <span className={t.driftDirection === 'UP' ? 'text-accent-green' : 'text-accent-red'}>
                                                        Drift: {t.driftDirection} {t.driftPercent}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-2 text-xs text-text-secondary font-mono">
                                        Interval: {(event.intervalMs / 1000).toFixed(1)}s • Steps: {event.totalSteps}
                                    </div>
                                </div>

                                <div className="flex gap-1 shrink-0">
                                    {!event.active ? (
                                        <>
                                            <button onClick={() => onFire(event.id)} className="btn btn-gold text-xs py-1 px-3">🔥 Fire</button>
                                            <button onClick={() => onDelete(event.id)} className="btn btn-danger text-xs py-1 px-2">✕</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => onPause(event.id)} className="btn btn-outline text-xs py-1 px-2">⏸ Pause</button>
                                            <button onClick={() => onStop(event.id)} className="btn btn-danger text-xs py-1 px-2">⏹ Stop</button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Progress bar */}
                            {event.active && (
                                <div className="mt-3 h-1 bg-base rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-accent-gold rounded-full transition-all duration-300"
                                        style={{ width: `${(event.currentStep / event.totalSteps) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ──── Trades Tab ────
function TradesTab({ trades, companies, filters, setFilters, onExport, formatCurrency }) {
    const [adminTrades, setAdminTrades] = useState([]);
    const [loadingTrades, setLoadingTrades] = useState(false);
    const [activeTab, setActiveTab] = useState('IPO'); // 'IPO' | 'P2P'
    const [recentlyAdded, setRecentlyAdded] = useState(new Set());

    useEffect(() => {
        loadTrades();
    }, [filters]);

    const loadTrades = async () => {
        try {
            setLoadingTrades(true);
            const data = await api.getAdminTrades(filters);

            if (adminTrades.length > 0) {
                const existingIds = new Set(adminTrades.map(t => t.id));
                const newIds = new Set(data.filter(t => !existingIds.has(t.id)).map(t => t.id));
                if (newIds.size > 0) {
                    setRecentlyAdded(newIds);
                    setTimeout(() => setRecentlyAdded(new Set()), 1500);
                }
            }

            setAdminTrades(data);
        } catch (err) {
            console.error('Load trades error:', err);
        } finally {
            setLoadingTrades(false);
        }
    };

    const sourceData = adminTrades.length > 0 ? adminTrades : trades;
    const ipoTrades = sourceData.filter(t => t.type === 'IPO');
    const p2pTrades = sourceData.filter(t => t.type === 'P2P');
    const displayTrades = activeTab === 'IPO' ? ipoTrades : p2pTrades;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-heading font-semibold text-text-primary">Trade History</h3>
                <div className="flex gap-2 flex-wrap">
                    <select
                        className="input max-w-[200px]"
                        value={filters.companyId || ''}
                        onChange={e => setFilters({ ...filters, companyId: e.target.value })}
                    >
                        <option value="">All Companies</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <select
                        className="input max-w-[140px]"
                        value={filters.role || ''}
                        onChange={e => setFilters({ ...filters, role: e.target.value })}
                    >
                        <option value="">All Roles</option>
                        <option value="buyer">Buyer</option>
                        <option value="seller">Seller</option>
                    </select>
                    <button onClick={onExport} className="btn btn-outline text-xs">📥 Export CSV</button>
                </div>
            </div>

            {/* Admin Trade History Tabs */}
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
                <div className="card text-center py-12">
                    <div className="text-4xl mb-3">📊</div>
                    <p className="text-text-secondary font-heading">No trades yet</p>
                    <p className="text-text-secondary text-sm mt-1">Trades will appear here once the market is active</p>
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
                                const isNew = recentlyAdded.has(t.id);
                                return (
                                    <tr key={t.id} className={isNew ? 'animate-slide-in-flash' : ''}>
                                        <td className="font-mono text-xs text-text-secondary">
                                            TXN-{String(t.serialNumber).padStart(6, '0')}
                                        </td>
                                        <td className="text-text-secondary text-xs">{t.timestamp ? new Date(t.timestamp).toLocaleString() : '—'}</td>
                                        <td>
                                            <span className={`status-badge text-[10px] bg-accent-blue/10 text-accent-blue`}>
                                                EXCHANGE
                                            </span>
                                        </td>
                                        <td className="text-accent-green font-heading">{t.buyer?.name || t.buyerName}</td>
                                        <td className="text-accent-red font-heading">{t.seller?.name || t.sellerName}</td>
                                        <td className="num">{t.shares?.toLocaleString()}</td>
                                        <td className="num">{formatCurrency(t.pricePerShare)}</td>
                                        <td className="num font-semibold">{formatCurrency(t.total)}</td>
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

// ──── Create Company Modal ────
function CreateCompanyModal({ onClose, onSuccess, addToast }) {
    const [form, setForm] = useState({
        username: '', password: '', companyName: '',
        totalValuation: '', stockPercent: '', cashBalance: '', sharesAvailable: '',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.createUser({
                ...form,
                totalValuation: parseFloat(form.totalValuation),
                stockPercent: parseFloat(form.stockPercent),
                cashBalance: parseFloat(form.cashBalance),
                sharesAvailable: form.sharesAvailable ? parseInt(form.sharesAvailable) : undefined,
            });
            addToast('Company created successfully!', 'success');
            onSuccess();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="font-heading font-semibold text-lg mb-4">Add New Company</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Login Username</label>
                            <input className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="e.g. tesla_inc" required />
                        </div>
                        <div>
                            <label className="label">Login Password</label>
                            <input className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="e.g. BullRun2025!" required />
                        </div>
                    </div>

                    <div>
                        <label className="label">Company Display Name</label>
                        <input className="input" value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="e.g. Tesla Inc." required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Total Valuation ($)</label>
                            <input className="input" type="number" step="0.01" value={form.totalValuation} onChange={e => setForm({ ...form, totalValuation: e.target.value })} placeholder="10000000" required />
                        </div>
                        <div>
                            <label className="label">Stock Percentage (%)</label>
                            <input className="input" type="number" step="0.1" min="0" max="100" value={form.stockPercent} onChange={e => setForm({ ...form, stockPercent: e.target.value })} placeholder="30" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Starting Cash ($)</label>
                            <input className="input" type="number" step="0.01" value={form.cashBalance} onChange={e => setForm({ ...form, cashBalance: e.target.value })} placeholder="500000" required />
                        </div>
                        <div>
                            <label className="label">Initial Shares Available</label>
                            <input className="input" type="number" value={form.sharesAvailable} onChange={e => setForm({ ...form, sharesAvailable: e.target.value })} placeholder="Auto-calculated" />
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
                        <button type="submit" disabled={loading} className="btn btn-gold">
                            {loading ? 'Creating...' : 'Create Company'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ──── Edit Company Modal ────
function EditCompanyModal({ company, onClose, onSuccess, addToast }) {
    const [form, setForm] = useState({
        name: company.name,
        totalValuation: company.totalValuation,
        stockPercent: company.stockPercent,
        cashBalance: company.cashBalance,
        sharePrice: company.sharePrice,
        sharesAvailable: company.sharesAvailable,
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.updateCompany(company.id, {
                name: form.name,
                totalValuation: parseFloat(form.totalValuation),
                stockPercent: parseFloat(form.stockPercent),
                cashBalance: parseFloat(form.cashBalance),
                sharePrice: parseFloat(form.sharePrice),
                sharesAvailable: parseInt(form.sharesAvailable),
            });
            addToast('Company updated!', 'success');
            onSuccess();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
                <h3 className="font-heading font-semibold text-lg mb-4">Edit: {company.name}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Company Name</label>
                        <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Total Valuation ($)</label>
                            <input className="input" type="number" step="0.01" value={form.totalValuation} onChange={e => setForm({ ...form, totalValuation: e.target.value })} required />
                        </div>
                        <div>
                            <label className="label">Stock Percentage (%)</label>
                            <input className="input" type="number" step="0.1" min="0" max="100" value={form.stockPercent} onChange={e => setForm({ ...form, stockPercent: e.target.value })} required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Cash Balance ($)</label>
                            <input className="input" type="number" step="0.01" value={form.cashBalance} onChange={e => setForm({ ...form, cashBalance: e.target.value })} required />
                        </div>
                        <div>
                            <label className="label">Share Price ($)</label>
                            <input className="input" type="number" step="0.01" value={form.sharePrice} onChange={e => setForm({ ...form, sharePrice: e.target.value })} required />
                        </div>
                    </div>

                    <div>
                        <label className="label">Shares Available</label>
                        <input className="input" type="number" value={form.sharesAvailable} onChange={e => setForm({ ...form, sharesAvailable: e.target.value })} required />
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
                        <button type="submit" disabled={loading} className="btn btn-gold">
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ──── Create Event Modal ────
function CreateEventModal({ companies, onClose, onSuccess, addToast }) {
    const [form, setForm] = useState({
        name: '', description: '', intervalMs: 5000, totalSteps: 10,
    });
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(false);

    const addTarget = () => {
        setTargets([...targets, {
            companyId: companies[0]?.id || 0,
            onsetDirection: 'DOWN', onsetPercent: 5,
            driftDirection: 'DOWN', driftPercent: 1,
        }]);
    };

    const updateTarget = (index, field, value) => {
        setTargets(targets.map((t, i) => i === index ? { ...t, [field]: value } : t));
    };

    const removeTarget = (index) => {
        setTargets(targets.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (targets.length === 0) {
            addToast('Add at least one target company', 'error');
            return;
        }
        setLoading(true);
        try {
            await api.createEvent({
                name: form.name,
                description: form.description,
                intervalMs: parseInt(form.intervalMs),
                totalSteps: parseInt(form.totalSteps),
                targets: targets.map(t => ({
                    ...t,
                    companyId: parseInt(t.companyId),
                    onsetPercent: parseFloat(t.onsetPercent),
                    driftPercent: parseFloat(t.driftPercent),
                })),
            });
            addToast('Event created!', 'success');
            onSuccess();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="font-heading font-semibold text-lg mb-4">Create Fluctuation Event</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Event Name</label>
                        <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder='e.g. "Oil Shortage Crisis"' required />
                    </div>

                    <div>
                        <label className="label">Description</label>
                        <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the market scenario..." required />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Interval (ms)</label>
                            <input className="input" type="number" value={form.intervalMs} onChange={e => setForm({ ...form, intervalMs: e.target.value })} required />
                        </div>
                        <div>
                            <label className="label">Total Steps</label>
                            <input className="input" type="number" value={form.totalSteps} onChange={e => setForm({ ...form, totalSteps: e.target.value })} required />
                        </div>
                    </div>

                    {/* Targets */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="label mb-0">Affected Companies</label>
                            <button type="button" onClick={addTarget} className="btn btn-outline text-xs py-1">+ Add Target</button>
                        </div>

                        {targets.map((target, i) => (
                            <div key={i} className="card mb-2 p-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        <select className="input" value={target.companyId} onChange={e => updateTarget(i, 'companyId', e.target.value)}>
                                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <select className="input" value={target.onsetDirection} onChange={e => updateTarget(i, 'onsetDirection', e.target.value)}>
                                            <option value="UP">Onset ↑</option>
                                            <option value="DOWN">Onset ↓</option>
                                        </select>
                                        <input className="input" type="number" step="0.1" value={target.onsetPercent} onChange={e => updateTarget(i, 'onsetPercent', e.target.value)} placeholder="Onset %" />
                                        <select className="input" value={target.driftDirection} onChange={e => updateTarget(i, 'driftDirection', e.target.value)}>
                                            <option value="UP">Drift ↑</option>
                                            <option value="DOWN">Drift ↓</option>
                                        </select>
                                        <input className="input" type="number" step="0.1" value={target.driftPercent} onChange={e => updateTarget(i, 'driftPercent', e.target.value)} placeholder="Drift %" />
                                    </div>
                                    <button type="button" onClick={() => removeTarget(i)} className="text-accent-red hover:text-accent-red/80 text-lg mt-1">×</button>
                                </div>
                            </div>
                        ))}

                        {targets.length === 0 && (
                            <p className="text-text-secondary text-xs text-center py-4">Click "Add Target" to select affected companies</p>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
                        <button type="submit" disabled={loading} className="btn btn-gold">
                            {loading ? 'Creating...' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ──── P2P Market Tab ────
function P2PMarketTab({ companies, formatCurrency }) {
    // Check if there are any companies with shares available
    const activeCompanies = companies.filter(c => c.sharesAvailable > 0);
    const inactiveCompanies = companies.filter(c => c.sharesAvailable <= 0);

    return (
        <div className="space-y-4 animate-fade-in">
            <h3 className="font-heading font-semibold text-text-primary">P2P Market Panel</h3>
            
            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Seller Company Name</th>
                            <th className="num">Shares Listed</th>
                            <th className="num">Current Price</th>
                            <th className="num">Total Value</th>
                            <th className="text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {activeCompanies.map(c => (
                            <tr key={c.id}>
                                <td className="font-heading font-medium text-text-primary">{c.name}</td>
                                <td className="num">{c.sharesAvailable.toLocaleString()}</td>
                                <td className="num">{formatCurrency(c.sharePrice)}</td>
                                <td className="num font-semibold text-accent-gold">{formatCurrency(c.sharePrice * c.sharesAvailable)}</td>
                                <td className="text-center">
                                    <Link to={`/company/${c.id}`} className="btn btn-outline text-xs py-1 px-3 inline-block">
                                        Details
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {inactiveCompanies.map(c => (
                            <tr key={c.id} className="opacity-50">
                                <td className="font-heading text-text-secondary">{c.name}</td>
                                <td className="num text-text-secondary" colSpan={3}>No shares listed</td>
                                <td className="text-center">
                                    <Link to={`/company/${c.id}`} className="btn btn-outline text-xs py-1 px-3 inline-block">
                                        Details
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
