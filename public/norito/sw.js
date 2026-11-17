/* 祝詞アプリの service worker：通知と、電波がないときの最低限の表示 */
const CACHE = "norito-v1";
const SHELL = ["/norito", "/norito/icon-192.png", "/norito/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("norito-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// ページは電波があれば最新、なければ前回の表示。祝詞の音声などは一度聞いたら手元に残す。
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" && url.pathname.startsWith("/norito")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/norito"))),
    );
    return;
  }
  if (url.pathname === "/api/norito/content") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req)),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "祝詞", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "祝詞";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/norito/icon-192.png",
      badge: "/norito/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/norito" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/norito";
  const abs = new URL(target, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      if (abs.startsWith(self.location.origin)) {
        for (const c of list) {
          if (c.url.startsWith(self.location.origin + "/norito") && "focus" in c) {
            c.postMessage({ type: "navigate", url: abs });
            return c.focus();
          }
        }
      }
      return self.clients.openWindow(abs);
    }),
  );
});
