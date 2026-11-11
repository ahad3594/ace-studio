"""ACE Studio's bounded, local document engine. No shell interpolation or remote URLs."""
from __future__ import annotations
import base64, contextlib, difflib, html, io, json, math, os, re, secrets, shutil, subprocess, sys, tempfile, zipfile
from collections import Counter
from pathlib import Path
from platform_tools import office_executable, ghostscript_executable, srgb_profile
try:
    import pymupdf as fitz
    from PIL import Image, ImageOps, ImageEnhance, ImageChops
except ImportError:
    print(json.dumps({"error": "The document runtime is not installed. Run the setup script or install the desktop package."})); sys.exit(1)

MAX_PAGES = int(os.environ.get("ACE_MAX_PAGES", "200"))
MAX_RENDER = 60
MIMES = {"pdf":"application/pdf","docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","pptx":"application/vnd.openxmlformats-officedocument.presentationml.presentation","png":"image/png","jpg":"image/jpeg","md":"text/markdown","txt":"text/plain"}
fitz.TOOLS.mupdf_display_errors(False)
fitz.TOOLS.mupdf_display_warnings(False)

def pages(spec, count, duplicates=False):
    spec = str(spec or 'all').strip().lower()
    if spec in ('all', ''): return list(range(count))
    if spec in ('odd', 'even'): return list(range(0 if spec=='odd' else 1, count, 2))
    result=[]
    for part in spec.split(','):
        m=re.fullmatch(r'\s*(\d+)\s*(?:-\s*(\d+))?\s*',part)
        if not m: raise ValueError('Use pages like 1-3,5,7 or all, odd, even.')
        start=int(m[1]);end=int(m[2] or m[1])
        if start<1 or end>count or start>end: raise ValueError(f'Page range is outside this {count}-page document.')
        result.extend(range(start-1,end))
    if not duplicates: result=list(dict.fromkeys(result))
    if not result: raise ValueError('Choose at least one page.')
    if len(result)>MAX_PAGES: raise ValueError('The selection exceeds the page limit.')
    return result

def opened(path, password=''):
    if not Path(path).read_bytes()[:1024].lstrip().startswith(b'%PDF-'): raise ValueError('This file does not contain a valid PDF header.')
    try: doc=fitz.open(path)
    except Exception: raise ValueError('This PDF is too damaged to read. Try a different original file.')
    if doc.needs_pass and not doc.authenticate(password): doc.close();raise ValueError('This PDF needs its correct password. Enter it in the file settings.')
    if not 0<len(doc)<=MAX_PAGES: doc.close();raise ValueError(f'Choose a PDF with 1–{MAX_PAGES} pages.')
    return doc

def output(path, name=None):
    p=Path(path)
    if not p.exists() or not p.stat().st_size: raise ValueError('No readable output was created.')
    return {'path':p.name,'name':name or p.name,'mime':MIMES.get(p.suffix[1:].lower(),'application/octet-stream'),'bytes':p.stat().st_size}

def save(doc,path,**kwargs):
    doc.save(path,garbage=4,deflate=True,clean=True,**kwargs)
    return path

def rgb(value): return tuple(int(value[i:i+2],16)/255 for i in (1,3,5))

def page_box(page, rect):
    r=page.rect
    box=fitz.Rect(rect['x']*r.width/100,rect['y']*r.height/100,(rect['x']+rect['width'])*r.width/100,(rect['y']+rect['height'])*r.height/100)
    return box*page.derotation_matrix

def raster(page,dpi=144):
    w,h=page.rect.width*dpi/72,page.rect.height*dpi/72
    if w*h>25_000_000: raise ValueError('Rendered page exceeds 25 million pixels. Choose lower DPI.')
    return page.get_pixmap(dpi=dpi,colorspace=fitz.csRGB,alpha=False)

