/**
 * LinkedIn API Data Models and Type Definitions
 */

export interface LinkedInUserInfo {
  sub: string; // Member ID / subject identifier
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  locale?: {
    country?: string;
    language?: string;
  };
}

export interface LinkedInProfile {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  about?: string;
  profileUrl?: string;
  pictureUrl?: string;
  email?: string;
  experience?: LinkedInExperienceItem[];
  education?: LinkedInEducationItem[];
  skills?: string[];
  projects?: LinkedInProjectItem[];
  rawUserInfo?: Partial<LinkedInUserInfo>;
}

export interface LinkedInExperienceItem {
  id?: string;
  companyName: string;
  title: string;
  startDate?: string;
  endDate?: string;
  currentRole?: boolean;
  location?: string;
  description?: string;
}

export interface LinkedInEducationItem {
  id?: string;
  schoolName: string;
  degreeName?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  grade?: string;
  activities?: string;
}

export interface LinkedInProjectItem {
  id?: string;
  title: string;
  description?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  skillsUsed?: string[];
}

export interface LinkedInOAuthTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  obtained_at: number; // Unix timestamp in ms
}

export interface LinkedInPostPayload {
  author: string; // e.g. "urn:li:person:..."
  commentary: string;
  visibility: 'PUBLIC' | 'CONNECTIONS';
  distribution?: {
    feedDistribution?: 'MAIN_FEED' | 'NONE';
    targetEntities?: unknown[];
    thirdPartyDistributionChannels?: unknown[];
  };
  content?: {
    article?: {
      source: string;
      title?: string;
      description?: string;
      thumbnail?: string;
    };
    media?: {
      id: string;
      title?: string;
    };
  };
  lifecycleState?: 'PUBLISHED' | 'DRAFT';
  isReshareDisabledByAuthor?: boolean;
}

export interface LinkedInPostResponse {
  id: string; // e.g. "urn:li:share:12345" or "urn:li:ugcPost:12345"
  url?: string;
  author: string;
  commentary: string;
  createdAt?: string;
}

export interface LinkedInApiErrorResponse {
  status?: number;
  serviceErrorCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
}
