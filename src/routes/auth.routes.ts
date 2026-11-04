import { Router, Request, Response } from 'express';
import { oauthService } from '../services/oauth.service.js';
import { linkedInClient } from '../services/linkedin.client.js';
import { logger } from '../logger.js';

export const authRouter = Router();

/**
 * Initiates LinkedIn 3-legged OAuth 2.0 flow
 */
authRouter.get('/auth/login', (req: Request, res: Response) => {
  try {
    const { url } = oauthService.generateAuthorizationUrl();

    if (req.query.format === 'json') {
      res.json({ authorizationUrl: url });
      return;
    }

    res.redirect(url);
  } catch (err: any) {
    logger.error('Failed to initiate LinkedIn OAuth login:', err);
    res.status(500).json({ error: 'Failed to initiate login flow', message: err.message });
  }
});

/**
 * LinkedIn OAuth callback handler
 */
authRouter.get('/auth/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    logger.warn('OAuth authorization returned error from LinkedIn:', error, error_description);
    res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>LinkedIn Connection Error</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 480px; width: 90%; text-align: center; border: 1px solid #ef4444; }
          h1 { color: #ef4444; margin-top: 0; font-size: 1.5rem; }
          p { color: #94a3b8; line-height: 1.6; }
          .btn { display: inline-block; background: #2563eb; color: #fff; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; margin-top: 1.5rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Authentication Cancelled</h1>
          <p>${escapeHtml(String(error_description || error || 'Access was denied by the user or LinkedIn'))}</p>
          <a class="btn" href="/auth/login">Try Again</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: 'Missing code or state parameter in OAuth callback.' });
    return;
  }

  try {
    await oauthService.handleCallback(String(code), String(state));

    let userName = 'LinkedIn User';
    try {
      const profile = await linkedInClient.getMyProfile();
      userName = profile.name;
    } catch {
      // Profile fetch is optional here
    }

    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>LinkedIn Connected Successfully</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0a0f1d; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #111827; padding: 3rem; border-radius: 1.25rem; box-shadow: 0 20px 40px rgba(0,0,0,0.6); max-width: 520px; width: 90%; text-align: center; border: 1px solid #10b981; }
          .icon { font-size: 3rem; margin-bottom: 1rem; color: #10b981; }
          h1 { color: #10b981; margin: 0 0 0.5rem 0; font-size: 1.75rem; }
          p { color: #9ca3af; line-height: 1.6; margin-bottom: 1.5rem; }
          .user-badge { background: #1f2937; padding: 0.6rem 1.2rem; border-radius: 2rem; display: inline-block; font-weight: 600; color: #38bdf8; margin-bottom: 1.5rem; }
          .instructions { background: #182234; padding: 1rem; border-radius: 0.75rem; text-align: left; font-size: 0.9rem; color: #cbd5e1; margin-bottom: 1.5rem; }
          .btn { display: inline-block; background: #0284c7; color: #fff; padding: 0.75rem 1.75rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; transition: background 0.2s; }
          .btn:hover { background: #0369a1; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h1>LinkedIn Connected!</h1>
          <div class="user-badge">Authenticated as: ${escapeHtml(userName)}</div>
          <p>Your OAuth 2.0 credentials have been securely encrypted and stored. Claude AI can now manage your LinkedIn profile and publications via your MCP endpoint.</p>
          <div class="instructions">
            <strong>Next steps in Claude:</strong><br/>
            1. Open Claude AI Settings → Connectors<br/>
            2. Choose "Add custom connector"<br/>
            3. Paste your MCP server URL: <code>${escapeHtml(req.protocol + '://' + req.get('host') + '/mcp')}</code>
          </div>
          <a class="btn" href="/">Return to Dashboard</a>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    logger.error('Failed to process OAuth callback:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Connection Error</title>
        <style>
          body { font-family: sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; }
          .card { background: #1e293b; padding: 2rem; border-radius: 1rem; max-width: 480px; text-align: center; border: 1px solid #f43f5e; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="color: #f43f5e;">Authentication Failed</h2>
          <p>${escapeHtml(err.message)}</p>
          <a style="color: #38bdf8;" href="/auth/login">Click here to retry</a>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * Checks current LinkedIn authentication status
 */
authRouter.get('/auth/status', async (_req: Request, res: Response) => {
  const isAuth = await oauthService.isAuthenticated();
  let profile = null;

  if (isAuth) {
    try {
      profile = await linkedInClient.getMyProfile();
    } catch {
      // ignore
    }
  }

  res.json({
    authenticated: isAuth,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          pictureUrl: profile.pictureUrl,
          profileUrl: profile.profileUrl,
        }
      : null,
  });
});

/**
 * Disconnects LinkedIn account and purges stored credentials
 */
authRouter.post('/auth/disconnect', async (_req: Request, res: Response) => {
  try {
    await oauthService.disconnect();
    res.json({
      success: true,
      message: 'LinkedIn account successfully disconnected. All stored tokens purged.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to disconnect account', message: err.message });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

