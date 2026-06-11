/* =====================================================
   FitnessFreak AI — posture.js
   In-browser pose detection using TensorFlow.js MoveNet
   Full webcam lifecycle: start / stop / flip
   Posture scoring with live ring + badge
   ===================================================== */

let detector     = null;
let stream       = null;
let animFrameId  = null;
let facingMode   = 'user';   // 'user' = front cam, 'environment' = back cam
let modelLoaded  = false;

const video      = document.getElementById('webcamVideo');
const canvas     = document.getElementById('poseCanvas');
const ctx        = canvas?.getContext('2d');

// ── Status helpers ───────────────────────────────────
function setStatus(state, text) {
  const dot  = document.getElementById('camStatusDot');
  const span = document.getElementById('camStatusText');
  if (!dot || !span) return;
  dot.className  = 'status-dot status-' + state;
  span.textContent = text;
}

function showLoadingOverlay(msg) {
  const o = document.getElementById('camLoadingOverlay');
  const t = document.getElementById('loadingText');
  if (o) o.classList.remove('d-none');
  if (t) t.textContent = msg || 'Loading…';
}
function hideLoadingOverlay() {
  document.getElementById('camLoadingOverlay')?.classList.add('d-none');
}

function showError(msg) {
  const el = document.getElementById('camError');
  const txt = document.getElementById('camErrorText');
  if (el) el.classList.remove('d-none');
  if (txt) txt.textContent = msg;
  setStatus('error', 'Error');
}
function hideError() {
  document.getElementById('camError')?.classList.add('d-none');
}

// ── Mode switcher ─────────────────────────────────────
window.switchMode = function(mode) {
  document.getElementById('browserMode').classList.toggle('d-none', mode !== 'browser');
  document.getElementById('serverMode').classList.toggle('d-none', mode !== 'server');
  document.getElementById('btnBrowser').classList.toggle('active', mode === 'browser');
  document.getElementById('btnServer').classList.toggle('active', mode !== 'browser');
  if (mode === 'server' && stream) stopCamera();
};

// ── Load MoveNet model ────────────────────────────────
async function loadModel() {
  if (modelLoaded && detector) return;
  showLoadingOverlay('Loading AI model (first time only)…');
  setStatus('loading', 'Loading AI model…');

  // Check TF.js loaded
  if (typeof tf === 'undefined') {
    throw new Error('TensorFlow.js failed to load. Check your internet connection and refresh.');
  }
  if (typeof poseDetection === 'undefined') {
    throw new Error('Pose detection library failed to load. Check your internet connection and refresh.');
  }

  // Try backends in order: webgl → wasm → cpu
  const backends = ['webgl', 'wasm', 'cpu'];
  let backendReady = false;
  for (const backend of backends) {
    try {
      await tf.setBackend(backend);
      await tf.ready();
      backendReady = true;
      console.log('[FitnessFreak] TF.js backend:', backend);
      break;
    } catch(e) {
      console.warn('[FitnessFreak] Backend failed:', backend, e.message);
    }
  }
  if (!backendReady) {
    throw new Error('No graphics backend available. Try Chrome or Firefox and refresh.');
  }

  // Try Lightning first (faster), then Thunder (more accurate)
  const modelTypes = [
    poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
  ];

  let lastError = null;
  for (const modelType of modelTypes) {
    try {
      console.log('[FitnessFreak] Loading model:', modelType);
      detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType }
      );
      modelLoaded = true;
      console.log('[FitnessFreak] Model loaded:', modelType);
      return;
    } catch(e) {
      lastError = e;
      console.warn('[FitnessFreak] Model failed:', modelType, e.message);
    }
  }

  console.error('[FitnessFreak] All models failed:', lastError);
  throw new Error('AI model failed to load. Error: ' + (lastError?.message || 'unknown'));
}

