#!/usr/bin/env ts-node

// FILE: src/scripts/generate-invitation.ts
// =============================================

import "reflect-metadata";
import { config } from "dotenv";
import * as readline from "readline";
import AppDataSource from "../config/database.config";
import { InvitationCode } from "../database/entities/InvitationCode.entity";
import { SubscriptionTier, InvitationCodeStatus } from "../types";
import {
  generateInvitationCode,
  calculateExpiryDate,
} from "../helpers/invitation.helper";
import { EmailService } from "../services/email.service";
import { initializeRedis } from "../config/redis.config";

config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

const TIER_PRICES: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.STARTER]: 29,
  [SubscriptionTier.PRO]: 99,
  [SubscriptionTier.ENTERPRISE]: 299,
};

async function generateInvitation() {
  try {
    console.log("\n🎟️  INVITATION CODE GENERATOR\n");
    console.log("==========================================\n");

    // Initialize database and Redis
    await AppDataSource.initialize();
    console.log("✅ Database connected");

    await initializeRedis();
    console.log("✅ Redis initialized\n");

    const emailService = new EmailService();

    // Get tier
    console.log("Available Tiers:");
    console.log("1. Free ($0) - Basic features");
    console.log("2. Starter ($29) - 3 channels, 5 positions");
    console.log("3. Pro ($99) - Unlimited channels, 10 positions");
    console.log("4. Enterprise ($299) - Everything + priority support\n");

    const tierChoice = await question("Select tier (1-4): ");
    let tier: SubscriptionTier;
    let price: number;

    switch (tierChoice.trim()) {
      case "1":
        tier = SubscriptionTier.FREE;
        price = 0;
        break;
      case "2":
        tier = SubscriptionTier.STARTER;
        price = 29;
        break;
      case "3":
        tier = SubscriptionTier.PRO;
        price = 99;
        break;
      case "4":
        tier = SubscriptionTier.ENTERPRISE;
        price = 299;
        break;
      default:
        console.log("❌ Invalid choice, defaulting to Starter");
        tier = SubscriptionTier.STARTER;
        price = 29;
    }

    // Get customer details
    const customerEmail = await question("Customer email: ");
    const customerName = await question("Customer name: ");

    if (!customerEmail || !customerEmail.includes("@")) {
      console.log("❌ Invalid email address");
      rl.close();
      await AppDataSource.destroy();
      process.exit(1);
    }

    // Get max uses
    const maxUsesInput = await question("Max uses (default: 1): ");
    const maxUses = parseInt(maxUsesInput) || 1;

    // Get expiry days
    const expiryDaysInput = await question(
      "Expiry in days (default: 30, 0 for never): "
    );
    const expiryDays = parseInt(expiryDaysInput) || 30;
    const expiresAt = expiryDays > 0 ? calculateExpiryDate(expiryDays) : null;

    // Get notes
    const notes = await question("Notes (optional): ");

    // Generate code
    const code = generateInvitationCode();

    // Create invitation
    const invitationRepo = AppDataSource.getRepository(InvitationCode);
    const invitation = invitationRepo.create({
      code,
      tier,
      price,
      maxUses,
      currentUses: 0,
      expiresAt,
      status: InvitationCodeStatus.ACTIVE,
      customerEmail: customerEmail.trim(),
      notes: notes.trim() || null,
      generated_by_id: null,
    });

    await invitationRepo.save(invitation);

    console.log("\n==========================================");
    console.log("✅ INVITATION CODE GENERATED SUCCESSFULLY");
    console.log("==========================================\n");
    console.log(`📋 Code: ${code}`);
    console.log(`🎯 Tier: ${tier}`);
    console.log(`💰 Price: $${price}`);
    console.log(`👥 Max Uses: ${maxUses}`);
    console.log(`📧 Customer: ${customerName} <${customerEmail}>`);
    console.log(
      `⏰ Expires: ${expiresAt ? expiresAt.toLocaleDateString() : "Never"}`
    );
    if (notes) {
      console.log(`📝 Notes: ${notes}`);
    }
    console.log("\n==========================================\n");

    // Send email to customer
    console.log("📧 Sending invitation email to customer...\n");

    try {
      await emailService.sendInvitationCodeEmail({
        customerName,
        customerEmail,
        invitationCode: code,
        tier,
        price,
        expiresAt,
        maxUses,
      });

      console.log("✅ Invitation email sent successfully!");
      console.log(`📬 Email sent to: ${customerEmail}\n`);
    } catch (emailError) {
      console.log("⚠️  Email send failed (but code was created):", emailError);
      console.log("💡 You can manually send the code to the customer\n");
    }

    // Display email preview
    console.log("==========================================");
    console.log("📧 EMAIL PREVIEW");
    console.log("==========================================");
    console.log(`To: ${customerEmail}`);
    console.log(
      `Subject: Your Trading Bot Invitation Code - ${tier.toUpperCase()} Plan`
    );
    console.log("-------------------------------------------");
    console.log(`
Hi ${customerName},

Thank you for purchasing the ${tier.toUpperCase()} plan!

Your Invitation Code: ${code}

Plan Details:
- Tier: ${tier.toUpperCase()}
- Price: $${price}
- Expires: ${expiresAt ? expiresAt.toLocaleDateString() : "Never"}

Get Started:
1. Visit ${process.env.APP_URL || "http://localhost:3000"}/register
2. Enter your invitation code: ${code}
3. Create your account and start trading!

The customer will receive a detailed email with:
- Registration link with pre-filled code
- What happens after registration
- How to connect Telegram and MetaTrader
- Complete setup instructions

Questions? Reply to this email.

Best regards,
The Trading Bot Team
    `);
    console.log("-------------------------------------------\n");

    // Option to generate another
    const generateAnother = await question("Generate another code? (y/n): ");
    if (generateAnother.toLowerCase() === "y") {
      console.log("\n");
      rl.close();
      await AppDataSource.destroy();
      // Restart the script
      process.exit(0);
    } else {
      await AppDataSource.destroy();
      rl.close();
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Error generating invitation:", error);
    await AppDataSource.destroy();
    rl.close();
    process.exit(1);
  }
}

// Run the generator
generateInvitation();
