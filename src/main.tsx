import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyCameraPolyfills } from './lib/cameraPolyfills'

applyCameraPolyfills()

createRoot(document.getElementById('root')!).render(<App />)
