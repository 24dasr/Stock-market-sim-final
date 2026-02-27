/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                base: '#080b12',
                surface: '#0e1420',
                elevated: '#151d2e',
                border: '#1e2d45',
                'text-primary': '#e8edf5',
                'text-secondary': '#7a8fa6',
                'accent-green': '#00e676',
                'accent-red': '#ff1744',
                'accent-gold': '#ffc107',
                'accent-blue': '#2979ff',
            },
            fontFamily: {
                mono: ['IBM Plex Mono', 'monospace'],
                heading: ['DM Sans', 'sans-serif'],
                body: ['Inter', 'sans-serif'],
            },
            animation: {
                'flash-green': 'flashGreen 600ms ease-out',
                'flash-red': 'flashRed 600ms ease-out',
                'pulse-dot': 'pulseDot 1.5s ease-in-out infinite',
                'slide-down': 'slideDown 300ms ease-out',
                'slide-in-right': 'slideInRight 300ms ease-out',
                'fade-in': 'fadeIn 150ms ease-out',
                'shimmer': 'shimmer 1.5s infinite',
                'count-up': 'countUp 300ms ease-out',
            },
            keyframes: {
                flashGreen: {
                    '0%': { backgroundColor: 'rgba(0, 230, 118, 0.3)' },
                    '100%': { backgroundColor: 'transparent' },
                },
                flashRed: {
                    '0%': { backgroundColor: 'rgba(255, 23, 68, 0.3)' },
                    '100%': { backgroundColor: 'transparent' },
                },
                pulseDot: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.3' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                countUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
}
