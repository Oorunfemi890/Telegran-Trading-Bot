// =============================================
// FILE: src/helpers/format.helper.ts
// =============================================

export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  decimals: number = 2
): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

export const formatNumber = (
  num: number,
  decimals: number = 2
): string => {
  return num.toFixed(decimals);
};

export const formatPercentage = (
  value: number,
  decimals: number = 2
): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatPips = (pips: number): string => {
  return `${pips.toFixed(1)} pips`;
};

export const formatLotSize = (lotSize: number): string => {
  return lotSize.toFixed(2);
};

export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

export const sanitizeSymbol = (symbol: string): string => {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
};