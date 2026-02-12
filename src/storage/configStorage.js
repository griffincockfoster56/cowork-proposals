import { supabase } from '../lib/supabase';

const TABLE = 'configs';

// ── Supabase implementation ──

async function listConfigsRemote() {
  const { data, error } = await supabase.from(TABLE).select('data');
  if (error) throw error;
  return (data || []).map(row => row.data);
}

async function loadConfigRemote(id) {
  const { data, error } = await supabase.from(TABLE).select('data').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data?.data || null;
}

async function saveConfigRemote(config) {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ id: config.id, data: config }, { onConflict: 'id' });
  if (error) throw error;
}

async function deleteConfigRemote(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

// ── Local localStorage fallback ──

const STORAGE_KEY = 'cowork-template-configs';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(configs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

async function listConfigsLocal() {
  return Object.values(readAll());
}

async function loadConfigLocal(id) {
  return readAll()[id] || null;
}

async function saveConfigLocal(config) {
  const all = readAll();
  all[config.id] = config;
  writeAll(all);
}

async function deleteConfigLocal(id) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}

// ── Exports: use Supabase if available, else local ──

export const listConfigs = supabase ? listConfigsRemote : listConfigsLocal;
export const loadConfig = supabase ? loadConfigRemote : loadConfigLocal;
export const saveConfig = supabase ? saveConfigRemote : saveConfigLocal;
export const deleteConfig = supabase ? deleteConfigRemote : deleteConfigLocal;
