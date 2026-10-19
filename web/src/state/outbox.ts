// OFFL-3: queued field actions live in IndexedDB so they survive reloads, closed tabs and a dead battery.
import type { OutboxItem } from '../types'

const STORE = 'outbox'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('evacfit', 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const req = op(d.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const outboxAll = async () => (await run<OutboxItem[]>('readonly', (s) => s.getAll())).sort((a, b) => a.at.localeCompare(b.at))
export const outboxPut = (item: OutboxItem) => run('readwrite', (s) => s.put(item))
export const outboxDelete = (id: string) => run('readwrite', (s) => s.delete(id))
