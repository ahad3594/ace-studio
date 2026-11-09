#!/usr/bin/env python3
"""ACE Studio desktop launcher. Binds only to loopback and never opens an unverified server."""
from __future__ import annotations
import fcntl,json,os,secrets,shutil,socket,subprocess,sys,time,urllib.request,urllib.error
from pathlib import Path

ROOT=Path(__file__).resolve().parent
CONFIG=Path(os.environ.get('ACE_DESKTOP_CONFIG') or Path(os.environ.get('XDG_CONFIG_HOME',Path.home()/'.config'))/'ace-studio')
STATE=Path(os.environ.get('ACE_DESKTOP_STATE') or Path(os.environ.get('XDG_STATE_HOME',Path.home()/'.local/state'))/'ace-studio')

def private_dir(path):path.mkdir(parents=True,exist_ok=True,mode=0o700);path.chmod(0o700)

def call_server(port,token,stop=False):
    request=urllib.request.Request(f'http://127.0.0.1:{port}/api/desktop',data=b'{}' if stop else None,headers={'Cookie':'ace-desktop='+token,'Origin':f'http://127.0.0.1:{port}','Content-Type':'application/json'})
    with urllib.request.urlopen(request,timeout=2) as response:return json.load(response)

def shortcut():
    target=os.environ.get('ACE_SHORTCUT_DIR')
    if not target:
        try:target=subprocess.check_output(['xdg-user-dir','DESKTOP'],text=True,timeout=3).strip()
        except Exception:target=str(Path.home()/'Desktop')
    directory=Path(target)
    if directory==Path.home():return
    directory.mkdir(parents=True,exist_ok=True)
    desktop=directory/'ACE Studio.desktop'
    content='[Desktop Entry]\nType=Application\nVersion=1.0\nName=ACE Studio\nComment=Every file. One workspace.\nExec="'+str(ROOT/'ace-studio')+'"\nIcon='+str(ROOT/'app/public/icon-512.png')+'\nTerminal=false\nCategories=Office;Utility;Graphics;\nStartupNotify=false\n'
    if not desktop.exists() or desktop.read_text()==content:
        desktop.write_text(content);desktop.chmod(0o755)
        if shutil.which('gio'):subprocess.run(['gio','set',str(desktop),'metadata::trusted','true'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def open_window(port,token):
    shortcut()
    url=f'http://127.0.0.1:{port}/desktop-connect?token={token}'
    if os.environ.get('ACE_NO_BROWSER')=='1':return
    subprocess.Popen(['xdg-open',url],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)

def error(message):
    print(message,file=sys.stderr)
    if shutil.which('zenity') and os.environ.get('ACE_NO_BROWSER')!='1':subprocess.run(['zenity','--error','--title=ACE Studio','--text='+message])
    return 1

def main():
    private_dir(CONFIG);private_dir(STATE)
    with open(STATE/'launcher.lock','a') as lock:
        os.chmod(STATE/'launcher.lock',0o600);fcntl.flock(lock,fcntl.LOCK_EX)
        status_path=STATE/'instance.json';old={}
        try:old=json.loads(status_path.read_text())
        except Exception:pass
        if old:
            try:
                verified=call_server(int(old['port']),old['token'])
                if verified.get('app')=='ACE Studio' and verified.get('desktop'):
                    if '--stop' in sys.argv:call_server(int(old['port']),old['token'],True)
                    else:open_window(int(old['port']),old['token'])
                    return 0
            except Exception:pass
        if '--stop' in sys.argv:return 0
        node=ROOT/'runtime/node';python=ROOT/'runtime/python/bin/python3'
        if not node.exists() or not python.exists():return error('The desktop runtime is missing. Reinstall the complete ACE Studio package.')
        log_path=STATE/'server.log';log=open(log_path,'ab');os.chmod(log_path,0o600)
        for attempt in range(12):
            with socket.socket() as candidate:
                candidate.bind(('127.0.0.1',0));port=candidate.getsockname()[1]
            token=secrets.token_urlsafe(32)
            env={**os.environ,'HOSTNAME':'127.0.0.1','PORT':str(port),'NODE_ENV':'production','ACE_DESKTOP':'true','ACE_DESKTOP_TOKEN':token,'ACE_CONFIG_DIR':str(CONFIG),'ACE_PYTHON':str(python),'ACE_WORKER':str(ROOT/'app/worker/documents.py'),'ACE_TESSDATA':str(ROOT/'app/data/tessdata'),'OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1'}
            child=subprocess.Popen([str(node),str(ROOT/'app/server.js')],cwd=ROOT/'app',env=env,stdout=log,stderr=log,start_new_session=True)
            ready=False
            for _ in range(80):
                if child.poll() is not None:break
                try:
                    status=call_server(port,token)
                    if status.get('desktop') and status.get('app')=='ACE Studio':ready=True;break
                except Exception:pass
                time.sleep(.15)
            if ready:
                status_path.write_text(json.dumps({'pid':child.pid,'port':port,'token':token}));status_path.chmod(0o600);log.close();open_window(port,token);return 0
            child.terminate()
            try:child.wait(timeout=4)
            except subprocess.TimeoutExpired:child.kill();child.wait()
        log.close();return error('ACE Studio could not start. Check '+str(log_path)+' or reinstall the app.')

if __name__=='__main__':raise SystemExit(main())
