/* VELA.COM clone — app.js v0.1
   Preloader, clock, menu, theme, manifesto, arm links, cookie, intro overlay. */
(() => {
  "use strict";

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const html = document.documentElement;
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- theme ---------------- */
  const savedTheme = localStorage.getItem("vela-theme");
  if (savedTheme) html.dataset.theme = savedTheme;
  $$("[data-theme-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const next = html.dataset.theme === "dark" ? "light" : "dark";
      html.dataset.theme = next;
      localStorage.setItem("vela-theme", next);
      window.dispatchEvent(new CustomEvent("vela:theme", { detail: next }));
    })
  );

  /* ---------------- clock (city rotator + live time) ---------------- */
  const CITIES = [
    { label: "MAD", tz: "Europe/Madrid" },
    { label: "LDN", tz: "Europe/London" },
    { label: "NYC", tz: "America/New_York" },
    { label: "TYO", tz: "Asia/Tokyo" },
  ];
  let cityIdx = 0;

  const fmtTime = (tz) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, timeZone: tz,
    }).format(new Date());

  const clocks = $$("[data-clock]").map((root) => ({
    city: $("[data-clock-city]", root),
    time: $("[data-clock-time]", root),
  }));

  function setSlot(group, text, animate) {
    if (!group) return;
    while (group.children.length > 1) group.firstElementChild.remove();
    const current = group.lastElementChild;
    if (!animate || prefersReduced || document.hidden) {
      current.textContent = text;
      current.className = "clock-slot";
      return;
    }
    const next = document.createElement("span");
    next.className = "clock-slot roll-wait";
    next.textContent = text;
    group.appendChild(next);
    void next.offsetHeight; // force reflow so the transition runs
    current.classList.add("roll-out");
    next.classList.remove("roll-wait");
    setTimeout(() => {
      while (group.firstElementChild !== next && group.firstElementChild) {
        group.firstElementChild.remove();
      }
    }, 800);
  }

  function tickTime() {
    const t = fmtTime(CITIES[cityIdx].tz);
    clocks.forEach((c) => {
      // safety purge: never let stale roll slots pile up (throttled tabs)
      [c.city, c.time].forEach((g) => {
        while (g && g.children.length > 2) g.firstElementChild.remove();
      });
      const slot = c.time && $(".clock-slot:last-child", c.time);
      if (slot) slot.textContent = t;
    });
  }
  function rotateCity() {
    cityIdx = (cityIdx + 1) % CITIES.length;
    clocks.forEach((c) => setSlot(c.city, CITIES[cityIdx].label, true));
    tickTime();
  }
  tickTime();
  clocks.forEach((c) => setSlot(c.city, CITIES[0].label, false));
  setInterval(tickTime, 1000);
  setInterval(rotateCity, 4000);

  /* ---------------- nav menu ---------------- */
  const nav = $("[data-nav]");
  const menuBtn = $("[data-menu-btn]");
  const underlay = $("[data-nav-underlay]");

  function closePanels() {
    nav.classList.remove("open-nav", "open-manifesto", "open-contact");
    menuBtn.setAttribute("aria-expanded", "false");
  }
  menuBtn.addEventListener("click", () => {
    const opening = !nav.classList.contains("open-nav");
    closePanels();
    if (opening) {
      nav.classList.add("open-nav");
      menuBtn.setAttribute("aria-expanded", "true");
    }
  });
  underlay.addEventListener("click", closePanels);
  document.addEventListener("keydown", (e) => e.key === "Escape" && closePanels());
  $$("[data-menu-link]").forEach((a) =>
    a.addEventListener("click", () => {
      $$("[data-menu-link]").forEach((x) => x.classList.remove("is-current"));
      a.classList.add("is-current");
      closePanels();
    })
  );

  /* ---------------- manifesto ---------------- */
  $$("[data-manifesto-open]").forEach((b) =>
    b.addEventListener("click", () => {
      closePanels();
      nav.classList.add("open-manifesto");
    })
  );
  $$("[data-manifesto-close]").forEach((b) => b.addEventListener("click", closePanels));

  /* ---------------- contact panel ---------------- */
  $$("[data-contact-open]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.preventDefault();
      nav.classList.remove("open-nav");
      nav.classList.add("open-contact");
    })
  );
  $$("[data-contact-close]").forEach((b) => b.addEventListener("click", () => nav.classList.remove("open-contact")));
  const cform = $("[data-contact-form]");
  if (cform) cform.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = cform.querySelector(".cf-send");
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      const res = await fetch("https://formsubmit.co/ajax/info@tde.rocks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: cform.name.value,
          email: cform.email.value,
          message: cform.message.value,
          _subject: "TDE website contact",
        }),
      });
      if (!res.ok) throw new Error("send failed");
      cform.querySelectorAll("input, textarea, button").forEach((el) => (el.disabled = true));
      $("[data-contact-ok]").hidden = false;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Send";
      let fail = cform.querySelector(".cf-fail");
      if (!fail) {
        fail = document.createElement("p");
        fail.className = "cf-fail text-body";
        fail.style.color = "#ff9d9d";
        cform.appendChild(fail);
      }
      fail.textContent = "Something went wrong - please email info@tde.rocks directly.";
    }
  });

  /* ---------------- arm links carousel (mobile) ---------------- */
  const armTrack = $("[data-arm-track]");
  if (armTrack) {
    const arms = $$(".is-arm", armTrack);
    let armIdx = 0;
    const showArm = (i) => {
      armIdx = (i + arms.length) % arms.length;
      arms.forEach((a, k) => a.classList.toggle("active", k === armIdx));
      window.dispatchEvent(new CustomEvent("vela:arm", { detail: armIdx }));
    };
    $("[data-arm-prev]")?.addEventListener("click", () => showArm(armIdx - 1));
    $("[data-arm-next]")?.addEventListener("click", () => showArm(armIdx + 1));
    setInterval(() => showArm(armIdx + 1), 5000);
  }

  /* ------- hero copy follows the hovered section ------- */
  const heroTitle = $(".hero-title-w h1");
  const heroSub = $(".content-layout.is-home > .text-body");
  // one word per line: the title column never reaches the rings
  const HERO_COPY = {
    default: {
      t: "WHERE CONVERSATION<br>BECOMES EXECUTION.",
      s: "",
    },
    citizen: { t: "CITIZEN FACING AI", s: "Public services, completed in one conversation. VelaOS listens, understands, and gets the procedure done, on the systems your government runs." },
    consumer: { t: "CONSUMER FACING AI", s: "Conversations that close the loop. VelaOS listens, understands, and resolves it for good, inside the tools your business already trusts." },
    assistant: { t: "YOUR PRIVATE<br>PERSONAL ASSISTANT", s: "Intelligence that's truly yours. VelaOS listens and acts on your behalf, keeping your data, memory, and privacy entirely your own." },
    outer: { t: "TECHNOLOGY<br>DESIGN<br>EXPERIENCE", s: "TDE builds AI that listens, understands, and gets things done, turning conversation into action on every surface, in every language." },
  };
  if (heroTitle) {
    heroTitle.innerHTML = HERO_COPY.default.t;
    if (heroSub) heroSub.textContent = HERO_COPY.default.s;
    let heroState = "default";
    let heroFadeT = null;
    window.addEventListener("vela:hover", (e) => {
      const k = e.detail.key || (e.detail.outer ? "outer" : "default");
      if (k === heroState) return;
      heroState = k;
      const copy = HERO_COPY[k] || HERO_COPY.default;
      clearTimeout(heroFadeT);
      heroTitle.style.opacity = "0";
      if (heroSub) heroSub.style.opacity = "0";
      heroFadeT = setTimeout(() => {
        heroTitle.innerHTML = copy.t;
        if (heroSub) heroSub.textContent = copy.s;
        heroTitle.style.opacity = "";
        if (heroSub) heroSub.style.opacity = "";
      }, 220);
    });
  }

  /* ---------------- cookie banner ---------------- */
  const cookie = $("[data-cookie]");
  const cookieChoice = localStorage.getItem("vela-cookies");
  if (cookie && !cookieChoice) {
    // wait for the ring formation to settle before intruding
    let cookieShown = false;
    const showCookie = () => {
      if (cookieShown) return;
      cookieShown = true;
      setTimeout(() => cookie.classList.remove("hide"), 2500);
    };
    window.addEventListener("vela:settled", showCookie, { once: true });
    setTimeout(showCookie, 16000); // fallback if GL never reports
    const dismiss = (v) => () => {
      localStorage.setItem("vela-cookies", v);
      cookie.classList.add("hide");
    };
    $("[data-cookie-accept]").addEventListener("click", dismiss("all"));
    $("[data-cookie-deny]").addEventListener("click", dismiss("essential"));
  }

  /* ---------------- preloader sequence ---------------- */
  const pre = $("[data-preloader]");
  const counterEl = $("[data-preloader-counter]");
  const intro = $("[data-intro]");
  /* A3: the counter shows REAL loading progress (GLB download + page load).
     Slow connection => the counter simply takes longer; same choreography. */
  let assetsDone = false;
  let loadTarget = 0;   // real progress feed (the GLB dominates the payload)
  let disp = 0;         // smoothed display value

  window.addEventListener("load", () => (assetsDone = true));
  setTimeout(() => (assetsDone = true), 15000); // network safety net

  window.addEventListener("vela:loadprogress", (e) => {
    loadTarget = Math.max(loadTarget, Math.min(97, Math.round(e.detail * 0.97)));
  });

  let countTimer = null;
  function step() {
    const target = (glbReady && assetsDone) ? 100 : Math.min(loadTarget, 97);
    disp = Math.min(target, disp + 7); // ≤140/s: stays legible on fast loads
    counterEl.textContent = String(Math.round(disp)).padStart(2, "0");
    if (disp >= 100) {
      clearInterval(countTimer);
      finish();
    }
  }

  /* the counter can only reach 100 once the Blender scene is loaded */
  let glbReady = false;
  window.addEventListener("vela:glready", () => (glbReady = true), { once: true });
  setTimeout(() => (glbReady = true), 12000); // never hang forever

  function proceedReveal() {
    document.body.classList.add("page-ready");
    window.dispatchEvent(new CustomEvent("vela:reveal"));
    showHomeIntroOverlay();
  }

  function finish() {
    counterEl.textContent = "100";
    const hold = prefersReduced ? 100 : 700;
    setTimeout(() => {
      // FLIP the wordmark dot: it stays while the letters exit, then flies
      // to the dial centre where the 3D dot of the animation takes over
      const dot = $(".preloader-wordmark .wm-dot");
      if (dot) {
        // B: the dot does NOT travel — pinned exactly where it already sits.
        // A same-size spacer holds its slot so logo/ROCKS don't reflow (no movement).
        const r = dot.getBoundingClientRect();
        const ph = document.createElement("span");
        // exact slot: layout size + the dot's own margins (0.12em each side)
        const cs = getComputedStyle(dot);
        ph.style.cssText = `width:${dot.offsetWidth}px;height:${dot.offsetHeight}px;` +
          `margin:${cs.margin};flex:0 0 auto;`;
        dot.parentNode.insertBefore(ph, dot);
        dot.style.left = r.left + r.width / 2 + "px";
        dot.style.top = r.top + r.height / 2 + "px";
        dot.style.width = r.width + "px";
        dot.style.height = r.height + "px";
        dot.classList.add("dot-free");
        // while the letters dissolve, the dot glides to the screen centre
        requestAnimationFrame(() => requestAnimationFrame(() =>
          dot.classList.add("dot-centered")));
      }
      pre.classList.add("break"); // logo + ROCKS just FADE (no movement)
      // dot growth and ring zoom-out run TOGETHER: the moment the dot starts
      // to grow, the reveal fires — the combination IS the transition
      setTimeout(() => {
        if (dot) dot.classList.add("dot-cover");
        pre.classList.add("done"); // veil lifts while the dot is still growing
        proceedReveal();           // rings + ball zoom out into place behind it
      }, prefersReduced ? 60 : 700);
    }, hold);
  }

  function showHomeIntroOverlay() {
    if (!intro || sessionStorage.getItem("vela-intro-seen")) return;
    intro.classList.add("show");
    const closeIntro = () => {
      intro.classList.remove("show");
      sessionStorage.setItem("vela-intro-seen", "1");
      ["wheel", "click", "touchstart", "keydown"].forEach((ev) =>
        window.removeEventListener(ev, closeIntro)
      );
    };
    ["wheel", "click", "touchstart", "keydown"].forEach((ev) =>
      window.addEventListener(ev, closeIntro, { passive: true })
    );
    setTimeout(closeIntro, 6000);
  }

  // reveal wordmark immediately, then start counting once fonts land
  setTimeout(() => pre.classList.add("ready"), 200);
  setTimeout(() => (countTimer = setInterval(step, 50)), 650);

  /* ---------------- smooth scroll (Lenis) + section wiring -------- */
  let lenis = null;
  if (window.Lenis && !prefersReduced) {
    // home is a single screen: smooth scroll disabled
    // lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  }

  function emitScroll() {
    const heroP = Math.min(1, Math.max(0, window.scrollY / (innerHeight * 0.85)));
    window.dispatchEvent(new CustomEvent("vela:scroll", { detail: heroP }));
  }
  if (lenis) lenis.on("scroll", emitScroll);
  window.addEventListener("scroll", emitScroll, { passive: true });

  function scrollToHash(hash) {
    const el = hash && hash !== "#" ? document.querySelector(hash) : document.body;
    if (!el) return;
    if (lenis) lenis.scrollTo(hash === "#" ? 0 : el, { offset: 0 });
    else el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
  }

  /* ---- section view: globe zoom becomes the section page ---- */
  const SECTION_META = {
    "#citizen": { key: "citizen", title: "Citizen-Facing AI", video: "assets/hdr-citizen.mp4" },
    "#consumer": { key: "consumer", title: "Consumer-Facing AI", video: "assets/hdr-consumer.mp4" },
    "#assistant": { key: "assistant", title: "Private Personal Assistant", video: "assets/hdr-assistant.mp4" },
    "#tde": { key: "default", title: "Technology Design Experience", video: "assets/hdr-tde.mp4" },
  };
  const sview = $("[data-section-view]");
  const svVideo = $("[data-sv-video]");
  const svTitle = $("[data-sv-title]");
  const svContent = $("[data-sv-content]");
  const svScroll = $("[data-sv-scroll]");
  let svOpenHash = null;
  const svPlaceholder = document.createComment("sv-block-home");

  function openSection(hash) {
    const meta = SECTION_META[hash];
    if (!meta || svOpenHash) return;
    svOpenHash = hash;
    svTitle.textContent = meta.title;
    svVideo.src = meta.video;
    svVideo.play().catch(() => {});
    const block = document.querySelector(hash);
    if (block) {
      block.parentNode.insertBefore(svPlaceholder, block);
      svContent.appendChild(block);
    }
    window.dispatchEvent(new CustomEvent("vela:zoom", { detail: meta.key }));
    setTimeout(() => {
      sview.classList.add("open");
      svScroll.scrollTop = 0;
    }, 620); // let the globe swallow the screen first
  }

  function closeSection() {
    if (!svOpenHash) return;
    const block = svContent.querySelector(".section-block");
    if (block && svPlaceholder.parentNode) {
      svPlaceholder.parentNode.insertBefore(block, svPlaceholder);
      svPlaceholder.remove();
    }
    svOpenHash = null;
    sview.classList.remove("open");
    svVideo.pause();
    window.dispatchEvent(new CustomEvent("vela:zoomout"));
  }

  $("[data-sv-close]")?.addEventListener("click", closeSection);
  $("[data-sv-scrolldown]")?.addEventListener("click", () =>
    svScroll.scrollTo({ top: innerHeight, behavior: "smooth" })
  );

  /* header video parallax: while the section page scrolls, the video moves at
     ~45% of the scroll speed and zooms out slightly — classic depth effect */
  svScroll.addEventListener("scroll", () => {
    const y = svScroll.scrollTop;
    const p = Math.min(1, y / innerHeight);
    svVideo.style.transform = `translateY(${y * 0.45}px) scale(${1.12 - p * 0.12})`;
  }, { passive: true });

  // dial click → open its section page
  window.addEventListener("vela:section", (e) => openSection(e.detail));
  // menu / arm links / CTAs
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    if (SECTION_META[href]) {
      closeSection();
      openSection(href);
    } else {
      closeSection(); // Home / '#'
    }
  });

  // staged reveal of sections
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.target.classList.toggle("in-view", en.isIntersecting)),
    { threshold: 0.25 }
  );
  $$("[data-section]").forEach((s) => io.observe(s));
})();
