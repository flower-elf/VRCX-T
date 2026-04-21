import { createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/styles/globals.css';
import '@/lib/dayjs.js';
import { App } from './app/App.jsx';

if (import.meta.env.DEV) {
    const script = document.createElement('script');
    script.src = 'http://localhost:8097';
    document.head.append(script);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Missing #root mount node');
}

createRoot(rootElement).render(
    createElement(StrictMode, null, createElement(App))
);
