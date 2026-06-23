'use strict';

/* =============================================================
   PAGE ROUTES — update paths to match your folder structure
============================================================= */
var PAGES = {
  home  : 'index.html',
  grid  : 'webGridView.html',
  list  : 'webListView.html',
  detail: 'webDetail.html',
  cart  : 'web-cart.html',
};

/* =============================================================
   TINY DOM HELPERS
============================================================= */
var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
function slugify(text) {
  return (text || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}
function unslugify(slug) {
  return (slug || '').split('-').filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
}
function fmt(n) {
  return '$' + (+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* =============================================================
   TOAST NOTIFICATION
============================================================= */
function showToast(msg, type) {
  type = type || 'success';
  var toast = document.getElementById('site-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'site-toast';
    Object.assign(toast.style, {
      position: 'fixed', bottom: '24px', right: '24px',
      padding: '11px 20px', borderRadius: '6px', fontSize: '13px',
      fontWeight: '600', color: '#fff', zIndex: '99999',
      boxShadow: '0 4px 14px rgba(0,0,0,.22)', transition: 'opacity .3s',
      opacity: '0', maxWidth: '320px', lineHeight: '1.4', pointerEvents: 'none'
    });
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = type === 'error' ? '#d0312d' : type === 'info' ? '#4b9cf5' : type === 'warn' ? '#e07b00' : '#28a745';
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { toast.style.opacity = '0'; }, 2800);
}

/* =============================================================
   CART  (localStorage)
============================================================= */
var Cart = (function () {
  var KEY = 'ec_cart_v4';

  function load()      { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(items) { localStorage.setItem(KEY, JSON.stringify(items)); syncBadges(); }
  function count()     { return load().reduce(function (s, i) { return s + (i.qty || 1); }, 0); }

  function add(item, silent) {
    var items = load();
    var idx   = items.findIndex(function (i) { return i.id === item.id; });
    if (idx > -1) { items[idx].qty = (items[idx].qty || 1) + 1; }
    else { item.qty = item.qty || 1; items.push(item); }
    save(items);
    if (!silent) showToast('"' + item.name.slice(0, 36) + '" added to cart!');
  }

  function remove(id)        { save(load().filter(function (i) { return i.id !== id; })); }
  function updateQty(id, qty){ var items = load(); var idx = items.findIndex(function (i) { return i.id === id; }); if (idx > -1) { items[idx].qty = qty; save(items); } }
  function getAll()          { return load(); }
  function clear()           { save([]); }
  function subtotal()        { return load().reduce(function (s, i) { return s + parseFloat(i.price || 0) * (i.qty || 1); }, 0); }

  return { count, add, remove, updateQty, getAll, clear, subtotal };
})();

/* =============================================================
   WISHLIST  (localStorage)
============================================================= */
var Wishlist = (function () {
  var KEY = 'ec_wishlist_v2';
  function load()     { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(ids)  { localStorage.setItem(KEY, JSON.stringify(ids)); }
  function has(id)    { return load().indexOf(id) > -1; }
  function toggle(id) {
    var ids = load(), idx = ids.indexOf(id);
    if (idx > -1) { ids.splice(idx, 1); save(ids); return false; }
    ids.push(id); save(ids); return true;
  }
  return { has, toggle };
})();

/* =============================================================
   SAVED FOR LATER  (localStorage)
============================================================= */
var Saved = (function () {
  var KEY = 'ec_saved_v4';
  function load()       { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(items)  { localStorage.setItem(KEY, JSON.stringify(items)); }
  function add(item)    { var items = load(); if (!items.some(function (i) { return i.id === item.id; })) { items.push(item); save(items); } }
  function remove(id)   { save(load().filter(function (i) { return i.id !== id; })); }
  function getAll()     { return load(); }
  function seedIfEmpty(defaults) { if (localStorage.getItem(KEY) === null) save(defaults); }
  return { add, remove, getAll, seedIfEmpty };
})();

/* =============================================================
   SYNC CART BADGE — call after every cart mutation
============================================================= */
function syncBadges() {
  var n = Cart.count();
  $$('.cart-count, .cart-badge, #cartCount').forEach(function (el) { el.textContent = n; });
}

/* =============================================================
   ADD-TO-CART BUTTONS  (grid / list cards with .btn-add-to-cart)
============================================================= */
function initAddToCartButtons() {
  $$('.btn-add-to-cart').forEach(function (btn, i) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var card  = btn.closest('.product-card');
      var id    = (card && card.dataset.id) ? card.dataset.id : 'card-' + i;
      if (card && !card.dataset.id) card.dataset.id = id;
      var name  = ((card && card.querySelector('.card-name, .product-name')) || {}).textContent || 'Product';
      var price = parseFloat(((card && card.querySelector('.card-price, .price-now')) || {}).textContent || '0') || 0;
      var img   = ((card && card.querySelector('img')) || {}).src || '';
      Cart.add({ id: id, name: name.trim(), price: price, img: img });
    });
  });
}

/* =============================================================
   WIRE ALL NAV LINKS
   ┌─────────────────────────────────────────┬──────────────────┐
   │ Trigger                                 │ Destination      │
   ├─────────────────────────────────────────┼──────────────────┤
   │ Brand / footer logo                     │ index.html       │
   │ Cart icon / "My cart" in header         │ web-cart.html    │
   │ "Hot offers" nav link                   │ webGridView.html │
   │ "Gift boxes" nav link                   │ webListView.html │
   │ Search form submit                      │ webGridView.html │
   │ Category rail items (home)              │ webGridView.html │
   │ "Source now" buttons (home)             │ webGridView.html │
   │ Rec / deal / cat-item click (home)      │ webDetail.html   │
   │ Product card (img or name) on listings  │ webDetail.html   │
   │ "View details" links                    │ webDetail.html   │
   │ You may like / related items (detail)   │ webDetail.html   │
   │ "Back to shop" (cart page)              │ index.html       │
   │ Breadcrumb "Home"                       │ index.html       │
   │ Footer "Categories"                     │ webGridView.html │
   │ Footer "My Orders"                      │ web-cart.html    │
   └─────────────────────────────────────────┴──────────────────┘
============================================================= */
function wireNavLinks() {
  /* Brand logo → home */
  $$('a.brand, a.footer-brand-logo, .footer-brand a').forEach(function (a) { a.href = PAGES.home; });

  /* Cart icon in header */
  $$('.icon-action, .header-actions a').forEach(function (a) {
    if ((a.textContent || '').toLowerCase().includes('cart')) a.href = PAGES.cart;
  });

  /* Category rail (index.html) → grid view with ?cat= param */
  $$('.category-rail a').forEach(function (a) {
    var label = (a.textContent || '').trim();
    a.href = label.toLowerCase() === 'more category' ? PAGES.grid : PAGES.grid + '?cat=' + encodeURIComponent(slugify(label));
  });

  /* "Source now" buttons */
  $$('.btn-source').forEach(function (a) { a.href = PAGES.grid; });

  /* "Back to shop" in cart page */
  var backBtn = $('.btn-back-shop');
  if (backBtn) backBtn.href = PAGES.home;

  /* Nav bar top-level links */
  $$('.nav-row > a, .header-nav a').forEach(function (a) {
    var txt = (a.textContent || '').toLowerCase().trim();
    if (txt.startsWith('hot offer')) a.href = PAGES.grid;
    if (txt.startsWith('gift'))      a.href = PAGES.list;
  });

  /* Breadcrumb "Home" */
  $$('.breadcrumb a, .breadcrumb-bar a').forEach(function (a) {
    if ((a.textContent || '').toLowerCase().trim() === 'home') a.href = PAGES.home;
  });

  /* Footer quick-links */
  $$('.footer-col a').forEach(function (a) {
    var txt = (a.textContent || '').toLowerCase().trim();
    if (txt === 'categories') a.href = PAGES.grid;
    if (txt === 'my orders')  a.href = PAGES.cart;
  });

  /* "View details" links */
  $$('a.view-details, a.view-detail').forEach(function (a) { a.href = PAGES.detail; });

  /* Product cards on grid / list → detail */
  $$('.product-grid .product-card, .product-list .product-card').forEach(function (card) {
    [card.querySelector('.card-img, .product-img'), card.querySelector('.card-name, .product-name')]
      .forEach(function (el) {
        if (!el) return;
        el.style.cursor = 'pointer';
        el.addEventListener('click', function (e) {
          if (e.target.closest('.card-heart, .wishlist-btn, .btn-add-to-cart')) return;
          window.location.href = PAGES.detail;
        });
      });
  });

  /* Home page — rec / deal / category items → detail */
  $$('.rec-card, .deal-card, .cat-item').forEach(function (card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      window.location.href = PAGES.detail;
    });
  });
}

/* =============================================================
   HEADER  (shared)
============================================================= */
function initHeader() {
  /* Search form → grid view */
  $$('.search-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = form.querySelector('input[type="search"], input[type="text"]');
      var q   = inp ? inp.value.trim() : '';
      if (q) {
        showToast('Searching for "' + q + '"…', 'info');
        setTimeout(function () { window.location.href = PAGES.grid + '?q=' + encodeURIComponent(q); }, 700);
      } else {
        showToast('Please type something to search.', 'warn');
      }
    });
  });

  /* Search category dropdown — show toast when category changes */
  $$('.search-form select').forEach(function (sel) {
    sel.addEventListener('change', function () {
      var val = sel.options[sel.selectedIndex].text;
      if (val !== 'All category') showToast('Category filter: ' + val, 'info');
    });
  });

  /* "All category" / "Menu" button → open slide-in sidebar (all pages) */
  $$('.nav-hamburger').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var sidebar = document.getElementById('catSidebar');
      var overlay = document.getElementById('catOverlay');
      if (sidebar) sidebar.classList.add('open');
      if (overlay) overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  /* Close sidebar: X button */
  var _csClose = document.getElementById('catSidebarClose');
  if (_csClose) _csClose.addEventListener('click', _closeSidebar);

  /* Close sidebar: overlay click */
  var _csOverlay = document.getElementById('catOverlay');
  if (_csOverlay) _csOverlay.addEventListener('click', _closeSidebar);

  /* Close sidebar: Escape key */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') _closeSidebar(); });

  function _closeSidebar() {
    var s = document.getElementById('catSidebar');
    var o = document.getElementById('catOverlay');
    if (s) s.classList.remove('open');
    if (o) o.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* Nav locale dropdown (English, USD) — cosmetic toggle */
  $$('.nav-locale').forEach(function (el) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', function () {
      showToast('Language / currency settings coming soon.', 'info');
    });
  });

  /* Nav "Ship to" dropdown — cosmetic */
  $$('.nav-ship').forEach(function (el) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', function () {
      showToast('Shipping destination settings coming soon.', 'info');
    });
  });

  /* Sticky header shadow on scroll */
  var header = $('.site-header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.style.boxShadow = window.scrollY > 4 ? '0 2px 12px rgba(0,0,0,.10)' : '';
    }, { passive: true });
  }

  syncBadges();
}

