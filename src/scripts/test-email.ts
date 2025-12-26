// FILE: src/scripts/test-email.ts
// =============================================
import 'reflect-metadata';
import { config } from 'dotenv';
import { initializeDatabase } from '../config/database.config';
import { initializeRedis } from '../config/redis.config';
import { EmailService } from '../services/email.service';
import { v4 as uuidv4 } from 'uuid';

config();

async function testEmail() {
  try {
    console.log('📧 Testing Email System\n');
    console.log('==========================================\n');

    await initializeDatabase();
    await initializeRedis();

    // Wait a bit for Redis to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    const emailService = new EmailService();

    console.log('📧 Sending test welcome email...\n');

    // Use a valid UUID instead of "test-user-id-123"
    const testUserId = uuidv4();
    console.log(`🆔 Generated test user ID: ${testUserId}\n`);

    await emailService.sendWelcomeEmail(
      'olorunfemiayomide045@gmail.com',
      'Test User',
      testUserId
    );

    console.log('\n✅ Email queued successfully!');
    console.log('📬 Check your inbox (and spam folder)\n');
    
    // Give time for queue to process
    console.log('⏳ Waiting for email to be processed...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('✅ Test completed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testEmail();