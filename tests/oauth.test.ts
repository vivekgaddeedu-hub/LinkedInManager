import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { OAuthService } from '../src/services/oauth.service.js';
import { tokenStore } from '../src/services/token-store.js';

vi.mock('axios');

describe('OAuthService', () => {
  let oauthService: OAuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    await tokenStore.clearTokens();
    oauthService = new OAuthService();
  });

  it('should generate valid authorization URL with state and PKCE challenge', () => {
    const { url, state, codeVerifier } = oauthService.generateAuthorizationUrl();

    expect(url).toContain('https://www.linkedin.com/oauth/v2/authorization');
    expect(url).toContain('response_type=code');
    expect(url).toContain(`state=${state}`);
    expect(url).toContain('code_challenge=');
    expect(url).toContain('code_challenge_method=S256');
    expect(codeVerifier).toBeDefined();
  });

  it('should reject callback with invalid or missing state', async () => {
    await expect(
      oauthService.handleCallback('valid_code', 'non_existent_state')
    ).rejects.toThrow('Invalid or expired OAuth state parameter');
  });

  it('should exchange code for tokens upon valid callback', async () => {
    const { state } = oauthService.generateAuthorizationUrl();

    const mockTokenResponse = {
      data: {
        access_token: 'mock_access_token_abc123',
        token_type: 'Bearer',
        expires_in: 5184000,
        refresh_token: 'mock_refresh_token_xyz987',
        scope: 'openid profile email w_member_social',
      },
    };

    (axios.post as any).mockResolvedValueOnce(mockTokenResponse);

    const tokens = await oauthService.handleCallback('valid_auth_code', state);

    expect(tokens.access_token).toBe('mock_access_token_abc123');
    expect(tokens.refresh_token).toBe('mock_refresh_token_xyz987');
    expect(await oauthService.isAuthenticated()).toBe(true);

    const validToken = await oauthService.getValidAccessToken();
    expect(validToken).toBe('mock_access_token_abc123');
  });

  it('should handle token refresh when expired', async () => {
    // Seed expired token with refresh token
    const expiredTokens = {
      access_token: 'expired_access_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'valid_refresh_token',
      obtained_at: Date.now() - 4000 * 1000, // expired
    };

    await tokenStore.saveTokens(expiredTokens);

    (axios.post as any).mockResolvedValueOnce({
      data: {
        access_token: 'new_refreshed_access_token',
        expires_in: 5184000,
        refresh_token: 'new_refresh_token',
      },
    });

    const refreshedToken = await oauthService.getValidAccessToken();
    expect(refreshedToken).toBe('new_refreshed_access_token');
  });

  it('should disconnect and purge tokens', async () => {
    await tokenStore.saveTokens({
      access_token: 'token_to_purge',
      token_type: 'Bearer',
      expires_in: 3600,
      obtained_at: Date.now(),
    });

    expect(await oauthService.isAuthenticated()).toBe(true);

    await oauthService.disconnect();

    expect(await oauthService.isAuthenticated()).toBe(false);
    expect(await oauthService.getValidAccessToken()).toBeNull();
  });
});
