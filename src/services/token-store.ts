import fs from 'node:fs/promises';
import path from 'node:path';
import { LinkedInOAuthTokens } from '../types/linkedin.types.js';
import { cryptoService } from './crypto.service.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export class TokenStore {
  private memoryTokens: LinkedInOAuthTokens | null = null;
  private filePath: string;

  constructor(filePath: string = config.TOKEN_STORAGE_PATH) {
    this.filePath = filePath;
  }

  /**
   * Encrypts and persists tokens to memory and disk
   */
  public async saveTokens(tokens: LinkedInOAuthTokens): Promise<void> {
    this.memoryTokens = tokens;

    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      const plaintext = JSON.stringify(tokens);
      const encrypted = cryptoService.encrypt(plaintext);

      await fs.writeFile(this.filePath, encrypted, { encoding: 'utf8', mode: 0o600 });
      logger.info('OAuth tokens securely encrypted and saved to storage');
    } catch (err) {
      logger.error('Failed to write encrypted tokens to disk:', err);
      // Still keep in memory if disk fails
    }
  }

  /**
   * Retrieves and decrypts stored tokens
   */
  public async getTokens(): Promise<LinkedInOAuthTokens | null> {
    if (this.memoryTokens) {
      return this.memoryTokens;
    }

    try {
      const encrypted = await fs.readFile(this.filePath, 'utf8');
      const plaintext = cryptoService.decrypt(encrypted.trim());
      const tokens: LinkedInOAuthTokens = JSON.parse(plaintext);
      this.memoryTokens = tokens;
      return tokens;
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        logger.error('Failed to decrypt or read stored tokens:', err);
      }
      return null;
    }
  }

  /**
   * Clears stored tokens from memory and disk (for disconnect/revocation)
   */
  public async clearTokens(): Promise<void> {
    this.memoryTokens = null;
    try {
      await fs.unlink(this.filePath);
      logger.info('OAuth tokens removed from storage');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        logger.warn('Could not remove token file from disk:', err);
      }
    }
  }

  /**
   * Checks whether tokens are present and not expired
   */
  public async hasValidTokens(): Promise<boolean> {
    const tokens = await this.getTokens();
    if (!tokens || !tokens.access_token) {
      return false;
    }

    const now = Date.now();
    const expiryTime = tokens.obtained_at + tokens.expires_in * 1000;
    // 5-minute safety buffer
    return now < expiryTime - 5 * 60 * 1000;
  }
}

export const tokenStore = new TokenStore();

