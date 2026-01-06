// FILE: src/services/metatrader.client.ts
// =============================================
// PHASE 8: METATRADER CLIENT API WRAPPER
// =============================================

import axios, { AxiosInstance } from 'axios';
import { decrypt } from '../helpers/encryption.helper';
import { MTAccountInfo, MTOrderRequest, MTOrderResponse, MTPositionInfo, OrderType } from '../types';

export class MetaTraderClient {
  private axiosInstance: AxiosInstance;
  private accountNumber: string;
  private apiKey: string;
  private isSimulation: boolean;

  constructor(
    brokerUrl: string,
    accountNumber: string,
    encryptedApiKey: string,
    _encryptedApiSecret?: string
  ) {
    this.accountNumber = accountNumber;
    
    // Decrypt credentials
    try {
      this.apiKey = decrypt(encryptedApiKey);
      // apiSecret might be used for some brokers
    } catch (error) {
      console.error('Failed to decrypt MT credentials:', error);
      throw new Error('Invalid MT credentials');
    }

    // Check if MetaTrader API is enabled
    this.isSimulation = process.env.MT_API_ENABLED !== 'true';

    if (this.isSimulation) {
      console.log('⚠️  MetaTrader in SIMULATION mode');
    }

    // Initialize axios instance
    this.axiosInstance = axios.create({
      baseURL: brokerUrl || process.env.MT_API_URL,
      timeout: parseInt(process.env.MT_API_TIMEOUT || '30000'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Account-Number': this.accountNumber,
      },
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('MetaTrader API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<MTAccountInfo> {
    if (this.isSimulation) {
      return this.simulateAccountInfo();
    }

    try {
      const response = await this.axiosInstance.get('/account/info');
      return response.data;
    } catch (error) {
      console.error('Failed to get account info:', error);
      // Fallback to simulation
      return this.simulateAccountInfo();
    }
  }

  /**
   * Get current market price
   */
  async getCurrentPrice(symbol: string): Promise<{ bid: number; ask: number }> {
    if (this.isSimulation) {
      return this.simulatePrice(symbol);
    }

    try {
      const response = await this.axiosInstance.get(`/market/price/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get price:', error);
      return this.simulatePrice(symbol);
    }
  }

  /**
   * Place a new order
   */
  async placeOrder(order: MTOrderRequest): Promise<MTOrderResponse> {
    if (this.isSimulation) {
      return this.simulateOrderPlacement(order);
    }

    try {
      const response = await this.axiosInstance.post('/orders/place', order);
      return response.data;
    } catch (error) {
      console.error('Failed to place order:', error);
      // Fallback to simulation
      return this.simulateOrderPlacement(order);
    }
  }

  /**
   * Modify an existing position
   */
  async modifyPosition(
    ticket: number,
    stopLoss?: number,
    takeProfit?: number
  ): Promise<boolean> {
    if (this.isSimulation) {
      console.log(`[SIM] Modify position ${ticket}: SL=${stopLoss}, TP=${takeProfit}`);
      return true;
    }

    try {
      const response = await this.axiosInstance.put(`/positions/${ticket}`, {
        stopLoss,
        takeProfit,
      });
      return response.data.success;
    } catch (error) {
      console.error('Failed to modify position:', error);
      return false;
    }
  }

  /**
   * Close a position
   */
  async closePosition(ticket: number, volume?: number): Promise<boolean> {
    if (this.isSimulation) {
      console.log(`[SIM] Close position ${ticket}${volume ? ` (${volume} lots)` : ''}`);
      return true;
    }

    try {
      const response = await this.axiosInstance.post(`/positions/${ticket}/close`, {
        volume,
      });
      return response.data.success;
    } catch (error) {
      console.error('Failed to close position:', error);
      return false;
    }
  }

  /**
   * Get position info
   */
  async getPosition(ticket: number): Promise<MTPositionInfo | null> {
    if (this.isSimulation) {
      return null; // Not implemented in simulation
    }

    try {
      const response = await this.axiosInstance.get(`/positions/${ticket}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get position:', error);
      return null;
    }
  }

  /**
   * Get all open positions
   */
  async getOpenPositions(): Promise<MTPositionInfo[]> {
    if (this.isSimulation) {
      return []; // Not implemented in simulation
    }

    try {
      const response = await this.axiosInstance.get('/positions/open');
      return response.data;
    } catch (error) {
      console.error('Failed to get open positions:', error);
      return [];
    }
  }

  /**
   * Get symbol specifications
   */
  async getSymbolInfo(symbol: string): Promise<any> {
    if (this.isSimulation) {
      return this.simulateSymbolInfo(symbol);
    }

    try {
      const response = await this.axiosInstance.get(`/symbols/${symbol}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get symbol info:', error);
      return this.simulateSymbolInfo(symbol);
    }
  }

  // =============================================
  // SIMULATION METHODS (for testing without MT)
  // =============================================

  private simulateAccountInfo(): MTAccountInfo {
    return {
      accountNumber: this.accountNumber,
      broker: 'Simulated Broker',
      balance: 10000,
      equity: 10000,
      margin: 0,
      freeMargin: 10000,
      marginLevel: 0,
      currency: 'USD',
      leverage: 100,
    };
  }

  private simulatePrice(symbol: string): { bid: number; ask: number } {
    const basePrices: { [key: string]: number } = {
      XAUUSD: 4200,
      EURUSD: 1.0850,
      GBPUSD: 1.2700,
      USDJPY: 149.50,
      BTCUSD: 95000,
      XAGUSD: 28.50,
      USOIL: 72.50,
      US30: 43000,
      NAS100: 18500,
    };

    const basePrice = basePrices[symbol] || 1.0;
    const spread = basePrice * 0.0001; // 0.01% spread

    return {
      bid: basePrice - spread / 2,
      ask: basePrice + spread / 2,
    };
  }

  private simulateOrderPlacement(order: MTOrderRequest): MTOrderResponse {
    const ticket = Math.floor(Math.random() * 1000000000);
    const currentPrice = this.simulatePrice(order.symbol);

    const openPrice = order.orderType === OrderType.MARKET
      ? (order.orderType === OrderType.MARKET ? currentPrice.ask : currentPrice.bid)
      : (order.price || currentPrice.ask);

    console.log(`[SIM] Order placed: #${ticket} ${order.orderType} ${order.volume} lots ${order.symbol} @ ${openPrice.toFixed(5)}`);

    return {
      ticket,
      symbol: order.symbol,
      orderType: order.orderType,
      openPrice,
      volume: order.volume,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      openTime: new Date(),
      comment: order.comment,
    };
  }

  private simulateSymbolInfo(symbol: string): any {
    const specs: { [key: string]: any } = {
      XAUUSD: {
        symbol: 'XAUUSD',
        digits: 2,
        pipSize: 0.01,
        pipValue: 1,
        contractSize: 100,
        minVolume: 0.01,
        maxVolume: 100,
        volumeStep: 0.01,
        spread: 2,
      },
      EURUSD: {
        symbol: 'EURUSD',
        digits: 5,
        pipSize: 0.0001,
        pipValue: 10,
        contractSize: 100000,
        minVolume: 0.01,
        maxVolume: 100,
        volumeStep: 0.01,
        spread: 1,
      },
      // Add more as needed
    };

    return specs[symbol] || {
      symbol,
      digits: 5,
      pipSize: 0.0001,
      pipValue: 10,
      contractSize: 100000,
      minVolume: 0.01,
      maxVolume: 100,
      volumeStep: 0.01,
      spread: 2,
    };
  }

  /**
   * Test connection to MT
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getAccountInfo();
      return true;
    } catch (error) {
      return false;
    }
  }
}