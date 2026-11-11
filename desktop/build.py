#!/usr/bin/env python3
"""Build a self-contained Linux x64 .deb without needing root."""
from __future__ import annotations
import argparse,json,os,platform,shutil,subprocess,sys,tarfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def copy_tree(source,destination,ignore=None):
    shutil.copytree(source,destination,dirs_exist_ok=True,ignore=ignore)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--node',default=os.environ.get('CODEX_PRIMARY_RUNTIME_NODE') or shutil.which('node'));parser.add_argument('--python-runtime',default=sys.base_prefix);parser.add_argument('--output',default=str(ROOT/'desktop-dist'));args=parser.parse_args()
    if platform.system()!='Linux' or platform.machine() not in ('x86_64','amd64'):raise SystemExit('This installer build targets Linux x64. Other platforms need a separate package build.')
    if not (ROOT/'.next/standalone/server.js').exists():raise SystemExit('Run npm run build first.')
    version_string=json.loads((ROOT/'package.json').read_text())['version']
    if not __import__('re').fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+',version_string):raise SystemExit('Package version must be major.minor.patch.')
    output=Path(args.output).resolve();output.mkdir(parents=True,exist_ok=True);build=ROOT/'.desktop-build';shutil.rmtree(build,ignore_errors=True)
    application=build/'opt/ace-studio';application.mkdir(parents=True)
    copy_tree(ROOT/'.next/standalone',application/'app',shutil.ignore_patterns('.env*'))
    copy_tree(ROOT/'.next/static',application/'app/.next/static')
    copy_tree(ROOT/'public',application/'app/public')
    copy_tree(ROOT/'worker',application/'app/worker',shutil.ignore_patterns('__pycache__','*.pyc'))
    copy_tree(ROOT/'data',application/'app/data')
    runtime=application/'runtime';runtime.mkdir()
    node=Path(args.node).resolve();shutil.copy2(node,runtime/'node');(runtime/'node').chmod(0o755)
    if (node.parent.parent/'LICENSE').is_file():shutil.copy2(node.parent.parent/'LICENSE',runtime/'LICENSE-node.txt')
    # Select an actual CPython installation, not a virtual environment stub.
    python_root=Path(args.python_runtime).resolve();python=python_root/'bin/python3'
    if not python.exists():raise SystemExit('Set --python-runtime to a complete CPython installation.')
    version=subprocess.check_output([str(python),'-c','import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")'],text=True).strip()
    py_target=runtime/'python';(py_target/'bin').mkdir(parents=True)
    shutil.copy2(python.resolve(),py_target/'bin'/f'python{version}');(py_target/'bin'/f'python{version}').chmod(0o755);(py_target/'bin/python3').symlink_to(f'python{version}')
    stdlib=python_root/'lib'/f'python{version}'
    copy_tree(stdlib,py_target/'lib'/f'python{version}',shutil.ignore_patterns('site-packages','__pycache__','test','tests','idlelib','tkinter','turtledemo','ensurepip','config-*'))
    for library in (python_root/'lib').glob('libpython*.so*'):
        if library.is_file() and not library.is_symlink():shutil.copy2(library,py_target/'lib'/library.name)
    linked=subprocess.check_output(['ldd',str(py_target/'bin'/f'python{version}')],text=True)
    if 'libpython' in linked:
        if not shutil.which('patchelf'):raise SystemExit('Install patchelf to relocate this shared-library CPython build.')
        subprocess.run(['patchelf','--set-rpath','$ORIGIN/../lib',str(py_target/'bin'/f'python{version}')],check=True)
    source_site=ROOT/'.venv/lib'/f'python{version}'/'site-packages'
    if not source_site.exists():raise SystemExit('The build Python version must match the project virtual environment.')
    copy_tree(source_site,py_target/'lib'/f'python{version}'/'site-packages',shutil.ignore_patterns('__pycache__','*.pyc','pip','pip-*','setuptools','setuptools-*','tests','test'))
    for license_name in ('LICENSE','LICENSE.txt','LICENSE.rst'):
        if (python_root/license_name).is_file():shutil.copy2(python_root/license_name,py_target/license_name)
    shutil.copy2(ROOT/'desktop/launcher.py',application/'launcher.py');(application/'launcher.py').chmod(0o755)
    wrapper=application/'ace-studio';wrapper.write_text('#!/bin/sh\nexec python3 "$(dirname "$(readlink -f "$0")")/launcher.py" "$@"\n');wrapper.chmod(0o755)
    for filename in ('README.md','VERIFICATION.md','THIRD_PARTY_NOTICES.md','LICENSE','COPYRIGHT'):
        if (ROOT/filename).exists():shutil.copy2(ROOT/filename,application/filename)
    # Include the complete authored source alongside the native runtime.
    with zipfile.ZipFile(application/'ACE_Studio_Source.zip','w',zipfile.ZIP_DEFLATED) as archive:
        excluded={'.git','node_modules','.next','.venv','.desktop-build','desktop-dist','test-results','playwright-report','__pycache__'}
        for file in ROOT.rglob('*'):
            if file.is_file() and not any(part in excluded for part in file.relative_to(ROOT).parts) and not file.name.endswith(('.pyc','.tsbuildinfo','.deb','.tar.gz')) and (not file.name.startswith('.env') or file.name=='.env.example'):
                archive.write(file,'ace-studio/'+str(file.relative_to(ROOT)))
    desktop=build/'usr/share/applications/ace-studio.desktop';desktop.parent.mkdir(parents=True)
    desktop.write_text('[Desktop Entry]\nType=Application\nVersion=1.0\nName=ACE Studio\nComment=Every file. One workspace.\nExec=/opt/ace-studio/ace-studio\nIcon=ace-studio\nTerminal=false\nCategories=Office;Utility;Graphics;\nStartupNotify=false\nActions=Stop;\n\n[Desktop Action Stop]\nName=Stop ACE Studio\nExec=/opt/ace-studio/ace-studio --stop\n')
    icons=build/'usr/share/icons/hicolor';(icons/'512x512/apps').mkdir(parents=True);(icons/'scalable/apps').mkdir(parents=True);shutil.copy2(ROOT/'public/icon-512.png',icons/'512x512/apps/ace-studio.png');shutil.copy2(ROOT/'public/icon.svg',icons/'scalable/apps/ace-studio.svg')
    control=build/'DEBIAN';control.mkdir()
    installed=sum(p.stat().st_size for p in application.rglob('*') if p.is_file())//1024
    (control/'control').write_text(f'Package: ace-studio\nVersion: {version_string}\nSection: graphics\nPriority: optional\nArchitecture: amd64\nMaintainer: ACE Studio <191617298+ahad3594@users.noreply.github.com>\nDepends: python3, xdg-utils, libreoffice-writer, libreoffice-calc, libreoffice-impress, ghostscript, libc6 (>= 2.35), libstdc++6, libgcc-s1\nInstalled-Size: {installed}\nDescription: Private PDF, document and image workspace\n ACE Studio bundles a local web app, Node.js, a Python document engine,\n OCR language data and a desktop launcher. No terminal is needed to run it.\n')
    package=output/f'ACE-Studio_{version_string}_amd64.deb'
    subprocess.run(['dpkg-deb','--root-owner-group','-Zxz','-z6','--build',str(build),str(package)],check=True)
    subprocess.run(['desktop-file-validate',str(desktop)],check=True)
    print(json.dumps({'installer':str(package),'bytes':package.stat().st_size,'stagedApp':str(application),'python':version}))

if __name__=='__main__':main()
