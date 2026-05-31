const params = new URLSearchParams(window.location.search);
if (params.get('error')) {
  const el = document.getElementById('error-msg');
  el.textContent = 'Authentication failed: ' + params.get('error');
  el.style.display = 'block';
}

const ACCOUNT_COLORS = ['#4285f4','#ea4335','#fbbc04','#34a853','#ff6d01','#46bdc6','#7baaf7','#ab47bc'];

function getAccountColor(email) {
  const index = email.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % ACCOUNT_COLORS.length;
  return ACCOUNT_COLORS[index];
}

let selectedFiles = new Set();
let currentFilesData = [];
let pageCursor = null;
let hasMorePages = false;
let currentQuery = '';
let currentFilter = '';

async function triggerSync(accountId, btn) {
  btn.disabled = true;
  btn.textContent = 'Syncing…';
  try {
    const res = await fetch('/api/accounts/' + accountId + '/sync', { method: 'POST' });
    if (!res.ok) throw new Error('Sync failed');
    pollStatus(accountId, btn);
  } catch {
    btn.disabled = false;
    btn.textContent = 'Retry';
  }
}

async function pollStatus(accountId, btn) {
  let attempts = 0;
  const maxAttempts = 12;
  const poll = async () => {
    try {
      const res = await fetch('/api/accounts/' + accountId + '/status');
      const body = await res.json();
      if (!body.success) return;
      const status = body.data.syncStatus;
      const badge = document.querySelector('[data-account-id="' + accountId + '"] .badge');
      if (badge) {
        badge.className = 'badge badge-' + status.toLowerCase();
        badge.textContent = status;
      }
      if (status === 'SYNCED' || status === 'ERROR' || attempts >= maxAttempts) {
        btn.disabled = false;
        btn.textContent = 'Sync';
        return;
      }
      attempts++;
      setTimeout(poll, 2000);
    } catch {
      btn.disabled = false;
      btn.textContent = 'Sync';
    }
  };
  setTimeout(poll, 2000);
}

async function removeAccount(accountId) {
  if (!confirm('Remove this account and all its indexed files?')) return;
  try {
    const res = await fetch('/api/accounts/' + accountId, { method: 'DELETE' });
    if (!res.ok) throw new Error('Remove failed');
    refreshAllQuotas();
    location.reload();
  } catch {
    alert('Failed to remove account');
  }
}

async function loadAuthState() {
  try {
    const res = await fetch('/api/auth/me');
    const body = await res.json();

    document.getElementById('loading-view').classList.add('hidden');

    if (!body.data.user) {
      document.getElementById('unauthenticated-view').classList.remove('hidden');
      return;
    }

    document.getElementById('authenticated-view').classList.remove('hidden');
    const { user, accounts } = body.data;

    document.getElementById('user-name').textContent = user.displayName || 'User';
    document.getElementById('user-email').textContent = user.email;
    if (user.avatarUrl) {
      document.getElementById('user-avatar').src = user.avatarUrl;
    }

    const list = document.getElementById('accounts-list');
    list.innerHTML = '';

    accounts.forEach(acc => {
      const div = document.createElement('div');
      div.className = 'account-item';
      div.setAttribute('data-account-id', acc.id);

      const initial = (acc.displayName || acc.email)[0].toUpperCase();
      const badgeClass = 'badge-' + (acc.syncStatus || 'pending').toLowerCase();

      div.innerHTML = `
        <div class="account-info">
          <div class="account-icon">${initial}</div>
          <div>
            <div class="account-email">${acc.email}</div>
            <div class="account-sync">
              <span class="badge ${badgeClass}">${acc.syncStatus || 'PENDING'}</span>
              ${acc.lastSyncedAt ? ' — Last sync: ' + new Date(acc.lastSyncedAt).toLocaleString() : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <button class="btn btn-outline btn-sm sync-btn">Sync</button>
          <button class="btn btn-danger btn-sm remove-btn">Remove</button>
        </div>
      `;

      const syncBtn = div.querySelector('.sync-btn');
      syncBtn.addEventListener('click', () => triggerSync(acc.id, syncBtn));

      const removeBtn = div.querySelector('.remove-btn');
      removeBtn.addEventListener('click', () => removeAccount(acc.id));

      list.appendChild(div);
    });

    refreshAllQuotas();
    loadFiles();
    loadAnalytics();
    loadDuplicates();
  } catch (err) {
    document.getElementById('loading-view').classList.add('hidden');
    document.getElementById('unauthenticated-view').classList.remove('hidden');
  }
}

