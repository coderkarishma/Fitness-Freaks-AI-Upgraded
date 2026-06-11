/* =====================================================
   FitnessFreak AI — main.js
   Global: preloader, header scroll, mobile nav,
           scroll-top, AOS init, toast utility
   ===================================================== */

// ── Preloader ─────────────────────────────────────────
window.addEventListener('load', () => {
  const pre = document.getElementById('preloader');
  if (pre) {
    setTimeout(() => pre.classList.add('done'), 600);
    setTimeout(() => pre.remove(), 1200);
  }
  AOS.init({ duration: 600, easing: 'ease-out-cubic', once: true, offset: 60 });
});

// ── Header scroll state ───────────────────────────────
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 20);
  // scroll-top button
  const st = document.querySelector('.scroll-top');
  if (st) st.classList.toggle('active', window.scrollY > 300);
}, { passive: true });

// ── Mobile nav ────────────────────────────────────────
const mobileToggle  = document.getElementById('mobileNavToggle');
const mobileNavIcon = document.getElementById('mobileNavIcon');
const navbar        = document.getElementById('navbar');
const overlay       = document.getElementById('mobileNavOverlay');

function openMobileNav() {
  navbar?.classList.add('mobile-open');
  overlay?.classList.add('active');
  if (mobileNavIcon) { mobileNavIcon.classList.remove('bi-list'); mobileNavIcon.classList.add('bi-x'); }
}
function closeMobileNav() {
  navbar?.classList.remove('mobile-open');
  overlay?.classList.remove('active');
  if (mobileNavIcon) { mobileNavIcon.classList.remove('bi-x'); mobileNavIcon.classList.add('bi-list'); }
}
mobileToggle?.addEventListener('click', () =>
  navbar?.classList.contains('mobile-open') ? closeMobileNav() : openMobileNav()
);
overlay?.addEventListener('click', closeMobileNav);

// Close nav on link click (mobile)
document.querySelectorAll('#navbar a').forEach(a =>
  a.addEventListener('click', closeMobileNav)
);

// ── Scroll-top ────────────────────────────────────────
document.querySelector('.scroll-top')?.addEventListener('click', e => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── GLightbox ─────────────────────────────────────────
if (typeof GLightbox !== 'undefined') {
  GLightbox({ selector: '.glightbox', touchNavigation: true, loop: true });
}

// ── Toast utility (global) ────────────────────────────
window.showToast = function(msg, type = 'default', duration = 3000) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'ff-toast show' + (type !== 'default' ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
};
