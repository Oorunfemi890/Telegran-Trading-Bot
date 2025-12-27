// FILE: src/services/risk.calculator.ts
// =============================================
import { SymbolSpecification } from '../types';
import { calculatePipDistance, roundToLotStep } from '../helpers/math.helper';

export interface RiskCalculationInput {
  accountBalance: number;
  riskPercentage: number;
  positionsPerTrade: number;
  entryPrice: number;
  stopLoss: number;
  symbol: string;
}

export interface RiskCalculationResult {
  success: boolean;
  lotSizePerPosition: number;
  totalRiskAmount: number;
  riskPerPosition: number;
  stopLossPips: number;
  error?: string;
}

export class RiskCalculator {
  // Symbol specifications database
  private symbolSpecs: Map<string, SymbolSpecification> = new Map();

  constructor() {
    this.initializeSymbolSpecs();
  }

  /**
   * Initialize symbol specifications
   */
  private initializeSymbolSpecs() {
    // Forex Major Pairs
    this.symbolSpecs.set('EURUSD', {
      symbol: 'EURUSD',
      pipSize: 0.0001,
      pipValue: 10, // per 1.0 lot
      contractSize: 100000,
      minLotSize: 0.01,
      maxLotSize: 100,
      lotStep: 0.01,
      marginRequired: 100, // per 1.0 lot at 1:100 leverage
    });

    this.symbolSpecs.set('GBPUSD', {
      symbol: 'GBPUSD',
      pipSize: 0.0001,
      pipValue: 10,
      contractSize: 100000,
      minLotSize: 0.01,
      maxLotSize: 100,
      lotStep: 0.01,
      marginRequired: 100,
    });

    this.symbolSpecs.set('USDJPY', {
      symbol: 'USDJPY',
      pipSize: 0.01,
      pipValue: 10,
      contractSize: 100000,
      minLotSize: 0.01,
      maxLotSize: 100,
      lotStep: 0.01,
      marginRequired: 100,
    });

    // Gold
    this.symbolSpecs.set('XAUUSD', {
      symbol: 'XAUUSD',
      pipSize: 0.01,
      pipValue: 1, // $1 per 0.01 lot per pip
      contractSize: 100, // troy ounces
      minLotSize: 0.01,
      maxLotSize: 100,
      lotStep: 0.01,
      marginRequired: 1000, // higher margin for gold
    });

    // Silver
    this.symbolSpecs.set('XAGUSD', {
      symbol: 'XAGUSD',
      pipSize: 0.001,
      pipValue: 0.5,
      contractSize: 5000,
      minLotSize: 0.01,
      maxLotSize: 100,
      lotStep: 0.01,
      marginRequired: 500,
    });

    // Bitcoin
    this.symbolSpecs.set('BTCUSD', {
      symbol: 'BTCUSD',
      pipSize: 1,
      pipValue: 1,
      contractSize: 1,
      minLotSize: 0.01,
      maxLotSize: 10,
      lotStep: 0.01,
      marginRequired: 5000,
    });

    // US30 (Dow Jones)
    this.symbolSpecs.set('US30', {
      symbol: 'US30',
      pipSize: 1,
      pipValue: 1,
      contractSize: 1,
      minLotSize: 0.01,
      maxLotSize: 100,
      lotStep: 0.01,
      marginRequired: 100,
    });

    // NAS100 (Nasdaq)
    this.symbolSpecs.set('NAS100', {
      symbol: 'NAS100',
      pipSize: 1,
      pipValue: 1,
      contractSize: 1,
      minLotSize: 0.01,
      maxLotSize: 100,
      lotStep: 0.01,
      marginRequired: 100,
    });

    // Add more symbols as needed
  }

  /**
   * Main calculation function
   */
  calculateLotSize(input: RiskCalculationInput): RiskCalculationResult {
    try {
      // Get symbol specifications
      const spec = this.getSymbolSpec(input.symbol);
      if (!spec) {
        return {
          success: false,
          lotSizePerPosition: 0,
          totalRiskAmount: 0,
          riskPerPosition: 0,
          stopLossPips: 0,
          error: `Symbol ${input.symbol} not supported`,
        };
      }

      // Calculate total risk amount
      const totalRiskAmount = (input.accountBalance * input.riskPercentage) / 100;

      // Calculate risk per position
      const riskPerPosition = totalRiskAmount / input.positionsPerTrade;

      // Calculate stop loss distance in pips
      const stopLossPips = calculatePipDistance(
        input.entryPrice,
        input.stopLoss,
        spec.pipSize
      );

      if (stopLossPips <= 0) {
        return {
          success: false,
          lotSizePerPosition: 0,
          totalRiskAmount,
          riskPerPosition,
          stopLossPips: 0,
          error: 'Invalid stop loss distance',
        };
      }

      // Calculate raw lot size
      // Formula: Risk / (Stop Loss Pips * Pip Value per Lot)
      const rawLotSize = riskPerPosition / (stopLossPips * spec.pipValue);

      // Round to broker's lot step and apply limits
      const lotSize = roundToLotStep(
        rawLotSize,
        spec.lotStep,
        spec.minLotSize,
        spec.maxLotSize
      );

      console.log('💰 Risk Calculation:');
      console.log(`   Account Balance: $${input.accountBalance.toFixed(2)}`);
      console.log(`   Risk %: ${input.riskPercentage}%`);
      console.log(`   Total Risk: $${totalRiskAmount.toFixed(2)}`);
      console.log(`   Risk per Position: $${riskPerPosition.toFixed(2)}`);
      console.log(`   Stop Loss Distance: ${stopLossPips.toFixed(1)} pips`);
      console.log(`   Raw Lot Size: ${rawLotSize.toFixed(4)}`);
      console.log(`   Final Lot Size: ${lotSize.toFixed(2)}`);

      return {
        success: true,
        lotSizePerPosition: lotSize,
        totalRiskAmount,
        riskPerPosition,
        stopLossPips,
      };
    } catch (error: any) {
      return {
        success: false,
        lotSizePerPosition: 0,
        totalRiskAmount: 0,
        riskPerPosition: 0,
        stopLossPips: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get symbol specification
   */
  private getSymbolSpec(symbol: string): SymbolSpecification | undefined {
    return this.symbolSpecs.get(symbol.toUpperCase());
  }

  /**
   * Add custom symbol specification
   */
  addSymbolSpec(spec: SymbolSpecification) {
    this.symbolSpecs.set(spec.symbol.toUpperCase(), spec);
  }

  /**
   * Calculate required margin for positions
   */
  calculateMarginRequired(
    symbol: string,
    lotSize: number,
    numberOfPositions: number
  ): number {
    const spec = this.getSymbolSpec(symbol);
    if (!spec) return 0;

    return spec.marginRequired * lotSize * numberOfPositions;
  }

  /**
   * Validate if user has enough margin
   */
  validateMargin(
    symbol: string,
    lotSize: number,
    numberOfPositions: number,
    availableMargin: number
  ): { valid: boolean; required: number; available: number } {
    const required = this.calculateMarginRequired(symbol, lotSize, numberOfPositions);
    
    return {
      valid: availableMargin >= required * 1.1, // 10% safety buffer
      required,
      available: availableMargin,
    };
  }
}