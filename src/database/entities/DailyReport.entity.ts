// FILE: src/database/entities/DailyReport.entity.ts
// =============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User.entity';

@Entity('daily_reports')
export class DailyReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'date' })
  reportDate: Date;

  @Column({ type: 'jsonb' })
  tradingStats: Record<string, any>;

  @Column({ type: 'jsonb' })
  financialStats: Record<string, any>;

  @Column({ type: 'jsonb' })
  performanceMetrics: Record<string, any>;

  @Column({ type: 'jsonb' })
  riskMetrics: Record<string, any>;

  @Column({ type: 'jsonb' })
  signalAnalysis: Record<string, any>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  insights: any[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  recommendations: any[];

  @CreateDateColumn()
  createdAt: Date;
}