/* =============================================================
   IMAGE ERROR FALLBACK
============================================================= */
function initImgFallback() {
  $$('img').forEach(function (img) {
    img.addEventListener('error', function () {
      this.src = 'https://placehold.co/200x200/e0e0e0/888?text=No+Image';
      this.onerror = null;
    });
  });
}

/* =============================================================
   NEWSLETTER  (shared)
============================================================= */
function initNewsletter() {
  $$('.newsletter-strip-form, .nl-form').forEach(function (form) {
    var btn   = form.querySelector('button[type="submit"], button');
    var input = form.querySelector('input[type="email"]');
    if (!btn || !input) return;
    function doSubscribe(e) {
      if (e) e.preventDefault();
      var email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address.', 'error'); return;
      }
      showToast("You're subscribed! 🎉");
      input.value = '';
    }
    form.addEventListener('submit', doSubscribe);
    btn.addEventListener('click',   doSubscribe);
  });

  /* Standalone subscribe buttons (webGridView / webListView use a div + button, not a form) */
  $$('.nl-form button, .newsletter-strip button').forEach(function (btn) {
    if (btn.closest('form')) return; /* already handled above */
    btn.addEventListener('click', function () {
      var wrap  = btn.closest('.nl-form, .newsletter-strip, .newsletter-strip-form');
      var input = wrap && wrap.querySelector('input[type="email"]');
      if (!input) return;
      var email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Please enter a valid email address.', 'error'); return;
      }
      showToast("You're subscribed! 🎉");
      input.value = '';
    });
  });
}

