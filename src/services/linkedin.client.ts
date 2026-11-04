import axios, { AxiosInstance, AxiosError } from 'axios';
import { oauthService } from './oauth.service.js';
import {
  LinkedInUserInfo,
  LinkedInProfile,
  LinkedInPostResponse,
} from '../types/linkedin.types.js';
import { logger } from '../logger.js';

export interface PostCreationOptions {
  text: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
  articleUrl?: string;
  articleTitle?: string;
  articleDescription?: string;
}

export class LinkedInClient {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: 'https://api.linkedin.com',
      timeout: 15000,
      headers: {
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
  }

  /**
   * Helper to obtain authenticated headers with the current valid access token
   */
  private async getAuthHeaders(version?: string): Promise<Record<string, string>> {
    const token = await oauthService.getValidAccessToken();
    if (!token) {
      throw new Error(
        'Not authenticated with LinkedIn. Please connect your account first via /auth/login.'
      );
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'X-Restli-Protocol-Version': '2.0.0',
    };

    if (version) {
      headers['LinkedIn-Version'] = version;
    }

    return headers;
  }

  /**
   * Retrieves the authenticated user's profile via OpenID Connect UserInfo endpoint
   * Official standard endpoint supported under the "Sign In with LinkedIn using OpenID Connect" product.
   */
  public async getMyProfile(): Promise<LinkedInProfile> {
    const headers = await this.getAuthHeaders();

    try {
      const response = await this.api.get<LinkedInUserInfo>('/v2/userinfo', { headers });
      const data = response.data;

      const profile: LinkedInProfile = {
        id: data.sub,
        name: data.name,
        firstName: data.given_name,
        lastName: data.family_name,
        pictureUrl: data.picture,
        email: data.email,
        profileUrl: `https://www.linkedin.com/in/${encodeURIComponent(data.sub)}`,
        rawUserInfo: {
          sub: data.sub,
          name: data.name,
          email: data.email,
          locale: data.locale,
        },
      };

      return profile;
    } catch (err: any) {
      this.handleApiError(err, 'Failed to fetch LinkedIn profile information');
    }
  }

