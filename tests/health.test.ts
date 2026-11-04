import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Health and Dashboard Endpoints', () => {
  const app = createApp();

  it('GET /health should return 200 and server diagnostic metadata', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('linkedInConnected');
    expect(res.body).toHaveProperty('server', 'linkedin-personal-manager-mcp');
    expect(res.body).toHaveProperty('version', '1.0.0');
  });

  it('GET / should render HTML dashboard with tools list', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('LinkedIn AI Personal Manager');
    expect(res.text).toContain('/mcp');
    expect(res.text).toContain('Registered MCP Tools');
    expect(res.text).toContain('get_my_profile');
    expect(res.text).toContain('publish_linkedin_post');
  });

  it('GET /unknown-path should return 404 JSON', async () => {
    const res = await request(app).get('/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not Found');
  });
});

