import { describe, it, expect, beforeEach } from 'vitest';
import { ApprovalService } from '../src/services/approval.service.js';

describe('ApprovalService', () => {
  let approvalService: ApprovalService;

  beforeEach(() => {
    approvalService = new ApprovalService();
  });

  it('should generate an approval ticket with hash and expiration', () => {
    const ticket = approvalService.createTicket({
      action: 'publish_linkedin_post',
      description: 'Test post',
      originalContent: null,
      proposedContent: { text: 'Excited to announce my new project!' },
      changesSummary: ['Publishing 1 new post'],
      ttlMs: 60000,
    });

    expect(ticket.ticketId).toMatch(/^appr_/);
    expect(ticket.approved).toBe(false);
    expect(ticket.executed).toBe(false);
    expect(ticket.payloadHash).toBeDefined();

    const formatted = approvalService.formatApprovalRequiredResponse(ticket);
    expect(formatted.status).toBe('APPROVAL_REQUIRED');
    expect(formatted.ticketId).toBe(ticket.ticketId);
    expect(formatted.instructions).toContain(ticket.ticketId);
  });

  it('should validate and consume ticket successfully for exact payload', () => {
    const payload = { text: 'Official post content' };
    const ticket = approvalService.createTicket({
      action: 'publish_linkedin_post',
      description: 'Post description',
      originalContent: null,
      proposedContent: payload,
      changesSummary: ['Publishing post'],
    });

    const validation = approvalService.validateAndConsumeTicket(
      ticket.ticketId,
      'publish_linkedin_post',
      payload
    );

    expect(validation.valid).toBe(true);
    expect(validation.ticket?.executed).toBe(true);
  });

  it('should reject ticket if payload was modified (tampering protection)', () => {
    const originalPayload = { text: 'Friendly harmless post' };
    const tamperedPayload = { text: 'Malicious modified post' };

    const ticket = approvalService.createTicket({
      action: 'publish_linkedin_post',
      description: 'Review post',
      originalContent: null,
      proposedContent: originalPayload,
      changesSummary: ['Draft post'],
    });

    const validation = approvalService.validateAndConsumeTicket(
      ticket.ticketId,
      'publish_linkedin_post',
      tamperedPayload
    );

    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('Approval rejected: Proposed content does not match');
  });

  it('should prevent replay attacks by rejecting already consumed ticket', () => {
    const payload = { headline: 'Senior Staff Engineer' };
    const ticket = approvalService.createTicket({
      action: 'update_my_headline',
      description: 'Headline update',
      originalContent: 'Staff Engineer',
      proposedContent: payload,
      changesSummary: ['Update title'],
    });

    // First use: Valid
    const firstUse = approvalService.validateAndConsumeTicket(
      ticket.ticketId,
      'update_my_headline',
      payload
    );
    expect(firstUse.valid).toBe(true);

    // Second use: Rejected!
    const secondUse = approvalService.validateAndConsumeTicket(
      ticket.ticketId,
      'update_my_headline',
      payload
    );
    expect(secondUse.valid).toBe(false);
    expect(secondUse.reason).toContain('has already been used');
  });

  it('should reject expired ticket', () => {
    const payload = { headline: 'Expired' };
    const ticket = approvalService.createTicket({
      action: 'update_my_headline',
      description: 'Expired ticket test',
      originalContent: 'Old',
      proposedContent: payload,
      changesSummary: ['Quick change'],
      ttlMs: -1000, // Expired immediately
    });

    const validation = approvalService.validateAndConsumeTicket(
      ticket.ticketId,
      'update_my_headline',
      payload
    );

    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('was not found or has expired');
  });

  it('should reject action mismatch', () => {
    const payload = { text: 'Some text' };
    const ticket = approvalService.createTicket({
      action: 'update_my_about',
      description: 'About update',
      originalContent: 'Old About',
      proposedContent: payload,
      changesSummary: ['Update about'],
    });

    const validation = approvalService.validateAndConsumeTicket(
      ticket.ticketId,
      'publish_linkedin_post', // Wrong action
      payload
    );

    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain('attempted to execute');
  });
});

