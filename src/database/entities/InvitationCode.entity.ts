import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { InvitationCodeStatus, SubscriptionTier } from "../../types";
import { User } from "./User.entity";

@Entity("invitation_codes")
@Index(["code"], { unique: true })
export class InvitationCode {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 20, unique: true })
  code: string;

  @Column({
    type: "enum",
    enum: SubscriptionTier,
    default: SubscriptionTier.STARTER,
  })
  tier: SubscriptionTier;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: "int", default: 1 })
  maxUses: number;

  @Column({ type: "int", default: 0 })
  currentUses: number;

  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date | null;

  @Column({
    type: "enum",
    enum: InvitationCodeStatus,
    default: InvitationCodeStatus.ACTIVE,
  })
  status: InvitationCodeStatus;

  @Column({ type: "varchar", length: 255, nullable: true })
  customerEmail: string | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  usedAt: Date | null;

  // =============================================
  // RELATIONSHIPS
  // =============================================

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "generated_by_id" })
  generatedBy: User | null;

  @Column({ type: "uuid", nullable: true })
  generated_by_id: string | null;

  @OneToMany(() => User, (user) => user.invitationCode)
  usedByUsers: User[];

  // =============================================
  // METHODS
  // =============================================

  isValid(): boolean {
    // Check if status is active
    if (this.status !== InvitationCodeStatus.ACTIVE) {
      return false;
    }

    // Check if not expired
    if (this.expiresAt && new Date() > this.expiresAt) {
      return false;
    }

    // Check if uses remaining
    if (this.currentUses >= this.maxUses) {
      return false;
    }

    return true;
  }

  canBeUsedBy(email: string): boolean {
    // If no specific customer email, anyone can use
    if (!this.customerEmail) {
      return this.isValid();
    }

    // Check if email matches
    return (
      this.customerEmail.toLowerCase() === email.toLowerCase() && this.isValid()
    );
  }

  markAsUsed(): void {
    this.currentUses += 1;

    if (this.currentUses >= this.maxUses) {
      this.status = InvitationCodeStatus.USED;
      this.usedAt = new Date();
    }
  }

  revoke(): void {
    this.status = InvitationCodeStatus.REVOKED;
  }

  getRemainingUses(): number {
    return Math.max(0, this.maxUses - this.currentUses);
  }

  getDaysUntilExpiry(): number | null {
    if (!this.expiresAt) return null;

    const now = new Date();
    const diffTime = this.expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      tier: this.tier,
      price: this.price,
      maxUses: this.maxUses,
      currentUses: this.currentUses,
      remainingUses: this.getRemainingUses(),
      expiresAt: this.expiresAt,
      daysUntilExpiry: this.getDaysUntilExpiry(),
      status: this.status,
      customerEmail: this.customerEmail,
      createdAt: this.createdAt,
      isValid: this.isValid(),
    };
  }
}
