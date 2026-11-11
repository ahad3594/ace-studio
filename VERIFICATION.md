# ACE Studio verification

## Version 2.1.0 native platform checks

The [desktop release workflow](https://github.com/ahad3594/ace-studio/actions/workflows/desktop-release.yml) builds on Ubuntu 22.04 x64, Windows Server 2022 x64, macOS 15 Intel and macOS 15 Apple Silicon. Each platform runs launcher tests, unit/API tests, document tests, TypeScript and a production build. The installer is then installed or its DMG mounted/copied, and the relocated runtime, authenticated local service, actual PDF inspection, service reuse and shutdown are checked. Linux also runs desktop/mobile Chromium browser tests. Publication requires every native build to pass.

Windows installers do not have an Authenticode publisher certificate. Mac bundles use ad-hoc signatures and are not notarized or Developer ID signed. A graphical first-launch/OS approval flow and live Gemini requests are separate from the headless checks. See the Actions run for the exact release result.

## Version 2.0.1 release checks

The [Linux release workflow](https://github.com/ahad3594/ace-studio/actions/workflows/desktop-release.yml) publishes a release only after unit/API tests, the Python document suite, TypeScript, the production build, desktop/mobile Chromium workflows, Debian package installation, bundled-Python imports, local service startup, shortcut generation, service reuse and shutdown all succeed on an Ubuntu runner. Release assets include the installer, the exact source commit and SHA-256 checksums.

These are headless automated checks. Ubuntu's graphical software-center flow, a physical desktop session, Windows/macOS, and live Gemini account requests are not exercised by that workflow. The Actions run for a particular release is the record of its actual result.

## Historical version 2.0.0 local checks

Verified on 10 November 2026 (Pakistan time). This file describes checks actually completed for this version.

## Passed

- Production compilation, TypeScript checking, static generation of the tool pages, and creation of the standalone Next.js server passed. The production build uses webpack, one build worker, and the TypeScript compiler API so it also works in restricted development environments.
- All **39 unit and API tests passed**. These include real image bytes and output dimensions, requested size limits, PDF generation and inspection, editable Word output, ZIP downloads, provider settings, conversational request metadata/history, invalid AI output, and protection of private fields.
- The Python document suite passed **nine of its ten test groups**. The passing groups inspect actual page operations, PDF/image conversion, editable Word documents, Excel tables, PowerPoint slides, Markdown, forms, native redaction, encryption, compression, repair, comparison, visual signing, workflows, HTML conversion, local summaries, real OCR, and PDF/A candidate output.
- Bundled Node.js 22.23.4 and the relocated Python 3.12 runtime start successfully. The packaged PDF, Pillow and Word libraries import from the bundled runtime.
- A production-build failure on document tool pages was fixed by renaming a client handler that shadowed Node's process identifier.
- Changing the Gemini model while retaining the saved desktop key now persists correctly, with regression coverage. The settings response does not return the API key, and the key file has owner-only permissions.

## Checks with environment limits

- **Office to PDF:** the Word/Excel/PowerPoint-to-PDF test group could not pass here. The installed LibreOffice process exits with status 1 before creating a PDF in this restricted execution environment. These three conversions remain implemented and the installer declares LibreOffice as a required OS dependency, but their successful operation was not verified in this run.
- **Browser and desktop launch:** the Playwright suite was attempted against the production build. The local server could not bind its loopback port (listen EPERM), so the browser tests did not run. No claim is made that the desktop icon, service reuse, browser downloads, or stop/restart flow was exercised on this host.
- **Live Gemini:** no real API key was used. Structured request handling, private settings and failure fallback were tested with controlled responses. A live response, model availability and account quota require the user's configured key.
- **Installation:** a Linux x64 Debian package is supplied. A privileged OS installation was not performed. Windows and macOS installers are not included.
- **PDF/A:** the export is a candidate, not independently certified archival compliance. Visual signing does not produce a certified digital signature.
- Docker builds, public hosting, Safari and Firefox were not tested in this run.

## Reproduce

```bash
npm ci
npm run setup:documents
npm test
npm run test:documents
npm run typecheck
npm run build
npx playwright install chromium
PLAYWRIGHT_SERVER_COMMAND="npm run start" npm run test:e2e
```

Install LibreOffice Writer/Calc/Impress and Ghostscript before running the full document suite. Browser tests and the desktop launcher require permission to bind a local TCP port. No paid AI call is made by the automated tests.
