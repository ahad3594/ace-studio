import io,json,tempfile,unittest,sys,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'worker'))
import documents as engine
import pymupdf as fitz
from PIL import Image,ImageDraw

class DocumentTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='ace-unit-');self.root=Path(self.temp.name)
        self.pdf=self.root/'source.pdf';doc=fitz.open()
        for n in range(3):
            page=doc.new_page();page.insert_text((60,65),'ACE Studio source document',fontsize=22);page.insert_text((60,95),f'Page {n+1}: confidential-reference-9087',fontsize=12);page.insert_text((60,120),'A useful sentence explains why reliable document tools matter.',fontsize=12)
            for y in (180,210,240):page.draw_line((60,y),(420,y))
            for x in (60,240,420):page.draw_line((x,180),(x,240))
            page.insert_text((70,200),'Name');page.insert_text((250,200),'Value');page.insert_text((70,230),'Sample');page.insert_text((250,230),'42')
        doc.save(self.pdf);doc.close()
        self.image=self.root/'sample.png';im=Image.new('RGB',(1200,500),'white');ImageDraw.Draw(im).text((80,190),'ACE STUDIO OCR TEST',font_size=60,fill='black');im.save(self.image)
        self.o={'pages':'all','password':'','newPassword':'secret123','rotation':90,'dpi':144,'quality':80,'format':'jpeg','paper':'a4','orientation':'portrait','margin':24,'compression':'lossless','text':'ACE REVIEW','fontSize':18,'color':'#5B49C8','opacity':.35,'position':'bottom-center','startNumber':1,'rect':{'x':10,'y':40,'width':50,'height':12},'shape':'text','language':'eng','slideMode':'editable','values':{},'fields':[]}
        os.environ['ACE_TESSDATA']=str(Path(__file__).parents[1]/'data/tessdata')
    def tearDown(self):self.temp.cleanup()
    def inputs(self,path=None):return [{'path':str(path or self.pdf),'name':(path or self.pdf).name,'extension':(path or self.pdf).suffix[1:]}]
    def run_tool(self,tool,options=None,inputs=None,steps=None):
        root=self.root/(tool+'-'+str(len(list(self.root.iterdir()))));root.mkdir()
        result=engine.process(tool,inputs or self.inputs(),{**self.o,**(options or {})},root,steps)
        for f in result['files']:
            self.assertEqual((root/f['path']).stat().st_size,f['bytes'])
            if f['name'].endswith('.pdf') and tool!='protect-pdf':
                with fitz.open(root/f['path']) as pdf:self.assertGreater(len(pdf),0);self.assertGreater(pdf[0].get_pixmap().width,0)
        return root,result
    def pdf_output(self,root,result):return root/next(f['path'] for f in result['files'] if f['name'].endswith('.pdf'))
    def test_page_operations(self):
        for tool,options,expected in [('merge-pdf',{},6),('extract-pages',{'pages':'1,3'},2),('remove-pages',{'pages':'2'},2),('organize-pdf',{'pages':'3,1,1'},3)]:
            with self.subTest(tool=tool):
                root,r=self.run_tool(tool,options,self.inputs()*2 if tool=='merge-pdf' else None)
                with fitz.open(self.pdf_output(root,r)) as doc:self.assertEqual(len(doc),expected)
        root,r=self.run_tool('split-pdf',{'groups':'1-2;3'});self.assertEqual(len(r['files']),2)
        root,r=self.run_tool('rotate-pdf',{'pages':'2','rotation':90})
        with fitz.open(self.pdf_output(root,r)) as doc:self.assertEqual(doc[0].rotation,0);self.assertEqual(doc[1].rotation,90)
    def test_images_pdf_scan_and_page_images(self):
        for tool in ['images-to-pdf','scan-to-pdf']:
            root,r=self.run_tool(tool,inputs=self.inputs(self.image)*2)
            with fitz.open(self.pdf_output(root,r)) as doc:self.assertEqual(len(doc),2)
        root,r=self.run_tool('pdf-to-images',{'pages':'1-2','format':'png'})
        self.assertEqual(len(r['files']),2)
        for item in r['files']:
            with Image.open(root/item['path']) as im:self.assertEqual(im.format,'PNG')
    def test_word_conversion_is_editable(self):
        from docx import Document
        root,r=self.run_tool('pdf-to-word',{'pages':'1'})
        word=Document(root/r['files'][0]['path']);combined=' '.join(p.text for p in word.paragraphs)+' '.join(c.text for table in word.tables for row in table.rows for c in row.cells)
        self.assertIn('ACE Studio',combined);self.assertIn('42',combined)
    def test_excel_powerpoint_and_markdown(self):
        from openpyxl import load_workbook
        from pptx import Presentation
        root,r=self.run_tool('pdf-to-excel',{'pages':'1'});book=load_workbook(root/r['files'][0]['path']);self.assertTrue(book.sheetnames);self.assertTrue(any('42' in str(cell.value) for sheet in book for row in sheet for cell in row))
        root,r=self.run_tool('pdf-to-powerpoint',{'pages':'1-2'});slides=Presentation(root/r['files'][0]['path']);self.assertEqual(len(slides.slides),2);self.assertTrue(any('ACE Studio' in shape.text for shape in slides.slides[0].shapes if shape.has_text_frame))
        root,r=self.run_tool('pdf-to-markdown',{'pages':'1'});self.assertIn('ACE Studio',(root/r['files'][0]['path']).read_text())
    def test_overlays_crop_and_forms(self):
        for tool in ['page-numbers','watermark-pdf','edit-pdf']:
            root,r=self.run_tool(tool)
            with fitz.open(self.pdf_output(root,r)) as pdf:self.assertIn('1' if tool=='page-numbers' else 'ACE REVIEW',pdf[0].get_text())
        root,r=self.run_tool('crop-pdf',{'rect':{'x':5,'y':5,'width':90,'height':90}})
        with fitz.open(self.pdf_output(root,r)) as pdf:self.assertLess(pdf[0].rect.width,595)
        fields=[{'name':'applicant','type':'text','page':1,'rect':{'x':10,'y':45,'width':45,'height':8},'value':'ACE User'}]
        root,r=self.run_tool('pdf-forms',{'fields':fields});formed=self.pdf_output(root,r)
        from pypdf import PdfReader
        self.assertEqual(PdfReader(formed).get_fields()['applicant']['/V'],'ACE User')
        root,r=self.run_tool('pdf-forms',{'fields':[],'values':{'applicant':'Updated value'}},self.inputs(formed));self.assertEqual(PdfReader(self.pdf_output(root,r)).get_fields()['applicant']['/V'],'Updated value')
    def test_permanent_redaction_and_encryption(self):
        root,r=self.run_tool('redact-pdf',{'search':'confidential-reference-9087'})
        with fitz.open(self.pdf_output(root,r)) as doc:self.assertNotIn('confidential-reference-9087',''.join(p.get_text() for p in doc));self.assertIn('ACE Studio',doc[0].get_text())
        root,r=self.run_tool('protect-pdf');encrypted=self.pdf_output(root,r)
        with fitz.open(encrypted) as doc:self.assertTrue(doc.needs_pass);self.assertGreater(doc.authenticate('secret123'),0)
        root,r=self.run_tool('unlock-pdf',{'password':'secret123'},self.inputs(encrypted))
        with fitz.open(self.pdf_output(root,r)) as doc:self.assertFalse(doc.needs_pass);self.assertIn('ACE Studio',doc[0].get_text())
    def test_compression_repair_compare_signature_and_workflow(self):
        for tool in ['compress-pdf','repair-pdf']:
            root,r=self.run_tool(tool);self.assertGreater(r['files'][0]['bytes'],0)
        root,r=self.run_tool('compress-pdf',{'compression':'strong','targetKB':.01});self.assertFalse(r['stats']['targetMet'])
        root,r=self.run_tool('compare-pdf',inputs=self.inputs()*2);self.assertEqual(r['stats']['changedPages'],0)
        root,r=self.run_tool('sign-pdf',inputs=self.inputs()+self.inputs(self.image));self.assertIn('visual signature',' '.join(r['warnings']))
        root,r=self.run_tool('workflow',steps=[{'tool':'rotate-pdf','options':self.o},{'tool':'page-numbers','options':self.o}]);self.assertEqual(r['stats']['steps'],2)
    def test_html_summary_and_real_ocr(self):
        root,r=self.run_tool('html-to-pdf',{'html':'<h1>ACE HTML document</h1><p>Local rendering works.</p>'})
        with fitz.open(self.pdf_output(root,r)) as doc:self.assertIn('ACE HTML document',doc[0].get_text())
        root,r=self.run_tool('ai-summarizer');self.assertEqual(r['stats']['mode'],'local')
        image_root,ir=self.run_tool('images-to-pdf',inputs=self.inputs(self.image));scan=self.pdf_output(image_root,ir)
        root,r=self.run_tool('ocr-pdf',{'dpi':200},self.inputs(scan))
        with fitz.open(self.pdf_output(root,r)) as doc:self.assertIn('ACE STUDIO OCR TEST',doc[0].get_text().strip())
    def test_office_to_pdf(self):
        from docx import Document
        from openpyxl import Workbook
        from pptx import Presentation
        word=Document();word.add_heading('ACE Word conversion',0);word.add_paragraph('An editable source becomes a real PDF.');wp=self.root/'office.docx';word.save(wp)
        book=Workbook();book.active.append(['ACE Excel conversion','Value']);book.active.append(['Example',42]);xp=self.root/'office.xlsx';book.save(xp)
        deck=Presentation();slide=deck.slides.add_slide(deck.slide_layouts[0]);slide.shapes.title.text='ACE PowerPoint conversion';pp=self.root/'office.pptx';deck.save(pp)
        for tool,path in [('word-to-pdf',wp),('excel-to-pdf',xp),('powerpoint-to-pdf',pp)]:
            with self.subTest(tool=tool):
                root,r=self.run_tool(tool,inputs=self.inputs(path))
                with fitz.open(self.pdf_output(root,r)) as doc:self.assertIn('ACE',doc[0].get_text())
    def test_archive_and_invalid_inputs(self):
        root,r=self.run_tool('pdf-to-pdfa');self.assertIn('candidate',r['stats']['conformance'])
        with self.assertRaises(ValueError):engine.pages('0,999',3)
        with self.assertRaises(ValueError):engine.pages('1;rm -rf',3)
        with self.assertRaises(ValueError):self.run_tool('remove-pages',{'pages':'all'})
        fake=self.root/'fake.docx';fake.write_text('Not an office document')
        with self.assertRaises(ValueError):engine.validate_office(fake,'docx')

if __name__=='__main__':unittest.main(verbosity=2)
