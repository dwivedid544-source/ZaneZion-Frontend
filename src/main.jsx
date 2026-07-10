import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'

// Redirect session-specific localStorage keys to sessionStorage to support multi-tab logins
const sessionKeys = new Set(['token', 'user', 'userRole', 'userEmail', 'menuPermissions']);
const originalGetItem = localStorage.getItem.bind(localStorage);
const originalSetItem = localStorage.setItem.bind(localStorage);
const originalRemoveItem = localStorage.removeItem.bind(localStorage);

localStorage.getItem = function (key) {
  if (sessionKeys.has(key)) {
    return sessionStorage.getItem(key);
  }
  return originalGetItem(key);
};

localStorage.setItem = function (key, value) {
  if (sessionKeys.has(key)) {
    return sessionStorage.setItem(key, value);
  }
  return originalSetItem(key, value);
};

localStorage.removeItem = function (key) {
  if (sessionKeys.has(key)) {
    return sessionStorage.removeItem(key);
  }
  return originalRemoveItem(key);
};


const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
