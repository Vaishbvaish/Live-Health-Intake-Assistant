/**
 * POST /api/live/token — Vercel serverless function.
 *
 * Hands the browser a single-use ephemeral token so it can open the Live API
 * WebSocket directly. This is why the app can live on Vercel at all: the
 * realtime connection is browser-to-Gemini, so nothing here has to stay
 * running between requests.
 */

import { ServiceError, createLiveToken } from '../../lib/clinical';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const payload = await createLiveToken();
    return Response.json(payload, {
      // A single-use credential must never be cached by a CDN or a browser.
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to mint Live API token:', error);
    return Response.json({ error: 'Could not mint a Live API ephemeral token.' }, { status: 502 });
  }
}
