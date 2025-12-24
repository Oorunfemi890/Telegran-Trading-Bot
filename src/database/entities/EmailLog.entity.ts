// FILE: src/database/entities/EmailLog.entity.ts
// =============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EmailNotificationType, EmailDeliveryStatus } from '../../types';
import { User } from './User.entity';

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'enum', enum: EmailNotificationType })
  emailType: EmailNotificationType;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'enum', enum: EmailDeliveryStatus, default: EmailDeliveryStatus.QUEUED })
  status: EmailDeliveryStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  sentAt: Date;
}