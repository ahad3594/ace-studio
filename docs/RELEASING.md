# Publishing an ACE Studio release

GitHub Releases contains installable binaries; the repository contains source and build instructions. Do not add large `.deb` files to Git history.

## Prepare a version

1. Update `package.json` and root entries of `package-lock.json` to the same `major.minor.patch` version.
2. Update installer links/filenames in `README.md`, `docs/INSTALL_UBUNTU.md` and `RELEASE_NOTES.md`. Add a `CHANGELOG.md` entry.
3. Commit to `main`. A push changing `package.json` starts **Build and publish Linux installer**. Maintainers can also run it manually in Actions, or push a matching `vVERSION` tag.

An already published version is never overwritten. Bump the version for fixes. If an attempt left a draft release, the workflow can reuse that draft to complete its uploads. A pushed tag must match the package version.

## Workflow checks

- Install pinned dependencies and run unit, document, TypeScript, production-build and Chromium browser checks.
- Build an x86-64 Debian package on Ubuntu 22.04 and validate package metadata and desktop entry.
- Install on the disposable runner, start the bundled runtime without opening a browser, check the service and shortcut, then stop it.
- Archive the exact source commit and calculate SHA-256 hashes.
- Create a draft release, upload all assets, verify their presence, then publish.

The workflow uses GitHub's repository-scoped job token, with **contents: write** in the release job. No personal access token is needed. Normal CI keeps read-only repository permissions.

## Required assets

| File | Purpose |
| --- | --- |
| `ACE-Studio_VERSION_amd64.deb` | Ubuntu/Linux Mint installer |
| `ACE-Studio_VERSION_source.zip` | Matching source, license, notices and build instructions |
| `SHA256SUMS` | Checksums for those files |

The package also includes `/opt/ace-studio/ACE_Studio_Source.zip`, the application license, notices, and bundled runtime license metadata. GitHub supplies automatic tag source archives too.

## Verify publication

Open **Releases → latest → Assets**, download the installer and `SHA256SUMS`, and run `sha256sum --ignore-missing --check SHA256SUMS`. Check that the README download link works. A release is not ready while its assets are missing or its workflow has failed.

Headless checks verify installation and service startup. A human check of Ubuntu's software-center interface and a real desktop session remains separate. Live Gemini requires a user-owned key and is not exercised automatically.