// ── Start camera ─────────────────────────────────────
window.startCamera = async function() {
  hideError();

  // Feature detection
  if (!navigator.mediaDevices?.getUserMedia) {
    showError('Camera API is not supported in your browser. Try Chrome or Firefox over HTTPS.');
    return;
  }

  // HTTPS check (except localhost)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showError('Camera requires a secure (HTTPS) connection. Please access the site over HTTPS.');
    return;
  }

  showLoadingOverlay('Requesting camera access…');
  setStatus('loading', 'Requesting camera…');
  document.getElementById('startBtn').disabled = true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });

    video.srcObject = stream;
    await new Promise(resolve => { video.onloadedmetadata = resolve; });
    await video.play();

    // Sync canvas size to video
    resizeCanvas();

    // Hide idle overlay, show controls
    document.getElementById('camIdleOverlay')?.classList.add('d-none');
    document.getElementById('startBtn').classList.add('d-none');
    document.getElementById('stopBtn').classList.remove('d-none');
    document.getElementById('flipBtn').classList.remove('d-none');

    // Load model while camera is warming up
    if (!modelLoaded) {
      showLoadingOverlay('Loading AI model (first time only)…');
      setStatus('loading', 'Loading AI model…');
      await loadModel();
    }

    hideLoadingOverlay();
    setStatus('active', 'Analysing posture…');
    document.getElementById('postureBadge')?.classList.remove('d-none');
    runDetectionLoop();

  } catch(err) {
    document.getElementById('startBtn').disabled = false;
    hideLoadingOverlay();
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      showError('Camera access denied. Click the camera icon in your browser address bar and allow access, then try again.');
    } else if (err.name === 'NotFoundError') {
      showError('No camera found on this device.');
    } else if (err.name === 'NotReadableError') {
      showError('Camera is already in use by another app. Close other apps using the camera and retry.');
    } else if (err.name === 'OverconstrainedError') {
      // Retry with relaxed constraints
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        await video.play();
        hideLoadingOverlay();
        setStatus('active', 'Analysing posture…');
        runDetectionLoop();
        return;
      } catch(e2) {}
      showError('Could not start camera: ' + err.message);
    } else {
      showError('Camera error: ' + (err.message || err.name));
    }
  }
};

// ── Stop camera ───────────────────────────────────────
window.stopCamera = function() {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (video) { video.srcObject = null; }
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

  document.getElementById('camIdleOverlay')?.classList.remove('d-none');
  document.getElementById('startBtn').classList.remove('d-none');
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').classList.add('d-none');
  document.getElementById('flipBtn').classList.add('d-none');
  document.getElementById('postureBadge')?.classList.add('d-none');
  setStatus('idle', 'Camera stopped');
  updateScoreRing(null);
};

// ── Flip camera ───────────────────────────────────────
window.flipCamera = async function() {
  facingMode = (facingMode === 'user') ? 'environment' : 'user';
  stopCamera();
  await startCamera();
};

// ── Resize canvas ─────────────────────────────────────
function resizeCanvas() {
  if (!canvas || !video) return;
  canvas.width  = video.videoWidth  || video.clientWidth;
  canvas.height = video.videoHeight || video.clientHeight;
}
window.addEventListener('resize', resizeCanvas);

// ── Detection loop ────────────────────────────────────
async function runDetectionLoop() {
  if (!stream || !detector) return;

  async function tick() {
    if (!stream) return;
    try {
      if (video.readyState >= 2) {
        const poses = await detector.estimatePoses(video, { flipHorizontal: false });
        if (poses?.length > 0) {
          drawPose(poses[0]);
          const score = calculatePostureScore(poses[0]);
          updateUI(score);
        }
      }
    } catch(e) { /* silent during active tracking */ }
    animFrameId = requestAnimationFrame(tick);
  }
  tick();
}

// ── MoveNet keypoint indices ──────────────────────────
const KP = {
  nose:0, leftEye:1, rightEye:2, leftEar:3, rightEar:4,
  leftShoulder:5, rightShoulder:6, leftElbow:7, rightElbow:8,
  leftWrist:9, rightWrist:10, leftHip:11, rightHip:12,
  leftKnee:13, rightKnee:14, leftAnkle:15, rightAnkle:16
};

// ── Draw skeleton ─────────────────────────────────────
const SKELETON_PAIRS = [
  [KP.leftShoulder,KP.rightShoulder],
  [KP.leftShoulder,KP.leftElbow],   [KP.leftElbow,KP.leftWrist],
  [KP.rightShoulder,KP.rightElbow], [KP.rightElbow,KP.rightWrist],
  [KP.leftShoulder,KP.leftHip],     [KP.rightShoulder,KP.rightHip],
  [KP.leftHip,KP.rightHip],
  [KP.leftHip,KP.leftKnee],         [KP.leftKnee,KP.leftAnkle],
  [KP.rightHip,KP.rightKnee],       [KP.rightKnee,KP.rightAnkle],
  [KP.leftShoulder,KP.nose],        [KP.rightShoulder,KP.nose]
];

