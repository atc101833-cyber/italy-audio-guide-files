
const V="italy-guide-v33",CORE=V+"-core",PREFIX="italy-guide-v29-city-";
const CORE_ASSETS=["./", "./index.html", "./offline.html", "./manifest.json", "./cover.jpg", "./italy-pattern-background.jpg", "./player-skin-clean.png", "./milan.jpg", "./venice.jpg", "./florence.jpg", "./rome.jpg", "./offline-final-panel-v29.png"];
const CITY_ASSETS={"milan": ["./exterior-01.jpg", "./exterior-02.jpg", "./exterior-02.mp3", "./exterior-03.mp3", "./gallery-01.jpg", "./gallery-12.mp3", "./interior-01.jpg", "./interior-02.jpg", "./interior-03.jpg", "./interior-04.mp3", "./interior-05.mp3", "./interior-06.mp3", "./milan-history.jpg", "./milan-history.mp3", "./milan.jpg", "./rooftop-01.jpg", "./rooftop-02.jpg", "./rooftop-03.jpg", "./rooftop-04.jpg", "./rooftop-05.jpg", "./rooftop-07.mp3", "./rooftop-08.mp3", "./rooftop-09.mp3", "./rooftop-10.mp3", "./rooftop-11.mp3"], "venice": ["./stmark-01.jpg", "./stmark-02.jpg", "./stmark-06.mp3", "./stmark-07.mp3", "./stmark-08.mp3", "./venice-culture-04.jpg", "./venice-culture-04.mp3", "./venice-culture-05.jpg", "./venice-culture-05.mp3", "./venice-history-01.jpg", "./venice-history-01.mp3", "./venice-history-02.jpg", "./venice-history-02.mp3", "./venice-history-03.mp3", "./venice-life-09.jpg", "./venice-life-09.mp3", "./venice-life-10.jpg", "./venice-life-10.mp3", "./venice.jpg"], "florence": ["./florence-01.mp3", "./florence-02.mp3", "./florence-03.mp3", "./florence-04.mp3", "./florence-05.mp3", "./florence-06.mp3", "./florence-07.mp3", "./florence-08.mp3", "./florence-09.mp3", "./florence-10.mp3", "./florence-11.mp3", "./florence-12.mp3", "./florence-13.mp3", "./florence-14.mp3", "./florence-cathedral-04.jpg", "./florence-cathedral-05.jpg", "./florence-cathedral-06.jpg", "./florence-cathedral-07.jpg", "./florence-david-01.jpg", "./florence-history-01.jpg", "./florence-history-02.jpg", "./florence-ponte-dante-01.jpg", "./florence-uffizi-01.jpg", "./florence-uffizi-02.jpg", "./florence.jpg"], "rome": ["./rome-01.mp3", "./rome-02.mp3", "./rome-03.mp3", "./rome-04.mp3", "./rome-05.mp3", "./rome-06.mp3", "./rome-07.mp3", "./rome-08.mp3", "./rome-09.mp3", "./rome-10.mp3", "./rome-11.mp3", "./rome-12.mp3", "./rome-13.mp3", "./rome-14.mp3", "./rome-15.mp3", "./rome-16.mp3", "./rome-17.mp3", "./rome-18.mp3", "./rome-19.mp3", "./rome-20.mp3", "./rome-21.mp3", "./rome-22.mp3", "./rome-23.mp3", "./rome-24.mp3", "./rome-25.mp3", "./rome-26.mp3", "./rome-27.mp3", "./rome-baroque-01.jpg", "./rome-colosseum-01.jpg", "./rome-empire-01.jpg", "./rome-empire-02.jpg", "./rome-forum-01.jpg", "./rome-forum-02.jpg", "./rome-history-01.jpg", "./rome-pantheon-01.jpg", "./rome-vatican-01.jpg", "./rome-vatican-02.jpg", "./rome-vatican-03.jpg", "./rome-water-01.jpg", "./rome.jpg"]};
self.addEventListener("install",e=>e.waitUntil(caches.open(CORE).then(c=>c.addAll(CORE_ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("italy-guide-")&&k.endsWith("-core")&&k!==CORE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));

const CANCELLED_CITIES = new Set();

self.addEventListener("message", e => {
  const d = e.data || {};
  const p = e.ports && e.ports[0];

  if (d.type === "GET_CACHE_STATUS") {
    e.waitUntil((async () => {
      const keys = await caches.keys();
      const cities = [];
      let bytes = 0;

      for (const city of Object.keys(CITY_ASSETS)) {
        const cacheName = PREFIX + city;
        if (!keys.includes(cacheName)) continue;

        const cache = await caches.open(cacheName);
        const requests = await cache.keys();

        if (requests.length !== CITY_ASSETS[city].length) continue;
        cities.push(city);

        for (const request of requests) {
          const response = await cache.match(request);
          if (!response) continue;

          try {
            const blob = await response.clone().blob();
            bytes += blob.size;
          } catch (error) {}
        }
      }

      if (p) p.postMessage({ type: "CACHE_STATUS", cities, bytes });
    })());
    return;
  }

  if (d.type === "CANCEL_CITY_DOWNLOAD" && CITY_ASSETS[d.city]) {
    CANCELLED_CITIES.add(d.city);

    e.waitUntil(
      caches.delete(PREFIX + d.city)
        .then(() => {
          if (p) {
            p.postMessage({
              type: "CANCEL_REQUESTED",
              city: d.city
            });
          }
        })
        .catch(error => {
          if (p) {
            p.postMessage({
              type: "CACHE_ERROR",
              message: String(error)
            });
          }
        })
    );
    return;
  }

  if (d.type === "DELETE_CITY" && CITY_ASSETS[d.city]) {
    e.waitUntil(caches.delete(PREFIX + d.city).then(() => {
      if (p) p.postMessage({ type: "DELETE_COMPLETE", city: d.city });
    }).catch(error => {
      if (p) p.postMessage({ type: "CACHE_ERROR", message: String(error) });
    }));
    return;
  }

  if (d.type === "DELETE_ALL_CITIES") {
    e.waitUntil((async () => {
      try {
        await Promise.all(Object.keys(CITY_ASSETS).map(city => caches.delete(PREFIX + city)));
        if (p) p.postMessage({ type: "DELETE_ALL_COMPLETE" });
      } catch (error) {
        if (p) p.postMessage({ type: "CACHE_ERROR", message: String(error) });
      }
    })());
    return;
  }

  if (d.type !== "CACHE_CITY" || !CITY_ASSETS[d.city]) return;

  CANCELLED_CITIES.delete(d.city);

  e.waitUntil((async () => {
    try {
      const arr = CITY_ASSETS[d.city];
      const cache = await caches.open(PREFIX + d.city);
      let done = 0;

      for (const a of arr) {
        if (CANCELLED_CITIES.has(d.city)) {
          throw new Error("__DOWNLOAD_CANCELLED__");
        }

        const r = await fetch(
          new Request(a, { cache: "reload" })
        );

        if (CANCELLED_CITIES.has(d.city)) {
          throw new Error("__DOWNLOAD_CANCELLED__");
        }

        if (!r.ok) {
          throw new Error(a);
        }

        await cache.put(a, r.clone());

        if (CANCELLED_CITIES.has(d.city)) {
          throw new Error("__DOWNLOAD_CANCELLED__");
        }

        done++;

        if (p) {
          p.postMessage({
            type: "CACHE_PROGRESS",
            done,
            total: arr.length
          });
        }
      }

      if (p) {
        p.postMessage({
          type: "CACHE_COMPLETE",
          city: d.city
        });
      }
    } catch (error) {
      await caches.delete(PREFIX + d.city);

      if (
        CANCELLED_CITIES.has(d.city) ||
        String(error).includes("__DOWNLOAD_CANCELLED__")
      ) {
        if (p) {
          p.postMessage({
            type: "CACHE_CANCELLED",
            city: d.city
          });
        }
      } else if (p) {
        p.postMessage({
          type: "CACHE_ERROR",
          message: String(error)
        });
      }
    } finally {
      CANCELLED_CITIES.delete(d.city);
    }
  })());
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).catch(() => {
        if (e.request.mode === "navigate") {
          return caches.match("./offline.html");
        }
      });
    })
  );
});
