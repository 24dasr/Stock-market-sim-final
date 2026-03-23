import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../context/MarketContext';
import { api } from '../api';

export default function Portfolio() {
    const { holdings, formatCurrency, addToast, priceFlashes, marketConfig, myCompany, marketDataTick } = useMarket();
    const [sellModal, setSellModal] = useState(null);
    const [sellQuantity, setSellQuantity] = useState('');
    const [selling, setSelling] = useState(false);

    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [now, setNow] = useState(Date.now());

    // Update 'now' every second for the cooldown timer
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        try {
            setLoadingOrders(true);
            const data = await api.getSellOrders();
            const myId = myCompany?.id;
            if (myId && data.orders) {
                setOrders(data.orders.filter(o => o.sellerCompanyId === myId));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingOrders(false);
        }
    }

    useEffect(() => {
        fetchOrders();
    }, [myCompany?.id, holdings, marketDataTick]);

    const handleSell = async () => {
        if (!sellModal || !sellQuantity || parseInt(sellQuantity) <= 0) return;
        setSelling(true);
        try {
            await api.sellShares(sellModal.targetCompanyId, parseInt(sellQuantity), 0);
            addToast(`Listed ${sellQuantity} shares of ${sellModal.targetCompany.name} on the Secondary Market`, 'success');
            setSellModal(null);
            setSellQuantity('');
            fetchOrders();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setSelling(false);
        }
    };

    const handleWithdraw = async (orderId) => {
        try {
            await api.withdrawSellOrder(orderId);
            addToast('Order withdrawn successfully', 'success');
            fetchOrders();
        } catch (err) {
            addToast(err.message, 'error');
        }
    };

    const validHoldings = Array.isArray(holdings) ? holdings : [];
    const totalPortfolioValue = validHoldings.reduce((sum, h) => sum + ((h?.shares || 0) * (h?.targetCompany?.sharePrice || 0)), 0);
    const totalCostBasis = validHoldings.reduce((sum, h) => sum + ((h?.shares || 0) * (h?.avgBuyPrice || 0)), 0);
    const totalPnL = totalPortfolioValue - totalCostBasis;
    const totalPnLPercent = totalCostBasis > 0 ? (totalPnL / totalCostBasis) * 100 : 0;

    const sellTotal = sellModal && sellQuantity ? parseInt(sellQuantity) * (sellModal?.targetCompany?.sharePrice || 0) : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Portfolio Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card">
                    <p className="text-text-secondary text-xs font-heading uppercase tracking-wider mb-1">Total Value</p>
                    <p className="font-mono font-bold text-xl text-accent-green">{formatCurrency(totalPortfolioValue)}</p>
                </div>
                <div className="card">
                    <p className="text-text-secondary text-xs font-heading uppercase tracking-wider mb-1">Cost Basis</p>
                    <p className="font-mono font-bold text-xl text-text-primary">{formatCurrency(totalCostBasis)}</p>
                </div>
                <div className="card">
                    <p className="text-text-secondary text-xs font-heading uppercase tracking-wider mb-1">Total P/L</p>
                    <p className={`font-mono font-bold text-xl ${totalPnL >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)} ({totalPnLPercent.toFixed(2)}%)
                    </p>
                </div>
            </div>

            {/* Holdings Table */}
            {validHoldings.length === 0 ? (
                <div className="card text-center py-16">
                    <div className="text-5xl mb-4">💼</div>
                    <p className="font-heading text-text-secondary text-lg">Portfolio is empty</p>
                    <p className="text-text-secondary text-sm mt-1">Buy shares from the Market to start building your portfolio</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Company</th>
                                <th className="num">Shares</th>
                                <th className="num">Current Price</th>
                                <th className="num">Avg Buy Price</th>
                                <th className="num">Market Value</th>
                                <th className="num">Unrealized P/L</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {validHoldings.map(h => {
                                    const sharePrice = h?.targetCompany?.sharePrice || 0;
                                    const compName = h?.targetCompany?.name || 'Unknown';
                                    const shares = h?.shares || 0;
                                    const currentValue = shares * sharePrice;
                                    const costBasis = shares * (h?.avgBuyPrice || 0);
                                    const pnl = currentValue - costBasis;
                                    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
                                const flash = h?.targetCompanyId ? priceFlashes[h.targetCompanyId] : null;

                                return (
                                    <tr key={h.id}>
                                        <td>
                                            <Link to={`/company/${h.targetCompanyId}`} className="font-heading font-medium text-accent-blue hover:text-accent-blue/80 hover:underline transition-colors">
                                                {compName}
                                            </Link>
                                        </td>
                                        <td className="num">{(h?.shares || 0).toLocaleString()}</td>
                                        <td className={`num font-semibold text-accent-green ${flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''}`}>
                                            {formatCurrency(sharePrice)}
                                        </td>
                                        <td className="num text-text-secondary">{formatCurrency(h?.avgBuyPrice || 0)}</td>
                                        <td className="num">{formatCurrency(currentValue)}</td>
                                        <td className={`num font-semibold ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                                            {pnl >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(pnl))} ({pnlPercent.toFixed(2)}%)
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => {
                                                    if (!h.targetCompany) return;
                                                    setSellModal(h);
                                                    setSellQuantity('');
                                                }}
                                                className="btn btn-danger text-xs py-1 px-3"
                                            >
                                                List on Market
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Active Secondary Market Listings */}
            <div className="mt-8">
                <h3 className="font-heading font-semibold text-lg text-text-primary mb-4">Active Market Listings</h3>
                {loadingOrders ? (
                    <div className="card text-center py-8">
                        <p className="text-text-secondary text-sm">Loading listings...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="card text-center py-8">
                        <p className="text-text-secondary text-sm">You have no active sell orders on the secondary market.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Company</th>
                                    <th className="num">Shares</th>
                                    <th className="num">Current Price</th>
                                    <th className="num">Total Value</th>
                                    <th className="num">Listed At</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.isArray(orders) && orders.map(o => {
                                    const ageMs = now - new Date(o.createdAt).getTime();
                                    const cooldownMs = (marketConfig?.sellWithdrawCooldownSec || 60) * 1000;
                                    const canWithdraw = ageMs >= cooldownMs;
                                    const remainingSec = Math.ceil((cooldownMs - ageMs) / 1000);
                                    const targetName = o?.targetCompany?.name || 'Unknown';

                                    return (
                                        <tr key={o.id}>
                                            <td>
                                                <Link to={`/company/${o.targetCompanyId}`} className="font-heading font-medium text-accent-blue hover:text-accent-blue/80 hover:underline transition-colors">
                                                    {targetName}
                                                </Link>
                                            </td>
                                            <td className="num">{(o?.shares || 0).toLocaleString()}</td>
                                            <td className="num text-accent-green">{formatCurrency(o?.targetCompany?.sharePrice || 0)}</td>
                                            <td className="num">{formatCurrency((o?.shares || 0) * (o?.targetCompany?.sharePrice || 0))}</td>
                                            <td className="num text-text-secondary text-sm">
                                                {o?.createdAt ? new Date(o.createdAt).toLocaleTimeString() : 'N/A'}
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleWithdraw(o.id)}
                                                    disabled={!canWithdraw}
                                                    className="btn btn-outline text-xs py-1 px-3 disabled:opacity-50"
                                                    title={!canWithdraw ? `Wait ${remainingSec}s to withdraw` : 'Withdraw shares back to portfolio'}
                                                >
                                                    {canWithdraw ? 'Withdraw' : `Wait ${remainingSec}s`}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Sell Modal */}
            {sellModal && (
                <div className="modal-backdrop" onClick={() => setSellModal(null)}>
                    <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="font-heading font-semibold text-lg mb-1">Sell {sellModal.targetCompany.name}</h3>
                        <p className="text-text-secondary text-sm mb-4">
                            You own <span className="font-mono text-text-primary">{sellModal.shares.toLocaleString()}</span> shares •
                            Current: <span className="text-accent-green font-mono">{formatCurrency(sellModal.targetCompany.sharePrice)}</span>
                        </p>

                        <div className="mb-4">
                            <label className="label">Quantity to Sell</label>
                            <input
                                type="number"
                                className="input"
                                value={sellQuantity}
                                onChange={e => setSellQuantity(e.target.value)}
                                max={sellModal.shares}
                                min="1"
                                placeholder="Number of shares"
                                autoFocus
                            />
                        </div>

                        {sellQuantity && parseInt(sellQuantity) > 0 && (
                            <div className="card mb-4 p-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">Total Proceeds</span>
                                    <span className="font-mono font-bold text-accent-green">{formatCurrency(sellTotal)}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setSellModal(null)} className="btn btn-outline">Cancel</button>
                            <button
                                onClick={handleSell}
                                disabled={selling || !sellQuantity || parseInt(sellQuantity) <= 0 || parseInt(sellQuantity) > sellModal.shares}
                                className="btn btn-danger"
                            >
                                {selling ? 'Processing...' : 'List Order'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
