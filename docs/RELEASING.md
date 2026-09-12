# Independent experimental releases

Run `./scripts/verify.sh` with Node 24.18.1 and npm 11.16.0. It performs the production TypeScript build, source snapshot integrity checks, unit/CLI contracts, real Chromium evidence and isolated packed-install checks. `.artifacts/` contains two npm tarballs and a manifest of source revision, dirty state, package contents and hashes. API reports under `api/` must be deliberately updated when exported declarations change. Test logs and browser evidence remain under `evidence/` and `test-results/`.

Packages have independent versions and changelogs. No automatic version bumps, `latest` tags or stable releases are configured. The workflow `release.yml` accepts one package and defaults to a dry run. Publication requires main, a clean verified checkout, the exact tested tarball, GitHub OIDC and an npm trusted publisher. No registry token is stored in Actions. Package CI has read-only permissions; it cannot publish PR code.

## Registry bootstrap

Both packages were bootstrapped at **0.1.0-alpha.0** on 2026-09-12, with public access and the `alpha` tag. Their GitHub trusted publishers are configured for this repository, `release.yml`, environment `npm`. The initial versions were published locally without GitHub provenance. npm's [trust command](https://docs.npmjs.com/cli/v11/commands/npm-trust/) supports CLI configuration, but requires an existing registry package and account 2FA. Do not publish an empty placeholder to satisfy that requirement. The first real package publication and any npm authentication challenge remain distinct from preparing the tarball and workflow.

After the actual package exists, configure each package with the authenticated CLI:

```sh
npm trust github @machinapractica/testing --repo machinapractica/packages --file release.yml --env npm --allow-publish --yes
npm trust github @machinapractica/build-info --repo machinapractica/packages --file release.yml --env npm --allow-publish --yes
```

These commands may require npm's account authentication challenge; a GitHub website visit is not inherently necessary. Verify with `npm trust list PACKAGE`. Future releases use the manual workflow with `publish=true` and receive npm provenance. A locally bootstrapped first version must not be described as having GitHub provenance.

## Evidence limits and adoption

No existing repository imports these packages yet. Packed-install and browser fixtures are package tests, not adopters. The retained Ark Nova manifest is an existing synthetic unit fixture, not a production artifact. Pinned source hash checks prove snapshot integrity, not complete historical compatibility. See [source inventory](SOURCE_INVENTORY.md) for later extraction gates.

Before 1.0 require three independent consumers, net deletion of local code, retained historical compatibility and consumer CI against released versions. Consumer migrations, initial projects, and native/hardware qualification are outside this implementation's scope.
