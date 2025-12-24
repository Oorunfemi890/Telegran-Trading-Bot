// FILE: src/database/entities/Position.entity.ts
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
import { PositionStatus, CloseReason, OrderType } from '../../types';
import { Trade } from './Trade.entity';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Trade, (trade) => trade.positions)
  @JoinColumn({ name: 'trade_id' })
  trade: Trade;

  @Column({ type: 'uuid' })
  trade_id: string;

  @Column({ type: 'int' })
  positionNumber: number;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  lotSize: number;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  currentStopLoss: number;

  @Column({ type: 'decimal', precision: 15, scale: 5 })
  currentTakeProfit: number;

  @Column({ type: 'bigint', nullable: true })
  mtOrderTicket: string | null;

  @Column({ type: 'enum', enum: OrderType })
  orderType: OrderType;

  @Column({ type: 'boolean', default: false })
  breakevenActivated: boolean;

  @Column({ type: 'enum', enum: PositionStatus, default: PositionStatus.PENDING })
  status: PositionStatus;

  @Column({ type: 'decimal', precision: 15, scale: 5, nullable: true })
  closedPrice: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  profit: number;

  @Column({ type: 'enum', enum: CloseReason, nullable: true })
  closeReason: CloseReason | null;

  @Column({ type: 'timestamp', nullable: true })
  openedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}