import { ApprovalTicket, ModifyingAction, ApprovalRequestResponse } from '../types/approval.types.js';
import { cryptoService } from './crypto.service.js';
import { logger } from '../logger.js';

export class ApprovalService {
  private tickets: Map<string, ApprovalTicket<any, any>> = new Map();
  private readonly defaultTtlMs = 15 * 60 * 1000; // 15 minutes TTL

  /**
   * Creates a cryptographically indexed approval ticket for a mutating action
   */
  public createTicket<TOriginal = unknown, TProposed = unknown>(params: {
    action: ModifyingAction;
    description: string;
    originalContent: TOriginal;
    proposedContent: TProposed;
    changesSummary: string[];
    ttlMs?: number;
  }): ApprovalTicket<TProposed, TOriginal> {
    this.cleanExpiredTickets();

    const ticketId = `appr_${cryptoService.generateSecureToken(8)}`;
    const now = Date.now();
    const expiresAt = now + (params.ttlMs || this.defaultTtlMs);
    const payloadHash = cryptoService.hashPayload(params.proposedContent);

    const ticket: ApprovalTicket<TProposed, TOriginal> = {
      ticketId,
      action: params.action,
      description: params.description,
      originalContent: params.originalContent,
      proposedContent: params.proposedContent,
      changesSummary: params.changesSummary,
      payloadHash,
      createdAt: now,
      expiresAt,
      approved: false,
      executed: false,
    };

    this.tickets.set(ticketId, ticket as ApprovalTicket);
    logger.info(`Generated approval ticket ${ticketId} for action ${params.action}`);

    return ticket;
  }

  /**
   * Formats a standard MCP response instructing Claude and the user to confirm the action
   */
  public formatApprovalRequiredResponse(ticket: ApprovalTicket): ApprovalRequestResponse {
    const remainingMinutes = Math.max(1, Math.round((ticket.expiresAt - Date.now()) / 60000));
    return {
      status: 'APPROVAL_REQUIRED',
      ticketId: ticket.ticketId,
      action: ticket.action,
      originalContent: ticket.originalContent,
      proposedContent: ticket.proposedContent,
      diffSummary: ticket.changesSummary,
      expiresInMinutes: remainingMinutes,
      instructions: `SAFETY CONFIRMATION REQUIRED: Please review the proposed changes above. To execute this change, call "${ticket.action}" again with parameter approval_token: "${ticket.ticketId}" and approved: true.`,
    };
  }

  /**
   * Validates an approval ticket before execution, verifying payload hash and expiry,
   * and consumes it to prevent replay attacks.
   */
  public validateAndConsumeTicket(
    ticketId: string,
    expectedAction: ModifyingAction,
    currentPayload: unknown
  ): { valid: boolean; reason?: string; ticket?: ApprovalTicket } {
    this.cleanExpiredTickets();

    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      return {
        valid: false,
        reason: `Approval ticket "${ticketId}" was not found or has expired. Please initiate the request again to generate a new ticket.`,
      };
    }

    if (ticket.executed) {
      return {
        valid: false,
        reason: `Approval ticket "${ticketId}" has already been used. Each action requires fresh confirmation.`,
      };
    }

    if (Date.now() > ticket.expiresAt) {
      this.tickets.delete(ticketId);
      return {
        valid: false,
        reason: `Approval ticket "${ticketId}" expired at ${new Date(ticket.expiresAt).toISOString()}. Please initiate the action again.`,
      };
    }

    if (ticket.action !== expectedAction) {
      return {
        valid: false,
        reason: `Approval ticket "${ticketId}" was issued for action "${ticket.action}", but attempted to execute "${expectedAction}".`,
      };
    }

    // Verify payload integrity: Ensure the user is executing EXACTLY what was approved
    if (currentPayload !== undefined && currentPayload !== null) {
      const currentHash = cryptoService.hashPayload(currentPayload);
      if (currentHash !== ticket.payloadHash) {
        return {
          valid: false,
          reason: `Approval rejected: Proposed content does not match the content that was approved under ticket "${ticketId}". Any modification requires a new approval.`,
        };
      }
    }

    // Mark as consumed
    ticket.approved = true;
    ticket.executed = true;
    logger.info(`Approval ticket ${ticketId} consumed successfully for action ${expectedAction}`);

    return { valid: true, ticket };
  }

  public getTicket(ticketId: string): ApprovalTicket | undefined {
    return this.tickets.get(ticketId);
  }

  public cleanExpiredTickets(): void {
    const now = Date.now();
    for (const [id, ticket] of this.tickets.entries()) {
      if (now > ticket.expiresAt) {
        this.tickets.delete(id);
      }
    }
  }

  public clearAll(): void {
    this.tickets.clear();
  }
}

export const approvalService = new ApprovalService();