async function loadStorage() {
  try {
    const res = await fetch('/api/storage');
    const body = await res.json();
    if (!body.success) return;

    const el = document.getElementById('storage-summary');
    const summary = body.data.summary;
    const freeGB = (Number(summary.freeBytes) / 1e9).toFixed(2);
    const totalGB = (Number(summary.totalBytes) / 1e9).toFixed(2);
    el.textContent = 'Free: ' + freeGB + ' GB / ' + totalGB + ' GB total';
    el.style.display = 'block';
  } catch {}
}

async function refreshAllQuotas() {
  try {
    const res = await fetch('/api/auth/me');
    const body = await res.json();
    if (!body.success || !body.data.accounts) return;

    document.getElementById('storage-summary').textContent = 'Refreshing quota...';
    for (const acc of body.data.accounts) {
      await fetch('/api/storage/' + acc.id + '/quota/refresh', { method: 'POST' });
    }
    loadStorage();
  } catch {}
}

async function uploadFile() {
  const input = document.getElementById('file-input');
  const file = input.files[0];
  if (!file) return;

  const btn = document.getElementById('upload-btn');
  const status = document.getElementById('upload-status');
  btn.disabled = true;
  status.textContent = 'Uploading...';

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const body = await res.json();
    if (!body.success) throw new Error(body.error?.message || 'Upload failed');

    const jobId = body.data.id;
    status.textContent = 'Queued — job: ' + jobId;
    input.value = '';
    pollUploadJob(jobId, status);
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    btn.disabled = false;
  }
}

function pollUploadJob(jobId, statusEl) {
  let attempts = 0;
  const maxAttempts = 30;
  const poll = async () => {
    try {
      const res = await fetch('/api/upload/' + jobId);
      const body = await res.json();
      if (!body.success) return;

      const job = body.data;
      statusEl.textContent = job.status + ' (' + job.progress + '%)';

      if (job.status === 'COMPLETE') {
        statusEl.innerHTML = 'Complete! <a href="/api/upload/' + jobId + '/download" class="btn btn-outline btn-sm" style="margin-left:4px;text-decoration:none;">Download file</a>';
        document.getElementById('upload-btn').disabled = false;
        return;
      }

      if (job.status === 'FAILED') {
        statusEl.textContent = 'Failed: ' + (job.errorMessage || 'unknown error');
        document.getElementById('upload-btn').disabled = false;
        return;
      }

      if (attempts >= maxAttempts) {
        document.getElementById('upload-btn').disabled = false;
        return;
      }

      attempts++;
      setTimeout(poll, 2000);
    } catch {
      document.getElementById('upload-btn').disabled = false;
    }
  };
  setTimeout(poll, 2000);
}

async function loadFiles(query, append) {
  const list = document.getElementById('files-list');
  if (!append) list.innerHTML = '<div class="loading">Loading files...</div>';

  currentQuery = query || '';

  try {
    let url = '/api/files?limit=50';
    if (query) url += '&query=' + encodeURIComponent(query);
    if (currentFilter === 'starred') url += '&starred=true';
    if (append && pageCursor) url += '&cursor=' + pageCursor;
    const res = await fetch(url);
    const body = await res.json();
    if (!body.success) return;

    const meta = body.meta;
    if (append) {
      currentFilesData = currentFilesData.concat(body.data || []);
    } else {
      currentFilesData = body.data || [];
      selectedFiles = new Set();
    }
    pageCursor = meta.nextCursor;
    hasMorePages = meta.hasMore;
    renderFiles();
  } catch {
    if (!append) list.innerHTML = '<div class="loading">Failed to load files.</div>';
  }
}

