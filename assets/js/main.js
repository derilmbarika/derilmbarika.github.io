/* Deril Mbarika portfolio scripts.
   Two independent layers so a failure in one never breaks the other:
     1) Motion  - progressive enhancement, skipped without GSAP or on reduced motion.
     2) Collab form - always runs; posts to Web3Forms, falls back to a pre-filled email. */

/* ── 1. Motion layer ─────────────────────────────────────────────────── */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // If GSAP failed to load or the user prefers reduced motion, do nothing.
  // Nothing is pre-hidden in CSS, so all content stays fully visible.
  if (reduce || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });

  // Hero: staggered line reveal, then supporting copy, then the film frame.
  gsap.from(".hero-title .line > span", {
    yPercent: 115, duration: 1.0, ease: "power4.out", stagger: 0.09, delay: 0.15
  });
  gsap.from(".hero-sub, .hero-actions", {
    opacity: 0, y: 18, duration: 0.8, ease: "power3.out", stagger: 0.1, delay: 0.55
  });
  gsap.from(".hero-frame", {
    opacity: 0, y: 30, rotate: 4, duration: 1.1, ease: "power3.out", delay: 0.35
  });
  // Depth: the film frame drifts slightly as the hero scrolls away.
  gsap.to(".hero-frame", {
    yPercent: -6, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });

  // Section headings and text blocks: fade up once on enter.
  var blocks = gsap.utils.toArray(
    [".section-head", ".about-photo", ".about-inner", ".kit-aside", ".collab-top", ".covered", ".contact-copy", ".cform", ".news-inner"]
  );
  blocks.forEach(function (el) {
    gsap.from(el, {
      opacity: 0, y: 24, duration: 0.7, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%", once: true }
    });
  });

  // Card grids and rows: batched stagger as each group enters.
  [".tile", ".ltile", ".gear-row", ".offer"].forEach(function (sel) {
    ScrollTrigger.batch(sel, {
      start: "top 88%",
      once: true,
      onEnter: function (batch) {
        gsap.from(batch, { opacity: 0, y: 26, duration: 0.7, ease: "power3.out", stagger: 0.08 });
      }
    });
  });
})();

/* ── 2. Collaboration form ───────────────────────────────────────────── */
(function () {
  var form = document.getElementById("collab-form");
  if (!form) return;

  var statusEl = form.querySelector(".cform-status");
  var submitBtn = form.querySelector(".cform-submit");
  var keyField = form.querySelector('input[name="access_key"]');
  var key = keyField ? keyField.value.trim() : "";
  // Real submission only when a Web3Forms key has been pasted in.
  var useApi = key && key.indexOf("REPLACE_WITH") === -1;

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = "cform-status" + (kind ? " is-" + kind : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Honeypot: real users never check this hidden box.
    var hp = form.querySelector('[name="botcheck"]');
    if (hp && hp.checked) return;

    if (!form.checkValidity()) { form.reportValidity(); return; }

    var data = {
      name: val("cf-name"),
      email: val("cf-email"),
      brand: val("cf-brand"),
      budget: val("cf-budget"),
      message: val("cf-message")
    };

    // Fallback path: no backend key yet, so open a pre-filled email.
    if (!useApi) {
      var subject = encodeURIComponent("Collaboration inquiry" + (data.brand ? " - " + data.brand : ""));
      var body = encodeURIComponent(
        "Name: " + data.name + "\n" +
        "Email: " + data.email + "\n" +
        "Brand: " + data.brand + "\n" +
        "Budget: " + data.budget + "\n\n" +
        data.message
      );
      window.location.href =
        "mailto:collaborations@derilmbarika.com?subject=" + subject + "&body=" + body;
      setStatus("Opening your email app to send.");
      return;
    }

    // API path: post JSON to Web3Forms, report inline.
    var original = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    setStatus("Sending...");

    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: key,
        subject: "New collaboration inquiry from derilmbarika.com",
        from_name: "derilmbarika.com",
        name: data.name,
        email: data.email,
        brand: data.brand,
        budget: data.budget,
        message: data.message
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.success) {
          form.reset();
          setStatus("Thanks. Your inquiry is in. I will reply soon.", "ok");
        } else {
          setStatus("Something went wrong. Please email collaborations@derilmbarika.com.", "err");
        }
      })
      .catch(function () {
        setStatus("Network error. Please email collaborations@derilmbarika.com.", "err");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = original;
      });
  });
})();