def text_pdf(text,path,title='ACE Studio document'):
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.utils import simpleSplit
    font_path=os.environ.get('ACE_FONT')
    candidates=[font_path, str(Path(__file__).parent.parent/'data/fonts/DejaVuSans.ttf'),'/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    font='Helvetica'
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            if 'ACESans' not in pdfmetrics.getRegisteredFontNames(): pdfmetrics.registerFont(TTFont('ACESans',candidate))
            font='ACESans';break
    c=canvas.Canvas(str(path),pagesize=(595.276,841.89));c.setTitle(title);c.setAuthor('ACE Studio')
    y=790
    for paragraph in text.split('\n'):
        lines=simpleSplit(paragraph,font,11,495) or ['']
        for line in lines:
            if y<55:c.showPage();y=790
            c.setFont(font,11);c.drawString(50,y,line);y-=16
        y-=5
    c.save()
    return path

def sniff_image(path):
    try:
        with Image.open(path) as image:
            if image.width*image.height>40_000_000:raise ValueError('Image exceeds 40 million pixels.')
            image.verify()
    except ValueError:raise
    except Exception:raise ValueError('This image is not readable or its contents do not match a supported image format.')

def inspect(inputs,opts):
    info=[]
    for item in inputs:
        path=Path(item['path'])
        if path.read_bytes()[:1024].lstrip().startswith(b'%PDF-'):
            try:
                with opened(path,opts.get('password','')) as doc:
                    previews=[]
                    for i in range(min(len(doc),12)):
                        page=doc[i];scale=min(220/page.rect.width,280/page.rect.height)
                        pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
                        previews.append({'page':i+1,'width':page.rect.width,'height':page.rect.height,'image':'data:image/png;base64,'+base64.b64encode(pix.tobytes('png')).decode()})
                    fields=[]
                    for i,page in enumerate(doc):
                        for w in page.widgets() or []:
                            fields.append({'name':w.field_name,'type':w.field_type_string,'value':str(w.field_value or ''),'page':i+1})
                    info.append({'name':item['name'],'kind':'pdf','pages':len(doc),'bytes':path.stat().st_size,'previews':previews,'fields':fields,'hasText':any(page.get_text().strip() for page in list(doc)[:5]),'repaired':doc.is_repaired})
            except ValueError as e:
                if 'password' in str(e).lower():info.append({'name':item['name'],'kind':'pdf','locked':True,'pages':0,'bytes':path.stat().st_size,'previews':[],'fields':[]})
                else:raise
        elif item.get('extension') in ('doc','docx','ppt','pptx','xls','xlsx','odt','ods','odp'):
            validate_office(path,item.get('extension'))
            info.append({'name':item['name'],'kind':'office','pages':0,'bytes':path.stat().st_size,'previews':[],'fields':[]})
        else:
            sniff_image(path)
            with Image.open(path) as image:
                image=ImageOps.exif_transpose(image);width,height=image.size;image.thumbnail((240,240));buffer=io.BytesIO();image.convert('RGB').save(buffer,'JPEG',quality=80)
                info.append({'name':item['name'],'kind':'image','pages':1,'bytes':path.stat().st_size,'width':width,'height':height,'previews':[{'page':1,'image':'data:image/jpeg;base64,'+base64.b64encode(buffer.getvalue()).decode()}],'fields':[]})
    return {'documents':info}

def validate_office(path,extension):
    header=Path(path).read_bytes()[:8]
    if extension in ('docx','xlsx','pptx','odt','ods','odp'):
        if not zipfile.is_zipfile(path):raise ValueError('The Office file contents are invalid.')
        with zipfile.ZipFile(path) as z:
            items=z.infolist()
            if len(items)>5000 or sum(i.file_size for i in items)>250*1024*1024:raise ValueError('This Office archive exceeds the unpacking safety limit.')
            for item in items:
                if '..' in Path(item.filename).parts or item.filename.startswith('/') or 'vbaproject.bin' in item.filename.lower():raise ValueError('Unsafe or macro-enabled Office content is not accepted.')
                if item.filename.lower().endswith('.rels'):
                    import xml.etree.ElementTree as ET
                    xml=z.read(item)
                    if b'<!DOCTYPE' in xml.upper():raise ValueError('Unsafe XML declarations are not accepted.')
                    for relation in ET.fromstring(xml):
                        if relation.get('TargetMode')=='External' and not relation.get('Type','').endswith('/hyperlink'):raise ValueError('This Office file links to external resources. Embed the resources before conversion.')
                if item.filename.startswith(('Scripts/','Basic/')):raise ValueError('Macro-enabled Office documents are not accepted.')
            expected={'docx':'word/document.xml','xlsx':'xl/workbook.xml','pptx':'ppt/presentation.xml'}.get(extension)
            if expected and expected not in z.namelist():raise ValueError('Office file contents do not match the filename.')
    elif header!=bytes.fromhex('D0CF11E0A1B11AE1'):raise ValueError('Invalid legacy Office file contents.')

def office_pdf(path,root,extension):
    validate_office(path,extension)
    exe=office_executable()
    if not exe:raise ValueError('Install LibreOffice to use Word, Excel and PowerPoint conversion.')
    profile=root/('office-profile-'+secrets.token_hex(4));(profile/'user').mkdir(parents=True)
    (profile/'user/registrymodifications.xcu').write_text('<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Common/Load"><prop oor:name="UpdateDocMode" oor:op="fuse"><value>0</value></prop></item></oor:items>')
    dest=root/('office-output-'+secrets.token_hex(4));dest.mkdir()
    result=subprocess.run([exe,'-env:UserInstallation='+profile.as_uri(),'--headless','--nologo','--norestore','--nodefault','--nofirststartwizard','--convert-to','pdf','--outdir',str(dest),str(path)],capture_output=True,timeout=90)
    pdf=dest/(Path(path).stem+'.pdf')
    if not pdf.exists():raise ValueError('LibreOffice could not convert this file. Check that it opens normally and is not password protected.')
    with opened(pdf):pass
    return pdf

def ocr_doc(path,opts,root):
    tessdata=os.environ.get('ACE_TESSDATA') or str(Path(__file__).parent.parent/'data/tessdata')
    for language in opts.get('language','eng').split('+'):
        if not Path(tessdata,language+'.traineddata').exists():raise ValueError('OCR language data is missing. Run document setup to install the selected language.')
    out=fitz.open()
    with opened(path,opts.get('password','')) as doc:
        chosen=pages(opts.get('pages','all'),len(doc))
        if len(chosen)>30:raise ValueError('OCR supports up to 30 selected pages per job.')
        for i,page in enumerate(doc):
            if i not in chosen:out.insert_pdf(doc,from_page=i,to_page=i);continue
            pix=raster(page,min(opts.get('dpi',200),240))
            try:data=pix.pdfocr_tobytes(language=opts.get('language','eng'),tessdata=tessdata)
            except Exception:raise ValueError('OCR could not start. Check the bundled language data and OCR-enabled MuPDF runtime.')
            with fitz.open(stream=data,filetype='pdf') as one:out.insert_pdf(one)
    target=root/('ocr-'+secrets.token_hex(4)+'.pdf');save(out,target);out.close();return target

def extract_text(path,opts):
    with opened(path,opts.get('password','')) as doc:
        chosen=pages(opts.get('pages','all'),len(doc));text='\n\n'.join(doc[i].get_text(sort=True) for i in chosen)
    if not text.strip():raise ValueError('No selectable text was found. Run OCR first or enable OCR for conversion.')
    if len(text)>150000:raise ValueError('Too much text for one request. Select fewer pages.')
    return text

def summarize(text):
    sentences=re.split(r'(?<=[.!?۔])\s+|\n\s*\n',text)
    sentences=[s.strip() for s in sentences if len(s.strip())>25]
    if not sentences:return text[:2500]
    stop=set('the a an and or of to is are was were in on for that this with as it be by from at'.split())
    counts=Counter(w.lower() for w in re.findall(r'\w+',text) if len(w)>3 and w.lower() not in stop)
    scores=[(sum(counts[w.lower()] for w in re.findall(r'\w+',s))/max(1,len(s.split())**.55),i) for i,s in enumerate(sentences)]
    chosen=sorted(i for _,i in sorted(scores,reverse=True)[:min(8,max(3,len(sentences)//5))])
    return '\n\n'.join(sentences[i] for i in chosen)[:6000]

def process(tool,inputs,o,root,steps=None):
    warnings=[];files=[];stats={}
    pdfs=[i for i in inputs if Path(i['path']).read_bytes()[:1024].lstrip().startswith(b'%PDF-')]
    images=[i for i in inputs if i not in pdfs and i.get('extension') not in ('doc','docx','ppt','pptx','xls','xlsx','odt','ods','odp')]
    for image in images:sniff_image(image['path'])
    if tool in ('compress-pdf','watermark-pdf') and len(pdfs)>1:
        for index,item in enumerate(pdfs):
            folder=root/f'batch-{index}';folder.mkdir();sub=process(tool,[item]+images,o,folder)
            for f in sub['files']:files.append({**f,'path':f'batch-{index}/'+f['path'],'name':Path(item['name']).stem+'_processed.pdf'})
            warnings.extend(sub.get('warnings',[]))
        return {'files':files,'warnings':list(dict.fromkeys(warnings)),'stats':{'documents':len(pdfs)}}
    if len(pdfs)>1 and tool not in ('merge-pdf','compare-pdf'):raise ValueError('This tool accepts one PDF at a time. Additional images are only used for signatures or overlays.')
    if pdfs and images and tool not in ('sign-pdf','edit-pdf','watermark-pdf'):raise ValueError('Choose only PDF files for this operation.')
    path=Path(pdfs[0]['path']) if pdfs else None
    target=root/'ACE-result.pdf'
    def need_pdf():
        if path is None:raise ValueError('Upload a PDF document for this tool.')
    if tool=='workflow':
        need_pdf()
        if not steps:raise ValueError('Add at least one workflow step.')
        current=path
        for idx,step in enumerate(steps):
            sub=root/('step-'+str(idx));sub.mkdir()
            result=process(step['tool'],[{'path':str(current),'name':current.name,'extension':'pdf'}],step['options'],sub)
            if len(result['files'])!=1 or not result['files'][0]['name'].endswith('.pdf'):raise ValueError('Each workflow step must return one PDF.')
            current=sub/result['files'][0]['path'];warnings.extend(result.get('warnings',[]))
        shutil.copyfile(current,target);stats['steps']=len(steps)
    elif tool in ('images-to-pdf','scan-to-pdf'):
        if not images or len(images)!=len(inputs):raise ValueError('Choose only image files, in the required page order.')
        doc=fitz.open()
        for item in images:
            sniff_image(item['path'])
            with Image.open(item['path']) as image:
                image=ImageOps.exif_transpose(image).convert('RGB')
                if tool=='scan-to-pdf':image=ImageOps.autocontrast(ImageEnhance.Contrast(image).enhance(1.25))
                iw,ih=image.size
                width,height=(iw*72/o.get('dpi',144),ih*72/o.get('dpi',144)) if o.get('paper')=='original' else ((612,792) if o.get('paper')=='letter' else (595.276,841.89))
                if o.get('orientation')=='landscape':width,height=max(width,height),min(width,height)
                page=doc.new_page(width=width,height=height);margin=min(o.get('margin',24),min(width,height)/4)
                buffer=io.BytesIO();image.save(buffer,'JPEG',quality=o.get('quality',85))
                page.insert_image(fitz.Rect(margin,margin,width-margin,height-margin),stream=buffer.getvalue(),keep_proportion=True)
        save(doc,target);stats['pages']=len(doc);doc.close()
    elif tool in ('word-to-pdf','excel-to-pdf','powerpoint-to-pdf'):
        allowed={'word-to-pdf':('doc','docx','odt'),'excel-to-pdf':('xls','xlsx','ods'),'powerpoint-to-pdf':('ppt','pptx','odp')}[tool]
        if not inputs or any(i.get('extension') not in allowed for i in inputs):raise ValueError('Choose the correct Office file type for this converter.')
        for index,item in enumerate(inputs):
            pdf=office_pdf(Path(item['path']),root,item['extension']);dest=root/f'ACE-converted-{index+1}.pdf';shutil.copyfile(pdf,dest);files.append(output(dest,Path(item['name']).stem+'_converted.pdf'))
        warnings.append('Office layout follows LibreOffice. Check fonts, sheet print areas and page breaks before sharing.')
    elif tool=='html-to-pdf':
        source=o.get('html','').strip()
        if not source:raise ValueError('Paste the HTML you want to convert.')
        source=re.sub(r'<(script|iframe|object|embed)\b[^>]*>.*?</\1\s*>','',source,flags=re.S|re.I)
        source=re.sub(r'<(?:link|base)\b[^>]*>','',source,flags=re.I)
        writer=fitz.DocumentWriter(str(target));story=fitz.Story(html=source)
        def rect_fn(number,filled):return fitz.Rect(0,0,595,842),fitz.Rect(40,40,555,802),None
        story.write(writer,rect_fn);writer.close();warnings.append('Remote resources and JavaScript are not loaded; complex web layouts may render differently.')
    elif tool=='merge-pdf':
        if len(pdfs)<2 or len(pdfs)!=len(inputs):raise ValueError('Choose at least two PDF files to merge.')
        out=fitz.open()
        for item in pdfs:
            with opened(item['path'],o.get('password','')) as doc:
                if len(out)+len(doc)>MAX_PAGES:raise ValueError('Merged file exceeds the page limit.')
                out.insert_pdf(doc)
        stats['pages']=len(out);save(out,target);out.close()
    elif tool=='compare-pdf':
        if len(pdfs)!=2 or len(inputs)!=2:raise ValueError('Choose exactly two PDFs: original first, updated second.')
        with opened(pdfs[0]['path'],o.get('password','')) as a, opened(pdfs[1]['path'],o.get('password','')) as b:
            if max(len(a),len(b))>MAX_RENDER:raise ValueError('Compare up to 60 pages per document.')
            before='\n'.join(p.get_text(sort=True) for p in a);after='\n'.join(p.get_text(sort=True) for p in b)
            diff='\n'.join(difflib.unified_diff(before.splitlines(),after.splitlines(),fromfile='Original',tofile='Updated',lineterm=''))
            (root/'text-changes.txt').write_text(diff or 'No text differences found. Visual changes may still exist.',encoding='utf8');files.append(output(root/'text-changes.txt'))
            report=fitz.open();changed=0
            for i in range(max(len(a),len(b))):
                pics=[]
                for doc in (a,b):
                    if i<len(doc):
                        pix=raster(doc[i],90);pics.append(Image.frombytes('RGB',(pix.width,pix.height),pix.samples))
                    else:pics.append(Image.new('RGB',(600,800),'white'))
                size=(max(p.width for p in pics),max(p.height for p in pics));canvases=[]
                for p in pics:
                    canvas=Image.new('RGB',size,'white');canvas.paste(p,(0,0));canvases.append(canvas)
                difference=ImageChops.difference(*canvases);is_changed=difference.getbbox() is not None;changed+=is_changed
                page=report.new_page(width=1100,height=820);page.insert_text((25,30),f'Page {i+1}: '+('visual changes detected' if is_changed else 'no pixel changes detected'),fontsize=14)
                for j,pic in enumerate(canvases):
                    buf=io.BytesIO();pic.save(buf,'PNG');page.insert_image(fitz.Rect(25+j*535,50,535+j*535,790),stream=buf.getvalue(),keep_proportion=True)
                if is_changed:
                    overlay=Image.blend(canvases[1],ImageEnhance.Contrast(difference).enhance(3),.4);buf=io.BytesIO();overlay.save(buf,'PNG');page.insert_image(fitz.Rect(560,50,1070,790),stream=buf.getvalue(),keep_proportion=True)
            save(report,target);report.close();stats.update({'changedPages':changed,'originalPages':len(a),'updatedPages':len(b)})
        warnings.append('Visual comparison uses 90 DPI rasterization. The report is for review, not a certification of equivalence.')
    elif tool=='pdf-to-images':
        need_pdf()
        with opened(path,o.get('password','')) as doc:
            chosen=pages(o.get('pages','all'),len(doc))
            if len(chosen)>MAX_RENDER:raise ValueError('Export up to 60 pages at a time.')
            for idx in chosen:
                page=doc[idx]
                if o.get('extractImages'):
                    for j,item in enumerate(page.get_images(full=True)):
                        image=doc.extract_image(item[0]);ext=image['ext'];dest=root/f'page-{idx+1}-image-{j+1}.{ext}';dest.write_bytes(image['image']);files.append(output(dest))
                else:
                    pix=raster(page,o.get('dpi',144));ext='png' if o.get('format')=='png' else 'jpg';dest=root/f'page-{idx+1}.{ext}';pix.save(str(dest),jpg_quality=o.get('quality',85)) if ext=='jpg' else pix.save(str(dest));files.append(output(dest))
        if not files:raise ValueError('No embedded images were found. Switch to rendering complete pages.')
    elif tool=='pdf-to-word':
        need_pdf()
        chosen_path=ocr_doc(path,o,root) if o.get('ocr') else path
        with opened(chosen_path,o.get('password','')) as doc:
            chosen=pages(o.get('pages','all'),len(doc))
            if not any(doc[i].get_text().strip() for i in chosen):raise ValueError('This PDF contains scans. Enable OCR before converting to Word.')
            selected=root/'selected-for-word.pdf';out=fitz.open()
            for i in chosen:out.insert_pdf(doc,from_page=i,to_page=i)
            save(out,selected);out.close()
        from pdf2docx import Converter
        dest=root/'ACE-converted.docx';converter=Converter(str(selected))
        try:converter.convert(str(dest),multi_processing=False)
        finally:converter.close()
        files.append(output(dest));warnings.append('Editable layout was reconstructed. Complex typography and reading order may need manual adjustments.')
    elif tool=='pdf-to-excel':
        need_pdf();from openpyxl import Workbook
        book=Workbook();book.remove(book.active);table_count=0
        with opened(path,o.get('password','')) as doc:
            for i in pages(o.get('pages','all'),len(doc)):
                page=doc[i];tables=page.find_tables().tables
                rows_list=[t.extract() for t in tables] if tables else [[line.split('\t') for line in page.get_text(sort=True).splitlines()]]
                for j,rows in enumerate(rows_list):
                    sheet=book.create_sheet(f'Page {i+1}'+(f' table {j+1}' if tables else ' text'));table_count+=bool(tables)
                    for row in rows:
                        sheet.append([str(value or '')[:32000] for value in row[:200]])
                        for cell in sheet[sheet.max_row]:cell.data_type='s'
                    sheet.freeze_panes='A2'
                    for column in sheet.columns:sheet.column_dimensions[column[0].column_letter].width=min(60,max(14,max((len(str(c.value or '')) for c in column),default=10)+2))
        if not book.sheetnames:raise ValueError('No rows were found. Run OCR on scanned pages first.')
        dest=root/'ACE-tables.xlsx';book.save(dest);files.append(output(dest));stats['detectedTables']=table_count
        if not table_count:warnings.append('No grid tables were detected. Text was exported as rows instead of inventing table structure.')
    elif tool=='pdf-to-powerpoint':
        need_pdf();from pptx import Presentation
        from pptx.util import Inches,Pt
        from pptx.dml.color import RGBColor
        deck=Presentation()
        with opened(path,o.get('password','')) as doc:
            chosen=pages(o.get('pages','all'),len(doc))
            if len(chosen)>MAX_RENDER:raise ValueError('Convert up to 60 slides at a time.')
            first=doc[chosen[0]].rect;deck.slide_width=Pt(first.width);deck.slide_height=Pt(first.height)
            for idx in chosen:
                page=doc[idx];slide=deck.slides.add_slide(deck.slide_layouts[6]);sx=first.width/page.rect.width;sy=first.height/page.rect.height
                if o.get('slideMode')=='visual':
                    pix=raster(page,o.get('dpi',144));slide.shapes.add_picture(io.BytesIO(pix.tobytes('png')),0,0,width=deck.slide_width,height=deck.slide_height)
                else:
                    for block in page.get_text('dict')['blocks']:
                        if block['type']==1:
                            box=block['bbox'];slide.shapes.add_picture(io.BytesIO(block['image']),Pt(box[0]*sx),Pt(box[1]*sy),width=Pt((box[2]-box[0])*sx),height=Pt((box[3]-box[1])*sy));continue
                        for line in block.get('lines',[]):
                            for span in line['spans']:
                                x0,y0,x1,y1=span['bbox'];shape=slide.shapes.add_textbox(Pt(x0*sx),Pt(y0*sy),Pt(max(2,(x1-x0)*sx+8)),Pt(max(8,(y1-y0)*sy+5)));frame=shape.text_frame;frame.margin_left=frame.margin_right=frame.margin_top=frame.margin_bottom=0;p=frame.paragraphs[0];run=p.add_run();run.text=span['text'];run.font.size=Pt(max(6,span['size']*sy));run.font.name=span['font'].replace('Subset','');run.font.bold=bool(span['flags']&16);run.font.italic=bool(span['flags']&2);color=span['color'];run.font.color.rgb=RGBColor((color>>16)&255,(color>>8)&255,color&255)
        dest=root/'ACE-slides.pptx';deck.save(dest);files.append(output(dest));warnings.append('Editable mode reconstructs text and embedded images; vector backgrounds may differ. Visual mode preserves pages as images.')
    elif tool in ('pdf-to-markdown','ai-summarizer','translate-pdf','extract-text'):
        need_pdf();text=extract_text(path,o)
        if tool=='extract-text':return {'text':text}
        if tool=='pdf-to-markdown':
            chunks=[]
            with opened(path,o.get('password','')) as doc:
                for idx in pages(o.get('pages','all'),len(doc)):
                    chunks.append(f'<!-- Page {idx+1} -->\n')
                    for block in doc[idx].get_text('dict',sort=True)['blocks']:
                        if block.get('type')!=0:continue
                        spans=[s for line in block['lines'] for s in line['spans']];line_text='\n'.join(''.join(s['text'] for s in line['spans']) for line in block['lines']).strip()
                        if not line_text:continue
                        size=max((s['size'] for s in spans),default=11);prefix='# ' if size>=22 else '## ' if size>=17 else '### ' if size>=14 else ''
                        chunks.append(prefix+line_text+'\n')
            dest=root/'ACE-document.md';dest.write_text('\n'.join(chunks),encoding='utf8');files.append(output(dest));warnings.append('Markdown uses extracted reading order and font-size headings. Review complex tables and multi-column layouts.')
        elif tool=='ai-summarizer':
            summary=summarize(text);dest=root/'ACE-summary.txt';dest.write_text('Local extractive summary\n\n'+summary,encoding='utf8');files.append(output(dest));text_pdf(summary,target,'ACE Studio local summary');stats['mode']='local';warnings.append('This is a local extractive summary: sentences selected from the source, not a Gemini-generated analysis.')
        else:raise ValueError('Translation requires the configured AI service and document-text consent.')
    elif tool=='ocr-pdf':
        need_pdf();shutil.copyfile(ocr_doc(path,o,root),target);warnings.append('OCR creates searchable page images. Recognition and reading order should be reviewed.')
    elif tool=='pdf-to-pdfa':
        need_pdf();exe=ghostscript_executable();profile=srgb_profile(exe)
        if not exe or not profile:raise ValueError('Ghostscript and an sRGB ICC profile are required for PDF/A export.')
        definition=root/'pdfa.ps';definition.write_text('%!\n/ICCProfile ('+profile.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')+') def\n[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark\n[{icc_PDFA} << /N 3 >> /PUT pdfmark\n[{icc_PDFA} ICCProfile (r) file /PUT pdfmark\n[/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark\n[{OutputIntent_PDFA} << /Type /OutputIntent /S /GTS_PDFA1 /DestOutputProfile {icc_PDFA} /OutputConditionIdentifier (sRGB) >> /PUT pdfmark\n[{Catalog} << /OutputIntents [ {OutputIntent_PDFA} ] >> /PUT pdfmark\n')
        with opened(path,o.get('password','')) as doc:clean=root/'archive-input.pdf';save(doc,clean)
        result=subprocess.run([exe,'-dBATCH','-dNOPAUSE','-dSAFER','-sDEVICE=pdfwrite','-dPDFA=2','-dPDFACompatibilityPolicy=1','-sColorConversionStrategy=RGB','-sProcessColorModel=DeviceRGB','--permit-file-read='+str(Path(profile).parent)+'/*','-sOutputFile='+str(target),str(definition),str(clean)],capture_output=True,timeout=90)
        if result.returncode or not target.exists():raise ValueError('PDF/A export could not preserve all content. Try a simpler PDF and validate the result independently.')
        warnings.append('PDF/A-2 candidate produced by Ghostscript. Validate with veraPDF before relying on formal archival compliance.');stats['conformance']='PDF/A-2 candidate; not independently validated'
    else:
        need_pdf()
        with opened(path,o.get('password','')) as doc:
            chosen=pages(o.get('pages','all'),len(doc),duplicates=tool=='organize-pdf')
            if tool in ('split-pdf','extract-pages','organize-pdf','remove-pages'):
                if tool=='split-pdf':
                    groups=[pages(part,len(doc)) for part in o.get('groups','').split(';') if part.strip()] or [[i] for i in chosen]
                    for index,group in enumerate(groups):
                        one=fitz.open()
                        for i in group:one.insert_pdf(doc,from_page=i,to_page=i)
                        dest=root/f'ACE-part-{index+1}.pdf';save(one,dest);one.close();files.append(output(dest))
                else:
                    if tool=='remove-pages':chosen=[i for i in range(len(doc)) if i not in chosen]
                    if not chosen:raise ValueError('This selection would remove every page. Keep at least one page.')
                    out=fitz.open()
                    for i in chosen:out.insert_pdf(doc,from_page=i,to_page=i)
                    save(out,target);stats['pages']=len(out);out.close()
            elif tool=='rotate-pdf':
                for i in chosen:doc[i].set_rotation((doc[i].rotation+o.get('rotation',90))%360)
                save(doc,target)
            elif tool=='crop-pdf':
                for i in chosen:
                    page=doc[i];box=page_box(page,o['rect']);offset=page.cropbox_position;box=fitz.Rect(box.x0+offset.x,box.y0+offset.y,box.x1+offset.x,box.y1+offset.y);page.set_cropbox(box)
                save(doc,target);warnings.append('Cropping hides areas outside the visible page; it is not secure redaction.')
            elif tool in ('page-numbers','watermark-pdf','edit-pdf','sign-pdf'):
                asset=Path(images[0]['path']).read_bytes() if images else None
                for n,i in enumerate(chosen):
                    page=doc[i];rect=page_box(page,o['rect']);text=o.get('text','')
                    if tool=='page-numbers':
                        text=str(o.get('startNumber',1)+n);r=page.rect;width=150;height=max(25,o.get('fontSize',18)+8);position=o.get('position','bottom-center');x=20 if position.endswith('left') else r.width-width-20 if position.endswith('right') else (r.width-width)/2;y=20 if position.startswith('top') else (r.height-height)/2 if position=='center' else r.height-height-15;rect=fitz.Rect(x,y,x+width,y+height)*page.derotation_matrix
                    if tool=='sign-pdf' or (tool in ('watermark-pdf','edit-pdf') and asset and (tool!='edit-pdf' or o.get('shape')=='image')):
                        if not asset:raise ValueError('Draw a signature or upload a signature image.')
                        page.insert_image(rect,stream=asset,keep_proportion=True,overlay=True)
                    elif tool=='edit-pdf' and o.get('shape') in ('rectangle','highlight'):
                        page.draw_rect(rect,color=rgb(o.get('color','#5B49C8')),fill=rgb(o.get('color','#5B49C8')),fill_opacity=o.get('opacity',.35),overlay=True)
                    else:
                        if not text.strip():raise ValueError('Enter the text to add to the document.')
                        opacity=o.get('opacity',.35) if tool=='watermark-pdf' else 1
                        escaped=html.escape(text).replace('\n','<br>');size=o.get('fontSize',18);color=o.get('color','#5B49C8')
                        page.insert_htmlbox(rect,f'<div style="font-size:{size}pt;color:{color};text-align:center">{escaped}</div>',opacity=opacity,scale_low=.5)
                save(doc,target)
                if tool=='sign-pdf':warnings.append('This is a visual signature without a cryptographic certificate, audit trail or identity verification.')
            elif tool=='pdf-forms':
                fields=o.get('fields',[]);values=o.get('values',{});existing=set()
                for page in doc:
                    for widget in page.widgets() or []:
                        existing.add(widget.field_name)
                        if widget.field_name in values:
                            value=values[widget.field_name]
                            widget.field_value=widget.on_state() if value is True and widget.field_type==fitz.PDF_WIDGET_TYPE_CHECKBOX else 'Off' if value is False and widget.field_type==fitz.PDF_WIDGET_TYPE_CHECKBOX else str(value)
                            widget.update()
                if set(values)-existing:raise ValueError('Some named form fields do not exist in this PDF.')
                for field in fields:
                    if field['name'] in existing:raise ValueError('Form field names must be unique.')
                    if field['page']>len(doc):raise ValueError('A form field points to a page that does not exist.')
                    page=doc[field['page']-1];widget=fitz.Widget();widget.field_name=field['name'];widget.field_type=fitz.PDF_WIDGET_TYPE_CHECKBOX if field['type']=='checkbox' else fitz.PDF_WIDGET_TYPE_TEXT;widget.rect=page_box(page,field['rect']);widget.field_value=field.get('value','');widget.text_fontsize=12;page.add_widget(widget);existing.add(field['name'])
                if not fields and not values:raise ValueError('Fill an existing field or add a new field first.')
                if o.get('flatten'):
                    doc.bake(annots=False,widgets=True);warnings.append('Form widgets were flattened into page content and are no longer interactive.')
                save(doc,target);stats['fields']=len(existing)
            elif tool=='redact-pdf':
                search=o.get('search','').strip();redactions=0
                for i in chosen:
                    page=doc[i];rects=page.search_for(search) if search else [page_box(page,o['rect'])]
                    for rect in rects:page.add_redact_annot(rect,fill=(0,0,0));redactions+=1
                    if rects:
                        for widget in list(page.widgets() or []):
                            if any(widget.rect.intersects(rect) for rect in rects):page.delete_widget(widget)
                        for annotation in list(page.annots() or []):
                            if annotation.type[0]!=fitz.PDF_ANNOT_REDACT and any(annotation.rect.intersects(rect) for rect in rects):page.delete_annot(annotation)
                        page.apply_redactions(images=2,graphics=2,text=0)
                if not redactions:raise ValueError('The search text was not found. For scanned pages, run OCR or draw a redaction rectangle.')
                while doc.embfile_count():doc.embfile_del(0)
                doc.set_metadata({});doc.del_xml_metadata();save(doc,target);stats['redactions']=redactions
                warnings.append('Selected content was removed using native redaction; metadata and embedded files were also removed. Review the new copy before sharing.')
            elif tool=='protect-pdf':
                password=o.get('newPassword','')
                if len(password)<6 or len(password.encode('utf8'))>40:raise ValueError('Choose a password with at least 6 characters and no more than 40 UTF-8 bytes.')
                save(doc,target,encryption=fitz.PDF_ENCRYPT_AES_256,user_pw=password,owner_pw=secrets.token_hex(16),permissions=fitz.PDF_PERM_PRINT|fitz.PDF_PERM_ACCESSIBILITY)
            elif tool in ('unlock-pdf','repair-pdf'):
                save(doc,target,encryption=fitz.PDF_ENCRYPT_NONE)
                if tool=='repair-pdf':warnings.append('Readable objects were rebuilt. Unreadable or missing source data cannot be recreated.')
            elif tool=='compress-pdf':
                mode=o.get('compression','lossless')
                if mode!='lossless':
                    doc.rewrite_images(dpi_threshold=160 if mode=='balanced' else 110,dpi_target=140 if mode=='balanced' else 96,quality=o.get('quality',85) if mode=='balanced' else min(o.get('quality',65),65))
                    warnings.append('Embedded images were recompressed. Review detailed graphics and small text in scanned pages.')
                save(doc,target)
                if target.stat().st_size>=path.stat().st_size:shutil.copyfile(path,target);warnings.append('The original was already smaller. It was kept instead of returning a larger file.')
                stats.update({'originalBytes':path.stat().st_size,'outputBytes':target.stat().st_size,'targetMet':not o.get('targetKB') or target.stat().st_size<=o['targetKB']*1024})
                if not stats['targetMet']:warnings.append('The requested file-size limit could not be met within the selected compression mode. The measured output is reported accurately.')
            else:raise ValueError('This document operation is not supported.')
    if target.exists() and not any(f['path']==target.name for f in files):files.insert(0,output(target))
    if not files:raise ValueError('No output was generated.')
    stats['outputBytes']=sum(f['bytes'] for f in files)
    return {'files':files,'warnings':warnings,'stats':stats}

def capabilities():
    tessdata=Path(os.environ.get('ACE_TESSDATA') or Path(__file__).parent.parent/'data/tessdata')
    gs=ghostscript_executable()
    return {'engine':True,'office':bool(office_executable()),'ocr':(tessdata/'eng.traineddata').exists(),'archive':bool(gs and srgb_profile(gs)),'version':fitz.VersionBind}

def main():
    request_path=Path(sys.argv[1]).resolve();root=request_path.parent;job=json.loads(request_path.read_text(encoding='utf-8'))
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_CPU,(170,175));resource.setrlimit(resource.RLIMIT_FSIZE,(120*1024*1024,120*1024*1024))
        if sys.platform.startswith('linux'):resource.setrlimit(resource.RLIMIT_AS,(3*1024**3,3*1024**3))
    except (ImportError,ValueError,OSError):pass
    for item in job.get('inputs',[]):
        file=(root/item['path']).resolve()
        if not file.is_relative_to(root) or not file.is_file():raise ValueError('Invalid private job input.')
        item['path']=str(file)
    action=job.get('action','process');options=job.get('options',{})
    with contextlib.redirect_stdout(sys.stderr):
        if action=='capabilities':result=capabilities()
        elif action=='inspect':result=inspect(job['inputs'],options)
        elif action=='preview':
            with opened(job['inputs'][0]['path'],options.get('password','')) as doc:
                index=int(job.get('page',1))-1
                if not 0<=index<len(doc):raise ValueError('That page does not exist.')
                page=doc[index];scale=min(1100/page.rect.width,1300/page.rect.height);pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
                result={'page':index+1,'width':page.rect.width,'height':page.rect.height,'image':'data:image/png;base64,'+base64.b64encode(pix.tobytes('png')).decode()}
        elif action=='render-text':
            text_pdf(str(job.get('text',''))[:150000],root/'ACE-document.pdf',str(job.get('title','ACE Studio')));result={'files':[output(root/'ACE-document.pdf')],'warnings':job.get('warnings',[]),'stats':job.get('stats',{})}
        else:result=process(job['tool'],job.get('inputs',[]),options,root,job.get('steps',[]))
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':
    try:main()
    except Exception as error:
        message=str(error) if isinstance(error,(ValueError,TimeoutError)) else 'The document engine could not complete this file. Try a smaller or simpler document.'
        print(json.dumps({'error':message}));sys.exit(1)
