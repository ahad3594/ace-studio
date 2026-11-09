import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import JSZip from 'jszip';
import sharp from 'sharp';

test('ACE hub finds tools and routes conversational document requests',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Your files. All the possibilities.'})).toBeVisible();
 await page.getByRole('textbox',{name:'Search tools'}).fill('Word');
 await expect(page.getByRole('link',{name:/PDF to Word Recover/})).toBeVisible();
 await page.getByRole('textbox',{name:'Describe your document task'}).fill('Please turn my PDF into something I can edit in Word');
 await page.getByRole('button',{name:'Understand my request'}).click();
 await expect(page.getByText('Local interpretation',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Open PDF to Word/}).click();
 await expect(page).toHaveURL(/tools\/pdf-to-word/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('PDF to Word downloads editable document contents',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/tools/pdf-to-word');
 await page.getByRole('button',{name:'Try with an ACE sample document'}).click();
 await expect(page.getByRole('button',{name:'Preview document ACE-sample.pdf'})).toBeVisible();
 const run=page.getByRole('button',{name:'Run document tool'});await expect(run).toBeEnabled({timeout:30000});await run.click();
 const downloadButton=page.getByRole('button',{name:'Download document result'});await expect(downloadButton).toBeVisible({timeout:60000});
 const wait=page.waitForEvent('download');await downloadButton.click();const download=await wait;expect(download.suggestedFilename()).toMatch(/\.docx$/);
 const zip=await JSZip.loadAsync(await readFile((await download.path())!));expect(await zip.file('word/document.xml')!.async('string')).toContain('ACE Studio');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});

test('images become actual PDF pages and PDF pages download as a ZIP of images',async({page})=>{
 const image=await sharp({create:{width:400,height:200,channels:3,background:'#8b72c9'}}).png().toBuffer();
 await page.goto('/tools/images-to-pdf');await page.getByLabel('Upload document files').setInputFiles([{name:'first.png',mimeType:'image/png',buffer:image},{name:'second.png',mimeType:'image/png',buffer:image}]);
 await expect(page.getByRole('button',{name:'Preview document second.png'})).toBeVisible();
 const run=page.getByRole('button',{name:'Run document tool'});await expect(run).toBeEnabled({timeout:30000});await run.click();
 await expect(page.getByRole('button',{name:'Download document result'})).toBeVisible({timeout:30000});
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Download document result'}).click();const pdf=await wait;const bytes=await readFile((await pdf.path())!);expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
 await page.goto('/tools/pdf-to-images');await page.getByLabel('Upload document files').setInputFiles({name:'photos.pdf',mimeType:'application/pdf',buffer:bytes});
 await expect(page.getByRole('button',{name:'Run document tool'})).toBeEnabled({timeout:30000});await page.getByRole('button',{name:'Run document tool'}).click();
 const button=page.getByRole('button',{name:'Download document result'});await expect(button).toBeVisible({timeout:30000});const zipWait=page.waitForEvent('download');await button.click();const zipDownload=await zipWait;expect(zipDownload.suggestedFilename()).toMatch(/\.zip$/);
 const zip=await JSZip.loadAsync(await readFile((await zipDownload.path())!));const entries=Object.values(zip.files).filter(f=>!f.dir);expect(entries).toHaveLength(2);for(const entry of entries){const metadata=await sharp(await entry.async('nodebuffer')).metadata();expect(metadata.format).toBe('jpeg');expect(metadata.width).toBeGreaterThan(300);}
});
