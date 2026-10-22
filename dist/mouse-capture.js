'use strict';
(() => {
  const canvas = document.getElementById('canvas');
  const hint = document.getElementById('mouse-hint');
  function refreshHint() {
    hint.hidden = !window.pittWantsMouse || document.pointerLockElement === canvas;
  }
  // Run before Godot's mouse handler. This must stay synchronous: browsers
  // require a new user gesture to recapture the pointer after Escape.
  canvas.addEventListener('mousedown', event => {
    if (event.button !== 0 || document.pointerLockElement || !window.pittCommand) return;
    window.pittCaptureAccepted = false;
    // Let live game state decide, rather than relying on a stale mouse mode.
    window.pittCommand('capture');
    if (!window.pittCaptureAccepted) return;
    canvas.focus({preventScroll: true});
    // The click that restores camera control must not also throw/use an item.
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener('pointerlockchange', refreshHint);
  window.addEventListener('pitt-mouse-mode', refreshHint);
  refreshHint();
})();
