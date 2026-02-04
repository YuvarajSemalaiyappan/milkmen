// Calculate total amount from quantity and rate
export function calculateTotal(quantity: number, ratePerLiter: number): number {
  return Math.round(quantity * ratePerLiter * 100) / 100
}

// Calculate balance for farmer (we owe them)
export function calculateFarmerBalance(
  totalCollectionAmount: number,
  totalPaidAmount: number
): number {
  return totalCollectionAmount - totalPaidAmount
}

// Calculate balance for customer (they owe us)
export function calculateCustomerBalance(
  totalDeliveryAmount: number,
  totalReceivedAmount: number
): number {
  return totalDeliveryAmount - totalReceivedAmount
}

// Calculate profit/loss
export function calculateProfit(
  totalSalesAmount: number,
  totalCollectionAmount: number
): number {
  return totalSalesAmount - totalCollectionAmount
}

// Calculate average rate from transactions
export function calculateAverageRate(
  transactions: { quantity: number; totalAmount: number }[]
): number {
  const totalQuantity = transactions.reduce((sum, t) => sum + t.quantity, 0)
  const totalAmount = transactions.reduce((sum, t) => sum + t.totalAmount, 0)
  if (totalQuantity === 0) return 0
  return Math.round((totalAmount / totalQuantity) * 100) / 100
}

// Sum quantities
export function sumQuantities(items: { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

// Sum amounts
export function sumAmounts(items: { totalAmount: number }[]): number {
  return items.reduce((sum, item) => sum + item.totalAmount, 0)
}

// Round to 2 decimal places
export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

// Check if amount is positive
export function isPositive(amount: number): boolean {
  return amount > 0
}

// Check if amount is negative
export function isNegative(amount: number): boolean {
  return amount < 0
}

// Get balance type for display
export function getBalanceType(amount: number): 'positive' | 'negative' | 'neutral' {
  if (amount > 0) return 'positive'
  if (amount < 0) return 'negative'
  return 'neutral'
}
