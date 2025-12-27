// FILE: src/engines/parser/signal.parser.ts
// =============================================
import { TradeDirection, ParsedSignal } from '../../types';

export interface ParserResult {
  success: boolean;
  signal?: ParsedSignal;
  error?: string;
  confidence: number; // 0-100 score of how confident the parser is
}

export class SignalParser {
  /**
   * Main parsing function - tries multiple strategies
   */
  parse(messageText: string): ParserResult {
    // Try structured format first (most common)
    let result = this.parseStructuredFormat(messageText);
    if (result.confidence > 70) return result;

    // Try inline format
    result = this.parseInlineFormat(messageText);
    if (result.confidence > 70) return result;

    // Try casual format
    result = this.parseCasualFormat(messageText);
    if (result.confidence > 50) return result;

    return {
      success: false,
      error: 'Could not parse signal from message',
      confidence: 0,
    };
  }

  /**
   * Parse structured format:
   * BUY XAUUSD
   * Entry: 2000-1995
   * SL: 1990
   * TP1: 2010
   * TP2: 2020
   * TP3: 2030
   */
  private parseStructuredFormat(text: string): ParserResult {
    try {
      const lines = text.split('\n').map(l => l.trim());
      
      // Extract direction and symbol from first line
      const firstLine = lines[0].toUpperCase();
      const direction = this.extractDirection(firstLine);
      const symbol = this.extractSymbol(firstLine);

      if (!direction || !symbol) {
        return { success: false, confidence: 0 };
      }

      // Extract entry range
      const entryLine = lines.find(l => 
        l.toLowerCase().includes('entry') || 
        l.toLowerCase().includes('buy') ||
        l.toLowerCase().includes('sell')
      );
      
      const entryRange = entryLine ? this.extractEntryRange(entryLine) : null;
      if (!entryRange) {
        return { success: false, confidence: 0 };
      }

      // Extract stop loss
      const slLine = lines.find(l => 
        l.toLowerCase().includes('sl') || 
        l.toLowerCase().includes('stop')
      );
      
      const stopLoss = slLine ? this.extractPrice(slLine) : null;
      if (!stopLoss) {
        return { success: false, confidence: 0 };
      }

      // Extract take profits
      const takeProfits = this.extractTakeProfits(lines);
      if (takeProfits.length === 0) {
        return { success: false, confidence: 0 };
      }

      // Validate the signal
      const isValid = this.validateSignal(
        direction,
        entryRange,
        stopLoss,
        takeProfits
      );

      if (!isValid) {
        return { 
          success: false, 
          error: 'Signal validation failed',
          confidence: 0 
        };
      }

      return {
        success: true,
        signal: {
          symbol,
          direction,
          entryMin: entryRange.min,
          entryMax: entryRange.max,
          stopLoss,
          takeProfits,
        },
        confidence: 95,
      };
    } catch (error) {
      return { success: false, confidence: 0 };
    }
  }

  /**
   * Parse inline format:
   * BUY XAUUSD @ 2000-1995 | SL: 1990 | TP1: 2010 | TP2: 2020 | TP3: 2030
   */
  private parseInlineFormat(text: string): ParserResult {
    try {
      const textUpper = text.toUpperCase();
      
      const direction = this.extractDirection(textUpper);
      const symbol = this.extractSymbol(textUpper);

      if (!direction || !symbol) {
        return { success: false, confidence: 0 };
      }

      // Split by pipe or comma
      const parts = text.split(/[|,]/).map(p => p.trim());
      
      const entryPart = parts.find(p => 
        p.includes('@') || 
        p.toLowerCase().includes('entry')
      );
      
      const entryRange = entryPart ? this.extractEntryRange(entryPart) : null;
      if (!entryRange) {
        return { success: false, confidence: 0 };
      }

      const slPart = parts.find(p => p.toLowerCase().includes('sl'));
      const stopLoss = slPart ? this.extractPrice(slPart) : null;
      if (!stopLoss) {
        return { success: false, confidence: 0 };
      }

      const takeProfits = this.extractTakeProfits(parts);
      if (takeProfits.length === 0) {
        return { success: false, confidence: 0 };
      }

      const isValid = this.validateSignal(
        direction,
        entryRange,
        stopLoss,
        takeProfits
      );

      if (!isValid) {
        return { 
          success: false, 
          error: 'Signal validation failed',
          confidence: 0 
        };
      }

      return {
        success: true,
        signal: {
          symbol,
          direction,
          entryMin: entryRange.min,
          entryMax: entryRange.max,
          stopLoss,
          takeProfits,
        },
        confidence: 90,
      };
    } catch (error) {
      return { success: false, confidence: 0 };
    }
  }

