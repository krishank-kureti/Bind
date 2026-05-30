const params = new URLSearchParams(window.location.search);
if (params.get('error')) {
  const el = document.getElementById('error-msg');
  el.textContent = 'Authentication failed: ' + params.get('error');
  el.style.display = 'block';
}

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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh-quota-btn').addEventListener('click', refreshAllQuotas);
  document.getElementById('upload-btn').addEventListener('click', uploadFile);
});

loadAuthState();
