/* Motion layer. Progressive enhancement only: without JS or with reduced
   motion, every element is fully visible and the page just scrolls. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || typeof gsap === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  // Recompute trigger positions once everything (images, fonts) has settled,
  // so scroll reveals fire at their true positions.
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });

  // Hero: staggered line reveal (storytelling: name the promise first).
  gsap.from(".hero-title .line > span", {
    yPercent: 115,
    duration: 1.0,
    ease: "power4.out",
    stagger: 0.09,
    delay: 0.15
  });
  gsap.from(".hero-sub, .hero-actions", {
    opacity: 0,
    y: 18,
    duration: 0.8,
    ease: "power3.out",
    stagger: 0.1,
    delay: 0.55
  });
  gsap.from(".hero-frame", {
    opacity: 0,
    y: 30,
    rotate: 4,
    duration: 1.1,
    ease: "power3.out",
    delay: 0.35
  });

  // Hero frame: slight parallax drift on scroll (depth of the film frame).
  gsap.to(".hero-frame", {
    yPercent: -7,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });

  // Sections: reveal on enter (hierarchy: one thing at a time).
  gsap.utils.toArray(
    ".work h2, .latest-head, .about h2, .about p, .kit h2, .kit-intro, .collab h2, .collab-lead, .collab-covered-label, .collab-covered, .collab-cta, .connect h2, .connect .platforms"
  ).forEach(function (el) {
    gsap.from(el, {
      opacity: 0,
      y: 24,
      duration: 0.7,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true }
    });
  });

  // Card grids: staggered reveal as each grid enters.
  [".tile", ".ltile", ".kit-card", ".collab-card"].forEach(function (sel) {
    ScrollTrigger.batch(sel, {
      start: "top 90%",
      once: true,
      onEnter: function (batch) {
        gsap.from(batch, { opacity: 0, y: 28, duration: 0.7, ease: "power3.out", stagger: 0.08 });
      }
    });
  });
})();
