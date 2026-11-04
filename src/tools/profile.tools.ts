import { z } from 'zod';
import { linkedInClient } from '../services/linkedin.client.js';
import { approvalService } from '../services/approval.service.js';
import { ModifyingAction } from '../types/approval.types.js';

/**
 * 1. get_my_profile
 */
export const getMyProfileSchema = z.object({});

export async function handleGetMyProfile(_args: z.infer<typeof getMyProfileSchema>) {
  const profile = await linkedInClient.getMyProfile();

  return {
    authenticated: true,
    memberId: profile.id,
    fullName: profile.name,
    firstName: profile.firstName,
    lastName: profile.lastName,
    pictureUrl: profile.pictureUrl,
    email: profile.email,
    profileUrl: profile.profileUrl,
    headline: profile.headline || 'Not provided by current OpenID Connect scope',
    about: profile.about || 'Not accessible via standard OpenID Connect scope',
    apiScopesNote:
      'Profile identity retrieved via official OpenID Connect UserInfo endpoint. Full historical resume fields (detailed experience, education list, full skills) require LinkedIn Enterprise Partner Program permissions and cannot be scraped or accessed via consumer API.',
  };
}

/**
 * 2. analyze_my_profile
 */
export const analyzeMyProfileSchema = z.object({
  currentHeadline: z.string().optional().describe('Your current LinkedIn headline if not automatically synced'),
  currentAbout: z.string().optional().describe('Your current About section text'),
  experienceSummary: z.string().optional().describe('Summary of your current and past roles'),
  educationSummary: z.string().optional().describe('Summary of your degrees and institutions'),
  skillsList: z.array(z.string()).optional().describe('List of your current skills'),
  targetAudienceOrRole: z.string().optional().describe('Target job title, industry, or clients you wish to attract'),
});

export async function handleAnalyzeMyProfile(args: z.infer<typeof analyzeMyProfileSchema>) {
  let profileName = 'Member';
  try {
    const profile = await linkedInClient.getMyProfile();
    profileName = profile.name;
  } catch {
    // Continue even if profile call fails
  }

  const recommendations: string[] = [];
  const strengths: string[] = [];
  const missingElements: string[] = [];

  // Headline Analysis
  if (!args.currentHeadline || args.currentHeadline.length < 30) {
    missingElements.push('Headline is too short or missing. An optimal headline should be 80-150 characters.');
    recommendations.push(
      'Use a 3-part headline formula: [Role/Identity] + [Core Tech/Value Delivered] + [Unique Proof Point or Impact].'
    );
  } else {
    strengths.push('Headline provided with substantive length.');
    if (!args.currentHeadline.includes('|') && !args.currentHeadline.includes('•')) {
      recommendations.push('Consider using separators (| or •) to separate your title, primary stack, and value proposition.');
    }
  }

  // About Section Analysis
  if (!args.currentAbout || args.currentAbout.length < 150) {
    missingElements.push('About / Summary section is missing or too brief.');
    recommendations.push(
      'Structure your About section in 4 parts: Hook (1-2 sentences), Core Expertise & Stack, Top Career Wins with metrics, and Call to Action.'
    );
  } else {
    strengths.push('Comprehensive About section provided.');
    if (!args.currentAbout.includes('Contact') && !args.currentAbout.includes('reach out')) {
      recommendations.push('Add a clear Call to Action (CTA) at the bottom of your About section with preferred contact channel.');
    }
  }

  // Skills Analysis
  if (!args.skillsList || args.skillsList.length < 5) {
    missingElements.push('Skills list contains fewer than 5 items. LinkedIn profiles with 10+ skills receive 17x more search views.');
    recommendations.push('List at least 15-20 technical and domain skills, pinning your top 3 primary specialties.');
  } else {
    strengths.push(`Identified ${args.skillsList.length} defined skills.`);
  }

  // Experience Analysis
  if (!args.experienceSummary) {
    missingElements.push('Experience summary not provided.');
    recommendations.push('Ensure each role has 3-5 bullet points formatted with the X-Y-Z formula: Accomplished [X], as measured by [Y], by doing [Z].');
  } else {
    strengths.push('Experience history provided.');
  }

  return {
    profileAnalyzedFor: profileName,
    targetGoal: args.targetAudienceOrRole || 'General Professional Branding & Recruiter Visibility',
    profileHealthScore: Math.min(100, (strengths.length * 25) + 25),
    strengths,
    missingElements,
    actionableRecommendations: recommendations,
    nextSteps: [
      'Call "improve_my_linkedin_profile" to generate revised headline and About sections.',
      'Use "sync_my_resume" if you have a resume document to cross-reference discrepancies.',
    ],
  };
}

