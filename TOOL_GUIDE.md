# ACE Studio tool guide

Choose a tool from All tools, add your files, review its settings, run it and download the real result. Original source files are never overwritten.

| Tool | How to use it | What to check |
| --- | --- | --- |
| Merge PDF | Add two or more PDFs. Reorder the files using arrows. | All protected inputs must open with the supplied input password. |
| Split PDF | Choose pages. Leave groups empty for one PDF per page, or enter `1-3;4-6`. | Multiple results download as a ZIP. |
| Remove pages | Enter the page numbers to remove. | At least one page must remain. |
| Extract pages | Enter the pages to keep. | Page numbers are one-based. |
| Organize PDF | Enter a new order, such as `3,1,2,2`. | Repeating a page duplicates it. |
| Scan to PDF | Add photographs in order. | Contrast is enhanced, but missing or blurred content is not generated. |
| Compress PDF | Start with lossless mode. Try image modes for scans. | The app measures actual bytes and says if the target was not met. |
| Repair PDF | Add the readable damaged file. | Missing or irrecoverable source content cannot be restored. |
| OCR PDF | Choose pages and English, German, Urdu or English + Urdu. | OCR is a rasterized searchable copy. Review recognition accuracy. |
| Images to PDF | Add pictures, reorder them and choose paper/margins. | The complete image is fitted inside the page. |
| Word to PDF | Add DOCX, DOC or ODT. | LibreOffice must be installed. Complex fonts can differ. |
| PowerPoint to PDF | Add PPTX, PPT or ODP. | Check slide layout and fonts. |
| Excel to PDF | Add XLSX, XLS or ODS. | Workbook print areas and page breaks affect output. |
| HTML to PDF | Paste HTML in the settings panel. | Document HTML/CSS is supported; scripts and remote resources are not loaded. |
| PDF to images | Choose JPEG/PNG, pages and DPI. | Choose embedded-image extraction only when you want pictures, not full page renders. |
| PDF to Word | Add the PDF and enable OCR for scans if needed. | Output is an editable DOCX; complex layout is reconstructed. |
| PDF to PowerPoint | Choose editable mode or page-image mode. | Editable mode can lose vector backgrounds; page-image mode is not editable text. |
| PDF to Excel | Choose pages with tables. | Tables are extracted where detected; otherwise text rows are used. |
| PDF to PDF/A | Add the PDF and run the export. | Output is a PDF/A-2 candidate. Independent compliance validation is not bundled. |
| Rotate PDF | Choose pages and an angle. | Rotation preserves the PDF text layer. |
| Page numbers | Set pages, starting number and position. | Numbers count through the selected pages. |
| Watermark PDF | Enter text or upload a watermark image. Choose its area. | Opacity applies to text watermarks. Image opacity is taken from the image alpha channel. |
| Crop PDF | Drag the area to keep or type its percentages. | Hidden content remains in the file. This is not redaction. |
| Edit PDF | Add text, an image, a rectangle or a highlight in a chosen area. | Existing text is not reflowed or rewritten. |
| PDF forms | Fill listed fields or create text fields/checkboxes in the selected area. | Fields stay interactive unless Flatten is selected. |
| Sign PDF | Draw your signature or upload a signature image. Choose its area. | It is a visual signature, not a certificate or verified signing transaction. |
| Unlock PDF | Enter the correct input password. | The app does not crack or guess passwords. |
| Protect PDF | Enter and confirm a new password. | Keep the password safe. AES-256 encryption is used. |
| Redact PDF | Search for text, or choose the area to remove. | Native PDF content is removed. Metadata and embedded files are also removed. Review the output. |
| Compare PDF | Add the original first and the revised file second. | Output includes a visual PDF report and a text-change report. Visual comparison uses 90 DPI. |
| AI summarizer | Choose Gemini or local mode. Allow text sharing only if wanted. | Local mode selects sentences. Verify AI summaries against the source. |
| Translate PDF | Connect Gemini, choose a language and allow text sharing. | Output is newly typeset text, without a guarantee of original layout or figures. |
| PDF to Markdown | Choose the pages to extract. | Headings are inferred from font sizes. Review complex reading order and tables. |
| Custom workflows | Add up to eight supported PDF transformations. | Each step consumes the previous output. Passwords are not stored in saved presets. |

The image studio supports real JPEG, PNG, WebP and AVIF output, accurate dimensions and DPI, measured compression, original/result comparison, local presets and batch ZIPs. HEIC input depends on the deployed Sharp codecs.
