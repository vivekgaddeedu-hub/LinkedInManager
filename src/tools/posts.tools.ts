import { z } from 'zod';
import { linkedInClient } from '../services/linkedin.client.js';
import { approvalService } from '../services/approval.service.js';

/**
 * 9. create_linkedin_post
 * Prepares and formats a professional LinkedIn post draft.
 * Never publishes automatically; generates a safety approval ticket.
 */
export const createLinkedInPostSchema = z.object({
  topicOrIdea: z.string().describe('Core topic, achievement, insight, or announcement to write about'),
  postFormat: z
    .enum(['story', 'technical_deep_dive', 'quick_tip', 'announcement', 'contrarian_take'])
    .default('story')
    .describe('Style/format of the post'),
  targetAudience: z.string().optional().describe('Target audience (e.g. software engineers, founders, recruiters)'),
  includeCallToAction: z.boolean().default(true).describe('Whether to end with an engaging question or call to action'),
  linkUrl: z.string().url().optional().describe('Optional link/article URL to share with the post'),
  linkTitle: z.string().optional().describe('Title for the link preview'),
  linkDescription: z.string().optional().describe('Description for the link preview'),
  visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC').describe('Post visibility'),
});

export async function handleCreateLinkedInPost(args: z.infer<typeof createLinkedInPostSchema>) {
  // Generate structured, high-engagement LinkedIn copy
  let hook = '';
  let bodyContent = '';
  let cta = '';
  let hashtags = '#SoftwareEngineering #TechCareers #ContinuousLearning';

  if (args.postFormat === 'story') {
    hook = `Most people think success in tech is linear.\nHere's what I actually learned while building ${args.topicOrIdea}:`;
    bodyContent = `\n\n1. Initial assumption vs reality.\n2. The unexpected technical hurdle.\n3. The breakthrough moment.\n\nThe biggest takeaway? Consistency and ruthless focus on fundamentals beat raw talent every single time.`;
    cta = args.includeCallToAction
      ? `\n\nHave you encountered a similar challenge in your projects? Let's discuss below.`
      : '';
  } else if (args.postFormat === 'technical_deep_dive') {
    hook = `Deep Dive: Solving ${args.topicOrIdea} in production.\n\nHere is the architectural breakdown and key decisions made:`;
    bodyContent = `\n\n🔹 Problem Context: Bottlenecks and system constraints.\n🔹 Architecture: Separation of concerns, resilience, and trade-offs.\n🔹 Key Results: Measurable improvements in performance and reliability.`;
    cta = args.includeCallToAction
      ? `\n\nHow does your team handle this architectural pattern? Drop your thoughts in the comments.`
      : '';
    hashtags = '#SystemDesign #SoftwareArchitecture #Engineering #CleanCode';
  } else if (args.postFormat === 'quick_tip') {
    hook = `A 2-minute tip that saved hours of debugging on ${args.topicOrIdea}:`;
    bodyContent = `\n\n💡 Pro tip: Always inspect state transitions and isolate side-effects early.\n\nKeep it simple, test boundary conditions, and verify assumptions with real telemetry.`;
    cta = args.includeCallToAction ? `\n\nWhat is your go-to debugging tip? Share below!` : '';
    hashtags = '#DeveloperTips #Coding #Productivity';
  } else if (args.postFormat === 'announcement') {
    hook = `Excited to announce: ${args.topicOrIdea}! 🚀`;
    bodyContent = `\n\nOver the past few weeks, I have been focused on turning an ambitious vision into reality.\n\nKey highlights:\n• High performance & production-grade architecture\n• Built with TypeScript, Node.js, and modern standards\n• Solves real problems for developers and teams`;
    cta = args.includeCallToAction ? `\n\nCheck out the details and let me know your thoughts!` : '';
    hashtags = '#BuildInPublic #TechInnovation #Milestone';
  } else {
    hook = `Unpopular opinion on ${args.topicOrIdea}:`;
    bodyContent = `\n\nMost advice tells you to follow the trend. But here's what the data actually says.\n\nWhen you prioritize end-user value over hype, everything aligns much faster.`;
    cta = args.includeCallToAction ? `\n\nAgree or disagree? I'd love to hear your perspective.` : '';
    hashtags = '#TechTrends #Leadership #SoftwareEngineering';
  }

  const fullPostText = `${hook}${bodyContent}${cta}\n\n${hashtags}`;

  // Package the exact payload for publishing
  const proposedPayload = {
    text: fullPostText,
    visibility: args.visibility,
    articleUrl: args.linkUrl,
    articleTitle: args.linkTitle,
    articleDescription: args.linkDescription,
  };

  // Generate an Approval Ticket for Safety
  const ticket = approvalService.createTicket({
    action: 'publish_linkedin_post',
    description: `Publish post to LinkedIn (${args.visibility})`,
    originalContent: '(No live post - draft creation)',
    proposedContent: proposedPayload,
    changesSummary: [
      `Post format: ${args.postFormat}`,
      `Visibility: ${args.visibility}`,
      `Character count: ${fullPostText.length} characters`,
      args.linkUrl ? `Attached link: ${args.linkUrl}` : 'No external link attached',
      'Action: Publish to authenticated member feed',
    ],
  });

  return {
    status: 'DRAFT_CREATED',
    draftText: fullPostText,
    characterCount: fullPostText.length,
    estimatedReadTime: `${Math.max(1, Math.ceil(fullPostText.split(/\s+/).length / 150))} min`,
    approvalTicket: {
      ticketId: ticket.ticketId,
      expiresInMinutes: 15,
      requiresExplicitApproval: true,
      publishInstructions: `To publish this exact post to LinkedIn, call "publish_linkedin_post" with approval_token: "${ticket.ticketId}" and approved: true.`,
    },
  };
}

