import { useState, useCallback, memo, useEffect } from 'react';
import { useMarket } from '../context/MarketContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import StockHistoryChart from '../components/StockHistoryChart';

const PriceCell = memo(function PriceCell({ price, flash, formatCurrency }) {
    return (
        <td className={`num font-semibold text-accent-green ${flash === 'up' ? 'price-flash-up' : flash === 'down' ? 'price-flash-down' : ''}`}>
            {formatCurrency(price)}
        </td>
    );
});

export default function Market() {
    const { companies, marketOpen, priceFlashes, formatCurrency, addToast, refreshCompanies } = useMarket();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState('primary');

    // Primary market state
    const [buyModal, setBuyModal] = useState(null);
    const [buyQuantity, setBuyQuantity] = useState('');
    const [buying, setBuying] = useState(false);

    // Secondary market state
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [p2pBuyModal, setP2pBuyModal] = useState(null);
    const [p2pBuying, setP2pBuying] = useState(false);

    const [historyData, setHistoryData] = useState([]);

    useEffect(() => {
        loadHistory();
        const interval = setInterval(loadHistory, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadHistory = async () => {
        try {
            const data = await api.getHistory();
            setHistoryData(data);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    };

    const fetchOrders = async () => {
        try {
            setLoadingOrders(true);
            const data = await api.getSellOrders();
            setOrders(data.orders || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingOrders(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'secondary') {
            fetchOrders();
        }
    }, [activeTab]);

    const handleBuy = async () => {
        if (!buyModal || !buyQuantity || parseInt(buyQuantity) <= 0) return;
        setBuying(true);
        try {
            await api.buyShares(buyModal.id, parseInt(buyQuantity));
            addToast(`Bought ${buyQuantity} shares of ${buyModal.name}`, 'success');
            setBuyModal(null);
            setBuyQuantity('');
            await refreshCompanies();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setBuying(false);
        }
    };

    const handleP2PBuy = async () => {
        if (!p2pBuyModal) return;
        setP2pBuying(true);
        try {
            await api.buyP2P(p2pBuyModal.id);
            addToast(`Bought ${p2pBuyModal.shares} shares of ${p2pBuyModal.targetCompany.name} from ${p2pBuyModal.sellerCompany.name}`, 'success');
            setP2pBuyModal(null);
            fetchOrders();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setP2pBuying(false);
        }
    }

    const getLivePrice = (companyId, fallback) => companies.find(c => c.id === companyId)?.sharePrice || fallback;

    const totalCost = buyModal && buyQuantity ? parseInt(buyQuantity) * buyModal.sharePrice : 0;
    const p2pTotalCost = p2pBuyModal ? p2pBuyModal.shares * getLivePrice(p2pBuyModal.targetCompanyId, p2pBuyModal.targetCompany?.sharePrice || 0) : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Market Header */}
            <div className="card flex items-center justify-between">
                <div>
                    <h2 className="font-heading font-semibold text-lg text-text-primary">Live Market</h2>
                    <p className="text-text-secondary text-sm mt-1">{companies.length} companies listed</p>
                </div>
                <div className={`status-badge ${marketOpen ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                    <div className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-accent-green animate-pulse-dot' : 'bg-accent-red'}`} />
                    {marketOpen ? 'Market Open' : 'Market Closed'}
                </div>
            </div>

            {/* Stock History Chart */}
            <StockHistoryChart historyData={historyData} />

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
                <button
                    onClick={() => setActiveTab('primary')}
                    className={`px-4 py-2.5 text-sm font-heading font-medium transition-colors border-b-2 -mb-[1px] ${activeTab === 'primary' ? 'text-accent-gold border-accent-gold' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                >
                    🏢 Primary Market (IPO / Direct)
                </button>
                <button
                    onClick={() => setActiveTab('secondary')}
                    className={`px-4 py-2.5 text-sm font-heading font-medium transition-colors border-b-2 -mb-[1px] ${activeTab === 'secondary' ? 'text-accent-gold border-accent-gold' : 'text-text-secondary border-transparent hover:text-text-primary'}`}
                >
                    🤝 Secondary Market (P2P)
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'primary' && (
                companies.length === 0 ? (
                    <div className="card text-center py-16">
                        <div className="text-5xl mb-4">📊</div>
                        <p className="font-heading text-text-secondary text-lg">No companies listed yet</p>
                        <p className="text-text-secondary text-sm mt-1">The market opens soon — check back shortly</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Company</th>
                                    <th className="num">Stock Price</th>
                                    <th className="num">Available</th>
                                    <th className="num">Total Shares</th>
                                    <th>Status</th>
                                    {user?.role === 'PARTICIPANT' && <th>Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {companies.map(c => {
                                    const flash = priceFlashes[c.id];
                                    const canBuy = marketOpen && c.stockEnabled && c.sharesAvailable > 0 && c.id !== user?.companyId;
                                    return (
                                        <tr key={c.id}>
                                            <td className="font-heading font-medium text-text-primary">{c.name}</td>
                                            <PriceCell price={c.sharePrice} flash={flash} formatCurrency={formatCurrency} />
                                            <td className="num">{c.sharesAvailable.toLocaleString()}</td>
                                            <td className="num text-text-secondary">{c.totalShares.toLocaleString()}</td>
                                            <td>
                                                <span className={`status-badge text-[10px] ${c.stockEnabled ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}`}>
                                                    {c.stockEnabled ? 'Active' : 'Halted'}
                                                </span>
                                            </td>
                                            {user?.role === 'PARTICIPANT' && (
                                                <td>
                                                    <button
                                                        onClick={() => { setBuyModal(c); setBuyQuantity(''); }}
                                                        disabled={!canBuy}
                                                        className="btn btn-primary text-xs py-1 px-3"
                                                    >
                                                        Buy
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {activeTab === 'secondary' && (
                loadingOrders ? (
                    <div className="card text-center py-16">
                        <p className="text-text-secondary text-sm">Loading market listings...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="card text-center py-16">
                        <div className="text-5xl mb-4">🤝</div>
                        <p className="font-heading text-text-secondary text-lg">No active peer-to-peer listings</p>
                        <p className="text-text-secondary text-sm mt-1">Participants can list their owned shares for sale on the Portfolio tab.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Company</th>
                                    <th>Seller</th>
                                    <th className="num">Shares Offered</th>
                                    <th className="num">Current Price (per share)</th>
                                    <th className="num">Total Value</th>
                                    <th>Listed At</th>
                                    {user?.role === 'PARTICIPANT' && <th>Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(o => {
                                    const canBuy = marketOpen && o.sellerCompanyId !== user?.companyId && o.targetCompanyId !== user?.companyId;
                                    const livePrice = getLivePrice(o.targetCompanyId, o.targetCompany?.sharePrice || 0);
                                    return (
                                        <tr key={o.id}>
                                            <td className="font-heading font-medium text-text-primary">{o.targetCompany.name}</td>
                                            <td className="text-text-secondary">{o.sellerCompany.name}</td>
                                            <td className="num">{o.shares.toLocaleString()}</td>
                                            <td className="num text-accent-green">{formatCurrency(livePrice)}</td>
                                            <td className="num">{formatCurrency(o.shares * livePrice)}</td>
                                            <td className="num text-text-secondary text-sm">
                                                {new Date(o.createdAt).toLocaleTimeString()}
                                            </td>
                                            {user?.role === 'PARTICIPANT' && (
                                                <td>
                                                    <button
                                                        onClick={() => setP2pBuyModal(o)}
                                                        disabled={!canBuy}
                                                        className="btn btn-primary text-xs py-1 px-3"
                                                        title={!marketOpen ? 'Market Closed' : (!canBuy ? 'Cannot buy from/for own company' : '')}
                                                    >
                                                        Buy Order
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {/* Buy Modal */}
            {buyModal && (
                <div className="modal-backdrop" onClick={() => setBuyModal(null)}>
                    <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="font-heading font-semibold text-lg mb-1">Buy {buyModal.name}</h3>
                        <p className="text-text-secondary text-sm mb-4">
                            Current price: <span className="text-accent-green font-mono">{formatCurrency(buyModal.sharePrice)}</span> •
                            Available: <span className="font-mono">{buyModal.sharesAvailable.toLocaleString()}</span>
                        </p>

                        <div className="mb-4">
                            <label className="label">Quantity</label>
                            <input
                                type="number"
                                className="input"
                                value={buyQuantity}
                                onChange={e => setBuyQuantity(e.target.value)}
                                max={buyModal.sharesAvailable}
                                min="1"
                                placeholder="Number of shares"
                                autoFocus
                            />
                        </div>

                        {buyQuantity && parseInt(buyQuantity) > 0 && (
                            <div className="card mb-4 p-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-text-secondary">Total Cost</span>
                                    <span className="font-mono font-bold text-accent-green">{formatCurrency(totalCost)}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setBuyModal(null)} className="btn btn-outline">Cancel</button>
                            <button
                                onClick={handleBuy}
                                disabled={buying || !buyQuantity || parseInt(buyQuantity) <= 0}
                                className="btn btn-success"
                            >
                                {buying ? 'Processing...' : 'Confirm Buy'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* P2P Buy Modal */}
            {p2pBuyModal && (
                <div className="modal-backdrop" onClick={() => setP2pBuyModal(null)}>
                    <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
                        <h3 className="font-heading font-semibold text-lg mb-1">Buy P2P Listing</h3>
                        <p className="text-text-secondary text-sm mb-4">
                            You are buying <span className="font-mono text-text-primary">{p2pBuyModal.shares.toLocaleString()}</span> shares of <span className="text-text-primary font-semibold">{p2pBuyModal.targetCompany.name}</span> originally listed by <span className="text-text-primary">{p2pBuyModal.sellerCompany.name}</span>.
                        </p>

                        <div className="card mb-4 p-3 border border-border">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-text-secondary">Current Price</span>
                                <span className="font-mono text-text-primary">{formatCurrency(getLivePrice(p2pBuyModal.targetCompanyId, p2pBuyModal.targetCompany?.sharePrice || 0))}</span>
                            </div>
                            <div className="flex justify-between text-sm pt-2 border-t border-border">
                                <span className="font-medium text-text-secondary uppercase">Total Cost</span>
                                <span className="font-mono font-bold text-accent-green">{formatCurrency(p2pTotalCost)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setP2pBuyModal(null)} className="btn btn-outline">Cancel</button>
                            <button
                                onClick={handleP2PBuy}
                                disabled={p2pBuying}
                                className="btn btn-success"
                            >
                                {p2pBuying ? 'Processing...' : 'Confirm Buy'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
