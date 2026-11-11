# Contributing to ACE Studio

Use GitHub issues for reproducible bugs and feature proposals, and pull requests for focused changes.

## Start locally

Use Node.js 22.18+, Python 3.12+, LibreOffice and Ghostscript. Follow [Run from source](README.md#run-from-source). Install pinned dependencies with `npm ci` and `npm run setup:documents`.

Keep keys in your own `.env.local` or private desktop settings. Only `.env.example`, containing empty/example values, belongs in Git.

## Before submitting a pull request

1. Explain the user-visible problem and how your change fixes it.
2. Run checks relevant to the change: `npm test`, `npm run test:documents`, `npm run typecheck`, `npm run build`, and `npm run test:e2e` for browser changes.
3. Use generated or openly shareable fixtures; never commit private user files.
4. Update documentation if behavior or installation changes.

Authored code is licensed under GNU AGPL-3.0-only. Contributions must use that license. Third-party files keep their upstream licenses. No separate contributor agreement is required.

Maintainers should follow [the release guide](docs/RELEASING.md). A source commit alone does not provide an installer download.