  /**
   * Publishes a post to LinkedIn using the official REST Posts API
   * Supported with "Share on LinkedIn" or "Community Management API" products (`w_member_social` scope).
   */
  public async publishPost(options: PostCreationOptions): Promise<LinkedInPostResponse> {
    const profile = await this.getMyProfile();
    const authorUrn = `urn:li:person:${profile.id}`;

    // Try LinkedIn REST Posts API (Version 202401/202501)
    try {
      const headers = await this.getAuthHeaders('202401');
      headers['Content-Type'] = 'application/json';

      const payload: Record<string, unknown> = {
        author: authorUrn,
        commentary: options.text,
        visibility: options.visibility || 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      };

      if (options.articleUrl) {
        payload.content = {
          article: {
            source: options.articleUrl,
            title: options.articleTitle,
            description: options.articleDescription,
          },
        };
      }

      logger.info(`Publishing post for author ${authorUrn}...`);
      const response = await this.api.post('/rest/posts', payload, { headers });

      // LinkedIn REST API returns the created URN in header 'x-restli-id' or response body
      const postId =
        (response.headers['x-restli-id'] as string) ||
        (response.headers['x-linkedin-id'] as string) ||
        (response.data as any)?.id ||
        `urn:li:share:published_${Date.now()}`;

      const postUrl = this.formatPostUrl(postId);

      return {
        id: postId,
        url: postUrl,
        author: authorUrn,
        commentary: options.text,
        createdAt: new Date().toISOString(),
      };
    } catch (_restError: any) {
      logger.warn('REST /rest/posts attempt failed, attempting fallback to /v2/ugcPosts...');

      // Fallback: UGC Posts API (v2)
      try {
        const headers = await this.getAuthHeaders();
        const ugcPayload: Record<string, unknown> = {
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: options.text,
              },
              shareMediaCategory: options.articleUrl ? 'ARTICLE' : 'NONE',
              ...(options.articleUrl
                ? {
                    media: [
                      {
                        status: 'READY',
                        originalUrl: options.articleUrl,
                        title: { text: options.articleTitle || options.articleUrl },
                        description: { text: options.articleDescription || '' },
                      },
                    ],
                  }
                : {}),
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility':
              options.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
          },
        };

        const ugcResponse = await this.api.post('/v2/ugcPosts', ugcPayload, { headers });
        const ugcId = (ugcResponse.data as any)?.id || (ugcResponse.headers['x-restli-id'] as string);
        const postUrl = this.formatPostUrl(ugcId);

        return {
          id: ugcId,
          url: postUrl,
          author: authorUrn,
          commentary: options.text,
          createdAt: new Date().toISOString(),
        };
      } catch (ugcError: any) {
        this.handleApiError(ugcError, 'Failed to publish LinkedIn post via official APIs');
      }
    }
  }

  /**
   * Retrieves member posts if authorized (requires r_member_social or Community Management product)
   */
  public async getMyPosts(count = 10): Promise<{
    supported: boolean;
    posts?: unknown[];
    message?: string;
  }> {
    const profile = await this.getMyProfile();
    const authorUrn = encodeURIComponent(`urn:li:person:${profile.id}`);

    try {
      const headers = await this.getAuthHeaders('202401');
      const response = await this.api.get(`/rest/posts?author=${authorUrn}&q=author&count=${count}`, {
        headers,
      });

      return {
        supported: true,
        posts: (response.data as any)?.elements || [],
      };
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        return {
          supported: false,
          message:
            'Retrieving existing posts requires the "Community Management API" or "r_member_social" product approved on your LinkedIn Developer Application. Standard self-serve apps with openid, profile, and w_member_social permissions can create and publish posts, but cannot inspect feed history through the public API.',
        };
      }
      this.handleApiError(err, 'Failed to retrieve posts from LinkedIn');
    }
  }

  /**
   * Explains post performance metrics availability
   */
  public getPostAnalyticsExplanation(): {
    supported: boolean;
    requiredProduct: string;
    explanation: string;
    availableMetricsWhenApproved: string[];
  } {
    return {
      supported: false,
      requiredProduct: 'LinkedIn Community Management API / Organization Analytics Partner Program',
      explanation:
        'Individual post impressions, CTR, and follower analytics for personal member profiles are strictly restricted by LinkedIn to certified enterprise partners. The standard consumer developer portal does not provide self-serve access to individual personal post impression metrics. If you publish to an Organization / Company Page, Page Analytics can be retrieved using the r_organization_social permission.',
      availableMetricsWhenApproved: [
        'uniqueImpressionsCount',
        'clickCount',
        'likeCount',
        'commentCount',
        'shareCount',
        'engagementRate',
      ],
    };
  }

  /**
   * Formats a public URL for a published LinkedIn post URN
   */
  private formatPostUrl(postUrn: string): string {
    // E.g. urn:li:share:71234567890 -> https://www.linkedin.com/feed/update/urn:li:share:71234567890/
    if (postUrn) {
      return `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`;
    }
    return 'https://www.linkedin.com/feed/';
  }

  /**
   * Centralized API error handler providing friendly, informative diagnostics
   */
  private handleApiError(error: AxiosError | any, contextMessage: string): never {
    const status = error.response?.status;
    const data = error.response?.data;
    const msg = data?.message || data?.error_description || error.message;

    logger.error(`LinkedIn API Error (${status}): ${contextMessage}`, {
      status,
      error: msg,
    });

    if (status === 401) {
      throw new Error(
        `LinkedIn Authentication Expired (401): Your LinkedIn session has expired or the token is invalid. Please reconnect your account via /auth/login.`
      );
    }

    if (status === 403) {
      throw new Error(
        `LinkedIn Permission Denied (403): The connected application lacks the required LinkedIn permission for this action (${msg}). Ensure your LinkedIn Developer App has approved products (e.g. "Share on LinkedIn" for w_member_social).`
      );
    }

    throw new Error(`${contextMessage}: ${msg} (HTTP ${status || 'Network Error'})`);
  }
}

export const linkedInClient = new LinkedInClient();
