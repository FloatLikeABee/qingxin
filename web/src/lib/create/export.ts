import type { CreateOutline } from './catalog';
import { outlineMarkdown } from './ai';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function outlineToMarkdown(outline: CreateOutline): string {
	return outlineMarkdown(outline.title, outline.slides);
}

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) {
			const mask = -(crc & 1);
			crc = (crc >>> 1) ^ (0xedb88320 & mask);
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
	return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Uint8Array {
	return Uint8Array.of(
		value & 0xff,
		(value >>> 8) & 0xff,
		(value >>> 16) & 0xff,
		(value >>> 24) & 0xff
	);
}

function concat(parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function zipStored(files: { name: string; data: Uint8Array }[]): Uint8Array {
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;
	for (const file of files) {
		const name = encoder.encode(file.name);
		const crc = crc32(file.data);
		const local = concat([
			encoder.encode('PK\u0003\u0004'),
			u16(20),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(file.data.length),
			u32(file.data.length),
			u16(name.length),
			u16(0),
			name,
			file.data
		]);
		const central = concat([
			encoder.encode('PK\u0001\u0002'),
			u16(20),
			u16(20),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(file.data.length),
			u32(file.data.length),
			u16(name.length),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(0),
			u32(offset),
			name
		]);
		locals.push(local);
		centrals.push(central);
		offset += local.length;
	}
	const localBlob = concat(locals);
	const centralBlob = concat(centrals);
	const eocd = concat([
		encoder.encode('PK\u0005\u0006'),
		u16(0),
		u16(0),
		u16(files.length),
		u16(files.length),
		u32(centralBlob.length),
		u32(localBlob.length),
		u16(0)
	]);
	return concat([localBlob, centralBlob, eocd]);
}

function slideXml(heading: string, bullets: string[]): string {
	const lines = [heading, ...bullets]
		.map((line) => `<a:p><a:r><a:t>${escapeXml(line)}</a:t></a:r></a:p>`)
		.join('');
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
    <p:sp>
      <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
      <p:spPr/>
      <p:txBody><a:bodyPr/><a:lstStyle/>${lines}</p:txBody>
    </p:sp>
  </p:spTree></p:cSld>
</p:sld>`;
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

export function outlineToPptx(outline: CreateOutline): Uint8Array {
	const slides = outline.slides.length
		? outline.slides
		: [{ heading: outline.title, bullets: [] as string[] }];
	const files: { name: string; data: Uint8Array }[] = [];
	const overrides = slides
		.map(
			(_, index) =>
				`<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
		)
		.join('');
	files.push({
		name: '[Content_Types].xml',
		data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${overrides}
</Types>`)
	});
	files.push({
		name: '_rels/.rels',
		data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`)
	});
	const sldIds = slides
		.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`)
		.join('');
	files.push({
		name: 'ppt/presentation.xml',
		data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${sldIds}</p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`)
	});
	const rels = slides
		.map(
			(_, index) =>
				`<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`
		)
		.join('');
	files.push({
		name: 'ppt/_rels/presentation.xml.rels',
		data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`)
	});
	slides.forEach((slide, index) => {
		files.push({
			name: `ppt/slides/slide${index + 1}.xml`,
			data: encoder.encode(slideXml(slide.heading, slide.bullets))
		});
	});
	return zipStored(files);
}

export function unzipStoredStrings(bytes: Uint8Array): string[] {
	const out: string[] = [];
	let offset = 0;
	const sig = 0x04034b50;
	while (offset + 30 <= bytes.length) {
		const read = (at: number) =>
			bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24);
		if (read(offset) !== sig) break;
		const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
		const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);
		const size =
			bytes[offset + 22] |
			(bytes[offset + 23] << 8) |
			(bytes[offset + 24] << 16) |
			(bytes[offset + 25] << 24);
		const dataStart = offset + 30 + nameLen + extraLen;
		out.push(decoder.decode(bytes.slice(dataStart, dataStart + size)));
		offset = dataStart + size;
	}
	return out;
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime: string) {
	const copy = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(copy).set(bytes);
	const blob = new Blob([copy], { type: mime });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

export function downloadText(filename: string, text: string, mime = 'text/markdown;charset=utf-8') {
	downloadBytes(filename, encoder.encode(text), mime);
}