/* ── 3. Rotating 3D brand sphere ─────────────────────────────────────────
   Reads the flat brand list and lays each brand out on a sphere that
   auto-rotates and responds to drag. Depth drives scale, opacity and stacking
   so front brands read large and bright, back ones recede. Degrades to the
   flat list under reduced motion or without JS. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wrap = document.getElementById("brand-cloud");
  if (!wrap || reduce) return;

  var items = Array.prototype.map.call(wrap.querySelectorAll(".covered .brand"), function (li) {
    return {
      name: li.getAttribute("data-name") || li.textContent.trim(),
      slug: (li.getAttribute("data-slug") || "").trim(),
      logo: (li.getAttribute("data-logo") || "").trim(),
      color: (li.getAttribute("data-color") || "").trim()
    };
  });
  if (items.length < 4) return;

  var sphere = document.createElement("div");
  sphere.className = "sphere";
  sphere.innerHTML =
    '<div class="sphere__glow"></div>' +
    '<div class="sphere__orbits">' +
      '<div class="orbit orbit--1"></div><div class="orbit orbit--2"></div><div class="orbit orbit--3"></div>' +
      '<div class="electron electron--1"><i class="electron__dot"></i></div>' +
      '<div class="electron electron--2"><i class="electron__dot"></i></div>' +
      '<div class="electron electron--3"><i class="electron__dot"></i></div>' +
      '<div class="electron electron--4"><i class="electron__dot"></i></div>' +
      '<div class="electron electron--5"><i class="electron__dot"></i></div>' +
    '</div>';
  var stage = document.createElement("div");
  stage.className = "sphere__stage";
  sphere.appendChild(stage);

  // Each brand is a light tile (so any logo colour, even black, stays visible)
  // carrying its real logo, with a caption below. data-logo overrides the source
  // for brands that have a nicer full-colour logo elsewhere.
  function tileHTML(it) {
    var src = it.logo || (it.slug ? "https://cdn.simpleicons.org/" + it.slug : "");
    var inner = src
      ? '<img src="' + src + '" alt="' + it.name + '">'
      : '<span class="node__word" style="color:' + (it.color || "#1b1b1b") + '">' + it.name + "</span>";
    return '<span class="node__tile">' + inner + "</span><span class=\"node__cap\">" + it.name + "</span>";
  }

  // Fibonacci sphere: evenly distribute N points on a unit sphere.
  var nodes = items.map(function (it, i) {
    var offset = 2 / items.length;
    var y = i * offset - 1 + offset / 2;
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var phi = i * Math.PI * (3 - Math.sqrt(5));
    var el = document.createElement("div");
    el.className = "node";
    el.innerHTML = tileHTML(it);
    var img = el.querySelector("img");
    if (img) {
      img.onerror = function () {
        el.querySelector(".node__tile").innerHTML =
          '<span class="node__word" style="color:' + (it.color || "#1b1b1b") + '">' + it.name + "</span>";
      };
    }
    stage.appendChild(el);
    return { el: el, tile: el.querySelector(".node__tile"), x: Math.cos(phi) * r, y: y, z: Math.sin(phi) * r };
  });

  wrap.appendChild(sphere);
  wrap.classList.add("is-3d");

  var hint = document.createElement("p");
  hint.className = "sphere-hint";
  hint.textContent = "Drag to spin. Always adding more.";
  wrap.appendChild(hint);

  var R = 170, rect = null;
  function measure() {
    R = Math.max(130, Math.min(sphere.clientWidth, sphere.clientHeight) / 2 - 52);
    rect = sphere.getBoundingClientRect();
  }
  measure();
  window.addEventListener("resize", measure);
  window.addEventListener("scroll", function () { rect = sphere.getBoundingClientRect(); }, { passive: true });

  // Motion: a steady idle tumble, plus pointer-follow so it drifts toward the
  // cursor even without dragging. Dragging takes direct control.
  var rotX = -0.3, rotY = 0;
  var velX = 0, velY = 0.006;
  var targetVX = 0, targetVY = 0.006;
  var dragging = false, lastX = 0, lastY = 0;

  function render() {
    if (dragging) {
      // velocity set directly by drag handler
    } else {
      velY += (targetVY - velY) * 0.05;
      velX += (targetVX - velX) * 0.05;
    }
    rotY += velY;
    rotX += velX;
    rotX = Math.max(-1.1, Math.min(1.1, rotX)); // keep poles from flipping

    var sinX = Math.sin(rotX), cosX = Math.cos(rotX);
    var sinY = Math.sin(rotY), cosY = Math.cos(rotY);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var x1 = n.x * cosY - n.z * sinY;
      var z1 = n.x * sinY + n.z * cosY;
      var y1 = n.y * cosX - z1 * sinX;
      var z2 = n.y * sinX + z1 * cosX;
      var depth = (z2 + 1) / 2; // 0 back .. 1 front
      var scale = 0.5 + depth * 0.75;
      n.el.style.transform =
        "translate(-50%,-50%) translate3d(" + (x1 * R).toFixed(1) + "px," + (y1 * R).toFixed(1) + "px,0) scale(" + scale.toFixed(3) + ")";
      n.el.style.opacity = (0.3 + depth * 0.7).toFixed(3);
      n.el.style.zIndex = String(Math.round(depth * 100));
      var blur = (1 - depth) * 2.2;
      n.tile.style.filter = blur > 0.15 ? "blur(" + blur.toFixed(2) + "px)" : "none";
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // Pointer-follow when idle: cursor position sets the target spin/tilt.
  window.addEventListener("pointermove", function (e) {
    if (dragging || !rect) return;
    var nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    var ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    if (nx < -1.6 || nx > 1.6 || ny < -1.6 || ny > 1.6) {
      targetVY = 0.006; targetVX = 0; return; // cursor far away: idle spin
    }
    targetVY = 0.006 + nx * 0.02;
    targetVX = -ny * 0.014;
  });

  // Drag for direct control, with momentum on release.
  function down(e) {
    dragging = true;
    var p = e.touches ? e.touches[0] : e;
    lastX = p.clientX; lastY = p.clientY;
  }
  function moveDrag(e) {
    if (!dragging) return;
    var p = e.touches ? e.touches[0] : e;
    var dx = p.clientX - lastX, dy = p.clientY - lastY;
    lastX = p.clientX; lastY = p.clientY;
    velY = dx * 0.007;
    velX = -dy * 0.007;
    rotY += velY;
    rotX += velX;
    if (e.cancelable) e.preventDefault();
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    targetVY = 0.006; targetVX = 0; // ease back to idle spin
  }
  sphere.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", moveDrag, { passive: false });
  window.addEventListener("pointerup", up);
})();

/* ── 4. Hero interactive particle field ──────────────────────────────────
   A drifting constellation behind the intro. Moving the cursor pulls a web of
   lines toward it and leaves a fading trail, so the effect "carries" as the
   pointer drives through. Skipped under reduced motion or without canvas. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.querySelector(".hero-fx");
  if (!canvas || reduce || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var hero = canvas.closest(".hero") || canvas.parentElement;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, particles = [], trail = [];
  var mouse = { x: -9999, y: -9999, on: false };
  var LINK = 130, MOUSE_LINK = 200, running = true;

  function resize() {
    var r = hero.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.max(28, Math.min(92, Math.round((W * H) / 15000)));
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28
      });
    }
  }
  resize();
  window.addEventListener("resize", resize);

  hero.addEventListener("pointermove", function (e) {
    var r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
    trail.push({ x: mouse.x, y: mouse.y, life: 1 });
    if (trail.length > 18) trail.shift();
  });
  hero.addEventListener("pointerleave", function () { mouse.on = false; });

  // Pause the loop when the hero scrolls out of view.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) { running = ents[0].isIntersecting; })
      .observe(hero);
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!running) return;
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      // Cursor pushes particles aside so it "carries" through the field.
      if (mouse.on) {
        var dx = p.x - mouse.x, dy = p.y - mouse.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < 15000 && d2 > 0.01) {
          var f = (15000 - d2) / 15000 * 0.9;
          var d = Math.sqrt(d2);
          p.vx += (dx / d) * f * 0.14;
          p.vy += (dy / d) * f * 0.14;
        }
      }
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      // gentle idle drift so it never fully stops
      p.vx += (Math.random() - 0.5) * 0.02;
      p.vy += (Math.random() - 0.5) * 0.02;
      if (p.x < 0) p.x += W; else if (p.x > W) p.x -= W;
      if (p.y < 0) p.y += H; else if (p.y > H) p.y -= H;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.4, 0, 6.2832);
      ctx.fillStyle = "rgba(240,239,236,0.55)";
      ctx.fill();
    }

    // Links between nearby particles.
    for (var a = 0; a < particles.length; a++) {
      for (var b = a + 1; b < particles.length; b++) {
        var pa = particles[a], pb = particles[b];
        var ex = pa.x - pb.x, ey = pa.y - pb.y;
        var dist = Math.sqrt(ex * ex + ey * ey);
        if (dist < LINK) {
          ctx.strokeStyle = "rgba(240,239,236," + (0.10 * (1 - dist / LINK)).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        }
      }
    }

    // Web of accent lines reaching toward the cursor.
    if (mouse.on) {
      for (var k = 0; k < particles.length; k++) {
        var q = particles[k];
        var mx = q.x - mouse.x, my = q.y - mouse.y;
        var md = Math.sqrt(mx * mx + my * my);
        if (md < MOUSE_LINK) {
          ctx.strokeStyle = "rgba(224,82,74," + (0.5 * (1 - md / MOUSE_LINK)).toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
    }

    // Fading cursor trail.
    for (var t = 0; t < trail.length; t++) {
      var pt = trail[t];
      pt.life *= 0.9;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2 + pt.life * 2, 0, 6.2832);
      ctx.fillStyle = "rgba(255,106,96," + (pt.life * 0.4).toFixed(3) + ")";
      ctx.fill();
    }
  }
  requestAnimationFrame(frame);
})();

/* ── 5. Hover-to-preview on the latest videos ────────────────────────────
   On hover, swap the thumbnail for a muted autoplaying YouTube embed so the
   video previews in place; restore the thumbnail on leave. */
