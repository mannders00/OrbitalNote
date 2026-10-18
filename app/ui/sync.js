import { syncCall, openExternal, native } from './api.js';

export function setupSyncSettings(settings) {
  const find = id => settings.querySelector('#' + id);
  const controls = find('sync-controls');
  if (!native) { controls.hidden = true; find('sync-status').textContent = 'Sync is available in the native app.'; return; }
  let busy = false, checking = false, awaitingApproval = false;
  const message = find('sync-action-message');
  const hostedURL = 'https://sync.orbitalnote.org';
  let savedServer = '';
  function selectedServer() {
    const value = savedServer || (find('sync-provider').value === 'hosted' ? hostedURL : find('sync-server').value.trim());
    const url = new URL(value);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Enter an HTTPS server origin, such as https://sync.example.com');
    return url.origin;
  }
  function updateProvider() {
    const custom = find('sync-provider').value === 'self-hosted';
    find('sync-server-field').hidden = !custom;
    find('sync-start').textContent = custom ? 'Sign in to your server' : 'Sign in to OrbitalNote';
    find('sync-account').textContent = custom ? 'Create account / manage devices' : 'Create account / manage subscription';
  }
  find('sync-provider').addEventListener('change', updateProvider);
  async function refresh() {
    if (checking) return;
    checking = true;
    try {
      const status = await syncCall('Status');
      savedServer = status.signedIn ? status.server : '';
      if (savedServer) {
        find('sync-provider').value = savedServer === hostedURL ? 'hosted' : 'self-hosted';
        find('sync-server').value = savedServer === hostedURL ? '' : savedServer;
      }
      find('sync-provider').disabled = find('sync-server').disabled = busy || status.signedIn || awaitingApproval;
      updateProvider();
      find('sync-status').textContent = status.message;
      find('sync-usage').textContent = status.connected ? `${(status.used / 1e6).toFixed(2)} MB / ${(status.quota / 1e9).toFixed(0)} GB (includes history)${status.lastSuccess ? ' · Last checked ' + new Date(status.lastSuccess).toLocaleTimeString() : ''}` : '';
      find('sync-workspace-setup').hidden = !status.signedIn || status.connected;
      find('sync-recovery').hidden = !status.signedIn;
      find('sync-disconnect').hidden = !status.signedIn && !awaitingApproval;
      find('sync-finish').hidden = !awaitingApproval;
      find('sync-create').disabled = busy || !status.signedIn || status.connected;
      find('sync-connect').disabled = busy || !status.signedIn || status.connected;
      find('sync-recovery').disabled = busy || !status.signedIn;
      find('sync-disconnect').disabled = busy;
      find('sync-start').disabled = busy || status.signedIn || awaitingApproval;
      find('sync-finish').disabled = busy;
    } catch (e) { find('sync-status').textContent = e.message || String(e); }
    finally { checking = false; }
  }
  function action(id, handler) {
    find(id).addEventListener('click', async () => {
      if (busy) return;
      busy = true; message.textContent = ''; void refresh();
      try { await handler(); } catch (e) { message.textContent = e.message || String(e); }
      finally { busy = false; await refresh(); }
    });
  }
  function showKey(key) {
    find('sync-key').value = key;
    find('sync-key-dialog').showModal();
    find('sync-key').select();
  }
  find('sync-key-dialog').addEventListener('close', () => { find('sync-key').value = ''; });
  action('sync-account', () => openExternal(selectedServer() + '/'));
  action('sync-start', async () => {
    const login = await syncCall('StartServer', selectedServer());
    awaitingApproval = true;
    find('sync-code').textContent = `Device code: ${login.code}. Approve this code in your browser, then return here. Sign-in will finish automatically.`;
    await openExternal(login.url);
  });
  async function finishSignIn() {
    await syncCall('Finish'); awaitingApproval = false;
    find('sync-code').textContent = '';
    message.textContent = 'Signed in. Set up your first device or connect with your recovery key below.';
  }
  action('sync-finish', finishSignIn);
  action('sync-create', async () => showKey(await syncCall('Create')));
  action('sync-connect', async () => {
    await syncCall('Connect', find('sync-join-key').value.trim());
    find('sync-join-key').value = '';
  });
  action('sync-recovery', async () => showKey(await syncCall('Recovery')));
  action('sync-disconnect', async () => { await syncCall('Disconnect'); awaitingApproval = false; find('sync-code').textContent = ''; find('sync-join-key').value = ''; });
  void refresh();
  setInterval(async () => {
    if (document.hidden || !settings.isConnected || settings.hidden) return;
    if (awaitingApproval && !busy) {
      busy = true;
      try { await finishSignIn(); }
      catch (e) {
        const text = e.message || String(e);
        if (!text.includes('approve the device code on the website first')) {
          awaitingApproval = false; find('sync-code').textContent = '';
          message.textContent = `${text}. Choose Sign in to try again.`;
        }
      } finally { busy = false; }
    }
    void refresh();
  }, 2000);
}
