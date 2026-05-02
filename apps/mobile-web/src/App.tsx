import { AppRoutes } from './router'
import { useTheme } from './hooks'
import { ErrorBoundary } from './components/common'

// Import i18n to initialize it
import './i18n'

function App() {
  // Initialize theme on app load
  useTheme()

  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  )
}

export default App
