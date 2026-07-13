import { patchState, getState } from './store.js'
import { DEFAULT_BOOKS } from './defaults.js'

export function listBatches() {
  return getState().batches
}

export function setBatches(batches) {
  if (!Array.isArray(batches) || batches.length === 0) {
    throw new Error('At least one batch is required')
  }
  return patchState((s) => {
    s.batches = batches.map((b, i) => ({
      id: String(b.id || `batch${i + 1}`),
      name: String(b.name || `Batch ${i + 1}`),
      books: Array.isArray(b.books)
        ? [...new Set(b.books.map(String).filter(Boolean))]
        : []
    }))
  })
}

export function replaceBatchesFromCount(count, bookAssignment) {
  const n = Math.max(1, Math.min(20, Math.floor(Number(count)) || 1))
  const books = Array.isArray(bookAssignment) ? bookAssignment : null
  return patchState((s) => {
    if (books && books.length === n) {
      s.batches = books.map((b, i) => ({
        id: `batch${i + 1}`,
        name: b.name || `Batch ${i + 1}`,
        books: Array.isArray(b.books) ? b.books : []
      }))
      return
    }
    // Even split of default/known books
    const all = [...DEFAULT_BOOKS]
    const batches = []
    for (let i = 0; i < n; i++) {
      batches.push({ id: `batch${i + 1}`, name: `Batch ${i + 1}`, books: [] })
    }
    all.forEach((book, idx) => {
      batches[idx % n].books.push(book)
    })
    s.batches = batches
  })
}

export function booksInBatches() {
  const set = new Set()
  for (const b of getState().batches) {
    for (const book of b.books || []) set.add(book)
  }
  return [...set]
}
