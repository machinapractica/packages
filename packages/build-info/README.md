# @machinapractica/build-info

Experimental versioned build identity and freshness. Browser-safe root export; filesystem hashing/writing is only in `/node`. No runtime dependencies. Version `0.1.0-alpha.0` initially ships as a locally built tarball.

```js
import { createBuildInfo, verifyArtifact } from '@machinapractica/build-info/node';
await createBuildInfo('dist', {
  repository: 'https://github.com/owner/repository',
  revision: fullGitRevision,
  channel: 'production'
});
await verifyArtifact('dist');
```

Call after the production build completes. The v1 manifest contains exactly `formatVersion`, `repository`, `revision`, `contentHash`, and `channel`. Revision is a full lowercase Git SHA (40 or 64 digits). Content identity is SHA-256 over a domain-separated, length-prefixed traversal of sorted relative file paths and bytes. Timestamps, directory metadata and permissions are not hashed; symbolic links and special files are rejected. The declared manifest path alone is excluded to avoid self-reference. Writing is exclusive: rebuild into a fresh artifact directory.

```js
import { probeBuild } from '@machinapractica/build-info';
const freshness = await probeBuild({
  local: embeddedManifest,
  pageUrl: location.href,
  manifestUrl: './build-info.json'
});
```

Results are `current`, `update-available`, or `unavailable`. A changed content hash counts even when the revision matches. Different repository/channel identities are unavailable. Probe uses a same-origin endpoint, no-store, no redirects, and a bounded deadline. A worker serving cached manifests must mark `X-Machina-Practica-Build-Source: cache`; otherwise the network provenance of its response cannot be inferred. This package never reloads a page or activates a service worker.

Legacy Sudoku `{ revision }` and Ark Nova manifests remain distinct formats. Consumers must explicitly map source identity and compute an actual artifact digest; arbitrary legacy version labels are not hashes. Validation against the retained Ark Nova fixture proves this boundary, not adoption or compatibility with all deployed artifacts.

Use a completed, quiescent artifact tree owned by the build. Hashing is not an atomic snapshot of a concurrently changing tree, and content hashes are integrity checks, not signatures. GPL-3.0-only.

The `mp-build-info` CLI exposes `create DIRECTORY REPOSITORY REVISION CHANNEL`, `verify DIRECTORY`, and `probe LOCAL_MANIFEST PAGE_URL MANIFEST_URL`. It prints JSON and exits nonzero on invalid artifacts or unavailable probes. Update availability is a successful observation, not a deployment instruction.
