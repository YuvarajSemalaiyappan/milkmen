import { type ReactNode } from 'react'
import { Header, type HeaderProps } from './Header'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { ToastContainer } from '@/components/common'

export interface AppShellProps extends HeaderProps {
  children: ReactNode
  hideNav?: boolean
  fullHeight?: boolean
}

export function AppShell({
  children,
  hideNav = false,
  fullHeight = false,
  ...headerProps
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar for desktop */}
      {!hideNav && <Sidebar />}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <Header showMenu={!hideNav} {...headerProps} />

        {/* Page content */}
        <main
          className={`flex-1 ${fullHeight ? '' : 'pb-20 md:pb-4'}`}
        >
          {children}
        </main>

        {/* Bottom navigation for mobile */}
        {!hideNav && <BottomNav />}
      </div>

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  )
}
