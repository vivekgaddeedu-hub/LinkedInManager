# LinkedIn AI Personal Manager – MCP Server

[![CI/CD Pipeline](https://github.com/your-org/linkedin-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/linkedin-mcp-server/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Official%20SDK-green.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> A production-grade **Model Context Protocol (MCP)** server that connects **Claude AI** directly to your **LinkedIn account**, transforming Claude into your personal LinkedIn branding manager, executive content creator, and profile advisor.

Built in TypeScript and Node.js using the **official Model Context Protocol TypeScript SDK**, this server implements **Streamable HTTP** (`POST /mcp` / `GET /mcp`) and **Server-Sent Events** (`GET /sse`), **OAuth 2.0 with PKCE**, **AES-256-GCM token encryption**, and a strict **human-in-the-loop safety approval engine** to ensure no changes are ever published or mutated without your explicit consent.

---

## Table of Contents

1. [Overview & Core Value](#overview--core-value)
2. [Architecture](#architecture)
3. [LinkedIn Developer Application Setup](#linkedin-developer-application-setup)
4. [Official LinkedIn API Capabilities & Reality](#official-linkedin-api-capabilities--reality)
5. [Environment Variables](#environment-variables)
6. [Local Installation & Development](#local-installation--development)
7. [Docker & Docker Compose](#docker--docker-compose)
8. [Connecting Claude AI (Custom Connector)](#connecting-claude-ai-custom-connector)
9. [Complete Tool Reference (16 Tools)](#complete-tool-reference-16-tools)
10. [Human-in-the-Loop Safety & Approval Engine](#human-in-the-loop-safety--approval-engine)
11. [Deployment Guide (Render, Railway, Fly.io, Self-Hosted)](#deployment-guide)
12. [Testing & Quality Assurance](#testing--quality-assurance)
13. [Security Considerations](#security-considerations)
14. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## 1. Overview & Core Value

Connecting Claude AI to LinkedIn via MCP allows Claude to:
- **Analyze your profile**: Evaluate your headline, About section, experience, and skills against top industry benchmarks.
- **Maintain your professional brand**: Compare your live profile against your latest resume, spot discrepancies, and craft high-converting bullet points.
- **Draft viral engineering content**: Generate tailored posts from your real codebases, projects, architectural decisions, and career milestones.
- **Publish approved content**: Publish posts directly to your personal LinkedIn feed using official LinkedIn REST APIs once you explicitly review and approve the exact text.
- **Keep you in complete control**: Mutating actions generate cryptographic approval tickets with preview diffs. Claude cannot publish posts or alter content on its own.

---

## 2. Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │                      Claude AI                         │
                    │         (Claude Settings → Add custom connector)       │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                    MCP Protocol (HTTP / SSE)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        LinkedIn MCP Server (Express + MCP SDK)                         │
│                                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │   Streamable HTTP     │  │   Legacy SSE Stream   │  │    Web Status Dashboard    │  │
│  │     `POST /mcp`       │  │      `GET /sse`       │  │           `GET /`          │  │
│  │     `GET /mcp`        │  │    `POST /messages`   │  │       `GET /health`        │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └─────────────┬──────────────┘  │
│              │                          │                            │                 │
│              └──────────────────────────┼────────────────────────────┘                 │
│                                         │                                              │
│                                         ▼                                              │
│                        ┌─────────────────────────────────┐                             │
│                        │       MCP Server Handlers       │                             │
│                        │  • tools/list                   │                             │
│                        │  • tools/call (16 MCP Tools)    │                             │
│                        └────────────────┬────────────────┘                             │
│                                         │                                              │
│     ┌───────────────────────────────────┼──────────────────────────────────┐           │
│     ▼                                   ▼                                  ▼           │
│ ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────────┐   │
│ │ Profile Tools (1-8)  │    │  Post Tools (9-12)   │    │  Branding Tools (13-16)  │   │
│ └──────────┬───────────┘    └──────────┬───────────┘    └─────────────┬────────────┘   │
│            │                           │                              │                │
│            └───────────────────────────┼──────────────────────────────┘                │
│                                        │                                               │
│                                        ▼                                               │
│                     ┌──────────────────────────────────────┐                           │
│                     │       Approval & Safety Guard        │                           │
│                     │  • Cryptographic Approval Tickets    │                           │
│                     │  • Single-Use Replay Protection      │                           │
│                     │  • SHA-256 Payload Hash Verification │                           │
│                     └──────────────────┬───────────────────┘                           │
│                                        │                                               │
│                                        ▼                                               │
│                     ┌──────────────────────────────────────┐                           │
│                     │      LinkedIn API Client & OAuth     │                           │
│                     │  • AES-256-GCM Encrypted Token Store │                           │
│                     │  • OpenID Connect UserInfo (/v2)     │                           │
│                     │  • Official REST Posts API (/rest)   │                           │
│                     └──────────────────┬───────────────────┘                           │
└────────────────────────────────────────┼───────────────────────────────────────────────┘
                                         │
                             HTTPS (Bearer Token Auth)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │        Official LinkedIn APIs        │
                      │  • api.linkedin.com/v2/userinfo      │
                      │  • api.linkedin.com/rest/posts       │
                      │  • api.linkedin.com/v2/ugcPosts      │
                      └──────────────────────────────────────┘
```

---

## 3. LinkedIn Developer Application Setup

To obtain your `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`:

1. **Log in to the LinkedIn Developer Portal**:
   Navigate to [https://www.linkedin.com/developers/apps](https://www.linkedin.com/developers/apps).
2. **Create an App**:
   - Click **Create app**.
   - Enter your App name (e.g. `My Claude Personal Manager`).
   - Enter your LinkedIn Company Page URL (or create a free company page to associate with your developer app).
   - Upload an app logo and check the legal agreement.
3. **Request Official Products**:
   Navigate to the **Products** tab of your app and request:
   - **Sign In with LinkedIn using OpenID Connect** (Immediate self-serve access: provides `openid`, `profile`, `email` scopes to retrieve your verified name, member ID, email, and avatar).
   - **Share on LinkedIn** (Immediate self-serve access: provides `w_member_social` scope to publish posts on your personal profile).
4. **Configure OAuth 2.0 Redirect URLs**:
   - Go to the **Auth** tab.
   - Under **Authorized redirect URLs for your app**, click the `+` button and add:
     - For Local Development: `http://localhost:3000/auth/callback`
     - For Production (Render/Railway/etc.): `https://your-server-domain.com/auth/callback`
5. **Copy Your Credentials**:
   - Note your **Client ID**.
   - Reveal and copy your **Client Secret**.

---

## 4. Official LinkedIn API Capabilities & Reality

LinkedIn enforces strict permission tiers across its developer platform. This MCP server **complies 100% with LinkedIn's official Developer Terms of Service** (no scraping, no browser automation, no private APIs, and no password/cookie collection).

| Capability | Official API Status | MCP Implementation |
|---|---|---|
| **Retrieve Profile Identity** | Supported via OpenID Connect (`/v2/userinfo`) | `get_my_profile` returns verified name, ID, email, picture, and profile URL. |
| **Publish Feed Posts** | Supported via Posts REST API (`/rest/posts` with `w_member_social`) | `publish_linkedin_post` creates live posts upon explicit human confirmation. |
| **Inspect Feed History** | Requires LinkedIn Community Management API product approval (`r_member_social`) | `get_my_posts` fetches history if product is approved; returns an informative product explanation if unapproved. |
| **Direct Profile Field Editing (Headline, About, Experience, Skills, Education)** | **Restricted by LinkedIn** to certified Enterprise Partners (Member Data Portability / Talent Solutions). Not offered to standard consumer apps. | Tools (3–8) format, validate, and produce approved copy-paste text and **direct 1-click LinkedIn edit links** (`/in/me/edit/...`) while explaining the API boundary. |
| **Personal Post Impressions/Analytics** | **Restricted by LinkedIn** to certified enterprise partners. | `analyze_post_performance` honestly explains the limitation and allows you to supply your observed impression counts to calculate engagement rates. |

---

## 5. Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port for the HTTP server to listen on. |
| `HOST` | No | `0.0.0.0` | Host interface to bind to. |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test`. |
| `PUBLIC_BASE_URL` | **Yes** (in Prod) | `http://localhost:3000` | Public HTTPS domain where this server is reachable. |
| `LINKEDIN_CLIENT_ID` | **Yes** | — | OAuth Client ID from LinkedIn Developer Portal. |
| `LINKEDIN_CLIENT_SECRET` | **Yes** | — | OAuth Client Secret from LinkedIn Developer Portal. |
| `LINKEDIN_REDIRECT_URI` | **Yes** | `http://localhost:3000/auth/callback` | OAuth redirect URI matching your developer portal settings. |
| `ENCRYPTION_KEY` | **Yes** | Random | 32-byte hex key (64 characters) used for AES-256-GCM token encryption. |
| `TOKEN_STORAGE_PATH` | No | `./data/tokens.enc` | File path for persistent encrypted OAuth tokens. |
| `MCP_AUTH_TOKEN` | No | `(none)` | Optional Bearer token to protect the `/mcp` endpoint against unauthorized callers. |

### Generating an Encryption Key
Generate a cryptographically secure 64-character hex key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Local Installation & Development

### Prerequisites
- Node.js 20+ or 22+
- npm 10+

### Steps
1. **Clone the repository and install dependencies**:
   ```bash
   git clone <repo-url>
   cd LinkedinVivek
   npm install
   ```

2. **Configure your credentials**:
   Edit `.env` and fill in `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.

3. **Compile and build**:
   ```bash
   npm run build
   ```

4. **Run in development mode (hot reloading)**:
   ```bash
   npm run dev
   ```

5. **Run the production build locally**:
   ```bash
   npm start
   ```

6. **Authenticate your LinkedIn account**:
   - Open your browser to `http://localhost:3000/`.
   - Click **Connect with LinkedIn**.
   - Complete LinkedIn OAuth approval.
   - Your encrypted token will be saved to `./data/tokens.enc`.

---

## 7. Docker & Docker Compose

### Using Docker Compose (Recommended)
```bash
docker compose up -d --build
```
This starts the server on port `3000`, mounts `./data` for token persistence across restarts, and performs automated container health checks.

### Building Docker Image Manually
```bash
docker build -t linkedin-mcp-server .
docker run -p 3000:3000 --env-file .env -v $(pwd)/data:/app/data linkedin-mcp-server
```

---

## 8. Connecting Claude AI (Custom Connector)

Follow these exact steps in Claude AI:

1. Deploy this server to a public HTTPS URL (e.g. Render, Railway, or ngrok for local testing).
2. Authenticate your LinkedIn account once by visiting:
   ```
   https://your-server-domain.com/auth/login
   ```
3. In **Claude AI** (desktop app or web):
   - Go to **Settings** (`⌘ ,` or Profile menu) → **Connectors**.
   - Click **Add custom connector**.
   - In **Connector URL**, paste your Streamable HTTP MCP endpoint:
     ```
     https://your-server-domain.com/mcp
     ```
   - If you set `MCP_AUTH_TOKEN` in your environment, add a Header:
     - Name: `Authorization`
     - Value: `Bearer <your-mcp-auth-token>`
   - Click **Add**. Claude will perform an MCP initialize handshake and discover all 16 tools!

---

## 9. Complete Tool Reference (16 Tools)

### Profile Management
1. **`get_my_profile`**: Fetches authenticated profile metadata (Member ID, name, email, picture, profile link) via official OpenID Connect UserInfo.
2. **`analyze_my_profile`**: Evaluates your current headline, About section, experience, and skills list. Produces a completeness score and specific gap analysis.
3. **`update_my_headline`**: Formulates an optimized 3-part headline. Enforces human confirmation before returning the verified text and one-click edit link.
4. **`update_my_about`**: Formulates a compelling 4-part About section with hooks, core skills, key achievements, and call to action.
5. **`update_my_experience`**: Formats career milestones using the X-Y-Z formula (*Accomplished X, measured by Y, by doing Z*).
6. **`update_my_skills`**: Curates top verified skills and provides one-click navigation to add them to your profile.
7. **`update_my_education`**: Formats academic degrees, thesis projects, and honors for your profile.
8. **`update_my_projects`**: Formats technical projects with architecture details, links, and technologies used.

### LinkedIn Post Management
9. **`create_linkedin_post`**: Drafts high-engagement LinkedIn posts across 5 styles (Narrative Story, Technical Deep-Dive, Quick Tip, Milestone Announcement, Contrarian Take). Generates an **approval ticket** for your review.
10. **`publish_linkedin_post`**: Publishes an approved post to your feed via official LinkedIn REST API (`/rest/posts` or `/v2/ugcPosts`). **Strict Safety**: Fails unless `approved: true` and a valid `approval_token` matching the exact post text are supplied.
11. **`get_my_posts`**: Retrieves recent posts from your feed if the `r_member_social` permission is granted.
12. **`analyze_post_performance`**: Computes engagement rates (reactions + comments + shares / impressions) against industry benchmarks based on user telemetry.

### Career & Personal Branding
13. **`generate_linkedin_content`**: Generates 3 distinct post variations based on your real engineering milestones and architectural challenges.
14. **`improve_my_linkedin_profile`**: Provides side-by-side before-and-after comparisons of your headline and About sections.
15. **`create_weekly_content_plan`**: Builds a 3 to 7-day technical content schedule with themes, hooks, and optimal posting times.
16. **`sync_my_resume`**: Parses resume text, extracts technologies and quantifiable metrics, and identifies gaps in your LinkedIn profile summary.

---

## 10. Human-in-the-Loop Safety & Approval Engine

To protect your professional reputation, all mutating tools (`publish_linkedin_post`, `update_my_headline`, `update_my_about`, etc.) use a two-step confirmation flow:

1. **Proposal Step**:
   Calling `create_linkedin_post` or any profile update tool creates a cryptographically signed **Approval Ticket**:
   ```json
   {
     "status": "APPROVAL_REQUIRED",
     "ticketId": "appr_7a8f9b2c3d4e5f60",
     "proposedContent": { "text": "..." },
     "diffSummary": ["Post format: story", "Character count: 420"],
     "instructions": "To execute, call publish_linkedin_post with approval_token: 'appr_7a8f9b2c3d4e5f60' and approved: true"
   }
   ```
2. **Verification Step**:
   The execution tool verifies:
   - The ticket exists and has not expired (15-minute TTL).
   - The ticket has not already been used (single-use replay prevention).
   - The SHA-256 hash of the content being published matches the approved content.
   - `approved === true`.

---

## 11. Deployment Guide

### Option A: Render (Easiest)
1. Push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** → **Web Service**.
3. Connect your repository.
4. Settings:
   - **Environment**: `Node`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
5. Under **Environment Variables**, set:
   - `PUBLIC_BASE_URL`: `https://your-service-name.onrender.com`
   - `LINKEDIN_CLIENT_ID`: `<your_client_id>`
   - `LINKEDIN_CLIENT_SECRET`: `<your_client_secret>`
   - `LINKEDIN_REDIRECT_URI`: `https://your-service-name.onrender.com/auth/callback`
   - `ENCRYPTION_KEY`: `<generated_hex_key>`
6. Update your LinkedIn Developer App **Authorized redirect URLs** to include `https://your-service-name.onrender.com/auth/callback`.

### Option B: Railway
1. Click **New Project** → **Deploy from GitHub repo**.
2. Railway detects the `Dockerfile` automatically.
3. In Service Settings → Variables, enter your environment variables.
4. Add a Persistent Volume at `/app/data` to preserve your OAuth session.

---

## 12. Testing & Quality Assurance

Run the comprehensive automated test suite (35 unit and integration tests):

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run TypeScript linter
npm run lint

# Compile and verify types
npm run build
```

---

## 13. Security Considerations

- **Tokens Never in Prompts or Logs**: Access tokens and client secrets are never returned in MCP responses and are redacted from all server logs.
- **AES-256-GCM Encryption**: Tokens are stored encrypted on disk using AES-256-GCM with authenticated tags and random IVs.
- **PKCE & State Validation**: OAuth flow uses RFC 7636 PKCE (S256) and cryptographically secure state parameters with timeouts to defeat CSRF.
- **Replay & Tamper Protection**: Approval tickets verify SHA-256 payload hashes and are single-use only.

---

## 14. Troubleshooting & FAQ

#### Q: Claude reports "Cannot connect to MCP server"?
Ensure your server is running on HTTPS and that `/health` returns `{"status":"ok"}`. For local testing with Claude desktop, use a tunnel like ngrok (`ngrok http 3000`) and paste the HTTPS ngrok URL (`https://...ngrok-free.app/mcp`).

#### Q: Getting "LinkedIn Permission Denied (403)" when publishing?
Verify that your LinkedIn Developer App has the **Share on LinkedIn** product added on the Products tab. This grants the required `w_member_social` OAuth scope.

#### Q: Why can't the server directly edit my headline without opening LinkedIn?
LinkedIn's official public API does not support programmatic profile editing for third-party consumer apps; this capability is restricted to enterprise partner programs. This server provides approved, polished copy and direct 1-click edit URLs to respect LinkedIn's API boundaries while keeping your workflow effortless.

---

## License

MIT License. Built for use with Anthropic Claude and the Model Context Protocol.
