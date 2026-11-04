import crypto from 'node:crypto';
import { config } from '../config.js';

export class CryptoService {
  private key: Buffer;

  constructor(encryptionKey: string = config.ENCRYPTION_KEY) {
    // Derive a fixed 32-byte key using SHA-256
    this.key = crypto.createHash('sha256').update(encryptionKey).digest();
  }

  /**
   * Encrypts plaintext string using AES-256-GCM
   * Returns "iv:authTag:ciphertext" in hex format
   */
  public encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${ciphertext}`;
  }

  /**
   * Decrypts ciphertext encrypted with AES-256-GCM
   */
  public decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertextHex, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  /**
   * Generates a cryptographically secure random token/state
   */
  public generateSecureToken(byteLength = 32): string {
    return crypto.randomBytes(byteLength).toString('hex');
  }

  /**
   * Generates a PKCE code verifier (RFC 7636 compliant)
   */
  public generateCodeVerifier(length = 64): string {
    return crypto
      .randomBytes(length)
      .toString('base64url')
      .slice(0, length);
  }

  /**
   * Generates a PKCE code challenge from a verifier using SHA-256
   */
  public generateCodeChallenge(codeVerifier: string): string {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
  }

  /**
   * Generates a deterministic SHA-256 hash of any JSON-serializable object
   */
  public hashPayload(payload: unknown): string {
    const canonicalJson = JSON.stringify(payload, Object.keys(payload as object).sort());
    return crypto.createHash('sha256').update(canonicalJson).digest('hex');
  }
}

export const cryptoService = new CryptoService();

