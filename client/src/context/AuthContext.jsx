import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const stored = localStorage.getItem('stxsim_user');
        return stored ? JSON.parse(stored) : null;
    });
    const [loading, setLoading] = useState(false);

    const login = async (username, password) => {
        setLoading(true);
        try {
            const data = await api.login(username, password);
            localStorage.setItem('stxsim_token', data.token);
            localStorage.setItem('stxsim_user', JSON.stringify(data.user));
            setUser(data.user);
            return data.user;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('stxsim_token');
        localStorage.removeItem('stxsim_user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'ADMIN' }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
