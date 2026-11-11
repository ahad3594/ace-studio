# ACE Studio

**Every file. One workspace.**

Open-source application under [GNU AGPL v3](LICENSE). Choose your installer:

| Your computer | Download | Help |
| --- | --- | --- |
| Windows 10/11, Intel/AMD 64-bit | [Windows setup EXE](https://github.com/ahad3594/ace-studio/releases/latest/download/ACE-Studio_2.1.0_windows_x64_setup.exe) | [Windows guide](docs/INSTALL_WINDOWS.md) |
| Mac with Apple silicon (M-series) | [Apple Silicon DMG](https://github.com/ahad3594/ace-studio/releases/latest/download/ACE-Studio_2.1.0_macos_arm64.dmg) | [Mac guide](docs/INSTALL_MACOS.md) |
| Mac with Intel processor | [Intel Mac DMG](https://github.com/ahad3594/ace-studio/releases/latest/download/ACE-Studio_2.1.0_macos_x64.dmg) | [Mac guide](docs/INSTALL_MACOS.md) |
| Ubuntu 22.04+ / Linux Mint 21+, Intel/AMD 64-bit | [Ubuntu DEB](https://github.com/ahad3594/ace-studio/releases/latest/download/ACE-Studio_2.1.0_amd64.deb) | [Ubuntu guide](docs/INSTALL_UBUNTU.md) |

[All releases and checksums](https://github.com/ahad3594/ace-studio/releases) · [Contribute](CONTRIBUTING.md)

Mac builds require macOS 14+. Windows and Mac installers are community builds without a publisher certificate; macOS builds are ad-hoc signed, **not Developer ID signed or notarized**. See the platform guides for the expected OS prompts. No Windows ARM or Linux ARM build is supplied.

ACE Studio is a desktop and web app for PDFs, Office documents and images. You can turn images into a PDF, turn a PDF into an editable Word file, export PDF pages as images, and use many other file tools. It also includes the original image resizing and compression studio.

ACE has its own name, icon and interface. It is not an iLovePDF product and does not use iLovePDF's branding or private software.

## Install the desktop app

### Windows

Download the Windows setup `.exe`, open it, and follow the installer. Open **ACE Studio** from the Start Menu or desktop shortcut. The installer is per-user and includes Node.js, Python, the document engine, fonts and OCR data. See the [Windows guide](docs/INSTALL_WINDOWS.md) for optional LibreOffice/Ghostscript installation and OS prompts.

### macOS

Choose the DMG for your Mac's chip, open it, and drag **ACE Studio** into **Applications**. Open it from Applications. Node.js, Python, the document engine, fonts and OCR data are bundled. See the [Mac guide](docs/INSTALL_MACOS.md) for the first launch and optional dependencies.

### Ubuntu / Linux Mint

The `.deb` installer is for **64-bit Ubuntu, Linux Mint and compatible Debian-based Linux systems**.

1. [Download `ACE-Studio_2.1.0_amd64.deb`](https://github.com/ahad3594/ace-studio/releases/latest/download/ACE-Studio_2.1.0_amd64.deb). On the [Releases page](https://github.com/ahad3594/ace-studio/releases), expand **Assets** and choose the `.deb` file. **Code → Download ZIP** downloads developer source code, not the installer.
2. Open **Files → Downloads**, right-click the `.deb` file, and choose **Open With → Software Install / App Center**. Keep an internet connection available for missing system dependencies.
3. Click **Install**. Your system may ask for your normal administrator password. LibreOffice and Ghostscript are installed as system dependencies if they are missing.
4. Open your Applications menu, search for **ACE Studio**, and click it.
5. ACE opens in your normal browser. Its server runs only on your computer at a local address.
6. On the first launch, ACE also creates an **ACE Studio** shortcut on your desktop. If Linux asks, right-click the shortcut and choose **Allow Launching**.

If your Ubuntu software installer cannot open local `.deb` files, open a terminal in the folder containing the download and run:

```bash
sudo apt install ./ACE-Studio_2.1.0_amd64.deb
```

Use `apt install` for a local file so Ubuntu installs required dependencies too. See the [Ubuntu installation guide](docs/INSTALL_UBUNTU.md) for checksums, updates, removal and troubleshooting.

The installers for all four platforms, matching source archive and `SHA256SUMS` are published together in **GitHub Releases**. Large built installers are kept there instead of in the source tree. Releases are built and checked by [the desktop release workflow](.github/workflows/desktop-release.yml).

After installation, you do **not** need to run npm, Python or terminal commands to open the app. Desktop installers include Node.js, the Python document engine, fonts, the ACE icon and English/German/Urdu OCR data. It needs about 1 GB of free disk space after installation.

Closing the browser tab leaves the small local service running. To stop it, open **Settings → Stop desktop service**, or right-click ACE Studio in the application menu and choose **Stop ACE Studio**. Click the app icon to open it again. Clicking the icon while ACE is already running opens the same service instead of starting duplicates.

## How to use ACE

1. Open **All tools**.
2. Search for a tool or choose a category.
3. Add your files. You can drag them into the app or click **browse**.
4. Check the settings. For page ranges, use examples like `1-3,5`, `all`, `odd` or `even`.
5. Click the tool's main button.
6. Preview the result where available, then click **Download file** or **Download ZIP**.

ACE creates a new copy. It does not overwrite your original file. If an operation cannot meet a requested size or another constraint, ACE explains this instead of claiming success.

### Images to PDF

Open **Images to PDF**, add your pictures, use the up/down arrows to put them in order, choose the paper size, then click **Images to PDF**. Each picture becomes a page.

### PDF to Word

Open **PDF to Word**, add a PDF and click **PDF to Word**. The result is a real `.docx` file with editable content. If the PDF is a scan or photograph, turn on **Run OCR on scanned pages first**. Complex layouts may need small corrections in Word after conversion.

### PDF to images

Open **PDF to images**, choose JPEG or PNG and the pages you want, then run the tool. More than one image is downloaded in a ZIP. You can also extract embedded pictures instead of rendering complete pages.

### Merge and split

For **Merge PDF**, add at least two PDFs and put the files in the right order. For **Split PDF**, leave Page groups empty to create one file for each selected page, or use groups such as `1-3;4-6` to create separate grouped files.

### Visual editing

For cropping, redaction, text, shapes, watermarks, signatures and form fields, drag on the page preview to choose an area. You can also type exact percentages in the settings. The area is applied to the **Pages** setting, so check that setting too.

### Workflows

Open **Custom workflows** and add up to eight PDF steps. For example, rotate pages, add page numbers and compress the file. Save the workflow with a name if you want to reuse it. Passwords, form values and redaction search text are excluded from saved workflows.

## Make the AI conversational

Without Gemini, ACE uses a **limited local parser**. It recognizes common requests but is not a language model. This is why it can sometimes feel hardcoded.

To use the intelligent assistant in the installed desktop app:

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Open ACE using its desktop icon.
3. Open **Settings → ACE intelligence**.
4. Paste your key into the password field. Choose a model that is available to your Google account.
5. Click **Save & test connection**.

The key is saved in your local per-user ACE profile. Unix systems use owner-only file permissions; Windows uses the user profile's inherited filesystem ACLs. It is not saved in browser preferences, included in downloads, returned by the settings API, or committed to Git.

Gemini receives your instruction, recent conversation, file types and sanitized settings. It can understand flexible wording, follow-up requests, typos, English, Roman Urdu, Urdu and German. Examples:

```text
I need to edit this PDF in Word. Can you prepare it for me?
Meri PDF ki sirf pehli aur teesri page rakh do.
Now rotate those pages and keep the rest of the settings.
Please make this photo smaller, even if the dimensions need to shrink a little.
Bitte diese PDF in ein bearbeitbares Word-Dokument umwandeln.
```

The AI chooses and explains a plan. The actual file work is done by deterministic document or image software. AI cannot run arbitrary code or choose tools outside the validated catalogue.

**AI summarization and translation are different:** they need document text. ACE sends that text to Gemini only when you check **Allow extracted document text to be sent to Gemini for this request**. Translation needs a working Gemini connection. Local summarization selects useful sentences from your document and is labeled as a local extractive summary. Google account limits, model availability and API billing still apply.

If you run ACE from source or on a server, set `GEMINI_API_KEY` in `.env.local` instead. The key form is intentionally disabled outside an authenticated desktop session. Never put a real key in a Git repository.

## Included tools

| Group | Tools |
| --- | --- |
| Organize | Merge, split, remove pages, extract pages, organize pages, scan photos to PDF, custom workflows |
| Convert | Images to PDF; Word, Excel and PowerPoint to PDF; HTML to PDF; PDF to images, Word, Excel, PowerPoint and PDF/A |
| Optimize | Compress, repair and OCR |
| Edit and sign | Rotate, page numbers, watermark, crop, add text/images/shapes, fill or create form fields, visual signatures |
| Security | Unlock with a known password, AES-256 protection, native redaction, document comparison |
| Intelligence | Gemini or local summaries, Gemini translation, PDF to Markdown |
| Images | AI image studio, resize, compress, format conversion, batch ZIP downloads and before/after comparison |

See [TOOL_GUIDE.md](TOOL_GUIDE.md) for tool-specific instructions and limits.

## Important limits

- A PDF is not an Office source document. Word and editable PowerPoint conversions reconstruct the layout and may need corrections. Visual PowerPoint mode uses page images instead of editable text.
- PDF to Excel detects tables where possible. If no tables are found, it exports rows of text. It does not invent spreadsheet structure.
- OCR can make mistakes. Check names, dates, numbers and important text.
- Translation produces a newly typeset text PDF. It does not promise to preserve the original page design, images or tables.
- PDF/A export produces a Ghostscript PDF/A-2 candidate. Use an independent validator such as veraPDF before relying on archival compliance.
- Signing adds your visual signature. Certified digital signatures, identity verification, remote signature requests and an e-signing audit trail are not included.
- Forms support manual creation and filling. Automatic AI detection of form fields is not included.
- Cropping hides content outside the page box. It does not permanently remove it. Use **Redact PDF** for removal.
- Repair can recover only content that can still be read. It cannot recreate missing data.
- Cloud storage integrations, accounts, payments, cloud sync and cross-device scan transfer are not included. Local tools do not need an account or subscription.

## Privacy and safety

PDF and Office jobs use a private temporary directory. Files are deleted when the job finishes, fails, is cancelled, or times out. Originals and results remain in browser memory only while you are using the page. Preferences, favorites and named presets are saved locally. The original image studio can process JPEG/PNG/WebP in the browser if its server is unavailable; document tools need the local document engine.

The desktop service binds only to `127.0.0.1`. Its sensitive settings need a random, local, HttpOnly desktop session cookie. Other websites cannot configure the provider. Document passwords are not passed to Gemini. Please do not type passwords into the AI instruction box; use the private password fields.

Uploads are checked by actual contents. Office archives have expansion limits and macro/external-resource checks. Worker processes have page, file-size, CPU, memory and time limits. Native parsers should still be kept updated. Do not configure an external reverse proxy or logging service to retain uploaded document bodies.

Default document limits are 20 source files, 25 MB per file, 80 MB per job and 200 PDF pages. Rendering/export is limited to 60 pages per job; OCR is limited to 30 selected pages. One document-processing job runs at a time. The existing image limits are 20 images and 20 MB per image.

## Run from source

Desktop users can skip this section. Developers need Node.js 22.18+ and Python 3.12+. Install LibreOffice/Ghostscript using the relevant platform guide. On Windows use `Copy-Item .env.example .env.local` instead of `cp` in the example below.

```bash
npm ci
npm run setup:documents
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

For a production build:

```bash
npm run build
npm run start
```

The production start script loads `.env.local`, copies the static assets, sets the document-engine paths and starts the standalone server. It binds to loopback by default. Set `ACE_HOST=0.0.0.0` only if you intentionally want network access and have configured suitable access controls.

Useful optional environment settings:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
ACE_PYTHON=/absolute/path/to/.venv/bin/python
ACE_SOFFICE=/absolute/path/to/libreoffice
ACE_GS=/absolute/path/to/gs
ACE_SRGB_PROFILE=/absolute/path/to/srgb.icc
```

Use `ACE_PYTHON` only when the default `.venv` path is not correct. Do not copy another person's settings or secrets into the project.

## Tests

```bash
npm test
npm run test:documents
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests inspect real output files, not just mocked conversion responses. They check image bytes, PDF page counts, editable DOCX content, spreadsheet and slide content, forms, passwords, native redaction, OCR, archives, downloads and the browser workflows. Gemini failure and privacy controls use controlled test responses. No paid AI request is made by the automated tests.

See [VERIFICATION.md](VERIFICATION.md) for the checks actually completed for this delivery.

## Build the Linux installer

Use a complete, relocatable CPython installation with the same version as `.venv`, and an official Linux x64 Node.js binary. The package builder never needs root.

```bash
npm run build
python3 desktop/build.py --node /path/to/node/bin/node --python-runtime /path/to/python
```

The installer is written to `desktop-dist/`. A matching source archive is included in the installed app. The GitHub release workflow can build the same package on an Ubuntu runner. Windows and macOS builders are in `desktop/build_native.py`. They run on native GitHub runners and use a relocatable managed Python runtime. See [the release guide](docs/RELEASING.md).

## Docker and server deployment

The project needs a Node host or container. Static hosting and Worker-only platforms cannot run the native document engine.

```bash
docker build -t ace-studio .
docker run --rm -p 127.0.0.1:3000:3000 --env-file .env.local ace-studio
```

The Docker image includes the Python requirements, LibreOffice, Ghostscript and fonts. A public deployment also needs HTTPS, access control, request-size limits and a shared rate limiter when using multiple instances. Set `TRUST_PROXY=true` only behind a trusted proxy that strips and overwrites forwarded headers. Desktop key configuration remains disabled in normal server deployments.

## Project structure

```text
app/                  Pages and validated API routes
components/documents/ Tool directory, command box, settings and visual workspace
lib/ai/               Gemini services, structured routing and local fallback
lib/documents/        Tool catalogue, schema, private jobs and worker control
lib/image/            Existing Sharp image engine
worker/               Deterministic Python document engine
desktop/              Native launcher and Debian package builder
data/                 Bundled OCR models, fonts and their notices
tests/                Real-file tests and browser tests
```

## Open source and contributions

ACE Studio's authored code is licensed under **GNU AGPL-3.0-only**; see [LICENSE](LICENSE) and [COPYRIGHT](COPYRIGHT). You can inspect, use, modify and redistribute it under that license. Modified network deployments must provide the corresponding source as the AGPL requires.

Third-party components retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Gemini is an optional external service and uses each user's own key and account limits. Core local file tools do not require a Gemini key.

For bugs and feature requests, [open a GitHub issue](https://github.com/ahad3594/ace-studio/issues). See [CONTRIBUTING.md](CONTRIBUTING.md) for development and [the release guide](docs/RELEASING.md) for publishing installers. Please do not upload private documents or API keys into issues.
