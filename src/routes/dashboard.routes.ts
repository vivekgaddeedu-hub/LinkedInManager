import { Router, Request, Response } from 'express';
import { oauthService } from '../services/oauth.service.js';
import { linkedInClient } from '../services/linkedin.client.js';
import { getAllToolDefinitions } from '../tools/index.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req: Request, res: Response) => {
  const isAuth = await oauthService.isAuthenticated();
  let userName = '';
  let userEmail = '';
  let userPicture = '';
  let profileUrl = '';

  if (isAuth) {
    try {
      const profile = await linkedInClient.getMyProfile();
      userName = profile.name;
      userEmail = profile.email || '';
      userPicture = profile.pictureUrl || '';
      profileUrl = profile.profileUrl || '';
    } catch {
      // User might be partially connected or token invalid
    }
  }

  const tools = getAllToolDefinitions();
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  const mcpUrl = `${baseUrl}/mcp`;
  const sseUrl = `${baseUrl}/sse`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LinkedIn AI Personal Manager – MCP Server</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f2937;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --primary: #0a66c2;
      --primary-hover: #084e96;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --accent: #38bdf8;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 0;
      line-height: 1.5;
    }
    .container {
      max-width: 1040px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 2rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .logo-badge {
      background: var(--primary);
      color: #fff;
      font-weight: 700;
      font-size: 1.25rem;
      padding: 0.5rem 0.8rem;
      border-radius: 0.5rem;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.8rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .badge-connected { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid var(--success); }
    .badge-disconnected { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid var(--danger); }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    @media (max-width: 768px) {
      .grid { grid-template-columns: 1fr; }
      header { flex-direction: column; align-items: flex-start; gap: 1rem; }
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1rem;
      padding: 1.75rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    h2 {
      margin-top: 0;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #fff;
    }
    .user-profile {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1.25rem 0;
    }
    .avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 2px solid var(--accent);
      object-fit: cover;
      background: #1f2937;
    }
    .user-details h3 { margin: 0; font-size: 1.1rem; color: #fff; }
    .user-details p { margin: 0.2rem 0 0 0; color: var(--text-muted); font-size: 0.9rem; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-radius: 0.5rem;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-danger { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid var(--danger); }
    .btn-danger:hover { background: var(--danger); color: #fff; }
    .code-box {
      background: #060911;
      border: 1px solid #1e293b;
      border-radius: 0.5rem;
      padding: 0.85rem 1rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      color: #38bdf8;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 0.75rem 0;
      word-break: break-all;
    }
    .copy-btn {
      background: #1e293b;
      border: none;
      color: #94a3b8;
      padding: 0.3rem 0.6rem;
      border-radius: 0.35rem;
      font-size: 0.75rem;
      cursor: pointer;
      margin-left: 0.5rem;
      flex-shrink: 0;
    }
    .copy-btn:hover { background: #334155; color: #fff; }
    .tools-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .tool-item {
      background: #0c1220;
      border: 1px solid #1e293b;
      border-radius: 0.6rem;
      padding: 1rem;
    }
    .tool-name {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      font-weight: 600;
      color: #38bdf8;
      margin-bottom: 0.4rem;
    }
    .tool-desc {
      font-size: 0.825rem;
      color: var(--text-muted);
      line-height: 1.4;
    }
    .alert-box {
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 0.75rem;
      padding: 1.25rem;
      margin-bottom: 2rem;
      font-size: 0.9rem;
      color: #cbd5e1;
    }
    .alert-box strong { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="logo-badge">in MCP</div>
        <div>
          <h1>LinkedIn AI Personal Manager</h1>
          <p style="margin: 0; color: var(--text-muted); font-size: 0.9rem;">Official Model Context Protocol Server for Claude AI</p>
        </div>
      </div>
      <div>
        ${
          isAuth
            ? '<span class="badge badge-connected">● LinkedIn Connected</span>'
            : '<span class="badge badge-disconnected">○ Disconnected</span>'
        }
      </div>
    </header>

    <div class="alert-box">
      <strong>🔗 Connecting to Claude Custom Connector:</strong><br>
      In Claude AI, go to <em>Settings → Connectors → Add custom connector</em>. Enter your Streamable HTTP MCP URL below.
    </div>

    <div class="grid">
      <div class="card">
        <h2>LinkedIn Account Connection</h2>
        ${
          isAuth
            ? `
          <div class="user-profile">
            ${
              userPicture
                ? `<img class="avatar" src="${userPicture}" alt="Avatar">`
                : '<div class="avatar" style="display:flex;align-items:center;justify-content:center;color:#38bdf8;font-weight:bold;">LI</div>'
            }
            <div class="user-details">
              <h3>${userName || 'Authenticated User'}</h3>
              <p>${userEmail || 'OAuth Token Encrypted & Stored'}</p>
              ${profileUrl ? `<a href="${profileUrl}" target="_blank" style="color: #38bdf8; font-size: 0.8rem; text-decoration: none;">View LinkedIn Profile →</a>` : ''}
            </div>
          </div>
          <form method="POST" action="/auth/disconnect">
            <button type="submit" class="btn btn-danger">Disconnect Account</button>
          </form>
        `
            : `
          <p style="color: var(--text-muted); font-size: 0.95rem;">
            Authorize this MCP server to access your LinkedIn profile information and publish posts on your behalf using standard OAuth 2.0.
          </p>
          <a href="/auth/login" class="btn btn-primary">Connect with LinkedIn</a>
        `
        }
      </div>

      <div class="card">
        <h2>Claude Connection Endpoints</h2>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0;">
          Use the Streamable HTTP endpoint in Claude's "Add custom connector":
        </p>
        <div>
          <label style="font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Streamable HTTP Endpoint (Primary):</label>
          <div class="code-box">
            <span id="mcp-url">${mcpUrl}</span>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${mcpUrl}'); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy', 2000)">Copy</button>
          </div>
        </div>
        <div>
          <label style="font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Server-Sent Events (SSE) Endpoint (Alternative):</label>
          <div class="code-box">
            <span>${sseUrl}</span>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${sseUrl}'); this.innerText='Copied!'; setTimeout(()=>this.innerText='Copy', 2000)">Copy</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Registered MCP Tools (${tools.length})</h2>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0;">
        These 16 tools are exposed through the MCP protocol to Claude AI:
      </p>
      <div class="tools-list">
        ${tools
          .map(
            (t) => `
          <div class="tool-item">
            <div class="tool-name">${t.name}</div>
            <div class="tool-desc">${t.description}</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
});

