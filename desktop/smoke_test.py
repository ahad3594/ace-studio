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
    supplied = Path(sys.argv[1] if len(sys.argv) > 1 else '/opt/ace-studio')
    root = supplied/'Contents/Resources/ace-studio' if supplied.suffix == '.app' else supplied
    version = json.loads((root / 'app/package.json').read_text())['version']
    python = root/'runtime/python'/('python.exe' if os.name == 'nt' else 'bin/python3')
    subprocess.run([str(python), '-c',
                    'import pymupdf, PIL, docx, openpyxl, pptx; print("Bundled Python imports OK")'], check=True)
    for name in ('LICENSE', 'COPYRIGHT', 'ACE_Studio_Source.zip'):
        assert (root / name).is_file(), f'Missing packaged file: {name}'
    with tempfile.TemporaryDirectory(prefix='ace-smoke-') as temporary:
        profile = Path(temporary)
        state = profile / 'state'
        env = {**os.environ, 'ACE_DESKTOP_CONFIG': str(profile / 'config'),
               'ACE_DESKTOP_STATE': str(state), 'ACE_SHORTCUT_DIR': str(profile / 'Desktop'),
               'ACE_NO_BROWSER': '1'}
        launcher = ([str(python), '-I', str(root/'launcher.py')] if os.name == 'nt' else
                    [str(supplied/'Contents/MacOS/ACE Studio')] if supplied.suffix == '.app' else [str(root/'ace-studio')])
        try:
            subprocess.run(launcher, env=env, check=True, timeout=60)
            first = json.loads((state / 'instance.json').read_text(encoding='utf-8'))
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            def status():
                request = urllib.request.Request(
                    f'http://127.0.0.1:{first["port"]}/api/desktop',
                    headers={'Cookie': 'ace-desktop=' + first['token']})
                with opener.open(request, timeout=3) as response:
                    return json.load(response)
            data = status()
            assert data.get('app') == 'ACE Studio' and data.get('desktop'), 'Wrong service'
            base = f'http://127.0.0.1:{first["port"]}'
            with opener.open(base+'/', timeout=10) as response:
                assert response.status == 200 and b'ACE' in response.read(), 'Home unavailable'
            with opener.open(base+'/api/documents/capabilities', timeout=30) as response:
                capabilities = json.load(response)
            assert capabilities.get('engine') and capabilities.get('ocr'), 'Bundled document/OCR engine unavailable'
            if '--require-optional-tools' in sys.argv:
                assert capabilities.get('office') and capabilities.get('archive'), 'Optional tools not detected'
            boundary = 'ace-smoke-multipart-boundary'
            payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="files"; filename="sample.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode()
                       + (root/'app/public/sample-document.pdf').read_bytes()
                       + f'\r\n--{boundary}--\r\n'.encode())
            request = urllib.request.Request(base+'/api/documents/inspect', data=payload,
                                             headers={'Content-Type':'multipart/form-data; boundary='+boundary, 'Origin':base})
            with opener.open(request, timeout=30) as response:
                inspected = json.load(response)
            assert inspected['documents'][0]['pages'] > 0, 'Actual document inspection failed'
            if sys.platform not in ('win32', 'darwin'):
                assert (profile / 'Desktop/ACE Studio.desktop').is_file(), 'Shortcut missing'
            subprocess.run(launcher, env=env, check=True, timeout=30)
            second = json.loads((state / 'instance.json').read_text(encoding='utf-8'))
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
            print(f'Installed ACE Studio {version}: startup, document engine, reuse and shutdown OK')
        finally:
            subprocess.run(launcher + ['--stop'], env=env, timeout=15, check=False)


if __name__ == '__main__':
    main()
