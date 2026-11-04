import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '../src/tools/index.js';
import { tokenStore } from '../src/services/token-store.js';
import { linkedInClient } from '../src/services/linkedin.client.js';

describe('Safety & Approval Workflows', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await tokenStore.saveTokens({
      access_token: 'mock_test_token',
      token_type: 'Bearer',
      expires_in: 3600,
      obtained_at: Date.now(),
    });
  });

  describe('Post Creation and Publishing Safety Guardrails', () => {
    it('create_linkedin_post must generate draft and approval ticket without publishing', async () => {
      const publishSpy = vi.spyOn(linkedInClient, 'publishPost');

      const result = (await executeTool('create_linkedin_post', {
        topicOrIdea: 'Launching our new MCP server',
        postFormat: 'announcement',
        visibility: 'PUBLIC',
      })) as any;

      expect(result.status).toBe('DRAFT_CREATED');
      expect(result.draftText).toContain('Excited to announce: Launching our new MCP server!');
      expect(result.approvalTicket).toBeDefined();
      expect(result.approvalTicket.ticketId).toMatch(/^appr_/);
      expect(result.approvalTicket.requiresExplicitApproval).toBe(true);

      // Verify that publishPost was NEVER called (no real publishing)
      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('publish_linkedin_post must reject execution if approved is false', async () => {
      await expect(
        executeTool('publish_linkedin_post', {
          approval_token: 'appr_fake123',
          approved: false,
          postText: 'Unauthorized post',
        })
      ).rejects.toThrow('Publishing aborted: "approved" must be explicitly set to true');
    });

    it('publish_linkedin_post must reject execution if ticket is invalid or expired', async () => {
      await expect(
        executeTool('publish_linkedin_post', {
          approval_token: 'appr_nonexistent',
          approved: true,
          postText: 'Valid text',
        })
      ).rejects.toThrow('Approval ticket "appr_nonexistent" was not found or has expired');
    });

    it('publish_linkedin_post must publish via official API when ticket and approval are valid', async () => {
      // 1. Create draft
      const draftResult = (await executeTool('create_linkedin_post', {
        topicOrIdea: 'AI Agent Workflows',
        postFormat: 'quick_tip',
      })) as any;

      const ticketId = draftResult.approvalTicket.ticketId;
      const exactText = draftResult.draftText;

      // Mock LinkedIn client responses
      const mockPostResponse = {
        id: 'urn:li:share:712398471928371',
        url: 'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A712398471928371/',
        author: 'urn:li:person:usr_linkedin_123',
        commentary: exactText,
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(linkedInClient, 'publishPost').mockResolvedValue(mockPostResponse as any);

      // 2. Publish with approval
      const publishResult = (await executeTool('publish_linkedin_post', {
        approval_token: ticketId,
        approved: true,
        postText: exactText,
        visibility: 'PUBLIC',
      })) as any;

      expect(publishResult.status).toBe('PUBLISHED');
      expect(publishResult.success).toBe(true);
      expect(publishResult.postId).toBe('urn:li:share:712398471928371');
      expect(publishResult.postUrl).toContain('urn%3Ali%3Ashare%3A712398471928371');
    });
  });

  describe('Profile Field Mutating Workflows (Approval + Manual Update Instructions)', () => {
    it('update_my_headline must require approval on first invocation', async () => {
      const response = (await executeTool('update_my_headline', {
        newHeadline: 'Senior AI Engineer | Model Context Protocol Specialist',
      })) as any;

      expect(response.status).toBe('APPROVAL_REQUIRED');
      expect(response.ticketId).toMatch(/^appr_/);
      expect(response.instructions).toContain('SAFETY CONFIRMATION REQUIRED');
    });

    it('update_my_headline must return structured guidance with oneClickEditUrl upon confirmation', async () => {
      const newHeadline = 'Senior AI Engineer | Model Context Protocol Specialist';

      // Step 1: Initial call
      const firstCall = (await executeTool('update_my_headline', {
        newHeadline,
      })) as any;

      const ticketId = firstCall.ticketId;

      // Step 2: Confirmation call
      const confirmCall = (await executeTool('update_my_headline', {
        newHeadline,
        approval_token: ticketId,
        approved: true,
      })) as any;

      expect(confirmCall.status).toBe('MANUAL_UPDATE_REQUIRED');
      expect(confirmCall.approvalConfirmed).toBe(true);
      expect(confirmCall.oneClickEditUrl).toBe('https://www.linkedin.com/in/me/edit/intro/');
      expect(confirmCall.copyPasteContent).toBe(newHeadline);
      expect(confirmCall.reason).toContain('LinkedIn Official API Limitation');
    });
  });

  describe('Permission Limitations & Post Analytics Handling', () => {
    it('analyze_post_performance should explain API restrictions when no metrics supplied', async () => {
      const result = (await executeTool('analyze_post_performance', {})) as any;

      expect(result.status).toBe('PERMISSION_EXPLANATION');
      expect(result.note).toContain('No fabricated metrics returned');
      expect(result.requiredProduct).toContain('Community Management API');
      expect(result.explanation).toContain('strictly restricted by LinkedIn');
    });

    it('analyze_post_performance should compute real engagement rates when sample data provided', async () => {
      const result = (await executeTool('analyze_post_performance', {
        sampleImpressions: 1000,
        sampleReactions: 40,
        sampleComments: 8,
        sampleShares: 2,
      })) as any;

      expect(result.status).toBe('CALCULATED');
      expect(result.metrics.impressions).toBe(1000);
      expect(result.metrics.totalEngagements).toBe(50);
      expect(result.metrics.engagementRate).toBe('5.00%');
      expect(result.benchmarkComparison.performanceGrade).toContain('High Performing');
    });

    it('create_weekly_content_plan should generate structured 5-day schedule', async () => {
      const plan = (await executeTool('create_weekly_content_plan', {
        primaryNiche: 'Distributed Systems',
        postsPerWeek: 5,
      })) as any;

      expect(plan.status).toBe('CONTENT_PLAN_READY');
      expect(plan.schedule.length).toBe(5);
      expect(plan.schedule[0].day).toBe('Monday');
      expect(plan.schedule[4].day).toBe('Friday');
    });

    it('sync_my_resume should detect skills and identify alignment gaps', async () => {
      const sampleResume = `
        Experienced Software Engineer
        Skills: TypeScript, Node.js, Docker, Kubernetes, AWS, PostgreSQL
        Led architecture team and improved response times by 35%.
      `;

      const result = (await executeTool('sync_my_resume', {
        resumeText: sampleResume,
        currentLinkedInSummary: 'General web developer working on frontend apps.',
      })) as any;

      expect(result.status).toBe('SYNC_ANALYSIS_COMPLETE');
      expect(result.detectedKeySkills).toContain('TypeScript');
      expect(result.detectedKeySkills).toContain('Docker');
      expect(result.quantifiableMetricsFound).toBe(true);
      expect(result.identifiedGaps.length).toBeGreaterThan(0);
    });
  });
});
