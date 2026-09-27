import { syncCall, openExternal, native } from './api.js';

export function setupSyncSettings(settings) {
  const find = id => settings.querySelector('#' + id);
  const controls = find('sync-controls');
  if (!native) { controls.hidden = true; find('sync-status').textContent = 'Sync is available in the native app.'; return; }
  let busy = false, checking = false;
  const message = find('sync-action-message');
  async function refresh() {
    if (checking) return;
    checking = true;
    try {
      const status = await syncCall('Status');
      find('sync-status').textContent = status.message;
      find('sync-usage').textContent = status.connected ? `${(status.used / 1e6).toFixed(2)} MB / ${(status.quota / 1e9).toFixed(0)} GB (includes history)${status.lastSuccess ? ' · Last checked ' + new Date(status.lastSuccess).toLocaleTimeString() : ''}` : '';
      if (!find('sync-server').value && status.server) find('sync-server').value = status.server;
      find('sync-create').disabled = busy || !status.signedIn || status.connected;
      find('sync-connect').disabled = busy || !status.signedIn || status.connected;
      find('sync-recovery').disabled = busy || !status.signedIn;
      find('sync-disconnect').disabled = busy;
      find('sync-start').disabled = busy || status.connected;
    } catch (e) { find('sync-status').textContent = e.message || String(e); }
    finally { checking = false; }
  }
  function action(id, handler) {
    find(id).addEventListener('click', async () => {
      if (busy) return;
      busy = true; message.textContent = '';
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
  action('sync-start', async () => {
    const login = await syncCall('Start', find('sync-server').value.trim());
    find('sync-code').textContent = `Device code: ${login.code}. Approve this code on the website, then choose Check sign-in.`;
    await openExternal(login.url);
  });
  action('sync-finish', async () => { await syncCall('Finish'); find('sync-code').textContent = ''; });
  action('sync-create', async () => showKey(await syncCall('Create')));
  action('sync-connect', async () => {
    await syncCall('Connect', find('sync-join-key').value.trim());
    find('sync-join-key').value = '';
  });
  action('sync-recovery', async () => showKey(await syncCall('Recovery')));
  action('sync-disconnect', async () => { await syncCall('Disconnect'); });
  void refresh();
  setInterval(() => { if (settings.isConnected && !settings.hidden) void refresh(); }, 2000);
}
