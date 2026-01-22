import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Register service worker with auto-reload on update
const updateSW = registerSW({
  onNeedRefresh() {
    // New content is available, prompt user to update
    if (confirm('新しいバージョンが利用可能です。更新しますか？')) {
      updateSW(true) // true = force reload after update
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use')
  },
  onRegisteredSW(swUrl, registration) {
    // Check for updates every 1 hour
    if (registration) {
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    }
    console.log('Service Worker registered:', swUrl)
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
