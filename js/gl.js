/* VELA.COM clone — gl.js v0.7
   Reference-matched behaviour:
   - intro: 3D gyroscope tumble — rings start tilted on X/Y, spin and settle flat
   - no continuous rotation; interactivity = strong 3D tilt with mouse + scroll
   - hover: whole dial grows, hovered segment lifts + brightens, screen dims
   - center globe: glass ball (transmission shell) with flat, undistorted video
     disc inside; grows near the inner ring on hover; bump pulse on video swap */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { RGBShiftShader } from "three/addons/shaders/RGBShiftShader.js";

const canvas = document.querySelector("[data-gl-canvas]");
if (!canvas) throw new Error("gl canvas missing");

const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- renderer / scene / camera ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3; // rig #8 exposure

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
// studio softboxes: elongated strips read as clean linear highlights on metal
{
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x07080a);
  const strip = (w, h, c, x, y, z, ry, rx = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  strip(14, 2.4, new THREE.Color(9, 9, 10), 0, 8, 0, 0, Math.PI / 2);        // top bar
  strip(2.2, 9, new THREE.Color(4.5, 5.2, 7.5), -8, 1, 2, Math.PI / 2.6);    // cool left
  strip(1.2, 7, new THREE.Color(2.6, 2.8, 3.2), 8, 0, -2, -Math.PI / 2.4);   // dim right
  scene.environment = pmrem.fromScene(env, 0.04).texture;
}

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 0, 10);

/* even, soft studio lighting — frontal key from above, subtle rim, real ambient */
/* Lighting Lab #8 — Neon Accent: white key + cyan/cobalt point accents */
const key = new THREE.DirectionalLight(0xffffff, 1.7);
key.position.set(-5, 7, 8); // upper-left, like the reference video's sheen
scene.add(key);
const neonCyan = new THREE.PointLight(0x00d4ff, 26, 12);
neonCyan.position.set(3.2, 2.4, 2.5);
scene.add(neonCyan);
const neonBlue = new THREE.PointLight(0x2c53a8, 20, 12);
neonBlue.position.set(-3.4, -2.2, 2.5);
scene.add(neonBlue);
const amb = new THREE.AmbientLight(0xdfe8ff, 0.3);
scene.add(amb);
const rim = new THREE.DirectionalLight(0x86a8ff, 0); // retired by rig #8
scene.add(rim);

const dial = new THREE.Group();
scene.add(dial);

/* post: motion-blur trails + chromatic aberration during the intro tumble */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// spectral radial blur: prismatic zoom streaks radiating from the centre,
// like light dispersing through the rings (replaces CA + afterimage)
const SpectralBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0 },
    center: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform vec2 center;
    varying vec2 vUv;
    vec3 spectrum(float t) {
      return clamp(vec3(
        1.2 - abs(t * 4.0 - 0.6),
        1.2 - abs(t * 4.0 - 2.0),
        1.2 - abs(t * 4.0 - 3.4)
      ), 0.0, 1.0);
    }
    void main() {
      vec2 dir = vUv - center;
      vec3 acc = vec3(0.0);
      vec3 wsum = vec3(0.0);
      for (int i = 0; i < 24; i++) {
        float t = float(i) / 23.0;
        vec3 w = spectrum(t);
        vec2 uv = center + dir * (1.0 - amount * t);
        acc += texture2D(tDiffuse, uv).rgb * w;
        wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, 1.0);
    }`,
};
const afterimagePass = new AfterimagePass(0.85);
composer.addPass(afterimagePass);
const rgbPass = new ShaderPass(RGBShiftShader);
rgbPass.uniforms.amount.value = 0;
composer.addPass(rgbPass);
// low-dose spectral dispersion on top (soft prismatic edges, not rainbow soup)
const spectralPass = new ShaderPass(SpectralBlurShader);
spectralPass.enabled = false;
composer.addPass(spectralPass);
afterimagePass.enabled = false;
rgbPass.enabled = false;

/* ---------------- theme (TDE navy + cyan) ---------------- */
const THEMES = {
  dark: {
    face: 0x2c53a8, faceIn: 0x24468f, hover: 0x3565d9, accent: "#00d4ff", accentHex: 0x00d4ff,
    text: "#f2f2f2", textDim: "rgba(150, 160, 178, 0.45)",
  },
  light: {
    face: 0xb9c6d8, faceIn: 0xa5b2c6, hover: 0xe8eef7, accent: "#009fd4", accentHex: 0x009fd4,
    text: "#20211f", textDim: "rgba(70, 76, 88, 0.45)",
  },
};
let theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";

let hoverKey = null;
let hoverOuter = false;

/* ---------------- brushed metal bump ---------------- */
function brushMaps() {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  for (let i = 0; i < 2600; i++) {
    const r = 40 + Math.random() * (S / 2 - 40);
    const a0 = Math.random() * Math.PI * 2;
    const g = 110 + Math.floor(Math.random() * 60);
    ctx.strokeStyle = `rgba(${g},${g},${g},${0.12 + Math.random() * 0.2})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a0 + 0.05 + Math.random() * 0.5);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}
const BRUSH = brushMaps();

/* ---------------- materials ---------------- */
/* matte machined metal — reference look: soft sheen, no glossy hotspots */
const ENV_I = 0.5;
const matFace = new THREE.MeshPhysicalMaterial({
  // Texture Lab #2 — Brushed Steel Blue; hover morphs toward Lab #7
  color: THEMES[theme].face, metalness: 0.85, roughness: 0.32,
  bumpMap: BRUSH, bumpScale: 0.02, transparent: true, envMapIntensity: ENV_I,
  iridescence: 0, iridescenceIOR: 1.6, iridescenceThicknessRange: [120, 480],
});
const matFaceIn = new THREE.MeshPhysicalMaterial({
  // Texture Lab #2 — Brushed Steel Blue (inner: a touch softer);
  // hover morphs it toward Lab #7 (iridescent tech)
  color: THEMES[theme].faceIn, metalness: 0.82, roughness: 0.36,
  bumpMap: BRUSH, bumpScale: 0.014, transparent: true, envMapIntensity: ENV_I,
  iridescence: 0, iridescenceIOR: 1.6, iridescenceThicknessRange: [120, 480],
});
/* live Color instances for hover lerps */
const C_FACE = new THREE.Color(THEMES[theme].face);
const C_FACE_IN = new THREE.Color(THEMES[theme].faceIn);
const C_HOVER = new THREE.Color(THEMES[theme].hover);
const matAccent = new THREE.MeshBasicMaterial({ color: THEMES[theme].accentHex, transparent: true });

