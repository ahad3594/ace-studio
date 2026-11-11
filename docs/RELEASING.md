# Publishing desktop releases

The source tree contains the code and native builders. **GitHub Releases** contains installers, matching source and checksums. Built installers are not committed into Git.

## Release steps

1. Bump `package.json` and both root version fields in `package-lock.json` together (`major.minor.patch`).
2. Update versioned download links in the README, platform installation guides and release notes. Add a changelog entry.
3. Push to `main`. A change to `package.json` triggers **Build and publish desktop installers**. Manual workflow dispatch and matching `vVERSION` tags are supported too.
4. Wait for all native jobs and the publish job to succeed. Check every asset under **Releases → Assets** and verify checksums.

Published versions are not overwritten. Use a new version for fixes. A failed attempt's draft can be completed on a retry.
Newer commits cancel obsolete in-progress builds. Draft metadata must match the publishing commit. After all native checks succeed, an empty unpublished draft may be retargeted to that commit. A draft with assets from an older commit is not silently changed; prepare a new version or resolve that draft deliberately. Published releases are never retargeted.

## Native build matrix

| Runner | Output | Installer check |
| --- | --- | --- |
| Ubuntu 22.04 x64 | `_amd64.deb` | Install with apt, then test bundled runtime |
| Windows Server 2022 x64 | `_windows_x64_setup.exe` | Silent per-user installation, Start Menu shortcut, runtime, uninstall |
| macOS 15 Intel | `_macos_x64.dmg` | Mount, copy app into a path with spaces, test native entry point |
| macOS 15 Apple Silicon | `_macos_arm64.dmg` | Same checks on native ARM hardware |

Each job runs launcher tests, unit/API tests, the document suite, TypeScript and the production build. Installed-app checks verify imports from the relocated runtime, actual PDF inspection through the server, authenticated local service reuse and shutdown. Linux also checks desktop/mobile Chromium workflows.

All four jobs must succeed before a release is published. Publication creates a draft, attaches every installer plus `ACE-Studio_VERSION_source.zip` and `SHA256SUMS`, verifies the asset list, then publishes. Only the publish job has repository **contents: write** permission, using GitHub's job token. No personal access token is needed.

## Building locally

Build on the destination OS with Node.js 22, a relocatable [uv-managed Python 3.12](https://docs.astral.sh/uv/guides/install-python/), and a `.venv` made from that interpreter. Install `requirements.lock.txt`, run `npm ci`, tests and `npm run build`. Windows requires Inno Setup 6; macOS requires Xcode command-line tools. Linux requires the dependencies listed by the workflow.

Run `python desktop/build_native.py --node PATH_TO_NODE --python-runtime PATH_TO_MANAGED_PYTHON`. Outputs go to `desktop-dist/`. Add `--verify` **only on a disposable build machine** to install/copy the package and perform native checks; the Windows check also uninstalls its test installation.

The Python runtime and dependency wheels are built separately for each OS/architecture. Do not copy a Linux virtual environment into a Windows or Mac installer. Every native package includes an authored-source ZIP, license and third-party notices.

## Signing status

Windows setup EXEs are unsigned community installers. Mac bundles are ad-hoc signed for executable integrity, without Developer ID certificates or Apple notarization. OS approval prompts are documented in the platform guides. Do not describe these builds as notarized or publisher-verified. A maintainer can add certificate-backed signing in a separate, credential-backed release process.

Headless tests do not exercise a human clicking through SmartScreen, Gatekeeper, Finder or the Windows setup UI, or live Gemini requests.
