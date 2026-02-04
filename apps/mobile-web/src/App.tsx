import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useTheme } from './hooks'

// Import i18n to initialize it
import './i18n'

function App() {
  // Initialize theme on app load
  useTheme()

  return <RouterProvider router={router} />
}

export default App
