import { Menu, Bell } from 'lucide-react'
import { useAuthStore, useAppStore } from '@/store'

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  const user = useAuthStore((state) => state.user)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-4 lg:px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        {title && (
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-lg hover:bg-gray-100 relative">
          <Bell className="w-5 h-5 text-gray-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">
            {user?.name || 'Admin'}
          </span>
        </div>
      </div>
    </header>
  )
}
