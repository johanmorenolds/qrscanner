import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { ScanRecord } from '../types'

type ScanDB = DBSchema & {
  scans: {
    key: number
    value: ScanRecord & { id: number }
    indexes: {
      scannedAt: string
    }
  }
}

const DB_NAME = 'qrscanner_db'
const DB_VERSION = 1
const STORE_NAME = 'scans'

let dbPromise: Promise<IDBPDatabase<ScanDB>> | null = null

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<ScanDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('scannedAt', 'scannedAt')
      },
    })
  }

  return dbPromise
}

export const listScans = async (): Promise<Array<ScanRecord & { id: number }>> => {
  const db = await getDB()
  const items = await db.getAll(STORE_NAME)
  return items.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
}

export const addScan = async (scan: ScanRecord): Promise<ScanRecord & { id: number }> => {
  const db = await getDB()
  const id = await db.add(STORE_NAME, scan as ScanRecord & { id: number })
  return { ...scan, id }
}

export const deleteScan = async (id: number): Promise<void> => {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}

export const clearScans = async (): Promise<void> => {
  const db = await getDB()
  await db.clear(STORE_NAME)
}
