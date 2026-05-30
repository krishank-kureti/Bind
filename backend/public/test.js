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
    // Poll status a few times
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
        <div>
          <button class="btn btn-outline btn-sm sync-btn">Sync</button>
          <span style="color:#888;font-size:13px;margin-left:8px;">${acc.provider}</span>
        </div>
      `;

      const syncBtn = div.querySelector('.sync-btn');
      syncBtn.addEventListener('click', () => triggerSync(acc.id, syncBtn));

      list.appendChild(div);
    });
  } catch (err) {
    document.getElementById('loading-view').classList.add('hidden');
    document.getElementById('unauthenticated-view').classList.remove('hidden');
  }
}

loadAuthState();
