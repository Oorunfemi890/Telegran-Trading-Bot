import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserLocationFields1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'phoneNumber',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'country',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'city',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'registrationIp',
        type: 'varchar',
        length: '45',
        isNullable: true,
      }),
      new TableColumn({
        name: 'deviceInfo',
        type: 'jsonb',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('users', [
      'phoneNumber',
      'country',
      'city',
      'registrationIp',
      'deviceInfo',
    ]);
  }
}