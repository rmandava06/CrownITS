/**
 * generate-lca-manifest.js
 *
 * Scans public/lca/ for PDF files and writes src/data/lca-files.json.
 * Run automatically via the "prebuild" npm script.
 *
 * Filename convention (optional but recommended):
 *   {Role-With-Hyphens}_{STATE}_{YEAR}-Certified-LCA.pdf
 *   e.g. Software-Developer_OH_2025-Certified-LCA.pdf
 *        → "Software Developer — OH 2025"
 */

const fs   = require('fs')
const path = require('path')

const lcaDir    = path.join(__dirname, '../public/lca')
const outputDir = path.join(__dirname, '../src/data')
const outputFile = path.join(outputDir, 'lca-files.json')

// Ensure output directory exists
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

// Ensure lca directory exists
if (!fs.existsSync(lcaDir)) {
  fs.mkdirSync(lcaDir, { recursive: true })
  fs.writeFileSync(outputFile, JSON.stringify([], null, 2))
  console.log('ℹ  public/lca/ created (empty). Add PDFs there to publish them.')
  process.exit(0)
}

function parseFilename(filename) {
  // Strip known suffix variants
  const base = filename
    .replace(/-Certified-LCA\.pdf$/i, '')
    .replace(/\.pdf$/i, '')

  // Expect pattern: Role_STATE_YEAR or Role_STATE_YEAR-anything
  const parts = base.split('_')

  if (parts.length >= 3) {
    const role  = parts[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const state = parts[1].toUpperCase()
    const year  = parts[2].replace(/-.*$/, '') // strip trailing junk like "-Certified"
    return {
      displayName: `${role} \u2014 ${state} ${year}`,
      state,
      year: parseInt(year, 10) || 0,
    }
  }

  // Fallback: humanise the raw filename
  return {
    displayName: base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    state: '',
    year: 0,
  }
}

const files = fs.readdirSync(lcaDir)
  .filter(f => f.toLowerCase().endsWith('.pdf'))
  .sort()

const entries = files.map(filename => {
  const { displayName, state, year } = parseFilename(filename)
  return { filename, displayName, state, year }
})

// Sort: newest year first, then alphabetical
entries.sort((a, b) => b.year - a.year || a.displayName.localeCompare(b.displayName))

fs.writeFileSync(outputFile, JSON.stringify(entries, null, 2))
console.log(`✓  lca-files.json updated — ${entries.length} file(s) found in public/lca/`)
