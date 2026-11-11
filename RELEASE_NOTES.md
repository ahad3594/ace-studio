# ACE Studio 2.1.0

Open-source PDF, Office and image tools in one local workspace.

## Choose your installer under Assets

| Computer | File | Install |
| --- | --- | --- |
| Windows 10/11 x64 | `ACE-Studio_2.1.0_windows_x64_setup.exe` | Open setup; launch from Start Menu |
| Mac Apple Silicon, macOS 14+ | `ACE-Studio_2.1.0_macos_arm64.dmg` | Drag ACE Studio into Applications |
| Intel Mac, macOS 14+ | `ACE-Studio_2.1.0_macos_x64.dmg` | Drag ACE Studio into Applications |
| Ubuntu 22.04+ / Linux Mint 21+ x64 | `ACE-Studio_2.1.0_amd64.deb` | Open with Software Install |

On Ubuntu, if your software center cannot open the file, run this from the download folder:

```bash
sudo apt install ./ACE-Studio_2.1.0_amd64.deb
```

All installers bundle Node.js, Python, core document/image tools, fonts and OCR data. Windows/macOS users install optional LibreOffice for Office-to-PDF and Ghostscript for PDF/A separately. Linux installs those as package dependencies. Gemini requires your own key.

**Choose an installer for your OS, not the developer source ZIP.** `SHA256SUMS` covers every installer and matching source archive. See the [README](https://github.com/ahad3594/ace-studio#readme) for platform guides, updates and troubleshooting.

Windows installers are unsigned. Mac apps are ad-hoc signed, without Apple Developer ID/notarization; the platform guides explain expected first-launch OS prompts. Windows ARM and Linux ARM builds are not included.

Native runners test the app and document suite on all four platforms, install/copy their packages, and verify relocated runtime startup, actual PDF inspection, service reuse and shutdown before publication. Linux also runs desktop/mobile browser checks. Human GUI/OS-approval flows and live Gemini calls are separate checks.
