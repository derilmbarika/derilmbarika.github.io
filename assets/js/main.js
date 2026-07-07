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
    [".section-head", ".about-inner", ".kit-aside", ".collab-top", ".covered", ".contact-copy", ".cform"]
  );
  blocks.forEach(function (el) {
    gsap.from(el, {
      opacity: 0, y: 24, duration: 0.7, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%", once: true }
    });
  });

  // Card grids and rows: batched stagger as each group enters.
  [".tile", ".ltile", ".kit-row", ".offer"].forEach(function (sel) {
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
    return { name: li.getAttribute("data-name") || li.textContent.trim(), slug: (li.getAttribute("data-slug") || "").trim() };
  });
  if (items.length < 4) return;

  var sphere = document.createElement("div");
  sphere.className = "sphere";
  var stage = document.createElement("div");
  stage.className = "sphere__stage";
  sphere.appendChild(stage);

  // Fibonacci sphere: evenly distribute N points on a unit sphere.
  var nodes = items.map(function (it, i) {
    var offset = 2 / items.length;
    var y = i * offset - 1 + offset / 2;
    var r = Math.sqrt(Math.max(0, 1 - y * y));
    var phi = i * Math.PI * (3 - Math.sqrt(5));
    var el = document.createElement("div");
    el.className = "node";
    if (it.slug) {
      el.innerHTML =
        '<img src="https://cdn.simpleicons.org/' + it.slug + '/c9ccce" alt="' + it.name + '">' +
        '<span class="node__cap">' + it.name + "</span>";
      var img = el.querySelector("img");
      img.onerror = function () { el.innerHTML = '<span class="node__word">' + it.name + "</span>"; };
    } else {
      el.innerHTML = '<span class="node__word">' + it.name + "</span>";
    }
    stage.appendChild(el);
    return { el: el, x: Math.cos(phi) * r, y: y, z: Math.sin(phi) * r };
  });

  wrap.appendChild(sphere);
  wrap.classList.add("is-3d");

  var hint = document.createElement("p");
  hint.className = "sphere-hint";
  hint.textContent = "Drag to spin. Always adding more.";
  wrap.appendChild(hint);

  var R = 160;
  function sizeRadius() {
    var w = sphere.clientWidth, h = sphere.clientHeight;
    R = Math.max(120, Math.min(w, h) / 2 - 46);
  }
  sizeRadius();
  window.addEventListener("resize", sizeRadius);

  var rotX = -0.25, rotY = 0, velX = 0, velY = 0.0025, dragging = false, lastX = 0, lastY = 0;
  var BASE = 0.0025;

  function render() {
    if (!dragging) {
      rotY += velY;
      rotX += velX;
      velY += (BASE - velY) * 0.03; // ease back to a gentle idle spin
      velX *= 0.94;                 // let vertical tilt settle
    }
    var sinX = Math.sin(rotX), cosX = Math.cos(rotX);
    var sinY = Math.sin(rotY), cosY = Math.cos(rotY);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var x1 = n.x * cosY - n.z * sinY;
      var z1 = n.x * sinY + n.z * cosY;
      var y1 = n.y * cosX - z1 * sinX;
      var z2 = n.y * sinX + z1 * cosX;
      var depth = (z2 + 1) / 2;                 // 0 (back) .. 1 (front)
      var scale = 0.55 + depth * 0.7;
      n.el.style.transform =
        "translate(-50%,-50%) translate3d(" + (x1 * R).toFixed(1) + "px," + (y1 * R).toFixed(1) + "px,0) scale(" + scale.toFixed(3) + ")";
      n.el.style.opacity = (0.35 + depth * 0.65).toFixed(3);
      n.el.style.zIndex = String(Math.round(depth * 100));
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  function down(e) {
    dragging = true;
    var p = e.touches ? e.touches[0] : e;
    lastX = p.clientX; lastY = p.clientY;
    velX = velY = 0;
  }
  function move(e) {
    if (!dragging) return;
    var p = e.touches ? e.touches[0] : e;
    var dx = p.clientX - lastX, dy = p.clientY - lastY;
    lastX = p.clientX; lastY = p.clientY;
    rotY += dx * 0.006;
    rotX += -dy * 0.006;
    velY = dx * 0.006;
    velX = -dy * 0.006;
    if (e.cancelable) e.preventDefault();
  }
  function up() { dragging = false; }

  sphere.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", up);
})();
