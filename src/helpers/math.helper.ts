// =============================================
// FILE: src/helpers/math.helper.ts
// =============================================

export const calculatePipDistance = (
  price1: number,
  price2: number,
  pipSize: number = 0.0001
): number => {
  return Math.abs(price1 - price2) / pipSize;
};

export const calculateLotSize = (
  riskAmount: number,
  stopLossPips: number,
  pipValue: number,
  contractSize: number = 100000
): number => {
  if (stopLossPips === 0) return 0;
  return riskAmount / (stopLossPips * pipValue * contractSize);
};

export const roundToLotStep = (
  lotSize: number,
  lotStep: number = 0.01,
  minLot: number = 0.01,
  maxLot: number = 100
): number => {
  let rounded = Math.round(lotSize / lotStep) * lotStep;
  rounded = Math.max(minLot, Math.min(maxLot, rounded));
  return parseFloat(rounded.toFixed(2));
};

export const calculateAveragePrice = (prices: number[]): number => {
  if (prices.length === 0) return 0;
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return sum / prices.length;
};

export const distributePositionsAcrossRange = (
  entryMin: number,
  entryMax: number,
  totalPositions: number,
  immediateEntries: number = 2
): number[] => {
  const positions: number[] = [];
  
  // Add immediate entries at max price (for buys) or min price (for sells)
  for (let i = 0; i < immediateEntries; i++) {
    positions.push(entryMax);
  }
  
  // Distribute remaining positions
  const remainingPositions = totalPositions - immediateEntries;
  if (remainingPositions > 0) {
    const step = (entryMax - entryMin) / (remainingPositions + 1);
    
    for (let i = 1; i <= remainingPositions; i++) {
      positions.push(entryMax - (step * i));
    }
  }
  
  return positions.map(p => parseFloat(p.toFixed(5)));
};

export const calculateProfit = (
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  pipValue: number,
  pipSize: number,
  direction: 'buy' | 'sell'
): number => {
  const pips = direction === 'buy'
    ? (exitPrice - entryPrice) / pipSize
    : (entryPrice - exitPrice) / pipSize;
    
  return pips * lotSize * pipValue;
};

export const calculateProfitFactor = (
  grossProfit: number,
  grossLoss: number
): number => {
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / Math.abs(grossLoss);
};

export const calculateWinRate = (
  winningTrades: number,
  totalTrades: number
): number => {
  if (totalTrades === 0) return 0;
  return (winningTrades / totalTrades) * 100;
};
export const calculateExpectedValue = (
  averageWin: number,
  averageLoss: number,
  winRate: number
): number => {
  return (averageWin * winRate) - (averageLoss * (1 - winRate));
};