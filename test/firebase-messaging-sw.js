importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA0K4geAuueVfiItB_98-LkqRTnpYNUNvM",
  authDomain: "gameparadise-80490.firebaseapp.com",
  projectId: "gameparadise-80490",
  messagingSenderId: "335620903527",
  appId: "1:335620903527:web:1bc1e01a386bf6e4e7fac2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    self.registration.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: "https://jappie716.github.io/icon/favicon.png"
    });
});