(function () {
  var tiles = document.querySelectorAll(".latest-rail .ltile");
  if (!tiles.length || !window.matchMedia("(hover: hover)").matches) return;

  Array.prototype.forEach.call(tiles, function (tile) {
    var img = tile.querySelector("img");
    if (!img) return;
    var m = tile.href.match(/[?&]v=([\w-]{11})/);
    if (!m) return;
    var id = m[1];

    // Wrap the thumbnail so the preview iframe can overlay it.
    var thumb = document.createElement("span");
    thumb.className = "ltile-thumb";
    img.parentNode.insertBefore(thumb, img);
    thumb.appendChild(img);

    var iframe = null, timer = null;
    tile.addEventListener("mouseenter", function () {
      timer = window.setTimeout(function () {
        if (iframe) return;
        iframe = document.createElement("iframe");
        iframe.className = "ltile-video";
        iframe.src = "https://www.youtube-nocookie.com/embed/" + id +
          "?autoplay=1&mute=1&controls=0&loop=1&playlist=" + id +
          "&modestbranding=1&playsinline=1&rel=0";
        iframe.setAttribute("allow", "autoplay; encrypted-media");
        iframe.setAttribute("tabindex", "-1");
        iframe.setAttribute("aria-hidden", "true");
        thumb.appendChild(iframe);
      }, 220); // small delay so a quick pass-through doesn't load a video
    });
    tile.addEventListener("mouseleave", function () {
      if (timer) { window.clearTimeout(timer); timer = null; }
      if (iframe) { iframe.remove(); iframe = null; }
    });
  });
})();

