import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, loading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const user = await login(username, password);
            if (user.role === 'ADMIN') navigate('/admin');
            else if (user.role === 'STATS') navigate('/stats-dashboard');
            else navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen bg-base flex items-center justify-center relative overflow-hidden">
            {/* Animated Grid Background */}
            <div className="login-grid" />

            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/5 via-transparent to-accent-gold/5" />

            {/* Login Card */}
            <div className="glass-card p-8 w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="font-heading font-bold text-3xl tracking-tight mb-2">
                        <span className="text-accent-blue">STX</span>
                        <span className="text-text-primary">SIM</span>
                    </h1>
                    <p className="text-text-secondary text-sm font-body">Stock Market Simulator</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 rounded-md bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm font-heading animate-fade-in">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="label">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="input"
                            placeholder="Enter username"
                            autoFocus
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="input"
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !username || !password}
                        className="btn btn-primary w-full py-3 text-sm font-heading font-semibold"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Signing in...
                            </span>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-8 text-center">
                    <p className="text-text-secondary text-xs font-mono">
                        Closed Market • Real-Time Trading
                    </p>
                </div>
            </div>
        </div>
    );
}
