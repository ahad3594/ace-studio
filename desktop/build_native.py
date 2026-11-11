#!/usr/bin/env python3
"""Build native desktop distributions on their respective operating systems."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
IGNORE = shutil.ignore_patterns('__pycache__', '*.pyc', '.env*')


def run(*args, **kwargs):
    return subprocess.run([str(x) for x in args], check=True, **kwargs)


def source_archive(destination):
    # Only tracked authored files: no build runtimes, secrets or installed packages.
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in files:
            if name and (ROOT/name).is_file():
                if Path(name).name.startswith('.env') and name != '.env.example':
                    continue
                archive.write(ROOT/name, 'ace-studio/'+name)


def stage(application, node, python):
    shutil.copytree(ROOT/'.next/standalone', application/'app', ignore=IGNORE)
    shutil.copytree(ROOT/'.next/static', application/'app/.next/static', dirs_exist_ok=True)
    shutil.copytree(ROOT/'public', application/'app/public', dirs_exist_ok=True)
    shutil.copytree(ROOT/'worker', application/'app/worker', ignore=IGNORE)
    shutil.copytree(ROOT/'data', application/'app/data')
    runtime = application/'runtime'
    runtime.mkdir()
    shutil.copy2(node, runtime/('node.exe' if os.name == 'nt' else 'node'))
    for license_path in (node.parent/'LICENSE', node.parent.parent/'LICENSE'):
        if license_path.is_file():
            shutil.copy2(license_path, runtime/'LICENSE-node.txt')
            break
    base = Path(subprocess.check_output([str(python), '-c', 'import sys; print(sys.base_prefix)'], text=True).strip())
    # uv's managed CPython distribution is relocatable on both macOS and Windows.
    shutil.copytree(base, runtime/'python', symlinks=os.name != 'nt',
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc', 'site-packages', 'test', 'tests'))
    version = subprocess.check_output([str(python), '-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], text=True).strip()
    site = ROOT/('.venv/Lib/site-packages' if os.name == 'nt' else f'.venv/lib/python{version}/site-packages')
    target = runtime/'python'/('Lib/site-packages' if os.name == 'nt' else f'lib/python{version}/site-packages')
    shutil.copytree(site, target, dirs_exist_ok=True, ignore=IGNORE)
    executable = runtime/'python'/('python.exe' if os.name == 'nt' else 'bin/python3')
    run(executable, '-c', 'import sys,pathlib,pymupdf,PIL,docx,openpyxl,pptx; assert pathlib.Path(sys.prefix).resolve().is_relative_to(pathlib.Path(sys.argv[1]).resolve()); print("Relocated runtime OK")', runtime/'python')
    shutil.copy2(ROOT/'desktop/launcher.py', application/'launcher.py')
    for name in ('LICENSE', 'COPYRIGHT', 'THIRD_PARTY_NOTICES.md', 'README.md', 'VERIFICATION.md'):
        shutil.copy2(ROOT/name, application/name)
    shutil.copytree(ROOT/'docs', application/'docs')
    source_archive(application/'ACE_Studio_Source.zip')


def windows_package(args, version):
    application = ROOT/'.desktop-build/windows/ACE Studio'
    application.parent.mkdir(parents=True, exist_ok=True)
    stage(application, args.node, args.python_runtime)
    assert (application/'runtime/python/pythonw.exe').is_file(), 'Managed Windows Python must include pythonw.exe'
    from PIL import Image
    Image.open(ROOT/'public/icon-512.png').save(application/'app/public/icon.ico', sizes=[(16,16),(32,32),(48,48),(256,256)])
    script = ROOT/'.desktop-build/ace-studio.iss'
    # Stable AppId keeps upgrades and uninstall entries associated with the same app.
    script.write_text(f'''[Setup]
AppId=ACEStudio.ahad3594
AppName=ACE Studio
AppVersion={version}
AppPublisher=ACE Studio contributors
AppPublisherURL=https://github.com/ahad3594/ace-studio
DefaultDirName={{localappdata}}\\Programs\\ACE Studio
DefaultGroupName=ACE Studio
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
LicenseFile={ROOT/'LICENSE'}
SetupIconFile={application/'app/public/icon.ico'}
UninstallDisplayIcon={{app}}\\app\\public\\icon.ico
OutputDir={args.output}
OutputBaseFilename=ACE-Studio_{version}_windows_x64_setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=no

[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"

[Files]
Source: "{application}\\*"; DestDir: "{{app}}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{{group}}\\ACE Studio"; Filename: "{{app}}\\runtime\\python\\pythonw.exe"; Parameters: """{{app}}\\launcher.py"""; WorkingDir: "{{app}}"; IconFilename: "{{app}}\\app\\public\\icon.ico"
Name: "{{group}}\\Stop ACE Studio"; Filename: "{{app}}\\runtime\\python\\pythonw.exe"; Parameters: """{{app}}\\launcher.py"" --stop"; WorkingDir: "{{app}}"; IconFilename: "{{app}}\\app\\public\\icon.ico"
Name: "{{autodesktop}}\\ACE Studio"; Filename: "{{app}}\\runtime\\python\\pythonw.exe"; Parameters: """{{app}}\\launcher.py"""; IconFilename: "{{app}}\\app\\public\\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{{app}}\\runtime\\python\\pythonw.exe"; Parameters: """{{app}}\\launcher.py"""; Description: "Open ACE Studio"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{{app}}\\runtime\\python\\pythonw.exe"; Parameters: """{{app}}\\launcher.py"" --stop"; Flags: runhidden waituntilterminated skipifdoesntexist
''', encoding='utf-8-sig')
    compiler = shutil.which('ISCC') or str(Path(os.environ.get('ProgramFiles(x86)', 'C:/Program Files (x86)'))/'Inno Setup 6/ISCC.exe')
    run(compiler, script)
    package = args.output/f'ACE-Studio_{version}_windows_x64_setup.exe'
    if not args.verify:
        return package
    installed = Path(os.environ.get('RUNNER_TEMP', str(ROOT/'.desktop-build')))/'ACE Installed Test'
    run(package, '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/TASKS=desktopicon', '/DIR='+str(installed), timeout=240)
    run(sys.executable, ROOT/'desktop/smoke_test.py', installed, '--require-optional-tools')
    shortcuts = Path(os.environ['APPDATA'])/'Microsoft/Windows/Start Menu/Programs/ACE Studio'
    assert (shortcuts/'ACE Studio.lnk').is_file(), 'Start menu shortcut missing'
    run(installed/'unins000.exe', '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', timeout=120)
    return package


def mac_package(args, version):
    image = ROOT/'.desktop-build/macos-image'
    bundle = image/'ACE Studio.app'
    contents = bundle/'Contents'
    application = contents/'Resources/ace-studio'
    application.parent.mkdir(parents=True)
    stage(application, args.node, args.python_runtime)
    macos = contents/'MacOS'
    macos.mkdir()
    executable = macos/'ACE Studio'
    run('clang', '-O2', '-mmacosx-version-min=14.0', ROOT/'desktop/macos_launcher.c', '-o', executable)
    resources = contents/'Resources'
    iconset = ROOT/'.desktop-build/ACE.iconset'
    iconset.mkdir()
    for size in (16,32,128,256,512):
        for scale in (1,2):
            suffix = '@2x' if scale == 2 else ''
            run('sips', '-z', size*scale, size*scale, ROOT/'public/icon-512.png', '--out', iconset/f'icon_{size}x{size}{suffix}.png', stdout=subprocess.DEVNULL)
    run('iconutil', '-c', 'icns', iconset, '-o', resources/'ACE.icns')
    (contents/'Info.plist').write_bytes(plistlib.dumps({
        'CFBundleName':'ACE Studio', 'CFBundleDisplayName':'ACE Studio',
        'CFBundleIdentifier':'dev.ahad3594.ace-studio', 'CFBundleExecutable':'ACE Studio',
        'CFBundlePackageType':'APPL', 'CFBundleShortVersionString':version,
        'CFBundleVersion':version, 'CFBundleIconFile':'ACE', 'LSMinimumSystemVersion':'14.0',
        'NSHighResolutionCapable':True,
    }))
    # Ad-hoc signing preserves native integrity checks, without claiming Developer ID/notarization.
    magic = {b'\xcf\xfa\xed\xfe', b'\xce\xfa\xed\xfe', b'\xca\xfe\xba\xbe', b'\xca\xfe\xba\xbf'}
    for file in application.rglob('*'):
        if file.is_file() and not file.is_symlink():
            with file.open('rb') as stream:
                if stream.read(4) in magic:
                    run('codesign', '--force', '--sign', '-', file, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    run('codesign', '--force', '--deep', '--sign', '-', bundle)
    run('codesign', '--verify', '--deep', '--strict', bundle)
    (image/'Applications').symlink_to('/Applications')
    arch = 'arm64' if platform.machine() == 'arm64' else 'x64'
    package = args.output/f'ACE-Studio_{version}_macos_{arch}.dmg'
    run('hdiutil', 'create', '-volname', 'ACE Studio', '-srcfolder', image, '-ov', '-format', 'UDZO', package)
    if not args.verify:
        return package
    mount = ROOT/'.desktop-build/mounted'
    run('hdiutil', 'attach', '-readonly', '-nobrowse', '-mountpoint', mount, package)
    try:
        installed = Path(os.environ.get('RUNNER_TEMP', str(ROOT/'.desktop-build')))/'ACE Installed Test/ACE Studio.app'
        run('ditto', mount/'ACE Studio.app', installed)
    finally:
        run('hdiutil', 'detach', mount)
    run(sys.executable, ROOT/'desktop/smoke_test.py', installed, '--require-optional-tools')
    return package


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--node', type=Path, default=shutil.which('node'))
    parser.add_argument('--python-runtime', type=Path, required=True, help='Relocatable managed Python executable')
    parser.add_argument('--output', type=Path, default=ROOT/'desktop-dist')
    parser.add_argument('--verify', action='store_true', help='Install and test on this disposable build machine')
    args = parser.parse_args()
    args.node = args.node.resolve()
    args.python_runtime = args.python_runtime.resolve()
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    version = json.loads((ROOT/'package.json').read_text())['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise SystemExit('Use a major.minor.patch version.')
    if platform.system() == 'Linux':
        base = subprocess.check_output([str(args.python_runtime), '-c', 'import sys; print(sys.base_prefix)'], text=True).strip()
        run(sys.executable, ROOT/'desktop/build.py', '--node', args.node, '--python-runtime', base, '--output', args.output)
        if args.verify:
            run('sudo', 'apt-get', 'install', '-y', args.output/f'ACE-Studio_{version}_amd64.deb')
            run(sys.executable, ROOT/'desktop/smoke_test.py', '/opt/ace-studio', '--require-optional-tools')
        return
    shutil.rmtree(ROOT/'.desktop-build', ignore_errors=True)
    package = windows_package(args, version) if os.name == 'nt' else mac_package(args, version)
    print(json.dumps({'installer':str(package), 'bytes':package.stat().st_size}))


if __name__ == '__main__':
    main()
