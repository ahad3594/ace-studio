#!/usr/bin/env python3
"""Native launcher for Linux, Windows and macOS. The service stays on loopback."""
from __future__ import annotations

from contextlib import contextmanager
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent


def user_paths(platform_name=None, home=None, environ=None):
    platform_name = platform_name or sys.platform
    home = Path(home or Path.home())
    environ = os.environ if environ is None else environ
    if platform_name == 'win32':
        base = Path(environ.get('LOCALAPPDATA', home/'AppData/Local'))/'ACE Studio'
        config, state = base/'config', base/'state'
    elif platform_name == 'darwin':
        base = home/'Library/Application Support/ACE Studio'
        config, state = base/'config', base/'state'
    else:
        config = Path(environ.get('XDG_CONFIG_HOME', home/'.config'))/'ace-studio'
        state = Path(environ.get('XDG_STATE_HOME', home/'.local/state'))/'ace-studio'
    return (Path(environ.get('ACE_DESKTOP_CONFIG') or config),
            Path(environ.get('ACE_DESKTOP_STATE') or state))


CONFIG, STATE = user_paths()


def private_dir(path):
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name != 'nt':
        path.chmod(0o700)


@contextmanager
def instance_lock(path):
    with open(path, 'a+b') as lock:
        if os.name == 'nt':
            import msvcrt
            if path.stat().st_size == 0:
                lock.write(b'\0')
                lock.flush()
            for attempt in range(300):
                lock.seek(0)
                try:
                    msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    if attempt == 299:
                        raise TimeoutError('Another ACE Studio launch is still busy.')
                    time.sleep(0.1)
            try:
                yield
            finally:
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            path.chmod(0o600)
            fcntl.flock(lock, fcntl.LOCK_EX)
            yield


def call_server(port, token, stop=False):
    request = urllib.request.Request(
        f'http://127.0.0.1:{port}/api/desktop', data=b'{}' if stop else None,
        headers={'Cookie': 'ace-desktop='+token, 'Origin': f'http://127.0.0.1:{port}',
                 'Content-Type': 'application/json'})
    # A user's proxy must not receive the private local session token.
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request, timeout=2) as response:
        return json.load(response)


def shortcut():
    # Windows shortcuts are installed by Inno Setup; macOS uses the .app bundle.
    if sys.platform in ('win32', 'darwin'):
        return
    target = os.environ.get('ACE_SHORTCUT_DIR')
    if not target:
        try:
            target = subprocess.check_output(['xdg-user-dir', 'DESKTOP'], text=True, timeout=3).strip()
        except Exception:
            target = str(Path.home()/'Desktop')
    directory = Path(target)
    if directory == Path.home():
        return
    directory.mkdir(parents=True, exist_ok=True)
    desktop = directory/'ACE Studio.desktop'
    content = ('[Desktop Entry]\nType=Application\nVersion=1.0\nName=ACE Studio\n'
               'Comment=Every file. One workspace.\nExec="'+str(ROOT/'ace-studio')+'"\n'
               'Icon='+str(ROOT/'app/public/icon-512.png')+'\nTerminal=false\n'
               'Categories=Office;Utility;Graphics;\nStartupNotify=false\n')
    if not desktop.exists() or desktop.read_text() == content:
        desktop.write_text(content)
        desktop.chmod(0o755)
        if shutil.which('gio'):
            subprocess.run(['gio', 'set', str(desktop), 'metadata::trusted', 'true'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def open_window(port, token):
    shortcut()
    if os.environ.get('ACE_NO_BROWSER') == '1':
        return
    url = f'http://127.0.0.1:{port}/desktop-connect?token={token}'
    if os.name == 'nt':
        os.startfile(url)
    else:
        subprocess.Popen(['open' if sys.platform == 'darwin' else 'xdg-open', url],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)


def error(message):
    if sys.stderr:
        print(message, file=sys.stderr)
    if os.environ.get('ACE_NO_BROWSER') != '1':
        if os.name == 'nt':
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, message, 'ACE Studio', 0x10)
        elif sys.platform == 'darwin':
            subprocess.run(['osascript', '-e', 'on run argv\n display alert "ACE Studio" message (item 1 of argv) as critical\nend run', message])
        elif shutil.which('zenity'):
            subprocess.run(['zenity', '--error', '--title=ACE Studio', '--text='+message])
    return 1


def main():
    private_dir(CONFIG)
    private_dir(STATE)
    with instance_lock(STATE/'launcher.lock'):
        status_path = STATE/'instance.json'
        try:
            old = json.loads(status_path.read_text(encoding='utf-8'))
        except Exception:
            old = {}
        if old:
            try:
                verified = call_server(int(old['port']), old['token'])
                if verified.get('app') == 'ACE Studio' and verified.get('desktop'):
                    if '--stop' in sys.argv:
                        call_server(int(old['port']), old['token'], True)
                    else:
                        open_window(int(old['port']), old['token'])
                    return 0
            except Exception:
                pass
        if '--stop' in sys.argv:
            return 0
        node = ROOT/'runtime'/('node.exe' if os.name == 'nt' else 'node')
        python = ROOT/'runtime/python'/('python.exe' if os.name == 'nt' else 'bin/python3')
        if not node.is_file() or not python.is_file():
            return error('The desktop runtime is missing. Reinstall the complete ACE Studio package.')
        log_path = STATE/'server.log'
        with open(log_path, 'ab') as log:
            if os.name != 'nt':
                log_path.chmod(0o600)
            for attempt in range(12):
                with socket.socket() as candidate:
                    candidate.bind(('127.0.0.1', 0))
                    port = candidate.getsockname()[1]
                token = secrets.token_urlsafe(32)
                env = {**os.environ, 'HOSTNAME': '127.0.0.1', 'PORT': str(port),
                       'NODE_ENV': 'production', 'ACE_DESKTOP': 'true', 'ACE_DESKTOP_TOKEN': token,
                       'ACE_CONFIG_DIR': str(CONFIG), 'ACE_PYTHON': str(python),
                       'ACE_WORKER': str(ROOT/'app/worker/documents.py'),
                       'ACE_TESSDATA': str(ROOT/'app/data/tessdata'), 'PYTHONUTF8': '1',
                       'OPENBLAS_NUM_THREADS': '1', 'OMP_NUM_THREADS': '1'}
                options = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {'start_new_session': True}
                child = subprocess.Popen([str(node), str(ROOT/'app/server.js')], cwd=ROOT/'app',
                                         env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log, **options)
                for _ in range(100):
                    if child.poll() is not None:
                        break
                    try:
                        status = call_server(port, token)
                        if status.get('desktop') and status.get('app') == 'ACE Studio':
                            status_path.write_text(json.dumps({'pid': child.pid, 'port': port, 'token': token}), encoding='utf-8')
                            if os.name != 'nt':
                                status_path.chmod(0o600)
                            open_window(port, token)
                            return 0
                    except Exception:
                        pass
                    time.sleep(0.15)
                child.terminate()
                try:
                    child.wait(timeout=4)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()
        return error('ACE Studio could not start. Check '+str(log_path)+' or reinstall the app.')


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, TimeoutError) as exc:
        raise SystemExit(error('ACE Studio could not start: '+str(exc)))