/**
 * 10. publish_linkedin_post
 * Publishes a post ONLY upon explicit confirmation and approval token validation.
 */
export const publishLinkedInPostSchema = z.object({
  approval_token: z.string().describe('The approval ticket ID generated from create_linkedin_post or initial review'),
  approved: z.boolean().describe('Must be explicitly true to confirm publication'),
  postText: z.string().min(1).describe('The exact text content of the post to publish'),
  visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC').describe('Post visibility'),
  articleUrl: z.string().url().optional().describe('Optional link URL attached to the post'),
  articleTitle: z.string().optional().describe('Optional title for the link preview'),
  articleDescription: z.string().optional().describe('Optional description for the link preview'),
});

export async function handlePublishLinkedInPost(args: z.infer<typeof publishLinkedInPostSchema>) {
  if (!args.approved) {
    throw new Error(
      'Publishing aborted: "approved" must be explicitly set to true. No post is published without user confirmation.'
    );
  }

  const expectedPayload = {
    text: args.postText,
    visibility: args.visibility,
    articleUrl: args.articleUrl,
    articleTitle: args.articleTitle,
    articleDescription: args.articleDescription,
  };

  // Step 1: Validate and consume approval ticket
  const validation = approvalService.validateAndConsumeTicket(
    args.approval_token,
    'publish_linkedin_post',
    expectedPayload
  );

  if (!validation.valid) {
    throw new Error(`Publish authorization failed: ${validation.reason}`);
  }

  // Step 2: Publish using official LinkedIn API
  const response = await linkedInClient.publishPost({
    text: args.postText,
    visibility: args.visibility,
    articleUrl: args.articleUrl,
    articleTitle: args.articleTitle,
    articleDescription: args.articleDescription,
  });

  return {
    status: 'PUBLISHED',
    success: true,
    postId: response.id,
    postUrl: response.url,
    publishedAt: response.createdAt,
    author: response.author,
    message: 'Your post was successfully published to LinkedIn via the official API.',
  };
}

/**
 * 11. get_my_posts
 * Retrieves recent member posts if authorized under developer permissions.
 */
export const getMyPostsSchema = z.object({
  count: z.number().int().min(1).max(50).default(10).describe('Number of posts to retrieve'),
});

export async function handleGetMyPosts(args: z.infer<typeof getMyPostsSchema>) {
  const result = await linkedInClient.getMyPosts(args.count);
  return result;
}

/**
 * 12. analyze_post_performance
 * Explains and inspects post performance metrics without fabricating numbers.
 */
export const analyzePostPerformanceSchema = z.object({
  postUrn: z.string().optional().describe('The post URN or ID (e.g. "urn:li:share:123456789")'),
  sampleImpressions: z.number().optional().describe('User-provided impression count if manually inspecting analytics'),
  sampleReactions: z.number().optional().describe('User-provided reaction count'),
  sampleComments: z.number().optional().describe('User-provided comment count'),
  sampleShares: z.number().optional().describe('User-provided repost/share count'),
});

export async function handleAnalyzePostPerformance(args: z.infer<typeof analyzePostPerformanceSchema>) {
  // If the user supplied manual metrics, perform real analytical breakdown
  if (args.sampleImpressions !== undefined && args.sampleImpressions > 0) {
    const reactions = args.sampleReactions || 0;
    const comments = args.sampleComments || 0;
    const shares = args.sampleShares || 0;
    const totalEngagements = reactions + comments + shares;
    const engagementRate = ((totalEngagements / args.sampleImpressions) * 100).toFixed(2);

    return {
      status: 'CALCULATED',
      dataGrounded: true,
      metrics: {
        impressions: args.sampleImpressions,
        reactions,
        comments,
        shares,
        totalEngagements,
        engagementRate: `${engagementRate}%`,
      },
      benchmarkComparison: {
        averageLinkedInEngagementRate: '1.5% - 3.0%',
        performanceGrade:
          parseFloat(engagementRate) > 3.0
            ? 'High Performing (Top 10%)'
            : parseFloat(engagementRate) >= 1.5
              ? 'Average Engagement'
              : 'Below Benchmark (Hook & CTA optimization recommended)',
      },
      actionableTips: [
        'Comments drive 3x more algorithmic reach than simple likes. Always reply to comments within the first 2 hours.',
        'Use line breaks to avoid the wall of text on mobile screens.',
        'Include a specific open-ended question at the end to trigger replies.',
      ],
    };
  }

  // Otherwise, return transparent explanation of LinkedIn API permissions
  const apiStatus = linkedInClient.getPostAnalyticsExplanation();
  return {
    status: 'PERMISSION_EXPLANATION',
    note: 'No fabricated metrics returned.',
    ...apiStatus,
    manualInspectionGuide:
      'To view your live post impressions: Open LinkedIn on mobile or web -> Go to your profile -> Click "Analytics & tools" or click "View analytics" directly beneath your published post. You can pass those numbers into this tool to calculate your engagement benchmarks!',
  };
}

