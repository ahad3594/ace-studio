#!/usr/bin/env python3
"""Check an installed package in an isolated profile, without a GUI."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else '/opt/ace-studio')
    version = json.loads((root / 'app/package.json').read_text())['version']
    subprocess.run([str(root / 'runtime/python/bin/python3'), '-c',
                    'import pymupdf, PIL, docx, openpyxl, pptx; print("Bundled Python imports OK")'], check=True)
    for name in ('LICENSE', 'COPYRIGHT', 'ACE_Studio_Source.zip'):
        assert (root / name).is_file(), f'Missing packaged file: {name}'
    with tempfile.TemporaryDirectory(prefix='ace-smoke-') as temporary:
        profile = Path(temporary)
        state = profile / 'state'
        env = {**os.environ, 'ACE_DESKTOP_CONFIG': str(profile / 'config'),
               'ACE_DESKTOP_STATE': str(state), 'ACE_SHORTCUT_DIR': str(profile / 'Desktop'),
               'ACE_NO_BROWSER': '1'}
        launcher = [str(root / 'ace-studio')]
        try:
            subprocess.run(launcher, env=env, check=True, timeout=60)
            first = json.loads((state / 'instance.json').read_text())
            def status():
                request = urllib.request.Request(
                    f'http://127.0.0.1:{first["port"]}/api/desktop',
                    headers={'Cookie': 'ace-desktop=' + first['token']})
                with urllib.request.urlopen(request, timeout=3) as response:
                    return json.load(response)
            data = status()
            assert data.get('app') == 'ACE Studio' and data.get('desktop'), 'Wrong service'
            with urllib.request.urlopen(f'http://127.0.0.1:{first["port"]}/', timeout=10) as response:
                assert response.status == 200 and b'ACE' in response.read(), 'Home unavailable'
            assert (profile / 'Desktop/ACE Studio.desktop').is_file(), 'Shortcut missing'
            subprocess.run(launcher, env=env, check=True, timeout=30)
            second = json.loads((state / 'instance.json').read_text())
            assert first == second, 'Second launch did not reuse the service'
            subprocess.run(launcher + ['--stop'], env=env, check=True, timeout=15)
            for attempt in range(30):
                try:
                    status()
                except (urllib.error.URLError, OSError, TimeoutError):
                    break
                time.sleep(0.1)
            else:
                raise AssertionError('Stop action left the service running')
            print(f'Installed ACE Studio {version}: startup, shortcut, reuse and shutdown OK')
        finally:
            subprocess.run(launcher + ['--stop'], env=env, timeout=15, check=False)


if __name__ == '__main__':
    main()
