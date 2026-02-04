import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface TableProps {
  children: ReactNode
  className?: string
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-left">
        {children}
      </table>
    </div>
  )
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      {children}
    </thead>
  )
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-200">{children}</tbody>
}

export function TableRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={clsx('hover:bg-gray-50 transition-colors', className)}>
      {children}
    </tr>
  )
}

export function TableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={clsx(
        'px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider',
        className
      )}
    >
      {children}
    </th>
  )
}

interface TableCellProps {
  children: ReactNode
  className?: string
  colSpan?: number
}

export function TableCell({ children, className, colSpan }: TableCellProps) {
  return (
    <td className={clsx('px-4 py-4 text-sm text-gray-900', className)} colSpan={colSpan}>
      {children}
    </td>
  )
}