/* ---------------- glass globe: shell + flat video disc ------------- */
const GLOBE_R = 0.5; // rest = 0.152R, like the reference; hover grows via scale
const globeGroup = new THREE.Group();
dial.add(globeGroup);

const glassMat = new THREE.MeshPhysicalMaterial({
  transmission: 1, roughness: 0.05, thickness: 0.5, ior: 1.45,
  clearcoat: 1, clearcoatRoughness: 0.06, // NOTE: transparent:true breaks transmission
  envMapIntensity: 1.1, color: 0xffffff,
});
// (our procedural glass shell retired — the user's 'globe' mesh wears glassMat)

const videoMat = new THREE.MeshBasicMaterial({ color: 0x0a0f18, transparent: true, opacity: 0 });
videoMat.depthTest = false;
videoMat.depthWrite = false;
videoMat.toneMapped = false; // exposure dims (hover) NEVER touch the footage
// alpha feather baked into the video itself: solid centre, TRANSPARENT edge —
// the footage dissolves straight into the page background, no painted halo
{
  const a = document.createElement("canvas");
  a.width = a.height = 512;
  const c = a.getContext("2d");
  const g = c.createRadialGradient(256, 256, 0, 256, 256, 256);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.68, "#ffffff");
  g.addColorStop(0.86, "#666666");
  g.addColorStop(1, "#000000");
  c.fillStyle = g;
  c.fillRect(0, 0, 512, 512);
  videoMat.alphaMap = new THREE.CanvasTexture(a);
}
const videoDisc = new THREE.Mesh(new THREE.CircleGeometry(GLOBE_R * 1.005, 96), videoMat);
videoDisc.renderOrder = 998;
videoDisc.position.z = 0;
videoDisc.renderOrder = 1;
// videoDisc is re-parented into the user's grp-globe once the GLB loads

/* ---------------- section videos ---------------- */
const VIDEO_SRC = {
  default: "assets/center.mp4",
  citizen: "assets/sec-citizen.mp4",
  consumer: "assets/sec-consumer.mp4",
  assistant: "assets/sec-assistant.mp4",
};
const videoCache = {};
let globePulse = 0;
function getVideoTex(k) {
  if (videoCache[k]) return videoCache[k];
  let el = k === "default" ? document.querySelector("[data-center-video]") : null;
  if (!el) {
    el = document.createElement("video");
    el.crossOrigin = "anonymous"; // CDN-hosted footage must not taint the WebGL texture
    el.src = VIDEO_SRC[k];
    el.muted = true; el.loop = true; el.playsInline = true;
    el.style.cssText = "position:fixed;width:2px;height:2px;opacity:0;pointer-events:none";
    document.body.appendChild(el);
  }
  const tex = new THREE.VideoTexture(el);
  tex.colorSpace = THREE.SRGBColorSpace;
  const crop = () => {
    const vw = el.videoWidth, vh = el.videoHeight;
    if (!vw || !vh) return;
    if (vw > vh) { tex.repeat.set(vh / vw, 1); tex.offset.set((1 - vh / vw) / 2, 0); }
    else { tex.repeat.set(1, vw / vh); tex.offset.set(0, (1 - vw / vh) / 2); }
  };
  el.readyState >= 1 ? crop() : el.addEventListener("loadedmetadata", crop, { once: true });
  videoCache[k] = { el, tex };
  return videoCache[k];
}
function setGlobeVideo(sectionKey, bump = true) {
  const k = sectionKey && VIDEO_SRC[sectionKey] ? sectionKey : "default";
  const { el, tex } = getVideoTex(k);
  if (videoMat.map !== tex) {
    videoMat.map = tex;
    videoMat.color.set(0xffffff);
    videoMat.needsUpdate = true;
    if (bump) globePulse = 1; // scale-bump on swap
  }
  el.play().catch(() => {});
}
setGlobeVideo(null, false);
// warm the section videos so hover swaps are instant (created paused)
Object.keys(VIDEO_SRC).forEach((k) => { const { el } = getVideoTex(k); el.preload = "auto"; });

/* ---------------- load the Blender dial ---------------- */
const parts = { outer: null, innerPivots: [], arcs: [] };
const innerMats = [];
const accentMats = [];
const outerGroup = new THREE.Group();
const innerGroup = new THREE.Group();
const arcsGroup = new THREE.Group();
// geometry now matches the reference proportions at source (gen_dial.py) —
// no scale/offset hacks in Three. innerSpin carries the whole-ring tumble.
const innerSpin = new THREE.Group();
innerGroup.add(innerSpin);
dial.add(outerGroup, innerGroup, arcsGroup);
let modelReady = false;
let outerSpin = null;

/* the user's ENTIRE Blender scene (counter, dot, TDE letters, scribble,
   rings, globe, ring labels as 3D chars) with its baked animation clips */
let mixer = null;
let mixerActions = [];
// baked-in-Blender ambient occlusion (per ring piece)
const aoLoader = new THREE.TextureLoader();
function aoTex(file) {
  const tx = aoLoader.load(file);
  tx.flipY = false;   // match glTF uv convention
  tx.channel = 0;     // the GLB carries a single uv set
  return tx;
}
const AO = {
  outer: aoTex("assets/ao-ring-outer.png"),
  a: aoTex("assets/ao-ring-inner-a.png"),
  b: aoTex("assets/ao-ring-inner-b.png"),
  c: aoTex("assets/ao-ring-inner-c.png"),
};
const gNodes = {}; // grp-outer, grp-inner, grp-globe, grp-accent, globe, ring meshes
const labelMats = []; // curved ring-label materials, faded in at the end
const seamMats = []; // cyan emissive seam bars on the segment cuts