/**
 * Helper to handle mutating profile fields (3-8) with safety approval and official API compliance
 */
async function processProfileUpdateApproval<TProposed = unknown>(params: {
  action: ModifyingAction;
  fieldName: string;
  originalContent: unknown;
  proposedContent: TProposed;
  approvalToken?: string;
  approved?: boolean;
  editUrl: string;
  formatInstruction: string;
}) {
  const { action, fieldName, originalContent, proposedContent, approvalToken, approved, editUrl, formatInstruction } = params;

  // Step 1: If approval token is not provided or approved is false, generate an Approval Ticket
  if (!approvalToken || !approved) {
    const changesSummary = [
      `Proposed modification to LinkedIn ${fieldName}.`,
      `Target field: ${fieldName}.`,
      `Official LinkedIn API status: Self-serve developer applications cannot mutate personal profile fields directly due to LinkedIn Enterprise API restrictions.`,
      `Approval confirms you approve the proposed text for manual one-click update.`,
    ];

    const ticket = approvalService.createTicket({
      action,
      description: `Review and approve updated ${fieldName}`,
      originalContent,
      proposedContent,
      changesSummary,
    });

    return approvalService.formatApprovalRequiredResponse(ticket);
  }

  // Step 2: Validate approval token
  const validation = approvalService.validateAndConsumeTicket(approvalToken, action, proposedContent);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  // Step 3: Handle Official LinkedIn API restrictions
  // LinkedIn does NOT allow third-party consumer apps to write to member profile sections.
  // We provide the verified approved output, formatted cleanly, with the exact direct link.
  return {
    status: 'MANUAL_UPDATE_REQUIRED',
    action,
    ticketId: approvalToken,
    approvalConfirmed: true,
    approvedContent: proposedContent,
    reason:
      'LinkedIn Official API Limitation: Direct mutation of member profile fields (Headline, About, Experience, Skills, Education, Projects) is restricted by LinkedIn to Enterprise Partner Programs (Member Data Portability / Talent Solutions). No third-party consumer API can overwrite this data directly.',
    instructions: formatInstruction,
    oneClickEditUrl: editUrl,
    copyPasteContent: proposedContent,
  };
}

/**
 * 3. update_my_headline
 */
export const updateMyHeadlineSchema = z.object({
  newHeadline: z.string().min(5).max(220).describe('The new LinkedIn headline (up to 220 characters)'),
  approval_token: z.string().optional().describe('Approval token generated from the initial proposal'),
  approved: z.boolean().optional().describe('Must be explicitly true to confirm update'),
});

export async function handleUpdateMyHeadline(args: z.infer<typeof updateMyHeadlineSchema>) {
  return processProfileUpdateApproval({
    action: 'update_my_headline',
    fieldName: 'Headline',
    originalContent: 'Current Headline on LinkedIn Profile',
    proposedContent: args.newHeadline,
    approvalToken: args.approval_token,
    approved: args.approved,
    editUrl: 'https://www.linkedin.com/in/me/edit/intro/',
    formatInstruction:
      'Your approved headline is ready! Click the one-click edit link below, paste into the "Headline" box, and click Save.',
  });
}

/**
 * 4. update_my_about
 */
export const updateMyAboutSchema = z.object({
  newAbout: z.string().min(20).max(2600).describe('The new About summary (up to 2,600 characters)'),
  approval_token: z.string().optional().describe('Approval token generated from initial review'),
  approved: z.boolean().optional().describe('Must be explicitly true to confirm update'),
});

export async function handleUpdateMyAbout(args: z.infer<typeof updateMyAboutSchema>) {
  return processProfileUpdateApproval({
    action: 'update_my_about',
    fieldName: 'About Section',
    originalContent: 'Current About summary on LinkedIn Profile',
    proposedContent: args.newAbout,
    approvalToken: args.approval_token,
    approved: args.approved,
    editUrl: 'https://www.linkedin.com/in/me/edit/about/',
    formatInstruction:
      'Your approved About section is ready! Open the edit URL below, paste into the "Summary" field, and save.',
  });
}

/**
 * 5. update_my_experience
 */
export const updateMyExperienceSchema = z.object({
  roleTitle: z.string().describe('Job title'),
  companyName: z.string().describe('Company or organization name'),
  startDate: z.string().describe('Start date (e.g. "Jan 2023")'),
  endDate: z.string().optional().describe('End date or "Present"'),
  descriptionBullets: z.array(z.string()).describe('Bullet points of achievements and responsibilities'),
  location: z.string().optional().describe('Role location (e.g. "San Francisco, CA (Hybrid)")'),
  approval_token: z.string().optional(),
  approved: z.boolean().optional(),
});

