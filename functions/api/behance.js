const USERNAME = 'AHMED1999';
const CACHE_KEY = new Request('https://portfolio-cache.local/api/behance/AHMED1999');
const MAX_AGE_SECONDS = 60 * 60;

export async function onRequest({ env }) {
  if (!env.SCRAPPA_API_KEY) {
    return Response.json({ error: 'Behance sync is not configured yet.' }, { status: 503 });
  }

  const cache = caches.default;
  const cached = await cache.match(CACHE_KEY);
  if (cached) return cached;

  const upstreamUrl = new URL('https://scrappa.co/api/behance/user');
  upstreamUrl.searchParams.set('username', USERNAME);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { Accept: 'application/json', 'X-API-KEY': env.SCRAPPA_API_KEY },
    });
  } catch {
    return Response.json({ error: 'Unable to reach the Behance sync provider.' }, { status: 502 });
  }

  if (!upstream.ok) {
    return Response.json({ error: 'The Behance sync provider returned an error.' }, { status: 502 });
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return Response.json({ error: 'The Behance sync response was invalid.' }, { status: 502 });
  }

  const rawProjects = payload?.data?.projects;
  if (!payload?.success || !Array.isArray(rawProjects)) {
    return Response.json({ error: 'No public projects were returned for this Behance profile.' }, { status: 502 });
  }

  const projects = rawProjects
    .filter((project) => project?.title && project?.url && project?.cover_url)
    .map((project) => ({
      id: String(project.id),
      title: String(project.title).slice(0, 180),
      url: project.url,
      cover: project.cover_url,
    }));

  const response = Response.json({ projects }, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
  });
  await cache.put(CACHE_KEY, response.clone());
  return response;
}