function renderFiles() {
  const list = document.getElementById('files-list');
  const bulkActions = document.getElementById('bulk-actions');

  if (currentFilesData.length === 0) {
    list.innerHTML = '<div class="loading">No files found. Sync an account first.</div>';
    bulkActions.style.display = 'none';
    return;
  }

  list.innerHTML = '';
  currentFilesData.forEach(file => {
    const div = document.createElement('div');
    div.className = 'file-item';

    const color = getAccountColor(file.account.email);
    const label = (file.account.displayName || file.account.email)[0].toUpperCase();
    const isChecked = selectedFiles.has(file.id);

    div.innerHTML = `
      <input type="checkbox" class="file-checkbox" data-id="${file.id}" ${isChecked ? 'checked' : ''}>
      <span class="account-chip" style="background:${color}" title="${file.account.email}">${label}</span>
      <span class="account-tag" title="${file.account.email}">${file.account.email}</span>
      <span class="file-name" title="${file.name}">${file.starred ? '⭐ ' : ''}${file.name}</span>
      <span class="file-meta">${file.size ? (Number(file.size) / 1024).toFixed(0) + ' KB' : ''}</span>
      <span class="menu-container">
        <button class="menu-trigger">···</button>
        <div class="menu-dropdown">
          <button class="menu-item rename-btn">Rename</button>
          <button class="menu-item move-btn">Move</button>
          <button class="menu-item star-btn">${file.starred ? 'Unstar' : 'Star'}</button>
          <button class="menu-item trash-btn">Trash</button>
          <button class="menu-item copy-btn">Copy</button>
          <button class="menu-item danger delete-btn">Delete</button>
        </div>
      </span>
    `;

    const checkbox = div.querySelector('.file-checkbox');
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedFiles.add(file.id);
      else selectedFiles.delete(file.id);
      updateBulkActions();
    });

    const trigger = div.querySelector('.menu-trigger');
    const dropdown = div.querySelector('.menu-dropdown');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains('open');
      closeAllMenus();
      if (!wasOpen) dropdown.classList.add('open');
    });

    dropdown.querySelector('.rename-btn').addEventListener('click', async () => {
      closeAllMenus();
      const name = prompt('New name:', file.name);
      if (!name || name === file.name) return;
      try {
        const r = await fetch('/api/files/' + file.id + '/rename', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Rename failed');
        loadFiles(document.getElementById('search-query').value);
      } catch (err) { alert(err.message); }
    });

    dropdown.querySelector('.move-btn').addEventListener('click', async () => {
      closeAllMenus();
      const folderId = prompt('Target folder ID:');
      if (!folderId) return;
      try {
        const r = await fetch('/api/files/' + file.id + '/move', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Move failed');
        loadFiles(document.getElementById('search-query').value);
      } catch (err) { alert(err.message); }
    });

    dropdown.querySelector('.star-btn').addEventListener('click', async () => {
      closeAllMenus();
      try {
        const r = await fetch('/api/files/' + file.id + '/star', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ starred: !file.starred }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Star failed');
        loadFiles(document.getElementById('search-query').value);
      } catch (err) { alert(err.message); }
    });

    dropdown.querySelector('.trash-btn').addEventListener('click', async () => {
      closeAllMenus();
      if (!confirm('Trash "' + file.name + '"?')) return;
      try {
        const r = await fetch('/api/files/' + file.id + '/trash', { method: 'POST' });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Trash failed');
        loadFiles(document.getElementById('search-query').value);
      } catch (err) { alert(err.message); }
    });

    dropdown.querySelector('.copy-btn').addEventListener('click', async () => {
      closeAllMenus();
      try {
        const r = await fetch('/api/files/' + file.id + '/copy', { method: 'POST' });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Copy failed');
        loadFiles(document.getElementById('search-query').value);
      } catch (err) { alert(err.message); }
    });

    dropdown.querySelector('.delete-btn').addEventListener('click', async () => {
      closeAllMenus();
      if (!confirm('Permanently delete "' + file.name + '"? This cannot be undone.')) return;
      try {
        const r = await fetch('/api/files/' + file.id, { method: 'DELETE' });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message || 'Delete failed');
        loadFiles(document.getElementById('search-query').value);
      } catch (err) { alert(err.message); }
    });

    list.appendChild(div);
  });

  if (hasMorePages) {
    const moreDiv = document.createElement('div');
    moreDiv.style.cssText = 'text-align:center;padding:12px 0;';
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline btn-sm';
    btn.textContent = 'Load More';
    btn.addEventListener('click', () => loadMore());
    moreDiv.appendChild(btn);
    list.appendChild(moreDiv);
  }

  updateBulkActions();
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  pageCursor = null;
  hasMorePages = false;
  loadFiles(document.getElementById('search-query').value);
}

