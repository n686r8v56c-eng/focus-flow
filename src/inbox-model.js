export function youtubeId(value) {
  try {
    const u = new URL(value);
    let id = '';
    if (u.hostname === 'youtu.be') id = u.pathname.split('/')[1];
    else if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname))
      id = u.searchParams.get('v') || (/^\/(shorts|live|embed)\//.test(u.pathname) ? u.pathname.split('/')[2] : '');
    return /^[\w-]{11}$/.test(id || '') ? id : '';
  } catch { return ''; }
}
export function linksIn(text) {
  return [...new Set((text.match(/https?:\/\/[^\s<>"']+/g) || []).map(s => s.replace(/[),.;!?]+$/, '')))];
}
// Keep completion in the original text so editing, copying, backup and sync agree.
export function inboxTextLines(text = '') {
  return text.split(/\r?\n/).map((raw, index) => {
    const match = raw.match(/^(\s*)-(?:[ \t]+(.*)|[ \t]*)$/);
    if (!match) return {index, text:raw, checklist:false};
    const content = match[2] || '';
    const marker = content.match(/^\[([ xX])\](?:[ \t]+(.*)|$)/);
    return {index, text:marker ? marker[2] || '' : content, checklist:true, checked:!!marker && marker[1].toLowerCase() === 'x'};
  });
}
export function toggleInboxTextLine(text, index) {
  const line = inboxTextLines(text)[index];
  if (!line?.checklist) return text;
  const lines = text.split(/\r?\n/);
  const indent = lines[index].match(/^\s*/)[0];
  lines[index] = `${indent}- [${line.checked ? ' ' : 'x'}]${line.text ? ' ' + line.text : ''}`;
  return lines.join(text.includes('\r\n') ? '\r\n' : '\n');
}
export function makeInboxItems(text, makeId, now = new Date().toISOString()) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const urls = linksIn(trimmed);
  // One card per link for link-only pastes; preserve prose and its links together.
  const residue = urls.reduce((s,u) => s.replace(u,''), trimmed).trim();
  const contents = urls.length > 1 && !residue ? urls : [trimmed];
  return contents.map(content => {
    const url = linksIn(content)[0] || '', videoId = youtubeId(url);
    return {id:makeId(), text:content, title:content === url ? (videoId ? '유튜브 영상' : new URL(url).hostname) : content.split('\n')[0], url, videoId, folderId:'', archived:false, createdAt:now};
  });
}
export function isSchedule(task) {
  return task.entryType === 'schedule' || (!task.entryType && Boolean(task.time));
}
export function inboxEntries(data) {
  return [...(data.inboxItems || []), ...data.tasks.filter(t => !t.due && !t.sourceInboxId && !isSchedule(t)).map(t => ({...t, legacyTask:true, text:t.title, url:t.url || linksIn(t.title || '')[0] || '', videoId:t.videoId || youtubeId(t.url || ''), archived:!!t.inboxArchived}))];
}
export function planInboxItem(data, entry, date) {
  if (entry.legacyTask) return {...data, tasks:data.tasks.map(t => t.id === entry.id ? {...t, due:date, entryType:'todo', status:t.status === 'done' ? 'todo' : t.status, completedAt:null} : t)};
  const id = `inbox:${entry.id}:${date}`;
  if (data.tasks.some(t => t.id === id || (t.sourceInboxId === entry.id && t.due === date))) return data;
  return {...data, tasks:[...data.tasks, {id, sourceInboxId:entry.id, title:entry.title || entry.text.split('\n')[0], note:entry.text, url:entry.url || '', videoId:entry.videoId || '', folderId:entry.folderId || '', projectId:'', taskScope:'personal', entryType:'todo', due:date, time:'', status:'todo', subtasks:[], createdAt:new Date().toISOString(), completedAt:null}]};
}