/* =============================================================
   COUNTDOWN TIMER  (index.html)
============================================================= */
function initCountdown() {
  var days  = document.getElementById('cd-days');
  var hours = document.getElementById('cd-hours');
  var mins  = document.getElementById('cd-mins');
  var secs  = document.getElementById('cd-secs');
  if (!days) return;

  var KEY = 'ec_cd_end';
  var end = parseInt(localStorage.getItem(KEY) || '0', 10);
  if (!end || end < Date.now()) {
    end = Date.now() + (4 * 86400 + 13 * 3600 + 46 * 60 + 38) * 1000;
    localStorage.setItem(KEY, end);
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  (function tick() {
    var diff = Math.max(0, end - Date.now());
    days.textContent  = pad(Math.floor(diff / 86400000));
    hours.textContent = pad(Math.floor((diff % 86400000) / 3600000));
    mins.textContent  = pad(Math.floor((diff % 3600000)  / 60000));
    secs.textContent  = pad(Math.floor((diff % 60000)    / 1000));
    if (diff > 0) requestAnimationFrame(tick);
  })();
}

/* =============================================================
   HOME PAGE  (index.html)
============================================================= */
function initHome() {
  initCountdown();

  /* Inquiry form */
  var inqBtn = $('.btn-inquiry');
  if (inqBtn) {
    inqBtn.addEventListener('click', function () {
      var item = ($('.inq-input')    || {}).value || '';
      var qty  = ($('.inq-qty')      || {}).value || '';
      item = item.trim(); qty = qty.trim();
      if (!item) { showToast('Please describe the item you need.', 'error'); return; }
      if (!qty)  { showToast('Please enter a quantity.', 'error'); return; }
      showToast('Inquiry sent for ' + qty + ' × "' + item + '"!');
      $$('.inq-input, .inq-textarea, .inq-qty').forEach(function (el) { el.value = ''; });
    });
  }

  /* "Join now" / "Log in" buttons on account widget */
  $$('.btn-join').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      showToast('Register feature coming soon!', 'info');
    });
  });
  $$('.btn-login').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      showToast('Login feature coming soon!', 'info');
    });
  });

  /* Load More recommended items */
  var loadBtn    = document.getElementById('loadMoreBtn');
  var recGrid    = document.getElementById('recGrid');
  var moreLoaded = false;
  if (loadBtn && recGrid) {
    loadBtn.addEventListener('click', function () {
      if (moreLoaded) { showToast('No more items.', 'info'); return; }
      var extras = [
        { price: '$24.99', label: 'Wireless Charging Pad',
          img: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=200&h=200&fit=crop' },
        { price: '$15.50', label: 'Portable Bluetooth Speaker',
          img: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=200&h=200&fit=crop' },
        { price: '$45.00', label: 'Noise-Cancelling Earbuds',
          img: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=200&h=200&fit=crop' },
        { price: '$9.99',  label: 'USB-C Fast Charger',
          img: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=200&h=200&fit=crop' },
      ];
      extras.forEach(function (ex) {
        var card = document.createElement('div');
        card.className    = 'rec-card';
        card.style.cursor = 'pointer';
        card.innerHTML    =
          '<div class="rec-img"><img src="' + ex.img + '" alt="' + ex.label + '" loading="lazy"/></div>' +
          '<div class="rec-info"><span class="rec-price">' + ex.price + '</span><p>' + ex.label + '</p></div>';
        card.addEventListener('click', function () { window.location.href = PAGES.detail; });
        recGrid.appendChild(card);
      });
      moreLoaded = true;
      loadBtn.textContent = 'No more items';
      showToast('More items loaded!', 'info');
    });
  }

  /* Promo-card buttons (orange / teal on account widget) */
  $$('.promo-card').forEach(function (card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function () {
      showToast('Offer applied! Shop and save.', 'success');
    });
  });
}

/* =============================================================
   APPLY CATEGORY FROM URL  (grid + list)
============================================================= */
function applyCategoryFromQuery() {
  var cat = getQueryParam('cat');
  if (!cat) return;
  var label = unslugify(cat);
  var lastCrumb = $('.breadcrumb > span:last-child, .breadcrumb span:last-child');
  if (lastCrumb) lastCrumb.textContent = label;
  var countEl = $('.listing-topbar .count');
  if (countEl) countEl.innerHTML = countEl.innerHTML.replace(/in\s+.+$/i, 'in ' + label);
  document.title = label + ' — ' + document.title;
  showToast('Showing category: ' + label, 'info');
}

/* =============================================================
   SIDEBAR  (grid + list)
============================================================= */
function initSidebar() {
  /* Collapsible sections — click header to collapse / expand */
  $$('.sidebar-section h4').forEach(function (h4) {
    h4.style.cursor = 'pointer';
    h4.addEventListener('click', function () {
      h4.closest('.sidebar-section').classList.toggle('collapsed');
    });
  });

  /* Filter tag dismiss (× chips) */
  $$('.ftag, .filter-tag').forEach(function (tag) {
    tag.style.cursor = 'pointer';
    tag.addEventListener('click', function () {
      tag.style.opacity = '0.4';
      tag.style.pointerEvents = 'none';
    });
  });

  /* "Clear all filter" link */
  $$('.clear-filter').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      $$('.ftag, .filter-tag').forEach(function (t) { t.style.opacity = ''; t.style.pointerEvents = ''; });
      /* Uncheck all sidebar checkboxes */
      $$('.sidebar input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
      showToast('All filters cleared', 'info');
    });
  });

  /* Sort select */
  $$('.featured-select, .sort-select').forEach(function (sel) {
    sel.addEventListener('change', function () {
      showToast('Sorted: ' + sel.options[sel.selectedIndex].text, 'info');
    });
  });

  /* "See all" links in sidebar */
  $$('.sidebar .see-all').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showToast('Showing all items in this filter.', 'info');
    });
  });

  /* Brand / feature checkboxes — show toast on change */
  $$('.sidebar .check-list input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var label = (cb.closest('label') || {}).textContent || '';
      showToast((cb.checked ? 'Filter added: ' : 'Filter removed: ') + label.trim(), 'info');
    });
  });

  /* Condition radio buttons */
  $$('.radio-list input[type="radio"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      var label = (radio.closest('label') || {}).textContent || '';
      showToast('Condition: ' + label.trim(), 'info');
    });
  });

  /* Rating checkboxes */
  $$('.star-list input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var label = (cb.closest('label') || {}).textContent || '';
      showToast((cb.checked ? 'Rating filter added: ' : 'Rating filter removed: ') + label.trim(), 'info');
    });
  });

  /* "Verified only" checkbox (topbar) */
  var verifiedCb = $('.listing-topbar input[type="checkbox"]');
  if (verifiedCb) {
    verifiedCb.addEventListener('change', function () {
      showToast(verifiedCb.checked ? 'Showing verified sellers only.' : 'Showing all sellers.', 'info');
    });
  }
}

