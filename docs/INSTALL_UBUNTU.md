# Install ACE Studio on Ubuntu

## What you need

- A 64-bit Intel/AMD computer running Ubuntu 22.04+, Linux Mint 21+, or a compatible Debian-based Linux system.
- About 1 GB for ACE Studio, plus space for missing LibreOffice/Ghostscript dependencies.
- Internet access for missing dependencies and your normal Ubuntu administrator password.

The installer is for `amd64` / `x86_64`. ARM, Windows and macOS packages are not available. Check architecture with `dpkg --print-architecture` if unsure.

## Download and install

1. [Download ACE-Studio_2.0.1_amd64.deb](https://github.com/ahad3594/ace-studio/releases/latest/download/ACE-Studio_2.0.1_amd64.deb), or visit [Releases](https://github.com/ahad3594/ace-studio/releases) and expand **Assets**.
2. Choose the file ending in **`_amd64.deb`**. The source ZIP is for developers; **Code → Download ZIP** does not install ACE Studio.
3. Open **Files → Downloads**, right-click the `.deb`, and choose **Open With → Software Install / App Center**.
4. Click **Install** and enter your Ubuntu login password if asked. Ubuntu downloads LibreOffice and Ghostscript if missing.
5. Open **Applications**, search for **ACE Studio**, and click it. ACE opens in your default browser at a local address.
6. A desktop shortcut is created on first launch. If Ubuntu asks, right-click it and choose **Allow Launching**.

You do not need Node.js, Python package commands or a terminal to open the installed app.

### If your software installer cannot open the file

Open a terminal **in the folder containing the download** (Files → right-click empty space → Open in Terminal) and run:

```bash
sudo apt install ./ACE-Studio_2.0.1_amd64.deb
```

The `./` means “this file in the current folder.” Use `apt install` so dependencies are installed automatically. Do not rename a source ZIP to `.deb`.

## Verify the download (optional)

Download `SHA256SUMS` from the **same release** as the installer. In the folder containing both files, run:

```bash
sha256sum --ignore-missing --check SHA256SUMS
```

The installer should report **OK**. A checksum detects an incomplete or changed download; obtain the files from this project's official GitHub release.

## Configure the optional AI assistant

Local PDF and image tools work without an AI key. For conversational Gemini features, open **Settings → ACE intelligence**, enter **your own** Gemini API key, choose your available model, and use **Save & test connection**. Gemini requires internet. The key stays in private local ACE settings and is never included in the installer or Git repository.

## Stop or reopen ACE

- Closing the browser tab leaves the local service running.
- Stop it with **Settings → Stop desktop service** or the **Stop ACE Studio** application-menu action.
- Reopen it with the ACE Studio icon. It reuses a running instance.

## Update or remove

Stop ACE Studio, download the newer `.deb`, and install it the same way. `apt install ./NEW_FILE.deb` upgrades the existing package. Local preferences and the optional provider key are separate from application files.

To remove the app, use Ubuntu's software manager or:

```bash
sudo apt remove ace-studio
```

Per-user settings in `~/.config/ace-studio`, runtime state in `~/.local/state/ace-studio`, and the desktop shortcut are separate user files.

## Common problems

| Problem | What to do |
| --- | --- |
| `.deb` opens in Archive Manager | Use **Open With → Software Install**, or `apt install ./...deb`. |
| “Unsupported file” or “No such file” | Open a terminal in the download folder and use the exact downloaded filename. |
| Wrong architecture | Use an `amd64` computer. No ARM package is supplied. |
| Dependencies cannot download | Check your internet and Ubuntu software repositories; retry installation. |
| App icon does not appear immediately | Reopen the Applications menu. The launcher is also at `/opt/ace-studio/ace-studio`. |
| Desktop icon is not trusted | Right-click → **Allow Launching**. |
| ACE cannot start | Check `~/.local/state/ace-studio/server.log`. Remove tokens, keys and private filenames before sharing logs. |
| AI connection fails | Check your Gemini key, model, internet and account limits. Local tools remain available. |

[Open an issue](https://github.com/ahad3594/ace-studio/issues) with your Ubuntu version, architecture, ACE version and exact error if help is needed. Never attach private documents or credentials.
