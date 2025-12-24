// FILE: src/database/entities/Signal.entity.ts
// =============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { TradeDirection, SignalStatus } from '../../types';
import { TelegramChannel } from './TelegramChannel.entity';
import { Trade } from './Trade.entity';

@Entity('signals')
export class Signal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TelegramChannel, (channel) => channel.signals)
  @JoinColumn({ name: 'channel_id' })
  channel: TelegramChannel;

  @Column({ type: 'uuid' })
  channel_id: string;

  @Column({ type: 'bigint' })
  messageId: string;

  @Column({ type: 'text' })
  rawText: string;

  // Parsed Data
  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'enum', enum: TradeDirection })
  direction: TradeDirection;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  entryMin: number;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  entryMax: number;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  stopLoss: number;

  @Column({ type: 'jsonb' })
  takeProfits: { level: number; price: number }[];

  @Column({ type: 'enum', enum: SignalStatus, default: SignalStatus.ACTIVE })
  status: SignalStatus;

  @Column({ type: 'timestamp' })
  signalTime: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  tradesGenerated: number;

  @OneToMany(() => Trade, (trade) => trade.signal)
  trades: Trade[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}