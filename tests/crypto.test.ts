import { describe, it, expect } from 'vitest';
import { CryptoService, cryptoService } from '../src/services/crypto.service.js';

describe('CryptoService', () => {
  it('should encrypt and decrypt plaintext using AES-256-GCM', () => {
    const originalText = 'my-super-secret-oauth-access-token-1234567890';
    const encrypted = cryptoService.encrypt(originalText);

    expect(encrypted).not.toEqual(originalText);
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

    const decrypted = cryptoService.decrypt(encrypted);
    expect(decrypted).toEqual(originalText);
  });

  it('should fail decryption if ciphertext is tampered with', () => {
    const originalText = 'confidential-data';
    const encrypted = cryptoService.encrypt(originalText);
    const parts = encrypted.split(':');

    // Tamper with ciphertext
    const tamperedCipher = parts[2].slice(0, -2) + 'ff';
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    expect(() => cryptoService.decrypt(tamperedPayload)).toThrow();
  });

  it('should fail decryption if auth tag is tampered with', () => {
    const originalText = 'confidential-data';
    const encrypted = cryptoService.encrypt(originalText);
    const parts = encrypted.split(':');

    // Tamper with auth tag
    const tamperedTag = parts[1].slice(0, -2) + '00';
    const tamperedPayload = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    expect(() => cryptoService.decrypt(tamperedPayload)).toThrow();
  });

  it('should generate valid PKCE code_verifier and code_challenge', () => {
    const verifier = cryptoService.generateCodeVerifier(64);
    expect(verifier).toBeDefined();
    expect(verifier.length).toBe(64);

    const challenge = cryptoService.generateCodeChallenge(verifier);
    expect(challenge).toBeDefined();
    expect(typeof challenge).toBe('string');
    expect(challenge).not.toEqual(verifier);
  });

  it('should compute deterministic hashes for payloads', () => {
    const payloadA = { text: 'Hello LinkedIn', visibility: 'PUBLIC' };
    const payloadB = { visibility: 'PUBLIC', text: 'Hello LinkedIn' };

    const hashA = cryptoService.hashPayload(payloadA);
    const hashB = cryptoService.hashPayload(payloadB);

    expect(hashA).toEqual(hashB);
    expect(typeof hashA).toBe('string');
    expect(hashA.length).toBe(64); // SHA-256 hex string
  });
});

