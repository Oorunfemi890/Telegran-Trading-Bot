// FILE: src/engines/parser/signal.parser.ts (ROBUST - ALL FORMATS)
// =============================================
import { TradeDirection, ParsedSignal } from "../../types";

export interface ParserResult {
  success: boolean;
  signal?: ParsedSignal;
  error?: string;
  confidence: number;
}

export class SignalParser {
  /**
   * Main parsing function - tries multiple strategies
   */
  parse(messageText: string): ParserResult {
    // Normalize whitespace but preserve structure
    const normalized = messageText.trim();

    // Try each parser in order of confidence
    let result = this.parseFormatOne(normalized); // BUY EURUSD Entry: SL: TP1: TP2:
    if (result.confidence > 70) return result;

    result = this.parseFormatTwo(normalized); // BUY EURUSD @ 1.0850-1.0845 | SL: 1.0840
    if (result.confidence > 70) return result;

    result = this.parseFormatThree(normalized); // Gold Buy @4515-4511 Sl Break 4509 Tp Open
    if (result.confidence > 70) return result;

    result = this.parseFormatFour(normalized); // XAUUSD BUY SL: 4187 (no TP)
    if (result.confidence > 70) return result;

    result = this.parseFormatFive(normalized); // Gold Buy Now! 4212 - 4209 SL: 4206
    if (result.confidence > 70) return result;

    return {
      success: false,
      error: "Could not parse signal from message",
      confidence: 0,
    };
  }

