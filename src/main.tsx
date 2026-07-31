import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { captureRedirect } from './twitch/auth'
import './styles.css'

// Consume the OAuth fragment before the app renders, so the URL is clean and
// the token is already in place on first paint.
const authError = captureRedirect()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App authError={authError} />
  </StrictMode>,
)
