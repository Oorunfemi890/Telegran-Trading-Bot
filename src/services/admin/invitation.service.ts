// FILE: src/services/admin/invitation.service.ts
// =============================================
// PHASE 11: ADMIN INVITATION MANAGEMENT SERVICE
// =============================================

import AppDataSource from '../../config/database.config';
import { InvitationCode } from '../../database/entities/InvitationCode.entity';
import { User } from '../../database/entities/User.entity';
import { InvitationCodeStatus, SubscriptionTier } from '../../types';
import { 
  generateInvitationCode, 
  calculateExpiryDate 
} from '../../helpers/invitation.helper';
import { EmailService } from '../email.service';
import { Between, In } from 'typeorm';

export interface CreateInvitationDTO {
  tier: SubscriptionTier;
  price: number;
  maxUses: number;
  expiryDays: number;
  customerEmail?: string;
  notes?: string;
  generatedById: string;
}

export interface BulkCreateDTO {
  tier: SubscriptionTier;
  price: number;
  count: number;
  maxUses: number;
  expiryDays: number;
  generatedById: string;
}

export interface InvitationFilters {
  status?: InvitationCodeStatus;
  tier?: SubscriptionTier;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasEmail?: boolean;
}

export class AdminInvitationService {
  private invitationRepo = AppDataSource.getRepository(InvitationCode);
  private userRepo = AppDataSource.getRepository(User);
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Generate a single invitation code
   */
  async createInvitation(data: CreateInvitationDTO): Promise<InvitationCode> {
    const code = generateInvitationCode();
    const expiresAt = data.expiryDays > 0 
      ? calculateExpiryDate(data.expiryDays) 
      : null;

    const invitation = this.invitationRepo.create({
      code,
      tier: data.tier,
      price: data.price,
      maxUses: data.maxUses,
      currentUses: 0,
      expiresAt,
      status: InvitationCodeStatus.ACTIVE,
      customerEmail: data.customerEmail || null,
      notes: data.notes || null,
      generated_by_id: data.generatedById,
    });

    await this.invitationRepo.save(invitation);

    // Send email if customer email provided
    if (data.customerEmail) {
      await this.sendInvitationEmail(invitation, data.customerEmail);
    }

    return invitation;
  }

  /**
   * Bulk generate invitation codes
   */
  async bulkCreateInvitations(data: BulkCreateDTO): Promise<InvitationCode[]> {
    const codes: InvitationCode[] = [];
    const expiresAt = data.expiryDays > 0 
      ? calculateExpiryDate(data.expiryDays) 
      : null;

    for (let i = 0; i < data.count; i++) {
      const code = generateInvitationCode();
      
      const invitation = this.invitationRepo.create({
        code,
        tier: data.tier,
        price: data.price,
        maxUses: data.maxUses,
        currentUses: 0,
        expiresAt,
        status: InvitationCodeStatus.ACTIVE,
        generated_by_id: data.generatedById,
      });

      codes.push(invitation);
    }

    await this.invitationRepo.save(codes);
    return codes;
  }

