// Storage helpers do not write to a failed read or discard recovery copies.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateRouteRecord(key, value) {
  if (key.endsWith(':journal-v1')) {
    if (!Array.isArray(value) || !value.every(item => object(item) && typeof item.id === 'string')) throw Error('방문일지 형식 확인 필요');
  } else if (key.endsWith(':place-photos-v1')) {
    if (!object(value) || !Object.values(value).every(item => object(item) && Array.isArray(item.ids))) throw Error('사진 목록 형식 확인 필요');
  } else {
    if (!object(value) || (value.places !== undefined && !Array.isArray(value.places)) || (value.routes !== undefined && !object(value.routes))) throw Error('동선 기록 형식 확인 필요');
  }
  return value;
}
export function readRouteRecord(storage, key, fallback) {
  const raw = storage.getItem(key);
  return raw === null ? fallback : validateRouteRecord(key, JSON.parse(raw));
}
// Derive each update from the latest persisted list AFTER file uploads finish.
export function updateRouteRecord(storage, key, fallback, change) {
  const current = readRouteRecord(storage, key, fallback);
  const next = validateRouteRecord(key, change(current));
  storage.setItem(key, JSON.stringify(next));
  return next;
}

export function parseRouteMemo(text, previous = [], makeId = () => crypto.randomUUID()) {
  const entries = [], memo = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(\s*)- (.*)$/);
    if (match) entries.push({ title: match[2].trim(), level: Math.min(3, Math.floor(match[1].length / 2)) });
    else memo.push(line);
  }
  // Reserve exact matches first so inserting a row cannot steal another row's ID.
  const assigned = new Map(), used = new Set();
  entries.forEach((entry, i) => {
    const same = previous.filter(node => !used.has(node.id) && node.title === entry.title && (node.level || 0) === entry.level);
    const prior = same.find(node => previous.indexOf(node) === i) || same[0];
    if (prior) { assigned.set(i, prior); used.add(prior.id); }
  });
  // A title edit at an existing position keeps its identity, photos and done state.
  entries.forEach((entry, i) => {
    const prior = previous[i];
    if (!assigned.has(i) && prior && !used.has(prior.id) && (prior.level || 0) === entry.level) {
      assigned.set(i, prior); used.add(prior.id);
    }
  });
  const parents = [], checklist = entries.map((entry, i) => {
    const prior = assigned.get(i);
    const node = { ...prior, id: prior?.id || makeId(), parentId: entry.level ? parents[entry.level - 1] || null : null, level: entry.level, title: entry.title, done: !!prior?.done };
    parents[entry.level] = node.id; parents.length = entry.level + 1;
    return node;
  });
  return { notes: memo.join('\n').trim(), checklist };
}

export function openRouteMetadata() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('focus-route-metadata-v1', 2);
    request.onupgradeneeded = () => {
      for (const name of ['snapshots', 'recovery']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('다른 탭을 닫은 뒤 저장을 다시 시도해 주세요.'));
  });
}
export async function readRouteMirror(key) {
  const db = await openRouteMetadata();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readonly');
      const request = tx.objectStore('snapshots').get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
const mirrorQueues = new Map();
export function mirrorRouteMetadata(key, raw, { startup = false } = {}) {
  // Validation precedes every write, including automatic startup imports.
  try { validateRouteRecord(key, JSON.parse(raw)); } catch (error) { return Promise.reject(error); }
  const pending = (mirrorQueues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    const db = await openRouteMetadata();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['snapshots', 'recovery'], 'readwrite');
        const snapshots = tx.objectStore('snapshots'), recovery = tx.objectStore('recovery');
        const request = snapshots.get(key);
        request.onsuccess = () => {
          const before = request.result;
          if (before === raw) return;
          // Retain both versions; startup never replaces an existing mirror.
          if (before !== undefined) recovery.put(before, key + ':' + crypto.randomUUID());
          let beforeValid=false;
          try { if(before !== undefined){validateRouteRecord(key,JSON.parse(before));beforeValid=true;} } catch {}
          if (startup && beforeValid) recovery.put(raw, key + ':import:' + crypto.randomUUID());
          else snapshots.put(raw, key);
        };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
    if (!startup && await readRouteMirror(key) !== raw) throw Error('ROUTE IndexedDB 검증 실패');
  });
  mirrorQueues.set(key, pending);
  return pending;
}
