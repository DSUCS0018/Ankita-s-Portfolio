import Lenis from 'lenis';

/* ══════════════════════════════════════════════════════════
   CANVAS FRAME-SEQUENCE ANIMATION
   (original code preserved exactly — only the frame-scrub
   mapping uses full-page scroll, which it already did)
   ══════════════════════════════════════════════════════════ */

const TOTAL_FRAMES = 300;
const frames = [];
let loadedCount = 0;

// DOM Elements
const canvas    = document.getElementById('frame-canvas');
const ctx       = canvas.getContext('2d', { alpha: false });
const loader    = document.getElementById('loader');
const progressBar  = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

// Animation State
let currentFrameIndex = 0;
let targetFrameIndex  = 0;
let isLoaded = false;

// ── Lenis Smooth Scroll ────────────────────────────────────
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  touchMultiplier: 2,
  infinite: false,
});

// Frame index is driven by TOTAL page scroll progress (0 → 1)
// so the animation persists across every section, not just hero.
function updateScroll() {
  const maxScroll  = document.documentElement.scrollHeight - window.innerHeight;
  const scrollTop  = window.scrollY || document.documentElement.scrollTop;
  const progress   = Math.max(0, Math.min(1, maxScroll > 0 ? scrollTop / maxScroll : 0));
  targetFrameIndex = progress * (TOTAL_FRAMES - 1);
}

lenis.on('scroll', updateScroll);

// RAF loop — smoothly lerps the frame index then renders
function raf(time) {
  lenis.raf(time);

  if (isLoaded) {
    currentFrameIndex += (targetFrameIndex - currentFrameIndex) * 0.12;
    renderFrame(Math.round(currentFrameIndex));
  }

  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ── Canvas Resizing with HDPI Support ─────────────────────
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  // Reset transform before re-applying DPR scale to avoid cumulative scaling
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (isLoaded) {
    renderFrame(Math.round(currentFrameIndex));
  }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Draw frame covering viewport while maintaining aspect ratio
function renderFrame(index) {
  const frameNum = Math.max(0, Math.min(TOTAL_FRAMES - 1, index));
  const img = frames[frameNum];

  if (!img || !img.complete || img.naturalWidth === 0) return;

  const viewportWidth  = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const imgWidth       = img.naturalWidth;
  const imgHeight      = img.naturalHeight;

  const imgRatio      = imgWidth / imgHeight;
  const viewportRatio = viewportWidth / viewportHeight;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (viewportRatio > imgRatio) {
    drawWidth  = viewportWidth;
    drawHeight = viewportWidth / imgRatio;
    offsetX    = 0;
    offsetY    = (viewportHeight - drawHeight) / 2;
  } else {
    drawWidth  = viewportHeight * imgRatio;
    drawHeight = viewportHeight;
    offsetX    = (viewportWidth - drawWidth) / 2;
    offsetY    = 0;
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

// ── Preload Image Frames ───────────────────────────────────
function preloadFrames() {
  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    const img      = new Image();
    const frameNum = String(i).padStart(3, '0');
    img.src = `/Frames/ezgif-frame-${frameNum}.jpg`;

    img.onload = () => {
      loadedCount++;
      const percent = Math.floor((loadedCount / TOTAL_FRAMES) * 100);
      progressBar.style.width  = `${percent}%`;
      progressText.textContent = `${percent}%`;

      if (loadedCount === TOTAL_FRAMES) {
        onPreloadComplete();
      }
    };

    img.onerror = () => {
      console.warn(`Failed to load frame ${frameNum}`);
      loadedCount++;
      if (loadedCount === TOTAL_FRAMES) {
        onPreloadComplete();
      }
    };

    frames.push(img);
  }
}

function onPreloadComplete() {
  isLoaded = true;
  updateScroll();
  renderFrame(0);

  setTimeout(() => {
    loader.classList.add('hidden');
    // Trigger reveal for all elements already visible in the viewport on load
    document.querySelectorAll('.reveal').forEach(el => {
      if (isInViewport(el)) {
        triggerReveal(el);
        revealObserver.unobserve(el);
      }
    });
  }, 400);
}

// Start loading
preloadFrames();

/* ══════════════════════════════════════════════════════════
   NAVBAR BEHAVIOR
   ══════════════════════════════════════════════════════════ */

const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('nav-hamburger');
let mobileDrawer = null;

// Scroll class for frosted-glass navbar
lenis.on('scroll', ({ scroll }) => {
  if (scroll > 40) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Smooth-scroll nav anchors via Lenis
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const targetId = link.getAttribute('href');
    if (targetId === '#') return;
    const target = document.querySelector(targetId);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -80, duration: 1.4 });
    // Close mobile drawer if open
    if (mobileDrawer && mobileDrawer.classList.contains('open')) {
      closeMobileDrawer();
    }
  });
});

// Mobile hamburger menu
function buildMobileDrawer() {
  mobileDrawer = document.createElement('div');
  mobileDrawer.className = 'nav-mobile-drawer';
  mobileDrawer.setAttribute('aria-label', 'Mobile navigation');

  const links = [
    ['#hero',         'Home'],
    ['#about',        'About'],
    ['#experience',   'Experience'],
    ['#projects',     'Projects'],
    ['#publications', 'Publications'],
    ['#contact',      'Contact'],
  ];

  links.forEach(([href, label]) => {
    const a = document.createElement('a');
    a.href = href;
    a.className = 'nav-link';
    a.textContent = label;
    mobileDrawer.appendChild(a);
  });

  // Re-attach Lenis smooth scroll to these links
  mobileDrawer.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -80, duration: 1.4 });
      closeMobileDrawer();
    });
  });

  document.body.appendChild(mobileDrawer);

  // Show drawer (needs one frame to transition in)
  requestAnimationFrame(() => {
    mobileDrawer.style.display = 'flex';
    requestAnimationFrame(() => mobileDrawer.classList.add('open'));
  });
}

function closeMobileDrawer() {
  if (!mobileDrawer) return;
  mobileDrawer.classList.remove('open');
  hamburger.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  setTimeout(() => {
    if (mobileDrawer) {
      mobileDrawer.style.display = 'none';
    }
  }, 300);
}

hamburger.addEventListener('click', () => {
  const isOpen = hamburger.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(isOpen));

  if (isOpen) {
    if (!mobileDrawer) {
      buildMobileDrawer();
    } else {
      // Reset opacity before showing to ensure CSS transition fires correctly
      mobileDrawer.style.display = 'flex';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => mobileDrawer.classList.add('open'));
      });
    }
  } else {
    closeMobileDrawer();
  }
});

/* ══════════════════════════════════════════════════════════
   SCROLL-REVEAL (IntersectionObserver)
   — fires fade + slide-up per .reveal element
   — staggered via CSS --delay custom property on each element
   ══════════════════════════════════════════════════════════ */

function isInViewport(el) {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
}

function triggerReveal(el) {
  el.classList.add('revealed');
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        triggerReveal(entry.target);
        // Once revealed, stop observing
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.08,
    rootMargin: '0px 0px -40px 0px',
  }
);

// Observe all .reveal elements once DOM is ready
document.querySelectorAll('.reveal').forEach(el => {
  revealObserver.observe(el);
});
