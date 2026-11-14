// Private, content-addressed backups. Never delete an IndexedDB original.
import {validateRouteRecord, mirrorRouteMetadata} from './route-safety.js';
export const ROUTE_BUCKET = 'Route_photos';
const keys = id => { const key = 'focus-route-flow-v1:' + id; return [key, key + ':journal-v1', key + ':place-photos-v1']; };
export const hashBlob = async blob => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
const hashJSON = value => hashBlob(new Blob([JSON.stringify(value)]));
export function collectRouteImageIds(records) {
  const ids = new Set();
  for (const [key, raw] of Object.entries(records)) {
    const value = validateRouteRecord(key, JSON.parse(raw));
    if (key.endsWith(':place-photos-v1')) Object.values(value).forEach(p => (p.ids || []).forEach(id => ids.add(id)));
    else if (key.endsWith(':journal-v1')) value.forEach(p => (p.photoIds || []).forEach(id => ids.add(id)));
    else {
      for (const day of Object.values(value.visits || {})) for (const p of Object.values(day)) for (const n of p.checklist || []) ids.add(n.id);
      for (const p of value.places || []) for (const n of p.checklist || []) ids.add(n.id);
      for (const p of Object.values(value.legacyPlaceVisits || {})) for (const n of p.checklist || []) ids.add(n.id);
    }
  }
  return [...ids];
}
function imageDb() { return new Promise((resolve, reject) => { const r = indexedDB.open('focus-route-images-v1', 1); r.onupgradeneeded = () => r.result.createObjectStore('images'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
export async function readRouteImage(id) { const db = await imageDb(); try { return await new Promise((resolve, reject) => { const r = db.transaction('images', 'readonly').objectStore('images').get(id); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); } finally { db.close(); } }
async function keepImage(id, blob) { const db = await imageDb(); try { await new Promise((resolve, reject) => { const tx = db.transaction('images', 'readwrite'); const store = tx.objectStore('images'), r = store.get(id); r.onsuccess = () => { if (r.result === undefined) store.add(blob, id); }; tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); }); } finally { db.close(); } }
const pending = new Map();
export function backupRoute(client, userId, options = {}) {
  if (!client || !userId) return Promise.resolve({status:'unavailable'});
  if (pending.has(userId)) return pending.get(userId);
  const task = (async () => {
    const storage = options.storage || localStorage, readImage = options.readImage || readRouteImage;
    const day = options.day || new Date().toLocaleDateString('en-CA');
    const stateKey = keys(userId)[0] + ':backup-state-v1';
    const state = JSON.parse(storage.getItem(stateKey) || '{}');
    const records = {};
    for (const key of keys(userId)) { const raw = storage.getItem(key); if (raw !== null) { validateRouteRecord(key, JSON.parse(raw)); records[key] = raw; } }
    if (!Object.keys(records).length) return {status:'empty'};
    const sourceStamp = await hashJSON({records, imageRevision:storage.getItem('route-image-revision')});
    if (state.day === day) return {status:state.sourceStamp === sourceStamp?'saved':'waiting', at:state.at};
    const bucket = client.storage.from(ROUTE_BUCKET), images = [];
    // Missing optional checklist photos are normal; missing referenced gallery files are not.
    const required = new Set();
    for (const [key, raw] of Object.entries(records)) { const v = JSON.parse(raw); if (key.endsWith(':journal-v1')) v.forEach(x => (x.photoIds || []).forEach(id => required.add(id))); if (key.endsWith(':place-photos-v1')) Object.values(v).forEach(x => (x.ids || []).forEach(id => required.add(id))); }
    for (const id of collectRouteImageIds(records)) {
      const blob = await readImage(id);
      if (!blob) { if (required.has(id)) throw Error('원본 사진을 찾지 못해 백업을 중단했어요: ' + id); continue; }
      const sha256 = await hashBlob(blob), path = userId + '/' + sha256;
      images.push({id, path, sha256, size:blob.size, type:blob.type});
    }
    const fingerprint = await hashJSON({records, images});
    if (state.fingerprint === fingerprint) return {status:'saved', at:state.at};
    const {data:remote, error:readError} = await client.from('route_backups').select('snapshot,updated_at').eq('user_id', userId).maybeSingle();
    if (readError) throw readError;
    // Never silently overwrite another device's backup, including the first run here.
    if (remote && remote.snapshot?.fingerprint !== state.fingerprint && remote.snapshot?.fingerprint !== fingerprint) throw Error('다른 기기의 ROUTE 백업이 있어요. 기존 기록과 백업을 보존하고 자동 덮어쓰기를 중단했어요.');
    {
      for (const image of images) {
        // Reuse unchanged verified objects; upload only new content.
        let uploadError;
        if (!remote?.snapshot?.images?.some(x => x.sha256 === image.sha256)) {
          const blob = await readImage(image.id);
          const {error} = await bucket.upload(image.path, blob, {upsert:false, contentType:image.type || 'application/octet-stream'});
          uploadError = error;
        }
        const {data:download, error} = await bucket.download(image.path);
        if (error) throw uploadError || error;
        if (!download || download.size !== image.size || await hashBlob(download) !== image.sha256) throw Error('사진 업로드 검증 실패. 기기의 원본은 유지했어요.');
      }
      if (remote?.snapshot?.fingerprint !== fingerprint) {
      const snapshot = {version:1, records, images, fingerprint};
      const at = new Date(Math.max(Date.now(), Date.parse(remote?.updated_at || '') + 1 || 0)).toISOString();
      const query = remote ? client.from('route_backups').update({snapshot, snapshot_version:1, updated_at:at}).eq('user_id', userId).eq('updated_at',remote.updated_at) : client.from('route_backups').insert({user_id:userId,snapshot,snapshot_version:1,updated_at:at});
      const result = await query.select('updated_at');
      if (result.error) throw result.error;
      if (!result.data?.length) throw Error('백업이 다른 기기에서 변경됐어요. 원본은 유지했어요.');
      const checked = await client.from('route_backups').select('snapshot,updated_at').eq('user_id',userId).maybeSingle();
      if (checked.error) throw checked.error;
      if (checked.data?.snapshot?.fingerprint !== fingerprint) throw Error('백업 기록 검증 실패. 완료로 표시하지 않았어요.');
      }
    }
    const at = new Date().toISOString();
    storage.setItem(stateKey, JSON.stringify({day, at, fingerprint, sourceStamp}));
    return {status:'saved', at};
  })().finally(() => pending.delete(userId));
  pending.set(userId,task); return task;
}
export async function restoreRoute(client, userId) {
  const localKeys = keys(userId);
  // Restoration is for an empty device. Existing records and originals are never replaced.
  const original = Object.fromEntries(localKeys.map(key => [key,localStorage.getItem(key)]));
  for (const key of localKeys) {
    const raw = original[key];
    if (raw !== null) {
      const value = validateRouteRecord(key,JSON.parse(raw));
      const meaningful = Array.isArray(value) ? value.length : key.endsWith(':place-photos-v1') ? Object.keys(value).length : (value.places?.length || Object.keys(value.routes || {}).length || Object.keys(value.visits || {}).length || value.folders?.length || Object.keys(value.legacyPlaceVisits || {}).length);
      if (meaningful) throw Error('이 기기에 ROUTE 기록이 있어 덮어쓰지 않았어요. 빈 기기에서 복구해 주세요.');
    }
  }
  const {data:row,error} = await client.from('route_backups').select('snapshot').eq('user_id',userId).maybeSingle();
  if (error) throw error;
  const snapshot = row?.snapshot;
  if (snapshot?.version !== 1 || !snapshot.records || !Array.isArray(snapshot.images)) throw Error('복구 가능한 ROUTE 백업이 없어요.');
  if (await hashJSON({records:snapshot.records,images:snapshot.images}) !== snapshot.fingerprint) throw Error('백업 무결성 검증 실패');
  for (const [key,raw] of Object.entries(snapshot.records)) { if (!localKeys.includes(key)) throw Error('다른 사용자의 백업 경로예요.'); validateRouteRecord(key,JSON.parse(raw)); }
  for (const image of snapshot.images) {
    if (image.path !== userId + '/' + image.sha256) throw Error('잘못된 사진 경로예요.');
    const {data:blob,error} = await client.storage.from(ROUTE_BUCKET).download(image.path);
    if (error) throw error;
    if (!blob || blob.size !== image.size || await hashBlob(blob) !== image.sha256) throw Error('복구 사진 검증 실패');
    const old = await readRouteImage(image.id);
    if (old && await hashBlob(old) !== image.sha256) throw Error('이 기기의 사진 원본과 충돌해 복구를 중단했어요.');
    await keepImage(image.id,blob);
    if (await hashBlob(await readRouteImage(image.id)) !== image.sha256) throw Error("복구 사진의 기기 저장 검증 실패");
  }
  // Recheck after all downloads; the user may have added local data while waiting.
  const before = Object.fromEntries(localKeys.map(k => [k,localStorage.getItem(k)]));
  for (const key of localKeys) if (before[key] !== original[key]) throw Error('복구 중 기기 기록이 변경됐어요. 원본을 보존했어요.');
  for (const [key,raw] of Object.entries(snapshot.records)) await mirrorRouteMetadata(key,raw);
  try { for (const [key,raw] of Object.entries(snapshot.records)) localStorage.setItem(key,raw); }
  catch (error) { for (const [key,raw] of Object.entries(before)) { if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key,raw); } throw error; }
  return {status:'restored'};
}
