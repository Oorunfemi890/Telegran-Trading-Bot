// FILE: src/database/entities/TradingAccount.entity.ts
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

@Entity('trading_accounts')
export class TradingAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.tradingAccounts)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 100 })
  broker: string;

  @Column({ type: 'varchar', length: 100 })
  accountNumber: string;

  // Encrypted credentials
  @Column({ type: 'text' })
  encryptedApiKey: string;

  @Column({ type: 'text', nullable: true })
  encryptedApiSecret: string | null;

  // Cached account info
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  equity: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  freeMargin: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'int', default: 100 })
  leverage: number;

  @Column({ type: 'boolean', default: true })
  isPrimary: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}