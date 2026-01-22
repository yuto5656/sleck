import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Register service worker with auto-reload on update
registerSW({
  onNeedRefresh() {
    // New content is available, reload to apply
    if (confirm('新しいバージョンが利用可能です。更新しますか？')) {
      window.location.reload()
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
