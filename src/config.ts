import dotenv from 'dotenv';
import { z } from 'zod';
import crypto from 'node:crypto';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),

  // LinkedIn OAuth Credentials
  LINKEDIN_CLIENT_ID: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() ? val.trim() : 'PLACEHOLDER_CLIENT_ID')),
  LINKEDIN_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() ? val.trim() : 'PLACEHOLDER_CLIENT_SECRET')),
  LINKEDIN_REDIRECT_URI: z.string().url().default('http://localhost:3000/auth/callback'),

  // Security: 32-byte key for AES-256-GCM encryption
  ENCRYPTION_KEY: z.string().min(16).default(() => {
    // Generate a secure default if not supplied in dev/test, warn in prod
    return crypto.randomBytes(32).toString('hex');
  }),

  // Token storage path for persistent encrypted storage
  TOKEN_STORAGE_PATH: z.string().default('./data/tokens.enc'),

  // Optional bearer token required on /mcp requests
  MCP_AUTH_TOKEN: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Configuration validation error:', result.error.format());
    throw new Error('Invalid environment configuration');
  }

  const config = result.data;

  // In production, ensure non-placeholder credentials
  if (config.NODE_ENV === 'production') {
    if (config.LINKEDIN_CLIENT_ID === 'PLACEHOLDER_CLIENT_ID' || !config.LINKEDIN_CLIENT_ID) {
      console.warn('[WARN] LINKEDIN_CLIENT_ID is not set in production');
    }
    if (config.LINKEDIN_CLIENT_SECRET === 'PLACEHOLDER_CLIENT_SECRET' || !config.LINKEDIN_CLIENT_SECRET) {
      console.warn('[WARN] LINKEDIN_CLIENT_SECRET is not set in production');
    }
  }

  return config;
}

export const config = loadConfig();

