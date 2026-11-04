/**
 * Safety & Approval System Types
 * Enforces strict human-in-the-loop confirmation before mutating actions.
 */

export type ModifyingAction =
  | 'update_my_headline'
  | 'update_my_about'
  | 'update_my_experience'
  | 'update_my_skills'
  | 'update_my_education'
  | 'update_my_projects'
  | 'publish_linkedin_post'
  | 'delete_content';

export interface ApprovalTicket<TProposed = unknown, TOriginal = unknown> {
  ticketId: string;
  action: ModifyingAction;
  description: string;
  originalContent: TOriginal;
  proposedContent: TProposed;
  changesSummary: string[];
  payloadHash: string;
  createdAt: number;
  expiresAt: number;
  approved: boolean;
  executed: boolean;
}

export interface ApprovalRequestResponse {
  status: 'APPROVAL_REQUIRED';
  ticketId: string;
  action: ModifyingAction;
  originalContent: unknown;
  proposedContent: unknown;
  diffSummary: string[];
  expiresInMinutes: number;
  instructions: string;
}

export interface ExecutionResult<T = unknown> {
  status: 'SUCCESS' | 'FAILED' | 'MANUAL_UPDATE_REQUIRED';
  action: string;
  ticketId?: string;
  data?: T;
  message: string;
  externalUrl?: string;
  details?: Record<string, unknown>;
}
