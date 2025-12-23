import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus, SubscriptionTier } from '../../types';
import { UserSettings } from './UserSettings.entity';
import { TradingAccount } from './TradingAccount.entity';
import { InvitationCode } from './InvitationCode.entity';
import { Trade } from './Trade.entity';
import { AuditLog } from './AuditLog.entity';

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  tier: SubscriptionTier;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionExpiresAt: Date | null;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  emailVerificationToken: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  lastLoginIp: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // =============================================
  // RELATIONSHIPS
  // =============================================

  @ManyToOne(() => InvitationCode, { nullable: true })
  @JoinColumn({ name: 'invitation_code_id' })
  invitationCode: InvitationCode | null;

  @Column({ type: 'uuid', nullable: true })
  invitation_code_id: string | null;

  @OneToOne(() => UserSettings, (settings) => settings.user, {
    cascade: true,
  })
  settings: UserSettings;

  @OneToMany(() => TradingAccount, (account) => account.user)
  tradingAccounts: TradingAccount[];

  @OneToMany(() => Trade, (trade) => trade.user)
  trades: Trade[];

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs: AuditLog[];

  // =============================================
  // METHODS
  // =============================================

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password && !this.password.startsWith('$2')) {
      // Check if not already hashed
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  async validatePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.password);
  }

  isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  isAdmin(): boolean {
    return this.role === UserRole.ADMIN || this.role === UserRole.SUPER_ADMIN;
  }

  isSuperAdmin(): boolean {
    return this.role === UserRole.SUPER_ADMIN;
  }

  hasValidSubscription(): boolean {
    if (this.tier === SubscriptionTier.FREE) return true;
    if (!this.subscriptionExpiresAt) return false;
    return new Date() < this.subscriptionExpiresAt;
  }

  canCreateTrades(): boolean {
    return this.isActive() && this.hasValidSubscription() && this.emailVerified;
  }

  // Convert to safe object (without password)
  toJSON(): Partial<User> {
    const { password, passwordResetToken, emailVerificationToken, ...safeUser } = this;
    return safeUser;
  }
}