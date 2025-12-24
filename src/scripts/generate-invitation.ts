#!/usr/bin/env ts-node

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

// Load environment variables
config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

// const TIER_PRICES = {
//   [SubscriptionTier.FREE]: 0,
//   [SubscriptionTier.STARTER]: 29,
//   [SubscriptionTier.PRO]: 99,
//   [SubscriptionTier.ENTERPRISE]: 299,
// };

async function generateInvitation() {
  try {
    console.log("\n🎟️  INVITATION CODE GENERATOR\n");
    console.log("==========================================\n");

    // Initialize database
    await AppDataSource.initialize();
    console.log("✅ Database connected\n");

    // Get tier
    console.log("Available Tiers:");
    console.log("1. Free");
    console.log("2. Starter ($29)");
    console.log("3. Pro ($99)");
    console.log("4. Enterprise ($299)\n");

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

    // Get customer email (optional)
    const customerEmail = await question(
      "Customer email (leave empty for anyone): "
    );

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
      customerEmail: customerEmail.trim() || null,
      notes: notes.trim() || null,
      generated_by_id: null, // Will be set when admin generates from dashboard
    });

    await invitationRepo.save(invitation);

    // Display results
    console.log("\n==========================================");
    console.log("✅ INVITATION CODE GENERATED SUCCESSFULLY");
    console.log("==========================================\n");
    console.log(`📋 Code: ${code}`);
    console.log(`🎯 Tier: ${tier}`);
    console.log(`💰 Price: $${price}`);
    console.log(`👥 Max Uses: ${maxUses}`);
    console.log(`📧 Customer Email: ${customerEmail || "Anyone"}`);
    console.log(
      `⏰ Expires: ${expiresAt ? expiresAt.toLocaleDateString() : "Never"}`
    );
    if (notes) {
      console.log(`📝 Notes: ${notes}`);
    }
    console.log("\n==========================================\n");

    // Generate email template preview
    console.log("📧 EMAIL TO SEND TO CUSTOMER:\n");
    console.log("-------------------------------------------");
    console.log(
      `Subject: Your Invitation to ${process.env.APP_NAME || "Trading Bot"}`
    );
    console.log("-------------------------------------------");
    console.log(`
Hi there!

You've been invited to join our exclusive trading bot platform!

Your Invitation Code: ${code}

Tier: ${tier.toUpperCase()}
Price: $${price}

To activate your account:
1. Visit: ${process.env.APP_URL || "http://localhost:3000"}/signup
2. Enter your invitation code: ${code}
3. Complete the registration form

This code ${expiresAt ? `expires on ${expiresAt.toLocaleDateString()}` : "never expires"} and can be used ${maxUses} time${maxUses > 1 ? "s" : ""}.

Questions? Reply to this email!

Best regards,
The Trading Bot Team
    `);
    console.log("-------------------------------------------\n");

    // Option to generate another
    const generateAnother = await question("Generate another code? (y/n): ");
    if (generateAnother.toLowerCase() === "y") {
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
