/* TDE experience loader — one script tag mounts the whole page.
   Usage in Webflow page custom code (inside <head>):
   <script defer data-base="https://YOUR-CDN/tde/" src="https://YOUR-CDN/tde/tde-loader.js"></script> */
(async () => {
  const BASE = document.currentScript ? document.currentScript.dataset.base : window.TDE_BASE;
  // resolve every relative url (assets, videos, glb, css urls) against the CDN
  const base = document.createElement("base");
  base.href = BASE;
  document.head.prepend(base);
  const st = document.createElement("style");
  st.textContent = "html,body{margin:0;padding:0;background:#000;overflow:hidden}";
  document.head.appendChild(st);
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = BASE + "css/styles.css";
  document.head.appendChild(css);
  const im = document.createElement("script");
  im.type = "importmap";
  im.textContent = JSON.stringify({ imports: {
    "three": "https://unpkg.com/three@0.161.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.161.0/examples/jsm/"
  }});
  document.head.appendChild(im);
  const html = await (await fetch(BASE + "tde-body.html")).text();
  const mount = document.getElementById("tde-app") || document.body;
  mount.innerHTML = html;
  for (const src of ["js/app.js", "js/gl.js"]) {
    const s = document.createElement("script");
    s.type = "module";
    s.src = BASE + src;
    document.body.appendChild(s);
  }
})();
