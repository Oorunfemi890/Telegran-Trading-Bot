// FILE: src/database/entities/EAHeartbeat.entity.ts
// =============================================
// EA Heartbeat Entity - Tracks EA connection status
// =============================================

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User.entity';
import { EAToken } from './EAToken.entity';

export enum EAConnectionStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  WARNING = 'warning',
  ERROR = 'error',
}

@Entity('ea_heartbeats')
export class EAHeartbeat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => EAToken)
  @JoinColumn({ name: 'ea_token_id' })
  eaToken: EAToken;

  @Column({ type: 'uuid' })
  ea_token_id: string;

  @Column({
    type: 'enum',
    enum: EAConnectionStatus,
    default: EAConnectionStatus.ONLINE,
  })
  status: EAConnectionStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  accountNumber: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  broker: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  equity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  freeMargin: number;

  @Column({ type: 'int', default: 0 })
  openPositions: number;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'jsonb', nullable: true })
  systemInfo: {
    osVersion?: string;
    mt4Version?: string;
    eaVersion?: string;
  } | null;

  @Column({ type: 'timestamp' })
  lastPingAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // =============================================
  // METHODS
  // =============================================

  isOnline(): boolean {
    const now = new Date();
    const lastPing = new Date(this.lastPingAt);
    const diffMinutes = (now.getTime() - lastPing.getTime()) / 1000 / 60;

    // Consider offline if no ping in last 2 minutes
    return diffMinutes < 2;
  }

  updatePing(accountData?: {
    accountNumber?: string;
    broker?: string;
    balance?: number;
    equity?: number;
    freeMargin?: number;
    openPositions?: number;
  }): void {
    this.lastPingAt = new Date();
    this.status = EAConnectionStatus.ONLINE;

    if (accountData) {
      if (accountData.accountNumber) this.accountNumber = accountData.accountNumber;
      if (accountData.broker) this.broker = accountData.broker;
      if (accountData.balance !== undefined) this.balance = accountData.balance;
      if (accountData.equity !== undefined) this.equity = accountData.equity;
      if (accountData.freeMargin !== undefined) this.freeMargin = accountData.freeMargin;
      if (accountData.openPositions !== undefined) this.openPositions = accountData.openPositions;
    }
  }
}