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

  if (reducedMotion) return;

  if (finePointer) {
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
  }

  const hero = document.querySelector(".hero-shell");
  const heroCopy = document.querySelector(".hero-copy");
  const heroStatus = document.querySelector(".hero-status");
  const heroRoad = document.querySelector(".hero-road");
  const heroVehicle = document.querySelector(".hero-vehicle-stage");
  const roadBaseX = finePointer ? 50 : 39;
  let pointerX = 0;
  let pointerY = 0;

  const updateHeroScene = () => {
    const drive = Math.min(Math.max(window.scrollY / hero.offsetHeight, 0), 1);
    const mobileDrive = finePointer ? drive : Math.min(drive * 1.4, 1);
    heroRoad.style.backgroundPosition = `calc(${roadBaseX}% + ${pointerX * -10}px) calc(50% + ${pointerY * -7 - drive * 14}px)`;
    heroVehicle.style.transform = `translate3d(${pointerX * 24 - mobileDrive * 8}px, ${pointerY * 15 - mobileDrive * 32}px, ${mobileDrive * 90}px) scale(${1 + mobileDrive * 0.13}) rotateX(${pointerY * -1.8}deg) rotateY(${pointerX * -3.5}deg)`;
  };
  updateHeroScene();
  window.addEventListener("scroll", updateHeroScene, { passive: true });

  heroCopy.addEventListener(
    "animationend",
    () => {
      heroCopy.style.animation = "none";
    },
    { once: true },
  );
  if (finePointer) {
    hero.addEventListener("pointermove", (event) => {
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
      updateHeroScene();
      heroCopy.style.transform = `translate3d(${pointerX * -12}px, ${pointerY * -9}px, 20px)`;
      heroStatus.style.animation = "none";
      heroStatus.style.transform = `translate3d(${pointerX * 18}px, ${pointerY * 12}px, 35px) rotateY(${pointerX * -5}deg)`;
    });
    hero.addEventListener("pointerleave", () => {
      pointerX = 0;
      pointerY = 0;
      updateHeroScene();
      heroCopy.style.transform = "";
      heroStatus.style.transform = "";
      heroStatus.style.animation = "";
    });
  }
})();