  /**
   * Parse casual format:
   * "Taking a buy on gold here at 2000, stop at 1990, targets 2010, 2020, 2030"
   */
  private parseCasualFormat(text: string): ParserResult {
    try {
      const direction = this.extractDirection(text);
      const symbol = this.extractSymbol(text);

      if (!direction || !symbol) {
        return { success: false, confidence: 0 };
      }

      // Look for entry price after "at" or "@"
      const entryMatch = text.match(/(?:at|@)\s*([\d.]+)(?:\s*-\s*([\d.]+))?/i);
      if (!entryMatch) {
        return { success: false, confidence: 0 };
      }

      const entryRange = {
        min: parseFloat(entryMatch[2] || entryMatch[1]),
        max: parseFloat(entryMatch[1]),
      };

      // Look for stop loss
      const slMatch = text.match(/(?:stop|sl)(?:\s+at)?\s*([\d.]+)/i);
      if (!slMatch) {
        return { success: false, confidence: 0 };
      }
      const stopLoss = parseFloat(slMatch[1]);

      // Look for targets
      const targetsMatch = text.match(/(?:target|tp|take profit)s?\s*([\d.,\s]+)/i);
      if (!targetsMatch) {
        return { success: false, confidence: 0 };
      }

      const targetPrices = targetsMatch[1]
        .split(/[,\s]+/)
        .filter(p => p && !isNaN(parseFloat(p)))
        .map(p => parseFloat(p));

      const takeProfits = targetPrices.map((price, index) => ({
        level: index + 1,
        price,
      }));

      if (takeProfits.length === 0) {
        return { success: false, confidence: 0 };
      }

      const isValid = this.validateSignal(
        direction,
        entryRange,
        stopLoss,
        takeProfits
      );

      if (!isValid) {
        return { 
          success: false, 
          error: 'Signal validation failed',
          confidence: 0 
        };
      }

      return {
        success: true,
        signal: {
          symbol,
          direction,
          entryMin: entryRange.min,
          entryMax: entryRange.max,
          stopLoss,
          takeProfits,
        },
        confidence: 70,
      };
    } catch (error) {
      return { success: false, confidence: 0 };
    }
  }

  /**
   * Extract trade direction from text
   */
  private extractDirection(text: string): TradeDirection | null {
    const normalized = text.toUpperCase();
    
    if (normalized.includes('BUY') || normalized.includes('LONG')) {
      return TradeDirection.BUY;
    }
    
    if (normalized.includes('SELL') || normalized.includes('SHORT')) {
      return TradeDirection.SELL;
    }
    
    return null;
  }

  /**
   * Extract symbol from text
   */
  private extractSymbol(text: string): string | null {
    const normalized = text.toUpperCase();
    
    // Common forex pairs
    const forexPairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
      'EURJPY', 'GBPJPY', 'EURGBP', 'AUDJPY', 'EURAUD', 'EURCHF', 'AUDNZD',
    ];

    // Gold
    if (normalized.includes('XAUUSD') || normalized.includes('GOLD')) {
      return 'XAUUSD';
    }

    // Silver
    if (normalized.includes('XAGUSD') || normalized.includes('SILVER')) {
      return 'XAGUSD';
    }

    // Oil
    if (normalized.includes('USOIL') || normalized.includes('CRUDE')) {
      return 'USOIL';
    }

    // Bitcoin
    if (normalized.includes('BTCUSD') || normalized.includes('BITCOIN')) {
      return 'BTCUSD';
    }

