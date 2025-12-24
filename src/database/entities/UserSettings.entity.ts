// FILE: src/database/entities/UserSettings.entity.ts
// =============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User.entity';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.settings)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  // Risk Management
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10.0 })
  balanceUsagePercentage: number;

  @Column({ type: 'int', default: 5 })
  positionsPerTrade: number;

  @Column({ type: 'int', default: 3 })
  maxConcurrentTrades: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 25.0 })
  breakevenActivationPips: number;

  @Column({ type: 'boolean', default: true })
  breakevenEnabled: boolean;

  // Take Profit Distribution (JSON)
  @Column({ type: 'jsonb', default: () => "'[]'" })
  takeProfitDistribution: {
    level: number;
    positions: number;
    pips: number;
  }[];

  // Symbol Filtering
  @Column({ type: 'text', array: true, default: () => "ARRAY[]::text[]" })
  allowedSymbols: string[];

  // Trading Hours
  @Column({ type: 'time', nullable: true })
  tradingHoursStart: string | null;

  @Column({ type: 'time', nullable: true })
  tradingHoursEnd: string | null;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone: string;

  @Column({ type: 'boolean', default: true })
  tradingEnabled: boolean;

  // Notification Preferences
  @Column({ type: 'boolean', default: true })
  emailNotificationsEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  tradeOpenedNotification: boolean;

  @Column({ type: 'boolean', default: true })
  breakevenNotification: boolean;

  @Column({ type: 'boolean', default: true })
  takeProfitNotification: boolean;

  @Column({ type: 'boolean', default: true })
  stopLossNotification: boolean;

  @Column({ type: 'boolean', default: true })
  dailyReportEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}