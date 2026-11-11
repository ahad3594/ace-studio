# Install ACE Studio on macOS

Requires macOS 14 or newer. Choose the native package for your chip:

| About This Mac shows | Download |
| --- | --- |
| Apple M-series chip | [ACE-Studio_2.1.0_macos_arm64.dmg](https://github.com/ahad3594/ace-studio/releases/latest/download/ACE-Studio_2.1.0_macos_arm64.dmg) |
| Intel processor | [ACE-Studio_2.1.0_macos_x64.dmg](https://github.com/ahad3594/ace-studio/releases/latest/download/ACE-Studio_2.1.0_macos_x64.dmg) |

## Install and open

1. Open the downloaded DMG.
2. Drag **ACE Studio** onto **Applications**.
3. Eject the disk image and open **ACE Studio** from Applications.
4. ACE opens in your default browser using a service bound to your own computer. Node.js, Python, the document engine, fonts and OCR data are included. No terminal commands are needed to open it.

These community bundles are **ad-hoc signed, not Developer ID signed or notarized by Apple**. Ad-hoc signing does not establish a trusted publisher. Gatekeeper can block first launch. Verify the official release and checksum first. If you choose to approve this app, use macOS's per-app **System Settings → Privacy & Security → Open Anyway** flow after the initial attempt, as described by [Apple's guidance](https://support.apple.com/102445). Do not disable Gatekeeper globally. A managed Mac may require its administrator's approval.

## Optional tools

Core PDF, image, editable Office export and OCR tools are bundled. To convert **Word/Excel/PowerPoint → PDF**, install [LibreOffice for macOS](https://www.libreoffice.org/download/download-libreoffice/) into `/Applications`. ACE also checks your user `~/Applications` folder. Choose LibreOffice's build for your chip.

For **PDF/A export**, Ghostscript and its sRGB profile are required. Developers using [Homebrew](https://brew.sh/) can install it with `brew install ghostscript`; ACE detects the standard Apple Silicon and Intel Homebrew locations. Without Ghostscript, the other local tools remain available.

After installing optional tools, stop ACE from Settings and reopen it. A missing dependency is shown in the relevant tool.

## Settings, update and remove

- Configure an optional Gemini key under **Settings → ACE intelligence**. Local tools do not require a key.
- Closing the tab leaves the service running. Stop it with **Settings → Stop desktop service**.
- Stop ACE before replacing the app with a newer version from a DMG.
- To uninstall, stop ACE and move **ACE Studio.app** from Applications to Trash.
- Preferences, the optional key and logs are separate user files in `~/Library/Application Support/ACE Studio/`. Uninstalling the app preserves those files.

## Verify the download

Download `SHA256SUMS` from the same release and, in the download folder, run:

```bash
shasum -a 256 ACE-Studio_2.1.0_macos_arm64.dmg
```

For Intel, use the `_macos_x64.dmg` filename instead. Compare the result with the matching line in `SHA256SUMS`.

If ACE fails to start, check `~/Library/Application Support/ACE Studio/state/server.log`. Remove keys, session tokens and private filenames before sharing logs.
