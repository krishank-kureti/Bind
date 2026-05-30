const params = new URLSearchParams(window.location.search);
if (params.get('error')) {
  const el = document.getElementById('error-msg');
  el.textContent = 'Authentication failed: ' + params.get('error');
  el.style.display = 'block';
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
        <div style="color:#888;font-size:13px;">${acc.provider}</div>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    document.getElementById('loading-view').classList.add('hidden');
    document.getElementById('unauthenticated-view').classList.remove('hidden');
  }
}

loadAuthState();
