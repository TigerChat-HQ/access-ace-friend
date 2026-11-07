importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging().onBackgroundMessage(payload => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || 'TIGERCHATS', {
    body: data.body || 'New activity', icon: '/pwa-icon-192.png', tag: data.tag,
    silent: false, requireInteraction: data.kind === 'call',
    data: { url: data.path || '/chats' },
  });
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.url || '/chats';
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(clients.openWindow(url.href));
});