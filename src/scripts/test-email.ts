// FILE: src/scripts/test-email.ts
// =============================================
import 'reflect-metadata';
import { config } from 'dotenv';
import { initializeDatabase } from '../config/database.config';
import { initializeRedis } from '../config/redis.config';
import { EmailService } from '../services/email.service';

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

    await emailService.sendWelcomeEmail(
      'olorunfemiayomide045@gmail.com',  // ⚠️ CHANGE THIS TO YOUR EMAIL
      'Test User',
      'test-user-id-123'
    );

    console.log('\n✅ Email sent successfully!');
    console.log('📬 Check your inbox (and spam folder)\n');
    
    // Give time for queue to process
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testEmail();