/* =============================================================
   PAGINATION  (grid + list)
============================================================= */
function initPagination() {
  var allBtns  = $$('.page-btn');
  var numbered = allBtns.filter(function (b) { return !b.querySelector('svg'); });
  var arrows   = allBtns.filter(function (b) { return  !!b.querySelector('svg'); });
  var prevBtn  = arrows[0];
  var nextBtn  = arrows[arrows.length - 1];

  numbered.forEach(function (btn) {
    btn.addEventListener('click', function () {
      numbered.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  function currentIdx() { return numbered.findIndex(function (b) { return b.classList.contains('active'); }); }

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      var i = currentIdx();
      if (i > 0) numbered[i - 1].click();
      else showToast('You are on the first page.', 'info');
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      var i = currentIdx();
      if (i < numbered.length - 1) numbered[i + 1].click();
      else showToast('You are on the last page.', 'info');
    });
  }

  /* "Show 10" selector */
  $$('.page-show-wrapper').forEach(function (wrap) {
    wrap.style.cursor = 'pointer';
    var opts = [5, 10, 20, 50];
    var cur  = 0; /* index into opts array */
    wrap.addEventListener('click', function () {
      cur = (cur + 1) % opts.length;
      var label = wrap.querySelector('span');
      if (label) label.textContent = 'Show ' + opts[cur];
      showToast('Showing ' + opts[cur] + ' items per page.', 'info');
    });
  });
}

/* =============================================================
   VIEW TOGGLE  (grid ↔ list)
============================================================= */
function initViewToggle() {
  $$('.view-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.view-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var title  = (btn.title || btn.getAttribute('title') || '').toLowerCase();
      var isGrid = title.includes('grid');
      var path   = window.location.pathname.toLowerCase();
      if (isGrid && !path.includes('gridview')) {
        window.location.href = PAGES.grid;
      } else if (!isGrid && !path.includes('listview')) {
        window.location.href = PAGES.list;
      }
    });
  });
}

