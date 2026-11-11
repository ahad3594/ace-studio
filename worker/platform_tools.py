"""Find optional tools in their standard native install locations."""
import os
from pathlib import Path
import shutil
import sys


def first_file(paths):
    return next((str(p) for p in paths if p and Path(p).is_file()), None)


def office_executable():
    override = os.environ.get('ACE_SOFFICE')
    if override:
        return first_file([override])
    found = shutil.which('libreoffice') or shutil.which('soffice') or shutil.which('soffice.exe')
    if found:
        return found
    if sys.platform == 'darwin':
        return first_file([Path('/Applications/LibreOffice.app/Contents/MacOS/soffice'),
                           Path.home()/'Applications/LibreOffice.app/Contents/MacOS/soffice'])
    if os.name == 'nt':
        return first_file([Path(os.environ.get(key, default))/'LibreOffice/program/soffice.exe'
                           for key, default in [('ProgramFiles', 'C:/Program Files'),
                                                ('ProgramFiles(x86)', 'C:/Program Files (x86)')]])
    return None


def ghostscript_executable():
    override = os.environ.get('ACE_GS')
    if override:
        return first_file([override])
    for name in ('gs', 'gswin64c', 'gswin32c'):
        found = shutil.which(name)
        if found:
            return found
    if sys.platform == 'darwin':
        return first_file([Path('/opt/homebrew/bin/gs'), Path('/usr/local/bin/gs')])
    if os.name == 'nt':
        candidates = []
        for key, default in [('ProgramFiles', 'C:/Program Files'), ('ProgramFiles(x86)', 'C:/Program Files (x86)')]:
            candidates.extend(sorted((Path(os.environ.get(key, default))/'gs').glob('*/bin/gswin*c.exe'), reverse=True))
        return first_file(candidates)
    return None


def srgb_profile(executable=None):
    override = os.environ.get('ACE_SRGB_PROFILE')
    if override:
        return first_file([override])
    candidates = []
    if executable:
        prefix = Path(executable).resolve().parent.parent
        candidates += [prefix/'iccprofiles/srgb.icc', prefix/'share/ghostscript/iccprofiles/srgb.icc']
        candidates += sorted((prefix/'share/ghostscript').glob('*/iccprofiles/srgb.icc'), reverse=True)
    candidates.append(Path('/usr/share/color/icc/ghostscript/srgb.icc'))
    return first_file(candidates)