new GLTFLoader().load("assets/dial-anim.glb?v=12", (gltf) => {
  const root = gltf.scene;
  root.traverse((n) => {
    const name = n.name;
    if (["grp-outer", "grp-inner", "grp-globe", "grp-accent"].includes(name)) gNodes[name] = n;
    if (!n.isMesh) return;
    if (name.startsWith("ring-outer")) {
      n.material = matFace;
      matFace.aoMap = AO.outer;
      matFace.aoMapIntensity = 0.85;
      parts.outer = n;
    } else if (name.startsWith("ring-inner")) {
      n.material = matFaceIn.clone();
      n.material.aoMap = AO[name.slice(-1)]; // ring-inner-a/b/c
      n.material.aoMapIntensity = 0.85;
      innerMats.push(n.material);
      parts.innerPivots.push(n); // hover scaling acts on the mesh itself
    } else if (name.startsWith("accent-out")) {
      n.material = matAccent.clone();
      accentMats.push(n.material);
      parts.arcs.push(n);
    } else if (name === "globe") {
      n.visible = false; // the ball IS the feathered video disc now
      gNodes.globe = n;
    } else if (name.startsWith("globe-line")) {
      n.visible = false;
    }
    // every other mesh (letters, counter digits, chars, dot, flare, scribble)
    // keeps the material the user authored in Blender
  });
  parts.innerPivots.sort((a, b) => a.name.localeCompare(b.name));
  // the HTML preloader covers the counter/letters phase — hide those props
  // (their material-fade exits don't survive glTF anyway)
  const HIDE = /^(cnt-|dot-pre|flare|scribble|ghost|grad|T-letter|D-letter|E-letter|iris)/;
  root.traverse((n) => { if (n.name && HIDE.test(n.name)) n.visible = false; });
  // curved ring labels: every mesh in the ring groups that is not a ring
  // face, accent arc, or hit zone — they fade in after the rings align
  ["grp-outer", "grp-inner"].forEach((k) => {
    if (!gNodes[k]) return;
    gNodes[k].traverse((n) => {
      if (!n.isMesh || hitMeshes.includes(n)) return;
      const nm = n.name || "";
      if (/^(ring-|accent-)/.test(nm)) return;
      n.visible = false; // baked blend chars retire — canvas rings replace them
    });
  });
  dial.add(root);
  // video disc rides the user's globe group so it inherits the animation
  if (gNodes["grp-globe"]) gNodes["grp-globe"].add(videoDisc);
  // hit zones follow the animated rings (and their final pose) automatically
  if (gNodes["grp-inner"]) hitMeshes.forEach((h) => h.name !== "outer" && gNodes["grp-inner"].add(h));
  if (gNodes["grp-outer"]) hitMeshes.forEach((h) => h.name === "outer" && gNodes["grp-outer"].add(h));
  // each label plane becomes a child of its own segment mesh
  const segOrder = ["citizen", "consumer", "assistant"]; // ring-inner-a/b/c
  parts.innerPivots.forEach((seg, i) => {
    const k = segOrder[i];
    if (segLabels[k]) seg.add(segLabels[k].mesh);
    // cyan emissive seams at both cut faces of the segment (accent E)
    [0, 116.8].forEach((deg) => {
      const a = THREE.MathUtils.degToRad(deg);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.015, 0.12),
        new THREE.MeshBasicMaterial({
          color: 0x00d4ff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      bar.position.set(Math.cos(a) * 2.14, Math.sin(a) * 2.14, 0);
      bar.rotation.z = a;
      bar.renderOrder = 4;
      seamMats.push(bar.material);
      seg.add(bar);
    });
  });
  // animation clips
  mixer = new THREE.AnimationMixer(root);
  // Blender 5 slotted actions export degenerate scale tracks for the globe
  // meshes (they collapse to 0) — drop them; the node rest scale is correct
  gltf.animations.forEach((clip) => {
    clip.tracks = clip.tracks.filter((t) => {
      const bad = /^(globe|globe-line-\d+)\.scale$/.test(t.name);
      return !bad;
    });
  });
  mixerActions = gltf.animations.map((clip) => {
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopOnce);
    a.clampWhenFinished = true;
    a.play();
    a.paused = true; // held at frame 1 until the reveal
    return a;
  });
  // deterministic ball scale: the export's rest pose may be frame-1 (scale 0);
  // Blender's settled value is 1.12 — pin it (scale tracks already filtered)
  ["globe", "globe-line-0", "globe-line-1", "globe-line-2"].forEach((n) => {
    const node = root.getObjectByName(n);
    if (node) node.scale.setScalar(1.12);
  });
  modelReady = true;
  window.dispatchEvent(new CustomEvent("vela:glready"));
}, (e) => {
  // A3: real download progress drives the preloader counter
  if (e.total) {
    const pct = Math.round((e.loaded / e.total) * 100);
    window.dispatchEvent(new CustomEvent("vela:loadprogress", { detail: pct }));
  }
}, (err) => console.error("GLB load failed", err));

