import { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  getMyProfileSchema,
  handleGetMyProfile,
  analyzeMyProfileSchema,
  handleAnalyzeMyProfile,
  updateMyHeadlineSchema,
  handleUpdateMyHeadline,
  updateMyAboutSchema,
  handleUpdateMyAbout,
  updateMyExperienceSchema,
  handleUpdateMyExperience,
  updateMySkillsSchema,
  handleUpdateMySkills,
  updateMyEducationSchema,
  handleUpdateMyEducation,
  updateMyProjectsSchema,
  handleUpdateMyProjects,
} from './profile.tools.js';
import {
  createLinkedInPostSchema,
  handleCreateLinkedInPost,
  publishLinkedInPostSchema,
  handlePublishLinkedInPost,
  getMyPostsSchema,
  handleGetMyPosts,
  analyzePostPerformanceSchema,
  handleAnalyzePostPerformance,
} from './posts.tools.js';
import {
  generateLinkedInContentSchema,
  handleGenerateLinkedInContent,
  improveMyLinkedInProfileSchema,
  handleImproveMyLinkedInProfile,
  createWeeklyContentPlanSchema,
  handleCreateWeeklyContentPlan,
  syncMyResumeSchema,
  handleSyncMyResume,
} from './branding.tools.js';
import { logger } from '../logger.js';

export interface ToolDefinition {
  tool: Tool;
  handler: (args: any) => Promise<unknown>;
}

