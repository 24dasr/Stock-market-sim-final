import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import MyCompany from './pages/MyCompany';
import Market from './pages/Market';
import Portfolio from './pages/Portfolio';
import History from './pages/History';
import Leaderboard from './pages/Leaderboard';
import CompanyDetail from './pages/CompanyDetail';
import StatsDashboard from './pages/StatsDashboard';
import { useMarket } from './context/MarketContext';

function ProtectedRoute({ children, adminOnly = false, statsOnly = false, participantOnly = false }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    
    // Administrative roles (ADMIN and STATS) are generally allowed everywhere except specific restrictions
    const isAdministrative = ['ADMIN', 'STATS'].includes(user.role);

    if (adminOnly && !isAdministrative) return <Navigate to="/market" replace />;
    if (statsOnly && !isAdministrative) return <Navigate to="/market" replace />;
    
    // Admins and Stats can view participant pages if they want, but we might want to redirect them to their primary dashboard if they land on /dashboard
    if (participantOnly && !isAdministrative && user.role !== 'PARTICIPANT') {
        return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/stats-dashboard'} replace />;
    }
    
    return children;
}

function App() {
    const { user } = useAuth();
    const { toasts } = useMarket();

    return (
        <>
            <Routes>
                <Route path="/login" element={user ? <Navigate to={user.role === 'ADMIN' ? '/admin' : (user.role === 'STATS' ? '/stats-dashboard' : '/dashboard')} replace /> : <Login />} />
                <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    {/* Admin Routes */}
                    <Route path="admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
                    {/* Participant Routes */}
                    <Route path="dashboard" element={<ProtectedRoute participantOnly><MyCompany /></ProtectedRoute>} />
                    <Route path="market" element={<ProtectedRoute><Market /></ProtectedRoute>} />
                    <Route path="portfolio" element={<ProtectedRoute participantOnly><Portfolio /></ProtectedRoute>} />
                    <Route path="history" element={<ProtectedRoute participantOnly><History /></ProtectedRoute>} />
                    <Route path="leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
                    <Route path="company/:id" element={<ProtectedRoute><CompanyDetail /></ProtectedRoute>} />
                    <Route index element={<Navigate to={user?.role === 'ADMIN' ? '/admin' : (user?.role === 'STATS' ? '/stats-dashboard' : '/dashboard')} replace />} />
                </Route>
                <Route path="/stats-dashboard" element={<ProtectedRoute statsOnly><StatsDashboard /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
                        {toast.message}
                    </div>
                ))}
            </div>
        </>
    );
}

export default App;
