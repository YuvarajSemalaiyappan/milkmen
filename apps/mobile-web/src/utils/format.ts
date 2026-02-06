// Currency formatting
export function formatCurrency(amount: number): string {
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`
}

// Quantity formatting (liters)
export function formatQuantity(liters: number): string {
  return `${Number(liters).toFixed(1)} L`
}

// Rate formatting
export function formatRate(rate: number): string {
  return `₹${Number(rate).toFixed(2)}/L`
}

// Date formatting
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

// Time formatting
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Relative date (today, yesterday, etc.)
export function formatRelativeDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (isSameDay(d, today)) {
    return 'Today'
  } else if (isSameDay(d, yesterday)) {
    return 'Yesterday'
  } else {
    return formatDate(d)
  }
}

// Check if two dates are the same day
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

// Get today's date as YYYY-MM-DD (local time)
export function getToday(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Get yesterday's date as YYYY-MM-DD (local time)
export function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Format phone number
export function formatPhone(phone: string): string {
  // Format as: XXXXX XXXXX
  const clean = phone.replace(/\D/g, '')
  if (clean.length === 10) {
    return `${clean.slice(0, 5)} ${clean.slice(5)}`
  }
  return phone
}

// Parse phone number (remove formatting)
export function parsePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3)}...`
}

// Capitalize first letter
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}
