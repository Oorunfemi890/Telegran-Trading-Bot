// FILE: src/database/entities/UserChannelSubscription.entity.ts
// =============================================
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
} from 'typeorm';
import { User } from './User.entity';
import { TelegramChannel } from './TelegramChannel.entity';

@Entity('user_channel_subscriptions')
export class UserChannelSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => TelegramChannel, (channel) => channel.subscriptions)
  @JoinColumn({ name: 'channel_id' })
  channel: TelegramChannel;

  @Column({ type: 'uuid' })
  channel_id: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  subscribedAt: Date;
}