  /**
   * Get all invitations with filters and pagination
   */
  async getAllInvitations(
    filters: InvitationFilters,
    page: number = 1,
    limit: number = 50
  ) {
    const query = this.invitationRepo
      .createQueryBuilder('invitation')
      .leftJoinAndSelect('invitation.generatedBy', 'generatedBy')
      .leftJoinAndSelect('invitation.usedByUsers', 'usedByUsers');

    // Apply filters
    if (filters.status) {
      query.andWhere('invitation.status = :status', { status: filters.status });
    }

    if (filters.tier) {
      query.andWhere('invitation.tier = :tier', { tier: filters.tier });
    }

    if (filters.search) {
      query.andWhere(
        '(invitation.code LIKE :search OR invitation.customerEmail LIKE :search OR invitation.notes LIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    if (filters.dateFrom && filters.dateTo) {
      query.andWhere('invitation.createdAt BETWEEN :dateFrom AND :dateTo', {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
    }

    if (filters.hasEmail !== undefined) {
      if (filters.hasEmail) {
        query.andWhere('invitation.customerEmail IS NOT NULL');
      } else {
        query.andWhere('invitation.customerEmail IS NULL');
      }
    }

    // Count total
    const total = await query.getCount();

    // Pagination
    const invitations = await query
      .orderBy('invitation.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      invitations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get invitation by ID
   */
  async getInvitationById(id: string): Promise<InvitationCode> {
    const invitation = await this.invitationRepo.findOne({
      where: { id },
      relations: ['generatedBy', 'usedByUsers'],
    });

    if (!invitation) {
      throw new Error('Invitation code not found');
    }

    return invitation;
  }

  /**
   * Get invitation by code
   */
  async getInvitationByCode(code: string): Promise<InvitationCode> {
    const invitation = await this.invitationRepo.findOne({
      where: { code },
      relations: ['usedByUsers'],
    });

    if (!invitation) {
      throw new Error('Invitation code not found');
    }

    return invitation;
  }

  /**
   * Update invitation
   */
  async updateInvitation(
    id: string,
    updates: Partial<{
      maxUses: number;
      expiresAt: Date | null;
      customerEmail: string | null;
      notes: string | null;
      price: number;
    }>
  ): Promise<InvitationCode> {
    const invitation = await this.getInvitationById(id);

    Object.assign(invitation, updates);

    await this.invitationRepo.save(invitation);

    return invitation;
  }

  /**
   * Revoke invitation
   */
  async revokeInvitation(id: string): Promise<InvitationCode> {
    const invitation = await this.getInvitationById(id);

    invitation.status = InvitationCodeStatus.REVOKED;
    await this.invitationRepo.save(invitation);

    return invitation;
  }

  /**
   * Delete invitation (hard delete)
   */
  async deleteInvitation(id: string): Promise<void> {
    const invitation = await this.getInvitationById(id);

    if (invitation.currentUses > 0) {
      throw new Error('Cannot delete invitation that has been used');
    }

    await this.invitationRepo.remove(invitation);
  }

  /**
   * Get invitation statistics
   */
  async getStatistics(): Promise<any> {
    const [
      total,
      active,
      used,
      expired,
      revoked,
      totalRevenue,
      usedCodes,
    ] = await Promise.all([
      this.invitationRepo.count(),
      this.invitationRepo.count({ 
        where: { status: InvitationCodeStatus.ACTIVE } 
      }),
      this.invitationRepo.count({ 
        where: { status: InvitationCodeStatus.USED } 
      }),
      this.invitationRepo.count({ 
        where: { status: InvitationCodeStatus.EXPIRED } 
      }),
      this.invitationRepo.count({ 
        where: { status: InvitationCodeStatus.REVOKED } 
      }),
      this.calculateTotalRevenue(),
      this.getUsedCodesWithUsers(),
    ]);

    // Revenue by tier
    const revenueByTier = await this.getRevenueByTier();

    // Usage trends (last 30 days)
    const usageTrends = await this.getUsageTrends();

    return {
      overview: {
        total,
        active,
        used,
        expired,
        revoked,
        conversionRate: total > 0 ? (used / total) * 100 : 0,
      },
      revenue: {
        total: totalRevenue,
        byTier: revenueByTier,
      },
      recentActivity: usedCodes.slice(0, 10),
      trends: usageTrends,
    };
  }

  /**
   * Calculate total revenue from used codes
   */
  private async calculateTotalRevenue(): Promise<number> {
    const result = await this.invitationRepo
      .createQueryBuilder('invitation')
      .select('SUM(invitation.price * invitation.currentUses)', 'total')
      .where('invitation.currentUses > 0')
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  /**
   * Get revenue breakdown by tier
   */
  private async getRevenueByTier(): Promise<any[]> {
    const result = await this.invitationRepo
      .createQueryBuilder('invitation')
      .select('invitation.tier', 'tier')
      .addSelect('SUM(invitation.price * invitation.currentUses)', 'revenue')
      .addSelect('COUNT(*)', 'count')
      .where('invitation.currentUses > 0')
      .groupBy('invitation.tier')
      .getRawMany();

    return result.map(r => ({
      tier: r.tier,
      revenue: parseFloat(r.revenue || '0'),
      count: parseInt(r.count || '0'),
    }));
  }

  /**
   * Get usage trends for last 30 days
   */
  private async getUsageTrends(): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const users = await this.userRepo.find({
      where: {
        createdAt: Between(thirtyDaysAgo, new Date()),
      },
      relations: ['invitationCode'],
      order: { createdAt: 'ASC' },
    });

    // Group by day
    const trends: { [key: string]: number } = {};
    
    users.forEach(user => {
      const date = user.createdAt.toISOString().split('T')[0];
      trends[date] = (trends[date] || 0) + 1;
    });

    return Object.entries(trends).map(([date, count]) => ({
      date,
      registrations: count,
    }));
  }

  /**
   * Get used codes with user information
   */
  private async getUsedCodesWithUsers() {
    return await this.invitationRepo.find({
      where: { 
        status: In([InvitationCodeStatus.USED, InvitationCodeStatus.ACTIVE]),
        currentUses: Between(1, 999999),
      },
      relations: ['usedByUsers'],
      order: { usedAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    invitation: InvitationCode,
    email: string
  ): Promise<void> {
    try {
      await this.emailService.sendInvitationCodeEmail({
        customerName: email.split('@')[0],
        customerEmail: email,
        invitationCode: invitation.code,
        tier: invitation.tier,
        price: invitation.price,
        expiresAt: invitation.expiresAt,
        maxUses: invitation.maxUses,
      });
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Don't throw - code was created successfully
    }
  }

  /**
   * Resend invitation email
   */
  async resendInvitationEmail(id: string): Promise<void> {
    const invitation = await this.getInvitationById(id);

    if (!invitation.customerEmail) {
      throw new Error('No email address associated with this invitation');
    }

    await this.sendInvitationEmail(invitation, invitation.customerEmail);
  }

  /**
   * Export invitations to CSV
   */
  async exportToCSV(filters: InvitationFilters): Promise<string> {
    const { invitations } = await this.getAllInvitations(filters, 1, 10000);

    const headers = [
      'Code',
      'Tier',
      'Price',
      'Status',
      'Max Uses',
      'Current Uses',
      'Customer Email',
      'Created At',
      'Expires At',
      'Used At',
      'Notes',
    ].join(',');

    const rows = invitations.map(inv => [
      inv.code,
      inv.tier,
      inv.price,
      inv.status,
      inv.maxUses,
      inv.currentUses,
      inv.customerEmail || '',
      inv.createdAt.toISOString(),
      inv.expiresAt?.toISOString() || '',
      inv.usedAt?.toISOString() || '',
      inv.notes || '',
    ].join(','));

    return [headers, ...rows].join('\n');
  }
}