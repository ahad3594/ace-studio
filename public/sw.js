const CACHE='ace-studio-shell-v2';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/icon.svg','/icon-192.png','/icon-512.png','/sample.jpg'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Never cache uploads, API responses, images belonging to the user, or credentials.
  if(request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/desktop-connect')||url.search)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;}).catch(async()=>await caches.match(request)||await caches.match('/studio')||new Response('Open ACE Studio once while connected to make the workspace available offline.',{headers:{'Content-Type':'text/plain'}})));
  }else if(url.pathname.startsWith('/_next/static/')||['/icon.svg','/icon-192.png','/icon-512.png','/sample.jpg'].includes(url.pathname)){
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;})));
  }
});
