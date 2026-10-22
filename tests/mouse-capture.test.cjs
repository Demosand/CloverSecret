const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dist/mouse-capture.js'),'utf8');
function setup() {
  const events={canvas:{},document:{},window:{}};
  const hint={hidden:true};
  const canvas={addEventListener:(type,fn,capture)=>{events.canvas[type]={fn,capture};},focus:()=>{}};
  const document={pointerLockElement:null,getElementById:id=>id==='canvas'?canvas:hint,addEventListener:(type,fn)=>{events.document[type]=fn;}};
  let canCapture=true,requests=0;
  const window={pittWantsMouse:false,addEventListener:(type,fn)=>{events.window[type]=fn;},pittCommand:command=>{
    assert.equal(command,'capture');requests++;
    // Model the engine's live acceptance, independently of the published hint.
    window.pittCaptureAccepted=canCapture;
    if(canCapture) document.pointerLockElement=canvas;
  }};
  vm.runInNewContext(source,{window,document});
  function click(button=0) {
    const e={button,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    events.canvas.mousedown.fn(e);return e;
  }
  return {window,document,canvas,hint,events,click,setCanCapture:v=>{canCapture=v;},requests:()=>requests};
}
test('Escape then click recaptures even when old published mouse state is false',()=>{
  const s=setup();const e=s.click();assert.equal(s.requests(),1);assert.equal(s.document.pointerLockElement,s.canvas);assert.equal(e.stopped,true);assert.equal(e.prevented,true);assert.equal(s.events.canvas.mousedown.capture,true);
});
test('repeated Escape/click cycles keep working and do not trigger item actions',()=>{
  const s=setup();for(let i=0;i<3;i++){s.document.pointerLockElement=null;assert.equal(s.click().stopped,true);}assert.equal(s.requests(),3);
});
test('menus reject capture even if last frame still advertised gameplay',()=>{
  const s=setup();s.window.pittWantsMouse=true;s.setCanCapture(false);const e=s.click();assert.equal(s.document.pointerLockElement,null);assert.equal(e.prevented,false);assert.equal(e.stopped,false);
});
test('locked gameplay and right click pass through untouched',()=>{
  const s=setup();assert.equal(s.click(2).stopped,false);assert.equal(s.requests(),0);s.document.pointerLockElement=s.canvas;assert.equal(s.click().stopped,false);assert.equal(s.requests(),0);
});
test('hint follows real browser lock and disappears in game menus',()=>{
  const s=setup();s.window.pittWantsMouse=true;s.events.window['pitt-mouse-mode']();assert.equal(s.hint.hidden,false);s.click();s.events.document.pointerlockchange();assert.equal(s.hint.hidden,true);s.document.pointerLockElement=null;s.events.document.pointerlockchange();assert.equal(s.hint.hidden,false);s.window.pittWantsMouse=false;s.events.window['pitt-mouse-mode']();assert.equal(s.hint.hidden,true);
});
