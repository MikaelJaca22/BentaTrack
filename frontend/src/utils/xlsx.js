// Minimal, dependency-free Excel (.xlsx) writer.
//
// Builds a valid SpreadsheetML package (a ZIP of XML parts) using stored
// (uncompressed) ZIP entries and inline strings, so the output opens in
// Excel/Sheets without pulling in any library.

const encoder = new TextEncoder();

// ---------------------------------------------------------------- crc32
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------- zip (stored entries)
function zipStored(parts) {
  const out = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of parts) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const size = data.length;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename
    lv.setUint16(8, 0, true); // method: stored
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);

    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralEntry.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    centralEntry.set(nameBytes, 46);

    out.push(localHeader, data);
    central.push(centralEntry);
    offset += localHeader.length + size;
  }

  const centralStart = offset;
  const centralSize = central.reduce((a, c) => a + c.length, 0);
  out.push(...central);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory signature
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  out.push(eocd);

  const total = out.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const chunk of out) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}

// ---------------------------------------------------------------- xml helpers
const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Column letters for a 0-based index (0 -> A, 25 -> Z, 26 -> AA, ...).
function colLetter(i) {
  let s = '';
  i += 1;
  while (i > 0) {
    i -= 1;
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26);
  }
  return s;
}

function sheetXml(rows) {
  const body = rows
    .map((row, ri) => {
      const cells = row
        .map((v, ci) => {
          const ref = `${colLetter(ci)}${ri + 1}`;
          if (typeof v === 'number') {
            return `<c r="${ref}"><v>${v}</v></c>`;
          }
          const s = v === null || v === undefined ? '' : String(v);
          return `<c r="${ref}" t="inlineStr"><is><t>${esc(s)}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function sheetName(name) {
  const n = String(name || 'Sheet');
  return n.slice(0, 31);
}

// ---------------------------------------------------------------- toXlsxBlob
/**
 * Build an Excel (.xlsx) Blob from `sheets`:
 *   [{ name: string, rows: Array<Array<string|number|null>> }]
 * @returns {Blob}
 */
export function toXlsxBlob(sheets) {
  const parts = [];
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')}</Types>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
    .map((s, i) => `<sheet name="${esc(sheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')}</sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join('')}</Relationships>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;

  parts.push(['[Content_Types].xml', encoder.encode(contentTypes)]);
  parts.push(['_rels/.rels', encoder.encode(rels)]);
  parts.push(['xl/workbook.xml', encoder.encode(workbook)]);
  parts.push(['xl/_rels/workbook.xml.rels', encoder.encode(workbookRels)]);
  parts.push(['xl/styles.xml', encoder.encode(stylesXml)]);
  sheets.forEach((s, i) => {
    parts.push([`xl/worksheets/sheet${i + 1}.xml`, encoder.encode(sheetXml(s.rows || []))]);
  });

  return new Blob([zipStored(parts)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
