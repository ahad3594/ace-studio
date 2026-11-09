#!/usr/bin/env python3
"""One-time setup for developers. Desktop packages already include this runtime."""
import os,shutil,subprocess,sys,urllib.request,venv
from pathlib import Path
root=Path(__file__).resolve().parents[1];target=root/'.venv'
if not (target/('Scripts/python.exe' if os.name=='nt' else 'bin/python')).exists():venv.EnvBuilder(with_pip=True).create(target)
python=target/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
subprocess.run([str(python),'-m','pip','install','-r',str(root/'requirements.lock.txt')],check=True)
tess=root/'data/tessdata';tess.mkdir(parents=True,exist_ok=True)
for language in ['eng','deu','urd']:
    file=tess/(language+'.traineddata')
    if not file.exists():urllib.request.urlretrieve('https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/'+language+'.traineddata',file)
print('Document engine installed.')
if not (shutil.which('libreoffice') or shutil.which('soffice')):print('Install LibreOffice for Word, Excel and PowerPoint to PDF conversion.')
if not shutil.which('gs'):print('Install Ghostscript for PDF/A export.')
print('You can now run npm run dev. Desktop users can install the .deb instead.')
