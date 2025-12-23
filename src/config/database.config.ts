import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

const baseConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'trading_bot',
  
  // Entity and migration paths
  entities: [path.join(__dirname, '../database/entities/**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../database/migrations/**/*{.ts,.js}')],
  
  // Connection pool settings
  extra: {
    max: 20, // Maximum number of connections
    min: 5,  // Minimum number of connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
  
  // Synchronize (ONLY FOR DEVELOPMENT!)
  synchronize: process.env.DB_SYNCHRONIZE === 'true' && process.env.NODE_ENV === 'development',
  
  // Logging
  logging: process.env.DB_LOGGING === 'true' ? ['query', 'error', 'warn'] : false,
  
  // Additional options
  cache: {
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    duration: 30000, // 30 seconds cache
  },
};

// Create DataSource instance
export const AppDataSource = new DataSource(baseConfig);

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connection initialized successfully');
    
    // Run pending migrations in production
    if (process.env.NODE_ENV === 'production') {
      const pendingMigrations = await AppDataSource.showMigrations();
      if (pendingMigrations) {
        console.log('⏳ Running pending migrations...');
        await AppDataSource.runMigrations();
        console.log('✅ Migrations completed');
      }
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Graceful shutdown
export const closeDatabase = async (): Promise<void> => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing database:', error);
    throw error;
  }
};

export default AppDataSource;