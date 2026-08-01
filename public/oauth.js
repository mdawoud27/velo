function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function showResult(type, title, detail) {
  const box = document.getElementById('oauth-result');
  box.className = 'oauth-result show ' + type;

  box.innerHTML = '';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const span = document.createElement('span');
  span.textContent = detail;
  box.appendChild(strong);
  box.appendChild(span);
}

async function exchangeCode(code, provider, name) {
  showResult('success', 'Exchanging login code…', 'Please wait.');

  try {
    const res = await fetch('/api/v1/auth/exchange-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const json = await res.json();
    const tokens = json.data || json;

    if (tokens.accessToken) {
      const payload = decodeJwtPayload(tokens.accessToken);
      const email = payload?.email || 'unknown';
      const displayName = name || email;
      const label = name ? displayName + ' (' + email + ')' : displayName;

      showResult('success', 'Logged in via ' + (provider || 'OAuth'), label);
    } else {
      const message = json.message || json.error?.message || 'Code exchange failed';
      showResult('error', 'Login failed', message);
    }
  } catch (err) {
    showResult('error', 'Login failed', err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const oauthError = params.get('oauth_error');
  const provider = params.get('provider');
  const name = params.get('name');

  // Handle OAuth callback redirect
  if (code) {
    window.history.replaceState({}, '', '/');
    exchangeCode(code, provider, name);
  } else if (oauthError) {
    window.history.replaceState({}, '', '/');
    showResult('error', 'Login failed', decodeURIComponent(oauthError));
  }

  // OAuth buttons: navigate directly (no popup)
  document.getElementById('google-login').addEventListener('click', () => {
    window.location.href = '/api/v1/auth/google';
  });
  document.getElementById('github-login').addEventListener('click', () => {
    window.location.href = '/api/v1/auth/github';
  });
});