/* =============================================================
   WISHLIST HEART BUTTONS  (grid + list + detail)
============================================================= */
function initWishlistBtns() {
  $$('.card-heart, .wishlist-btn').forEach(function (btn, i) {
    var card = btn.closest('.product-card');
    var id   = (card && card.dataset.id) ? card.dataset.id : 'prod-' + i;
    if (card && !card.dataset.id) card.dataset.id = id;

    /* Restore saved state */
    if (Wishlist.has(id)) {
      btn.style.color = '#e53935';
      var path = btn.querySelector('path');
      if (path) path.setAttribute('fill', '#e53935');
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var added = Wishlist.toggle(id);
      btn.style.color = added ? '#e53935' : '';
      var p = btn.querySelector('path');
      if (p) p.setAttribute('fill', added ? '#e53935' : 'none');
      showToast(added ? 'Added to wishlist ❤' : 'Removed from wishlist', added ? 'success' : 'info');
    });
  });
}

/* =============================================================
   GRID VIEW PAGE  (webGridView.html)
============================================================= */
function initGridPage() {
  applyCategoryFromQuery();
  initSidebar();
  initPagination();
  initViewToggle();
  initWishlistBtns();
  initAddToCartButtons();
  initNewsletter();
}

/* =============================================================
   LIST VIEW PAGE  (webListView.html)
============================================================= */
function initListPage() {
  applyCategoryFromQuery();
  initSidebar();
  initPagination();
  initViewToggle();
  initWishlistBtns();
  initAddToCartButtons();
  initNewsletter();

  /* Price-range apply button */
  var priceApplyBtn = $('.sidebar .btn-apply');
  if (priceApplyBtn) {
    priceApplyBtn.addEventListener('click', function () {
      var mn = parseFloat((document.getElementById('priceMin') || {}).value || '0');
      var mx = parseFloat((document.getElementById('priceMax') || {}).value || '999999');
      if (isNaN(mn)) mn = 0;
      if (isNaN(mx)) mx = 999999;
      if (mn > mx) { showToast('Min price cannot exceed Max price.', 'error'); return; }
      showToast('Price filter: $' + mn.toFixed(2) + ' – $' + mx.toFixed(2), 'info');
    });
  }
}

