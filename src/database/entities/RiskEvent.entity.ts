// FILE: src/database/entities/RiskEvent.entity.ts
// =============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RiskEventType, RiskEventSeverity } from '../../types';
import { User } from './User.entity';
import { Trade } from './Trade.entity';

@Entity('risk_events')
export class RiskEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => Trade, { nullable: true })
  @JoinColumn({ name: 'trade_id' })
  trade: Trade | null;

  @Column({ type: 'uuid', nullable: true })
  trade_id: string | null;

  @Column({ type: 'enum', enum: RiskEventType })
  eventType: RiskEventType;

  @Column({ type: 'jsonb' })
  eventData: Record<string, any>;

  @Column({ type: 'enum', enum: RiskEventSeverity })
  severity: RiskEventSeverity;

  @CreateDateColumn()
  createdAt: Date;
}