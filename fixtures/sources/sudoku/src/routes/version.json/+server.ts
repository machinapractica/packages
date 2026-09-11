export const prerender = true;

export function GET(): Response {
  const revision = import.meta.env.VITE_GIT_HASH ?? import.meta.env.VITE_APP_VERSION;
  return new Response(`${JSON.stringify({ revision })}\n`, {
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