/* =============================================================
   PRODUCT DETAIL PAGE  (webDetail.html)

   Inline onclick="swapImg(this)" and onclick="switchTab(this,'desc')"
   still work because we assign them to window.
============================================================= */
function initDetailPage() {

  /* ── Thumbnail gallery swap ── */
  window.swapImg = function (thumb) {
    var main = document.getElementById('mainImg');
    if (!main) return;
    var newSrc = thumb.src.replace(/w=\d+&h=\d+/, 'w=600&h=600').replace('w=80&h=80', 'w=400&h=400');
    main.src = newSrc;
    $$('.thumb').forEach(function (t) { t.classList.remove('active'); });
    thumb.classList.add('active');
  };
  $$('.thumb').forEach(function (t) {
    t.style.cursor = 'pointer';
    t.addEventListener('click', function () { window.swapImg(t); });
  });

  /* ── Tab switching ── */
  window.switchTab = function (btn, paneId) {
    $$('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    $$('.tab-pane').forEach(function (p) { p.classList.add('hidden'); });
    var pane = document.getElementById(paneId);
    if (pane) pane.classList.remove('hidden');
  };
  $$('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = this.dataset.tab;
      if (!id) {
        var m = (this.getAttribute('onclick') || '').match(/'([^']+)'/);
        if (m) id = m[1];
      }
      if (id) window.switchTab(this, id);
    });
  });

  /* ── Price tier selection ── */
  $$('.price-tier').forEach(function (tier) {
    tier.style.cursor = 'pointer';
    tier.addEventListener('click', function () {
      $$('.price-tier').forEach(function (t) { t.classList.remove('active-tier'); });
      tier.classList.add('active-tier');
    });
  });

  /* ── Add to cart button (detail page) ──
     The HTML already has .btn-add-cart; we wire the existing one
     OR the one created by the original main.js approach, whichever
     is present. */
  var prodName  = ($('.prod-name') || {}).textContent || 'Product';
  var prodImg   = (document.getElementById('mainImg') || {}).src || '';
  var prodId    = 'detail-main-1';

  function getProdPrice() {
    return parseFloat((($('.active-tier .tier-price') || $('.tier-price') || {}).textContent || '98').replace(/[^0-9.]/g, '')) || 98;
  }

  /* Wire the existing .btn-add-cart in the HTML */
  $$('.btn-add-cart').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var currentImg = (document.getElementById('mainImg') || {}).src || prodImg;
      Cart.add({ id: prodId, name: prodName.trim(), price: getProdPrice(), img: currentImg });
    });
  });

  /* If the HTML uses class btn-add-cart but also has class btn-add-to-cart variants */
  $$('.btn-add-to-cart').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var currentImg = (document.getElementById('mainImg') || {}).src || prodImg;
      Cart.add({ id: prodId, name: prodName.trim(), price: getProdPrice(), img: currentImg });
    });
  });

  /* ── Supplier inquiry ── */
  $$('.btn-inquiry').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showToast('Inquiry sent to supplier!', 'success');
    });
  });

  /* ── Seller's profile ── */
  $$('.btn-seller-profile').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showToast("Seller's profile feature coming soon.", 'info');
    });
  });

  /* ── Save for later / wishlist heart on detail page ── */
  var saveBtn = $('.save-later');
  if (saveBtn) {
    if (Wishlist.has(prodId)) saveBtn.innerHTML = '♥ Saved!';
    saveBtn.style.cursor = 'pointer';
    saveBtn.addEventListener('click', function () {
      var added = Wishlist.toggle(prodId);
      saveBtn.innerHTML = added
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="#e53935" stroke="#e53935" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Saved!'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b9cf5" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Save for later';
      showToast(added ? 'Saved to wishlist' : 'Removed from wishlist', added ? 'success' : 'info');
    });
  }

  /* ── Related / You-may-like → detail ── */
  $$('.rel-item, .yml-item').forEach(function (item) {
    item.style.cursor = 'pointer';
    item.addEventListener('click', function () { window.location.href = PAGES.detail; });
  });

  /* ── Promo "Shop now" button ── */
  $$('.promo-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { window.location.href = PAGES.grid; });
  });

  initNewsletter();
}