function loadMore() {
  loadFiles(currentQuery, true);
}

function closeAllMenus() {
  document.querySelectorAll('.menu-dropdown.open').forEach(el => el.classList.remove('open'));
}

document.addEventListener('click', closeAllMenus);

function updateBulkActions() {
  const el = document.getElementById('bulk-actions');
  const countEl = document.getElementById('selected-count');
  const count = selectedFiles.size;
  if (count > 0) {
    el.style.display = 'flex';
    countEl.textContent = count + ' selected';
  } else {
    el.style.display = 'none';
  }
}

async function bulkTrash() {
  const fileIds = Array.from(selectedFiles);
  if (!confirm('Trash ' + fileIds.length + ' files?')) return;
  try {
    const r = await fetch('/api/files/batch/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds }),
    });
    if (!r.ok) throw new Error('Bulk trash failed');
    loadFiles(document.getElementById('search-query').value);
  } catch (err) {
    alert(err.message);
  }
}

async function bulkDelete() {
  const fileIds = Array.from(selectedFiles);
  if (!confirm('Permanently delete ' + fileIds.length + ' files? This cannot be undone.')) return;
  try {
    const r = await fetch('/api/files/batch/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds }),
    });
    if (!r.ok) throw new Error('Bulk delete failed');
    loadFiles(document.getElementById('search-query').value);
  } catch (err) {
    alert(err.message);
  }
}

async function loadAnalytics() {
  try {
    const [summaryRes, typesRes] = await Promise.all([
      fetch('/api/analytics/summary'),
      fetch('/api/analytics/file-types'),
    ]);
    const summaryBody = await summaryRes.json();
    const typesBody = await typesRes.json();

    if (!summaryBody.success) return;

    const data = summaryBody.data;
    const summaryEl = document.getElementById('analytics-summary');
    const typesEl = document.getElementById('analytics-file-types');

    const usedGB = (Number(data.usedStorage) / 1e9).toFixed(2);
    const totalGB = (Number(data.totalStorage) / 1e9).toFixed(2);

    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    html += '<div><strong>' + data.totalFiles + '</strong> files</div>';
    html += '<div><strong>' + data.totalFolders + '</strong> folders</div>';
    html += '<div><strong>' + data.trashedFiles + '</strong> trashed</div>';
    html += '<div><strong>' + usedGB + ' GB</strong> / ' + totalGB + ' GB used</div>';
    html += '</div>';

    if (data.accounts.length > 1) {
      html += '<div style="margin-top:8px;font-size:12px;"><strong>Per account:</strong></div>';
      data.accounts.forEach(a => {
        const aUsed = (Number(a.usedBytes) / 1e9).toFixed(2);
        html += '<div style="font-size:12px;margin-top:4px;">' + a.email + ': ' + a.fileCount + ' files, ' + aUsed + ' GB</div>';
      });
    }

    summaryEl.innerHTML = html;

    if (typesBody.success && typesBody.data.length > 0) {
      let tHtml = '<div style="margin-top:8px;font-size:12px;"><strong>File types:</strong> ';
      typesBody.data.forEach((t, i) => {
        const sizeMB = (Number(t.totalSize) / 1e6).toFixed(1);
        tHtml += t.type + ' (' + t.count + ', ' + sizeMB + ' MB)';
        if (i < typesBody.data.length - 1) tHtml += ' · ';
      });
      tHtml += '</div>';
      typesEl.innerHTML = tHtml;
    }
  } catch {}
}

