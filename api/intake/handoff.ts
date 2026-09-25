

import { ServiceError, generateHandoff, type HandoffRequest } from '../../lib/clinical.js';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: HandoffRequest;
  try {
    body = (await request.json()) as HandoffRequest;
  } catch {
    return Response.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  try {
    const handoff = await generateHandoff(body);
    return Response.json({ handoff });
  } catch (error) {
    if (error instanceof ServiceError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Error generating handoff:', error);
    return Response.json({ error: 'Failed to generate handoff.' }, { status: 502 });
  }
}
