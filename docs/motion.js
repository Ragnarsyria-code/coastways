(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const root = document.documentElement;
  root.classList.add("motion-enabled");

  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  document.body.append(progress);

  const updateProgress = () => {
    const available = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = available > 0 ? Math.min(window.scrollY / available, 1) : 0;
    progress.style.transform = `scaleX(${ratio})`;
  };
  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });

  const revealGroups = [
    ".confidence-bar article",
    ".section-intro > *",
    ".service-card",
    ".fleet-image",
    ".fleet-copy > *",
    ".section-heading > *",
    ".airport-grid article",
    ".booking-copy > *",
    ".booking-card",
    ".footer-main > *",
  ];
  const revealItems = [...document.querySelectorAll(revealGroups.join(","))];
  revealItems.forEach((item, index) => {
    item.classList.add("reveal-item");
    item.style.setProperty("--reveal-delay", `${(index % 4) * 85}ms`);
  });

  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("revealed"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.13, rootMargin: "0px 0px -45px" },
    );
    revealItems.forEach((item) => observer.observe(item));
  }

  if (reducedMotion || !finePointer) return;

  const tiltItems = document.querySelectorAll(".service-card, .airport-grid article");
  tiltItems.forEach((item) => {
    item.classList.add("tilt-surface");
    item.addEventListener("pointermove", (event) => {
      const bounds = item.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      const rotateY = (x - 0.5) * 8;
      const rotateX = (0.5 - y) * 8;
      item.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translate3d(0, -6px, 14px)`;
      item.style.setProperty("--glow-x", `${x * 100}%`);
      item.style.setProperty("--glow-y", `${y * 100}%`);
    });
    item.addEventListener("pointerleave", () => {
      item.style.transform = "";
      item.style.removeProperty("--glow-x");
      item.style.removeProperty("--glow-y");
    });
  });

  const hero = document.querySelector(".hero-shell");
  const heroCopy = document.querySelector(".hero-copy");
  const heroStatus = document.querySelector(".hero-status");
  heroCopy.addEventListener(
    "animationend",
    () => {
      heroCopy.style.animation = "none";
    },
    { once: true },
  );
  hero.addEventListener("pointermove", (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    hero.style.backgroundPosition = `center center, center center, calc(50% + ${x * 18}px) calc(50% + ${y * 12}px)`;
    heroCopy.style.transform = `translate3d(${x * -12}px, ${y * -9}px, 20px)`;
    heroStatus.style.animation = "none";
    heroStatus.style.transform = `translate3d(${x * 18}px, ${y * 12}px, 35px) rotateY(${x * -5}deg)`;
  });
  hero.addEventListener("pointerleave", () => {
    hero.style.backgroundPosition = "";
    heroCopy.style.transform = "";
    heroStatus.style.transform = "";
    heroStatus.style.animation = "";
  });
})();
