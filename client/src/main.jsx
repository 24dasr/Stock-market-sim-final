import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { MarketProvider } from './context/MarketContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <SocketProvider>
                    <MarketProvider>
                        <App />
                    </MarketProvider>
                </SocketProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
