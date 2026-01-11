// FILE: src/database/migrations/1704400000000-CreateEATables.ts
// =============================================
// MIGRATION: Create EA tokens and heartbeat tables
// =============================================

import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateEATables1704400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ea_tokens table
    await queryRunner.createTable(
      new Table({
        name: 'ea_tokens',
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
            name: 'token',
            type: 'varchar',
            length: '128',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'deviceName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'platform',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'version',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'revoked', 'expired'],
            default: "'active'",
          },
          {
            name: 'lastUsedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'requestCount',
            type: 'int',
            default: 0,
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

    // Create ea_heartbeats table
    await queryRunner.createTable(
      new Table({
        name: 'ea_heartbeats',
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
            name: 'ea_token_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['online', 'offline', 'warning', 'error'],
            default: "'online'",
          },
          {
            name: 'accountNumber',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'broker',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'balance',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'equity',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'freeMargin',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'openPositions',
            type: 'int',
            default: 0,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'systemInfo',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'lastPingAt',
            type: 'timestamp',
            default: 'now()',
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

    // Add foreign keys
    await queryRunner.createForeignKey(
      'ea_tokens',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'ea_heartbeats',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'ea_heartbeats',
      new TableForeignKey({
        columnNames: ['ea_token_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'ea_tokens',
        onDelete: 'CASCADE',
      })
    );

    // Add indexes
    await queryRunner.createIndex(
      'ea_tokens',
      new TableIndex({
        name: 'IDX_EA_TOKEN_USER',
        columnNames: ['user_id'],
      })
    );

    await queryRunner.createIndex(
      'ea_tokens',
      new TableIndex({
        name: 'IDX_EA_TOKEN_STATUS',
        columnNames: ['status'],
      })
    );

    await queryRunner.createIndex(
      'ea_heartbeats',
      new TableIndex({
        name: 'IDX_EA_HEARTBEAT_USER',
        columnNames: ['user_id'],
      })
    );

    await queryRunner.createIndex(
      'ea_heartbeats',
      new TableIndex({
        name: 'IDX_EA_HEARTBEAT_TOKEN',
        columnNames: ['ea_token_id'],
      })
    );

    console.log('✅ EA tables created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ea_heartbeats');
    await queryRunner.dropTable('ea_tokens');
    console.log('✅ EA tables dropped');
  }
}