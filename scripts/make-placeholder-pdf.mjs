// Makes the blank placeholder that stands where a resume would go:
// one empty page, no text, no author. The real resume never enters the repo.
// Usage: node scripts/make-placeholder-pdf.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** A valid one-page PDF with nothing on the page. */
export function blankPdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    // US Letter, in points.
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const table = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${table}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = 'src/assets/resume-placeholder.pdf';
  await writeFile(path, blankPdf());
  console.log(`Wrote ${path}`);
}