/* ── 6. Newsletter email capture (Kit / ConvertKit) ──────────────────────
   The form natively posts the email to Kit through a hidden iframe (no page
   navigation, no API key in the page). Until a real form id is set it falls
   back to opening a pre-filled email so nothing is broken. */
(function () {
  var form = document.getElementById("news-form");
  if (!form) return;
  var statusEl = form.parentNode.querySelector(".news-status");
  var configured = form.getAttribute("action").indexOf("KIT_FORM_ID") === -1;

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = "news-status" + (kind ? " is-" + kind : "");
  }

  form.addEventListener("submit", function (e) {
    var hp = form.querySelector('[name="botcheck"]');
    if (hp && hp.checked) { e.preventDefault(); return; }
    if (!form.checkValidity()) { e.preventDefault(); form.reportValidity(); return; }
    var email = document.getElementById("news-email").value.trim();

    if (!configured) {
      e.preventDefault();
      window.location.href =
        "mailto:collaborations@derilmbarika.com?subject=" +
        encodeURIComponent("Subscribe me") +
        "&body=" + encodeURIComponent("Please add me to your list: " + email);
      setStatus("Opening your email app to confirm.");
      return;
    }

    // Configured: let the native POST reach Kit via the hidden iframe.
    setStatus("Subscribing...");
    window.setTimeout(function () {
      setStatus("You're in. Check your inbox to confirm.", "ok");
      form.reset();
    }, 1200);
  });
})();
