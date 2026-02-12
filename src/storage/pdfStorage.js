import { supabase } from '../lib/supabase';

const BUCKET = 'pdfs';

// ── Supabase implementation ──

async function savePdfRemote(key, arrayBuffer) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, arrayBuffer, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;
}

async function loadPdfRemote(key) {
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error) {
    if (error.message?.includes('not found') || error.statusCode === 404) return null;
    throw error;
  }
  return await data.arrayBuffer();
}

async function deletePdfRemote(key) {
  const { error } = await supabase.storage.from(BUCKET).remove([key]);
  if (error) throw error;
}

// ── Local IndexedDB fallback ──

const DB_NAME = 'cowork-proposals';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePdfLocal(key, arrayBuffer) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(arrayBuffer, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadPdfLocal(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deletePdfLocal(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Exports: use Supabase if available, else local ──

export const savePdf = supabase ? savePdfRemote : savePdfLocal;
export const loadPdf = supabase ? loadPdfRemote : loadPdfLocal;
export const deletePdf = supabase ? deletePdfRemote : deletePdfLocal;
