# ACE Studio 2.0.1

Open-source PDF, Office and image tools in one local workspace.

## Install on Ubuntu / Linux Mint

1. Expand **Assets** below and download **ACE-Studio_2.0.1_amd64.deb**.
2. Open it with Ubuntu **Software Install / App Center** and click **Install**.
3. Open **ACE Studio** from Applications. No terminal is needed to launch it.

If your software center cannot open the file, run this from the download folder:

```bash
sudo apt install ./ACE-Studio_2.0.1_amd64.deb
```

Supports Ubuntu 22.04+, Linux Mint 21+, and compatible x86-64/amd64 Debian-based systems. Internet is needed for missing LibreOffice/Ghostscript dependencies. Windows, macOS and ARM packages are not included.

**Choose the `.deb` to install the app.** The source ZIP is for developers; `SHA256SUMS` contains checksums. See [the Ubuntu guide](https://github.com/ahad3594/ace-studio/blob/main/docs/INSTALL_UBUNTU.md) for updates, removal and troubleshooting.

This release adds public installation instructions, GNU AGPL v3 licensing and automatic packaging. Local tools do not need a key. Conversational Gemini needs each user's own key.

The release pipeline checks the application, package installation, headless startup, service reuse and shutdown before publication. A real graphical desktop session and live Gemini calls are separate checks.
