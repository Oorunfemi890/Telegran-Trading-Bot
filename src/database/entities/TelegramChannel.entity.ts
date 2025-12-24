// FILE: src/database/entities/TelegramChannel.entity.ts
// =============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserChannelSubscription } from './UserChannelSubscription.entity';
import { Signal } from './Signal.entity';

@Entity('telegram_channels')
export class TelegramChannel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true })
  channelId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  totalSignals: number;

  @Column({ type: 'int', default: 0 })
  successfulSignals: number;

  @OneToMany(() => UserChannelSubscription, (sub) => sub.channel)
  subscriptions: UserChannelSubscription[];

  @OneToMany(() => Signal, (signal) => signal.channel)
  signals: Signal[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}