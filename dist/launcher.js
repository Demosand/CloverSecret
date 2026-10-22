/* All paths are relative so project sites at /repository/ work on GitHub Pages. */
'use strict';
const $ = id => document.getElementById(id);
let engine, started = false, workerReady = false;
let errors = [];
const status = message => { $('status').textContent = message; };
const saveStatus = message => { $('save-status').textContent = message; };
function diagnostic(message) {
  errors.push(String(message));
  if(errors.length > 80) errors.shift();
  $('log').textContent = errors.join('\n');
  $('diagnostics').hidden = false;
}
function fail(error) {
  diagnostic(error.message || error);
  status('Не удалось запустить игру: ' + (error.message || error));
  $('launcher').hidden = false;
  $('play').disabled = false;
  $('play').textContent = 'Обновить страницу и повторить';
  $('play').onclick = () => location.reload();
}
async function setupCache() {
  if(!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller) {
      await Promise.race([new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),new Promise(resolve => setTimeout(resolve,3000))]);
    }
    workerReady = !!navigator.serviceWorker.controller;
  } catch(error) { $('offline-status').textContent = 'Офлайн-кэш недоступен: ' + error.message; }
}
const cachePromise = setupCache();
window.pittDownloadBackup = json => {
  const files = JSON.parse(json);
  if(!Object.keys(files).length) {saveStatus('Сохранений пока нет.');return;}
  const data = {format:'project-pitt-web',version:1,created:new Date().toISOString(),files};
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
  const a = document.createElement('a'); a.href=url;a.download='ProjectPITT-saves-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  saveStatus('Резервная копия скачана.');
};
window.pittRestoreResult = message => saveStatus(message);
window.addEventListener('pitt-ready', () => {
  for(const id of ['save','backup','restore','fullscreen']) $(id).disabled=false;
});
$('play').onclick = async () => {
  $('play').disabled=true;$('progress').hidden=false;
  try {
    if(location.protocol==='file:') throw new Error('Откройте игру через HTTPS или локальный HTTP: запустите preview.cmd.');
    const missing=Engine.getMissingFeatures({threads:false});
    if(missing.length) throw new Error('Браузеру недоступны: '+missing.join(', '));
    // Probe IndexedDB before starting rather than silently promising persistence.
    await new Promise((resolve,reject)=>{
      const req=indexedDB.open('pitt-storage-check',1);
      req.onerror=()=>reject(new Error('Браузер запретил IndexedDB. Разрешите данные сайта для сохранений.'));
      req.onsuccess=()=>{req.result.close();resolve();};
    });
    let persistent=false;
    try {persistent=await navigator.storage?.persist?.();} catch(_) {}
    $('storage').textContent = persistent ? 'Постоянное хранилище разрешено.' : 'Делайте резервные копии: браузер может очищать хранилище.';
    status('Подготовка загрузки…');await cachePromise;
    engine=new Engine({executable:'game',mainPack:'game.pck',canvas:$('canvas'),canvasResizePolicy:2,focusCanvas:true,persistentPaths:['/userfs'],fileSizes:{'game.pck':97773524,'game.wasm':39513091},onPrint:console.log,onPrintError:message=>{console.error(message);diagnostic(message);},onExit:()=>{saveStatus('Игра закрыта. Для нового запуска обновите страницу.');$('stage').hidden=true;$('launcher').hidden=false;for(const id of ['save','backup','restore','fullscreen'])$(id).disabled=true;$('play').disabled=false;$('play').textContent='Запустить снова';$('play').onclick=()=>location.reload();}});
    await engine.startGame({onProgress:(current,total)=>{if(total>0){$('progress').value=current/total*100;status(`Загрузка ${Math.round(current/total*100)}% · ${(current/1e6).toFixed(1)} / ${(total/1e6).toFixed(1)} МБ`);}else status('Подготовка игровых данных…');}});
    started=true;$('launcher').hidden=true;$('stage').hidden=false;$('canvas').focus({preventScroll:true});
    if(workerReady) navigator.serviceWorker.controller.postMessage({type:'CACHE_SHELL'});
    $('offline-status').textContent=workerReady?'Игровые файлы кэшируются на устройстве. После завершения кэширования сайт можно открыть без интернета.':'Игра работает. Для повторного запуска может понадобиться интернет.';
  } catch(error) {fail(error);}
};
$('save').onclick=()=>{saveStatus('Сохранение…');window.pittCommand?.('save');};
$('backup').onclick=()=>window.pittCommand?.('backup');
$('fullscreen').onclick=async()=>{try{await $('canvas').requestFullscreen();$('canvas').focus();}catch(error){saveStatus(error.message);}};
$('restore').onclick=()=>$('backup-file').click();
$('canvas').addEventListener('mousedown',()=>{if(window.pittWantsMouse&&!document.pointerLockElement)window.pittCommand?.('capture');});
$('backup-file').onchange=async event=>{
  try{
    const file=event.target.files[0];if(!file)return;
    if(file.size>64*1024*1024)throw new Error('Слишком большой файл резервной копии.');
    const data=JSON.parse(await file.text());
    if(data.format!=='project-pitt-web'||data.version!==1||!data.files||typeof data.files!=='object')throw new Error('Неверный формат резервной копии.');
    const entries=Object.entries(data.files);
    if(!entries.length||entries.length>100)throw new Error('Неверное количество файлов.');
    for(const [name,value] of entries){if(!/^[\w.-]+\.(save|bak|cfg)$/.test(name)||typeof value!=='string'||value.length>48*1024*1024)throw new Error('Недопустимый файл: '+name);atob(value);}
    if(!confirm('Заменить совпадающие сохранения и настройки резервной копией? Делайте это из главного меню.'))return;
    window.pittCommand?.('restore',JSON.stringify(data.files));
  }catch(error){saveStatus(error.message);}finally{event.target.value='';}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)window.pittCommand?.('save');});
window.addEventListener('pagehide',()=>{if(started)window.pittCommand?.('save');});
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='CACHE_READY')$('offline-status').textContent='Офлайн-кэш готов. Сайт можно повторно открыть на этом устройстве без интернета.';if(event.data?.type==='CACHE_ERROR')$('offline-status').textContent='Игра работает, но офлайн-кэш не завершён: '+event.data.message;});
