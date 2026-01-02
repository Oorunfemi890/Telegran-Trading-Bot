// FILE: src/database/migrations/1704326400000-AddUserLocationFields.ts
// =============================================
// MIGRATION: Add location tracking fields to users table
// =============================================

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserLocationFields1704326400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if columns already exist before adding
    const table = await queryRunner.getTable('users');
    
    if (!table?.findColumnByName('phoneNumber')) {
      await queryRunner.addColumn('users', new TableColumn({
        name: 'phoneNumber',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }));
    }

    if (!table?.findColumnByName('country')) {
      await queryRunner.addColumn('users', new TableColumn({
        name: 'country',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }));
    }

    if (!table?.findColumnByName('city')) {
      await queryRunner.addColumn('users', new TableColumn({
        name: 'city',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }));
    }

    if (!table?.findColumnByName('registrationIp')) {
      await queryRunner.addColumn('users', new TableColumn({
        name: 'registrationIp',
        type: 'varchar',
        length: '45',
        isNullable: true,
      }));
    }

    if (!table?.findColumnByName('deviceInfo')) {
      await queryRunner.addColumn('users', new TableColumn({
        name: 'deviceInfo',
        type: 'jsonb',
        isNullable: true,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'deviceInfo');
    await queryRunner.dropColumn('users', 'registrationIp');
    await queryRunner.dropColumn('users', 'city');
    await queryRunner.dropColumn('users', 'country');
    await queryRunner.dropColumn('users', 'phoneNumber');
  }
}