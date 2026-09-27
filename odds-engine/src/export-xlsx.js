import { crc32, deflateRawSync } from 'node:zlib'

const COLUMNS = [
  ['sportsbook', 'Sportsbook'],
  ['sport', 'Sport'],
  ['league', 'League'],
  ['away_team', 'Away'],
  ['home_team', 'Home'],
  ['market_type', 'Market'],
  ['outcome_name', 'Outcome'],
  ['line_value', 'Line'],
  ['odds_american', 'American odds'],
  ['odds_decimal', 'Decimal odds'],
  ['share_price', 'Share price'],
  ['max_stake_usd', 'Max stake USD'],
  ['is_live', 'Live'],
  ['commence_time', 'Start'],
  ['event_id', 'Event id'],
  ['bookmaker_link', 'Link']
]

const NUMBER_KEYS = new Set(['line_value', 'odds_american', 'odds_decimal', 'share_price', 'max_stake_usd'])

function u16(n) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}

function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0)
  return b
}

function zipStore(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name)
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data)
    const compressed = deflateRawSync(data)
    const crc = crc32(data) >>> 0
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      compressed
    ])
    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(crc),
      u32(compressed.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralBuf.length),
    u32(offset),
    u16(0)
  ])
  return Buffer.concat([...locals, centralBuf, end])
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function colName(index) {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function cellXml(ref, value, header) {
  if (header) {
    return `<c r="${ref}" t="inlineStr" s="1"><is><t>${escapeXml(value)}</t></is></c>`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  if (value == null || value === '') return ''
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function formatStart(value) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (Number.isFinite(n) && n > 1e11) {
    const d = new Date(n)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return String(value)
}

function cellValue(entry, key) {
  if (key === 'is_live') return entry.is_live ? 'Yes' : 'No'
  if (key === 'commence_time') return formatStart(entry.commence_time)
  const value = entry[key]
  if (NUMBER_KEYS.has(key)) {
    if (value == null || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return value == null ? '' : String(value)
}

function sheetXml(entries) {
  const lastCol = colName(COLUMNS.length - 1)
  const lastRow = entries.length + 1
  const rows = []
  const header = COLUMNS.map(([, label], i) => cellXml(`${colName(i)}1`, label, true)).join('')
  rows.push(`<row r="1">${header}</row>`)
  entries.forEach((entry, rowIndex) => {
    const r = rowIndex + 2
    const cells = COLUMNS.map(([key], i) => cellXml(`${colName(i)}${r}`, cellValue(entry, key), false)).join('')
    rows.push(`<row r="${r}">${cells}</row>`)
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastCol}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetData>${rows.join('')}</sheetData>
<autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`
}

function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''))
}

export function snapshotToXlsx(entries) {
  const rows = [...(entries || [])].sort((a, b) =>
    compareText(a.sportsbook, b.sportsbook) ||
    compareText(a.sport, b.sport) ||
    compareText(a.league, b.league) ||
    compareText(a.away_team, b.away_team) ||
    compareText(a.home_team, b.home_team) ||
    compareText(a.market_type, b.market_type) ||
    compareText(a.outcome_name, b.outcome_name)
  )
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Odds" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  return zipStore([
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    { name: 'xl/workbook.xml', data: workbook },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml(rows) }
  ])
}
