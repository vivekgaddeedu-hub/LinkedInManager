import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { tokenStore } from '../src/services/token-store.js';
import { getAllToolDefinitions } from '../src/tools/index.js';

describe('MCP Protocol & Tool Discovery', () => {
  const app = createApp();

  beforeEach(async () => {
    await tokenStore.clearTokens();
  });

  it('should discover all 16 registered MCP tools with valid schemas', () => {
    const tools = getAllToolDefinitions();
    expect(tools.length).toBe(16);

    const toolNames = tools.map((t) => t.name);
    const requiredTools = [
      'get_my_profile',
      'analyze_my_profile',
      'update_my_headline',
      'update_my_about',
      'update_my_experience',
      'update_my_skills',
      'update_my_education',
      'update_my_projects',
      'create_linkedin_post',
      'publish_linkedin_post',
      'get_my_posts',
      'analyze_post_performance',
      'generate_linkedin_content',
      'improve_my_linkedin_profile',
      'create_weekly_content_plan',
      'sync_my_resume',
    ];

    for (const reqTool of requiredTools) {
      expect(toolNames).toContain(reqTool);
    }
  });

  it('POST /mcp should handle MCP initialize handshake', async () => {
    const initPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'ClaudeCustomConnectorTest',
          version: '1.0.0',
        },
      },
    };

    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send(initPayload);

    expect(res.status).toBe(200);
    expect(res.text).toContain('linkedin-personal-manager-mcp');
    expect(res.text).toContain('capabilities');
  });

  it('POST /mcp should respond to tools/list with all 16 tools', async () => {
    const toolsListPayload = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    };

    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send(toolsListPayload);

    expect(res.status).toBe(200);
    expect(res.text).toContain('get_my_profile');
    expect(res.text).toContain('publish_linkedin_post');
    expect(res.text).toContain('create_weekly_content_plan');
  });

  it('POST /mcp should execute generate_linkedin_content tool successfully', async () => {
    const callPayload = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'generate_linkedin_content',
        arguments: {
          projectOrExperience: 'Real-Time Stream Processing Engine',
          keyTechnologies: ['TypeScript', 'Node.js', 'Kafka'],
          metricsOrOutcome: 'reduced latency by 45%',
          lessonsLearned: 'backpressure handling prevents buffer bloat',
        },
      },
    };

    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send(callPayload);

    expect(res.status).toBe(200);
    expect(res.text).toContain('CONTENT_GENERATED');
    expect(res.text).toContain('Real-Time Stream Processing Engine');
    expect(res.text).toContain('reduced latency by 45%');
  });

  it('POST /mcp should fail gracefully when unauthenticated tool is invoked', async () => {
    const callPayload = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_my_profile',
        arguments: {},
      },
    };

    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send(callPayload);

    expect(res.status).toBe(200);
    // MCP tool execution returns error in content object with isError: true
    expect(res.text).toContain('Not authenticated with LinkedIn');
  });

  it('POST /mcp should validate input parameters and reject invalid data', async () => {
    const callPayload = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'update_my_headline',
        arguments: {
          // Missing required parameter 'newHeadline'
        },
      },
    };

    const res = await request(app)
      .post('/mcp')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json, text/event-stream')
      .send(callPayload);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Invalid input');
    expect(res.text).toContain('"isError":true');
  });
});
