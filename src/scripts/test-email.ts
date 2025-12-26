// FILE: src/scripts/test-email.ts
// =============================================
import 'reflect-metadata';
import { config } from 'dotenv';
import { initializeDatabase } from '../config/database.config';
import { initializeRedis } from '../config/redis.config';
import { EmailService } from '../services/email.service';
import AppDataSource from '../config/database.config';
import { User } from '../database/entities/User.entity';

config();

async function testEmail() {
  try {
    console.log('📧 Testing Email System\n');
    console.log('==========================================\n');

    await initializeDatabase();
    await initializeRedis();

    // Wait for connections to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));

    const emailService = new EmailService();

    // Check if super admin exists
    const userRepo = AppDataSource.getRepository(User);
    let testUser = await userRepo.findOne({
      where: { email: process.env.SUPER_ADMIN_EMAIL || 'olorunfemiayomide045@gmail.com' },
    });

    if (!testUser) {
      console.log('⚠️  Super admin not found. Creating test user...\n');
      
      // Create a test user for email testing
      testUser = userRepo.create({
        email: process.env.SUPER_ADMIN_EMAIL || 'olorunfemiayomide045@gmail.com',
        fullName: 'Test User',
        password: 'TestPassword123!',
        emailVerified: true,
      });
      
      await userRepo.save(testUser);
      console.log('✅ Test user created\n');
    }

    console.log(`📧 Sending test welcome email to: ${testUser.email}`);
    console.log(`🆔 User ID: ${testUser.id}\n`);

    await emailService.sendWelcomeEmail(
      testUser.email,
      testUser.fullName,
      testUser.id
    );

    console.log('\n✅ Email queued successfully!');
    console.log('📬 Check your inbox (and spam folder)\n');
    
    // Give time for queue to process
    console.log('⏳ Waiting for email to be processed...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('==========================================');
    console.log('✅ Test completed!');
    console.log('==========================================\n');
    
    console.log('💡 Tips:');
    console.log('1. Check spam/junk folder if not in inbox');
    console.log('2. Gmail may take 1-2 minutes to deliver');
    console.log('3. Check console for any error messages');
    console.log('4. Verify EMAIL_PASSWORD in .env is your App Password\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('1. Check your EMAIL_USER and EMAIL_PASSWORD in .env');
    console.error('2. Ensure you are using Gmail App Password (not regular password)');
    console.error('3. Verify 2FA is enabled on your Gmail account');
    console.error('4. Create super admin: npm run seed:super-admin\n');
    process.exit(1);
  }
}

testEmail();