# Release Checklist

One tag produces both artifacts of a release, and CI builds them:

- npm package `@hzrshz/pi-web-remote` — `.github/workflows/npm-publish.yml`, through OIDC Trusted Publishing with provenance
- GitHub Release on [bluesky4485/pi-web](https://github.com/bluesky4485/pi-web) with the four portable bundles — `.github/workflows/portable.yml`

There is no npm token in this repository and no release script to run: pushing `v<version>` is the release. The only publish that ever happened by hand was the first one (`v1.0.0`), because a trusted publisher can only be registered on a package that already exists.

Use this checklist from a clean `main` checkout.

## 1. Preflight

```bash
git fetch origin
git status --short --branch
git log --oneline --decorate -5
git rev-list --left-right --count main...origin/main
gh auth status
npm test
node_modules/.bin/tsc --noEmit
npm run lint
```

Expected:

- `git status` is clean, or only contains changes you intentionally plan to release.
- `main` and `origin/main` are aligned (`0	0`).
- GitHub is authenticated as an account that can push to this repository.
- All three checks pass. CI runs a production build but no tests, so a red test here is never caught later.

No `npm whoami` is needed: the registry authenticates the workflow, not your machine.

Before choosing a version, confirm it is free (replace `<version>`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://registry.npmjs.org/@hzrshz%2Fpi-web-remote/<version>   # 404 means free
git ls-remote --tags origin v<version>                          # empty means free
```

The package's version list also holds a `0.0.0-stage` entry. That is npm's staged-publishing placeholder, created by the registry when `@hzrshz/pi-web-remote` was still a new package — not a release of this app. Never compare against it and never bump over it.

## 2. Choose the bump

Look at `git log --oneline v<previous>..HEAD`. A batch of `feat:` commits (new UI, new commands, new settings) is a minor; fixes and small adjustments only are a patch. Decide before pushing the tag: a published version can never be reused, and the tag and `package.json` must agree or the npm job fails.

## 3. Bump the version

Edit `package.json`, and both version fields of `package-lock.json` — the top-level `version` and the one inside `packages[""]`:

```bash
node -e "
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = fs.readFileSync('package-lock.json', 'utf8');
console.log(pkg.version);
console.log(lock.match(/\"version\": \"[^\"]+\"/g).slice(0, 2).join('\n'));
"
```

All three must show the new version.

Edit those fields rather than regenerating the lockfile with `npm install` or `npm update`: this fork's lockfile keeps some `registry.npmmirror.com` `resolved` URLs on purpose, so a regenerated lockfile is a change of its own and belongs in a commit of its own.

Nothing else carries the number — the build reads it from `package.json` (`NEXT_PUBLIC_APP_VERSION` in `next.config.ts`), and the CI build is what ships.

```bash
git diff -- package.json package-lock.json
git add package.json package-lock.json
git commit -m "chore(release): v<version>"
```

## 4. Tag and push

```bash
git tag -a v<version> -m "v<version>"
git push origin main v<version>
```

Push the release tag by name. **Never `git push --tags`**: this checkout holds upstream's tags (`v0.8.9` … `v0.9.3` and older), and `origin` has none of them, so `--tags` would publish every one of those to your repository. When unsure, compare `git tag` with `git ls-remote --tags origin` first.

That single push starts both workflows.

## 5. Watch CI

```bash
gh run list --repo bluesky4485/pi-web --limit 5
gh run watch <run-id> --repo bluesky4485/pi-web
```

- `npm publish` takes a few minutes: build, pack, check the tarball, publish.
- `Portable bundles` takes 10–15 minutes: four platform jobs, then a `release` job that creates the GitHub Release and attaches the bundles.

Both jobs fail loudly on purpose. What a failure means:

| Message | Meaning |
| --- | --- |
| `tag v<x.y.z> does not match package.json version v<a.b.c>` | Step 3 and step 4 disagree. Fix `package.json`, commit, and move the tag onto that commit — see below. |
| `the build never reached the package` | `.next` was missing from the packed tarball. The build step is broken; nothing was published. |
| `already on the registry: nothing to publish` | Not an error. The version is already out (the by-hand first release, or a re-run), so the job succeeded without publishing. |
| A `bundle` job fails at `Check the bundle runs on its own` | That platform's bundle would not have started offline. Nothing is attached to the release until every job passes; fix and re-run. |
| `404 Not Found - PUT https://registry.npmjs.org/@hzrshz%2fpi-web-remote`, with the provenance statement signed first | npm never asked the registry to trust it: it sent credentials of its own. The `What npm is configured to use` step must print **no** `_authToken` line — `setup-node` writes one holding the placeholder `XXXXX-XXXXX-XXXXX-XXXXX` when it is given `registry-url` and no token, and the registry reads a write from an unknown token as a package it cannot find. |
| `POST 404 https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/...` with `ENEEDAUTH` | The registry found no Trusted Publisher for this run. `The identity npm presents` prints what the record has to match: `repository = bluesky4485/pi-web`, `workflow = npm-publish.yml` (the claim holds the workflow's display `name:`, which is why this file is named after itself), and no `environment` claim at all unless the record names one. The record is created or replaced with `npm trust` in step 8. |

Staging is the tie-breaker between those two 404s: every valid record may `npm stage publish`, and only `npm publish` is a separate grant. Run the workflow by hand from `main` with the `stage` box ticked — a run that still 404s on the exchange has no matching record, so fix the record (step 8) rather than its permissions.

A refused publish still leaves the version number free, so do not invent the next one. Fix the workflow, commit, and move the tag:

```bash
git tag -f -a v<version> -m "v<version>"
git push origin --force v<version>
```

Only the tag moves, and only while nothing has been published under that number: a tag whose release reached the registry is history. Check the old commit is an ancestor of the new one first (`git merge-base --is-ancestor <old> <new>`) so the move loses no content.

When only the npm side was wrong — a record fixed after the fact, a mirror hiccup — the tag is already right, so re-run the failed job instead of moving anything: `gh run rerun <run-id> --failed --repo bluesky4485/pi-web`. A re-run uses the workflow file from the tag's own commit.

## 6. Release notes

CI creates the release without notes, so write them once the `release` job is done. Build them from the commits, not from memory:

```bash
git log --oneline --decorate v<previous>..v<version>
git log --format='%h%x09%s%n%b' v<previous>..v<version>
git log --format='%h %an | %s' v<previous>..v<version>   # authors, to thank outside contributors
git diff --stat v<previous>..v<version>
```

- Check every command, flag and setting name against `README.md` and the code before writing it down.
- Open with the install and upgrade commands, and mention the portable bundles for offline machines.
- Keep both a Chinese and an English section.
- Pass the notes on stdin as below. A `release-notes.md` in the repo root is just an untracked file waiting to confuse the next release.

```bash
gh release edit v<version> --repo bluesky4485/pi-web --notes-file - <<'EOF'
## 中文

基于 `v<previous>..v<version>` 的提交整理。

### 新增

- ...

### 修复

- ...

### 安装 / 升级

- npm：`npm install -g @hzrshz/pi-web-remote@latest`，命令为 `pi-web-remote`
- 离线：本页底部的 `pi-web-remote-v<version>-<platform>` 压缩包，自带 Node.js 运行时

## English

Prepared from commits in `v<previous>..v<version>`.

### Added

- ...

### Fixed

- ...

### Install / update

- npm: `npm install -g @hzrshz/pi-web-remote@latest`, command `pi-web-remote`
- Offline: the `pi-web-remote-v<version>-<platform>` bundles at the bottom of this page, Node.js runtime included
EOF
```

## 7. Final verification

```bash
gh release view v<version> --repo bluesky4485/pi-web
npm view @hzrshz/pi-web-remote version --registry https://registry.npmjs.org/
npm view @hzrshz/pi-web-remote dist-tags --registry https://registry.npmjs.org/
git status --short --branch
git ls-remote --tags origin
```

Then install what users will install, in a prefix that touches nothing else:

```bash
prefix=$(mktemp -d)
npm install --global --prefix "$prefix" @hzrshz/pi-web-remote@<version> \
  --registry https://registry.npmjs.org/ --no-audit --no-fund
"$prefix/bin/pi-web-remote" --version
```

Expected:

- The release lists four assets: `linux-x64`, `linux-arm64`, `mac-arm64`, `win-x64`.
- `latest` points at the new version. A freshly published version can take a few minutes to show up, and a mirror registry can lag behind further: that is propagation, not a failed publish — do not publish again. Poll `https://registry.npmjs.org/@hzrshz%2Fpi-web-remote/<version>` until it answers.
- `pi-web-remote --version` prints the released version.
- `git ls-remote --tags origin` shows no tag you did not mean to publish.
- `main` is aligned with `origin/main`.

## 8. Manual publish (only if CI cannot)

Keep this path for a broken trusted publisher; it is how `v1.0.0` went out.

1. Read the publisher record before republishing by hand. `npm trust` needs npm 11.15 or newer and asks for 2FA; the registry holds one record per package, so a wrong one is revoked by id and re-created:
   ```bash
   npm trust list @hzrshz/pi-web-remote --registry https://registry.npmjs.org/
   npm trust revoke --id <trust-id> @hzrshz/pi-web-remote --registry https://registry.npmjs.org/
   npm trust github @hzrshz/pi-web-remote --repo bluesky4485/pi-web --file npm-publish.yml \
     --allow-publish --registry https://registry.npmjs.org/
   ```
   A trusted publisher may always `npm stage publish`; `npm publish` is a separate permission, granted when the record is made or on the package's Publishing access page. The three fields have to equal what the failed run printed under `The identity npm presents` — an `Environment name` in the record that this job never declares is as fatal as a typo in the file name. Creating or replacing a record asks for 2FA, so it stays a human step.

2. Log in to the real registry with the account that owns the `hzrshz` organization. `publishConfig.registry` in `package.json` already pins publishing to npmjs.org, so a machine-wide mirror cannot redirect it:
   ```bash
   npm login --registry https://registry.npmjs.org/
   npm org ls hzrshz --registry https://registry.npmjs.org/   # your user must be there
   ```
3. Stop any dev server on 30141 and build for real: the published package ships `.next`, and nothing compiles on the machine that installs it.
   ```bash
   npm run build
   ls .next/server/route-cache 2>/dev/null && echo "delete it: an e2e run in start mode writes this, and it would be published"
   ```
4. Check the tarball before sending it — a build that did not happen produces a package that is 90-odd files instead of 700+:
   ```bash
   tarball=$(npm pack --pack-destination /tmp | tail -1)
   tar -tzf "/tmp/$tarball" | grep -c '^package/\.next/'
   ```
5. Publish, then fix the publisher so the next release comes from CI:
   ```bash
   npm publish --access public
   ```
