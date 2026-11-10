importScripts('https://www.gstatic.com/firebasejs/13.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging-compat.js');
firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging().onBackgroundMessage(payload => {
  const data = payload.data || {};
  return self.registration.showNotification(data.title || 'TIGERCHATS', {
    body: data.body || 'New activity', icon: '/pwa-icon-192.png', tag: data.tag,
    silent: false, renotify: !!data.tag, vibrate: data.kind === 'call' ? [300, 150, 300, 150, 300] : [200], requireInteraction: data.kind === 'call',
    data: { url: data.path || '/chats' },
  });
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.url || '/chats';
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === url.origin);
    if (existing) {
      await existing.navigate(url.href);
      return existing.focus();
    }
    return clients.openWindow(url.href);
  })());
});