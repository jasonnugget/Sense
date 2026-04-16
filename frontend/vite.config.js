import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
export default defineConfig({
    plugins: [react()],
    server: {
        // Proxy API requests to the FastAPI backend during development.
        // Any request starting with /api gets forwarded to localhost:8000.
        // This means the frontend can call fetch('/api/health') and it
        // reaches the backend without CORS issues.
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/health': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
            '/version': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            },
        },
    },
});