function drawPose(pose) {
  if (!ctx) return;
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const kps = pose.keypoints;
  const scaleX = canvas.width  / (video.videoWidth  || canvas.width);
  const scaleY = canvas.height / (video.videoHeight || canvas.height);

  function kpX(k) { return kps[k].x * scaleX; }
  function kpY(k) { return kps[k].y * scaleY; }
  function conf(k){ return kps[k].score ?? 0; }

  // Draw bones
  ctx.lineWidth = 3;
  SKELETON_PAIRS.forEach(([a, b]) => {
    if (conf(a) > 0.3 && conf(b) > 0.3) {
      ctx.beginPath();
      ctx.moveTo(kpX(a), kpY(a));
      ctx.lineTo(kpX(b), kpY(b));
      ctx.strokeStyle = 'rgba(34,197,115,0.7)';
      ctx.stroke();
    }
  });

  // Draw joints
  kps.forEach((kp) => {
    if ((kp.score ?? 0) > 0.3) {
      ctx.beginPath();
      ctx.arc(kp.x * scaleX, kp.y * scaleY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#22c573';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

// ── Posture scoring ───────────────────────────────────
function angle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const cross = ab.x * cb.y - ab.y * cb.x;
  return Math.abs(Math.atan2(Math.abs(cross), dot) * 180 / Math.PI);
}

function calculatePostureScore(pose) {
  const kps = pose.keypoints;
  const get = i => kps[i];
  const ok  = i => (kps[i].score ?? 0) > 0.3;

  let penalties = 0;
  let checks    = 0;

  // 1. Shoulder alignment (y-axis): both shoulders should be at similar height
  if (ok(KP.leftShoulder) && ok(KP.rightShoulder)) {
    const diff = Math.abs(get(KP.leftShoulder).y - get(KP.rightShoulder).y);
    const norm = canvas.height || 480;
    penalties += Math.min(diff / norm * 200, 25);
    checks++;
  }

  // 2. Neck tilt: nose relative to shoulder midpoint
  if (ok(KP.nose) && ok(KP.leftShoulder) && ok(KP.rightShoulder)) {
    const smx = (get(KP.leftShoulder).x + get(KP.rightShoulder).x) / 2;
    const diff = Math.abs(get(KP.nose).x - smx);
    const norm = canvas.width || 640;
    penalties += Math.min(diff / norm * 150, 20);
    checks++;
  }

  // 3. Spine angle: shoulder-hip-knee should be roughly straight
  if (ok(KP.leftShoulder) && ok(KP.leftHip) && ok(KP.leftKnee)) {
    const a = angle(get(KP.leftShoulder), get(KP.leftHip), get(KP.leftKnee));
    if (a < 140) penalties += Math.min((160 - a) / 2, 30);
    checks++;
  }

  // 4. Head forward posture: ear relative to shoulder
  if (ok(KP.leftEar) && ok(KP.leftShoulder)) {
    const dx = get(KP.leftEar).x - get(KP.leftShoulder).x;
    const norm = canvas.width || 640;
    if (Math.abs(dx / norm) > 0.06) penalties += 20;
    checks++;
  }

  if (checks === 0) return null; // not enough keypoints visible
  const raw = Math.max(0, 100 - penalties);
  return Math.round(raw);
}

// ── Update UI ─────────────────────────────────────────
function updateUI(score) {
  if (score === null) return;

  const badge = document.getElementById('postureBadge');
  const label = document.getElementById('postureLabel');
  const icon  = document.getElementById('postureIcon');

  if (badge && label && icon) {
    if (score >= 70) {
      badge.className = 'posture-badge good';
      label.textContent = 'Good Posture';
      icon.className = 'bi bi-check-circle-fill';
    } else {
      badge.className = 'posture-badge bad';
      label.textContent = 'Fix Your Posture';
      icon.className = 'bi bi-exclamation-triangle-fill';
    }
  }

  updateScoreRing(score);
  document.getElementById('scoreHint').textContent =
    score >= 70 ? 'Looking great! Keep it up.' :
    score >= 50 ? 'Minor adjustments needed.' :
                  'Please correct your posture.';
}

function updateScoreRing(score) {
  const numEl = document.getElementById('scoreNum');
  const fill  = document.getElementById('scoreRingFill');
  if (!fill || !numEl) return;

  if (score === null) {
    numEl.textContent = '—';
    fill.style.strokeDashoffset = 326.7;
    return;
  }
  numEl.textContent = score;
  const circumference = 326.7;
  fill.style.strokeDashoffset = circumference - (score / 100) * circumference;
  fill.style.stroke = score >= 70 ? '#22c573' : score >= 50 ? '#f5a623' : '#f04b4b';
}

// ── Server mode fallback ──────────────────────────────
window.handleMjpegError = function() {
  const img = document.getElementById('mjpegImg');
  if (img) {
    img.alt = 'Server webcam unavailable. Use Browser Mode instead.';
    img.style.display = 'none';
  }
  const wrap = document.querySelector('.mjpeg-wrap');
  if (wrap) {
    wrap.innerHTML = `<div class="server-mode-notice text-center p-5">
      <i class="bi bi-camera-video-off d-block mb-3" style="font-size:2.5rem;color:var(--ff-muted)"></i>
      <strong>Server webcam not available</strong><br>
      <span style="font-size:.85rem;color:var(--ff-muted)">
        This only works when the Flask server has a local webcam attached.<br>
        Please use <strong>Browser Mode</strong> instead.
      </span>
    </div>`;
  }
};
