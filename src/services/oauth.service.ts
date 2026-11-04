import axios from 'axios';
import { config } from '../config.js';
import { cryptoService } from './crypto.service.js';
import { tokenStore } from './token-store.js';
import { LinkedInOAuthTokens } from '../types/linkedin.types.js';
import { logger } from '../logger.js';

interface OAuthPendingSession {
  state: string;
  codeVerifier: string;
  createdAt: number;
}

export class OAuthService {
  private pendingSessions: Map<string, OAuthPendingSession> = new Map();
  private readonly defaultScopes = ['openid', 'profile', 'email', 'w_member_social'];

  /**
   * Generates authorization URL with state and PKCE parameters
   */
  public generateAuthorizationUrl(customScopes?: string[]): {
    url: string;
    state: string;
    codeVerifier: string;
  } {
    if (
      config.NODE_ENV === 'production' &&
      (!config.LINKEDIN_CLIENT_ID ||
        config.LINKEDIN_CLIENT_ID === 'PLACEHOLDER_CLIENT_ID' ||
        !config.LINKEDIN_CLIENT_SECRET ||
        config.LINKEDIN_CLIENT_SECRET === 'PLACEHOLDER_CLIENT_SECRET')
    ) {
      throw new Error(
        'Missing LinkedIn API credentials in .env. Please set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET before connecting.'
      );
    }

    const state = cryptoService.generateSecureToken(24);
    const codeVerifier = cryptoService.generateCodeVerifier(64);
    const codeChallenge = cryptoService.generateCodeChallenge(codeVerifier);

    this.pendingSessions.set(state, {
      state,
      codeVerifier,
      createdAt: Date.now(),
    });

    // Cleanup sessions older than 15 minutes
    this.cleanupOldSessions();

    const scopes = customScopes && customScopes.length > 0 ? customScopes : this.defaultScopes;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.LINKEDIN_CLIENT_ID,
      redirect_uri: config.LINKEDIN_REDIRECT_URI,
      state,
      scope: scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const url = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

    logger.info(`Generated OAuth authorization URL for state ${state.slice(0, 8)}...`);
    return { url, state, codeVerifier };
  }

  /**
   * Validates state and exchanges authorization code for tokens
   */
  public async handleCallback(
    code: string,
    state: string
  ): Promise<LinkedInOAuthTokens> {
    const session = this.pendingSessions.get(state);
    if (!session) {
      logger.warn(`Invalid or expired OAuth state parameter received: ${state.slice(0, 8)}...`);
      throw new Error('Invalid or expired OAuth state parameter. Please start the login flow again.');
    }

    // Remove consumed state
    this.pendingSessions.delete(state);

    if (Date.now() - session.createdAt > 15 * 60 * 1000) {
      throw new Error('OAuth authorization session has timed out. Please initiate login again.');
    }

    logger.info('Exchanging authorization code for access tokens with LinkedIn...');

    try {
      const bodyParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.LINKEDIN_REDIRECT_URI,
        client_id: config.LINKEDIN_CLIENT_ID,
        client_secret: config.LINKEDIN_CLIENT_SECRET,
        code_verifier: session.codeVerifier,
      });

      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        bodyParams.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      const data = response.data;
      const tokens: LinkedInOAuthTokens = {
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in || 5184000, // Typically 60 days
        refresh_token: data.refresh_token,
        refresh_token_expires_in: data.refresh_token_expires_in,
        scope: data.scope,
        obtained_at: Date.now(),
      };

      await tokenStore.saveTokens(tokens);
      logger.info('Successfully acquired and stored LinkedIn OAuth tokens');
      return tokens;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error_description || err.response?.data?.error || err.message;
      logger.error('LinkedIn OAuth token exchange failed:', errorMsg);
      throw new Error(`LinkedIn OAuth token exchange failed: ${errorMsg}`);
    }
  }

  /**
   * Refreshes the access token using the refresh token if available
   */
  public async refreshToken(): Promise<LinkedInOAuthTokens | null> {
    const existing = await tokenStore.getTokens();
    if (!existing || !existing.refresh_token) {
      logger.warn('No refresh token available for renewal');
      return null;
    }

    try {
      const bodyParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: existing.refresh_token,
        client_id: config.LINKEDIN_CLIENT_ID,
        client_secret: config.LINKEDIN_CLIENT_SECRET,
      });

      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        bodyParams.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        }
      );

      const data = response.data;
      const updatedTokens: LinkedInOAuthTokens = {
        ...existing,
        access_token: data.access_token,
        expires_in: data.expires_in || 5184000,
        refresh_token: data.refresh_token || existing.refresh_token,
        obtained_at: Date.now(),
      };

      await tokenStore.saveTokens(updatedTokens);
      logger.info('LinkedIn access token successfully refreshed');
      return updatedTokens;
    } catch (err: any) {
      logger.error('Failed to refresh LinkedIn access token:', err.response?.data || err.message);
      return null;
    }
  }

  /**
   * Gets a valid access token, auto-refreshing if expired
   */
  public async getValidAccessToken(): Promise<string | null> {
    const tokens = await tokenStore.getTokens();
    if (!tokens || !tokens.access_token) {
      return null;
    }

    const now = Date.now();
    const expiryTime = tokens.obtained_at + tokens.expires_in * 1000;
    const isExpired = now >= expiryTime - 60 * 1000; // 1 min buffer

    if (isExpired) {
      logger.info('Access token has expired or is nearing expiration, attempting refresh...');
      const refreshed = await this.refreshToken();
      return refreshed?.access_token || null;
    }

    return tokens.access_token;
  }

  /**
   * Disconnects / revokes tokens and clears local storage
   */
  public async disconnect(): Promise<void> {
    await tokenStore.clearTokens();
    logger.info('Disconnected LinkedIn account and purged local tokens');
  }

  /**
   * Checks if server has an authenticated LinkedIn connection
   */
  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return token !== null;
  }

  private cleanupOldSessions(): void {
    const threshold = Date.now() - 15 * 60 * 1000;
    for (const [state, session] of this.pendingSessions.entries()) {
      if (session.createdAt < threshold) {
        this.pendingSessions.delete(state);
      }
    }
  }
}

export const oauthService = new OAuthService();