  /**
   * Format 1: BUY EURUSD\nEntry: 1.0850-1.0845\nSL: 1.0840\nTP1: 1.0860
   */
  private parseFormatOne(text: string): ParserResult {
    try {
      // Extract direction and symbol from first line
      const firstLine = text.split("\n")[0];
      const direction = this.extractDirection(firstLine);
      const symbol = this.extractSymbol(firstLine);

      if (!direction || !symbol) {
        return { success: false, confidence: 0 };
      }

      // Find entry
      const entryMatch = text.match(
        /entry[\s:]*(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/i
      );
      if (!entryMatch) {
        return { success: false, confidence: 0 };
      }
      const entryRange = {
        min: Math.min(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
        max: Math.max(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
      };

      // Find SL
      const slMatch = text.match(/sl[\s:]*(\d+\.?\d*)/i);
      if (!slMatch) {
        return { success: false, confidence: 0 };
      }
      const stopLoss = parseFloat(slMatch[1]);

      // Find TPs
      const takeProfits = this.extractTakeProfits(text);

      // If no TPs found, this might have "TP OPEN"
      if (takeProfits.length === 0) {
        // Signal with open TP - we'll add our own
        return this.returnSignalWithDefault(
          symbol,
          direction,
          entryRange,
          stopLoss,
          85 // High confidence because we found all required fields
        );
      }

      const isValid = this.validateSignal(
        direction,
        entryRange,
        stopLoss,
        takeProfits
      );
      if (!isValid) {
        return { success: false, confidence: 0 };
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
    } catch (e) {
      return { success: false, confidence: 0 };
    }
  }

  /**
   * Format 2: BUY EURUSD @ 1.0850-1.0845 | SL: 1.0840 | TP1: 1.0860
   */
  private parseFormatTwo(text: string): ParserResult {
    try {
      const direction = this.extractDirection(text);
      const symbol = this.extractSymbol(text);

      if (!direction || !symbol) {
        return { success: false, confidence: 0 };
      }

      // Find @ entry
      const entryMatch = text.match(/@\s*(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/i);
      if (!entryMatch) {
        return { success: false, confidence: 0 };
      }
      const entryRange = {
        min: Math.min(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
        max: Math.max(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
      };

      // Find SL
      const slMatch = text.match(/sl[\s:]*(\d+\.?\d*)/i);
      if (!slMatch) {
        return { success: false, confidence: 0 };
      }
      const stopLoss = parseFloat(slMatch[1]);

      // Find TPs
      const takeProfits = this.extractTakeProfits(text);

      if (takeProfits.length === 0) {
        return this.returnSignalWithDefault(
          symbol,
          direction,
          entryRange,
          stopLoss,
          80
        );
      }

      const isValid = this.validateSignal(
        direction,
        entryRange,
        stopLoss,
        takeProfits
      );
      if (!isValid) {
        return { success: false, confidence: 0 };
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
    } catch (e) {
      return { success: false, confidence: 0 };
    }
  }

  /**
   * Format 3: Gold Buy @4515-4511 Sl Break 4509 Tp Open
   */
  private parseFormatThree(text: string): ParserResult {
    try {
      const direction = this.extractDirection(text);
      const symbol = this.extractSymbol(text);

      if (!direction || !symbol) {
        return { success: false, confidence: 0 };
      }

      // Find @ entry
      const entryMatch = text.match(/@\s*(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/i);
      if (!entryMatch) {
        return { success: false, confidence: 0 };
      }
      const entryRange = {
        min: Math.min(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
        max: Math.max(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
      };

      // Find SL - might say "Break" or other keywords
      const slMatch =
        text.match(/sl[\s:]*break[\s:]*(\d+\.?\d*)/i) ||
        text.match(/sl[\s:]*(\d+\.?\d*)/i);
      if (!slMatch) {
        return { success: false, confidence: 0 };
      }
      const stopLoss = parseFloat(slMatch[slMatch.length - 1]);

      // Find TPs or check for "OPEN"
      const takeProfits = this.extractTakeProfits(text);

      if (takeProfits.length === 0 || text.match(/tp[\s:]*open/i)) {
        return this.returnSignalWithDefault(
          symbol,
          direction,
          entryRange,
          stopLoss,
          85
        );
      }

      const isValid = this.validateSignal(
        direction,
        entryRange,
        stopLoss,
        takeProfits
      );
      if (!isValid) {
        return { success: false, confidence: 0 };
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
        confidence: 85,
      };
    } catch (e) {
      return { success: false, confidence: 0 };
    }
  }

  /**
   * Format 4: XAUUSD BUY SL: 4187.34 (missing entry and TP)
   */
  private parseFormatFour(text: string): ParserResult {
    try {
      const direction = this.extractDirection(text);
      const symbol = this.extractSymbol(text);

      if (!direction || !symbol) {
        return { success: false, confidence: 0 };
      }

      // Try to find entry - if not found, it's incomplete
      const entryMatch = text.match(
        /(?:@|entry|zone)[\s:]*(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/i
      );
      if (!entryMatch) {
        // Incomplete signal - skip
        return { success: false, confidence: 0 };
      }

      const entryRange = {
        min: Math.min(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
        max: Math.max(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
      };

      // Find SL
      const slMatch = text.match(/sl[\s:]*(\d+\.?\d*)/i);
      if (!slMatch) {
        return { success: false, confidence: 0 };
      }
      const stopLoss = parseFloat(slMatch[1]);

      // Use default TPs
      return this.returnSignalWithDefault(
        symbol,
        direction,
        entryRange,
        stopLoss,
        75
      );
    } catch (e) {
      return { success: false, confidence: 0 };
    }
  }

  /**
   * Format 5: Gold Buy Now! 4212 - 4209 SL: 4206 TP1: 4214
   */
  private parseFormatFive(text: string): ParserResult {
    try {
      const direction = this.extractDirection(text);
      const symbol = this.extractSymbol(text);

      if (!direction || !symbol) {
        return { success: false, confidence: 0 };
      }

      // Remove "now!", "!" etc
      const cleaned = text.replace(/now\s*[!:]*/gi, "");

      // Find entry - look for standalone numbers
      const entryMatch = cleaned.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
      if (!entryMatch) {
        return { success: false, confidence: 0 };
      }

      const entryRange = {
        min: Math.min(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
        max: Math.max(parseFloat(entryMatch[1]), parseFloat(entryMatch[2])),
      };

      // Find SL
      const slMatch = cleaned.match(/sl[\s:]*(\d+\.?\d*)/i);
      if (!slMatch) {
        return { success: false, confidence: 0 };
      }
      const stopLoss = parseFloat(slMatch[1]);

      // Find TPs
      const takeProfits = this.extractTakeProfits(cleaned);

      if (takeProfits.length === 0) {
        return this.returnSignalWithDefault(
          symbol,
          direction,
          entryRange,
          stopLoss,
          80
        );
      }

      const isValid = this.validateSignal(
        direction,
        entryRange,
        stopLoss,
        takeProfits
      );
      if (!isValid) {
        return { success: false, confidence: 0 };
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
        confidence: 85,
      };
    } catch (e) {
      return { success: false, confidence: 0 };
    }
  }

  /**
   * Return signal with default TPs when TP is open
   */
  private returnSignalWithDefault(
    symbol: string,
    direction: TradeDirection,
    entryRange: { min: number; max: number },
    stopLoss: number,
    confidence: number
  ): ParserResult {
    // Calculate default TPs based on risk/reward
    const riskPips = Math.abs(entryRange.max - stopLoss);
    const tp1 =
      direction === TradeDirection.BUY
        ? entryRange.max + riskPips
        : entryRange.min - riskPips;
    const tp2 =
      direction === TradeDirection.BUY
        ? entryRange.max + riskPips * 1.5
        : entryRange.min - riskPips * 1.5;
    const tp3 =
      direction === TradeDirection.BUY
        ? entryRange.max + riskPips * 2
        : entryRange.min - riskPips * 2;

    const takeProfits = [
      { level: 1, price: parseFloat(tp1.toFixed(5)) },
      { level: 2, price: parseFloat(tp2.toFixed(5)) },
      { level: 3, price: parseFloat(tp3.toFixed(5)) },
    ];

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
      confidence,
    };
  }

  private extractDirection(text: string): TradeDirection | null {
    const upper = text.toUpperCase();
    if (upper.includes("BUY") || upper.includes("LONG"))
      return TradeDirection.BUY;
    if (upper.includes("SELL") || upper.includes("SHORT"))
      return TradeDirection.SELL;
    return null;
  }

  private extractSymbol(text: string): string | null {
    const upper = text.toUpperCase();

    // Gold variations
    if (upper.includes("GOLD") || upper.includes("XAUUSD")) return "XAUUSD";
    if (upper.includes("SILVER") || upper.includes("XAGUSD")) return "XAGUSD";
    if (upper.includes("CRUDE") || upper.includes("USOIL")) return "USOIL";
    if (upper.includes("BITCOIN") || upper.includes("BTCUSD")) return "BTCUSD";
    if (upper.includes("ETHEREUM") || upper.includes("ETHUSD")) return "ETHUSD";
    if (upper.includes("US30") || upper.includes("DOW")) return "US30";
    if (upper.includes("NAS100") || upper.includes("NASDAQ")) return "NAS100";
    if (
      upper.includes("SPX500") ||
      upper.includes("SP500") ||
      upper.includes("S&P")
    )
      return "SPX500";

    const pairs = [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "USDCHF",
      "AUDUSD",
      "USDCAD",
      "NZDUSD",
      "EURJPY",
      "GBPJPY",
      "EURGBP",
      "AUDJPY",
      "EURAUD",
      "EURCHF",
      "AUDNZD",
    ];
    for (const pair of pairs) {
      if (upper.includes(pair)) return pair;
    }

    const pairMatch = text.match(/[A-Z]{6}/);
    return pairMatch?.[0] || null;
  }

  private extractTakeProfits(
    text: string
  ): Array<{ level: number; price: number }> {
    const profits: Array<{ level: number; price: number }> = [];

    // Match TP1: 4218, TP2: 4220, etc
    const matches = text.matchAll(/tp\s*(\d+)[\s:]*(\d+\.?\d*)/gi);
    for (const match of matches) {
      profits.push({
        level: parseInt(match[1]),
        price: parseFloat(match[2]),
      });
    }

    return profits.sort((a, b) => a.level - b.level);
  }

  private validateSignal(
    direction: TradeDirection,
    entryRange: { min: number; max: number },
    stopLoss: number,
    takeProfits: Array<{ level: number; price: number }>
  ): boolean {
    if (entryRange.min <= 0 || stopLoss <= 0) return false;
    if (takeProfits.some((tp) => tp.price <= 0)) return false;

    if (direction === TradeDirection.BUY) {
      if (stopLoss >= entryRange.min) return false;
      if (takeProfits.some((tp) => tp.price <= entryRange.max)) return false;
    } else {
      if (stopLoss <= entryRange.max) return false;
      if (takeProfits.some((tp) => tp.price >= entryRange.min)) return false;
    }

    return true;
  }
}
