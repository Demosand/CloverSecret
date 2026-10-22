'use strict';
const CACHE='project-pitt-9b0d9c3779bd';
const SHELL=['./','./index.html','./launcher.css','./launcher.js','./mouse-capture.js','./game.js','./game.wasm','./game.pck','./game.png','./game.icon.png','./game.audio.worklet.js','./game.audio.position.worklet.js'];
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function tell(data){for(const client of await self.clients.matchAll())client.postMessage(data);}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // Refresh the launcher online; immutable game data uses the device cache.
    const shell=event.request.mode==='navigate'||/\/(index\.html|launcher\.(js|css)|mouse-capture\.js|sw\.js)$/.test(url.pathname);
    const cached=await cache.match(event.request);
    if(cached&&!shell)return cached;
    try{
      const response=await fetch(event.request);
      if(response.ok){const copy=response.clone();event.waitUntil(cache.put(event.request,copy).catch(error=>tell({type:'CACHE_ERROR',message:error.message})));}
      return response;
    }catch(error){if(cached)return cached;throw error;}
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CACHE_SHELL')return;
  event.waitUntil((async()=>{
    try{
      const cache=await caches.open(CACHE);
      for(const path of SHELL){const url=new URL(path,self.registration.scope).href;if(!await cache.match(url)){const response=await fetch(url);if(!response.ok)throw new Error('HTTP '+response.status);await cache.put(url,response);}}
      await tell({type:'CACHE_READY'});
    }catch(error){await tell({type:'CACHE_ERROR',message:error.message});}
  })());
});
