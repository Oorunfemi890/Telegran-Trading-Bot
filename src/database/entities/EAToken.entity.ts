// FILE: src/database/entities/EAToken.entity.ts
// =============================================
// EA Token Entity - Stores user EA authentication tokens
// =============================================

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './User.entity';

export enum EATokenStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity('ea_tokens')
@Index(['token'], { unique: true })
export class EAToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  token: string;

  @Column({ type: 'varchar', length: 255 })
  deviceName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  platform: string | null; // MT4 or MT5

  @Column({ type: 'varchar', length: 20, nullable: true })
  version: string | null; // EA version

  @Column({
    type: 'enum',
    enum: EATokenStatus,
    default: EATokenStatus.ACTIVE,
  })
  status: EATokenStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'int', default: 0 })
  requestCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // =============================================
  // METHODS
  // =============================================

  isActive(): boolean {
    if (this.status !== EATokenStatus.ACTIVE) {
      return false;
    }

    if (this.expiresAt && new Date() > this.expiresAt) {
      return false;
    }

    return true;
  }

  updateLastUsed(): void {
    this.lastUsedAt = new Date();
    this.requestCount += 1;
  }

  revoke(): void {
    this.status = EATokenStatus.REVOKED;
  }
}