/*
 * Camera barcode scanning for tablets and phones. Uses the browser's built-in
 * BarcodeDetector when it supports Code 128 (Chrome on Android), otherwise loads
 * the html5-qrcode library on demand (iPad Safari and others). Needs HTTPS
 * (GitHub Pages) and camera permission.
 */
(function () {
  'use strict';
  const LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
  let libLoading = null;
  const loadLib = () => libLoading || (libLoading = new Promise((ok, fail) => {
    if (window.Html5Qrcode) return ok();
    const sc = document.createElement('script');
    sc.src = LIB; sc.onload = () => ok(); sc.onerror = () => { libLoading = null; fail(new Error('Scanner library could not load')); };
    document.head.appendChild(sc);
  }));

  async function nativeSupported() {
    if (!('BarcodeDetector' in window)) return false;
    try { const f = await window.BarcodeDetector.getSupportedFormats(); return f.includes('code_128') && f.includes('data_matrix'); } catch (e) { return false; }
  }

  // Open the camera; onCode(text) is called once with the first barcode read, then the camera closes.
  function open(onCode, opts) {
    opts = opts || {};
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      UI.modal({ title: 'Camera Not Available', body: '<p>This browser cannot use the camera here.</p><ul><li>Open the EHR in <strong>Safari</strong> from the https GitHub Pages link. On older iPads (iOS 12–14.2), Chrome and other apps cannot use the camera, and a web page opened as a full-screen Home Screen app cannot either (iOS 12–13.3).</li><li>Or use a Bluetooth/USB barcode scanner: tap the scan box, then scan.</li></ul>', buttons: [{ label: 'OK' }] });
      return;
    }
    let stop = () => {};
    let done = false;
    const finish = (api, text) => { if (done) return; done = true; if (navigator.vibrate) navigator.vibrate(80); api.close(); onCode(String(text).trim()); };
    UI.modal({
      title: opts.title || 'Scan with Camera',
      body: `<div class="cam-wrap"><video class="cam-video" playsinline muted hidden></video><div id="cam-reader" class="cam-reader"></div>
          <div class="cam-guide" aria-hidden="true"></div></div>
        <p class="muted small cam-msg">Hold the label flat inside the box, about 3–4 inches from the camera (move closer if it does not read; line barcodes on medication packages need about 3 inches). Allow camera access if asked.</p>`,
      onClose: () => { done = true; stop(); },
      buttons: [{ label: 'Cancel' }],
      async onOpen(api) {
        const msg = api.el.querySelector('.cam-msg');
        try {
          if (await nativeSupported()) {
            const video = api.el.querySelector('.cam-video');
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            stop = () => stream.getTracks().forEach(t => t.stop());
            if (done) return stop();
            video.srcObject = stream; video.hidden = false; await video.play();
            const det = new window.BarcodeDetector({ formats: ['data_matrix', 'code_128', 'qr_code', 'code_39'] });
            const tick = async () => {
              if (done) return;
              try { const found = await det.detect(video); if (found.length) return finish(api, found[0].rawValue); } catch (e) { /* keep trying */ }
              setTimeout(tick, 150);
            };
            tick();
          } else {
            await loadLib();
            if (done) return;
            const F = window.Html5QrcodeSupportedFormats;
            const reader = new window.Html5Qrcode('cam-reader', { formatsToSupport: [F.DATA_MATRIX, F.CODE_128, F.CODE_39, F.QR_CODE], verbose: false, experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
            let running = false;
            stop = () => { if (running) { running = false; reader.stop().then(() => reader.clear()).catch(() => {}); } };
            await reader.start({ facingMode: 'environment' }, { fps: 8, videoConstraints: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, qrbox: (w, h) => ({ width: Math.max(200, Math.floor(w * 0.92)), height: Math.max(120, Math.floor(Math.min(h * 0.7, w * 0.55))) }) }, text => finish(api, text), () => {});
            running = true;
            if (done) stop();
          }
        } catch (e) {
          msg.innerHTML = `<strong class="abn">Camera could not start:</strong> ${U.esc(e && e.name === 'NotAllowedError' ? 'camera permission was denied. Allow camera access for this site in the browser settings.' : (e && e.message) || 'unknown error')}`;
        }
      }
    });
  }

  window.CameraScan = { open };
})();
