// FILE: src/config/database.config.ts
import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import path from 'path';

config();

const isSupabase = process.env.DB_HOST?.includes('supabase.co');

const baseConfig: DataSourceOptions = {
  type: 'postgres',
  
  ...(process.env.POSTGRES_URL
    ? { url: process.env.POSTGRES_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'trading_bot',
      }),
  
  ssl: isSupabase
    ? {
        rejectUnauthorized: false,
      }
    : false,
  
  entities: [path.join(__dirname, '../database/entities/**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../database/migrations/**/*{.ts,.js}')],
  
  extra: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    statement_timeout: 30000,
    query_timeout: 30000,
  },
  
  connectTimeoutMS: 20000,
  synchronize: process.env.DB_SYNCHRONIZE === 'true' && process.env.NODE_ENV === 'development',
  logging: process.env.DB_LOGGING === 'true' ? ['query', 'error', 'warn'] : false,
  cache: false,
  
  ...(isSupabase && {
    extra: {
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    },
  }),
};

export const AppDataSource = new DataSource(baseConfig);

export const initializeDatabase = async (maxRetries = 3): Promise<void> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempting database connection (${attempt}/${maxRetries})...`);
      
      await AppDataSource.initialize();
      
      console.log('✅ Database connection initialized successfully');
      console.log(`📊 Database: ${baseConfig.type}`);
      console.log(`🌐 Host: ${process.env.DB_HOST}`);
      console.log(`🔌 SSL: ${isSupabase ? 'Enabled' : 'Disabled'}`);
      
      await AppDataSource.query('SELECT NOW()');
      console.log('✅ Database connection test successful\n');
      
      if (process.env.NODE_ENV === 'production') {
        const pendingMigrations = await AppDataSource.showMigrations();
        if (pendingMigrations) {
          console.log('⏳ Running pending migrations...');
          await AppDataSource.runMigrations();
          console.log('✅ Migrations completed\n');
        }
      }
      
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Connection attempt ${attempt} failed:`, (error as Error).message);
      
      if (attempt < maxRetries) {
        const waitTime = attempt * 2000;
        console.log(`⏳ Waiting ${waitTime / 1000}s before retry...\n`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error('❌ All database connection attempts failed');
  console.error('💡 Troubleshooting tips:');
  console.error('   1. Check your database credentials in .env');
  console.error('   2. Ensure database server is running and accessible');
  console.error('   3. Verify firewall/network settings');
  console.error('   4. For Supabase: Check project status in dashboard\n');
  
  throw new Error(`Database connection failed after ${maxRetries} attempts: ${lastError?.message}`);
};

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