export const toolsRegistry: Record<string, ToolDefinition> = {
  // 1. get_my_profile
  get_my_profile: {
    tool: {
      name: 'get_my_profile',
      description:
        'Retrieve your authenticated LinkedIn profile info (name, member ID, email, picture, profile URL) using official OpenID Connect API.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async (args) => {
      const parsed = getMyProfileSchema.parse(args || {});
      return handleGetMyProfile(parsed);
    },
  },

  // 2. analyze_my_profile
  analyze_my_profile: {
    tool: {
      name: 'analyze_my_profile',
      description:
        'Analyze your LinkedIn profile elements (headline, About, experience, education, skills) to identify gaps, calculate health score, and return actionable recommendations.',
      inputSchema: {
        type: 'object',
        properties: {
          currentHeadline: { type: 'string', description: 'Your current LinkedIn headline' },
          currentAbout: { type: 'string', description: 'Your current About section text' },
          experienceSummary: { type: 'string', description: 'Summary of current and past roles' },
          educationSummary: { type: 'string', description: 'Summary of degrees and education' },
          skillsList: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of your current skills',
          },
          targetAudienceOrRole: {
            type: 'string',
            description: 'Target job title, industry, or clientele to attract',
          },
        },
      },
    },
    handler: async (args) => {
      const parsed = analyzeMyProfileSchema.parse(args || {});
      return handleAnalyzeMyProfile(parsed);
    },
  },

  // 3. update_my_headline
  update_my_headline: {
    tool: {
      name: 'update_my_headline',
      description:
        'Update your LinkedIn headline. Enforces human-in-the-loop safety approval, validates length, and generates approved copy-paste text and one-click edit link in compliance with LinkedIn API policies.',
      inputSchema: {
        type: 'object',
        properties: {
          newHeadline: {
            type: 'string',
            description: 'The proposed new headline (5 to 220 characters)',
          },
          approval_token: {
            type: 'string',
            description: 'Approval token issued during proposal review. Required to confirm update.',
          },
          approved: {
            type: 'boolean',
            description: 'Must be explicitly true to confirm applying the headline.',
          },
        },
        required: ['newHeadline'],
      },
    },
    handler: async (args) => {
      const parsed = updateMyHeadlineSchema.parse(args);
      return handleUpdateMyHeadline(parsed);
    },
  },

  // 4. update_my_about
  update_my_about: {
    tool: {
      name: 'update_my_about',
      description:
        'Update your LinkedIn About/Summary section. Requires explicit user approval, preserves factual integrity, and provides formatted text and direct edit link.',
      inputSchema: {
        type: 'object',
        properties: {
          newAbout: {
            type: 'string',
            description: 'The proposed new About summary (20 to 2600 characters)',
          },
          approval_token: {
            type: 'string',
            description: 'Approval token issued during proposal review. Required to confirm update.',
          },
          approved: {
            type: 'boolean',
            description: 'Must be explicitly true to confirm update.',
          },
        },
        required: ['newAbout'],
      },
    },
    handler: async (args) => {
      const parsed = updateMyAboutSchema.parse(args);
      return handleUpdateMyAbout(parsed);
    },
  },

  // 5. update_my_experience
  update_my_experience: {
    tool: {
      name: 'update_my_experience',
      description:
        'Manage professional experience entries. Enforces factual consistency, requires explicit user approval, and provides formatted bullet points with direct LinkedIn edit link.',
      inputSchema: {
        type: 'object',
        properties: {
          roleTitle: { type: 'string', description: 'Job title / position' },
          companyName: { type: 'string', description: 'Company or organization name' },
          startDate: { type: 'string', description: 'Start date (e.g. "Jan 2023")' },
          endDate: { type: 'string', description: 'End date or "Present"' },
          descriptionBullets: {
            type: 'array',
            items: { type: 'string' },
            description: 'Bullet points detailing measurable achievements',
          },
          location: { type: 'string', description: 'Role location (optional)' },
          approval_token: { type: 'string', description: 'Approval token required to confirm' },
          approved: { type: 'boolean', description: 'Must be true to confirm' },
        },
        required: ['roleTitle', 'companyName', 'startDate', 'descriptionBullets'],
      },
    },
    handler: async (args) => {
      const parsed = updateMyExperienceSchema.parse(args);
      return handleUpdateMyExperience(parsed);
    },
  },

  // 6. update_my_skills
  update_my_skills: {
    tool: {
      name: 'update_my_skills',
      description:
        'Update LinkedIn skills list with verified technologies. Requires explicit approval and generates one-click navigation to add skills on LinkedIn.',
      inputSchema: {
        type: 'object',
        properties: {
          skillsToAdd: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of skills to add to your LinkedIn profile',
          },
          approval_token: { type: 'string', description: 'Approval token required to confirm' },
          approved: { type: 'boolean', description: 'Must be true to confirm' },
        },
        required: ['skillsToAdd'],
      },
    },
    handler: async (args) => {
      const parsed = updateMySkillsSchema.parse(args);
      return handleUpdateMySkills(parsed);
    },
  },

  // 7. update_my_education
  update_my_education: {
    tool: {
      name: 'update_my_education',
      description:
        'Update education credentials and academic institutions. Requires explicit approval and provides formatted entry for LinkedIn.',
      inputSchema: {
        type: 'object',
        properties: {
          schoolName: { type: 'string', description: 'Name of the institution' },
          degreeName: { type: 'string', description: 'Degree or credential obtained' },
          fieldOfStudy: { type: 'string', description: 'Field of study or major' },
          startDate: { type: 'string', description: 'Start year' },
          endDate: { type: 'string', description: 'End year or expected graduation' },
          activitiesOrNotes: { type: 'string', description: 'Honors, thesis, or activities' },
          approval_token: { type: 'string', description: 'Approval token required to confirm' },
          approved: { type: 'boolean', description: 'Must be true to confirm' },
        },
        required: ['schoolName'],
      },
    },
    handler: async (args) => {
      const parsed = updateMyEducationSchema.parse(args);
      return handleUpdateMyEducation(parsed);
    },
  },

  // 8. update_my_projects
  update_my_projects: {
    tool: {
      name: 'update_my_projects',
      description:
        'Add or update showcased technical projects on your LinkedIn profile. Validates URLs and provides structured manual update links.',
      inputSchema: {
        type: 'object',
        properties: {
          projectTitle: { type: 'string', description: 'Title of the project' },
          description: { type: 'string', description: 'Detailed description and business/technical impact' },
          projectUrl: { type: 'string', description: 'Live URL or GitHub repository' },
          skillsUsed: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key technologies used in the project',
          },
          startDate: { type: 'string', description: 'Start date' },
          endDate: { type: 'string', description: 'End date or "Ongoing"' },
          approval_token: { type: 'string', description: 'Approval token required to confirm' },
          approved: { type: 'boolean', description: 'Must be true to confirm' },
        },
        required: ['projectTitle', 'description'],
      },
    },
    handler: async (args) => {
      const parsed = updateMyProjectsSchema.parse(args);
      return handleUpdateMyProjects(parsed);
    },
  },

  // 9. create_linkedin_post
  create_linkedin_post: {
    tool: {
      name: 'create_linkedin_post',
      description:
        'Draft a high-impact LinkedIn post from a topic, idea, or achievement. Generates hooks, hashtags, and an approval ticket for human review. Does NOT publish automatically.',
      inputSchema: {
        type: 'object',
        properties: {
          topicOrIdea: { type: 'string', description: 'Core idea, lesson, or milestone to write about' },
          postFormat: {
            type: 'string',
            enum: ['story', 'technical_deep_dive', 'quick_tip', 'announcement', 'contrarian_take'],
            description: 'Post structure/format',
          },
          targetAudience: { type: 'string', description: 'Target audience (e.g. engineers, recruiters)' },
          includeCallToAction: { type: 'boolean', description: 'Whether to append an engagement question' },
          linkUrl: { type: 'string', description: 'Optional article or resource URL to share' },
          linkTitle: { type: 'string', description: 'Optional title for the link' },
          linkDescription: { type: 'string', description: 'Optional description for the link' },
          visibility: {
            type: 'string',
            enum: ['PUBLIC', 'CONNECTIONS'],
            description: 'Post visibility setting',
          },
        },
        required: ['topicOrIdea'],
      },
    },
    handler: async (args) => {
      const parsed = createLinkedInPostSchema.parse(args);
      return handleCreateLinkedInPost(parsed);
    },
  },

  // 10. publish_linkedin_post
  publish_linkedin_post: {
    tool: {
      name: 'publish_linkedin_post',
      description:
        'Publish an approved post to your LinkedIn feed via official LinkedIn REST API. Strict safety: Requires an approval_token from create_linkedin_post and approved: true.',
      inputSchema: {
        type: 'object',
        properties: {
          approval_token: {
            type: 'string',
            description: 'Approval token generated from create_linkedin_post or initial review',
          },
          approved: {
            type: 'boolean',
            description: 'Must be explicitly true to confirm publication to LinkedIn',
          },
          postText: { type: 'string', description: 'The exact post text approved by the user' },
          visibility: {
            type: 'string',
            enum: ['PUBLIC', 'CONNECTIONS'],
            description: 'Post visibility',
          },
          articleUrl: { type: 'string', description: 'Optional link URL attached to post' },
          articleTitle: { type: 'string', description: 'Optional title for attached link' },
          articleDescription: { type: 'string', description: 'Optional description for attached link' },
        },
        required: ['approval_token', 'approved', 'postText'],
      },
    },
    handler: async (args) => {
      const parsed = publishLinkedInPostSchema.parse(args);
      return handlePublishLinkedInPost(parsed);
    },
  },

  // 11. get_my_posts
  get_my_posts: {
    tool: {
      name: 'get_my_posts',
      description:
        'Retrieve recent posts from your LinkedIn feed using official API if authorized under your developer application permissions.',
      inputSchema: {
        type: 'object',
        properties: {
          count: {
            type: 'number',
            description: 'Number of posts to fetch (1 to 50, default 10)',
          },
        },
      },
    },
    handler: async (args) => {
      const parsed = getMyPostsSchema.parse(args || {});
      return handleGetMyPosts(parsed);
    },
  },

  // 12. analyze_post_performance
  analyze_post_performance: {
    tool: {
      name: 'analyze_post_performance',
      description:
        'Analyze LinkedIn post performance, compute real engagement rates from metrics, and provide honest API permission explanations without fabricating analytics.',
      inputSchema: {
        type: 'object',
        properties: {
          postUrn: { type: 'string', description: 'URN or ID of the post' },
          sampleImpressions: { type: 'number', description: 'Observed impression count from LinkedIn Analytics' },
          sampleReactions: { type: 'number', description: 'Number of likes/reactions' },
          sampleComments: { type: 'number', description: 'Number of comments' },
          sampleShares: { type: 'number', description: 'Number of shares/reposts' },
        },
      },
    },
    handler: async (args) => {
      const parsed = analyzePostPerformanceSchema.parse(args || {});
      return handleAnalyzePostPerformance(parsed);
    },
  },

  // 13. generate_linkedin_content
  generate_linkedin_content: {
    tool: {
      name: 'generate_linkedin_content',
      description:
        'Generate 3 high-impact professional LinkedIn post drafts (Narrative Story, Technical Deep-Dive, Educational Framework) based on real projects, internships, or achievements.',
      inputSchema: {
        type: 'object',
        properties: {
          projectOrExperience: {
            type: 'string',
            description: 'The real project, internship, work experience, or milestone to highlight',
          },
          keyTechnologies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Technologies, tools, or frameworks used',
          },
          metricsOrOutcome: {
            type: 'string',
            description: 'Measurable impact, performance gain, or milestone achieved',
          },
          lessonsLearned: {
            type: 'string',
            description: 'Key technical or architectural takeaway',
          },
          tone: {
            type: 'string',
            enum: ['storytelling', 'thought_leader', 'educational', 'concise'],
            description: 'Tone of voice',
          },
        },
        required: ['projectOrExperience'],
      },
    },
    handler: async (args) => {
      const parsed = generateLinkedInContentSchema.parse(args);
      return handleGenerateLinkedInContent(parsed);
    },
  },

  // 14. improve_my_linkedin_profile
  improve_my_linkedin_profile: {
    tool: {
      name: 'improve_my_linkedin_profile',
      description:
        'Analyze your profile and prepare recommended improvements with before-and-after comparisons for headline and About sections. Does NOT apply changes without approval.',
      inputSchema: {
        type: 'object',
        properties: {
          currentHeadline: { type: 'string', description: 'Your current headline' },
          currentAbout: { type: 'string', description: 'Your current About section text' },
          targetRole: { type: 'string', description: 'Target job title, domain, or specialty' },
          keySkills: {
            type: 'array',
            items: { type: 'string' },
            description: 'Top technical skills to highlight',
          },
          notableAchievement: { type: 'string', description: 'Key career milestone or metric' },
        },
        required: ['currentHeadline', 'targetRole', 'keySkills'],
      },
    },
    handler: async (args) => {
      const parsed = improveMyLinkedInProfileSchema.parse(args);
      return handleImproveMyLinkedInProfile(parsed);
    },
  },

  // 15. create_weekly_content_plan
  create_weekly_content_plan: {
    tool: {
      name: 'create_weekly_content_plan',
      description:
        'Generate a structured weekly LinkedIn content calendar with hooks, formats, and scheduling guidance across software engineering and AI topics.',
      inputSchema: {
        type: 'object',
        properties: {
          primaryNiche: {
            type: 'string',
            description: 'Your primary focus (e.g. "Software Architecture", "AI Systems")',
          },
          currentProjectsOrTopics: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of projects, tools, or ideas to feature throughout the week',
          },
          postsPerWeek: {
            type: 'number',
            description: 'Number of posts per week (3 to 7, default 5)',
          },
        },
      },
    },
    handler: async (args) => {
      const parsed = createWeeklyContentPlanSchema.parse(args || {});
      return handleCreateWeeklyContentPlan(parsed);
    },
  },

  // 16. sync_my_resume
  sync_my_resume: {
    tool: {
      name: 'sync_my_resume',
      description:
        'Accept resume text, detect key skills and measurable outcomes, compare with LinkedIn summary, identify discrepancies, and suggest alignment corrections.',
      inputSchema: {
        type: 'object',
        properties: {
          resumeText: { type: 'string', description: 'Full plain text of your resume or CV' },
          currentLinkedInSummary: {
            type: 'string',
            description: 'Your current LinkedIn summary or profile text',
          },
          targetRole: { type: 'string', description: 'Target role or career objective' },
        },
        required: ['resumeText'],
      },
    },
    handler: async (args) => {
      const parsed = syncMyResumeSchema.parse(args);
      return handleSyncMyResume(parsed);
    },
  },
};

export function getAllToolDefinitions(): Tool[] {
  return Object.values(toolsRegistry).map((entry) => entry.tool);
}

export async function executeTool(name: string, args: any): Promise<unknown> {
  const toolEntry = toolsRegistry[name];
  if (!toolEntry) {
    throw new Error(`Tool "${name}" is not registered on this LinkedIn MCP server.`);
  }

  logger.info(`Executing MCP tool: ${name}`);
  return await toolEntry.handler(args);
}