/* ---------------- curved text rings (static) ---------------- */
const OUTER_R = 3.3;
function makeRingCanvas(draw) {
  const S = 2048;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  draw(c.getContext("2d"), S);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, redraw(d) { const x = c.getContext("2d"); x.clearRect(0, 0, S, S); d(x, S); tex.needsUpdate = true; } };
}
function arcText(ctx, S, text, angleDeg, radiusFrac, { size = 34, tracking = 0.42, color = "#f2f2f2" } = {}) {
  const R = (S / 2) * radiusFrac;
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.font = `600 ${size}px "Host Grotesk", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const track = size * tracking;
  const total = widths.reduce((a, b) => a + b + track, -track);
  let a = -THREE.MathUtils.degToRad(angleDeg) - (total / R) / 2;
  [...text].forEach((ch, i) => {
    const w = widths[i];
    a += (w / 2) / R;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.translate(0, -R);
    // engraved bas-relief: dark inner shadow above, light lip below
    ctx.fillStyle = "rgba(0, 2, 14, 0.65)";
    ctx.fillText(ch, 0, -1.7);
    ctx.fillStyle = "rgba(220, 235, 255, 0.4)";
    ctx.fillText(ch, 0, 1.7);
    ctx.fillStyle = color;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += (w / 2 + track) / R;
  });
  ctx.restore();
}
function arcDot(ctx, S, angleDeg, radiusFrac, color) {
  const R = (S / 2) * radiusFrac;
  const a = -THREE.MathUtils.degToRad(angleDeg);
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(Math.cos(a) * R, Math.sin(a) * R, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const OUTER_TEXT_R = 0.9;   // outer band mid (2.64+3.30)/2 / 3.3
const INNER_TEXT_R = 0.648; // inner band mid (1.85+2.43)/2 / 3.3

function drawOuter(ctx, S) {
  // rest: bright; hovering outer: full white; hovering an inner section: dimmed
  const col = hoverOuter ? "#ffffff" : (hoverKey ? THEMES[theme].textDim : THEMES[theme].text);
  arcText(ctx, S, "TECHNOLOGY", 90, OUTER_TEXT_R, { color: col });
  arcText(ctx, S, "DESIGN", 210, OUTER_TEXT_R, { color: col });
  arcText(ctx, S, "EXPERIENCE", 330, OUTER_TEXT_R, { color: col });
  arcDot(ctx, S, 150, OUTER_TEXT_R, col);
  arcDot(ctx, S, 270, OUTER_TEXT_R, col);
  arcDot(ctx, S, 30, OUTER_TEXT_R, col);
}
function drawInner(ctx, S) {
  const bright = THEMES[theme].text;
  const dim = THEMES[theme].textDim;
  const anyFocus = hoverKey || hoverOuter;
  const c = (k) => (!anyFocus ? bright : hoverKey === k ? "#ffffff" : dim);
  arcText(ctx, S, "CITIZEN FACING AI", 75, INNER_TEXT_R, { color: c("citizen") });
  arcText(ctx, S, "CONSUMER FACING AI", 195, INNER_TEXT_R, { color: c("consumer") });
  arcText(ctx, S, "YOUR PRIVATE PERSONAL ASSISTANT", 315, INNER_TEXT_R, { color: c("assistant") });
}

const outerRing = makeRingCanvas(drawOuter);
const innerRing = makeRingCanvas(drawInner);

function textPlane(entry, z) {
  const geo = new THREE.PlaneGeometry(OUTER_R * 2, OUTER_R * 2);
  const mat = new THREE.MeshBasicMaterial({ map: entry.tex, transparent: true, depthWrite: false, opacity: 0 });
  mat.depthTest = false; // the fat torus tube would otherwise swallow the plane
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = z;
  mesh.renderOrder = 5;
  dial.add(mesh);
  return mesh;
}
const outerTextMesh = textPlane(outerRing, 0.24);
const innerTextMesh = textPlane(innerRing, 0.09); // hugs the band: no parallax drift
innerTextMesh.visible = false; // replaced by per-segment labels (below)

/* each inner label is a CHILD of its 3D segment: it scales, pops and
   animates with the piece — genuinely part of the same 3D object */
const SEG_LABEL = {
  citizen: "CITIZEN FACING AI",
  consumer: "CONSUMER FACING AI",
  assistant: "YOUR PRIVATE PERSONAL ASSISTANT",
};
const SEG_MID = 58.4; // segment-local mid angle (geometry spans 0..116.8)
const segLabels = {};
function drawSegLabel(key) {
  return (ctx, S) => {
    const anyFocus = hoverKey || hoverOuter;
    const col = !anyFocus ? THEMES[theme].text : hoverKey === key ? "#ffffff" : THEMES[theme].textDim;
    arcText(ctx, S, SEG_LABEL[key], SEG_MID, INNER_TEXT_R, { color: col });
  };
}
Object.keys(SEG_LABEL).forEach((k) => {
  const ring = makeRingCanvas(drawSegLabel(k));
  const mat = new THREE.MeshBasicMaterial({ map: ring.tex, transparent: true, depthWrite: false, opacity: 0 });
  mat.depthTest = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(OUTER_R * 2, OUTER_R * 2), mat);
  mesh.renderOrder = 5;
  mesh.position.z = 0.09;
  segLabels[k] = { mesh, mat, ring };
});
function redrawSegLabels() {
  Object.keys(segLabels).forEach((k) => segLabels[k].ring.redraw(drawSegLabel(k)));
}

/* ---------------- soft shadow ---------------- */
let shadowMat;
{
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, "rgba(0,0,10,0.5)");
  g.addColorStop(0.72, "rgba(0,0,10,0.25)");
  g.addColorStop(1, "rgba(0,0,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(OUTER_R * 2.7, OUTER_R * 2.7), shadowMat);
  mesh.position.set(0.18, -0.22, -0.55);
  dial.add(mesh);
}

/* ---------------- hover + click sectors ---------------- */
// measured from the GLB: each inner segment spans 116.8deg,
// centred at 75 / 195 / 315 in group-local space
const SEG_SPAN = 116.8;
const SECTIONS = {
  citizen: { hash: "#citizen", angle: 75, seg: 0 },   // ring-inner-a
  consumer: { hash: "#consumer", angle: 195, seg: 1 }, // ring-inner-b
  assistant: { hash: "#assistant", angle: 315, seg: 2 }, // ring-inner-c
};
const hitMeshes = [];
const hitMat = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
Object.entries(SECTIONS).forEach(([keyName, def]) => {
  const start = THREE.MathUtils.degToRad(def.angle - SEG_SPAN / 2);
  // radii match the inner band exactly (single source: gen_dial.py)
  const geo = new THREE.RingGeometry(1.85, 2.43, 48, 1, start, THREE.MathUtils.degToRad(SEG_SPAN));
  const mesh = new THREE.Mesh(geo, hitMat());
  mesh.name = keyName;
  innerTextMesh.add(mesh);
  hitMeshes.push(mesh);
});
// outer brand ring is hoverable too (visual only, no section)
{
  const mesh = new THREE.Mesh(new THREE.RingGeometry(2.66, 3.3, 64, 1), hitMat());
  mesh.name = "outer";
  outerTextMesh.add(mesh);
  hitMeshes.push(mesh);
}

const raycaster = new THREE.Raycaster();
function updateHover(nx, ny) {
  raycaster.setFromCamera({ x: nx, y: ny }, camera);
  const hits = raycaster.intersectObjects(hitMeshes, false);
  const name = hits.length ? hits[0].object.name : null;
  const nextSection = name && SECTIONS[name] ? name : null;
  const nextOuter = name === "outer";
  if (nextOuter !== hoverOuter) {
    hoverOuter = nextOuter;
    outerRing.redraw(drawOuter);
    redrawSegLabels();
    window.dispatchEvent(new CustomEvent("vela:hover", { detail: { key: hoverKey, outer: hoverOuter } }));
  }
  if (nextSection !== hoverKey) {
    hoverKey = nextSection;
    document.body.style.cursor = (hoverKey || hoverOuter) ? "pointer" : "";
    setGlobeVideo(hoverKey);
    redrawSegLabels();
    outerRing.redraw(drawOuter);
    window.dispatchEvent(new CustomEvent("vela:hover", { detail: { key: hoverKey, outer: hoverOuter } }));
  }
}
let exitStart = null; // click -> ring tumble-out, THEN the section opens
let exitHash = null;
let exitBase = null;
window.addEventListener("click", (e) => {
  // only clicks on the dial itself — ignore UI (Back, menu, links, overlay)
  if ((!hoverKey && !hoverOuter) || zoomMode || exitStart !== null) return;
  if (e.target && e.target.closest && e.target.closest(".section-view, .nav-w, a, button")) return;
  exitStart = performance.now();
  exitHash = hoverKey ? SECTIONS[hoverKey].hash : "#tde";
  const go = gNodes["grp-outer"], gi = gNodes["grp-inner"];
  exitBase = {
    ox: go ? go.rotation.x : 0, oy: go ? go.rotation.y : 0,
    ix: gi ? gi.rotation.x : 0, iy: gi ? gi.rotation.y : 0,
  };
});

/* ---------------- theme ---------------- */
function applyTheme(next) {
  theme = next === "light" ? "light" : "dark";
  const T = THEMES[theme];
  C_FACE.set(T.face);
  C_FACE_IN.set(T.faceIn);
  C_HOVER.set(T.hover);
  matFace.color.set(T.face);
  matFaceIn.color.set(T.faceIn);
  innerMats.forEach((m) => m.color.set(T.faceIn));
  matAccent.color.set(T.accentHex);
  accentMats.forEach((m) => m.color.set(T.accentHex));
  outerRing.redraw(drawOuter);
  innerRing.redraw(drawInner);
}
window.addEventListener("vela:theme", (e) => applyTheme(e.detail));
if (document.fonts?.ready) {
  document.fonts.ready.then(() => { outerRing.redraw(drawOuter); innerRing.redraw(drawInner); });
}

/* ---------------- assembly intro: 3D gyroscope tumble ------------- */
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg01 = (t, a, b) => clamp01((t - a) / (b - a));

/* intro = the user's Blender scene playing its own AnimationClips.
   f1-100 counter/dot/letters, rings f1-210, accents f149-210, hold to 305.
   We play 0 → ANIM_END_S, then freeze — that frozen pose IS the home. */
const ANIM_END_S = 7.0; // f210 @ 30fps; the rest of the clip is hold

/* the user's animated world background: white -> dark over ~f1-30 */
let bgCurve = null; // [{prog 0..1}] per frame, endpoint mapped to page navy
const _bgColor = new THREE.Color();
fetch("assets/bg-curve.json?v=11")
  .then((r) => r.json())
  .then((d) => {
    const g0 = d.rgb[0][1];
    const gEnd = d.rgb[d.rgb.length - 1][1];
    bgCurve = d.rgb.map((c) => Math.min(1, Math.max(0, (g0 - c[1]) / (g0 - gEnd))));
  })
  .catch(() => (bgCurve = null));
// grey -> warm grey -> amber -> near-black, sampled from the reference video
const BG_STOPS = [
  [0.0, [197, 197, 197]],
  [0.35, [120, 110, 100]],
  [0.62, [100, 85, 22]],
  [1.0, [0, 0, 0]],
];
function bgAt(p) {
  for (let i = 1; i < BG_STOPS.length; i++) {
    if (p <= BG_STOPS[i][0]) {
      const [p0, c0] = BG_STOPS[i - 1];
      const [p1, c1] = BG_STOPS[i];
      const f = (p - p0) / (p1 - p0);
      return c0.map((a, k) => Math.round(a + (c1[k] - a) * f));
    }
  }
  return BG_STOPS[BG_STOPS.length - 1][1];
}

let introTiltX = 0; // gyroscopic arrival tilt, decays to 0 during the intro
let introTiltY = 0;
let revealAt = null;      // when the loading cover cleared
let assemblyStart = null; // set once model AND reveal are both ready
let assemblyT = 0;        // 0..1 across the played span
let settled = false;
const endPose = { outerZ: 0, innerZ: 0, globeS: 1 };

function setMixerTime(t) {
  if (!mixer) return;
  mixerActions.forEach((a) => { a.paused = false; });
  mixer.setTime(t);
  mixerActions.forEach((a) => { a.paused = true; });
}

function onSettled() {
  settled = true;
  mixerActions.forEach((a) => (a.paused = true));
  if (gNodes["grp-outer"]) endPose.outerZ = gNodes["grp-outer"].rotation.z;
  if (gNodes["grp-inner"]) endPose.innerZ = gNodes["grp-inner"].rotation.z;
  if (gNodes["grp-globe"]) endPose.globeS = gNodes["grp-globe"].scale.x || 1;
  globeScale = endPose.globeS;
  shadowMat.opacity = 0;
  introTiltX = 0;
  introTiltY = 0;
  document.body.classList.remove("bg-driven");
  document.body.style.backgroundColor = "";
  // keep the SAME rendered tone after settle — pure black
  scene.background = _bgColor.setRGB(0, 0, 0);
  window.dispatchEvent(new CustomEvent("vela:settled"));
  spectralPass.enabled = false;
  afterimagePass.enabled = false;
  rgbPass.enabled = false;
  outerTextMesh.material.opacity = 1;
  Object.values(segLabels).forEach((s) => (s.mat.opacity = 1));
  seamMats.forEach((m) => (m.opacity = 0.55));
  // Blender material-fade exits don't survive glTF export — make sure the
  // preloader-phase props of the user's scene are gone at rest
  const HIDE = /^(cnt-|dot-pre|flare|scribble|ghost|grad|T-letter|D-letter|E-letter|iris)/;
  dial.traverse((n) => { if (n.name && HIDE.test(n.name)) n.visible = false; });
}

window.addEventListener("vela:reveal", () => { revealAt = performance.now(); });
if (document.body.classList.contains("page-ready")) revealAt = performance.now();
// hard fallback: never let a lost event leave the dial hidden
setTimeout(() => { if (revealAt === null) revealAt = performance.now(); }, 6000);

/* ---------------- scroll reaction ---------------- */
let scrollP = 0;
window.addEventListener("vela:scroll", (e) => (scrollP = e.detail));

/* ---------------- section zoom: the ball swallows the screen ------- */
const ZOOM_SCALE = 15; // videoDisc r0.44 * 15 covers the viewport height
let zoomMode = false;
window.addEventListener("vela:zoom", (e) => {
  zoomMode = true;
  setGlobeVideo(e.detail, false); // ball shows the section footage while growing
});
let returnStart = null; // Back: the exit tumble plays in REVERSE
window.addEventListener("vela:zoomout", () => {
  zoomMode = false;
  globeScale = 3.2; // drop the screen-filling zoom ball at once, behind the overlay
  if (exitBase) returnStart = performance.now() + 300; // start once the overlay clears
  else {
    camera.position.z = 10;
    afterimagePass.enabled = rgbPass.enabled = spectralPass.enabled = false;
  }
});

/* ---------------- layout ---------------- */
let dialBaseY = 0;
let baseScaleCache = 1;
function layout() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const halfW = halfH * camera.aspect;
  const desktop = w > 991;
  baseScaleCache = (desktop
    ? Math.min(halfH * 0.78, halfW * 0.46)
    : Math.min(halfW * 0.88, halfH * 0.55)) / OUTER_R;
  dialBaseY = desktop ? halfH * 0.02 : halfH * 0.28;
  dial.position.set(0, dialBaseY, 0);
}
layout();
window.addEventListener("resize", layout);

/* ---------------- interaction + loop ---------------- */
const _discQ = new THREE.Quaternion();
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
let dimF = 0; // eased darkening while a section is hovered
let pointerSeen = false; // no hover until the user actually moves the mouse
window.addEventListener("pointermove", (e) => {
  pointerSeen = true;
  mouse.tx = (e.clientX / innerWidth) * 2 - 1;
  mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  updateHover(mouse.tx, -mouse.ty);
});

let globeScale = 1;   // glass ball hover growth
let lastNow = null;
const HOVER_SEG = () => (hoverKey ? SECTIONS[hoverKey].seg : -1);

function frame(now) {
  requestAnimationFrame(frame);
  const dt = lastNow === null ? 0.016 : Math.min(0.05, (now - lastNow) * 0.001);
  lastNow = now;

  // start the clock only when the model+clips are loaded and the cover is gone
  if (assemblyStart === null && revealAt !== null && modelReady && mixer) {
    assemblyStart = Math.max(now, revealAt);
    mixerActions.forEach((a) => (a.paused = false));
  }
  if (assemblyStart !== null && !settled && mixer) {
    const el = (now - assemblyStart) / 1000;
    // rings run from the reveal itself — simultaneous with the dot growth.
    // 2x playback: the whole clip fits the fast steven-style transition
    const elR = el * 2.0;
    setMixerTime(Math.min(elR, ANIM_END_S));
    const p = clamp01(elR / ANIM_END_S); // 0..1 across the intro
    const eo = (x) => 1 - Math.pow(1 - x, 3); // easeOutCubic
    /* T1+T2 — armillary tumble: EACH ring somersaults on its own axis and
       lands staggered (inner first, outer sweeps last), like the reference */
    const LAND_IN = 0.62, LAND_OUT = 0.85;
    const qi = clamp01(p / LAND_IN);
    const qo = clamp01(p / LAND_OUT);
    const thI = (1 - eo(qi)) * (Math.PI * 2 + 0.9);   // 1 turn + entry tilt
    const thO = (1 - eo(qo)) * (Math.PI * 3 + 0.7);   // 1.5 turns
    const wob = (q, land) =>
      q >= 1 ? Math.sin((p - land) * 46) * 0.045 * Math.exp(-(p - land) * 14) : 0;
    const gi = gNodes["grp-inner"], go = gNodes["grp-outer"];
    if (gi) {
      gi.rotation.x += thI * 0.85 + wob(qi, LAND_IN);
      gi.rotation.y += thI * 0.5;
      gi.rotation.z -= (1 - eo(qi)) * Math.PI * 2;
    }
    if (go) {
      go.rotation.x -= thO * 0.55 - wob(qo, LAND_OUT);
      go.rotation.y += thO * 0.9;
      go.rotation.z += (1 - eo(qo)) * Math.PI * 2;
    }
    /* T4 — the ball (and its video) only appears at the very end; the curved
       labels fade in after the rings have aligned */
    const gate = eo(clamp01((p - 0.78) / 0.18));
    if (gNodes["grp-globe"]) gNodes["grp-globe"].scale.multiplyScalar(gate);
    const lop = clamp01((p - 0.7) / 0.25);
    outerTextMesh.material.opacity = lop;
    Object.values(segLabels).forEach((s) => (s.mat.opacity = lop));
    seamMats.forEach((m) => (m.opacity = lop * 0.55));
    // dolly across the WHOLE animation: rings are born right at the screen
    // and travel backwards into their final position, never cut short
    const zt = 0.5 - 0.5 * Math.cos(Math.PI * p);
    camera.position.z = 3.6 + (10 - 3.6) * zt;
    // keep the blend's black dot / ball (world y=0.7) screen-centred while
    // close, easing back to the home framing with the dolly
    camera.position.y = 0.7 * (1 - zt);
    /* T3 — restrained motion look: soft directional trails + a FAINT edge
       fringe while things move fast; the rainbow streak pass stays off */
    const energy = Math.min(1, Math.max(0, 1.2 - p * 1.45));
    afterimagePass.enabled = energy > 0.02;
    rgbPass.enabled = energy > 0.02;
    spectralPass.enabled = energy > 0.02;
    afterimagePass.uniforms["damp"].value = 0.45 + energy * 0.42;
    rgbPass.uniforms.amount.value = energy * 0.005;
    spectralPass.uniforms.amount.value = energy * 0.12;
    if (bgCurve) {
      document.body.classList.add("bg-driven");
      // ramp runs ~0.67s-0.92s, inside the dot-growth window
      const fi = Math.min(bgCurve.length - 1, Math.floor(el * 24));
      const c = bgAt(bgCurve[fi]);
      document.body.style.backgroundColor = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      // the composer canvas is opaque: paint the SAME color into the 3D scene
      // so the whole white->dark ride is inside the render (CA/blur affect it too)
      scene.background = _bgColor.setRGB(c[0] / 255, c[1] / 255, c[2] / 255);
    }
    assemblyT = p;
    // soft shadow arrives with the ball
    shadowMat.opacity = 0; // retired: it tinted the dial interior navy
    if (elR >= ANIM_END_S) { camera.position.z = 10; camera.position.y = 0; onSettled(); }
  }

  // 3D scene tilt: mouse parallax + scroll pitch (the whole scene reacts)
  // keep the video upright: cancel ALL inherited rotation (full billboard)
  if (videoDisc.parent) {
    videoDisc.parent.getWorldQuaternion(_discQ);
    videoDisc.quaternion.copy(_discQ.invert());
  }

  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  dial.rotation.y = mouse.x * 0.09;
  dial.rotation.x = -mouse.y * 0.07 + scrollP * 0.85;
  // zones move with the tilt — keep the hover test in sync every frame
  if (settled && !zoomMode && exitStart === null && pointerSeen) updateHover(mouse.tx, -mouse.ty);

  // hover: ONLY the hovered piece reacts — color lightens (reference style)
  // plus a small lift. Nothing global.
  const hs = HOVER_SEG();
  if (settled) {
    innerMats.forEach((m, i) => {
      m.userData.h = m.userData.h ?? 0;
      m.userData.h += ((i === hs ? 1 : 0) - m.userData.h) * 0.12;
      m.color.lerpColors(C_FACE_IN, C_HOVER, m.userData.h);
      // keep the metal shading alive while lit
      m.envMapIntensity = ENV_I + m.userData.h * 0.2;
      m.roughness = 0.36 - m.userData.h * 0.06;
      // self-lit pop: deep-blue emissive — bright but never washed white
      m.emissive.set(C_HOVER);
      m.emissiveIntensity = m.userData.h * 0.16;
      // Texture Lab #7 blooms in on hover: iridescent tech finish
      m.iridescence = m.userData.h * 0.7;
      m.metalness = 0.82 - m.userData.h * 0.22;
    });
    // hovered piece GROWS in place (scale about dial centre — the circle
    // never breaks because there is no displacement, only radial growth)
    parts.innerPivots.forEach((pv, i) => {
      const target = i === hs ? 1.035 : 1;
      const s = pv.scale.x + (target - pv.scale.x) * 0.12;
      pv.scale.setScalar(s);
      if (pv.position.z !== 0) pv.position.z += (0 - pv.position.z) * 0.2;
    });
    // outer brand ring hover: the whole outer ring lightens AND grows
    matFace.userData.h = matFace.userData.h ?? 0;
    matFace.userData.h += ((hoverOuter ? 1 : 0) - matFace.userData.h) * 0.12;
    matFace.color.lerpColors(C_FACE, C_HOVER, matFace.userData.h * 0.75);
    matFace.emissive.set(C_HOVER);
    matFace.emissiveIntensity = matFace.userData.h * 0.12;
    matFace.iridescence = matFace.userData.h * 0.7;
    matFace.metalness = 0.85 - matFace.userData.h * 0.2;
    matFace.roughness = 0.32 - matFace.userData.h * 0.04;
    if (outerSpin) {
      const os = hoverOuter ? 1.02 : 1;
      outerSpin.scale.setScalar(outerSpin.scale.x + (os - outerSpin.scale.x) * 0.12);
    }
  }

  // glass ball: hover growth toward the inner ring edge + swap pulse
  if (settled) {
    globePulse = Math.max(0, globePulse - dt * 2.4);
    const pulse = 1 + Math.sin(Math.min(1, 1 - globePulse) * Math.PI) * 0.12 * (globePulse > 0 ? 1 : 0);
    // rest scale comes from the animatic's final pose (globe ends bigger)
    // rest scale = the animation's final globe scale
    const target = zoomMode ? ZOOM_SCALE : (hoverKey || hoverOuter) ? 2.55 : endPose.globeS;
    globeScale += (target - globeScale) * 0.09;
    if (gNodes["grp-globe"]) gNodes["grp-globe"].scale.setScalar(globeScale * pulse);
    // footage lives on the ball at rest too (like the reference home)
    videoMat.opacity += (1 - videoMat.opacity) * 0.12;
  }

  // rings rest in the user's FINAL pose; scroll swirls them away on top of it
  if (settled) {
    if (gNodes["grp-outer"]) gNodes["grp-outer"].rotation.z = endPose.outerZ + scrollP * 1.2;
    if (gNodes["grp-inner"]) gNodes["grp-inner"].rotation.z = endPose.innerZ - scrollP * 0.9;
  }

  // (4) hovering a section: dim everything else (lights + DOM via body class)
  const dimTarget = settled && !zoomMode && exitStart === null && (hoverKey || hoverOuter) ? 1 : 0;
  dimF += (dimTarget - dimF) * 0.09;
  key.intensity = 1.7 * (1 - 0.72 * dimF);
  neonCyan.intensity = 26 * (1 - 0.55 * dimF);
  neonBlue.intensity = 20 * (1 - 0.55 * dimF);
  amb.intensity = 0.3 * (1 - 0.65 * dimF);
  renderer.toneMappingExposure = 1.3 * (1 - 0.42 * dimF);
  const dimOn = dimF > 0.04;
  if (dimOn !== document.body.classList.contains("sec-dim"))
    document.body.classList.toggle("sec-dim", dimOn);

  // (5) click on a ring: the SAME tumble plays (inverted, toward the viewer)
  // and only then the section page opens
  if (exitStart !== null && settled && !zoomMode) {
    const q = Math.min(1, (performance.now() - exitStart) / 900);
    const ei = q * q; // easeIn — it accelerates INTO the screen
    const go = gNodes["grp-outer"], gi = gNodes["grp-inner"];
    if (go) {
      go.rotation.x = exitBase.ox + ei * 0.95;
      go.rotation.y = exitBase.oy - ei * 1.5;
      go.rotation.z = endPose.outerZ + ei * Math.PI * 1.6;
    }
    if (gi) {
      gi.rotation.x = exitBase.ix - ei * 0.75;
      gi.rotation.y = exitBase.iy + ei * 1.2;
      gi.rotation.z = endPose.innerZ - ei * Math.PI * 1.3;
    }
    camera.position.z = 10 - ei * 5.6;
    afterimagePass.enabled = rgbPass.enabled = spectralPass.enabled = true;
    afterimagePass.uniforms["damp"].value = 0.45 + ei * 0.4;
    rgbPass.uniforms.amount.value = ei * 0.004;
    spectralPass.uniforms.amount.value = ei * 0.1;
    if (q >= 1) {
      exitStart = null;
      window.dispatchEvent(new CustomEvent("vela:section", { detail: exitHash }));
    }
  }

  // Back from a section: the same tumble unwinds while the camera pulls out
  if (returnStart !== null && settled && !zoomMode && exitBase && performance.now() >= returnStart) {
    const q = Math.min(1, (performance.now() - returnStart) / 1600);
    const eo2 = 1 - Math.pow(1 - q, 3); // easeOut — it decelerates into place
    const rev = 1 - eo2;
    const go = gNodes["grp-outer"], gi = gNodes["grp-inner"];
    if (go) {
      go.rotation.x = exitBase.ox + rev * 0.95;
      go.rotation.y = exitBase.oy - rev * 1.5;
      go.rotation.z = endPose.outerZ + rev * Math.PI * 1.6; // spins INTO place
    }
    if (gi) {
      gi.rotation.x = exitBase.ix - rev * 0.75;
      gi.rotation.y = exitBase.iy + rev * 1.2;
      gi.rotation.z = endPose.innerZ - rev * Math.PI * 1.3;
    }
    camera.position.z = 10 - rev * 5.6;
    afterimagePass.enabled = rgbPass.enabled = spectralPass.enabled = rev > 0.03;
    afterimagePass.uniforms["damp"].value = 0.45 + rev * 0.4;
    rgbPass.uniforms.amount.value = rev * 0.004;
    spectralPass.uniforms.amount.value = rev * 0.1;
    if (q >= 1) {
      returnStart = null;
      exitBase = null;
      camera.position.z = 10;
      afterimagePass.enabled = rgbPass.enabled = spectralPass.enabled = false;
    }
  }

  // scroll-away: rise, shrink, fade
  dial.scale.setScalar(baseScaleCache * (1 - 0.22 * scrollP));
  dial.position.y = dialBaseY + scrollP * 3.4;
  if (settled) {
    const fade = 1 - scrollP;
    matFace.opacity = fade;
    innerMats.forEach((m) => (m.opacity = fade));
    accentMats.forEach((m) => (m.opacity = fade));
    outerTextMesh.material.opacity = fade;
    Object.values(segLabels).forEach((s) => (s.mat.opacity = fade));
    shadowMat.opacity = 0;
  }

  composer.render();
}
requestAnimationFrame(frame);

/* debug probe + intro replay hook */
Object.defineProperty(window, "__vela", {
  value: {
    get t() { return assemblyT; },
    get settled() { return settled; },
    get modelReady() { return modelReady; },
    get revealAt() { return revealAt; },
    get assemblyStart() { return assemblyStart; },
    get hoverOuter() { return hoverOuter; },
    get hoverKey() { return hoverKey; },
    get globeScale() { return globeScale; },
    get globeGroupScale() { return gNodes['grp-globe'] ? gNodes['grp-globe'].scale.x : 1; },
    replay() { assemblyT = 0; settled = false; setMixerTime(0); assemblyStart = performance.now() + 200; },
    pose(t) { assemblyT = t; settled = false; setMixerTime(t * ANIM_END_S); }, // freeze a frame of the intro
    globeInfo() {
      const g = gNodes.globe;
      if (!g) return { missing: true };
      const ws = new THREE.Vector3();
      g.getWorldScale(ws);
      const wp = new THREE.Vector3();
      g.getWorldPosition(wp);
      return {
        visible: g.visible, parentChain: (() => { let p = g, c = []; while (p) { c.push(p.name || p.type); p = p.parent; } return c; })(),
        worldScale: +ws.x.toFixed(3), worldPos: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)],
        matColor: g.material.color.getHexString(), matType: g.material.type, opacity: g.material.opacity,
        geoRadius: g.geometry.boundingSphere ? +g.geometry.boundingSphere.radius.toFixed(3) : null,
      };
    },
    hitInfo() {
      // screen-projected centre of each hover zone
      const out = [];
      const p = new THREE.Vector3();
      hitMeshes.forEach((m) => {
        m.updateWorldMatrix(true, false);
        // mid-radius point at the sector's angular centre (local +X rotated)
        const geo = m.geometry.parameters;
        const midR = (geo.innerRadius + geo.outerRadius) / 2;
        const midA = (geo.thetaStart || 0) + (geo.thetaLength || Math.PI * 2) / 2;
        p.set(Math.cos(midA) * midR, Math.sin(midA) * midR, 0).applyMatrix4(m.matrixWorld);
        const world = p.clone();
        p.project(camera);
        out.push({
          name: m.name,
          x: Math.round(((p.x + 1) / 2) * innerWidth),
          y: Math.round(((1 - p.y) / 2) * innerHeight),
          worldR: Math.round(Math.hypot(world.x, world.y) * 100) / 100,
        });
      });
      return out;
    },
    segInfo() {
      // world-space angular extents of each inner segment (degrees, atan2 on XY)
      const q = new THREE.Quaternion();
      const p = new THREE.Vector3();
      return parts.innerPivots.map((pv) => {
        const mesh = pv.children[0];
        const geo = mesh.geometry;
        const pos = geo.attributes.position;
        let min = 720, max = -720;
        mesh.updateWorldMatrix(true, false);
        for (let i = 0; i < pos.count; i += 17) {
          p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
          const a = ((Math.atan2(p.y, p.x) * 180) / Math.PI + 360) % 360;
          if (a < min) min = a;
          if (a > max) max = a;
        }
        mesh.getWorldQuaternion(q);
        return { name: mesh.name, minDeg: Math.round(min), maxDeg: Math.round(max) };
      });
    },
  },
});