    // Ethereum
    if (normalized.includes('ETHUSD') || normalized.includes('ETHEREUM')) {
      return 'ETHUSD';
    }

    // Indices
    if (normalized.includes('US30') || normalized.includes('DOW')) {
      return 'US30';
    }
    if (normalized.includes('NAS100') || normalized.includes('NASDAQ')) {
      return 'NAS100';
    }
    if (normalized.includes('SPX500') || normalized.includes('SP500') || normalized.includes('S&P')) {
      return 'SPX500';
    }

    // Check forex pairs
    for (const pair of forexPairs) {
      if (normalized.includes(pair)) {
        return pair;
      }
    }

    // Try to extract any 6-character uppercase sequence (likely a forex pair)
    const pairMatch = text.match(/[A-Z]{6}/);
    if (pairMatch) {
      return pairMatch[0];
    }

    return null;
  }

  /**
   * Extract entry price range from text
   */
  private extractEntryRange(text: string): { min: number; max: number } | null {
    // Try range format: 2000-1995 or 2000 - 1995
    const rangeMatch = text.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (rangeMatch) {
      const price1 = parseFloat(rangeMatch[1]);
      const price2 = parseFloat(rangeMatch[2]);
      return {
        min: Math.min(price1, price2),
        max: Math.max(price1, price2),
      };
    }

    // Try single price
    const singleMatch = text.match(/[\d.]+/);
    if (singleMatch) {
      const price = parseFloat(singleMatch[0]);
      // For single price, use same for min and max
      return { min: price, max: price };
    }

    return null;
  }

  /**
   * Extract single price from text
   */
  private extractPrice(text: string): number | null {
    const match = text.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  }

  /**
   * Extract take profit levels from text
   */
  private extractTakeProfits(textParts: string[]): Array<{ level: number; price: number }> {
    const takeProfits: Array<{ level: number; price: number }> = [];
    
    for (const part of textParts) {
      // Look for TP1, TP2, TP3, etc.
      const tpMatch = part.match(/tp(\d+)[\s:]*(\d+\.?\d*)/i);
      if (tpMatch) {
        takeProfits.push({
          level: parseInt(tpMatch[1]),
          price: parseFloat(tpMatch[2]),
        });
        continue;
      }

      // Look for "target 1", "target 2", etc.
      const targetMatch = part.match(/target\s*(\d+)[\s:]*(\d+\.?\d*)/i);
      if (targetMatch) {
        takeProfits.push({
          level: parseInt(targetMatch[1]),
          price: parseFloat(targetMatch[2]),
        });
      }
    }

    // Sort by level
    return takeProfits.sort((a, b) => a.level - b.level);
  }

  /**
   * Validate that the signal makes logical sense
   */
  private validateSignal(
    direction: TradeDirection,
    entryRange: { min: number; max: number },
    stopLoss: number,
    takeProfits: Array<{ level: number; price: number }>
  ): boolean {
    // Check entry range is valid
    if (entryRange.min > entryRange.max) {
      return false;
    }

    // Check all prices are positive
    if (entryRange.min <= 0 || stopLoss <= 0) {
      return false;
    }

    if (takeProfits.some(tp => tp.price <= 0)) {
      return false;
    }

    if (direction === TradeDirection.BUY) {
      // For BUY: SL should be below entry, TPs should be above entry
      if (stopLoss >= entryRange.min) {
        return false;
      }

      if (takeProfits.some(tp => tp.price <= entryRange.max)) {
        return false;
      }

      // TPs should be in ascending order
      for (let i = 1; i < takeProfits.length; i++) {
        if (takeProfits[i].price <= takeProfits[i - 1].price) {
          return false;
        }
      }
    } else {
      // For SELL: SL should be above entry, TPs should be below entry
      if (stopLoss <= entryRange.max) {
        return false;
      }

      if (takeProfits.some(tp => tp.price >= entryRange.min)) {
        return false;
      }

      // TPs should be in descending order
      for (let i = 1; i < takeProfits.length; i++) {
        if (takeProfits[i].price >= takeProfits[i - 1].price) {
          return false;
        }
      }
    }

    return true;
  }
}