export async function handleUpdateMyExperience(args: z.infer<typeof updateMyExperienceSchema>) {
  const formattedContent = {
    title: args.roleTitle,
    company: args.companyName,
    dates: `${args.startDate} - ${args.endDate || 'Present'}`,
    location: args.location || '',
    bullets: args.descriptionBullets.map(b => (b.startsWith('•') ? b : `• ${b}`)).join('\n'),
  };

  return processProfileUpdateApproval({
    action: 'update_my_experience',
    fieldName: 'Experience',
    originalContent: 'Current Experience entry',
    proposedContent: formattedContent,
    approvalToken: args.approval_token,
    approved: args.approved,
    editUrl: 'https://www.linkedin.com/in/me/details/experience/',
    formatInstruction:
      'Experience entry approved! Go to the Experience edit link below to add or edit this position with the verified bullet points.',
  });
}

/**
 * 6. update_my_skills
 */
export const updateMySkillsSchema = z.object({
  skillsToAdd: z.array(z.string()).describe('List of skills to add to your profile'),
  approval_token: z.string().optional(),
  approved: z.boolean().optional(),
});

export async function handleUpdateMySkills(args: z.infer<typeof updateMySkillsSchema>) {
  return processProfileUpdateApproval({
    action: 'update_my_skills',
    fieldName: 'Skills',
    originalContent: 'Current Skills list',
    proposedContent: args.skillsToAdd,
    approvalToken: args.approval_token,
    approved: args.approved,
    editUrl: 'https://www.linkedin.com/in/me/details/skills/',
    formatInstruction:
      'Skills approved! Navigate to the Skills section link below and click the "+" button to add these skills.',
  });
}

/**
 * 7. update_my_education
 */
export const updateMyEducationSchema = z.object({
  schoolName: z.string().describe('School, college, or university name'),
  degreeName: z.string().optional().describe('Degree or certification name'),
  fieldOfStudy: z.string().optional().describe('Major or field of study'),
  startDate: z.string().optional().describe('Start year (e.g. "2018")'),
  endDate: z.string().optional().describe('End year or expected graduation (e.g. "2022")'),
  activitiesOrNotes: z.string().optional().describe('Activities, honors, or thesis'),
  approval_token: z.string().optional(),
  approved: z.boolean().optional(),
});

export async function handleUpdateMyEducation(args: z.infer<typeof updateMyEducationSchema>) {
  const formattedContent = {
    school: args.schoolName,
    degree: args.degreeName || '',
    field: args.fieldOfStudy || '',
    years: args.startDate && args.endDate ? `${args.startDate} - ${args.endDate}` : '',
    notes: args.activitiesOrNotes || '',
  };

  return processProfileUpdateApproval({
    action: 'update_my_education',
    fieldName: 'Education',
    originalContent: 'Current Education entry',
    proposedContent: formattedContent,
    approvalToken: args.approval_token,
    approved: args.approved,
    editUrl: 'https://www.linkedin.com/in/me/details/education/',
    formatInstruction:
      'Education entry approved! Navigate to the Education edit link below to save your verified credentials.',
  });
}

/**
 * 8. update_my_projects
 */
export const updateMyProjectsSchema = z.object({
  projectTitle: z.string().describe('Name of the project'),
  description: z.string().describe('Detailed description of the project and impact'),
  projectUrl: z.string().url().optional().describe('Live demo or GitHub repository link'),
  skillsUsed: z.array(z.string()).optional().describe('Key technologies or skills demonstrated in this project'),
  startDate: z.string().optional().describe('Project start date (e.g. "May 2024")'),
  endDate: z.string().optional().describe('Project completion date or "Ongoing"'),
  approval_token: z.string().optional(),
  approved: z.boolean().optional(),
});

export async function handleUpdateMyProjects(args: z.infer<typeof updateMyProjectsSchema>) {
  const formattedContent = {
    title: args.projectTitle,
    url: args.projectUrl || '',
    technologies: (args.skillsUsed || []).join(', '),
    timeline: args.startDate ? `${args.startDate} - ${args.endDate || 'Ongoing'}` : '',
    description: args.description,
  };

  return processProfileUpdateApproval({
    action: 'update_my_projects',
    fieldName: 'Projects',
    originalContent: 'Current Projects entry',
    proposedContent: formattedContent,
    approvalToken: args.approval_token,
    approved: args.approved,
    editUrl: 'https://www.linkedin.com/in/me/details/projects/',
    formatInstruction:
      'Project details approved! Open the Projects section link below to save your project showcase.',
  });
}
