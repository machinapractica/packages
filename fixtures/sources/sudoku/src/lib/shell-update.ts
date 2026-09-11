const REVISION_PATTERN = /^[a-z0-9._-]{1,128}$/i;

export type ShellUpdateResult =
  | { status: 'current'; revision: string }
  | { status: 'requested'; revision: string }
  | { status: 'unavailable' };

export async function checkForShellUpdate(
  currentRevision: string | undefined,
  pageUrl: string,
  registration: { update(): Promise<unknown> },
  fetcher: typeof fetch = fetch,
  nonce = Date.now()
): Promise<ShellUpdateResult> {
  if (!currentRevision || !REVISION_PATTERN.test(currentRevision)) return { status: 'unavailable' };

  try {
    const versionUrl = new URL('./version.json', pageUrl);
    versionUrl.searchParams.set('update', String(nonce));
    const response = await fetcher(versionUrl, {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response.ok) return { status: 'unavailable' };

    const payload = await response.json() as { revision?: unknown };
    if (typeof payload.revision !== 'string' || !REVISION_PATTERN.test(payload.revision)) {
      return { status: 'unavailable' };
    }
    if (payload.revision === currentRevision) {
      return { status: 'current', revision: payload.revision };
    }

    await registration.update();
    return { status: 'requested', revision: payload.revision };
  } catch {
    return { status: 'unavailable' };
  }
}