async function scanDuplicates() {
  const btn = document.getElementById('scan-duplicates-btn');
  const status = document.getElementById('duplicates-status');
  btn.disabled = true;
  status.textContent = 'Scanning...';
  try {
    const r = await fetch('/api/duplicates/scan', { method: 'POST' });
    const body = await r.json();
    if (!body.success) throw new Error(body.error?.message || 'Scan failed');
    status.textContent = 'Scan queued. Checking results...';
    setTimeout(loadDuplicates, 3000);
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    btn.disabled = false;
  }
}

async function loadDuplicates() {
  const list = document.getElementById('duplicates-list');
  const status = document.getElementById('duplicates-status');
  const btn = document.getElementById('scan-duplicates-btn');

  try {
    const r = await fetch('/api/duplicates');
    const body = await r.json();
    if (!body.success) return;

    const groups = body.data;
    if (groups.length === 0) {
      list.innerHTML = '<div class="loading" style="padding:12px;">No duplicates found.</div>';
      status.textContent = '';
      btn.disabled = false;
      return;
    }

    status.textContent = groups.length + ' duplicate group(s) found';
    btn.disabled = false;
    list.innerHTML = '';

    groups.forEach(group => {
      const wasteMB = (Number(group.totalWaste) / 1e6).toFixed(1);
      const sizeKB = (Number(group.fileSize) / 1024).toFixed(0);

      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #eee;border-radius:6px;padding:10px;margin-bottom:8px;font-size:13px;';

      card.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:6px;">' +
        '<strong>' + group.fileCount + ' files</strong> ' +
        '<span style="color:#ea4335;">~' + wasteMB + ' MB waste</span>' +
        '</div>' +
        '<div style="font-size:11px;color:#888;margin-bottom:4px;">Size: ' + sizeKB + ' KB · Checksum: ' + group.checksum.slice(0, 12) + '…</div>';

      const fileList = document.createElement('div');
      fileList.style.cssText = 'font-size:12px;';

      group.duplicateFiles.forEach((df) => {
        const color = getAccountColor(df.account.email);
        const label = (df.account.displayName || df.account.email)[0].toUpperCase();
        const fileEl = document.createElement('div');
        fileEl.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 0;';
        fileEl.innerHTML = '<span class="account-chip" style="background:' + color + ';width:14px;height:14px;font-size:7px;">' + label + '</span>' +
          '<span class="account-tag" style="max-width:80px;">' + df.account.email + '</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + df.file.name + '</span>';
        card.appendChild(fileEl);
      });

      list.appendChild(card);
    });
  } catch {
    list.innerHTML = '<div class="loading" style="padding:12px;">Failed to load duplicates.</div>';
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh-quota-btn').addEventListener('click', refreshAllQuotas);
  document.getElementById('upload-btn').addEventListener('click', uploadFile);
  document.getElementById('search-btn').addEventListener('click', () => {
    loadFiles(document.getElementById('search-query').value);
  });
  document.getElementById('search-query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadFiles(e.target.value);
  });
  document.getElementById('refresh-files-btn').addEventListener('click', () => {
    loadFiles(document.getElementById('search-query').value);
  });
  document.getElementById('bulk-trash-btn').addEventListener('click', bulkTrash);
  document.getElementById('bulk-delete-btn').addEventListener('click', bulkDelete);
  document.getElementById('scan-duplicates-btn').addEventListener('click', scanDuplicates);
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });
});

loadAuthState();