/* =============================================================
   CART PAGE  (web-cart.html)
============================================================= */
function initCartPage() {
  var DISCOUNT_RATE = 0.04;   /* 4%   */
  var TAX_RATE      = 0.009;  /* 0.9% */

  /* ── Seed demo cart items on first ever visit ── */
  if (!Cart.getAll().length) {
    var demoItems = [
      {
        id: 'demo-item-1', name: 'T-shirts with multiple colors, for men and lady',
        meta: 'Size: medium, Color: blue, Material: Plastic', seller: 'Artel Market',
        price: '78.99', qty: 9,
        img: 'assets/assets/assets/Layout/alibaba/Image/cloth/Bitmap.png'
      },
      {
        id: 'demo-item-2', name: 'Bags with multiple colors, for men and lady',
        meta: 'Size: medium, Color: blue, Material: Plastic', seller: 'Sialkot Factory LLC',
        price: '39.00', qty: 3,
        img: 'assets/assets/assets/Layout/alibaba/Image/cloth/image 26.png'
      },
      {
        id: 'demo-item-3', name: 'Lamps in multi colors',
        meta: 'Size: medium, Color: cream, Material: iron and plastic', seller: 'Artel Market',
        price: '170.50', qty: 1,
        img: 'assets/assets/assets/Image/interior/6.png'
      }
    ];
    demoItems.forEach(function (item) { Cart.add(item, true); });
  }

  /* ── Seed demo "Saved for later" items on first visit ── */
  Saved.seedIfEmpty([
    { id: 'saved-demo-1', name: 'GoPro HERO6 4K Action Mobile - Black',  price: 99.50, img: 'assets/assets/assets/Image/tech/image 32.png' },
    { id: 'saved-demo-2', name: 'GoPro HERO6 4K Action Camera - Black',  price: 99.50, img: 'assets/assets/assets/Image/image 87.png' },
    { id: 'saved-demo-3', name: 'Smart Watch Premium Edition',            price: 89.50, img: 'assets/assets/assets/Image/tech/8.png' },
    { id: 'saved-demo-4', name: 'Laptop Pro 15" Ultra',                   price: 99.50, img: 'assets/assets/assets/Image/tech/image 34.png' }
  ]);

  /* ── Recalculate order summary totals ── */
  function recalc() {
    var items = Cart.getAll();
    var sub   = items.reduce(function (s, i) { return s + (parseFloat(i.price) || 0) * (i.qty || 1); }, 0);
    var disc  = sub * DISCOUNT_RATE;
    var tax   = sub * TAX_RATE;
    var total = sub - disc + tax;

    $$('.summary-row').forEach(function (row) {
      var lbl = ((row.querySelector('.sum-label') || {}).textContent || '').toLowerCase();
      var val = row.querySelector('.sum-val');
      if (!val) return;
      if (lbl.includes('subtotal')) val.textContent = fmt(sub);
      if (lbl.includes('discount')) val.textContent = '- ' + fmt(disc);
      if (lbl.includes('tax'))      val.textContent = '+ ' + fmt(tax);
    });

    var totalEl = $('.total-val');
    if (totalEl) totalEl.textContent = fmt(total);

    var titleEl = $('.page-title');
    if (titleEl) titleEl.textContent = 'My cart (' + items.length + ')';

    syncBadges();
  }

  /* ── Build one cart-item row markup ── */
  function buildCartRow(item) {
    var row = document.createElement('div');
    row.className  = 'cart-item';
    row.dataset.id = item.id;
    var qty     = item.qty || 1;
    var options = '';
    for (var n = 1; n <= 10; n++) {
      options += '<option' + (n === qty ? ' selected' : '') + '>' + n + '</option>';
    }
    if (qty > 10) options += '<option selected>' + qty + '</option>';

    row.innerHTML =
      '<img src="' + item.img + '" alt="' + item.name + '" class="item-img"/>' +
      '<div class="item-details">' +
        '<div class="item-name">' + item.name + '</div>' +
        '<div class="item-meta">' + (item.meta || 'Size: default · Color: default') + '</div>' +
        '<div class="item-seller">Seller: ' + (item.seller || 'Marketplace Seller') + '</div>' +
        '<div class="item-actions">' +
          '<button class="btn-remove">Remove</button>' +
          '<button class="btn-save">Save for later</button>' +
        '</div>' +
      '</div>' +
      '<div class="item-right">' +
        '<div class="item-price">' + fmt(parseFloat(item.price) || 0) + '</div>' +
        '<div class="item-qty">' +
          '<span class="qty-label">Qty:</span>' +
          '<select class="qty-select">' + options + '</select>' +
        '</div>' +
      '</div>';

    bindCartRow(row);
    return row;
  }

  /* ── Render full cart list from localStorage ── */
  function renderCartItems() {
    var col    = $('.cart-items-col');
    if (!col) return;
    var footer = col.querySelector('.cart-footer');

    $$('.cart-item', col).forEach(function (row) { row.remove(); });
    var old = col.querySelector('.cart-empty-msg');
    if (old) old.remove();

    var items = Cart.getAll();
    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'cart-empty-msg';
      empty.style.cssText = 'padding:48px 20px;text-align:center;color:#8c8c8c;font-size:14px;';
      empty.textContent = 'Your cart is empty — find something you like and add it!';
      if (footer) col.insertBefore(empty, footer); else col.appendChild(empty);
    } else {
      items.forEach(function (item) {
        var row = buildCartRow(item);
        if (footer) col.insertBefore(row, footer); else col.appendChild(row);
      });
    }
    recalc();
  }

  /* ── Build one "Saved for later" card ── */
  function buildSavedCard(item) {
    var card = document.createElement('div');
    card.className  = 'saved-item';
    card.dataset.id = item.id;
    card.innerHTML  =
      '<div class="saved-img-wrap"><img src="' + item.img + '" alt="' + item.name + '" style="object-fit:contain;background:#fff;"/></div>' +
      '<div class="saved-price">' + fmt(parseFloat(item.price) || 0) + '</div>' +
      '<div class="saved-name">'  + item.name + '</div>' +
      '<button class="btn-move-cart">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
          '<path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.56l1.65-7.44H6"/>' +
        '</svg> Move to cart' +
      '</button>';
    var moveBtn = card.querySelector('.btn-move-cart');
    moveBtn.addEventListener('click', function () { doMove(card); });
    return card;
  }

  /* ── Render saved-for-later grid ── */
  function renderSavedItems() {
    var grid = $('.saved-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var items = Saved.getAll();
    if (!items.length) {
      var p = document.createElement('p');
      p.style.cssText = 'grid-column:1/-1;color:#8c8c8c;font-size:13px;padding:8px 0;';
      p.textContent = 'Nothing saved for later yet.';
      grid.appendChild(p);
      return;
    }
    items.forEach(function (item) { grid.appendChild(buildSavedCard(item)); });
  }

  /* ── Remove one cart item ── */
  function doRemove(row) {
    var id   = row.dataset.id;
    var item = Cart.getAll().find(function (i) { return i.id === id; });
    Cart.remove(id);
    renderCartItems();
    showToast('"' + ((item && item.name) || 'Item').slice(0, 36) + '" removed.', 'info');
  }

  /* ── Save for later: cart → saved ── */
  function doSaveForLater(row) {
    var id   = row.dataset.id;
    var item = Cart.getAll().find(function (i) { return i.id === id; });
    if (!item) return;
    Saved.add(item);
    Cart.remove(id);
    renderCartItems();
    renderSavedItems();
    showToast('"' + item.name.slice(0, 36) + '" saved for later.', 'info');
  }

  /* ── Move saved item back to cart ── */
  function doMove(card) {
    var id   = card.dataset.id;
    var item = Saved.getAll().find(function (i) { return i.id === id; });
    if (!item) return;
    Cart.add(item);
    Saved.remove(id);
    renderCartItems();
    renderSavedItems();
    showToast('"' + item.name.slice(0, 36) + '" moved to cart!');
  }

  /* ── Wire buttons inside a cart row ── */
  function bindCartRow(row) {
    var removeBtn = row.querySelector('.btn-remove');
    var saveBtn   = row.querySelector('.btn-save');
    var qtySel    = row.querySelector('.qty-select');
    if (removeBtn) removeBtn.addEventListener('click', function () { doRemove(row); });
    if (saveBtn)   saveBtn.addEventListener('click',   function () { doSaveForLater(row); });
    if (qtySel) qtySel.addEventListener('change', function () {
      Cart.updateQty(row.dataset.id, parseInt(qtySel.value, 10) || 1);
      recalc();
    });
  }

  /* ── First render ── */
  renderCartItems();
  renderSavedItems();

  /* ── Remove All ── */
  var removeAllBtn = $('.btn-remove-all');
  if (removeAllBtn) {
    removeAllBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!Cart.getAll().length) { showToast('Cart is already empty.', 'info'); return; }
      if (!confirm('Remove all items from cart?')) return;
      Cart.clear();
      renderCartItems();
      showToast('All items removed.', 'info');
    });
  }

  /* ── Coupon codes ── (try: SAVE10 · WELCOME · EXTRA20) */
  var COUPONS   = { SAVE10: 10, WELCOME: 5, EXTRA20: 20 };
  var applyBtn  = $('.btn-apply');
  var couponInp = $('.coupon-input');

  function applyCoupon() {
    if (!couponInp) return;
    var code = couponInp.value.trim().toUpperCase();
    if (!code) { showToast('Enter a coupon code.', 'error'); return; }
    var off = COUPONS[code];
    if (off) {
      showToast('Coupon "' + code + '" applied — $' + off + ' off! 🎉');
      couponInp.value = '';
    } else {
      showToast('Coupon "' + code + '" is not valid.', 'error');
    }
  }

  if (applyBtn)  applyBtn.addEventListener('click', applyCoupon);
  if (couponInp) couponInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') applyCoupon(); });

  /* ── Checkout ── */
  var checkoutBtn = $('.btn-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
      if (!Cart.getAll().length) { showToast('Your cart is empty!', 'error'); return; }
      showToast('Proceeding to checkout… 🛒', 'success');
      /* Replace line below with: window.location.href = 'checkout.html'; when checkout page is ready */
    });
  }

  /* ── Back to shop ── (href already set in wireNavLinks; this covers <button> fallback) */
  var backBtn = $('.btn-back-shop');
  if (backBtn) {
    backBtn.addEventListener('click', function (e) {
      if ((backBtn.tagName || '').toLowerCase() !== 'a') {
        e.preventDefault();
        window.location.href = PAGES.home;
      }
    });
  }

  /* ── Promo banner "Shop now" ── */
  $$('.promo-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { window.location.href = PAGES.grid; });
  });

  /* ── Payment method icons — cosmetic click ── */
  $$('.payment-icons').forEach(function (wrap) {
    wrap.style.cursor = 'pointer';
    wrap.addEventListener('click', function () {
      showToast('Multiple payment methods accepted at checkout.', 'info');
    });
  });
}

/* =============================================================
   PAGE DETECTION
============================================================= */
function detectPage() {
  var file = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (file.includes('web-cart'))    return 'cart';
  if (file.includes('webdetail'))   return 'detail';
  if (file.includes('webgridview')) return 'grid';
  if (file.includes('weblistview')) return 'list';
  return 'home';
}

/* =============================================================
   BOOT — runs on DOMContentLoaded on every page
============================================================= */
document.addEventListener('DOMContentLoaded', function () {
  var page = detectPage();

  /* Always-on */
  initHeader();
  initImgFallback();
  wireNavLinks();
  syncBadges();

  /* Page-specific */
  switch (page) {
    case 'home':   initHome();       initNewsletter(); break;
    case 'grid':   initGridPage();                     break;
    case 'list':   initListPage();                     break;
    case 'detail': initDetailPage();                   break;
    case 'cart':   initCartPage();   initNewsletter(); break;
  }

  console.log('[EC] page=' + page + ' | cart=' + Cart.count() + ' item(s)');
});