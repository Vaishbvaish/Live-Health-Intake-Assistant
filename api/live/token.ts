

import { ServiceError, createLiveToken } from '../../lib/clinical.js';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const payload = await createLiveToken();
    return Response.json(payload, {
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
