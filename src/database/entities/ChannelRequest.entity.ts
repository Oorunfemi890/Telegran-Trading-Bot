// ===================================================
// FILE: src/database/entities/ChannelRequest.entity.ts (NEW)
// ===================================================

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

export enum ChannelRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('channel_requests')
export class ChannelRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'bigint' })
  channelId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  channelUsername: string | null;

  @Column({ type: 'varchar', length: 255 })
  channelTitle: string;

  @Column({ type: 'text', nullable: true })
  channelDescription: string | null;

  @Column({ type: 'text' })
  reason: string; // Why user wants to add this channel

  @Column({
    type: 'enum',
    enum: ChannelRequestStatus,
    default: ChannelRequestStatus.PENDING,
  })
  status: ChannelRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by_id: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: User | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}