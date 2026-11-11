# Install ACE Studio on Windows

Supports Windows 10/11 on Intel/AMD 64-bit computers. Windows ARM is not a native build target. The setup EXE installs for your current user and bundles Node.js, Python, the document engine, fonts and OCR data.

## Install and open

1. [Download ACE-Studio_2.1.0_windows_x64_setup.exe](https://github.com/ahad3594/ace-studio/releases/latest/download/ACE-Studio_2.1.0_windows_x64_setup.exe), or choose it under **Releases → Assets**.
2. Open the EXE and follow the setup screens. Keep the desktop-shortcut option selected if wanted.
3. Open **ACE Studio** from the Start Menu or desktop. The app opens in your default browser, using a local service. No terminal, Python installation or npm commands are needed.

This community installer is **unsigned**: it has no Authenticode publisher certificate or established SmartScreen reputation. Windows may show an unknown-publisher/SmartScreen prompt. Obtain it from this repository and verify its checksum before deciding to run it. Do not turn off Windows security protections globally; managed-computer policies may require an administrator's approval.

## Optional tools for Office conversion and PDF/A

Core PDF, image, editable Office export and OCR tools are bundled. For **Word/Excel/PowerPoint → PDF**, install [LibreOffice for Windows](https://www.libreoffice.org/download/download-libreoffice/) in its normal location. For **PDF/A export**, install [64-bit Ghostscript](https://ghostscript.com/releases/gsdnld.html). ACE detects standard `Program Files` installations; no PATH editing is normally required.

After installing an optional tool, stop ACE from **Settings → Stop desktop service** and reopen it. A tool whose dependency is missing remains unavailable with an explanation. Microsoft Office is not required.

## Optional Gemini

Open **Settings → ACE intelligence** and save/test your own Gemini key and available model. Local tools do not need it.

## Update, stop and uninstall

- Stop ACE using Settings or **Start Menu → ACE Studio → Stop ACE Studio**.
- To update, stop ACE and run the newer setup EXE. The same per-user installation is upgraded.
- Remove it through **Windows Settings → Apps → Installed apps → ACE Studio → Uninstall**.
- Your local profile is stored separately under `%LOCALAPPDATA%\ACE Studio`. Uninstalling the application preserves that profile.

## Check a download

Download `SHA256SUMS` from the same release. In PowerShell:

```powershell
Get-FileHash .\ACE-Studio_2.1.0_windows_x64_setup.exe -Algorithm SHA256
```

Compare the hash with the corresponding line in `SHA256SUMS`.

If ACE cannot start, inspect `%LOCALAPPDATA%\ACE Studio\state\server.log`. Remove private filenames, keys and session tokens before sharing diagnostics in an issue.
