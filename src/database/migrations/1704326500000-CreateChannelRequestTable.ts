// FILE: src/database/migrations/1704326500000-CreateChannelRequestTable.ts
// =============================================
// MIGRATION: Create channel_requests table
// =============================================

import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateChannelRequestTable1704326500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'channel_requests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'channelId',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'channelUsername',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'channelTitle',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'channelDescription',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected'],
            default: "'pending'",
          },
          {
            name: 'reviewed_by_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reviewedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'rejectionReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Add foreign key to users table
    await queryRunner.createForeignKey(
      'channel_requests',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    // Add foreign key for reviewed_by_id
    await queryRunner.createForeignKey(
      'channel_requests',
      new TableForeignKey({
        columnNames: ['reviewed_by_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('channel_requests');
  }
}