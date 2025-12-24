// FILE: src/database/entities/Trade.entity.ts
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
import { TradeDirection, TradeStatus } from '../../types';
import { User } from './User.entity';
import { Signal } from './Signal.entity';
import { TradingAccount } from './TradingAccount.entity';
import { Position } from './Position.entity';

@Entity('trades')
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.trades)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => Signal, (signal) => signal.trades)
  @JoinColumn({ name: 'signal_id' })
  signal: Signal;

  @Column({ type: 'uuid' })
  signal_id: string;

  @ManyToOne(() => TradingAccount)
  @JoinColumn({ name: 'trading_account_id' })
  tradingAccount: TradingAccount;

  @Column({ type: 'uuid' })
  trading_account_id: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'enum', enum: TradeDirection })
  direction: TradeDirection;

  @Column({ type: 'int' })
  totalPositions: number;

  @Column({ type: 'int', default: 0 })
  positionsFilled: number;

  @Column({ type: 'jsonb' })
  entryPrices: { position: number; price: number }[];

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  stopLoss: number;

  @Column({ type: 'jsonb' })
  takeProfits: { level: number; price: number; positions: number }[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lotSizePerPosition: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalRiskAmount: number;

  @Column({ type: 'boolean', default: false })
  breakevenActivated: boolean;

  @Column({ type: 'timestamp', nullable: true })
  breakevenActivatedAt: Date | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  grossProfit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  commissions: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  netProfit: number;

  @Column({ type: 'enum', enum: TradeStatus, default: TradeStatus.PENDING })
  status: TradeStatus;

  @Column({ type: 'timestamp', nullable: true })
  openedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => Position, (position) => position.trade)
  positions: Position[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}