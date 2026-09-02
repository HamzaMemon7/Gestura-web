import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'

/**
 * StrictMode is intentionally omitted: it double-invokes effects in development,
 * which tears down and re-opens the MediaPipe camera mid-initialisation and
 * leaves the webcam stream in a broken state.
 */
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
)
