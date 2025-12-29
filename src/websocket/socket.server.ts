// FILE: src/websocket/socket.server.ts
// =============================================
// PHASE 12: WEBSOCKET REAL-TIME SERVER
// =============================================

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../helpers/jwt.helper';
import { JWTPayload } from '../types';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true,
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    console.log('✅ WebSocket server initialized');
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.query.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = verifyAccessToken(token as string);
        
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        socket.userRole = decoded.role;

        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new connection
   */
  private handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;

    console.log(`✅ User connected: ${socket.userEmail} (${socket.id})`);

    // Store connection
    this.connectedUsers.set(userId, socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join role-specific rooms
    if (socket.userRole === 'admin' || socket.userRole === 'super_admin') {
      socket.join('admins');
    }

    // Send connection confirmation
    socket.emit('connected', {
      userId,
      socketId: socket.id,
      timestamp: new Date(),
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userEmail}`);
      this.connectedUsers.delete(userId);
    });

    // Handle ping/pong
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Subscribe to specific events
    socket.on('subscribe', (channel: string) => {
      socket.join(channel);
      socket.emit('subscribed', { channel });
    });

    socket.on('unsubscribe', (channel: string) => {
      socket.leave(channel);
      socket.emit('unsubscribed', { channel });
    });
  }

  /**
   * Emit to specific user
   */
  emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit to all admins
   */
  emitToAdmins(event: string, data: any) {
    this.io.to('admins').emit(event, data);
  }

  /**
   * Emit to all connected clients
   */
  broadcast(event: string, data: any) {
    this.io.emit(event, data);
  }

  /**
   * Emit to specific room
   */
  emitToRoom(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get socket instance
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  // =============================================
  // REAL-TIME EVENT EMITTERS
  // =============================================

  /**
   * Emit trade opened event
   */
  emitTradeOpened(userId: string, trade: any) {
    this.emitToUser(userId, 'trade:opened', {
      type: 'trade_opened',
      trade,
      timestamp: new Date(),
    });
  }

  /**
   * Emit breakeven activated
   */
  emitBreakevenActivated(userId: string, trade: any) {
    this.emitToUser(userId, 'trade:breakeven', {
      type: 'breakeven_activated',
      trade,
      timestamp: new Date(),
    });
  }

  /**
   * Emit take profit hit
   */
  emitTakeProfitHit(userId: string, trade: any, tpLevel: number) {
    this.emitToUser(userId, 'trade:takeprofit', {
      type: 'take_profit_hit',
      trade,
      tpLevel,
      timestamp: new Date(),
    });
  }

  /**
   * Emit stop loss hit
   */
  emitStopLossHit(userId: string, trade: any) {
    this.emitToUser(userId, 'trade:stoploss', {
      type: 'stop_loss_hit',
      trade,
      timestamp: new Date(),
    });
  }

  /**
   * Emit trade completed
   */
  emitTradeCompleted(userId: string, trade: any) {
    this.emitToUser(userId, 'trade:completed', {
      type: 'trade_completed',
      trade,
      timestamp: new Date(),
    });
  }

  /**
   * Emit signal detected
   */
  emitSignalDetected(userId: string, signal: any) {
    this.emitToUser(userId, 'signal:detected', {
      type: 'signal_detected',
      signal,
      timestamp: new Date(),
    });
  }

  /**
   * Emit position update
   */
  emitPositionUpdate(userId: string, position: any) {
    this.emitToUser(userId, 'position:updated', {
      type: 'position_update',
      position,
      timestamp: new Date(),
    });
  }

  /**
   * Emit account balance update
   */
  emitBalanceUpdate(userId: string, balance: any) {
    this.emitToUser(userId, 'account:balance', {
      type: 'balance_update',
      balance,
      timestamp: new Date(),
    });
  }

  /**
   * Emit system notification
   */
  emitSystemNotification(userId: string, notification: any) {
    this.emitToUser(userId, 'system:notification', {
      type: 'system_notification',
      notification,
      timestamp: new Date(),
    });
  }

  /**
   * Emit admin notification
   */
  emitAdminNotification(notification: any) {
    this.emitToAdmins('admin:notification', {
      type: 'admin_notification',
      notification,
      timestamp: new Date(),
    });
  }

  /**
   * Emit new user registration (to admins)
   */
  emitNewUserRegistration(user: any) {
    this.emitToAdmins('admin:newuser', {
      type: 'new_user',
      user,
      timestamp: new Date(),
    });
  }

  /**
   * Emit system metrics update (to admins)
   */
  emitSystemMetrics(metrics: any) {
    this.emitToAdmins('admin:metrics', {
      type: 'system_metrics',
      metrics,
      timestamp: new Date(),
    });
  }
}

let socketServerInstance: WebSocketServer | null = null;

export function initializeWebSocketServer(httpServer: HTTPServer): WebSocketServer {
  if (!socketServerInstance) {
    socketServerInstance = new WebSocketServer(httpServer);
  }
  return socketServerInstance;
}

export function getWebSocketServer(): WebSocketServer | null {
  return socketServerInstance;
}