// FILE: src/websocket/socket.server.ts (UPDATED WITH CHANNEL REQUEST EVENTS)
// =============================================

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../helpers/jwt.helper';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map();

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

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;

    console.log(`✅ User connected: ${socket.userEmail} (${socket.id})`);

    this.connectedUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);

    if (socket.userRole === 'admin' || socket.userRole === 'super_admin') {
      socket.join('admins');
      console.log(`✅ Admin joined admin room: ${socket.userEmail}`);
    }

    socket.emit('connected', {
      userId,
      socketId: socket.id,
      timestamp: new Date(),
    });

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userEmail}`);
      this.connectedUsers.delete(userId);
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    socket.on('subscribe', (channel: string) => {
      socket.join(channel);
      socket.emit('subscribed', { channel });
    });

    socket.on('unsubscribe', (channel: string) => {
      socket.leave(channel);
      socket.emit('unsubscribed', { channel });
    });
  }

  emitToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  emitToAdmins(event: string, data: any) {
    console.log(`📡 Broadcasting to admins: ${event}`, data);
    this.io.to('admins').emit(event, data);
  }

  broadcast(event: string, data: any) {
    this.io.emit(event, data);
  }

  emitToRoom(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
  }

  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  getIO(): SocketIOServer {
    return this.io;
  }

  // =============================================
  // CHANNEL REQUEST EVENTS (NEW)
  // =============================================

  /**
   * Emit new channel request to all admins
   */
  emitNewChannelRequest(request: any) {
    console.log('📡 Emitting new channel request to admins:', request.channelTitle);
    this.emitToAdmins('channel:request:new', {
      type: 'channel_request_submitted',
      request: {
        id: request.id,
        channelTitle: request.channelTitle,
        channelUsername: request.channelUsername,
        reason: request.reason,
        user: {
          fullName: request.user?.fullName,
          email: request.user?.email,
        },
        createdAt: request.createdAt,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit channel request approved to user
   */
  emitChannelRequestApproved(userId: string, channelTitle: string, channelId: string) {
    this.emitToUser(userId, 'channel:request:approved', {
      type: 'channel_request_approved',
      channelTitle,
      channelId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit channel request rejected to user
   */
  emitChannelRequestRejected(userId: string, channelTitle: string, rejectionReason?: string) {
    this.emitToUser(userId, 'channel:request:rejected', {
      type: 'channel_request_rejected',
      channelTitle,
      rejectionReason,
      timestamp: new Date(),
    });
  }

  /**
   * Emit channel request processed to admins (to update their count)
   */
  emitChannelRequestProcessed(requestId: string, approved: boolean) {
    this.emitToAdmins('channel:request:processed', {
      type: approved ? 'channel_request_approved' : 'channel_request_rejected',
      requestId,
      timestamp: new Date(),
    });
  }

  /**
   * Emit new channel added to all users
   */
  emitChannelAdded(channel: any) {
    this.broadcast('channel:added', {
      type: 'channel_added',
      channel: {
        id: channel.id,
        channelId: channel.channelId,
        title: channel.title,
        username: channel.username,
        description: channel.description,
      },
      timestamp: new Date(),
    });
  }

  // =============================================
  // EXISTING TRADE EVENTS
  // =============================================

  emitTradeOpened(userId: string, trade: any) {
    this.emitToUser(userId, 'trade:opened', {
      type: 'trade_opened',
      trade,
      timestamp: new Date(),
    });
  }

  emitBreakevenActivated(userId: string, trade: any) {
    this.emitToUser(userId, 'trade:breakeven', {
      type: 'breakeven_activated',
      trade,
      timestamp: new Date(),
    });
  }

  emitTakeProfitHit(userId: string, trade: any, tpLevel: number) {
    this.emitToUser(userId, 'trade:takeprofit', {
      type: 'take_profit_hit',
      trade,
      tpLevel,
      timestamp: new Date(),
    });
  }

  emitStopLossHit(userId: string, trade: any) {
    this.emitToUser(userId, 'trade:stoploss', {
      type: 'stop_loss_hit',
      trade,
      timestamp: new Date(),
    });
  }

  emitTradeCompleted(userId: string, trade: any) {
    this.emitToUser(userId, 'trade:completed', {
      type: 'trade_completed',
      trade,
      timestamp: new Date(),
    });
  }

  emitSignalDetected(userId: string, signal: any) {
    this.emitToUser(userId, 'signal:detected', {
      type: 'signal_detected',
      signal,
      timestamp: new Date(),
    });
  }

  emitPositionUpdate(userId: string, position: any) {
    this.emitToUser(userId, 'position:updated', {
      type: 'position_update',
      position,
      timestamp: new Date(),
    });
  }

  emitBalanceUpdate(userId: string, balance: any) {
    this.emitToUser(userId, 'account:balance', {
      type: 'balance_update',
      balance,
      timestamp: new Date(),
    });
  }

  emitSystemNotification(userId: string, notification: any) {
    this.emitToUser(userId, 'system:notification', {
      type: 'system_notification',
      notification,
      timestamp: new Date(),
    });
  }

  emitAdminNotification(notification: any) {
    this.emitToAdmins('admin:notification', {
      type: 'admin_notification',
      notification,
      timestamp: new Date(),
    });
  }

  emitNewUserRegistration(user: any) {
    this.emitToAdmins('admin:newuser', {
      type: 'new_user',
      user,
      timestamp: new Date(),
    });
  }

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