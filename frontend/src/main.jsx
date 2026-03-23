import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0d1f35',
            color: '#e2e8f0',
            border: '1px solid #1a3a5c',
            borderRadius: '10px',
            fontSize: '0.85rem',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0d1f35' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#0d1f35' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
