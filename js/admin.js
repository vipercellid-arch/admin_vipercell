/* ============================================================================
 * VIPERCELL - ADMIN PANEL ENGINE
 * Nama File : js/admin.js
 * ============================================================================ */

import { 
    db, auth,
    signInWithEmailAndPassword, onAuthStateChanged, signOut,
    setPersistence, browserLocalPersistence,
    doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, collection, addDoc, query, where, getDocs, arrayUnion, increment, runTransaction 
} from './firebase.js';

// ==========================================
// KONFIGURASI PATH DATABASE FIRESTORE
// ==========================================
const appId = typeof __app_id !== 'undefined' ? __app_id : 'vipercell-prod';
const isWorkspace = typeof __app_id !== 'undefined';

const pathProducts = isWorkspace ? `artifacts/${appId}/public/data/products` : 'products';
const pathOrders = isWorkspace ? `artifacts/${appId}/public/data/orders` : 'orders';
const pathSettings = isWorkspace ? `artifacts/${appId}/public/data/settings` : 'settings';
const pathPromos = isWorkspace ? `artifacts/${appId}/public/data/promos` : 'promos';
const pathChats = isWorkspace ? `artifacts/${appId}/public/data/chats` : 'chats';
const pathReviews = isWorkspace ? `artifacts/${appId}/public/data/reviews` : 'reviews';
const pathStocks = isWorkspace ? `artifacts/${appId}/public/data/stocks` : 'stocks';
const pathUsers = isWorkspace ? `artifacts/${appId}/public/data/users` : 'users';
const pathDeviceLocks = isWorkspace ? `artifacts/${appId}/public/data/device_locks` : 'device_locks';
const pathMutations = isWorkspace ? `artifacts/${appId}/public/data/payment_mutations` : 'payment_mutations';
const pathSuggestions = isWorkspace ? `artifacts/${appId}/public/data/product_suggestions` : 'product_suggestions';

const fallbackSettingsPath = isWorkspace ? 'settings' : `artifacts/${appId}/public/data/settings`;

// Durasi pembersihan otomatis akun tamu 6 jam
const ANON_AUTO_DELETE_TTL_MS = 6 * 60 * 60 * 1000;

// SVG Default Favicon Vipercell
const DEFAULT_VIPERCELL_SVG_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect width='512' height='512' rx='116' fill='%232563eb' stroke='%230f172a' stroke-width='28'/%3E%3Cpath d='M298 88L136 288h116l-44 136 168-200H260l38-136z' fill='%23facc15' stroke='%230f172a' stroke-width='18' stroke-linejoin='round'/%3E%3C/svg%3E";

// ==========================================
// STATE & VARIABEL GLOBAL ADMIN
// ==========================================
let currentAdminUser = null;
let isListening = false;

let products = [];
let groupedBrands = [];
let orders = [];
let promos = [];
let reviewsData = [];
let stocksData = [];
let allLiveChats = [];
let allUsersList = [];
let allSuggestions = [];
let rawCollectionSuggestions = [];
let rawChatFallbackSuggestions = [];
let currentAdminCsSubTab = 'chat';
let adminGasPollInterval = null;
let isPollingAdminGas = false;

let siteSettings = { 
    logoText: 'VIPER',
    logoAccent: 'CELL',
    logoImgBase64: '',
    pwaIconBase64: '',
    marquee: 'Selamat datang di Vipercell.',
    marqueeList: [],
    footerMarquee: 'TERIMA KASIH TELAH BERBELANJA DI VIPERCELL — LAYANAN APLIKASI PREMIUM, TOP UP GAME & PRODUK DIGITAL || TRANSAKSI OTOMATIS & BERGARANSI — HUBUNGI CS BANTUAN JIKA BUTUH PANDUAN',
    footerMarqueeList: [],
    suggestionsList: [],
    deletedSuggestionIds: [],
    qrisStringData: '',
    emailWebhookUrl: '',
    webhookSecret: 'VIPERCELL_SECRET_2026',
    adminWa: '085656321860',
    igLink: '',
    ttLink: '',
    newsList: [],
    banners: [],
    isStoreOpen: true,
    waChannelLink: '',
    anonAutoDelete6h: true,
    // Pengaturan Jam Operasional Toko (#20)
    opHoursEnabled: false,
    opOpenTime: '08:00',
    opCloseTime: '22:00',
    waterRippleEnabled: true,
    deletedUids: [],
    blockedUids: [],
    blockedDevices: []
};

let currentOrderFilter = 'ALL';
let currentStockFilter = 'READY';
let currentMemberFilter = 'ALL';
let activeAdminChatId = null;

// State Hierarki Cek & Tambah Stok (#17)
let selectedCheckStockBrand = '';
let selectedCheckStockVariant = '';
let selectedAddStockBrand = '';
let selectedAddStockVariant = '';

// Sound & Notification States
let isSoundEnabled = localStorage.getItem('vipercell_admin_sound') !== 'off';
let initialOrdersLoaded = false;
let initialChatsLoaded = false;
let knownOrderIds = new Set();
let knownChatTimestamps = {};
const processingAutoOrderIds = new Set();
const sentEmailOrderIds = new Set();
const inFlightEmailOrderIds = new Set();

let html5BarcodeScanner = null;
let liveSubCountdownInterval = null;
let anonSixHourAutoCleanInterval = null;

// Temp Buffers untuk Modal Produk, Gambar & Berita
let tempLogoBase64 = '';
let tempPwaIconBase64 = '';
let tempManageImgBase64 = '';
let tempNewsImgBase64 = '';
let tempProductVariants = [];

// ==========================================
// FUNGSI KEAMANAN TEKS & CLIPBOARD
// ==========================================
window.escapeHtml = function(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

function escapeJsStr(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

window.copyTextToClipboard = function(text, label = 'Data') {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        window.showToast('Disalin', `${label} berhasil disalin.`, 'success');
    });
};

// ==========================================
// EFEK SENTUHAN AIR BERWARNA / WATER RIPPLE CANVAS (#9)
// ==========================================
let waterRippleEngine = {
    initialized: false,
    canvas: null,
    ctx: null,
    ripples: [],
    animFrameId: null,
    lastMoveTime: 0
};

const LIGHT_RIPPLE_COLORS = [
    "rgba(37, 99, 235, ",
    "rgba(250, 204, 21, ",
    "rgba(244, 63, 94, ",
    "rgba(16, 185, 129, ",
    "rgba(139, 92, 246, "
];

const DARK_RIPPLE_COLORS = [
    "rgba(59, 130, 246, ",
    "rgba(250, 204, 21, ",
    "rgba(34, 211, 238, ",
    "rgba(251, 113, 133, ",
    "rgba(167, 139, 250, "
];

function initWaterRippleBackground() {
    if (waterRippleEngine.initialized) {
        updateWaterRippleVisibility();
        return;
    }
    const canvas = document.getElementById("water-ripple-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    waterRippleEngine.initialized = true;
    waterRippleEngine.canvas = canvas;
    waterRippleEngine.ctx = ctx;

    const SCALE = 0.65;
    const resizeCanvas = () => {
        canvas.width = Math.max(1, Math.round(window.innerWidth * SCALE));
        canvas.height = Math.max(1, Math.round(window.innerHeight * SCALE));
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });

    const spawnRipple = (x, y, isBurst = false) => {
        if (siteSettings.waterRippleEnabled === false || document.hidden) return;
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const palette = isDark ? DARK_RIPPLE_COLORS : LIGHT_RIPPLE_COLORS;
        const colorPrefix = palette[Math.floor(Math.random() * palette.length)];

        waterRippleEngine.ripples.push({
            x: x * SCALE,
            y: y * SCALE,
            radius: isBurst ? 4 : 2,
            maxRadius: isBurst ? 84 : 52,
            speed: isBurst ? 1.8 : 1.3,
            alpha: isBurst ? 0.46 : 0.28,
            lineWidth: isBurst ? 2.1 : 1.4,
            colorPrefix,
            secondRing: isBurst
        });

        if (waterRippleEngine.ripples.length > 16) {
            waterRippleEngine.ripples.shift();
        }
        if (!waterRippleEngine.animFrameId) {
            waterRippleEngine.animFrameId = requestAnimationFrame(renderWaterRipplesLoop);
        }
    };

    window.addEventListener("pointerdown", (e) => spawnRipple(e.clientX, e.clientY, true), { passive: true });
    window.addEventListener("pointermove", (e) => {
        const now = performance.now();
        if (now - waterRippleEngine.lastMoveTime > 55) {
            waterRippleEngine.lastMoveTime = now;
            spawnRipple(e.clientX, e.clientY, false);
        }
    }, { passive: true });
    window.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches[0]) spawnRipple(e.touches[0].clientX, e.touches[0].clientY, true);
    }, { passive: true });
    window.addEventListener("touchmove", (e) => {
        const now = performance.now();
        if (now - waterRippleEngine.lastMoveTime > 65 && e.touches && e.touches[0]) {
            waterRippleEngine.lastMoveTime = now;
            spawnRipple(e.touches[0].clientX, e.touches[0].clientY, false);
        }
    }, { passive: true });

    updateWaterRippleVisibility();
}

function updateWaterRippleVisibility() {
    const canvas = waterRippleEngine.canvas || document.getElementById("water-ripple-canvas");
    if (!canvas) return;
    if (siteSettings.waterRippleEnabled === false) {
        canvas.style.display = "none";
        waterRippleEngine.ripples = [];
        if (waterRippleEngine.ctx) {
            waterRippleEngine.ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    } else {
        canvas.style.display = "block";
    }
}

function renderWaterRipplesLoop() {
    const { canvas, ctx, ripples } = waterRippleEngine;
    if (!canvas || !ctx || siteSettings.waterRippleEnabled === false) {
        waterRippleEngine.animFrameId = null;
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed;
        const progress = r.radius / r.maxRadius;
        const currentAlpha = Math.max(0, r.alpha * (1 - progress));
        if (currentAlpha <= 0.01 || r.radius >= r.maxRadius) {
            ripples.splice(i, 1);
            continue;
        }
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `${r.colorPrefix}${currentAlpha.toFixed(3)})`;
        ctx.lineWidth = r.lineWidth;
        ctx.stroke();

        // Optimized: skip expensive per-frame radialGradient

        if (r.secondRing && r.radius > 18) {
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius * 0.62, 0, Math.PI * 2);
            ctx.strokeStyle = `${r.colorPrefix}${(currentAlpha * 0.65).toFixed(3)})`;
            ctx.lineWidth = Math.max(1, r.lineWidth - 1);
            ctx.stroke();
        }
    }
    if (ripples.length > 0) {
        waterRippleEngine.animFrameId = requestAnimationFrame(renderWaterRipplesLoop);
    } else {
        waterRippleEngine.animFrameId = null;
    }
}

window.previewWaterRippleToggle = function() {
    const sw = document.getElementById("set-water-ripple");
    if (sw) {
        siteSettings.waterRippleEnabled = sw.checked;
        initWaterRippleBackground();
        updateWaterRippleVisibility();
    }
};


// ==========================================
// PINTASAN BUKA / TUTUP TOKO DI TOPBAR (#16)
// ==========================================
function updateTopbarStoreStatusUI() {
    const isOpen = siteSettings.isStoreOpen !== false;
    const topBtn = document.getElementById('btn-topbar-store-toggle');
    const topIcon = document.getElementById('topbar-store-icon');
    const topText = document.getElementById('topbar-store-text');
    const setSwitch = document.getElementById('set-store-open');

    if (setSwitch) {
        setSwitch.checked = isOpen;
    }

    if (topBtn && topIcon && topText) {
        if (isOpen) {
            topBtn.className = 'btn btn-success btn-sm';
            topIcon.className = 'fa-solid fa-store';
            topText.innerText = 'Toko Buka';
        } else {
            topBtn.className = 'btn btn-danger btn-sm';
            topIcon.className = 'fa-solid fa-store-slash';
            topText.innerText = 'Toko Tutup';
        }
    }
}

window.toggleStoreOpenQuick = async function() {
    const currentOpen = siteSettings.isStoreOpen !== false;
    const nextOpen = !currentOpen;
    const topBtn = document.getElementById('btn-topbar-store-toggle');
    if (topBtn) topBtn.disabled = true;

    try {
        siteSettings.isStoreOpen = nextOpen;
        updateTopbarStoreStatusUI();
        await setDoc(doc(db, pathSettings, 'mainConfig'), {
            isStoreOpen: nextOpen
        }, { merge: true });

        window.showToast(
            nextOpen ? 'Toko Dibuka' : 'Toko Ditutup',
            nextOpen ? 'Toko kini aktif menerima pesanan.' : 'Toko kini ditutup sementara.',
            nextOpen ? 'success' : 'warning'
        );
    } catch (e) {
        siteSettings.isStoreOpen = currentOpen;
        updateTopbarStoreStatusUI();
        window.customAlert('Gagal', 'Tidak dapat mengubah status toko.', 'error');
    } finally {
        if (topBtn) topBtn.disabled = false;
    }
};

window.syncStoreOpenSwitchPreview = function() {
    const setSwitch = document.getElementById('set-store-open');
    if (setSwitch) {
        siteSettings.isStoreOpen = setSwitch.checked;
        updateTopbarStoreStatusUI();
    }
};

// ==========================================
// JAM OPERASIONAL TOKO PREVIEW (#20)
// ==========================================
function checkIsCurrentlyRestrictedByOpHours(opEnabled, openStr, closeStr) {
    if (!opEnabled) return false;

    const oStr = String(openStr || '').trim();
    const cStr = String(closeStr || '').trim();
    if (/^\d{1,2}:\d{2}$/.test(oStr) && /^\d{1,2}:\d{2}$/.test(cStr)) {
        const [openH, openM] = oStr.split(':').map(Number);
        const [closeH, closeM] = cStr.split(':').map(Number);
        const now = new Date();
        const curMins = now.getHours() * 60 + now.getMinutes();
        const openMins = openH * 60 + openM;
        const closeMins = closeH * 60 + closeM;

        if (openMins === closeMins) return true;
        let isWithin = false;
        if (openMins < closeMins) {
            isWithin = curMins >= openMins && curMins < closeMins;
        } else {
            isWithin = curMins >= openMins || curMins < closeMins;
        }
        return !isWithin;
    }
    return false;
}

window.updateOpHoursAdminPreview = function() {
    const opEnabled = Boolean(document.getElementById('set-op-hours-enabled')?.checked);
    const openTime = document.getElementById('set-op-open-time')?.value || '08:00';
    const closeTime = document.getElementById('set-op-close-time')?.value || '22:00';
    const badgeEl = document.getElementById('op-hours-admin-status');

    if (!badgeEl) return;

    const isRestrictedNow = checkIsCurrentlyRestrictedByOpHours(opEnabled, openTime, closeTime);
    if (isRestrictedNow) {
        badgeEl.className = 'status-badge status-pending';
        badgeEl.innerHTML = `<i class="fa-regular fa-clock"></i> Di Luar Jam Operasional (Hanya Stok Lokal)`;
    } else if (opEnabled) {
        badgeEl.className = 'status-badge status-success';
        badgeEl.innerHTML = `<i class="fa-regular fa-clock"></i> Jam Operasional Aktif (${openTime} - ${closeTime})`;
    } else {
        badgeEl.className = 'status-badge status-success';
        badgeEl.innerHTML = 'Semua Produk Dilayani';
    }
};

// ==========================================
// WEB AUDIO API SOUND GENERATOR & PWA ICON
// ==========================================
function playNotificationSound(type = 'order') {
    if (!isSoundEnabled) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        if (type === 'order') {
            const freqs = [523.25, 659.25, 783.99, 1046.50];
            freqs.forEach((f, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, now + idx * 0.11);
                gain.gain.setValueAtTime(0.18, now + idx * 0.11);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.11);
                osc.stop(now + idx * 0.11 + 0.36);
            });
        } else {
            const freqs = [587.33, 880.00];
            freqs.forEach((f, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, now + idx * 0.12);
                gain.gain.setValueAtTime(0.15, now + idx * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + idx * 0.12);
                osc.stop(now + idx * 0.12 + 0.26);
            });
        }
    } catch (e) {}
}

function sendAdminNativeNotification(title, bodyText) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const iconUrl = siteSettings.pwaIconBase64 || siteSettings.logoImgBase64 || DEFAULT_VIPERCELL_SVG_ICON;
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, {
                body: bodyText,
                icon: iconUrl,
                badge: iconUrl
            });
        }).catch(() => {
            try { new Notification(title, { body: bodyText, icon: iconUrl }); } catch (e) {}
        });
    } else {
        try { new Notification(title, { body: bodyText, icon: iconUrl }); } catch (e) {}
    }
}

window.toggleSoundAlert = function() {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('vipercell_admin_sound', isSoundEnabled ? 'on' : 'off');
    updateSoundIconUI();
    if (isSoundEnabled) {
        playNotificationSound('chat');
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        window.showToast('Suara Aktif', 'Notifikasi suara diaktifkan.', 'success');
    } else {
        window.showToast('Suara Nonaktif', 'Notifikasi suara dimatikan.', 'info');
    }
};

function updateSoundIconUI() {
    const icon = document.getElementById('sound-icon');
    const btn = document.getElementById('btn-toggle-sound');
    if (!icon || !btn) return;
    if (isSoundEnabled) {
        icon.className = 'fa-solid fa-volume-high text-success';
        btn.style.borderColor = 'var(--success)';
    } else {
        icon.className = 'fa-solid fa-volume-xmark text-muted';
        btn.style.borderColor = 'var(--border)';
    }
}

let dynamicAdminManifestUrl = null;
function applyCustomAdminPwaIcon() {
    const customIcon = siteSettings.pwaIconBase64 || siteSettings.logoImgBase64 || DEFAULT_VIPERCELL_SVG_ICON;

    const favicon = document.getElementById('admin-favicon');
    const shortcutFav = document.getElementById('admin-shortcut-favicon');
    const appleIcon = document.getElementById('admin-apple-icon');
    const ogImg = document.getElementById('og-meta-image');

    if (favicon) favicon.href = customIcon;
    if (shortcutFav) shortcutFav.href = customIcon;
    if (appleIcon) appleIcon.href = customIcon;
    if (ogImg) ogImg.setAttribute('content', customIcon);

    if (customIcon.startsWith('data:image')) {
        try { localStorage.setItem('vipercell_admin_cached_icon', customIcon); } catch (e) {}
    }

    try {
        const mimeType = customIcon.startsWith('data:image/svg')
            ? "image/svg+xml"
            : (customIcon.startsWith('data:image/webp') ? "image/webp" : "image/png");

        const manifestObj = {
            id: "/admin",
            name: `${siteSettings.logoText || 'Viper'}Admin`,
            short_name: `${siteSettings.logoText || 'Viper'}Admin`,
            description: "Panel Kendali Admin Vipercell.",
            start_url: window.location.origin + window.location.pathname,
            scope: window.location.origin + "/",
            display: "standalone",
            background_color: "#090d16",
            theme_color: "#2563eb",
            orientation: "any",
            icons: [
                { src: customIcon, sizes: "192x192", type: mimeType, purpose: "any" },
                { src: customIcon, sizes: "512x512", type: mimeType, purpose: "maskable" }
            ]
        };
        if (dynamicAdminManifestUrl) URL.revokeObjectURL(dynamicAdminManifestUrl);
        const blob = new Blob([JSON.stringify(manifestObj)], { type: 'application/json' });
        dynamicAdminManifestUrl = URL.createObjectURL(blob);
        const manifestLink = document.getElementById('admin-manifest-link');
        if (manifestLink) manifestLink.setAttribute('href', dynamicAdminManifestUrl);
    } catch (e) {}
}

// ==========================================
// PRE-LOADER & INISIALISASI ADMIN
// ==========================================
let isAdminAppUnlocked = false;

function updateAdminPreloaderStage(percent, statusText, subText = '') {
    const txtEl = document.getElementById('preloader-status-text');
    const fillEl = document.getElementById('preloader-bar-fill');
    const subEl = document.getElementById('preloader-stage-sub');
    if (txtEl && statusText) txtEl.innerText = statusText;
    if (fillEl) fillEl.style.width = `${Math.min(100, Math.max(10, percent))}%`;
    if (subEl && subText !== undefined) subEl.innerText = subText;
}

function unlockAdminAppUI() {
    if (isAdminAppUnlocked) return;
    isAdminAppUnlocked = true;

    document.body.classList.remove('preloader-locked');
    document.body.classList.remove('no-scroll');

    const loader = document.getElementById('app-preloader-overlay');
    if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 200);
    }
}

async function fetchInitialAdminDataBeforeUnlock() {
    try {
        updateAdminPreloaderStage(52, 'Memuat data toko...', '');
        const [settingsSnap, productsSnap, ordersSnap, stocksSnap] = await Promise.all([
            getDoc(doc(db, pathSettings, 'mainConfig')).catch(() => null),
            getDocs(collection(db, pathProducts)).catch(() => null),
            getDocs(collection(db, pathOrders)).catch(() => null),
            getDocs(collection(db, pathStocks)).catch(() => null)
        ]);

        if (settingsSnap && settingsSnap.exists()) {
            siteSettings = { ...siteSettings, ...settingsSnap.data() };
        } else {
            const fallbackSnap = await getDoc(doc(db, fallbackSettingsPath, 'mainConfig')).catch(() => null);
            if (fallbackSnap && fallbackSnap.exists()) {
                siteSettings = { ...siteSettings, ...fallbackSnap.data() };
            }
        }
        window.populateSettingsForm();
        updateTopbarStoreStatusUI();
        applyCustomAdminPwaIcon();
        initWaterRippleBackground();

        if (stocksSnap) {
            stocksData = [];
            stocksSnap.forEach(d => stocksData.push({ dbId: d.id, ...d.data() }));
        }

        if (productsSnap) {
            products = [];
            productsSnap.forEach(d => products.push({ dbId: d.id, ...d.data() }));
            rebuildGroupedBrands();
            window.renderAdminCatalog();
            window.populateStockProductSelect();
        }

        if (ordersSnap) {
            orders = [];
            ordersSnap.forEach(d => {
                const oData = { dbId: d.id, ...d.data() };
                if (oData.emailSent === true && oData.id) {
                    sentEmailOrderIds.add(String(oData.id).toUpperCase());
                }
                orders.push(oData);
            });
            orders.sort((a, b) => new Date(b.date) - new Date(a.date));
            window.generateAdminReports();
            window.renderAdminOrders();
        }
    } catch (err) {
        console.warn("Initial Admin Preload:", err);
    }
}

async function initAdminApp() {
    const savedTheme = localStorage.getItem('vipercell_admin_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeIcon = document.getElementById('admin-theme-icon');
    if (themeIcon) themeIcon.className = savedTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    updateSoundIconUI();

    const safetyTimeout = setTimeout(() => {
        unlockAdminAppUI();
    }, 1100);

    await setPersistence(auth, browserLocalPersistence).catch(() => {});

    let isFirstAuthCheck = true;

    initWaterRippleBackground();

    onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous) {
            currentAdminUser = user;
            localStorage.setItem('vipercell_admin_session_active', '1');
            document.documentElement.classList.add('has-admin-session');
            document.body.classList.remove('admin-auth-locked');

            const emailLbl = document.getElementById('admin-email-label');
            if (emailLbl) emailLbl.innerText = user.email;
            const loginScr = document.getElementById('admin-login-screen');
            if (loginScr) loginScr.style.display = 'none';
            const dashView = document.getElementById('admin-dashboard-view');
            if (dashView) dashView.style.display = 'flex';

            if (isFirstAuthCheck) {
                isFirstAuthCheck = false;
                await fetchInitialAdminDataBeforeUnlock();
                startAdminListeners();
                startLiveSubscriptionTicker();
                startAnonSixHourAutoCleanScheduler();
                startAdminGasWebhookPolling();
                updateAdminPreloaderStage(100, 'Siap', '');
                clearTimeout(safetyTimeout);
                setTimeout(unlockAdminAppUI, 60);
            } else {
                startAdminListeners();
                startLiveSubscriptionTicker();
                startAnonSixHourAutoCleanScheduler();
                startAdminGasWebhookPolling();
            }
        } else {
            currentAdminUser = null;
            localStorage.removeItem('vipercell_admin_session_active');
            document.documentElement.classList.remove('has-admin-session');
            document.body.classList.add('admin-auth-locked');

            const loginScr = document.getElementById('admin-login-screen');
            if (loginScr) loginScr.style.display = 'flex';
            const dashView = document.getElementById('admin-dashboard-view');
            if (dashView) dashView.style.display = 'none';

            if (isFirstAuthCheck) {
                isFirstAuthCheck = false;
                clearTimeout(safetyTimeout);
                setTimeout(unlockAdminAppUI, 60);
            }
        }
    });
}

// ==========================================
// TEMA, NAVIGASI TAB & LOGIN ADMIN
// ==========================================
window.toggleAdminTheme = function() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('vipercell_admin_theme', next);
    
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) metaTheme.setAttribute('content', next === 'dark' ? '#090d16' : '#f4f6fb');
    
    const icon = document.getElementById('admin-theme-icon');
    if (icon) icon.className = next === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
};

window.toggleAdminThemeWithTransition = function(evt) {
    const html = document.documentElement;
    const curtain = document.getElementById('theme-transition-curtain');
    const btn = document.getElementById('btn-admin-theme-toggle');

    if (evt && curtain) {
        const x = Math.round((evt.clientX / window.innerWidth) * 100);
        const y = Math.round((evt.clientY / window.innerHeight) * 100);
        curtain.style.setProperty('--theme-x', x + '%');
        curtain.style.setProperty('--theme-y', y + '%');
        curtain.classList.add('active');
        setTimeout(() => curtain.classList.remove('active'), 400);
    }

    html.classList.add('theme-transitioning');
    if (btn) btn.classList.add('spin-theme-icon');

    window.toggleAdminTheme();

    setTimeout(() => {
        html.classList.remove('theme-transitioning');
        if (btn) btn.classList.remove('spin-theme-icon');
    }, 420);
};

window.toggleMobileSidebar = function() {
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('active');
};

window.switchAdminTab = function(tabId, menuEl) {
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (menuEl) menuEl.classList.add('active');
    
    const titleSpan = menuEl ? menuEl.querySelector('span') : null;
    if (titleSpan) document.getElementById('topbar-title').innerText = titleSpan.innerText;
    
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('active');
    }

    if (tabId === 'tab-members') {
        window.renderAdminMembers();
    }
    if (tabId === 'tab-stocks') {
        window.populateStockProductSelect();
        window.renderAdminStocks();
    }
    if (tabId === 'tab-settings') {
        window.renderMarqueeStudioSlots();
        window.renderFooterMarqueeStudioSlots();
        window.updateOpHoursAdminPreview();
    }
};

window.switchAdminTabByName = function(tabId) {
    const menuEl = document.getElementById('nav-' + tabId);
    window.switchAdminTab(tabId, menuEl);
};

window.processAdminLogin = async function() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    
    if (!email || !pass) {
        window.customAlert('Belum Lengkap', 'Masukkan email dan kata sandi admin.', 'warning');
        return;
    }
    
    const btn = document.getElementById('btn-admin-login');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memproses...</span>';
    btn.disabled = true;
    
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.showToast('Berhasil Masuk', 'Selamat datang di Panel Admin.', 'success');
    } catch (error) {
        console.error(error);
        window.customAlert('Gagal Masuk', 'Email atau kata sandi tidak sesuai.', 'error');
    } finally {
        btn.innerHTML = ogHtml;
        btn.disabled = false;
    }
};

window.logoutAdmin = async function() {
    localStorage.removeItem('vipercell_admin_session_active');
    document.documentElement.classList.remove('has-admin-session');
    document.body.classList.add('admin-auth-locked');
    await signOut(auth);
    window.showToast('Keluar', 'Kamu telah keluar dari sesi Admin.', 'info');
};

// ==========================================
// COUNTDOWN DURASI LANGGANAN
// ==========================================
function formatRemainingDurationMs(diffMs) {
    if (diffMs <= 0) return 'WAKTU HABIS (WAJIB KICK)';
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);

    if (days > 0) {
        return `${days} Hari ${hours} Jam ${mins}m`;
    }
    return `${hours}j ${mins}m ${secs}d`;
}

function startLiveSubscriptionTicker() {
    if (liveSubCountdownInterval) clearInterval(liveSubCountdownInterval);
    liveSubCountdownInterval = setInterval(() => {
        const now = Date.now();
        document.querySelectorAll('.sub-live-timer').forEach(el => {
            const endAt = parseInt(el.getAttribute('data-end') || '0', 10);
            const subStatus = el.getAttribute('data-substatus') || 'ACTIVE';
            if (!endAt || subStatus === 'KICKED') return;

            const diff = endAt - now;
            if (diff <= 0) {
                el.className = 'sub-countdown-box sub-expired sub-live-timer';
                el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> DURASI HABIS — WAKTUNYA KICK AKUN`;
            } else {
                el.className = 'sub-countdown-box sub-running sub-live-timer';
                el.innerHTML = `<i class="fa-solid fa-stopwatch"></i> Sisa Durasi: <b>${formatRemainingDurationMs(diff)}</b>`;
            }
        });
    }, 1000);
}

function getOrderDurationDays(order) {
    if (!order) return 0;
    if (order.durationDays && order.durationDays > 0) return parseInt(order.durationDays, 10);
    const item = order.items && order.items[0] ? order.items[0] : null;
    if (item && item.durationDays && item.durationDays > 0) return parseInt(item.durationDays, 10);

    if (item) {
        const matchedProd = products.find(p =>
            (item.productDbId && p.dbId === item.productDbId) ||
            (p.brand === item.brandName && p.name === item.exactItemName)
        );
        if (matchedProd && matchedProd.durationDays > 0) return parseInt(matchedProd.durationDays, 10);
    }
    return 0;
}

async function ensureOrderSubscriptionInitialized(orderData, orderDbId) {
    const durDays = getOrderDurationDays(orderData);
    if (durDays <= 0 || orderData.subscriptionEndAt) return null;

    const startMs = orderData.subscriptionStartAt || Date.now();
    const endMs = startMs + (durDays * 86400000);
    const patch = {
        durationDays: durDays,
        subscriptionStartAt: startMs,
        subscriptionEndAt: endMs,
        subscriptionStatus: 'ACTIVE'
    };
    await updateDoc(doc(db, pathOrders, orderDbId), patch).catch(() => {});
    return patch;
}

// ==========================================
// WEBHOOK CALLER & ANTI-EMAIL DOBEL (#12 & #18)
// ==========================================
async function callUnifiedGasWebhook(payloadObj) {
    const rawUrls = (siteSettings.emailWebhookUrl || '').trim();
    const urlList = rawUrls
        .split(",")
        .map(u => u.trim())
        .filter(u => u.startsWith('https://script.google.com/'));

    if (urlList.length === 0) {
        throw new Error('URL Google Apps Script belum diatur di Pengaturan Toko.');
    }

    const activeSecret = (siteSettings.webhookSecret || 'VIPERCELL_SECRET_2026').trim();
    let lastError = null;

    // Mendukung Multi-URL Google Apps Script (dipisah koma) agar kuota pengiriman email harian tanpa batas (#5)
    for (let i = 0; i < urlList.length; i++) {
        const targetUrl = urlList[i];
        const backupUrls = urlList.filter((_, idx) => idx !== i);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 16000);

        try {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    projectId: 'vipercell-fc50e',
                    secret: activeSecret,
                    key: activeSecret,
                    backupWebhookUrls: backupUrls,
                    ...payloadObj
                }),
                redirect: 'follow',
                signal: controller.signal
            });

            const rawText = await response.text();
            let resJson = null;
            try {
                resJson = JSON.parse(rawText);
            } catch (parseErr) {
                throw new Error('Respons server email tidak valid.');
            }

            if (resJson && (resJson.ok === true || resJson.status === 'ok')) {
                clearTimeout(timeoutId);
                return resJson;
            }
            if (resJson?.error === 'UNAUTHORIZED_SECRET') {
                throw new Error('Webhook Secret tidak cocok dengan Google Apps Script.');
            }
            throw new Error(resJson?.message || resJson?.error || 'Server email menolak permintaan.');
        } catch (err) {
            lastError = err;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw lastError || new Error('Gagal menghubungi server email.');
}

// [FITUR #2] Cek apakah produk pada pesanan memiliki stok di Gudang Stok
function doesOrderHaveStockInWarehouse(orderData) {
    if (!orderData) return false;
    if (orderData.autoDelivered === true) return true;
    const item = (orderData.items && orderData.items[0]) ? orderData.items[0] : null;
    if (!item) return false;

    const targetBrand = String(item.brandName || (item.name || '').split(' - ')[0] || '').trim().toLowerCase();
    const exactItemName = String(item.exactItemName || (item.name || '').replace(`(x${item.qty})`, '') || '').trim().toLowerCase();
    if (!targetBrand) return false;

    return stocksData.some(s => {
        const sBrand = String(s.brand || '').trim().toLowerCase();
        const sItem = String(s.itemName || '').trim().toLowerCase();
        return sBrand === targetBrand && (!exactItemName || sItem === exactItemName);
    });
}

// [FITUR #3] Cek apakah pembeli mengaktifkan opsi Notifikasi & Kirim Struk ke Email di profilnya
function isOrderEmailReceiptAllowedByUser(orderData) {
    if (!orderData) return false;
    if (orderData.emailReceiptEnabled === false) return false;
    const uEmail = String(orderData.userEmail || orderData.buyerEmail || '').trim().toLowerCase();
    const matchedUser = allUsersList.find(u =>
        (orderData.userId && u.uid === orderData.userId) ||
        (uEmail && u.email && u.email.toLowerCase() === uEmail)
    );
    if (matchedUser && matchedUser.emailReceiptEnabled === false) {
        return false;
    }
    return true;
}

// Pengiriman Email dengan Proteksi Anti-Dobel, Cek Stok Gudang (#2) & Cek Izin Email User (#3)
async function triggerAutomatedEmailWebhook(orderData, accountDetailsText, silent = true, explicitOrderDbId = null) {
    if (!orderData || !orderData.id) return false;

    // [FITUR #3] Jika pembeli mematikan opsi kirim struk ke email, blokir pengiriman
    if (!isOrderEmailReceiptAllowedByUser(orderData)) {
        if (!silent) {
            window.customAlert('Dinonaktifkan Pembeli', 'Pembeli mematikan opsi Notifikasi & Kirim Struk ke Email pada pengaturan profilnya.', 'warning');
        }
        return false;
    }

    // [FITUR #2] Pengiriman email struk oleh Admin/Sistem hanya tersedia jika produk memiliki stok di Gudang Stok
    if (!doesOrderHaveStockInWarehouse(orderData)) {
        if (!silent) {
            window.customAlert('Tanpa Stok Gudang', 'Pengiriman struk email hanya tersedia untuk produk yang memiliki stok di Gudang Stok.', 'warning');
        }
        return false;
    }
    if (!orderData || !orderData.id) return false;
    const invKey = String(orderData.id).trim().toUpperCase();
    const localSentKey = `vipercell_email_sent_${invKey}`;

    if (
        orderData.emailSent === true ||
        orderData.emailSending === true ||
        sentEmailOrderIds.has(invKey) ||
        inFlightEmailOrderIds.has(invKey) ||
        localStorage.getItem(localSentKey) === '1'
    ) {
        updateEmailButtonLockStateUI(true);
        return true;
    }

    const webhookUrl = (siteSettings.emailWebhookUrl || '').trim();
    if (!webhookUrl) {
        if (!silent) {
            window.customAlert('URL Belum Diatur', 'Masukkan URL Google Apps Script di tab Pengaturan Toko.', 'warning');
        }
        return false;
    }

    const buyerEmail = (orderData.userEmail || orderData.buyerEmail || '').trim();
    if (!buyerEmail || !buyerEmail.includes('@')) {
        if (!silent) {
            window.customAlert('Email Kosong', 'Pesanan ini tidak memiliki alamat email tujuan.', 'warning');
        }
        return false;
    }

    const resolvedDbId = explicitOrderDbId || orderData.dbId;

    // Kunci segera di memori, localStorage, dan Firestore sebelum request dimulai (#12)
    inFlightEmailOrderIds.add(invKey);
    sentEmailOrderIds.add(invKey);
    try { localStorage.setItem(localSentKey, '1'); } catch (e) {}

    if (resolvedDbId) {
        try {
            const latestSnap = await getDoc(doc(db, pathOrders, resolvedDbId));
            if (latestSnap.exists()) {
                const lData = latestSnap.data();
                if (lData.emailSent === true || lData.emailSending === true) {
                    inFlightEmailOrderIds.delete(invKey);
                    orderData.emailSent = true;
                    updateEmailButtonLockStateUI(true);
                    return true;
                }
            }
            await updateDoc(doc(db, pathOrders, resolvedDbId), {
                emailSent: true,
                emailSending: false,
                emailSentAt: Date.now()
            }).catch(() => {});
        } catch (e) {}
    }

    const itemObj = (orderData.items && orderData.items[0]) ? orderData.items[0] : {};
    const durDays = getOrderDurationDays(orderData);
    const endAt = orderData.subscriptionEndAt || (durDays > 0 ? (Date.now() + durDays * 86400000) : 0);
    const finalNominal = Number(orderData.finalTotal || orderData.uniqueTotal || 0);

    try {
        await callUnifiedGasWebhook({
            action: 'SEND_ORDER_DELIVERY',
            orderId: orderData.id,
            invoice: orderData.id,
            invoiceId: orderData.id,
            email: buyerEmail,
            buyerEmail: buyerEmail,
            to: buyerEmail,
            buyerName: orderData.buyerName || buyerEmail.split('@')[0],
            productName: itemObj.brandName || orderData.productName || itemObj.name || 'Produk Digital',
            variantName: itemObj.exactItemName || orderData.variantName || itemObj.name || '-',
            itemName: itemObj.name || 'Produk Vipercell',
            totalAmount: finalNominal,
            uniqueTotal: finalNominal,
            totalFormatted: `Rp ${finalNominal.toLocaleString('id-ID')}`,
            paymentMethod: (orderData.paymentMethod || 'qris').toUpperCase(),
            accountDetails: accountDetailsText || orderData.adminReply || 'Pesanan telah selesai diproses.',
            targetId: itemObj.playerInfo || orderData.targetId || '-',
            durationDays: durDays,
            subscriptionEndAt: endAt,
            date: orderData.date || new Date().toISOString()
        });

        orderData.emailSent = true;
        updateEmailButtonLockStateUI(true);

        if (!silent) {
            window.showToast('Email Terkirim', `Struk & detail pesanan dikirim ke ${buyerEmail}.`, 'success');
        }
        return true;
    } catch (e) {
        sentEmailOrderIds.delete(invKey);
        try { localStorage.removeItem(localSentKey); } catch (err) {}
        if (resolvedDbId) {
            await updateDoc(doc(db, pathOrders, resolvedDbId), { emailSent: false }).catch(() => {});
        }
        orderData.emailSent = false;
        updateEmailButtonLockStateUI(false);

        if (!silent) {
            window.customAlert('Gagal Mengirim Email', `${window.escapeHtml(e.message)}`, 'error');
        }
        return false;
    } finally {
        inFlightEmailOrderIds.delete(invKey);
    }
}

function updateEmailButtonLockStateUI(isAlreadySent, orderObj = null) {
    const boxEmail = document.getElementById('proc-email-delivery-box');
    const btnEmail = document.getElementById('btn-send-order-email');
    const badgeEmail = document.getElementById('proc-email-sent-badge');
    const noteEmail = document.getElementById('proc-email-eligibility-note');

    const hasStockInVault = orderObj ? doesOrderHaveStockInWarehouse(orderObj) : true;
    const isAllowedByUser = orderObj ? isOrderEmailReceiptAllowedByUser(orderObj) : true;

    // [FITUR #2] Jika produk tidak ada di Gudang Stok, sembunyikan fitur kirim email di modal Admin
    if (boxEmail) {
        boxEmail.style.display = hasStockInVault ? 'block' : 'none';
    }

    if (!isAllowedByUser) {
        if (btnEmail) {
            btnEmail.disabled = true;
            btnEmail.className = 'btn btn-outline btn-sm w-full';
            btnEmail.innerHTML = '<i class="fa-solid fa-bell-slash text-danger"></i> Struk Email Dimatikan Pembeli';
        }
        if (badgeEmail) {
            badgeEmail.className = 'status-badge status-failed';
            badgeEmail.innerHTML = 'NONAKTIF (USER OFF)';
        }
        if (noteEmail) {
            noteEmail.style.display = 'block';
            noteEmail.innerText = 'Pembeli menonaktifkan fitur pengiriman struk ke email di tab Profil.';
        }
        return;
    }

    if (noteEmail) {
        noteEmail.style.display = 'none';
        noteEmail.innerText = '';
    }

    if (btnEmail) {
        if (isAlreadySent) {
            btnEmail.disabled = true;
            btnEmail.className = 'btn btn-outline btn-sm w-full';
            btnEmail.innerHTML = '<i class="fa-solid fa-circle-check text-success"></i> Email Terkirim';
        } else {
            btnEmail.disabled = false;
            btnEmail.className = 'btn btn-primary btn-sm w-full';
            btnEmail.innerHTML = '<i class="fa-solid fa-envelope-circle-check"></i> Kirim ke Email';
        }
    }
    if (badgeEmail) {
        if (isAlreadySent) {
            badgeEmail.className = 'status-badge status-success';
            badgeEmail.innerHTML = '<i class="fa-solid fa-check-double"></i> TERKIRIM';
        } else {
            badgeEmail.className = 'status-badge status-unpaid';
            badgeEmail.innerHTML = 'BELUM TERKIRIM';
        }
    }
}

// Formatter Kredensial Stok Tanpa Link Default Ambil Kode (#18)
function formatAdminStockCredentialLine(rawStr, stockMode = 'PRIVATE', slotInfo = '') {
    const clean = String(rawStr || '').trim();
    if (!clean) return '';

    const parts = clean.split('|').map(s => s.trim());
    const isEmailOAuthFormat = (stockMode === 'EMAIL_OAUTH' || parts.length >= 4);

    if (isEmailOAuthFormat && parts.length >= 4) {
        const emailAddr = parts[0] || '-';
        const passStr = parts[1] || '-';
        const refreshToken = parts[2] || '-';
        const clientId = parts[3] || '-';
        const fourPartRaw = `${emailAddr}|${passStr}|${refreshToken}|${clientId}`;

        let out = `[PRODUK EMAIL${slotInfo}]\n`;
        out += `FORMAT_UTUH : ${fourPartRaw}\n`;
        out += `Email       : ${emailAddr}\n`;
        out += `Password    : ${passStr}\n`;
        out += `RefreshToken: ${refreshToken}\n`;
        out += `Client_ID   : ${clientId}`;
        return out;
    }

    if (parts.length >= 2) {
        return `[DETAIL AKUN${slotInfo}]\nEmail / ID : ${parts[0] || '-'}\nPassword   : ${parts[1] || '-'}\nKeterangan : ${parts.slice(2).join(' | ') || '-'}`;
    }

    return `[DETAIL PESANAN${slotInfo}]\n${clean}`;
}

async function attemptAutoStockDelivery(orderData, orderDbId) {
    if (processingAutoOrderIds.has(orderDbId)) return;
    if (orderData.adminReply && orderData.adminReply.trim() !== '') {
        return;
    }

    const item = orderData.items && orderData.items[0] ? orderData.items[0] : null;
    if (!item) return;

    processingAutoOrderIds.add(orderDbId);

    const durDays = getOrderDurationDays(orderData);
    const procType = (item.processType || 'auto').toLowerCase();
    const nowMs = Date.now();
    const subFields = durDays > 0 ? {
        durationDays: durDays,
        subscriptionStartAt: nowMs,
        subscriptionEndAt: nowMs + (durDays * 86400000),
        subscriptionStatus: 'ACTIVE'
    } : {};

    if (item.type === 'game' || procType === 'manual') {
        await updateDoc(doc(db, pathOrders, orderDbId), {
            status: 'PENDING',
            paymentVerified: true,
            paidAt: orderData.paidAt || nowMs,
            ...subFields
        }).catch(() => {});
        processingAutoOrderIds.delete(orderDbId);
        return false;
    }

    try {
        const targetBrand = item.brandName || item.name.split(' - ')[0];
        const exactItemName = item.exactItemName || item.name.replace(`(x${item.qty})`, '').trim();
        const neededQty = item.qty || 1;
        let deliveredText = '';

        const q = query(
            collection(db, pathStocks),
            where("brand", "==", targetBrand),
            where("itemName", "==", exactItemName),
            where("status", "==", "Ready")
        );
        const snap = await getDocs(q).catch(() => null);

        if (snap && !snap.empty) {
            const reusableDoc = snap.docs.find(d => d.data().isReusable === true);
            if (reusableDoc) {
                const rData = reusableDoc.data();
                deliveredText = formatAdminStockCredentialLine(rData.data || '', rData.stockFormat || 'REUSABLE', '');
                await updateDoc(doc(db, pathStocks, reusableDoc.id), {
                    sentCount: increment(neededQty),
                    lastSentAt: nowMs,
                    lastOrderId: orderData.id
                });
            } else {
                const collected = [];
                for (const sDoc of snap.docs) {
                    if (collected.length >= neededQty) break;
                    const sData = sDoc.data();
                    const maxQ = parseInt(sData.maxQuota || 1, 10);
                    const usedQ = parseInt(sData.usedQuota || 0, 10);

                    if (usedQ < maxQ) {
                        const nextUsed = usedQ + 1;
                        const slotLabel = maxQ > 1 ? ` (Slot #${nextUsed}/${maxQ})` : '';
                        collected.push(formatAdminStockCredentialLine(sData.data || '', sData.stockFormat || sData.mode || 'PRIVATE', slotLabel));

                        await updateDoc(doc(db, pathStocks, sDoc.id), {
                            usedQuota: nextUsed,
                            status: nextUsed >= maxQ ? 'Used' : 'Ready',
                            usedAt: nowMs,
                            orderId: orderData.id,
                            buyers: arrayUnion({
                                orderId: orderData.id,
                                buyerEmail: orderData.userEmail || '',
                                sentAt: new Date(nowMs).toISOString()
                            })
                        });
                    }
                }
                if (collected.length > 0) {
                    deliveredText = collected.join('\n\n');
                }
            }
        }

        if (deliveredText) {
            const finalReply = `Terima kasih telah berbelanja di Vipercell.\n\n${deliveredText}`;
            await updateDoc(doc(db, pathOrders, orderDbId), {
                status: 'SUCCESS',
                paymentVerified: true,
                paidAt: orderData.paidAt || nowMs,
                adminReply: finalReply,
                autoDelivered: true,
                deliveredAt: nowMs,
                ...subFields
            });

            await triggerAutomatedEmailWebhook({ ...orderData, ...subFields, adminReply: finalReply }, finalReply, true, orderDbId);
            await window.syncAllProductsWithStockVaultV27(false);
            window.showToast('Stok Terkirim', `Stok otomatis dikirim untuk #${orderData.id}`, 'success');
            return true;
        } else {
            await updateDoc(doc(db, pathOrders, orderDbId), {
                status: 'PENDING',
                paymentVerified: true,
                paidAt: orderData.paidAt || nowMs,
                ...subFields
            }).catch(() => {});
            return false;
        }
    } catch (e) {
        console.error("Auto Stock Delivery Error:", e);
    } finally {
        setTimeout(() => processingAutoOrderIds.delete(orderDbId), 3500);
    }
}

// ==========================================
// PEMBERSIHAN OTOMATIS AKUN TAMU 6 JAM
// ==========================================
function startAnonSixHourAutoCleanScheduler() {
    if (anonSixHourAutoCleanInterval) clearInterval(anonSixHourAutoCleanInterval);
    setTimeout(() => window.autoCleanExpiredAnonAccounts6h(false), 8000);
    anonSixHourAutoCleanInterval = setInterval(() => {
        window.autoCleanExpiredAnonAccounts6h(false);
    }, 600000);
}

window.autoCleanExpiredAnonAccounts6h = async function(isManualTrigger = false) {
    if (!isManualTrigger && siteSettings.anonAutoDelete6h === false) {
        return;
    }

    const now = Date.now();
    const expiredAnons = allUsersList.filter(u => {
        if (!u.uid) return false;
        const isAnon = Boolean(u.isAnonymous || u.isGuest || u.role === 'anonymous');
        if (!isAnon) return false;

        const startedMs = Number(u.sessionStartedAt || u.createdAt || u.updatedAt || 0);
        if (!startedMs) return false;

        const hasPendingOrder = orders.some(o => o.userId === u.uid && (o.status === 'UNPAID' || o.status === 'PENDING'));
        if (hasPendingOrder) return false;

        return (now - startedMs) >= ANON_AUTO_DELETE_TTL_MS;
    });

    if (expiredAnons.length === 0) {
        if (isManualTrigger) {
            window.showToast('Bersih', 'Belum ada akun tamu yang melewati batas 6 jam.', 'info');
        }
        return;
    }

    let cleanedCount = 0;
    for (const anon of expiredAnons) {
        try {
            await deleteDoc(doc(db, pathUsers, anon.uid)).catch(() => {});
            await deleteDoc(doc(db, pathChats, anon.uid)).catch(() => {});
            if (anon.deviceId) {
                await deleteDoc(doc(db, pathDeviceLocks, anon.deviceId)).catch(() => {});
            }
            cleanedCount++;
        } catch (e) {}
    }

    if (cleanedCount > 0) {
        allUsersList = allUsersList.filter(u => !expiredAnons.some(ex => ex.uid === u.uid));
        window.renderAdminMembers();
        if (isManualTrigger) {
            window.showToast('Selesai', `${cleanedCount} akun tamu (> 6 jam) berhasil dibersihkan.`, 'success');
        }
    }
};

window.clearStaleDeletedUidsV27 = function() {
    const currentDeleted = Array.isArray(siteSettings.deletedUids) ? siteSettings.deletedUids : [];
    window.openConfirm(
        'Reset Guard UID Lama',
        `Terdapat <b>${currentDeleted.length} UID lama</b>. Bersihkan daftar ini agar tidak ada akun yang ter-logout secara keliru?`,
        async (confirmed) => {
            if (!confirmed) return;
            try {
                await setDoc(doc(db, pathSettings, 'mainConfig'), {
                    deletedUids: []
                }, { merge: true });
                siteSettings.deletedUids = [];
                window.renderAdminMembers();
                window.showToast('Berhasil', 'Daftar UID lama berhasil dibersihkan.', 'success');
            } catch (e) {
                window.customAlert('Gagal', 'Gagal mereset daftar UID.', 'error');
            }
        },
        'success'
    );
};

// ==========================================
// REAL-TIME DATA LISTENERS FIRESTORE
// ==========================================
function startAdminListeners() {
    if (isListening) return;
    isListening = true;
    
    onSnapshot(doc(db, pathSettings, 'mainConfig'), (docSnap) => {
        if (docSnap.exists()) {
            const incoming = docSnap.data();
            siteSettings = { ...siteSettings, ...incoming };
            window.populateSettingsForm();
            updateTopbarStoreStatusUI();
            updateWaterRippleVisibility();
            window.renderAdminNews();
            rebuildMergedSuggestionsList();
            applyCustomAdminPwaIcon();

            if (incoming.lastPaymentDetected && incoming.lastPaymentTimestamp) {
                const ageMs = Date.now() - Number(incoming.lastPaymentTimestamp);
                if (ageMs < 180000) {
                    autoMatchIncomingPaymentAmount(Number(incoming.lastPaymentDetected));
                }
            }

            if (incoming.lastPaymentMutation && incoming.lastPaymentMutation.timestamp) {
                const mutObj = incoming.lastPaymentMutation;
                const mutAge = Date.now() - Number(mutObj.timestamp);
                if (mutAge < 180000) {
                    if (Array.isArray(mutObj.candidateAmounts) && mutObj.candidateAmounts.length > 0) {
                        mutObj.candidateAmounts.forEach(amt => autoMatchIncomingPaymentAmount(Number(amt)));
                    } else if (mutObj.amount) {
                        autoMatchIncomingPaymentAmount(Number(mutObj.amount));
                    }
                }
            }
        }
    });

    onSnapshot(collection(db, pathMutations), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const mut = change.doc.data();
                const mutTime = Number(mut.receivedAt || mut.createdAt || mut.timestamp || 0);
                const mutAge = Date.now() - mutTime;
                if (mutAge < 180000) {
                    if (Array.isArray(mut.candidateAmounts) && mut.candidateAmounts.length > 0) {
                        mut.candidateAmounts.forEach(amt => autoMatchIncomingPaymentAmount(Number(amt)));
                    } else if (mut.amount) {
                        autoMatchIncomingPaymentAmount(Number(mut.amount));
                    }
                }
            }
        });
    }, () => {});

    onSnapshot(collection(db, pathProducts), (snapshot) => {
        products = [];
        snapshot.forEach((docSnap) => { products.push({ dbId: docSnap.id, ...docSnap.data() }); });
        rebuildGroupedBrands();
        window.renderAdminCatalog();
        window.populateStockProductSelect();
        window.renderAdminStocks();
    });

    onSnapshot(collection(db, pathOrders), (snapshot) => {
        orders = [];
        let newlyDetectedOrder = null;
        const now = Date.now();
        
        snapshot.forEach((docSnap) => {
            let data = { dbId: docSnap.id, ...docSnap.data() };
            if (data.emailSent === true && data.id) {
                sentEmailOrderIds.add(String(data.id).toUpperCase());
            }

            const orderTime = new Date(data.date).getTime();

            if ((data.status === 'UNPAID' || data.status === 'PENDING_PAYMENT') && (now - orderTime > 900000)) {
                updateDoc(doc(db, pathOrders, data.dbId), { status: 'EXPIRED' }).catch(() => {});
                data.status = 'EXPIRED';
            }

            orders.push(data);

            const durDays = getOrderDurationDays(data);

            if (initialOrdersLoaded && !knownOrderIds.has(data.id)) {
                newlyDetectedOrder = data;
            }
            knownOrderIds.add(data.id);

            // Jika pembayaran diterima (status PAID atau baru lunas tanpa adminReply), cek stok lokal (#1)
            if (data.status === 'PAID' || (data.status === 'SUCCESS' && !data.adminReply && !data.autoDelivered)) {
                attemptAutoStockDelivery(data, data.dbId);
            } else if (data.status === 'SUCCESS' && durDays > 0 && !data.subscriptionEndAt) {
                ensureOrderSubscriptionInitialized(data, data.dbId);
            }
        });
        
        if (newlyDetectedOrder) {
            playNotificationSound('order');
            const itemTitle = newlyDetectedOrder.items?.[0]?.name || 'Pesanan Baru';
            const totalRp = `Rp${(newlyDetectedOrder.finalTotal || 0).toLocaleString('id-ID')}`;
            sendAdminNativeNotification(`Pesanan Baru #${newlyDetectedOrder.id}`, `${itemTitle} - ${totalRp}`);
            window.showToast(
                `Order Baru #${newlyDetectedOrder.id}`,
                `${itemTitle} (${totalRp})`,
                'success',
                () => window.switchAdminTabByName('tab-orders')
            );
        }

        initialOrdersLoaded = true;
        orders.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        window.generateAdminReports();
        window.renderAdminOrders();
        window.renderAdminMembers();
    });

    onSnapshot(collection(db, pathPromos), (snapshot) => {
        promos = [];
        snapshot.forEach((docSnap) => { promos.push({ dbId: docSnap.id, ...docSnap.data() }); });
        window.renderAdminPromos();
    });

    onSnapshot(collection(db, pathReviews), (snapshot) => {
        reviewsData = [];
        snapshot.forEach((docSnap) => { reviewsData.push({ dbId: docSnap.id, ...docSnap.data() }); });
        reviewsData.sort((a, b) => b.timestamp - a.timestamp);
        window.renderAdminReviews();
    });

    onSnapshot(collection(db, pathStocks), (snapshot) => {
        stocksData = [];
        snapshot.forEach((docSnap) => { stocksData.push({ dbId: docSnap.id, ...docSnap.data() }); });
        window.renderAdminStocks();
        window.renderAdminCatalog();
    });

    onSnapshot(collection(db, pathChats), (snapshot) => {
        allLiveChats = [];
        rawChatFallbackSuggestions = [];
        let newIncomingChat = null;

        snapshot.forEach((docSnap) => {
            const cData = { id: docSnap.id, ...docSnap.data() };
            // Pastikan saran produk TIDAK PERNAH masuk ke daftar Chat Bantuan (#3)
            const isLegacySaranDoc = docSnap.id.startsWith('saran_') ||
                cData.isProductSuggestion === true ||
                String(cData.userInfo || '').startsWith('[SARAN PRODUK]');
            if (isLegacySaranDoc) {
                // Bersihkan otomatis dari koleksi chats agar tidak pernah muncul di Chat Bantuan
                deleteDoc(doc(db, pathChats, docSnap.id)).catch(() => {});
                rawChatFallbackSuggestions.push({
                    dbId: docSnap.id,
                    id: cData.id || docSnap.id,
                    senderName: cData.senderName || String(cData.userInfo || 'Pelanggan').replace('[SARAN PRODUK]', '').trim(),
                    senderEmail: cData.senderEmail || cData.userEmail || '',
                    isMember: Boolean(cData.isMember),
                    productName: cData.productName || '-',
                    category: cData.category || 'Produk',
                    notes: cData.notes || '',
                    createdAt: cData.createdAt || cData.updatedAt || Date.now()
                });
                return;
            }
            allLiveChats.push(cData);
            const msgs = cData.messages || [];
            const lastMsg = msgs[msgs.length - 1];

            if (lastMsg && lastMsg.sender === 'user') {
                const prevTs = knownChatTimestamps[cData.id] || 0;
                if (initialChatsLoaded && lastMsg.timestamp > prevTs) {
                    newIncomingChat = { id: cData.id, user: cData.userInfo || 'Pelanggan', text: lastMsg.text };
                }
            }
            if (lastMsg) {
                knownChatTimestamps[cData.id] = lastMsg.timestamp;
            }
        });

        if (newIncomingChat) {
            playNotificationSound('chat');
            sendAdminNativeNotification(`Chat dari ${newIncomingChat.user}`, newIncomingChat.text);
            const activeTab = document.querySelector('.admin-tab.active');
            if (!activeTab || activeTab.id !== 'tab-livechat') {
                window.showToast(
                    `Pesan: ${newIncomingChat.user}`,
                    newIncomingChat.text,
                    'info',
                    () => {
                        window.switchAdminTabByName('tab-livechat');
                        window.openAdminChatDetailDesk(newIncomingChat.id);
                    }
                );
            }
        }

        initialChatsLoaded = true;
        allLiveChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        
        const countBadge = document.getElementById('chat-active-count');
        if (countBadge) countBadge.innerText = `${allLiveChats.length} Sesi`;
        const subChatCount = document.getElementById('admin-chat-tab-count');
        if (subChatCount) subChatCount.innerText = String(allLiveChats.length);

        rebuildMergedSuggestionsList();
        window.renderAdminChatList();
        if (activeAdminChatId) {
            window.renderActiveChatMessages();
        }
        window.renderAdminMembers();
    });

    onSnapshot(collection(db, pathSuggestions), (snapshot) => {
        rawCollectionSuggestions = [];
        snapshot.forEach((docSnap) => {
            rawCollectionSuggestions.push({ dbId: docSnap.id, ...docSnap.data() });
        });
        rebuildMergedSuggestionsList();
    }, () => {});

    onSnapshot(collection(db, pathUsers), (snapshot) => {
        allUsersList = [];
        snapshot.forEach((docSnap) => {
            allUsersList.push({ uid: docSnap.id, ...docSnap.data() });
        });
        allUsersList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        window.renderAdminMembers();
    });
}

async function autoMatchIncomingPaymentAmount(detectedAmount, rawNotifText = '') {
    const numAmt = Math.round(Number(detectedAmount) || 0);
    const unpaidMatch = orders.find(o => {
        if (o.status !== 'UNPAID' && o.status !== 'PENDING_PAYMENT') return false;
        const fTotal = Math.round(Number(o.finalTotal) || 0);
        const uTotal = Math.round(Number(o.uniqueTotal) || 0);
        if (numAmt > 0 && (fTotal === numAmt || uTotal === numAmt)) return true;
        if (rawNotifText && fTotal > 0) {
            const dotStr = fTotal.toLocaleString('id-ID');
            const commaStr = dotStr.replace(/\./g, ',');
            if (rawNotifText.includes(dotStr) || rawNotifText.includes(commaStr) || rawNotifText.includes(String(fTotal))) {
                return true;
            }
        }
        return false;
    });
    if (unpaidMatch) {
        try {
            playNotificationSound('order');
            const delivered = await attemptAutoStockDelivery(unpaidMatch, unpaidMatch.dbId);
            window.showToast(
                'Pembayaran Diterima',
                delivered
                    ? `Nominal Rp${(unpaidMatch.finalTotal || numAmt).toLocaleString('id-ID')} melunasi #${unpaidMatch.id} & stok terkirim.`
                    : `Nominal Rp${(unpaidMatch.finalTotal || numAmt).toLocaleString('id-ID')} diterima. #${unpaidMatch.id} berstatus PENDING (Diproses Admin).`,
                'success'
            );
            return true;
        } catch (e) {}
    }
    return false;
}

async function pollGasWebhookInAdmin() {
    if (isPollingAdminGas) return;
    const gasUrl = (siteSettings.emailWebhookUrl || '').trim();
    if (!gasUrl || !gasUrl.startsWith('https://script.google.com/')) return;

    const now = Date.now();
    const activeUnpaidOrders = orders.filter(o =>
        (o.status === 'UNPAID' || o.status === 'PENDING_PAYMENT') &&
        (o.paymentMethod || 'qris') === 'qris' &&
        (now - new Date(o.date).getTime() < 900000)
    );
    if (activeUnpaidOrders.length === 0) return;

    isPollingAdminGas = true;
    try {
        const sep = gasUrl.includes('?') ? '&' : '?';
        const resp = await fetch(`${gasUrl}${sep}action=GET_RECENT_MUTATIONS&t=${now}`, {
            method: 'GET',
            redirect: 'follow',
            cache: 'no-store'
        });
        const raw = await resp.text();
        let data = null;
        try { data = JSON.parse(raw); } catch (e) {}

        if (data && data.ok && Array.isArray(data.recentMutations)) {
            for (const mut of data.recentMutations) {
                if (!mut) continue;
                const cands = Array.isArray(mut.candidateAmounts) ? mut.candidateAmounts : [mut.amount];
                for (const cAmt of cands) {
                    await autoMatchIncomingPaymentAmount(Number(cAmt), mut.rawText || '');
                }
            }
        }
    } catch (e) {
    } finally {
        isPollingAdminGas = false;
    }
}

function startAdminGasWebhookPolling() {
    if (adminGasPollInterval) clearInterval(adminGasPollInterval);
    adminGasPollInterval = setInterval(() => {
        if (!document.hidden) {
            pollGasWebhookInAdmin();
        }
    }, 3500);
}

// ==========================================
// PEMINDAI BARCODE KASIR TUNAI
// ==========================================
window.openBarcodeScannerModal = function() {
    document.getElementById('manual-barcode-input').value = '';
    const resBox = document.getElementById('scanned-order-result');
    if (resBox) {
        resBox.style.display = 'none';
        resBox.innerHTML = '';
    }
    window.openModal('modal-barcode-scanner');

    const readerBox = document.getElementById('barcode-reader-box');
    if (!readerBox || typeof Html5Qrcode === 'undefined') return;

    if (html5BarcodeScanner) {
        try { html5BarcodeScanner.stop().catch(() => {}); } catch (e) {}
    }

    html5BarcodeScanner = new Html5Qrcode("barcode-reader-box");
    html5BarcodeScanner.start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 250, height: 110 } },
        (decodedText) => {
            playNotificationSound('order');
            const cleanCode = decodedText.trim().toUpperCase();
            document.getElementById('manual-barcode-input').value = cleanCode;
            window.lookupOrderByBarcodeInput(cleanCode);
            if (html5BarcodeScanner) {
                html5BarcodeScanner.stop().catch(() => {});
            }
        },
        () => {}
    ).catch(() => {
        readerBox.innerHTML = `<div class="p-3 text-center text-xs" style="color:#94a3b8;"><i class="fa-solid fa-camera-slash" style="font-size:1.6rem; display:block; margin-bottom:6px;"></i>Kamera tidak tersedia. Masukkan kode invoice di bawah.</div>`;
    });
};

window.closeBarcodeScannerModal = function() {
    if (html5BarcodeScanner) {
        try { html5BarcodeScanner.stop().catch(() => {}); } catch (e) {}
        html5BarcodeScanner = null;
    }
    window.closeModal('modal-barcode-scanner');
};

window.lookupOrderByBarcodeInput = function(forcedCode = null) {
    const rawCode = forcedCode || document.getElementById('manual-barcode-input')?.value || '';
    const invCode = rawCode.trim().replace(/^#/, '').toUpperCase();
    const resBox = document.getElementById('scanned-order-result');
    if (!invCode || !resBox) return;

    const order = orders.find(o => (o.id || '').toUpperCase() === invCode);
    resBox.style.display = 'block';

    if (!order) {
        resBox.innerHTML = `<div class="info-box bg-danger-light border-danger text-danger fw-bold text-xs"><i class="fa-solid fa-circle-xmark"></i> Invoice <b>#${window.escapeHtml(invCode)}</b> tidak ditemukan.</div>`;
        return;
    }

    const item = order.items && order.items[0] ? order.items[0] : {};
    const sBadge = order.status === 'SUCCESS' ? 'status-success' : (order.status === 'PENDING' ? 'status-pending' : 'status-unpaid');

    let actionBtnHtml = '';
    if (order.status !== 'SUCCESS') {
        actionBtnHtml = `
            <div class="flex-wrap-gap mt-3">
                <button class="btn btn-success flex-2" onclick="window.approveCashBarcodeDirectly('${order.dbId}')">
                    <i class="fa-solid fa-cash-register"></i> Terima Tunai & Selesaikan
                </button>
                <button class="btn btn-outline flex-1" onclick="window.closeBarcodeScannerModal(); window.promptProcessOrder('${order.dbId}')">
                    <i class="fa-solid fa-sliders"></i> Proses Manual
                </button>
            </div>`;
    } else {
        actionBtnHtml = `<div class="info-box bg-success-light border-success text-success fw-bold text-center text-xs mt-2"><i class="fa-solid fa-circle-check"></i> Transaksi ini sudah selesai.</div>`;
    }

    resBox.innerHTML = `
        <div class="dashboard-panel mb-0" style="padding: 1rem; background: var(--bg);">
            <div class="flex-between align-center mb-2">
                <strong class="text-primary code-mono" style="font-size:1.02rem;">#${window.escapeHtml(order.id)}</strong>
                <span class="status-badge ${sBadge}">${order.status}</span>
            </div>
            <div class="text-sm fw-bold text-dark">${window.escapeHtml(item.name || '-')}</div>
            <div class="text-xs text-muted mb-2">${window.escapeHtml(item.playerInfo || '')} &bull; ${window.escapeHtml(order.userEmail || '-')}</div>
            <div class="flex-between align-center" style="padding-top:8px; border-top:1.5px dashed var(--border-subtle);">
                <span class="text-xs fw-bold text-muted">TOTAL TUNAI:</span>
                <strong class="text-success" style="font-size:1.25rem; font-family:var(--font-heading);">Rp${(order.finalTotal || 0).toLocaleString('id-ID')}</strong>
            </div>
            ${actionBtnHtml}
        </div>
    `;
};

window.approveCashBarcodeDirectly = async function(dbId) {
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;

    try {
        window.closeBarcodeScannerModal();
        const delivered = await attemptAutoStockDelivery(order, dbId);
        if (!delivered) {
            window.promptProcessOrder(dbId);
            window.showToast('Tunai Diterima (Pending)', `Pembayaran diterima. Silakan kirim pesanan ${order.id}.`, 'info');
        } else {
            window.showToast('Tunai Diterima & Terkirim', `Pembayaran ${order.id} diterima & stok otomatis dikirim.`, 'success');
        }
    } catch (e) {
        window.customAlert('Gagal', 'Gagal memverifikasi pembayaran kasir.', 'error');
    }
};

// ==========================================
// DATA PENGGUNA (MEMBER & TAMU)
// ==========================================
window.setAdminMemberFilter = function(filterType, btnEl) {
    currentMemberFilter = filterType;
    document.querySelectorAll('#tab-members .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    window.renderAdminMembers();
};

window.renderAdminMembers = function() {
    const grid = document.getElementById('admin-members-grid');
    if (!grid) return;

    const searchQ = (document.getElementById('admin-search-member')?.value || '').trim().toLowerCase();
    const deletedList = Array.isArray(siteSettings.deletedUids) ? siteSettings.deletedUids : [];
    const blockedUidList = Array.isArray(siteSettings.blockedUids) ? siteSettings.blockedUids : [];
    const blockedDevList = Array.isArray(siteSettings.blockedDevices) ? siteSettings.blockedDevices : [];

    const combinedUsersMap = new Map();

    allUsersList.forEach(u => {
        if (!u.uid) return;
        const isAnon = Boolean(u.isAnonymous || u.isGuest || u.role === 'anonymous');
        if (u.isDeleted === true || (isAnon && deletedList.includes(u.uid))) return;
        combinedUsersMap.set(u.uid, { ...u });
    });

    allLiveChats.forEach(c => {
        if (c.id && !combinedUsersMap.has(c.id) && !deletedList.includes(c.id)) {
            combinedUsersMap.set(c.id, {
                uid: c.id,
                name: c.userInfo || `Tamu #${c.id.slice(-4).toUpperCase()}`,
                email: c.userEmail || '',
                deviceId: c.deviceId || '',
                role: 'anonymous',
                isAnonymous: true,
                isGuest: true,
                createdAt: c.updatedAt || Date.now()
            });
        }
    });

    const activeUsersArray = Array.from(combinedUsersMap.values());

    const enrichedUsers = activeUsersArray.map(u => {
        const isAnon = Boolean(u.isAnonymous || u.isGuest || u.role === 'anonymous');
        const uEmail = (u.email || '').toLowerCase();
        const userOrders = orders.filter(o => o.userId === u.uid || (!isAnon && uEmail && o.userEmail?.toLowerCase() === uEmail));
        const successOrders = userOrders.filter(o => o.status === 'SUCCESS');
        const totalSpent = successOrders.reduce((sum, o) => sum + (o.finalTotal || 0), 0);

        const orderWithPhone = userOrders.find(o => o.userPhone && o.userPhone.trim() !== '');
        const resolvedPhone = u.phone || u.whatsapp || (orderWithPhone ? orderWithPhone.userPhone : '');
        const resolvedDevice = u.deviceId || (userOrders[0]?.deviceId || '');

        const isBlocked = Boolean(
            u.isBlocked === true ||
            blockedUidList.includes(u.uid) ||
            (resolvedDevice && blockedDevList.includes(resolvedDevice))
        );

        return {
            ...u,
            isAnon,
            isBlocked,
            deviceId: resolvedDevice,
            resolvedPhone,
            totalTrx: userOrders.length,
            successTrx: successOrders.length,
            totalSpent
        };
    });

    const totalMemberEl = document.getElementById('member-stat-total');
    const totalAnonEl = document.getElementById('member-stat-anon');
    const anonSubEl = document.getElementById('member-stat-anon-sub');
    const phoneEl = document.getElementById('member-stat-phone');
    const buyerEl = document.getElementById('member-stat-buyers');

    if (totalMemberEl) totalMemberEl.innerText = enrichedUsers.filter(u => !u.isAnon).length;
    if (totalAnonEl) totalAnonEl.innerText = enrichedUsers.filter(u => u.isAnon).length;
    if (anonSubEl) anonSubEl.innerText = siteSettings.anonAutoDelete6h !== false ? 'Pembersihan 6 Jam: Aktif' : 'Pembersihan 6 Jam: Nonaktif';
    if (phoneEl) phoneEl.innerText = enrichedUsers.filter(u => u.email && u.email.includes('@')).length;
    if (buyerEl) buyerEl.innerText = enrichedUsers.filter(u => u.successTrx > 0).length;

    let filtered = enrichedUsers.filter(u => {
        if (currentMemberFilter === 'MEMBER') return !u.isAnon;
        if (currentMemberFilter === 'ANONYMOUS') return u.isAnon;
        return true;
    });

    if (searchQ) {
        filtered = filtered.filter(u =>
            (u.name || '').toLowerCase().includes(searchQ) ||
            (u.email || '').toLowerCase().includes(searchQ) ||
            (u.resolvedPhone || '').toLowerCase().includes(searchQ) ||
            (u.deviceId || '').toLowerCase().includes(searchQ) ||
            (u.uid || '').toLowerCase().includes(searchQ)
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="dashboard-panel text-center text-muted" style="grid-column: 1/-1; padding: 2rem;">Tidak ada data pengguna ditemukan.</div>`;
        return;
    }

    let html = '';
    filtered.forEach(u => {
        const shortUid = (u.uid || '').slice(-4).toUpperCase();
        const displayName = u.name || (u.isAnon ? `Tamu #${shortUid}` : (u.email ? u.email.split('@')[0] : 'Member'));
        const initial = u.isAnon ? 'T' : displayName.charAt(0).toUpperCase();
        const joinDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
        const phoneStr = u.resolvedPhone || '';

        let statusRoleBadge = u.isAnon
            ? `<span class="status-badge status-anon"><i class="fa-solid fa-user"></i> TAMU</span>`
            : `<span class="status-badge status-success"><i class="fa-solid fa-circle-check"></i> MEMBER</span>`;

        if (u.isBlocked) {
            statusRoleBadge = `<span class="status-badge status-failed"><i class="fa-solid fa-ban"></i> DIBLOKIR</span>`;
        }

        let cleanWa = phoneStr.replace(/[^0-9]/g, '');
        if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1);
        const waBtnHtml = cleanWa
            ? `<a href="https://wa.me/${cleanWa}?text=${encodeURIComponent(`Halo kak ${displayName}, Admin Vipercell menghubungi...`)}" target="_blank" class="btn btn-success btn-sm" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`
            : `<button class="btn btn-outline btn-sm" disabled title="Belum ada No WA"><i class="fa-brands fa-whatsapp"></i></button>`;

        const emailBtnHtml = (u.email && u.email.includes('@'))
            ? `<a href="mailto:${encodeURIComponent(u.email)}?subject=${encodeURIComponent('Informasi Akun Vipercell')}" class="btn btn-outline btn-sm" title="Email"><i class="fa-regular fa-envelope"></i></a>`
            : '';

        const blockBtnHtml = u.isBlocked
            ? `<button class="btn btn-warning btn-sm" onclick="window.toggleBlockUserAccount('${escapeJsStr(u.uid)}', '${escapeJsStr(u.deviceId || '')}', false)">
                   <i class="fa-solid fa-unlock"></i> Buka Blokir
               </button>`
            : `<button class="btn btn-outline btn-sm text-warning border-warning" onclick="window.toggleBlockUserAccount('${escapeJsStr(u.uid)}', '${escapeJsStr(u.deviceId || '')}', true)">
                   <i class="fa-solid fa-ban"></i> Blokir
               </button>`;

        html += `
        <div class="member-card" style="${u.isBlocked ? 'border-color: var(--danger); opacity: 0.88;' : ''}">
            <div>
                <div class="member-card-head mb-2">
                    <div class="member-avatar ${u.isAnon ? 'anon-avatar' : ''}" style="${u.isBlocked ? 'background: var(--danger); color: #fff;' : ''}">${window.escapeHtml(initial)}</div>
                    <div style="flex:1; min-width:0;">
                        <div class="flex-between align-center mb-1">
                            <strong class="text-dark" style="font-size:0.94rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(displayName)}</strong>
                            ${statusRoleBadge}
                        </div>
                        <span class="text-xs text-muted d-block" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="fa-regular fa-envelope"></i> ${window.escapeHtml(u.email || 'Akun Tamu')}</span>
                    </div>
                </div>

                <div class="member-meta-box">
                    <div class="member-meta-item">
                        <span>TRANSAKSI</span>
                        <strong>${u.successTrx}x Selesai (${u.totalTrx}x)</strong>
                    </div>
                    <div class="member-meta-item">
                        <span>TOTAL BELANJA</span>
                        <strong class="text-primary">Rp${u.totalSpent.toLocaleString('id-ID')}</strong>
                    </div>
                    <div class="member-meta-item" style="grid-column: 1 / -1; border-top: 1px dashed var(--border-subtle); padding-top: 6px; display:flex; justify-content:space-between;">
                        <span>Terdaftar: <b>${joinDate}</b></span>
                        <span>UID: <b class="code-mono">#${window.escapeHtml(shortUid)}</b></span>
                    </div>
                </div>
            </div>

            <div class="member-actions-row">
                <button class="btn btn-primary btn-sm flex-1" onclick="window.startChatWithMember('${escapeJsStr(u.uid)}', '${escapeJsStr(displayName)}', '${escapeJsStr(u.email || '')}')">
                    <i class="fa-solid fa-comments"></i> Chat
                </button>
                ${emailBtnHtml}
                ${blockBtnHtml}
                <button class="btn btn-danger btn-sm" onclick="window.promptDeleteAccount('${escapeJsStr(u.uid)}')" title="Hapus">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>`;
    });

    grid.innerHTML = html;
};

window.startChatWithMember = async function(uid, memberName, memberEmail) {
    if (!uid) return;
    try {
        const chatRef = doc(db, pathChats, uid);
        const snap = await getDoc(chatRef);
        if (!snap.exists()) {
            await setDoc(chatRef, {
                uid: uid,
                userInfo: memberName || memberEmail || 'Pelanggan',
                userEmail: memberEmail || '',
                updatedAt: Date.now(),
                messages: []
            });
        }
        window.switchAdminTabByName('tab-livechat');
        setTimeout(() => {
            window.openAdminChatDetailDesk(uid);
        }, 160);
    } catch (e) {
        window.customAlert('Gagal', 'Tidak dapat membuka ruang chat.', 'error');
    }
};

window.toggleBlockUserAccount = async function(uid, deviceId, shouldBlock) {
    if (!uid) return;
    const actionLabel = shouldBlock ? 'Blokir' : 'Buka Blokir';

    window.openConfirm(
        `${actionLabel} Pengguna`,
        shouldBlock
            ? `Blokir akun dan perangkat pengguna ini?`
            : `Buka kembali akses untuk akun dan perangkat pengguna ini?`,
        async (confirmed) => {
            if (!confirmed) return;
            try {
                let blockedUids = Array.isArray(siteSettings.blockedUids) ? [...siteSettings.blockedUids] : [];
                let blockedDevices = Array.isArray(siteSettings.blockedDevices) ? [...siteSettings.blockedDevices] : [];

                if (shouldBlock) {
                    if (!blockedUids.includes(uid)) blockedUids.push(uid);
                    if (deviceId && !blockedDevices.includes(deviceId)) blockedDevices.push(deviceId);
                } else {
                    blockedUids = blockedUids.filter(id => id !== uid);
                    if (deviceId) blockedDevices = blockedDevices.filter(d => d !== deviceId);
                }

                await setDoc(doc(db, pathSettings, 'mainConfig'), {
                    blockedUids: blockedUids,
                    blockedDevices: blockedDevices
                }, { merge: true });

                siteSettings.blockedUids = blockedUids;
                siteSettings.blockedDevices = blockedDevices;

                await setDoc(doc(db, pathUsers, uid), { isBlocked: shouldBlock, updatedAt: Date.now() }, { merge: true }).catch(() => {});
                if (deviceId) {
                    await setDoc(doc(db, pathDeviceLocks, deviceId), { isBlocked: shouldBlock, updatedAt: Date.now() }, { merge: true }).catch(() => {});
                }

                window.renderAdminMembers();
                window.showToast(
                    shouldBlock ? 'Diblokir' : 'Blokir Dibuka',
                    shouldBlock ? 'Pengguna telah diblokir.' : 'Akses pengguna telah dipulihkan.',
                    shouldBlock ? 'warning' : 'success'
                );
            } catch (err) {
                window.customAlert('Error', 'Gagal mengubah status blokir pengguna.', 'error');
            }
        },
        shouldBlock ? 'delete' : 'success'
    );
};

window.promptDeleteAccount = function(uid) {
    const userObj = allUsersList.find(u => u.uid === uid) || { uid: uid, name: `Tamu #${uid.slice(-4).toUpperCase()}`, isAnonymous: true };
    const uEmail = (userObj.email || '').toLowerCase();
    const userOrders = orders.filter(o => o.userId === uid || (uEmail && o.userEmail?.toLowerCase() === uEmail));

    document.getElementById('del-acc-uid').value = uid;
    document.getElementById('del-acc-device').value = userObj.deviceId || '';
    document.getElementById('del-opt-devicelock').checked = true;
    document.getElementById('del-opt-orders').checked = false;

    const summaryEl = document.getElementById('del-acc-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div><b>Nama:</b> ${window.escapeHtml(userObj.name || 'Tamu')} (${userObj.isAnonymous || userObj.isGuest ? 'Tamu' : 'Member'})</div>
            <div><b>UID / Email:</b> ${window.escapeHtml(userObj.email || uid)}</div>
            <div><b>Riwayat Pesanan:</b> ${userOrders.length} Transaksi</div>
        `;
    }

    window.openModal('modal-delete-account');
};

window.executeAccountDeletion = async function() {
    const uid = document.getElementById('del-acc-uid').value;
    const deviceId = document.getElementById('del-acc-device').value;
    const releaseDeviceLock = document.getElementById('del-opt-devicelock').checked;
    const removeOrders = document.getElementById('del-opt-orders').checked;

    if (!uid) return;

    const btn = document.getElementById('btn-confirm-del-acc');
    const ogHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menghapus...</span>';

    try {
        let deletedUids = Array.isArray(siteSettings.deletedUids) ? [...siteSettings.deletedUids] : [];
        let blockedUids = Array.isArray(siteSettings.blockedUids) ? [...siteSettings.blockedUids] : [];
        let blockedDevices = Array.isArray(siteSettings.blockedDevices) ? [...siteSettings.blockedDevices] : [];

        if (!releaseDeviceLock) {
            if (!deletedUids.includes(uid)) deletedUids.push(uid);
            if (!blockedUids.includes(uid)) blockedUids.push(uid);
            if (deviceId && !blockedDevices.includes(deviceId)) blockedDevices.push(deviceId);
        } else {
            deletedUids = deletedUids.filter(id => id !== uid);
            blockedUids = blockedUids.filter(id => id !== uid);
            if (deviceId) blockedDevices = blockedDevices.filter(d => d !== deviceId);
        }

        await setDoc(doc(db, pathSettings, 'mainConfig'), {
            deletedUids: deletedUids,
            blockedUids: blockedUids,
            blockedDevices: blockedDevices
        }, { merge: true });

        siteSettings.deletedUids = deletedUids;
        siteSettings.blockedUids = blockedUids;
        siteSettings.blockedDevices = blockedDevices;

        await deleteDoc(doc(db, pathUsers, uid)).catch(() => {});
        await deleteDoc(doc(db, pathChats, uid)).catch(() => {});

        if (deviceId) {
            if (releaseDeviceLock) {
                deleteDoc(doc(db, pathDeviceLocks, deviceId)).catch(() => {});
            } else {
                setDoc(doc(db, pathDeviceLocks, deviceId), { uid: uid, isBlocked: true, status: 'blocked_by_admin' }, { merge: true }).catch(() => {});
            }
        }

        const relatedOrders = orders.filter(o => o.userId === uid);
        for (const ord of relatedOrders) {
            if (removeOrders) {
                await deleteDoc(doc(db, pathOrders, ord.dbId)).catch(() => {});
            } else {
                await updateDoc(doc(db, pathOrders, ord.dbId), { userStatus: 'Deleted User' }).catch(() => {});
            }
        }

        allUsersList = allUsersList.filter(u => u.uid !== uid);
        window.renderAdminMembers();

        window.closeModal('modal-delete-account');
        window.showToast('Akun Dihapus', 'Akun pengguna berhasil dihapus.', 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menghapus akun.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = ogHtml;
    }
};

window.bulkDeleteInactiveGuests = function() {
    const emptyGuests = allUsersList.filter(u => {
        if (!u.uid) return false;
        const isAnon = Boolean(u.isAnonymous || u.isGuest || u.role === 'anonymous');
        if (!isAnon) return false;
        const hasOrder = orders.some(o => o.userId === u.uid);
        return !hasOrder;
    });

    if (emptyGuests.length === 0) {
        window.customAlert('Bersih', 'Tidak ada akun Tamu dengan 0 transaksi saat ini.', 'info');
        return;
    }

    window.openConfirm(
        'Hapus Tamu 0 Transaksi',
        `Ditemukan <b>${emptyGuests.length} akun Tamu</b> tanpa transaksi. Hapus semuanya sekarang?`,
        async (confirmed) => {
            if (!confirmed) return;
            try {
                let count = 0;
                for (const g of emptyGuests) {
                    await deleteDoc(doc(db, pathUsers, g.uid)).catch(() => {});
                    await deleteDoc(doc(db, pathChats, g.uid)).catch(() => {});
                    if (g.deviceId) {
                        await deleteDoc(doc(db, pathDeviceLocks, g.deviceId)).catch(() => {});
                    }
                    count++;
                }

                allUsersList = allUsersList.filter(u => !emptyGuests.some(g => g.uid === u.uid));
                window.renderAdminMembers();
                window.showToast('Selesai', `${count} akun tamu berhasil dihapus.`, 'success');
            } catch (e) {
                window.customAlert('Gagal', 'Terjadi kesalahan saat menghapus akun tamu.', 'error');
            }
        },
        'delete'
    );
};

// ==========================================
// RINGKASAN DASHBOARD
// ==========================================
window.generateAdminReports = function() {
    const now = Date.now();
    const successOrders = orders.filter(o => o.status === 'SUCCESS');
    const needActionOrders = orders.filter(o => {
        if (o.status === 'PENDING' || (o.status === 'SUCCESS' && !o.adminReply)) return true;
        if (o.status === 'SUCCESS' && o.subscriptionStatus !== 'KICKED') {
            const durDays = getOrderDurationDays(o);
            const endAt = o.subscriptionEndAt || (durDays > 0 ? (new Date(o.date).getTime() + durDays * 86400000) : 0);
            if (endAt > 0 && now >= endAt) return true;
        }
        return false;
    });
    
    const todayStr = new Date().toLocaleDateString('id-ID');
    let totalRevenue = 0;
    let todayRevenue = 0;
    let totalSales = successOrders.length;
    let productCountMap = {};
    
    successOrders.forEach(o => {
        const amount = o.finalTotal || 0;
        totalRevenue += amount;
        if (new Date(o.date).toLocaleDateString('id-ID') === todayStr) {
            todayRevenue += amount;
        }
        (o.items || []).forEach(item => {
            const keyName = `${item.brandName || ''} - ${item.exactItemName || item.name}`;
            if (!productCountMap[keyName]) productCountMap[keyName] = { qty: 0, revenue: 0 };
            const iQty = item.qty || 1;
            productCountMap[keyName].qty += iQty;
            productCountMap[keyName].revenue += (item.priceNum * iQty);
        });
    });
    
    const revEl = document.getElementById('report-revenue');
    const todayRevEl = document.getElementById('report-today-revenue');
    const saleEl = document.getElementById('report-sales');
    const pendEl = document.getElementById('report-pending');

    if (revEl) revEl.innerText = `Rp${totalRevenue.toLocaleString('id-ID')}`;
    if (todayRevEl) todayRevEl.innerText = `Rp${todayRevenue.toLocaleString('id-ID')}`;
    if (saleEl) saleEl.innerText = totalSales;
    if (pendEl) pendEl.innerText = needActionOrders.length;
    
    const sortedProducts = Object.entries(productCountMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    const topTbody = document.getElementById('report-top-products');
    if (topTbody) {
        if (sortedProducts.length === 0) {
            topTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Belum ada data penjualan.</td></tr>';
        } else {
            let html = '';
            sortedProducts.forEach(prod => {
                html += `<tr>
                    <td><strong class="text-dark">${window.escapeHtml(prod[0])}</strong></td>
                    <td><span class="status-badge status-success">${prod[1].qty} Item</span></td>
                    <td class="text-primary fw-bold">Rp${prod[1].revenue.toLocaleString('id-ID')}</td>
                </tr>`;
            });
            topTbody.innerHTML = html;
        }
    }

    const recentTbody = document.getElementById('report-recent-orders');
    if (recentTbody) {
        const recentList = orders.slice(0, 5);
        if (recentList.length === 0) {
            recentTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada pesanan masuk.</td></tr>';
        } else {
            let rHtml = '';
            recentList.forEach(o => {
                const badgeClass = o.status === 'SUCCESS' ? 'status-success' : (o.status === 'PENDING' ? 'status-pending' : (o.status === 'UNPAID' ? 'status-unpaid' : 'status-failed'));
                const itemName = o.items && o.items[0] ? o.items[0].name : '-';
                rHtml += `<tr class="pointer" onclick="window.promptProcessOrder('${o.dbId}')">
                    <td><strong class="code-mono">#${window.escapeHtml(o.id)}</strong></td>
                    <td><span class="text-xs">${window.escapeHtml(itemName)}</span></td>
                    <td class="fw-bold">Rp${(o.finalTotal || 0).toLocaleString('id-ID')}</td>
                    <td><span class="status-badge ${badgeClass}">${o.status}</span></td>
                </tr>`;
            });
            recentTbody.innerHTML = rHtml;
        }
    }
};

// ==========================================
// MANAJEMEN PESANAN MASUK
// ==========================================
window.setAdminOrderFilter = function(filterType, btnEl) {
    currentOrderFilter = filterType;
    document.querySelectorAll('#tab-orders .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    window.renderAdminOrders();
};

window.renderAdminOrders = function() {
    const tbody = document.getElementById('admin-order-list');
    if (!tbody) return;
    
    const searchInput = document.getElementById('admin-search-order');
    let queryText = searchInput ? searchInput.value.trim().toUpperCase() : '';
    const now = Date.now();
    
    let filteredOrders = orders.filter(o => {
        const durDays = getOrderDurationDays(o);
        const endAt = o.subscriptionEndAt || (durDays > 0 && o.status === 'SUCCESS' ? (new Date(o.date).getTime() + durDays * 86400000) : 0);
        const isSubExpired = o.status === 'SUCCESS' && endAt > 0 && now >= endAt && o.subscriptionStatus !== 'KICKED';
        const isSubActive = o.status === 'SUCCESS' && endAt > 0 && now < endAt && o.subscriptionStatus !== 'KICKED';

        if (currentOrderFilter === 'NEED_ACTION') {
            return o.status === 'PENDING' || (o.status === 'SUCCESS' && !o.adminReply) || isSubExpired;
        }
        if (currentOrderFilter === 'SUB_ACTIVE') return isSubActive;
        if (currentOrderFilter === 'SUB_EXPIRED') return isSubExpired;
        if (currentOrderFilter === 'CASH_ONLY') return o.paymentMethod === 'cash';
        if (currentOrderFilter === 'UNPAID') return o.status === 'UNPAID' || o.status === 'PENDING_PAYMENT';
        if (currentOrderFilter === 'SUCCESS') return o.status === 'SUCCESS' && !!o.adminReply;
        if (currentOrderFilter === 'FAILED') return o.status === 'FAILED' || o.status === 'EXPIRED' || o.status === 'CANCELLED';
        return true;
    });

    if (queryText !== '') {
        filteredOrders = filteredOrders.filter(o => {
            const matchId = o.id && o.id.toUpperCase().includes(queryText);
            const matchEmail = o.userEmail && o.userEmail.toUpperCase().includes(queryText);
            const matchPhone = o.userPhone && o.userPhone.toUpperCase().includes(queryText);
            const matchReply = o.adminReply && o.adminReply.toUpperCase().includes(queryText);
            const matchItem = o.items && o.items.some(i => (i.name || '').toUpperCase().includes(queryText) || (i.playerInfo || '').toUpperCase().includes(queryText));
            return matchId || matchEmail || matchPhone || matchReply || matchItem;
        });
    }
    
    if (filteredOrders.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">Tidak ada pesanan pada filter ini.</td></tr>`; 
        return; 
    }
    
    let renderLimit = filteredOrders.slice(0, 100);
    let html = '';
    renderLimit.forEach(o => {
        const durDays = getOrderDurationDays(o);
        const endAt = o.subscriptionEndAt || (durDays > 0 && o.status === 'SUCCESS' ? (new Date(o.date).getTime() + durDays * 86400000) : 0);
        const isSubExpired = o.status === 'SUCCESS' && endAt > 0 && now >= endAt && o.subscriptionStatus !== 'KICKED';
        const isSubActive = o.status === 'SUCCESS' && endAt > 0 && now < endAt && o.subscriptionStatus !== 'KICKED';
        const isSubKicked = o.status === 'SUCCESS' && o.subscriptionStatus === 'KICKED';

        let sBadge = `<span class="status-badge status-unpaid">MENUNGGU PEMBAYARAN</span>`;
        if (o.status === 'PENDING') sBadge = `<span class="status-badge status-pending">DIPROSES ADMIN (PENDING)</span>`;
        else if (o.status === 'FAILED') sBadge = `<span class="status-badge status-failed">GAGAL</span>`;
        else if (o.status === 'CANCELLED') sBadge = `<span class="status-badge status-failed">DIBATALKAN</span>`;
        else if (o.status === 'EXPIRED') sBadge = `<span class="status-badge status-failed">WAKTU HABIS</span>`;
        else if (o.status === 'SUCCESS' && !o.adminReply) sBadge = `<span class="status-badge status-pending">DIPROSES ADMIN (PENDING)</span>`;
        else if (isSubExpired) sBadge = `<span class="status-badge status-failed">WAJIB KICK</span>`;
        else if (isSubKicked) sBadge = `<span class="status-badge status-anon">SUDAH DI-KICK</span>`;
        else if (o.status === 'SUCCESS') sBadge = `<span class="status-badge status-success">TERKIRIM & SELESAI</span>`;

        const emailBadgeHtml = o.emailSent
            ? `<div class="mt-1"><span class="status-badge status-success" style="font-size:0.58rem; padding:1px 6px;"><i class="fa-solid fa-envelope-circle-check"></i> EMAIL TERKIRIM</span></div>`
            : '';
        
        let itemsDesc = (o.items || []).map(i => {
            const safeTarget = escapeJsStr(i.playerInfo || '');
            const copyTargetBtn = (i.type === 'game' || (i.playerInfo && i.playerInfo.includes(':')))
                ? `<button class="btn btn-outline btn-sm" style="padding:2px 6px; min-height:22px; font-size:0.65rem; margin-left:6px;" onclick="window.copyTextToClipboard('${safeTarget}', 'Data Tujuan')"><i class="fa-regular fa-copy"></i> Salin</button>`
                : '';
            return `<strong class="text-dark">${window.escapeHtml(i.name)}</strong><br><span class="text-muted text-xs">${window.escapeHtml(i.playerInfo)}</span>${copyTargetBtn}`;
        }).join('<br>');

        let subCountdownHtml = '';
        if (isSubExpired) {
            subCountdownHtml = `
                <div class="sub-countdown-box sub-expired sub-live-timer" data-end="${endAt}" data-substatus="ACTIVE">
                    <i class="fa-solid fa-triangle-exclamation"></i> DURASI HABIS — WAKTUNYA KICK AKUN
                </div>
                ${o.adminReply ? `<div class="text-xs text-muted mt-1 code-mono" style="max-width:340px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Akun: ${window.escapeHtml(o.adminReply.replace(/\n/g, ' | '))}</div>` : ''}`;
        } else if (isSubActive) {
            const diff = endAt - now;
            subCountdownHtml = `
                <div class="sub-countdown-box sub-running sub-live-timer" data-end="${endAt}" data-substatus="ACTIVE">
                    <i class="fa-solid fa-stopwatch"></i> Sisa Durasi: <b>${formatRemainingDurationMs(diff)}</b>
                </div>`;
        } else if (isSubKicked) {
            subCountdownHtml = `
                <div class="sub-countdown-box sub-kicked" data-end="${endAt}" data-substatus="KICKED">
                    <i class="fa-solid fa-user-check"></i> Sudah Dikeluarkan (Kick)
                </div>`;
        }

        let promoDesc = o.promoCode ? `<br><small class="text-success text-xs fw-bold">Promo: ${window.escapeHtml(o.promoCode)} (-Rp${o.promoDiscount})</small>` : '';
        let paymentMethodStr = o.paymentMethod === 'cash' ? '<span class="status-badge status-pending"><i class="fa-solid fa-barcode"></i> TUNAI</span>' : '<span class="status-badge status-unpaid"><i class="fa-solid fa-qrcode"></i> QRIS</span>';
        
        const memberMatch = allUsersList.find(u => u.uid === o.userId || (o.userEmail && u.email?.toLowerCase() === o.userEmail.toLowerCase()));
        const buyerPhone = o.userPhone || (memberMatch ? (memberMatch.phone || memberMatch.whatsapp || '') : '');

        let actionBtn = '';
        if (isSubExpired) {
            actionBtn = `
                <button class="btn btn-success btn-sm" onclick="window.markSubscriptionKicked('${o.dbId}')">
                    <i class="fa-solid fa-check"></i> Kick Selesai
                </button>
                <button class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${o.dbId}')">
                    <i class="fa-solid fa-sliders"></i>
                </button>`;
        } else if (o.status === 'PENDING' || o.status === 'UNPAID' || o.status === 'PENDING_PAYMENT' || o.status === 'EXPIRED' || (o.status === 'SUCCESS' && !o.adminReply)) {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="window.promptProcessOrder('${o.dbId}')"><i class="fa-solid fa-bolt"></i> Proses</button>`;
        } else {
            actionBtn = `<button class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${o.dbId}')"><i class="fa-solid fa-paper-plane"></i> Detail</button>`;
        }
            
        let deleteBtn = `<button aria-label="Hapus Order" class="btn-icon-only text-danger" style="width:34px; height:34px;" onclick="window.promptDeleteOrder('${o.dbId}', '${escapeJsStr(o.id)}')"><i class="fa-solid fa-trash"></i></button>`;
        
        html += `<tr class="${isSubExpired ? 'row-sub-expired' : ''}">
            <td>
                <div class="flex-gap align-center">
                    <strong class="text-dark code-mono">#${window.escapeHtml(o.id)}</strong>
                    <button class="btn-icon-only" style="width:24px; height:24px; font-size:0.7rem;" onclick="window.copyTextToClipboard('${escapeJsStr(o.id)}', 'Invoice ID')"><i class="fa-regular fa-copy"></i></button>
                </div>
                <small class="text-muted text-xs">${new Date(o.date).toLocaleString('id-ID')}</small>
            </td>
            <td>${itemsDesc}${promoDesc}${subCountdownHtml}</td>
            <td>
                <span class="text-xs fw-bold d-block">${window.escapeHtml(o.userEmail || '-')}</span>
            </td>
            <td>${paymentMethodStr}</td>
            <td class="text-primary fw-bold">Rp${(o.finalTotal || 0).toLocaleString('id-ID')}</td>
            <td>${sBadge}${emailBadgeHtml}</td>
            <td><div class="flex-gap align-center flex-wrap-gap">${actionBtn} ${deleteBtn}</div></td>
        </tr>`;
    });
    tbody.innerHTML = html;
};

window.exportOrdersCSV = function() {
    if (orders.length === 0) {
        window.customAlert('Kosong', 'Belum ada data pesanan untuk diekspor.', 'warning');
        return;
    }
    const headers = ['Invoice ID', 'Tanggal', 'Email Pembeli', 'No WA', 'Produk', 'Tujuan/Info', 'Metode Bayar', 'Total Bayar (Rp)', 'Status', 'Email Terkirim', 'Status Langganan'];
    const rows = orders.map(o => {
        const itemStr = (o.items || []).map(i => i.name).join('; ');
        const infoStr = (o.items || []).map(i => i.playerInfo).join('; ');
        return [
            o.id,
            new Date(o.date).toLocaleString('id-ID'),
            o.userEmail || '-',
            o.userPhone || '-',
            `"${(itemStr || '').replace(/"/g, '""')}"`,
            `"${(infoStr || '').replace(/"/g, '""')}"`,
            o.paymentMethod || 'qris',
            o.finalTotal || 0,
            o.status,
            o.emailSent ? 'YA' : 'BELUM',
            o.subscriptionStatus || '-'
        ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Transaksi_Vipercell_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.showToast('Diunduh', 'File CSV laporan transaksi berhasil diunduh.', 'success');
};

window.cleanExpiredOrders = function() {
    const expiredList = orders.filter(o => o.status === 'EXPIRED' || o.status === 'CANCELLED');
    if (expiredList.length === 0) {
        window.customAlert('Bersih', 'Tidak ada pesanan berstatus EXPIRED atau DIBATALKAN.', 'info');
        return;
    }
    window.openConfirm('Hapus Pesanan Expired', `Hapus <b>${expiredList.length} pesanan</b> EXPIRED / DIBATALKAN?`, async (confirmed) => {
        if (confirmed) {
            try {
                for (const ord of expiredList) {
                    await deleteDoc(doc(db, pathOrders, ord.dbId));
                }
                window.showToast('Selesai', `${expiredList.length} pesanan expired telah dihapus.`, 'success');
            } catch (e) {
                window.customAlert('Error', 'Gagal membersihkan pesanan.', 'error');
            }
        }
    });
};

window.promptProcessOrder = function(dbId) {
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;
    
    document.getElementById('proc-order-dbid').value = dbId;
    document.getElementById('proc-admin-reply').value = order.adminReply || '';
    
    const memberMatch = allUsersList.find(u => u.uid === order.userId || (order.userEmail && u.email?.toLowerCase() === order.userEmail.toLowerCase()));
    const buyerPhone = order.userPhone || (memberMatch ? (memberMatch.phone || memberMatch.whatsapp || '') : '');

    let statusText = 'MENUNGGU PEMBAYARAN';
    if (order.status === 'SUCCESS' && order.adminReply) statusText = 'TERKIRIM & SELESAI';
    else if (order.status === 'PENDING' || (order.status === 'SUCCESS' && !order.adminReply)) statusText = 'DIPROSES ADMIN (PENDING)';
    else if (order.status === 'CANCELLED' || order.status === 'EXPIRED' || order.status === 'FAILED') statusText = order.status;

    let itemsHtml = (order.items || []).map(i => `<div><b>${window.escapeHtml(i.name)}</b><br><span class="text-muted">${window.escapeHtml(i.playerInfo)}</span></div>`).join('<hr style="margin:6px 0; border-color:var(--border-subtle);">');
    document.getElementById('proc-order-summary').innerHTML = `
        <div class="flex-between align-center mb-1 flex-wrap-gap">
            <span>Invoice: <b class="text-primary code-mono">#${window.escapeHtml(order.id)}</b></span>
            <span class="status-badge ${order.status === 'SUCCESS' && order.adminReply ? 'status-success' : (order.status === 'PENDING' ? 'status-pending' : 'status-unpaid')}">${statusText}</span>
        </div>
        <div class="flex-between align-center text-xs mb-2 flex-wrap-gap">
            <span>Email Pembeli: <b>${window.escapeHtml(order.userEmail || '-')}</b></span>
            <span>Total Bayar: <b class="text-success" style="font-size:0.9rem;">Rp${(order.finalTotal || 0).toLocaleString('id-ID')}</b></span>
        </div>
        ${itemsHtml}
    `;

    updateEmailButtonLockStateUI(Boolean(order.emailSent), order);

    const durDays = getOrderDurationDays(order);
    const subBox = document.getElementById('proc-subscription-box');
    const subBadge = document.getElementById('proc-sub-status-badge');
    const subTimerTxt = document.getElementById('proc-sub-timer-text');
    const btnKick = document.getElementById('btn-proc-mark-kicked');

    if (durDays > 0 && subBox) {
        subBox.style.display = 'block';
        const endAt = order.subscriptionEndAt || (new Date(order.date).getTime() + durDays * 86400000);
        const now = Date.now();
        const isKicked = order.subscriptionStatus === 'KICKED';
        const isExpired = !isKicked && now >= endAt;

        if (isKicked) {
            subBadge.className = 'status-badge status-anon';
            subBadge.innerText = 'SUDAH DI-KICK';
            subTimerTxt.innerHTML = `Durasi ${durDays} Hari telah selesai.`;
            if (btnKick) btnKick.style.display = 'none';
        } else if (isExpired) {
            subBadge.className = 'status-badge status-failed';
            subBadge.innerText = 'WAJIB KICK';
            subTimerTxt.innerHTML = `<span class="text-danger">Masa aktif ${durDays} Hari berakhir pada ${new Date(endAt).toLocaleString('id-ID')}.</span>`;
            if (btnKick) btnKick.style.display = 'inline-flex';
        } else {
            subBadge.className = 'status-badge status-success';
            subBadge.innerText = `AKTIF (${durDays} HARI)`;
            subTimerTxt.innerHTML = `Sisa Waktu: <b class="text-success">${formatRemainingDurationMs(endAt - now)}</b> (Berakhir: ${new Date(endAt).toLocaleDateString('id-ID')})`;
            if (btnKick) btnKick.style.display = 'inline-flex';
        }
    } else if (subBox) {
        subBox.style.display = 'none';
    }
    
    window.openModal('modal-process-order');
};

window.pullAvailableStockIntoOrderModal = async function() {
    const dbId = document.getElementById('proc-order-dbid').value;
    const order = orders.find(o => o.dbId === dbId);
    if (!order || !order.items || !order.items[0]) return;

    const item = order.items[0];
    const targetBrand = item.brandName || item.name.split(' - ')[0];
    const exactItemName = item.exactItemName || item.name.replace(`(x${item.qty})`, '').trim();

    const matchedStock = stocksData.find(s =>
        s.status === 'Ready' &&
        (s.brand || '').toLowerCase() === (targetBrand || '').toLowerCase() &&
        (s.itemName || '').toLowerCase() === (exactItemName || '').toLowerCase()
    );

    if (!matchedStock) {
        window.customAlert('Stok Kosong', `Tidak ada stok Ready di Gudang Stok untuk variasi <b>${window.escapeHtml(targetBrand)} - ${window.escapeHtml(exactItemName)}</b>.`, 'warning');
        return;
    }

    const formatted = formatAdminStockCredentialLine(
        matchedStock.data || '',
        matchedStock.stockFormat || matchedStock.mode || 'PRIVATE',
        ''
    );
    document.getElementById('proc-admin-reply').value = formatted;
    window.showToast('Stok Diambil', 'Data stok dimasukkan ke kolom pesanan.', 'info');
};

window.markSubscriptionKicked = async function(dbId) {
    try {
        await updateDoc(doc(db, pathOrders, dbId), {
            subscriptionStatus: 'KICKED',
            kickedAt: Date.now()
        });
        window.showToast('Tersimpan', 'Ditandai sudah di-kick.', 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal memperbarui status langganan.', 'error');
    }
};

window.markSubscriptionKickedFromModal = async function() {
    const dbId = document.getElementById('proc-order-dbid').value;
    if (!dbId) return;
    await window.markSubscriptionKicked(dbId);
    window.closeModal('modal-process-order');
};

window.extendSubscriptionDays = async function(extraDays = 30) {
    const dbId = document.getElementById('proc-order-dbid').value;
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;

    const now = Date.now();
    const baseTime = (order.subscriptionEndAt && order.subscriptionEndAt > now) ? order.subscriptionEndAt : now;
    const newEndAt = baseTime + (extraDays * 86400000);
    const newDur = (getOrderDurationDays(order) || 0) + extraDays;

    try {
        await updateDoc(doc(db, pathOrders, dbId), {
            durationDays: newDur,
            subscriptionEndAt: newEndAt,
            subscriptionStatus: 'ACTIVE'
        });
        window.showToast('Diperpanjang', `Masa aktif #${order.id} ditambah +${extraDays} hari.`, 'success');
        window.closeModal('modal-process-order');
    } catch (e) {
        window.customAlert('Error', 'Gagal memperpanjang durasi.', 'error');
    }
};

window.sendExpiryReminderEmail = async function() {
    const dbId = document.getElementById('proc-order-dbid').value;
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;

    const itemObj = (order.items && order.items[0]) ? order.items[0] : {};
    const endAt = order.subscriptionEndAt || Date.now();

    try {
        await callUnifiedGasWebhook({
            action: 'SEND_EXPIRY_REMINDER',
            orderId: order.id,
            invoice: order.id,
            email: order.userEmail,
            buyerEmail: order.userEmail,
            buyerName: order.buyerName || (order.userEmail || '').split('@')[0],
            itemName: itemObj.name || 'Layanan Vipercell',
            productName: itemObj.brandName || itemObj.name || 'Layanan',
            totalAmount: order.finalTotal || 0,
            subscriptionEndAt: endAt,
            accountDetails: `Masa aktif paket ${itemObj.name || ''} berakhir pada ${new Date(endAt).toLocaleDateString('id-ID')}.`
        });
        window.showToast('Terkirim', `Email pengingat dikirim ke ${order.userEmail}.`, 'success');
    } catch (err) {
        window.customAlert('Gagal', `${window.escapeHtml(err.message)}`, 'error');
    }
};

window.sendExpiryReminderWhatsApp = function() {
    const dbId = document.getElementById('proc-order-dbid').value;
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;

    const memberMatch = allUsersList.find(u => u.uid === order.userId || (order.userEmail && u.email?.toLowerCase() === order.userEmail.toLowerCase()));
    let phone = order.userPhone || (memberMatch ? (memberMatch.phone || memberMatch.whatsapp || '') : '');
    let cleanWa = phone.replace(/[^0-9]/g, '');
    if (!cleanWa) {
        window.customAlert('Nomor WA Kosong', 'Pembeli tidak mencantumkan nomor WhatsApp.', 'warning');
        return;
    }
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1);

    const itemName = order.items?.[0]?.name || 'Layanan Vipercell';
    const endStr = order.subscriptionEndAt ? new Date(order.subscriptionEndAt).toLocaleDateString('id-ID') : 'hari ini';
    const msg = `Halo kak, masa aktif *${itemName}* (Invoice *#${order.id}*) berakhir pada *${endStr}*. Silakan hubungi kami jika ingin memperpanjang.`;
    window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`, '_blank');
};

window.sendOrderDeliveryViaEmail = async function() {
    const dbId = document.getElementById('proc-order-dbid').value;
    const replyText = document.getElementById('proc-admin-reply').value.trim();
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;

    if (order.emailSent === true) {
        updateEmailButtonLockStateUI(true);
        window.showToast('Sudah Terkirim', 'Email pesanan ini sudah pernah dikirim.', 'info');
        return;
    }

    const btn = document.getElementById('btn-send-order-email');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...';
    }

    await updateDoc(doc(db, pathOrders, dbId), { adminReply: replyText }).catch(() => {});
    const sentOk = await triggerAutomatedEmailWebhook(order, replyText, false, dbId);

    if (!sentOk && btn) {
        updateEmailButtonLockStateUI(false);
    }
};

window.sendOrderDeliveryViaWhatsApp = async function() {
    const dbId = document.getElementById('proc-order-dbid').value;
    const replyText = document.getElementById('proc-admin-reply').value.trim();
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;

    await updateDoc(doc(db, pathOrders, dbId), { adminReply: replyText }).catch(() => {});

    const memberMatch = allUsersList.find(u => u.uid === order.userId || (order.userEmail && u.email?.toLowerCase() === order.userEmail.toLowerCase()));
    let phone = order.userPhone || (memberMatch ? (memberMatch.phone || memberMatch.whatsapp || '') : '');
    let cleanWa = phone.replace(/[^0-9]/g, '');

    if (!cleanWa) {
        window.customAlert('Nomor WA Kosong', 'Pembeli belum mencantumkan nomor WhatsApp.', 'warning');
        return;
    }
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1);

    const itemName = order.items && order.items[0] ? order.items[0].name : 'Pesanan Vipercell';
    const waText = `*RINCIAN PESANAN VIPERCELL*\n\n` +
                   `No. Invoice : *#${order.id}*\n` +
                   `Produk : *${itemName}*\n` +
                   `Total : *Rp${(order.finalTotal || 0).toLocaleString('id-ID')}*\n\n` +
                   `*DETAIL PESANAN:*\n` +
                   `${replyText || 'Pesanan selesai diproses.'}\n\n` +
                   `Terima kasih telah berbelanja di Vipercell.`;

    window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(waText)}`, '_blank');
};

window.markOrderComplete = async function(newStatus) {
    const dbId = document.getElementById('proc-order-dbid').value;
    const replyText = document.getElementById('proc-admin-reply').value.trim();
    if (!dbId) return;
    
    const order = orders.find(o => o.dbId === dbId);
    const durDays = getOrderDurationDays(order);
    const now = Date.now();

    const updatePayload = {
        status: newStatus,
        adminReply: replyText
    };

    if (newStatus === 'SUCCESS' && durDays > 0 && order && !order.subscriptionEndAt) {
        updatePayload.durationDays = durDays;
        updatePayload.subscriptionStartAt = now;
        updatePayload.subscriptionEndAt = now + (durDays * 86400000);
        updatePayload.subscriptionStatus = 'ACTIVE';
    }

    const btnSuccess = document.getElementById('btn-mark-order-success');
    const ogBtnHtml = btnSuccess ? btnSuccess.innerHTML : '';
    if (btnSuccess && newStatus === 'SUCCESS') {
        btnSuccess.disabled = true;
        btnSuccess.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    }

    try {
        await updateDoc(doc(db, pathOrders, dbId), updatePayload);

        if (newStatus === 'SUCCESS' && order) {
            const canSendEmail = !order.emailSent && doesOrderHaveStockInWarehouse(order) && isOrderEmailReceiptAllowedByUser(order);
            if (canSendEmail) {
                const emailOk = await triggerAutomatedEmailWebhook({ ...order, ...updatePayload }, replyText, true, dbId);
                if (emailOk) {
                    window.showToast('Pesanan Selesai', `Pesanan #${order.id} selesai & struk dikirim ke email.`, 'success');
                } else {
                    window.showToast('Pesanan Selesai', `Pesanan #${order.id} telah diselesaikan.`, 'success');
                }
            } else {
                updateEmailButtonLockStateUI(Boolean(order.emailSent), order);
                window.showToast('Pesanan Selesai', `Pesanan #${order.id} telah diselesaikan.`, 'success');
            }
        } else {
            window.showToast('Diperbarui', `Status pesanan diubah menjadi ${newStatus}.`, 'success');
        }

        window.closeModal('modal-process-order');
    } catch (e) {
        window.customAlert('Error', 'Gagal memperbarui status pesanan.', 'error');
    } finally {
        if (btnSuccess && ogBtnHtml) {
            btnSuccess.disabled = false;
            btnSuccess.innerHTML = ogBtnHtml;
        }
    }
};

window.promptDeleteOrder = function(dbId, invId) {
    window.openConfirm('Hapus Pesanan', `Yakin ingin menghapus pesanan <b>#${window.escapeHtml(invId)}</b>?`, async (confirmed) => {
        if (confirmed) {
            try {
                await deleteDoc(doc(db, pathOrders, dbId));
                window.showToast('Dihapus', `Pesanan #${invId} telah dihapus.`, 'info');
            } catch (e) {
                window.customAlert('Error', 'Gagal menghapus pesanan.', 'error');
            }
        }
    });
};


// ==========================================
// SUB-TAB CS BANTUAN: CHAT BANTUAN VS SARAN PRODUK (#14)
// ==========================================
window.switchAdminCsSubTab = function(subTab) {
    currentAdminCsSubTab = subTab === "saran" ? "saran" : "chat";
    const btnChat = document.getElementById("admin-subtab-btn-chat");
    const btnSaran = document.getElementById("admin-subtab-btn-saran");
    const panelChat = document.getElementById("admin-cs-panel-chat");
    const panelSaran = document.getElementById("admin-cs-panel-saran");

    if (btnChat) btnChat.classList.toggle("active", currentAdminCsSubTab === "chat");
    if (btnSaran) btnSaran.classList.toggle("active", currentAdminCsSubTab === "saran");

    if (panelChat && panelSaran) {
        if (currentAdminCsSubTab === "chat") {
            panelSaran.style.display = "none";
            panelChat.style.display = "block";
        } else {
            panelChat.style.display = "none";
            panelSaran.style.display = "block";
            window.renderAdminSuggestions();
        }
    }
};

window.renderAdminSuggestions = function() {
    const grid = document.getElementById("admin-suggestions-grid");
    const btnAll = document.getElementById("btn-mark-all-suggestions");
    if (!grid) return;

    if (btnAll) {
        btnAll.style.display = allSuggestions.length > 0 ? "inline-flex" : "none";
    }

    if (allSuggestions.length === 0) {
        grid.innerHTML = `<div class="info-box text-center text-muted grid-span-full" style="padding: 2rem;">Belum ada saran produk baru dari pelanggan.</div>`;
        return;
    }

    let html = "";
    allSuggestions.forEach((s) => {
        const safeDbId = escapeJsStr(s.dbId);
        const safeProd = escapeJsStr(s.productName || "Saran");
        const dateStr = s.createdAt
            ? new Date(s.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
            : "-";
        const roleBadge = s.isMember
            ? `<span class="status-badge status-success" style="font-size:0.58rem;">MEMBER</span>`
            : `<span class="status-badge status-anon" style="font-size:0.58rem;">TAMU</span>`;

        html += `
        <div class="suggestion-admin-card">
            <div>
                <div class="flex-between align-center flex-wrap-gap mb-2">
                    <span class="status-badge status-pending">${window.escapeHtml(s.category || "Produk")}</span>
                    <span class="text-xs text-muted fw-bold">${dateStr}</span>
                </div>
                <h4 class="text-dark mb-1" style="font-size:1.04rem; font-weight:900;">${window.escapeHtml(s.productName || "-")}</h4>
                <div class="flex-gap align-center mb-2">
                    <span class="text-xs text-muted">Pengirim: <b class="text-dark">${window.escapeHtml(s.senderName || "Pelanggan")}</b></span>
                    ${roleBadge}
                </div>
                ${s.notes ? `<div class="suggestion-notes-box">${window.escapeHtml(s.notes)}</div>` : `<div class="text-xs text-muted">Tidak ada catatan tambahan.</div>`}
            </div>
            <button type="button" class="btn btn-success btn-sm w-full" onclick="window.markSuggestionAsRead('${safeDbId}', '${safeProd}')">
                <i class="fa-solid fa-check"></i> Tandai Dibaca (Hapus dari Database)
            </button>
        </div>`;
    });

    grid.innerHTML = html;
};

function getDeletedSuggestionIdsSet() {
    const set = new Set();
    try {
        const localArr = JSON.parse(localStorage.getItem('vipercell_deleted_suggestions') || '[]');
        if (Array.isArray(localArr)) localArr.forEach(id => set.add(String(id)));
    } catch (e) {}
    if (Array.isArray(siteSettings.deletedSuggestionIds)) {
        siteSettings.deletedSuggestionIds.forEach(id => set.add(String(id)));
    }
    return set;
}

function recordDeletedSuggestionIds(idsArray) {
    const set = getDeletedSuggestionIdsSet();
    (idsArray || []).forEach(id => {
        if (id) set.add(String(id));
    });
    const finalArr = Array.from(set).slice(-300);
    siteSettings.deletedSuggestionIds = finalArr;
    try {
        localStorage.setItem('vipercell_deleted_suggestions', JSON.stringify(finalArr));
    } catch (e) {}
    return finalArr;
}

function rebuildMergedSuggestionsList() {
    const map = new Map();
    const deletedSet = getDeletedSuggestionIdsSet();
    const settingsSugg = Array.isArray(siteSettings.suggestionsList) ? siteSettings.suggestionsList : [];

    settingsSugg.forEach(s => {
        const key = s.dbId || s.id;
        if (key && !deletedSet.has(String(key))) map.set(key, { ...s, dbId: key });
    });
    rawChatFallbackSuggestions.forEach(s => {
        const key = s.dbId || s.id;
        if (key && !deletedSet.has(String(key))) map.set(key, { ...s, dbId: key });
    });
    rawCollectionSuggestions.forEach(s => {
        const key = s.dbId || s.id;
        if (key && !deletedSet.has(String(key))) map.set(key, { ...s, dbId: key });
    });

    allSuggestions = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const saranBadge = document.getElementById('admin-saran-tab-count');
    if (saranBadge) saranBadge.innerText = String(allSuggestions.length);
    window.renderAdminSuggestions();
}

// Saat Admin menandai sudah dibaca, hapus saran produk secara PERMANEN dari seluruh lapisan database (#3)
window.markSuggestionAsRead = async function(dbId, prodName = "Saran") {
    if (!dbId) return;
    try {
        const updatedDeletedIds = recordDeletedSuggestionIds([dbId]);
        const nextList = Array.isArray(siteSettings.suggestionsList)
            ? siteSettings.suggestionsList.filter(s => (s.dbId || s.id) !== dbId)
            : [];
        siteSettings.suggestionsList = nextList;

        rawCollectionSuggestions = rawCollectionSuggestions.filter(s => (s.dbId || s.id) !== dbId);
        rawChatFallbackSuggestions = rawChatFallbackSuggestions.filter(s => (s.dbId || s.id) !== dbId);
        rebuildMergedSuggestionsList();

        await Promise.all([
            deleteDoc(doc(db, pathSuggestions, dbId)).catch(() => {}),
            deleteDoc(doc(db, pathChats, dbId)).catch(() => {}),
            setDoc(doc(db, pathSettings, 'mainConfig'), {
                suggestionsList: nextList,
                deletedSuggestionIds: updatedDeletedIds
            }, { merge: true }).catch(() => {})
        ]);

        window.showToast("Dihapus Permanen", `Saran "${prodName}" telah ditandai dibaca dan dihapus permanen.`, "success");
    } catch (e) {
        window.customAlert("Gagal", "Tidak dapat menghapus saran produk dari database.", "error");
    }
};

window.markAllSuggestionsAsRead = function() {
    if (allSuggestions.length === 0) return;
    window.openConfirm(
        "Tandai Semua Dibaca & Hapus Permanen?",
        `Hapus permanen seluruh <b>${allSuggestions.length} saran produk</b> dari database sekarang?`,
        async (confirmed) => {
            if (!confirmed) return;
            try {
                const allIds = allSuggestions.map(item => item.dbId || item.id).filter(Boolean);
                const updatedDeletedIds = recordDeletedSuggestionIds(allIds);

                siteSettings.suggestionsList = [];
                rawCollectionSuggestions = [];
                rawChatFallbackSuggestions = [];
                rebuildMergedSuggestionsList();

                for (const key of allIds) {
                    await Promise.all([
                        deleteDoc(doc(db, pathSuggestions, key)).catch(() => {}),
                        deleteDoc(doc(db, pathChats, key)).catch(() => {})
                    ]);
                }
                await setDoc(doc(db, pathSettings, 'mainConfig'), {
                    suggestionsList: [],
                    deletedSuggestionIds: updatedDeletedIds
                }, { merge: true }).catch(() => {});

                window.showToast("Selesai", "Semua saran produk telah dihapus permanen dari database.", "success");
            } catch (e) {
                window.customAlert("Gagal", "Terjadi kesalahan saat menghapus saran produk.", "error");
            }
        },
        "success"
    );
};

// ==========================================
// LIVE CHAT ADMIN
// ==========================================
window.renderAdminChatList = function() {
    const listEl = document.getElementById('admin-chat-list');
    if (!listEl) return;

    if (allLiveChats.length === 0) {
        listEl.innerHTML = '<div class="p-3 text-center text-muted text-xs">Belum ada pesan masuk.</div>';
        return;
    }

    let html = '';
    allLiveChats.forEach(chat => {
        const msgs = chat.messages || [];
        const lastMsg = msgs[msgs.length - 1];
        const previewText = lastMsg ? lastMsg.text : 'Belum ada pesan';
        const isUnread = lastMsg && lastMsg.sender === 'user';
        const isActive = activeAdminChatId === chat.id;
        const userName = chat.userInfo || `Pelanggan #${chat.id.slice(-4)}`;

        html += `
            <div class="wa-chat-item ${isActive ? 'active' : ''}" onclick="window.openAdminChatDetailDesk('${escapeJsStr(chat.id)}')">
                <div class="wa-avatar">${window.escapeHtml(userName.charAt(0).toUpperCase())}</div>
                <div style="flex:1; min-width:0;">
                    <div class="flex-between align-center">
                        <strong class="text-dark" style="font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(userName)}</strong>
                        ${isUnread ? '<span class="status-badge status-failed" style="font-size:0.58rem; padding:2px 6px;">BARU</span>' : ''}
                    </div>
                    <p class="text-muted text-xs m-0" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(previewText)}</p>
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;
};

window.openAdminChatDetailDesk = function(chatId) {
    activeAdminChatId = chatId;
    const container = document.getElementById('wa-layout-container');
    if (container) container.classList.add('chat-open');

    document.getElementById('admin-chat-empty').style.display = 'none';
    document.getElementById('admin-chat-view').style.display = 'flex';

    window.renderAdminChatList();
    window.renderActiveChatMessages();
};

window.closeMobileChatView = function() {
    const container = document.getElementById('wa-layout-container');
    if (container) container.classList.remove('chat-open');
    activeAdminChatId = null;
};

window.renderActiveChatMessages = function() {
    const chat = allLiveChats.find(c => c.id === activeAdminChatId);
    const msgBox = document.getElementById('admin-chat-messages');
    if (!chat || !msgBox) return;

    document.getElementById('active-chat-user').innerText = chat.userInfo || `Pelanggan #${chat.id.slice(-4)}`;
    const msgs = chat.messages || [];

    if (msgs.length === 0) {
        msgBox.innerHTML = '<div class="text-center text-muted text-xs p-3">Belum ada riwayat pesan.</div>';
        return;
    }

    let html = '';
    msgs.forEach(m => {
        const roleClass = m.sender === 'admin' ? 'admin' : 'user';
        const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        html += `
            <div class="chat-msg ${roleClass}">
                <div>${window.escapeHtml(m.text).replace(/\n/g, '<br>')}</div>
                <span class="chat-time">${timeStr}</span>
            </div>
        `;
    });
    msgBox.innerHTML = html;
    msgBox.scrollTop = msgBox.scrollHeight;
};

window.insertQuickReply = function(text) {
    const inp = document.getElementById('admin-chat-input');
    if (inp) {
        inp.value = text;
        inp.focus();
    }
};

window.sendAdminReply = async function() {
    if (!activeAdminChatId) return;
    const input = document.getElementById('admin-chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    try {
        const chatRef = doc(db, pathChats, activeAdminChatId);
        await setDoc(chatRef, {
            updatedAt: Date.now(),
            messages: arrayUnion({
                sender: 'admin',
                text: text,
                timestamp: Date.now()
            })
        }, { merge: true });
    } catch (e) {
        window.customAlert('Gagal', 'Tidak dapat mengirim balasan chat.', 'error');
    }
};

window.deleteActiveChat = function() {
    if (!activeAdminChatId) return;
    window.openConfirm('Hapus Chat', 'Yakin ingin menghapus riwayat chat pelanggan ini?', async (confirmed) => {
        if (confirmed) {
            try {
                await deleteDoc(doc(db, pathChats, activeAdminChatId));
                activeAdminChatId = null;
                document.getElementById('admin-chat-view').style.display = 'none';
                document.getElementById('admin-chat-empty').style.display = 'flex';
                window.closeMobileChatView();
                window.showToast('Dihapus', 'Riwayat chat berhasil dihapus.', 'info');
            } catch (e) {
                window.customAlert('Error', 'Gagal menghapus obrolan.', 'error');
            }
        }
    });
};

// ==========================================
// KATALOG PRODUK & SINKRONISASI STOK
// ==========================================
function rebuildGroupedBrands() {
    groupedBrands = [];
    products.forEach(p => {
        const bName = p.brand || p.name;
        const exist = groupedBrands.find(b => b.brandName === bName);
        if (exist) {
            exist.items.push(p);
            if (p.imgUrlBase64 && !exist.imgUrlBase64) exist.imgUrlBase64 = p.imgUrlBase64;
            if (p.desc && !exist.desc) exist.desc = p.desc;
            if (p.requireAppTarget) exist.requireAppTarget = true;
            if (p.appTargetLabel && !exist.appTargetLabel) exist.appTargetLabel = p.appTargetLabel;
            if (p.appTargetPlaceholder && !exist.appTargetPlaceholder) exist.appTargetPlaceholder = p.appTargetPlaceholder;
        } else {
            groupedBrands.push({
                brandName: bName,
                type: p.type || 'app',
                imgUrlBase64: p.imgUrlBase64 || '',
                desc: p.desc || '',
                isGangguan: p.isGangguan || false,
                requireAppTarget: Boolean(p.requireAppTarget),
                appTargetLabel: p.appTargetLabel || '',
                appTargetPlaceholder: p.appTargetPlaceholder || '',
                items: [p]
            });
        }
    });
}

function countReadyStockSlotsForVariant(brandName, itemName) {
    let totalSlots = 0;
    stocksData.forEach(s => {
        if (s.status !== 'Ready') return;
        if ((s.brand || '').toLowerCase() !== (brandName || '').toLowerCase()) return;
        if ((s.itemName || '').toLowerCase() !== (itemName || '').toLowerCase()) return;

        if (s.isReusable === true) {
            totalSlots += 999;
        } else {
            const maxQ = parseInt(s.maxQuota || 1, 10);
            const usedQ = parseInt(s.usedQuota || 0, 10);
            totalSlots += Math.max(0, maxQ - usedQ);
        }
    });
    return totalSlots;
}

window.syncAllProductsWithStockVaultV27 = async function(showToastNotify = false) {
    let updatedCount = 0;
    for (const p of products) {
        if (!p.dbId) continue;
        const bName = p.brand || p.name;
        const procType = (p.processType || 'auto').toLowerCase();
        const readySlots = countReadyStockSlotsForVariant(bName, p.name);

        if (procType === 'auto') {
            const shouldBeSoldOut = readySlots <= 0 ? Boolean(p.soldOut) : false;
            if (p.stockCount !== readySlots || (readySlots > 0 && p.soldOut === true)) {
                await updateDoc(doc(db, pathProducts, p.dbId), {
                    stockCount: readySlots,
                    soldOut: shouldBeSoldOut
                }).catch(() => {});
                updatedCount++;
            }
        } else if (procType === 'ask_auto') {
            if (p.stockCount !== readySlots) {
                await updateDoc(doc(db, pathProducts, p.dbId), {
                    stockCount: readySlots,
                    soldOut: false
                }).catch(() => {});
                updatedCount++;
            }
        }
    }
    if (showToastNotify) {
        window.showToast('Disinkronkan', `${updatedCount} variasi produk telah disinkronkan dengan Gudang Stok.`, 'success');
    }
};

window.renderAdminCatalog = function() {
    const grid = document.getElementById('admin-catalog-grid');
    if (!grid) return;

    const searchQ = (document.getElementById('admin-search-product')?.value || '').trim().toLowerCase();
    let list = [...groupedBrands];

    if (searchQ) {
        list = list.filter(b =>
            b.brandName.toLowerCase().includes(searchQ) ||
            b.type.toLowerCase().includes(searchQ) ||
            b.items.some(i => i.name.toLowerCase().includes(searchQ))
        );
    }

    if (list.length === 0) {
        grid.innerHTML = '<div class="dashboard-panel text-center text-muted" style="grid-column: 1/-1;">Belum ada produk di katalog.</div>';
        return;
    }

    let html = '';
    list.forEach(b => {
        const safeJsBrand = escapeJsStr(b.brandName);
        const typeLabel = b.type === 'game' ? 'GAME' : (b.type === 'tools' ? 'TOOLS / EMAIL' : 'APLIKASI');
        const imgHtml = b.imgUrlBase64
            ? `<img src="${b.imgUrlBase64}" class="catalog-thumb" alt="${window.escapeHtml(b.brandName)}">`
            : `<div class="catalog-thumb flex-center fw-900" style="background:var(--primary); color:#fff; font-size:1.25rem;">${window.escapeHtml(b.brandName.charAt(0))}</div>`;

        const autoCount = b.items.filter(i => (i.processType || 'auto') === 'auto').length;
        const askAutoCount = b.items.filter(i => i.processType === 'ask_auto').length;
        const manualCount = b.items.filter(i => i.processType === 'manual').length;

        const totalVaultReady = b.items.reduce((acc, it) => acc + countReadyStockSlotsForVariant(b.brandName, it.name), 0);

        html += `
        <div class="catalog-card">
            <div>
                <div class="catalog-card-top mb-2">
                    ${imgHtml}
                    <div style="flex:1; min-width:0;">
                        <div class="flex-between align-center mb-1">
                            <span class="status-badge status-pending" style="font-size:0.6rem;">${typeLabel}</span>
                            ${b.isGangguan ? '<span class="status-badge status-failed" style="font-size:0.6rem;">GANGGUAN</span>' : '<span class="status-badge status-success" style="font-size:0.6rem;">AKTIF</span>'}
                        </div>
                        <h4 class="m-0 text-dark" style="font-size:1.02rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(b.brandName)}</h4>
                        <span class="text-xs text-muted">${b.items.length} Variasi &bull; Stok Aktif: <b class="text-primary">${totalVaultReady >= 999 ? 'Tersedia' : totalVaultReady}</b></span>
                    </div>
                </div>
                <div class="flex-wrap-gap mb-2" style="gap:4px;">
                    ${autoCount > 0 ? `<span class="status-badge status-success" style="font-size:0.58rem;">${autoCount} Auto</span>` : ''}
                    ${askAutoCount > 0 ? `<span class="status-badge status-vip" style="font-size:0.58rem;">${askAutoCount} Tanya/Auto</span>` : ''}
                    ${manualCount > 0 ? `<span class="status-badge status-unpaid" style="font-size:0.58rem;">${manualCount} Manual</span>` : ''}
                </div>
            </div>
            <div class="flex-gap mt-2">
                <button class="btn btn-outline btn-sm flex-1" onclick="window.openEditBrandModal('${safeJsBrand}')">
                    <i class="fa-solid fa-pen-to-square"></i> Kelola Variasi
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteBrandEntirely('${safeJsBrand}')" title="Hapus Produk">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    });
    grid.innerHTML = html;
};

window.toggleManageGameInput = function() {
    const type = document.getElementById('manage-prod-type').value;
    const gameWrap = document.getElementById('manage-game-input-wrap');
    const appWrap = document.getElementById('manage-app-input-wrap');

    if (gameWrap) gameWrap.style.display = (type === 'game' || type === 'tools') ? 'block' : 'none';
    if (appWrap) appWrap.style.display = (type === 'app') ? 'block' : 'none';
};

window.toggleAppTargetLabelInput = function() {
    const checked = document.getElementById('manage-app-require-target')?.checked;
    const cfg = document.getElementById('manage-app-target-config');
    if (cfg) cfg.style.display = checked ? 'grid' : 'none';
};

window.openAddProductModal = function() {
    document.getElementById('modal-prod-title').innerHTML = '<i class="fa-solid fa-plus text-primary"></i> Tambah Produk Baru';
    document.getElementById('manage-orig-brand').value = '';
    document.getElementById('manage-brand-name').value = '';
    document.getElementById('manage-prod-type').value = 'app';
    document.getElementById('manage-input-type').value = 'id_zone';
    document.getElementById('manage-prod-desc').value = '';
    document.getElementById('manage-brand-gangguan').checked = false;

    const reqAppEl = document.getElementById('manage-app-require-target');
    const lblAppEl = document.getElementById('manage-app-target-label');
    const phAppEl = document.getElementById('manage-app-target-ph');
    if (reqAppEl) reqAppEl.checked = false;
    if (lblAppEl) lblAppEl.value = '';
    if (phAppEl) phAppEl.value = '';
    window.toggleAppTargetLabelInput();
    
    tempManageImgBase64 = '';
    const prevImg = document.getElementById('preview-manage-img');
    if (prevImg) { prevImg.src = ''; prevImg.style.display = 'none'; }
    
    tempProductVariants = [];
    window.cancelEditTempNominal();
    window.toggleManageGameInput();
    window.renderTempNominals();
    window.openModal('modal-manage-product');
};

window.openEditBrandModal = function(brandName) {
    const bObj = groupedBrands.find(b => b.brandName === brandName);
    if (!bObj) return;

    document.getElementById('modal-prod-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Produk: ${window.escapeHtml(brandName)}`;
    document.getElementById('manage-orig-brand').value = brandName;
    document.getElementById('manage-brand-name').value = bObj.brandName;
    document.getElementById('manage-prod-type').value = bObj.type || 'app';
    document.getElementById('manage-input-type').value = bObj.items[0]?.inputType || 'id_zone';
    document.getElementById('manage-prod-desc').value = bObj.desc || '';
    document.getElementById('manage-brand-gangguan').checked = Boolean(bObj.isGangguan);

    const firstIt = bObj.items[0] || {};
    const reqAppEl = document.getElementById('manage-app-require-target');
    const lblAppEl = document.getElementById('manage-app-target-label');
    const phAppEl = document.getElementById('manage-app-target-ph');
    if (reqAppEl) reqAppEl.checked = Boolean(bObj.requireAppTarget || firstIt.requireAppTarget);
    if (lblAppEl) lblAppEl.value = bObj.appTargetLabel || firstIt.appTargetLabel || '';
    if (phAppEl) phAppEl.value = bObj.appTargetPlaceholder || firstIt.appTargetPlaceholder || '';
    window.toggleAppTargetLabelInput();

    tempManageImgBase64 = bObj.imgUrlBase64 || '';
    const prevImg = document.getElementById('preview-manage-img');
    if (tempManageImgBase64 && prevImg) {
        prevImg.src = tempManageImgBase64;
        prevImg.style.display = 'block';
    } else if (prevImg) {
        prevImg.style.display = 'none';
    }

    tempProductVariants = bObj.items.map(i => ({
        dbId: i.dbId || null,
        name: i.name,
        priceNum: i.priceNum || 0,
        variantDesc: i.variantDesc || i.description || '',
        durationDays: parseInt(i.durationDays || 0, 10),
        processType: i.processType || 'auto',
        stockMode: i.stockMode || 'PRIVATE',
        soldOut: Boolean(i.soldOut),
        manualLockSoldOut: Boolean(i.manualLockSoldOut)
    }));

    window.cancelEditTempNominal();
    window.toggleManageGameInput();
    window.renderTempNominals();
    window.openModal('modal-manage-product');
};

window.addTempNominal = function() {
    const name = document.getElementById('temp-nom-name').value.trim();
    const price = parseInt(document.getElementById('temp-nom-price').value, 10) || 0;
    const desc = (document.getElementById('temp-nom-desc')?.value || '').trim();
    const durationDays = parseInt(document.getElementById('temp-nom-duration')?.value || '0', 10) || 0;
    const statusMode = document.getElementById('temp-nom-status').value;
    const stockMode = document.getElementById('temp-nom-stock-mode')?.value || 'PRIVATE';
    const editIdx = parseInt(document.getElementById('edit-variant-idx')?.value || '-1', 10);

    if (!name || price <= 0) {
        window.customAlert('Belum Lengkap', 'Masukkan nama variasi dan harga yang valid.', 'warning');
        return;
    }

    if (editIdx >= 0 && editIdx < tempProductVariants.length) {
        tempProductVariants[editIdx].name = name;
        tempProductVariants[editIdx].priceNum = price;
        tempProductVariants[editIdx].variantDesc = desc;
        tempProductVariants[editIdx].durationDays = durationDays;
        tempProductVariants[editIdx].processType = statusMode;
        tempProductVariants[editIdx].stockMode = stockMode;
        window.showToast('Diperbarui', `Variasi "${name}" berhasil diperbarui.`, 'info');
    } else {
        tempProductVariants.push({
            dbId: null,
            name: name,
            priceNum: price,
            variantDesc: desc,
            durationDays: durationDays,
            processType: statusMode,
            stockMode: stockMode,
            soldOut: false,
            manualLockSoldOut: false
        });
    }

    window.cancelEditTempNominal();
    window.renderTempNominals();
};

window.editTempNominal = function(idx) {
    const v = tempProductVariants[idx];
    if (!v) return;

    document.getElementById('edit-variant-idx').value = idx;
    document.getElementById('temp-nom-name').value = v.name || '';
    document.getElementById('temp-nom-price').value = v.priceNum || '';
    if (document.getElementById('temp-nom-desc')) document.getElementById('temp-nom-desc').value = v.variantDesc || '';
    if (document.getElementById('temp-nom-duration')) document.getElementById('temp-nom-duration').value = v.durationDays || 0;
    document.getElementById('temp-nom-status').value = v.processType || 'auto';
    if (document.getElementById('temp-nom-stock-mode')) document.getElementById('temp-nom-stock-mode').value = v.stockMode || 'PRIVATE';

    const titleEl = document.getElementById('form-variant-title');
    const btnAdd = document.getElementById('btn-add-variant-item');
    const btnCancel = document.getElementById('btn-cancel-variant-edit');

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen text-warning"></i> Edit Variasi: ${window.escapeHtml(v.name)}`;
    if (btnAdd) {
        btnAdd.className = 'btn btn-success btn-sm flex-2';
        btnAdd.innerHTML = `<i class="fa-solid fa-check"></i> Simpan Perubahan Variasi`;
    }
    if (btnCancel) btnCancel.style.display = 'inline-flex';
};

window.cancelEditTempNominal = function() {
    if (document.getElementById('edit-variant-idx')) document.getElementById('edit-variant-idx').value = '-1';
    document.getElementById('temp-nom-name').value = '';
    document.getElementById('temp-nom-price').value = '';
    if (document.getElementById('temp-nom-desc')) document.getElementById('temp-nom-desc').value = '';
    if (document.getElementById('temp-nom-duration')) document.getElementById('temp-nom-duration').value = '0';
    document.getElementById('temp-nom-status').value = 'auto';
    if (document.getElementById('temp-nom-stock-mode')) document.getElementById('temp-nom-stock-mode').value = 'PRIVATE';

    const titleEl = document.getElementById('form-variant-title');
    const btnAdd = document.getElementById('btn-add-variant-item');
    const btnCancel = document.getElementById('btn-cancel-variant-edit');

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-tags"></i> Tambah / Edit Variasi`;
    if (btnAdd) {
        btnAdd.className = 'btn btn-warning btn-sm flex-2';
        btnAdd.innerHTML = `<i class="fa-solid fa-plus"></i> Tambahkan ke Daftar Variasi`;
    }
    if (btnCancel) btnCancel.style.display = 'none';
};

window.renderTempNominals = function() {
    const listEl = document.getElementById('temp-nominal-list');
    if (!listEl) return;

    if (tempProductVariants.length === 0) {
        listEl.innerHTML = '<div class="text-xs text-muted text-center p-2">Belum ada variasi ditambahkan.</div>';
        return;
    }

    const currentBrandName = document.getElementById('manage-brand-name')?.value.trim() || document.getElementById('manage-orig-brand')?.value || '';

    let html = '';
    tempProductVariants.forEach((v, idx) => {
        const durBadge = v.durationDays > 0 ? `<span class="status-badge status-pending" style="font-size:0.58rem; padding:2px 6px;"><i class="fa-regular fa-clock"></i> ${v.durationDays} Hari</span>` : '';

        let modeBadge = '<span class="status-badge status-success" style="font-size:0.58rem;">AUTO</span>';
        if (v.processType === 'manual') {
            modeBadge = '<span class="status-badge status-unpaid" style="font-size:0.58rem;">MANUAL</span>';
        } else if (v.processType === 'ask_auto') {
            modeBadge = '<span class="status-badge status-vip" style="font-size:0.58rem;">TANYA/AUTO</span>';
        }

        const formatBadge = v.stockMode === 'EMAIL_OAUTH'
            ? `<span class="status-badge status-email-oauth" style="font-size:0.58rem;">PRODUK EMAIL</span>`
            : (v.stockMode === 'SHARING' ? `<span class="status-badge status-pending" style="font-size:0.58rem;">SHARING</span>` : '');

        const vaultSlots = countReadyStockSlotsForVariant(currentBrandName, v.name);
        const vaultBadge = `<span class="status-badge status-anon" style="font-size:0.58rem;">Stok: ${vaultSlots >= 999 ? 'Tersedia' : vaultSlots}</span>`;

        html += `
        <div class="flex-between align-center p-2" style="background:var(--surface); border:1.5px solid var(--border); border-radius:8px; gap:8px; flex-wrap:wrap;">
            <div style="flex:1; min-width:180px;">
                <div class="flex-gap align-center flex-wrap-gap">
                    <strong class="text-dark text-sm">${window.escapeHtml(v.name)}</strong>
                    <span class="text-primary fw-bold text-xs">Rp${v.priceNum.toLocaleString('id-ID')}</span>
                    ${modeBadge}
                    ${formatBadge}
                    ${durBadge}
                    ${vaultBadge}
                </div>
                ${v.variantDesc ? `<div class="text-xs text-muted mt-1">${window.escapeHtml(v.variantDesc)}</div>` : ''}
            </div>
            <div class="flex-gap align-center">
                <button type="button" class="btn btn-sm ${v.soldOut ? 'btn-danger' : 'btn-success'}" onclick="window.toggleTempVariantSoldOut(${idx})">
                    ${v.soldOut ? 'Stok Habis' : 'Ready'}
                </button>
                <button type="button" class="btn-icon-only text-primary" style="width:32px; height:32px;" onclick="window.editTempNominal(${idx})">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button type="button" class="btn-icon-only text-danger" style="width:32px; height:32px;" onclick="window.removeTempNominal(${idx})">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        </div>`;
    });
    listEl.innerHTML = html;
};

window.toggleTempVariantSoldOut = function(idx) {
    if (tempProductVariants[idx]) {
        tempProductVariants[idx].soldOut = !tempProductVariants[idx].soldOut;
        tempProductVariants[idx].manualLockSoldOut = tempProductVariants[idx].soldOut;
        window.renderTempNominals();
    }
};

window.removeTempNominal = function(idx) {
    tempProductVariants.splice(idx, 1);
    window.cancelEditTempNominal();
    window.renderTempNominals();
};

window.saveManagedProduct = async function() {
    const origBrand = document.getElementById('manage-orig-brand').value;
    const brandName = document.getElementById('manage-brand-name').value.trim();
    const prodType = document.getElementById('manage-prod-type').value;
    const inputType = document.getElementById('manage-input-type').value;
    const desc = document.getElementById('manage-prod-desc').value.trim();
    const isGangguan = document.getElementById('manage-brand-gangguan').checked;

    const requireAppTarget = prodType === 'app' ? Boolean(document.getElementById('manage-app-require-target')?.checked) : false;
    const appTargetLabel = requireAppTarget ? (document.getElementById('manage-app-target-label')?.value.trim() || '') : '';
    const appTargetPlaceholder = requireAppTarget ? (document.getElementById('manage-app-target-ph')?.value.trim() || '') : '';

    if (!brandName || tempProductVariants.length === 0) {
        window.customAlert('Belum Lengkap', 'Nama produk dan minimal 1 variasi wajib diisi.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-save-managed-prod');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;

    try {
        if (origBrand) {
            const oldItems = products.filter(p => (p.brand || p.name) === origBrand);
            const keepDbIds = tempProductVariants.map(v => v.dbId).filter(Boolean);
            for (const oldItem of oldItems) {
                if (!keepDbIds.includes(oldItem.dbId)) {
                    await deleteDoc(doc(db, pathProducts, oldItem.dbId));
                }
            }
        }

        for (const v of tempProductVariants) {
            const readyVaultCount = countReadyStockSlotsForVariant(brandName, v.name);
            const procMode = v.processType || 'auto';
            const effectiveSoldOut = (procMode === 'auto' && readyVaultCount > 0)
                ? false
                : Boolean(v.soldOut);

            const payload = {
                brand: brandName,
                name: v.name,
                priceNum: v.priceNum,
                variantDesc: v.variantDesc || '',
                durationDays: parseInt(v.durationDays || 0, 10),
                type: prodType,
                inputType: prodType === 'app' ? (requireAppTarget ? 'app_target' : 'none') : inputType,
                requireAppTarget: requireAppTarget,
                appTargetLabel: appTargetLabel,
                appTargetPlaceholder: appTargetPlaceholder,
                desc: desc,
                imgUrlBase64: tempManageImgBase64,
                isGangguan: isGangguan,
                processType: procMode,
                stockMode: v.stockMode || 'PRIVATE',
                stockCount: (procMode === 'auto' || procMode === 'ask_auto') ? readyVaultCount : (v.soldOut ? 0 : null),
                soldOut: effectiveSoldOut,
                manualLockSoldOut: procMode === 'manual' ? effectiveSoldOut : false
            };

            if (v.dbId) {
                await updateDoc(doc(db, pathProducts, v.dbId), payload);
            } else {
                await addDoc(collection(db, pathProducts), payload);
            }
        }

        window.closeModal('modal-manage-product');
        window.showToast('Tersimpan', `Produk ${brandName} berhasil disimpan.`, 'success');
    } catch (e) {
        console.error(e);
        window.customAlert('Error', 'Gagal menyimpan data produk.', 'error');
    } finally {
        btn.innerHTML = ogHtml;
        btn.disabled = false;
    }
};

window.deleteBrandEntirely = function(brandName) {
    window.openConfirm('Hapus Produk', `Yakin ingin menghapus seluruh produk dan variasi <b>${window.escapeHtml(brandName)}</b>?`, async (confirmed) => {
        if (confirmed) {
            try {
                const itemsToDelete = products.filter(p => (p.brand || p.name) === brandName);
                for (const item of itemsToDelete) {
                    await deleteDoc(doc(db, pathProducts, item.dbId));
                }
                window.showToast('Dihapus', `Produk ${brandName} telah dihapus.`, 'info');
            } catch (e) {
                window.customAlert('Error', 'Gagal menghapus produk.', 'error');
            }
        }
    });
};

// ==========================================
// CEK & TAMBAH STOK BERTINGKAT (PILIH PRODUK -> PILIH VARIASI -> MUNCUL STOK AKTIF #17 & #18)
// ==========================================
window.populateStockProductSelect = function() {
    // 1. Isi dropdown Produk untuk bagian Cek Stok (#check-stock-brand-select) dan Tambah Stok (#stock-brand-select)
    const checkBrandSel = document.getElementById('check-stock-brand-select');
    const addBrandSel = document.getElementById('stock-brand-select');
    const legacySel = document.getElementById('stock-product-select');

    const sortedBrands = [...groupedBrands].sort((a, b) => a.brandName.localeCompare(b.brandName));

    if (checkBrandSel) {
        let html = '<option value="">-- Pilih Produk --</option>';
        sortedBrands.forEach(b => {
            const totalActive = b.items.reduce((acc, it) => acc + countReadyStockSlotsForVariant(b.brandName, it.name), 0);
            html += `<option value="${window.escapeHtml(b.brandName)}">${window.escapeHtml(b.brandName)} (${b.items.length} Variasi • ${totalActive >= 999 ? 'Tersedia' : totalActive + ' Stok'})</option>`;
        });
        checkBrandSel.innerHTML = html;
        if (selectedCheckStockBrand) checkBrandSel.value = selectedCheckStockBrand;
    }

    if (addBrandSel) {
        let html = '<option value="">-- Pilih Produk Dahulu --</option>';
        sortedBrands.forEach(b => {
            html += `<option value="${window.escapeHtml(b.brandName)}">${window.escapeHtml(b.brandName)} (${b.items.length} Variasi)</option>`;
        });
        addBrandSel.innerHTML = html;
        if (selectedAddStockBrand) addBrandSel.value = selectedAddStockBrand;
    }

    if (legacySel) {
        let lHtml = '<option value="">-- Pilih Varian --</option>';
        products.forEach(p => {
            const bName = p.brand || p.name;
            lHtml += `<option value="${window.escapeHtml(bName)}|||${window.escapeHtml(p.name)}">${window.escapeHtml(bName)} - ${window.escapeHtml(p.name)}</option>`;
        });
        legacySel.innerHTML = lHtml;
    }

    renderStockBrandCardsGrid();
    if (selectedCheckStockBrand) {
        renderStockCheckVariantsForBrand(selectedCheckStockBrand);
    }
    if (selectedAddStockBrand) {
        window.onSelectAddStockBrand(true);
    }
};

function renderStockBrandCardsGrid() {
    const grid = document.getElementById('stock-brand-cards-grid');
    if (!grid) return;

    const sortedBrands = [...groupedBrands].sort((a, b) => a.brandName.localeCompare(b.brandName));
    if (sortedBrands.length === 0) {
        grid.innerHTML = '<div class="text-xs text-muted p-2">Belum ada produk di katalog.</div>';
        return;
    }

    let html = '';
    sortedBrands.forEach(b => {
        const safeBrandJs = escapeJsStr(b.brandName);
        const isSelected = selectedCheckStockBrand === b.brandName;
        const totalActive = b.items.reduce((acc, it) => acc + countReadyStockSlotsForVariant(b.brandName, it.name), 0);
        const badgeClass = totalActive > 0 ? 'status-success' : 'status-anon';

        html += `
        <div class="stock-brand-card ${isSelected ? 'active' : ''}" onclick="window.selectStockCheckBrand('${safeBrandJs}')">
            <div style="min-width:0;">
                <strong class="text-dark d-block" style="font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(b.brandName)}</strong>
                <span class="text-xs text-muted">${b.items.length} Variasi</span>
            </div>
            <span class="status-badge ${badgeClass}" style="flex-shrink:0;">${totalActive >= 999 ? '∞' : totalActive} Stok</span>
        </div>`;
    });
    grid.innerHTML = html;
}

window.resetStockHierarchySelection = function() {
    selectedCheckStockBrand = '';
    selectedCheckStockVariant = '';
    const checkBrandSel = document.getElementById('check-stock-brand-select');
    const varSelectWrap = document.getElementById('check-stock-variant-select-wrap');
    const varPanel = document.getElementById('stock-check-variants-panel');
    const itemsPanel = document.getElementById('stock-check-items-panel');

    if (checkBrandSel) checkBrandSel.value = '';
    if (varSelectWrap) varSelectWrap.style.display = 'none';
    if (varPanel) varPanel.style.display = 'none';
    if (itemsPanel) itemsPanel.style.display = 'none';

    renderStockBrandCardsGrid();
};

// Langkah 1 Cek Stok: Pilih Produk -> Muncul daftar Variasi di dalam produk tersebut (#17)
window.selectStockCheckBrand = function(brandName) {
    selectedCheckStockBrand = String(brandName || '').trim();
    selectedCheckStockVariant = '';

    const checkBrandSel = document.getElementById('check-stock-brand-select');
    if (checkBrandSel && checkBrandSel.value !== selectedCheckStockBrand) {
        checkBrandSel.value = selectedCheckStockBrand;
    }

    renderStockBrandCardsGrid();

    if (!selectedCheckStockBrand) {
        window.resetStockHierarchySelection();
        return;
    }

    renderStockCheckVariantsForBrand(selectedCheckStockBrand);
    const itemsPanel = document.getElementById('stock-check-items-panel');
    if (itemsPanel) itemsPanel.style.display = 'none';
};

function renderStockCheckVariantsForBrand(brandName) {
    const varSelectWrap = document.getElementById('check-stock-variant-select-wrap');
    const varSelect = document.getElementById('check-stock-variant-select');
    const varPanel = document.getElementById('stock-check-variants-panel');
    const varGrid = document.getElementById('stock-variant-cards-grid');
    const brandTitle = document.getElementById('stock-selected-brand-title');
    const brandSummary = document.getElementById('stock-selected-brand-summary');

    const brandObj = groupedBrands.find(b => b.brandName === brandName);
    const brandVariants = brandObj ? [...brandObj.items] : [];

    // Tambahkan juga variasi yang mungkin ada di koleksi stocks meskipun belum terdaftar di katalog
    stocksData.forEach(s => {
        if ((s.brand || '').toLowerCase() === brandName.toLowerCase()) {
            const exists = brandVariants.some(v => (v.name || '').toLowerCase() === (s.itemName || '').toLowerCase());
            if (!exists && s.itemName) {
                brandVariants.push({ name: s.itemName, priceNum: 0 });
            }
        }
    });

    if (varSelectWrap) varSelectWrap.style.display = 'block';
    if (varPanel) varPanel.style.display = 'block';
    if (brandTitle) brandTitle.innerText = brandName;
    if (brandSummary) brandSummary.innerText = `${brandVariants.length} Variasi`;

    if (varSelect) {
        let optHtml = '<option value="">-- Pilih Variasi --</option>';
        brandVariants.forEach(v => {
            const activeSlots = countReadyStockSlotsForVariant(brandName, v.name);
            optHtml += `<option value="${window.escapeHtml(v.name)}">${window.escapeHtml(v.name)} (Stok Aktif: ${activeSlots >= 999 ? 'Tersedia' : activeSlots})</option>`;
        });
        varSelect.innerHTML = optHtml;
        if (selectedCheckStockVariant) varSelect.value = selectedCheckStockVariant;
    }

    if (varGrid) {
        if (brandVariants.length === 0) {
            varGrid.innerHTML = '<div class="text-xs text-muted p-2">Belum ada variasi pada produk ini.</div>';
        } else {
            let cardsHtml = '';
            brandVariants.forEach(v => {
                const safeVarJs = escapeJsStr(v.name);
                const activeSlots = countReadyStockSlotsForVariant(brandName, v.name);
                const isSelected = selectedCheckStockVariant === v.name;
                const sBadge = activeSlots > 0 ? 'status-success' : 'status-failed';

                cardsHtml += `
                <div class="stock-variant-card ${isSelected ? 'active' : ''}" onclick="window.selectStockCheckVariant('${safeVarJs}')">
                    <div class="flex-between align-center">
                        <strong class="text-dark" style="font-size:0.86rem;">${window.escapeHtml(v.name)}</strong>
                        <span class="status-badge ${sBadge}">${activeSlots >= 999 ? '∞' : activeSlots} Aktif</span>
                    </div>
                    <span class="text-xs text-muted">${v.priceNum ? 'Rp' + v.priceNum.toLocaleString('id-ID') : 'Klik untuk lihat stok'}</span>
                </div>`;
            });
            varGrid.innerHTML = cardsHtml;
        }
    }
}

// Langkah 2 Cek Stok: Pilih Variasi -> Baru muncul stok aktif saat itu (#17)
window.selectStockCheckVariant = function(variantName) {
    selectedCheckStockVariant = String(variantName || '').trim();
    const varSelect = document.getElementById('check-stock-variant-select');
    if (varSelect && varSelect.value !== selectedCheckStockVariant) {
        varSelect.value = selectedCheckStockVariant;
    }

    renderStockCheckVariantsForBrand(selectedCheckStockBrand);

    const itemsPanel = document.getElementById('stock-check-items-panel');
    if (!selectedCheckStockVariant) {
        if (itemsPanel) itemsPanel.style.display = 'none';
        return;
    }

    if (itemsPanel) itemsPanel.style.display = 'block';
    window.renderAdminStocks();
};

// Pintasan dari Cek Stok Variasi langsung ke Form Tambah Stok untuk Variasi tersebut
window.jumpToAddStockForSelectedVariant = function() {
    if (!selectedCheckStockBrand || !selectedCheckStockVariant) return;
    const addBrandSel = document.getElementById('stock-brand-select');
    const addVarSel = document.getElementById('stock-variant-select');

    if (addBrandSel) {
        addBrandSel.value = selectedCheckStockBrand;
        window.onSelectAddStockBrand();
    }
    if (addVarSel) {
        addVarSel.value = selectedCheckStockVariant;
        window.onSelectAddStockVariant();
    }

    const addPanel = document.getElementById('panel-add-stock-hierarchical');
    if (addPanel) addPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('stock-data-input')?.focus(), 250);
};

// Langkah 1 Tambah Stok: Pilih Produk -> Muncul pilihan Variasi (#17)
window.onSelectAddStockBrand = function(keepVariantSelection = false) {
    const addBrandSel = document.getElementById('stock-brand-select');
    const varWrap = document.getElementById('stock-add-variant-wrap');
    const varSel = document.getElementById('stock-variant-select');
    const formWrap = document.getElementById('stock-add-form-wrap');

    selectedAddStockBrand = addBrandSel ? addBrandSel.value.trim() : '';
    if (!keepVariantSelection) {
        selectedAddStockVariant = '';
    }

    if (!selectedAddStockBrand) {
        if (varWrap) varWrap.style.display = 'none';
        if (formWrap) formWrap.style.display = 'none';
        return;
    }

    const brandObj = groupedBrands.find(b => b.brandName === selectedAddStockBrand);
    const variants = brandObj ? brandObj.items : [];

    if (varWrap) varWrap.style.display = 'block';
    if (varSel) {
        let html = '<option value="">-- Pilih Variasi --</option>';
        variants.forEach(v => {
            const activeCount = countReadyStockSlotsForVariant(selectedAddStockBrand, v.name);
            html += `<option value="${window.escapeHtml(v.name)}">${window.escapeHtml(v.name)} (Stok Aktif: ${activeCount >= 999 ? 'Tersedia' : activeCount})</option>`;
        });
        varSel.innerHTML = html;
        if (keepVariantSelection && selectedAddStockVariant) {
            varSel.value = selectedAddStockVariant;
        }
    }

    if (keepVariantSelection && selectedAddStockVariant) {
        window.onSelectAddStockVariant();
    } else if (formWrap) {
        formWrap.style.display = 'none';
    }
};

// Langkah 2 Tambah Stok: Pilih Variasi -> Baru muncul form tambah stok & info stok aktif saat ini (#17)
window.onSelectAddStockVariant = function() {
    const varSel = document.getElementById('stock-variant-select');
    const formWrap = document.getElementById('stock-add-form-wrap');
    const targetLbl = document.getElementById('add-stock-target-label');
    const activeBadge = document.getElementById('add-stock-current-active-badge');
    const modeSel = document.getElementById('stock-mode-select');

    selectedAddStockVariant = varSel ? varSel.value.trim() : '';
    if (!selectedAddStockBrand || !selectedAddStockVariant) {
        if (formWrap) formWrap.style.display = 'none';
        return;
    }

    if (formWrap) formWrap.style.display = 'block';
    if (targetLbl) targetLbl.innerText = `${selectedAddStockBrand} — ${selectedAddStockVariant}`;

    const currentActive = countReadyStockSlotsForVariant(selectedAddStockBrand, selectedAddStockVariant);
    if (activeBadge) {
        activeBadge.className = currentActive > 0 ? 'status-badge status-success' : 'status-badge status-pending';
        activeBadge.innerText = `Stok Aktif Saat Ini: ${currentActive >= 999 ? 'Tersedia' : currentActive}`;
    }

    const matchedProd = products.find(p => (p.brand || p.name) === selectedAddStockBrand && p.name === selectedAddStockVariant);
    if (matchedProd && matchedProd.stockMode && modeSel) {
        modeSel.value = matchedProd.stockMode;
        window.toggleStockModeHelper();
    }
};

window.toggleStockModeHelper = function() {
    const mode = document.getElementById('stock-mode-select')?.value || 'PRIVATE';
    const quotaWrap = document.getElementById('stock-sharing-quota-wrap');
    const emailOAuthWrap = document.getElementById('stock-email-oauth-wrap');
    const helper = document.getElementById('stock-mode-helper');
    const textarea = document.getElementById('stock-data-input');

    if (quotaWrap) {
        quotaWrap.style.display = (mode === 'SHARING') ? 'block' : 'none';
    }
    if (emailOAuthWrap) {
        emailOAuthWrap.style.display = (mode === 'EMAIL_OAUTH') ? 'block' : 'none';
    }

    if (!helper || !textarea) return;

    if (mode === 'EMAIL_OAUTH') {
        textarea.placeholder = "user1@outlook.com|Pass123!|M.C542_BAY.0.U.-Ci...|9e5f94bc-e8a4-4e73-b8be-63364c29d753\nuser2@hotmail.com|Pass456!|M.C542_BAY.0.U.-Cj...|9e5f94bc-e8a4-4e73-b8be-63364c29d753";
        helper.innerHTML = `Masukkan 1 akun per baris dengan format <code>email|password|refresh_token|client_id</code>.`;
    } else if (mode === 'SHARING') {
        textarea.placeholder = "akun_sharing1@gmail.com | Pass123 | Keterangan Profil";
        helper.innerHTML = `1 baris akun dapat dibeli oleh beberapa orang sesuai kapasitas kuota.`;
    } else if (mode === 'REUSABLE') {
        textarea.placeholder = "https://drive.google.com/drive/folders/xxxxx | Keterangan";
        helper.innerHTML = `1 baris data ini dapat terkirim berulang kali tanpa batas.`;
    } else {
        textarea.placeholder = "akun1@gmail.com | Pass123 | Keterangan\nakun2@gmail.com | Pass456 | Keterangan";
        helper.innerHTML = `1 baris = 1 akun untuk 1 pembeli. Gunakan pemisah <code>|</code>.`;
    }
};

window.addStockMassal = async function() {
    const brand = selectedAddStockBrand || document.getElementById('stock-brand-select')?.value.trim() || '';
    const itemName = selectedAddStockVariant || document.getElementById('stock-variant-select')?.value.trim() || '';
    const modeVal = document.getElementById('stock-mode-select')?.value || 'PRIVATE';
    const maxQuotaVal = parseInt(document.getElementById('stock-max-quota')?.value || '5', 10);
    const rawLines = document.getElementById('stock-data-input')?.value.trim() || '';

    if (!brand || !itemName) {
        window.customAlert('Pilih Produk & Variasi', 'Pilih produk dan variasi terlebih dahulu sebelum menambahkan stok.', 'warning');
        return;
    }

    if (!rawLines) {
        window.customAlert('Stok Kosong', 'Masukkan minimal 1 baris data stok.', 'warning');
        return;
    }

    const lines = rawLines.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) return;

    const isReusable = (modeVal === 'REUSABLE');
    const isSharing = (modeVal === 'SHARING');
    const isEmailOAuth = (modeVal === 'EMAIL_OAUTH');
    const finalMaxQuota = isSharing ? Math.max(2, maxQuotaVal) : 1;

    try {
        for (const line of lines) {
            await addDoc(collection(db, pathStocks), {
                brand: brand,
                itemName: itemName,
                data: line,
                mode: modeVal,
                stockFormat: modeVal,
                isReusable: isReusable,
                maxQuota: finalMaxQuota,
                usedQuota: 0,
                sentCount: 0,
                status: 'Ready',
                createdAt: Date.now()
            });
        }

        const matchedProd = products.find(p => (p.brand || p.name) === brand && p.name === itemName);
        if (matchedProd && matchedProd.dbId) {
            const procType = (matchedProd.processType || 'auto').toLowerCase();
            const addedSlots = isReusable ? 999 : (lines.length * finalMaxQuota);
            const currentSlots = countReadyStockSlotsForVariant(brand, itemName) + addedSlots;

            const prodUpdate = {};
            if (isEmailOAuth) prodUpdate.stockMode = 'EMAIL_OAUTH';
            else if (isSharing) prodUpdate.stockMode = 'SHARING';

            if (procType !== 'manual') {
                prodUpdate.stockCount = currentSlots;
                prodUpdate.soldOut = false;
            }
            if (Object.keys(prodUpdate).length > 0) {
                await updateDoc(doc(db, pathProducts, matchedProd.dbId), prodUpdate).catch(() => {});
            }
        }

        document.getElementById('stock-data-input').value = '';

        // Otomatis tampilkan juga variasi yang baru ditambah di panel Cek Stok di atas
        selectedCheckStockBrand = brand;
        selectedCheckStockVariant = itemName;
        window.populateStockProductSelect();
        window.selectStockCheckVariant(itemName);
        window.onSelectAddStockVariant();

        window.showToast('Stok Ditambahkan', `${lines.length} baris stok berhasil ditambahkan ke ${brand} - ${itemName}.`, 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan stok ke database.', 'error');
    }
};

window.setAdminStockFilter = function(filterType, btnEl) {
    currentStockFilter = filterType;
    document.querySelectorAll('#stock-check-items-panel .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    window.renderAdminStocks();
};

window.copyRawPipeStockV27 = function(rawStr) {
    if (!rawStr) return;
    const parts = String(rawStr).split('|').map(s => s.trim());
    const cleanFourPart = parts.length >= 4 ? `${parts[0]}|${parts[1]}|${parts[2]}|${parts[3]}` : rawStr;
    navigator.clipboard.writeText(cleanFourPart).then(() => {
        window.showToast('Disalin', 'Format email utuh berhasil disalin.', 'success');
    });
};

window.renderAdminStocks = function() {
    // 1. Perbarui statistik ringkasan stok keseluruhan
    const readyStocks = stocksData.filter(s => s.status === 'Ready');
    const usedStocks = stocksData.filter(s => s.status !== 'Ready');
    const emailOAuthStocks = stocksData.filter(s => s.status === 'Ready' && (s.stockFormat === 'EMAIL_OAUTH' || s.mode === 'EMAIL_OAUTH' || (s.data && s.data.split('|').length >= 4)));
    let totalAvailableSlots = 0;

    readyStocks.forEach(s => {
        if (s.isReusable) {
            totalAvailableSlots += 99;
        } else {
            const maxQ = parseInt(s.maxQuota || 1, 10);
            const usedQ = parseInt(s.usedQuota || 0, 10);
            totalAvailableSlots += Math.max(0, maxQ - usedQ);
        }
    });

    const elReady = document.getElementById('stock-stat-ready');
    const elEmail = document.getElementById('stock-stat-email');
    const elSlots = document.getElementById('stock-stat-slots');
    const elUsed = document.getElementById('stock-stat-used');

    if (elReady) elReady.innerText = readyStocks.length;
    if (elEmail) elEmail.innerText = emailOAuthStocks.length;
    if (elSlots) elSlots.innerText = totalAvailableSlots;
    if (elUsed) elUsed.innerText = usedStocks.length;

    // 2. Perbarui kartu produk & variasi di panel hierarki (#17)
    renderStockBrandCardsGrid();
    if (selectedCheckStockBrand) {
        renderStockCheckVariantsForBrand(selectedCheckStockBrand);
    }
    if (selectedAddStockBrand && selectedAddStockVariant) {
        const currentActive = countReadyStockSlotsForVariant(selectedAddStockBrand, selectedAddStockVariant);
        const activeBadge = document.getElementById('add-stock-current-active-badge');
        if (activeBadge) {
            activeBadge.className = currentActive > 0 ? 'status-badge status-success' : 'status-badge status-pending';
            activeBadge.innerText = `Stok Aktif Saat Ini: ${currentActive >= 999 ? 'Tersedia' : currentActive}`;
        }
    }

    // 3. Hanya tampilkan daftar item stok jika Produk & Variasi sudah dipilih (#17)
    const itemsPanel = document.getElementById('stock-check-items-panel');
    const tbody = document.getElementById('admin-stock-list');
    const mobileContainer = document.getElementById('admin-stock-mobile-cards');
    if (!tbody || !itemsPanel) return;

    if (!selectedCheckStockBrand || !selectedCheckStockVariant) {
        itemsPanel.style.display = 'none';
        return;
    }

    itemsPanel.style.display = 'block';
    const varTitleEl = document.getElementById('stock-selected-variant-title');
    const varBadgeEl = document.getElementById('stock-selected-variant-badge');
    const activeSlotsCount = countReadyStockSlotsForVariant(selectedCheckStockBrand, selectedCheckStockVariant);

    if (varTitleEl) {
        varTitleEl.innerText = `${selectedCheckStockBrand} — ${selectedCheckStockVariant}`;
    }
    if (varBadgeEl) {
        varBadgeEl.className = activeSlotsCount > 0 ? 'status-badge status-success' : 'status-badge status-failed';
        varBadgeEl.innerText = `${activeSlotsCount >= 999 ? '∞' : activeSlotsCount} Stok Aktif`;
    }

    const searchQ = (document.getElementById('admin-search-stock')?.value || '').trim().toLowerCase();

    // Filter khusus untuk Produk & Variasi yang dipilih
    let filtered = stocksData.filter(s =>
        (s.brand || '').toLowerCase() === selectedCheckStockBrand.toLowerCase() &&
        (s.itemName || '').toLowerCase() === selectedCheckStockVariant.toLowerCase()
    );

    filtered = filtered.filter(s => {
        if (currentStockFilter === 'READY') return s.status === 'Ready';
        if (currentStockFilter === 'USED') return s.status !== 'Ready';
        return true;
    });

    if (searchQ) {
        filtered = filtered.filter(s => (s.data || '').toLowerCase().includes(searchQ));
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:1.8rem;">Tidak ada stok pada variasi ini.</td></tr>';
        if (mobileContainer) mobileContainer.innerHTML = '<div class="text-center text-muted p-3 text-xs">Tidak ada stok pada variasi ini.</div>';
        return;
    }

    let tableHtml = '';
    let mobileHtml = '';

    filtered.forEach(s => {
        const isReady = s.status === 'Ready';
        const maxQ = parseInt(s.maxQuota || 1, 10);
        const usedQ = parseInt(s.usedQuota || 0, 10);
        const isSharing = maxQ > 1 && !s.isReusable;
        const isEmailOAuth = (s.stockFormat === 'EMAIL_OAUTH' || s.mode === 'EMAIL_OAUTH' || (s.data && s.data.split('|').length >= 4));

        let modeBadge = `<span class="status-badge status-anon">PRIVATE</span>`;
        let quotaInfo = `1x Pakai (${usedQ}/1)`;

        if (s.isReusable) {
            modeBadge = `<span class="status-badge status-pending">REUSABLE</span>`;
            quotaInfo = `Terkirim: <b>${s.sentCount || 0}x</b>`;
        } else if (isEmailOAuth) {
            modeBadge = `<span class="status-badge status-email-oauth">PRODUK EMAIL</span>`;
            quotaInfo = `Format Email (${usedQ}/${maxQ})`;
        } else if (isSharing) {
            modeBadge = `<span class="status-badge status-unpaid">SHARING</span>`;
            quotaInfo = `Terpakai: <b>${usedQ} / ${maxQ} Orang</b>`;
        }

        const statusBadge = isReady
            ? `<span class="status-badge status-success">AKTIF (READY)</span>`
            : `<span class="status-badge status-failed">TERPAKAI (${s.orderId || '-'})</span>`;

        const editQuotaBtn = isSharing
            ? `<button class="btn btn-outline btn-sm" onclick="window.changeStockMaxQuotaPrompt('${s.dbId}', ${maxQ}, ${usedQ})" title="Ubah Kuota Sharing"><i class="fa-solid fa-sliders"></i> Kuota</button>`
            : '';

        const safeDataJs = escapeJsStr(s.data || '');
        const copyPipeBtn = isEmailOAuth
            ? `<button class="btn btn-primary btn-sm" onclick="window.copyRawPipeStockV27('${safeDataJs}')"><i class="fa-regular fa-copy"></i> Salin Format</button>`
            : `<button class="btn btn-outline btn-sm" onclick="window.copyTextToClipboard('${safeDataJs}', 'Data Stok')"><i class="fa-regular fa-copy"></i> Salin</button>`;

        tableHtml += `
        <tr>
            <td>
                <strong class="text-dark">${window.escapeHtml(s.brand)}</strong><br>
                <span class="text-muted text-xs">${window.escapeHtml(s.itemName)}</span>
            </td>
            <td>
                <div class="raw-pipe-pill" style="max-width: 390px;">${window.escapeHtml(s.data)}</div>
            </td>
            <td>
                ${modeBadge}
                <div class="text-xs text-muted mt-1">${quotaInfo}</div>
            </td>
            <td>${statusBadge}</td>
            <td>
                <div class="flex-gap align-center flex-wrap-gap">
                    ${copyPipeBtn}
                    ${editQuotaBtn}
                    <button class="btn-icon-only text-danger" style="width:32px; height:32px;" onclick="window.deleteStockItem('${s.dbId}')" title="Hapus Stok">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;

        mobileHtml += `
        <div class="stock-m-card">
            <div class="flex-between align-center mb-1">
                <div>
                    <strong class="text-dark d-block" style="font-size:0.9rem;">${window.escapeHtml(s.brand)}</strong>
                    <span class="text-xs text-muted">${window.escapeHtml(s.itemName)}</span>
                </div>
                ${statusBadge}
            </div>
            <div class="raw-pipe-pill mb-2">${window.escapeHtml(s.data)}</div>
            <div class="flex-between align-center flex-wrap-gap mt-2">
                <div>
                    ${modeBadge}
                    <span class="text-xs text-muted ml-1">${quotaInfo}</span>
                </div>
                <div class="flex-gap">
                    ${copyPipeBtn}
                    ${editQuotaBtn}
                    <button class="btn btn-danger btn-sm" onclick="window.deleteStockItem('${s.dbId}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>`;
    });

    tbody.innerHTML = tableHtml;
    if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
};

window.changeStockMaxQuotaPrompt = function(stockDbId, currentMax, currentUsed) {
    document.getElementById('edit-quota-stock-id').value = stockDbId;
    document.getElementById('edit-quota-used-val').value = currentUsed;
    document.getElementById('edit-quota-new-max').value = currentMax;
    const helper = document.getElementById('edit-quota-helper');
    if (helper) {
        helper.innerHTML = `Saat ini sudah terpakai oleh <b>${currentUsed} pembeli</b>.`;
    }
    window.openModal('modal-edit-quota');
};

window.saveStockMaxQuotaFromModal = async function() {
    const stockDbId = document.getElementById('edit-quota-stock-id').value;
    const currentUsed = parseInt(document.getElementById('edit-quota-used-val').value || '0', 10);
    const newMax = parseInt(document.getElementById('edit-quota-new-max').value || '1', 10);

    if (!stockDbId || isNaN(newMax) || newMax < 1) {
        window.customAlert('Angka Tidak Valid', 'Masukkan angka kuota minimal 1.', 'warning');
        return;
    }

    const newStatus = currentUsed >= newMax ? 'Used' : 'Ready';
    try {
        await updateDoc(doc(db, pathStocks, stockDbId), {
            maxQuota: newMax,
            status: newStatus
        });
        await window.syncAllProductsWithStockVaultV27(false);
        window.closeModal('modal-edit-quota');
        window.showToast('Kuota Diperbarui', `Kapasitas kuota sharing diubah menjadi ${newMax} orang.`, 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal memperbarui kuota stok.', 'error');
    }
};

window.deleteStockItem = async function(dbId) {
    try {
        await deleteDoc(doc(db, pathStocks, dbId));
        await window.syncAllProductsWithStockVaultV27(false);
        window.showToast('Stok Dihapus', '1 item stok telah dihapus.', 'info');
    } catch (e) {
        window.customAlert('Error', 'Gagal menghapus stok.', 'error');
    }
};

window.cleanUsedStocks = function() {
    const usedList = stocksData.filter(s => s.status !== 'Ready');
    if (usedList.length === 0) {
        window.customAlert('Bersih', 'Tidak ada stok berstatus Terpakai saat ini.', 'info');
        return;
    }
    window.openConfirm('Hapus Stok Terpakai', `Hapus <b>${usedList.length} item stok</b> yang sudah terpakai?`, async (confirmed) => {
        if (confirmed) {
            for (const s of usedList) {
                await deleteDoc(doc(db, pathStocks, s.dbId)).catch(() => {});
            }
            window.showToast('Selesai', 'Stok terpakai telah dihapus.', 'success');
        }
    });
};

// ==========================================
// KODE PROMO
// ==========================================
function populatePromoBrandSelect() {
    const sel = document.getElementById('manage-promo-brand');
    if (!sel) return;
    let html = '<option value="all">Semua Produk</option>';
    groupedBrands.forEach(b => {
        html += `<option value="${window.escapeHtml(b.brandName)}">Khusus ${window.escapeHtml(b.brandName)}</option>`;
    });
    sel.innerHTML = html;
}

window.openAddPromoModal = function() {
    populatePromoBrandSelect();
    document.getElementById('modal-promo-title').innerHTML = '<i class="fa-solid fa-ticket text-primary"></i> Buat Kode Promo Baru';
    document.getElementById('manage-promo-dbid').value = '';
    document.getElementById('manage-promo-code').value = '';
    document.getElementById('manage-promo-type').value = 'nominal';
    document.getElementById('manage-promo-amount').value = '';
    document.getElementById('manage-promo-quota').value = '50';
    document.getElementById('manage-promo-minorder').value = '0';
    document.getElementById('manage-promo-brand').value = 'all';
    document.getElementById('manage-promo-user').value = 'member';
    document.getElementById('manage-promo-expiry').value = '';
    const oneEmailEl = document.getElementById('manage-promo-one-per-email');
    if (oneEmailEl) oneEmailEl.checked = true;
    document.getElementById('btn-save-promo-text').innerText = 'Simpan Kode Promo';

    window.updatePromoLivePreview();
    window.openModal('modal-manage-promo');
};

window.openEditPromoModal = function(dbId) {
    const p = promos.find(x => x.dbId === dbId);
    if (!p) return;

    populatePromoBrandSelect();
    document.getElementById('modal-promo-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Kode Promo: ${window.escapeHtml(p.code)}`;
    document.getElementById('manage-promo-dbid').value = p.dbId;
    document.getElementById('manage-promo-code').value = p.code || '';
    document.getElementById('manage-promo-type').value = p.type || 'nominal';
    document.getElementById('manage-promo-amount').value = p.amount || 0;
    document.getElementById('manage-promo-quota').value = p.maxUses || 50;
    document.getElementById('manage-promo-minorder').value = p.minOrder || 0;
    document.getElementById('manage-promo-brand').value = p.targetBrand || 'all';
    document.getElementById('manage-promo-user').value = p.targetUser === 'new' ? 'new' : 'member';
    document.getElementById('manage-promo-expiry').value = p.expiryDate || '';
    const oneEmailEl = document.getElementById('manage-promo-one-per-email');
    if (oneEmailEl) oneEmailEl.checked = p.onePerEmail !== false;
    document.getElementById('btn-save-promo-text').innerText = 'Simpan Perubahan';

    window.updatePromoLivePreview();
    window.openModal('modal-manage-promo');
};

window.generateRandomPromoCode = function() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomPart = '';
    for (let i = 0; i < 5; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const inp = document.getElementById('manage-promo-code');
    if (inp) {
        inp.value = `VIPER${randomPart}`;
        window.updatePromoLivePreview();
    }
};

window.updatePromoLivePreview = function() {
    const code = (document.getElementById('manage-promo-code')?.value || 'PROMO').trim().toUpperCase();
    const type = document.getElementById('manage-promo-type')?.value || 'nominal';
    const amount = parseInt(document.getElementById('manage-promo-amount')?.value || '0', 10);
    const minOrder = parseInt(document.getElementById('manage-promo-minorder')?.value || '0', 10);
    const brand = document.getElementById('manage-promo-brand')?.value || 'all';
    const userTarget = document.getElementById('manage-promo-user')?.value || 'all';
    const onePerEmail = document.getElementById('manage-promo-one-per-email')?.checked !== false;

    const codeEl = document.getElementById('promo-prev-code');
    const valEl = document.getElementById('promo-prev-value');
    const badgeEl = document.getElementById('promo-prev-badge');
    const minEl = document.getElementById('promo-prev-min');
    const targetEl = document.getElementById('promo-prev-target');
    const userEl = document.getElementById('promo-prev-user');
    const emailRuleEl = document.getElementById('promo-prev-email-rule');

    if (codeEl) codeEl.innerText = code || 'PROMO';
    if (valEl) {
        valEl.innerText = type === 'percent' ? `Diskon ${amount}%` : `Potongan Rp${amount.toLocaleString('id-ID')}`;
    }
    if (badgeEl) {
        badgeEl.innerText = userTarget === 'member' ? 'KHUSUS MEMBER' : (type === 'percent' ? 'PERSENTASE' : 'POTONGAN HARGA');
    }
    if (minEl) {
        minEl.innerHTML = `${minOrder > 0 ? `Min. Rp${minOrder.toLocaleString('id-ID')}` : 'Tanpa Minimal'}`;
    }
    if (targetEl) {
        targetEl.innerHTML = `${brand === 'all' ? 'Semua Produk' : brand}`;
    }
    if (userEl) {
        const uLabel = userTarget === 'member' ? 'Khusus Member' : (userTarget === 'new' ? 'Transaksi Pertama' : 'Semua Pengguna');
        userEl.innerHTML = `${uLabel}`;
    }
    if (emailRuleEl) {
        emailRuleEl.innerHTML = onePerEmail ? `1x / Email` : `Bebas Klaim`;
    }
};

window.saveManagedPromo = async function() {
    const dbId = document.getElementById('manage-promo-dbid').value;
    const code = document.getElementById('manage-promo-code').value.trim().toUpperCase();
    const type = document.getElementById('manage-promo-type').value;
    const amount = parseInt(document.getElementById('manage-promo-amount').value, 10) || 0;
    const maxUses = parseInt(document.getElementById('manage-promo-quota').value, 10) || 50;
    const minOrder = parseInt(document.getElementById('manage-promo-minorder').value, 10) || 0;
    const targetBrand = document.getElementById('manage-promo-brand').value;
    const targetUser = document.getElementById('manage-promo-user').value;
    const expiryDate = document.getElementById('manage-promo-expiry').value;
    const onePerEmail = document.getElementById('manage-promo-one-per-email')?.checked !== false;

    if (!code || amount <= 0) {
        window.customAlert('Belum Lengkap', 'Masukkan kode promo dan nilai potongan yang valid.', 'warning');
        return;
    }

    const payload = {
        code,
        type,
        amount,
        maxUses,
        minOrder,
        targetBrand,
        targetUser,
        memberOnly: true,
        onePerEmail: onePerEmail,
        expiryDate,
        active: true
    };

    try {
        if (dbId) {
            await updateDoc(doc(db, pathPromos, dbId), payload);
            window.showToast('Diperbarui', `Kode promo ${code} berhasil diperbarui.`, 'success');
        } else {
            payload.usedCount = 0;
            payload.usedEmails = [];
            payload.createdAt = Date.now();
            await addDoc(collection(db, pathPromos), payload);
            window.showToast('Tersimpan', `Kode promo ${code} berhasil dibuat.`, 'success');
        }
        window.closeModal('modal-manage-promo');
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan kode promo.', 'error');
    }
};

window.renderAdminPromos = function() {
    const grid = document.getElementById('admin-promo-grid');
    if (!grid) return;

    if (promos.length === 0) {
        grid.innerHTML = '<div class="dashboard-panel text-center text-muted" style="grid-column: 1/-1;">Belum ada kode promo.</div>';
        return;
    }

    let html = '';
    promos.forEach(p => {
        const valStr = p.type === 'percent' ? `${p.amount}%` : `Rp${(p.amount || 0).toLocaleString('id-ID')}`;
        const minStr = p.minOrder > 0 ? `Min. Rp${p.minOrder.toLocaleString('id-ID')}` : 'Tanpa Minimal';
        const brandStr = (!p.targetBrand || p.targetBrand === 'all') ? 'Semua Produk' : `Khusus ${p.targetBrand}`;
        const isMemberOnly = p.targetUser === 'member' || p.memberOnly === true;
        const userBadge = isMemberOnly
            ? `<span class="status-badge status-vip" style="font-size:0.6rem;">KHUSUS MEMBER</span>`
            : (p.targetUser === 'new' ? `<span class="status-badge status-pending" style="font-size:0.6rem;">USER BARU</span>` : `<span class="status-badge status-anon" style="font-size:0.6rem;">SEMUA USER</span>`);

        const emailUsedCount = Array.isArray(p.usedEmails) ? p.usedEmails.length : 0;

        html += `
        <div class="catalog-card">
            <div>
                <div class="flex-between align-center mb-2 flex-wrap-gap">
                    <strong class="text-primary code-mono" style="font-size:1.1rem; letter-spacing:0.5px;">${window.escapeHtml(p.code)}</strong>
                    ${userBadge}
                </div>
                <div class="text-lg fw-900 text-dark mb-1">Diskon ${valStr}</div>
                <div class="text-xs text-muted mb-2">
                    <div>${window.escapeHtml(brandStr)} &bull; ${minStr}</div>
                    <div>Kuota Terpakai: <b>${p.usedCount || 0} / ${p.maxUses || 100}</b> (${emailUsedCount} Email)</div>
                    ${p.expiryDate ? `<div>Berlaku s/d: <b>${p.expiryDate}</b></div>` : ''}
                </div>
            </div>
            <div class="flex-gap">
                <button class="btn btn-outline btn-sm flex-1" onclick="window.openEditPromoModal('${p.dbId}')">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.deletePromoItem('${p.dbId}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    });
    grid.innerHTML = html;
};

window.deletePromoItem = async function(dbId) {
    await deleteDoc(doc(db, pathPromos, dbId));
    window.showToast('Dihapus', 'Kode promo berhasil dihapus.', 'info');
};

// ==========================================
// BERITA & PENGUMUMAN
// ==========================================
function populateNewsProductSelect() {
    const sel = document.getElementById('manage-news-product-select');
    if (!sel) return;
    let html = '<option value="">-- Pilih Produk --</option>';
    groupedBrands.forEach(b => {
        html += `<option value="${window.escapeHtml(b.brandName)}">${window.escapeHtml(b.brandName)}</option>`;
    });
    sel.innerHTML = html;
}

window.toggleNewsProductLinkSelect = function() {
    const checked = document.getElementById('manage-news-enable-product')?.checked;
    const wrap = document.getElementById('manage-news-product-wrap');
    if (wrap) wrap.style.display = checked ? 'block' : 'none';
    window.updateNewsLivePreview();
};

window.openAddNewsModal = function() {
    populateNewsProductSelect();
    document.getElementById('modal-news-title').innerHTML = '<i class="fa-solid fa-newspaper text-primary"></i> Tulis Berita Baru';
    document.getElementById('manage-news-index').value = '-1';
    document.getElementById('manage-news-heading').value = '';
    document.getElementById('manage-news-desc').value = '';
    document.getElementById('manage-news-enable-product').checked = false;
    document.getElementById('manage-news-product-select').value = '';
    document.getElementById('btn-save-news-text').innerText = 'Simpan Berita';

    window.clearNewsImgUpload();
    window.toggleNewsProductLinkSelect();
    window.updateNewsLivePreview();
    window.openModal('modal-manage-news');
};

window.openEditNewsModal = function(idx) {
    const list = siteSettings.newsList || [];
    const item = list[idx];
    if (!item) return;

    populateNewsProductSelect();
    document.getElementById('modal-news-title').innerHTML = '<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Berita';
    document.getElementById('manage-news-index').value = idx;
    document.getElementById('manage-news-heading').value = item.title || '';
    document.getElementById('manage-news-desc').value = item.desc || '';

    const hasProd = Boolean(item.enableProductBtn && item.linkedBrand);
    document.getElementById('manage-news-enable-product').checked = hasProd;
    document.getElementById('manage-news-product-select').value = item.linkedBrand || '';
    document.getElementById('btn-save-news-text').innerText = 'Simpan Perubahan';

    tempNewsImgBase64 = item.imageUrl || '';
    const prevImg = document.getElementById('preview-news-img');
    const placeholder = document.getElementById('preview-news-placeholder');
    const btnRemove = document.getElementById('btn-remove-news-img');
    const statusLbl = document.getElementById('news-img-status-label');

    if (tempNewsImgBase64) {
        if (prevImg) { prevImg.src = tempNewsImgBase64; prevImg.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
        if (btnRemove) btnRemove.style.display = 'inline-flex';
        if (statusLbl) statusLbl.innerText = 'Gambar terpasang';
    } else {
        window.clearNewsImgUpload();
    }

    window.toggleNewsProductLinkSelect();
    window.updateNewsLivePreview();
    window.openModal('modal-manage-news');
};

window.insertNewsTemplate = function(tplType) {
    const titleEl = document.getElementById('manage-news-heading');
    const descEl = document.getElementById('manage-news-desc');
    if (!titleEl || !descEl) return;

    if (tplType === 'restock') {
        titleEl.value = 'Stok Produk Kembali Tersedia!';
        descEl.value = 'Stok produk kini sudah tersedia kembali di katalog Vipercell.\n\nSilakan pilih produk dan variasi yang kamu butuhkan di halaman Katalog.';
    } else {
        titleEl.value = 'Promo Diskon Spesial Vipercell';
        descEl.value = 'Gunakan kode promo pada halaman pembelian untuk mendapatkan potongan harga langsung.\n\nKuota promo terbatas, silakan gunakan sebelum masa berlaku habis.';
    }
    window.updateNewsLivePreview();
};

window.previewNewsImgUpload = async function(input) {
    if (!input.files || !input.files[0]) return;
    tempNewsImgBase64 = await compressImageToBase64(input.files[0], 720, 0.8);
    const prevImg = document.getElementById('preview-news-img');
    const placeholder = document.getElementById('preview-news-placeholder');
    const btnRemove = document.getElementById('btn-remove-news-img');
    const statusLbl = document.getElementById('news-img-status-label');

    if (prevImg) { prevImg.src = tempNewsImgBase64; prevImg.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
    if (btnRemove) btnRemove.style.display = 'inline-flex';
    if (statusLbl) statusLbl.innerText = 'Gambar siap disimpan';
};

window.clearNewsImgUpload = function() {
    tempNewsImgBase64 = '';
    const fileInp = document.getElementById('manage-news-img-file');
    const prevImg = document.getElementById('preview-news-img');
    const placeholder = document.getElementById('preview-news-placeholder');
    const btnRemove = document.getElementById('btn-remove-news-img');
    const statusLbl = document.getElementById('news-img-status-label');

    if (fileInp) fileInp.value = '';
    if (prevImg) { prevImg.src = ''; prevImg.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
    if (btnRemove) btnRemove.style.display = 'none';
    if (statusLbl) statusLbl.innerText = 'Belum ada gambar';
};

window.updateNewsLivePreview = function() {
    const title = document.getElementById('manage-news-heading')?.value.trim() || 'Judul Berita';
    const desc = document.getElementById('manage-news-desc')?.value.trim() || 'Isi berita akan tampil di sini...';
    const enableProd = document.getElementById('manage-news-enable-product')?.checked;
    const prodBrand = document.getElementById('manage-news-product-select')?.value || '';

    const prevTitle = document.getElementById('news-preview-title');
    const prevExcerpt = document.getElementById('news-preview-excerpt');
    const ctaBtn = document.getElementById('news-preview-cta-btn');
    const ctaText = document.getElementById('news-preview-cta-text');

    if (prevTitle) prevTitle.innerText = title;
    if (prevExcerpt) prevExcerpt.innerText = desc;

    if (ctaBtn && ctaText) {
        if (enableProd && prodBrand) {
            ctaBtn.style.display = 'inline-flex';
            ctaText.innerText = `Beli ${prodBrand}`;
        } else {
            ctaBtn.style.display = 'none';
        }
    }
};

window.saveManagedNews = async function() {
    const idx = parseInt(document.getElementById('manage-news-index').value, 10);
    const title = document.getElementById('manage-news-heading').value.trim();
    const desc = document.getElementById('manage-news-desc').value.trim();
    const enableProductBtn = Boolean(document.getElementById('manage-news-enable-product')?.checked);
    const linkedBrand = enableProductBtn ? (document.getElementById('manage-news-product-select')?.value || '') : '';

    if (!title || !desc) {
        window.customAlert('Belum Lengkap', 'Judul dan isi berita wajib diisi.', 'warning');
        return;
    }

    const list = [...(siteSettings.newsList || [])];
    const newsObj = {
        title,
        desc,
        imageUrl: tempNewsImgBase64 || '',
        enableProductBtn: Boolean(enableProductBtn && linkedBrand),
        linkedBrand: linkedBrand,
        isHidden: false,
        date: new Date().toISOString()
    };

    if (idx >= 0 && idx < list.length) {
        list[idx] = { ...list[idx], ...newsObj };
    } else {
        list.unshift(newsObj);
    }

    try {
        await setDoc(doc(db, pathSettings, 'mainConfig'), { newsList: list }, { merge: true });
        siteSettings.newsList = list;
        window.renderAdminNews();
        window.closeModal('modal-manage-news');
        window.showToast('Tersimpan', 'Berita berhasil disimpan.', 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan berita.', 'error');
    }
};

window.renderAdminNews = function() {
    const grid = document.getElementById('admin-news-grid');
    if (!grid) return;

    const list = siteSettings.newsList || [];
    if (list.length === 0) {
        grid.innerHTML = '<div class="dashboard-panel text-center text-muted" style="grid-column: 1/-1;">Belum ada berita yang dipublikasikan.</div>';
        return;
    }

    let html = '';
    list.forEach((n, idx) => {
        const linkedInfo = (n.enableProductBtn && n.linkedBrand)
            ? `<div class="mt-1"><span class="status-badge status-pending" style="font-size:0.62rem;"><i class="fa-solid fa-link"></i> Produk: ${window.escapeHtml(n.linkedBrand)}</span></div>`
            : '';

        html += `
        <div class="catalog-card">
            <div>
                ${n.imageUrl ? `<img src="${n.imageUrl}" alt="News" style="width:100%; height:135px; object-fit:cover; border-radius:10px; border:1.5px solid var(--border); margin-bottom:10px;">` : ''}
                <h4 class="text-dark mb-1">${window.escapeHtml(n.title)}</h4>
                <p class="text-muted text-xs mb-2" style="white-space:pre-line; max-height:70px; overflow:hidden;">${window.escapeHtml(n.desc)}</p>
                ${linkedInfo}
            </div>
            <div class="flex-gap mt-2">
                <button class="btn btn-outline btn-sm flex-1" onclick="window.openEditNewsModal(${idx})">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteNewsItem(${idx})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    });
    grid.innerHTML = html;
};

window.deleteNewsItem = async function(idx) {
    const list = [...(siteSettings.newsList || [])];
    list.splice(idx, 1);
    await setDoc(doc(db, pathSettings, 'mainConfig'), { newsList: list }, { merge: true });
    siteSettings.newsList = list;
    window.renderAdminNews();
    window.showToast('Dihapus', 'Berita telah dihapus.', 'info');
};

// ==========================================
// ULASAN PEMBELI
// ==========================================
window.renderAdminReviews = function() {
    const tbody = document.getElementById('admin-reviews-list');
    if (!tbody) return;

    if (reviewsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Belum ada ulasan pembeli.</td></tr>';
        return;
    }

    let html = '';
    reviewsData.forEach(r => {
        const stars = '⭐'.repeat(r.rating || 5);
        const replyBadge = r.adminReply
            ? `<div class="text-xs text-primary mt-1"><b>Balasan Admin:</b> ${window.escapeHtml(r.adminReply)}</div>`
            : `<span class="text-xs text-muted">Belum dibalas</span>`;

        html += `
        <tr>
            <td class="text-xs text-muted">${new Date(r.timestamp).toLocaleDateString('id-ID')}</td>
            <td><strong class="text-dark">${window.escapeHtml(r.brandName)}</strong></td>
            <td>${window.escapeHtml(r.userName || r.userEmail)}</td>
            <td>${stars}</td>
            <td>
                <div class="text-sm">"${window.escapeHtml(r.text)}"</div>
                ${replyBadge}
            </td>
            <td>
                <div class="flex-gap">
                    <button class="btn btn-outline btn-sm" onclick="window.openReplyReviewModal('${r.dbId}')">
                        <i class="fa-solid fa-reply"></i> Balas
                    </button>
                    <button class="btn-icon-only text-danger" style="width:32px; height:32px;" onclick="window.deleteReviewItem('${r.dbId}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
};

window.openReplyReviewModal = function(dbId) {
    const rev = reviewsData.find(r => r.dbId === dbId);
    if (!rev) return;

    document.getElementById('reply-review-id').value = dbId;
    document.getElementById('reply-review-quote').innerHTML = `<b>${window.escapeHtml(rev.userName)} (${window.escapeHtml(rev.brandName)}):</b><br>"${window.escapeHtml(rev.text)}"`;
    document.getElementById('reply-review-text').value = rev.adminReply || '';
    window.openModal('modal-reply-review');
};

window.submitReviewReply = async function() {
    const dbId = document.getElementById('reply-review-id').value;
    const reply = document.getElementById('reply-review-text').value.trim();
    if (!dbId) return;

    try {
        await updateDoc(doc(db, pathReviews, dbId), { adminReply: reply });
        window.closeModal('modal-reply-review');
        window.showToast('Tersimpan', 'Balasan ulasan berhasil disimpan.', 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan balasan.', 'error');
    }
};

window.deleteReviewItem = async function(dbId) {
    await deleteDoc(doc(db, pathReviews, dbId));
    window.showToast('Dihapus', 'Ulasan telah dihapus.', 'info');
};

// ==========================================
// RUNNING TEXT MULTI-PESAN
// ==========================================
function ensureMarqueeListInitialized() {
    if (!Array.isArray(siteSettings.marqueeList) || siteSettings.marqueeList.length === 0) {
        const raw = String(siteSettings.marquee || 'Selamat datang di Vipercell.').trim();
        const parts = raw.includes('||') ? raw.split('||') : raw.split(/\r?\n/);
        siteSettings.marqueeList = parts.map(s => s.trim()).filter(Boolean).slice(0, 20).map(txt => ({
            text: txt,
            type: 'info',
            promoCode: '',
            targetBrand: '',
            newsIndex: 0
        }));
    }
    return siteSettings.marqueeList;
}

function populateMarqueeSelectors() {
    const brandSel = document.getElementById('mq-slot-brand');
    if (brandSel) {
        let bHtml = '<option value="">-- Otomatis Sesuai Promo / Katalog --</option>';
        groupedBrands.forEach(b => {
            bHtml += `<option value="${window.escapeHtml(b.brandName)}">${window.escapeHtml(b.brandName)}</option>`;
        });
        brandSel.innerHTML = bHtml;
    }

    const newsSel = document.getElementById('mq-slot-news');
    if (newsSel) {
        const newsArr = siteSettings.newsList || [];
        if (newsArr.length === 0) {
            newsSel.innerHTML = '<option value="0">Tab Berita</option>';
        } else {
            newsSel.innerHTML = newsArr.map((n, idx) => `<option value="${idx}">#${idx + 1}: ${window.escapeHtml(n.title || 'Berita')}</option>`).join('');
        }
    }
}

window.toggleMarqueeSlotActionFields = function() {
    const type = document.getElementById('mq-slot-type')?.value || 'info';
    const promoField = document.getElementById('mq-field-promo');
    const brandField = document.getElementById('mq-field-brand');
    const newsField = document.getElementById('mq-field-news');

    if (promoField) promoField.style.display = (type === 'promo') ? 'block' : 'none';
    if (brandField) brandField.style.display = (type === 'promo' || type === 'product') ? 'block' : 'none';
    if (newsField) newsField.style.display = (type === 'news') ? 'block' : 'none';
};

window.openMarqueeSlotForm = function(editIdx = -1) {
    const list = ensureMarqueeListInitialized();
    if (editIdx === -1 && list.length >= 20) {
        window.customAlert('Maksimal 20 Teks', 'Running Text mendukung maksimal 20 teks berjalan.', 'warning');
        return;
    }

    populateMarqueeSelectors();
    const editor = document.getElementById('marquee-slot-editor');
    const titleEl = document.getElementById('marquee-editor-title');
    document.getElementById('edit-marquee-idx').value = String(editIdx);

    if (editIdx >= 0 && editIdx < list.length) {
        const item = list[editIdx];
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen text-warning"></i> Edit Pesan Running #${editIdx + 1}`;
        document.getElementById('mq-slot-text').value = item.text || '';
        document.getElementById('mq-slot-type').value = item.type || 'info';
        document.getElementById('mq-slot-promo').value = item.promoCode || '';
        document.getElementById('mq-slot-brand').value = item.targetBrand || '';
        document.getElementById('mq-slot-news').value = String(typeof item.newsIndex === 'number' ? item.newsIndex : 0);
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-plus text-primary"></i> Tambah Pesan Running (#${list.length + 1})`;
        document.getElementById('mq-slot-text').value = '';
        document.getElementById('mq-slot-type').value = 'promo';
        document.getElementById('mq-slot-promo').value = '';
        document.getElementById('mq-slot-brand').value = '';
        document.getElementById('mq-slot-news').value = '0';
    }

    window.toggleMarqueeSlotActionFields();
    if (editor) editor.style.display = 'block';
    document.getElementById('mq-slot-text')?.focus();
};

window.closeMarqueeSlotForm = function() {
    const editor = document.getElementById('marquee-slot-editor');
    if (editor) editor.style.display = 'none';
};

window.saveMarqueeSlotItem = async function() {
    const list = [...ensureMarqueeListInitialized()];
    const editIdx = parseInt(document.getElementById('edit-marquee-idx').value || '-1', 10);
    const text = document.getElementById('mq-slot-text').value.trim();
    const type = document.getElementById('mq-slot-type').value;
    const promoCode = (document.getElementById('mq-slot-promo').value || '').trim().toUpperCase();
    let targetBrand = document.getElementById('mq-slot-brand').value;
    const newsIndex = parseInt(document.getElementById('mq-slot-news').value || '0', 10);

    if (!text) {
        window.customAlert('Teks Kosong', 'Masukkan isi pesan running text terlebih dahulu.', 'warning');
        return;
    }

    if (type === 'promo' && promoCode && !targetBrand) {
        const matchedPromo = promos.find(p => p.code && p.code.toUpperCase() === promoCode);
        if (matchedPromo && matchedPromo.targetBrand && matchedPromo.targetBrand !== 'all') {
            targetBrand = matchedPromo.targetBrand;
        }
    }

    const slotObj = {
        text,
        type,
        promoCode: type === 'promo' ? promoCode : '',
        targetBrand: (type === 'promo' || type === 'product') ? targetBrand : '',
        newsIndex: type === 'news' ? newsIndex : -1
    };

    if (editIdx >= 0 && editIdx < list.length) {
        list[editIdx] = slotObj;
    } else {
        if (list.length >= 20) {
            window.customAlert('Batas 20 Teks', 'Maksimal 20 teks running text.', 'warning');
            return;
        }
        list.push(slotObj);
    }

    siteSettings.marqueeList = list;
    siteSettings.marquee = list.map(i => i.text).join(' || ');
    const fallbackInp = document.getElementById('set-marquee');
    if (fallbackInp) fallbackInp.value = siteSettings.marquee;

    await setDoc(doc(db, pathSettings, 'mainConfig'), {
        marqueeList: list,
        marquee: siteSettings.marquee
    }, { merge: true }).catch(() => {});

    window.closeMarqueeSlotForm();
    window.renderMarqueeStudioSlots();
    window.showToast('Tersimpan', `Daftar running text (${list.length}/20) berhasil diperbarui.`, 'success');
};

window.deleteMarqueeSlotItem = async function(idx) {
    const list = [...ensureMarqueeListInitialized()];
    list.splice(idx, 1);
    siteSettings.marqueeList = list;
    siteSettings.marquee = list.map(i => i.text).join(' || ');

    await setDoc(doc(db, pathSettings, 'mainConfig'), {
        marqueeList: list,
        marquee: siteSettings.marquee
    }, { merge: true }).catch(() => {});

    window.renderMarqueeStudioSlots();
    window.showToast('Dihapus', 'Pesan running text telah dihapus.', 'info');
};

window.renderMarqueeStudioSlots = function() {
    const container = document.getElementById('marquee-slots-container');
    const countBadge = document.getElementById('marquee-slot-count-badge');
    const btnAdd = document.getElementById('btn-add-marquee-slot');
    if (!container) return;

    const list = ensureMarqueeListInitialized();
    if (countBadge) countBadge.innerText = `${list.length}/20`;
    if (btnAdd) btnAdd.disabled = list.length >= 20;

    if (list.length === 0) {
        container.innerHTML = `<div class="info-box text-center text-muted grid-span-full">Belum ada pesan running text.</div>`;
        return;
    }

    let html = '';
    list.forEach((slot, idx) => {
        let actionBadge = `<span class="status-badge status-anon">INFO</span>`;
        let targetDetail = 'Membuka Tab Berita';

        if (slot.type === 'promo' || slot.promoCode) {
            actionBadge = `<span class="status-badge status-vip">PROMO: ${window.escapeHtml(slot.promoCode || '-')}</span>`;
            targetDetail = `Kode <b>${window.escapeHtml(slot.promoCode)}</b> &bull; Produk: <b>${window.escapeHtml(slot.targetBrand || 'Semua')}</b>`;
        } else if (slot.type === 'product' && slot.targetBrand) {
            actionBadge = `<span class="status-badge status-success">PRODUK: ${window.escapeHtml(slot.targetBrand)}</span>`;
            targetDetail = `Membuka produk <b>${window.escapeHtml(slot.targetBrand)}</b>`;
        } else if (slot.type === 'news') {
            actionBadge = `<span class="status-badge status-pending">BERITA #${(slot.newsIndex >= 0 ? slot.newsIndex + 1 : 1)}</span>`;
            targetDetail = `Membaca Berita #${(slot.newsIndex >= 0 ? slot.newsIndex + 1 : 1)}`;
        }

        html += `
        <div class="marquee-slot-card">
            <div>
                <div class="marquee-slot-head mb-2">
                    <span class="marquee-slot-num">PESAN #${idx + 1}</span>
                    ${actionBadge}
                </div>
                <div class="fw-bold text-dark text-sm mb-1">"${window.escapeHtml(slot.text)}"</div>
                <div class="text-xs text-muted">${targetDetail}</div>
            </div>
            <div class="flex-gap mt-2">
                <button type="button" class="btn btn-outline btn-sm flex-1" onclick="window.openMarqueeSlotForm(${idx})">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button type="button" class="btn btn-danger btn-sm" onclick="window.deleteMarqueeSlotItem(${idx})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

// ==========================================
// STUDIO RUNNING TEXT BAWAH (GAYA KELOLA SAMA PERSIS DENGAN RUNNING TEXT ATAS #2)
// ==========================================
function ensureFooterMarqueeListInitialized() {
    if (!Array.isArray(siteSettings.footerMarqueeList) || siteSettings.footerMarqueeList.length === 0) {
        const raw = String(
            siteSettings.footerMarquee ||
            'TERIMA KASIH TELAH BERBELANJA DI VIPERCELL — LAYANAN APLIKASI PREMIUM, TOP UP GAME & PRODUK DIGITAL || TRANSAKSI OTOMATIS & BERGARANSI — HUBUNGI CS BANTUAN JIKA BUTUH PANDUAN'
        ).trim();
        const parts = raw.includes('||') ? raw.split('||') : raw.split(/\r?\n/);
        siteSettings.footerMarqueeList = parts.map(s => s.trim()).filter(Boolean).slice(0, 20).map(txt => ({
            text: txt,
            type: 'info',
            promoCode: '',
            targetBrand: '',
            newsIndex: 0
        }));
    } else {
        siteSettings.footerMarqueeList = siteSettings.footerMarqueeList.map(item => {
            if (typeof item === 'string') {
                return { text: item.trim(), type: 'info', promoCode: '', targetBrand: '', newsIndex: 0 };
            }
            return {
                text: String(item?.text || '').trim(),
                type: item?.type || 'info',
                promoCode: item?.promoCode || '',
                targetBrand: item?.targetBrand || '',
                newsIndex: typeof item?.newsIndex === 'number' ? item.newsIndex : 0
            };
        }).filter(it => it.text);
    }
    return siteSettings.footerMarqueeList;
}

function populateFooterMarqueeSelectors() {
    const brandSel = document.getElementById('fmq-slot-brand');
    if (brandSel) {
        let bHtml = '<option value="">-- Otomatis Sesuai Promo / Katalog --</option>';
        groupedBrands.forEach(b => {
            bHtml += `<option value="${window.escapeHtml(b.brandName)}">${window.escapeHtml(b.brandName)}</option>`;
        });
        brandSel.innerHTML = bHtml;
    }

    const newsSel = document.getElementById('fmq-slot-news');
    if (newsSel) {
        const newsArr = siteSettings.newsList || [];
        if (newsArr.length === 0) {
            newsSel.innerHTML = '<option value="0">Tab Berita</option>';
        } else {
            newsSel.innerHTML = newsArr.map((n, idx) => `<option value="${idx}">#${idx + 1}: ${window.escapeHtml(n.title || 'Berita')}</option>`).join('');
        }
    }
}

window.toggleFooterMarqueeSlotActionFields = function() {
    const type = document.getElementById('fmq-slot-type')?.value || 'info';
    const promoField = document.getElementById('fmq-field-promo');
    const brandField = document.getElementById('fmq-field-brand');
    const newsField = document.getElementById('fmq-field-news');

    if (promoField) promoField.style.display = (type === 'promo') ? 'block' : 'none';
    if (brandField) brandField.style.display = (type === 'promo' || type === 'product') ? 'block' : 'none';
    if (newsField) newsField.style.display = (type === 'news') ? 'block' : 'none';
};

window.openFooterMarqueeSlotForm = function(editIdx = -1) {
    const list = ensureFooterMarqueeListInitialized();
    if (editIdx === -1 && list.length >= 20) {
        window.customAlert('Maksimal 20 Teks', 'Running Text Bawah mendukung maksimal 20 teks berjalan.', 'warning');
        return;
    }

    populateFooterMarqueeSelectors();
    const editor = document.getElementById('footer-marquee-slot-editor');
    const titleEl = document.getElementById('footer-marquee-editor-title');
    document.getElementById('edit-footer-marquee-idx').value = String(editIdx);

    if (editIdx >= 0 && editIdx < list.length) {
        const item = list[editIdx];
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-pen text-warning"></i> Edit Pesan Running Bawah #${editIdx + 1}`;
        document.getElementById('fmq-slot-text').value = item.text || '';
        document.getElementById('fmq-slot-type').value = item.type || 'info';
        document.getElementById('fmq-slot-promo').value = item.promoCode || '';
        document.getElementById('fmq-slot-brand').value = item.targetBrand || '';
        document.getElementById('fmq-slot-news').value = String(typeof item.newsIndex === 'number' ? item.newsIndex : 0);
    } else {
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-plus text-primary"></i> Tambah Pesan Running Bawah (#${list.length + 1})`;
        document.getElementById('fmq-slot-text').value = '';
        document.getElementById('fmq-slot-type').value = 'info';
        document.getElementById('fmq-slot-promo').value = '';
        document.getElementById('fmq-slot-brand').value = '';
        document.getElementById('fmq-slot-news').value = '0';
    }

    window.toggleFooterMarqueeSlotActionFields();
    if (editor) editor.style.display = 'block';
    document.getElementById('fmq-slot-text')?.focus();
};

window.closeFooterMarqueeSlotForm = function() {
    const editor = document.getElementById('footer-marquee-slot-editor');
    if (editor) editor.style.display = 'none';
};

window.saveFooterMarqueeSlotItem = async function() {
    const list = [...ensureFooterMarqueeListInitialized()];
    const editIdx = parseInt(document.getElementById('edit-footer-marquee-idx').value || '-1', 10);
    const text = document.getElementById('fmq-slot-text').value.trim();
    const type = document.getElementById('fmq-slot-type').value;
    const promoCode = (document.getElementById('fmq-slot-promo').value || '').trim().toUpperCase();
    let targetBrand = document.getElementById('fmq-slot-brand').value;
    const newsIndex = parseInt(document.getElementById('fmq-slot-news').value || '0', 10);

    if (!text) {
        window.customAlert('Teks Kosong', 'Masukkan isi pesan running text bawah terlebih dahulu.', 'warning');
        return;
    }

    if (type === 'promo' && promoCode && !targetBrand) {
        const matchedPromo = promos.find(p => p.code && p.code.toUpperCase() === promoCode);
        if (matchedPromo && matchedPromo.targetBrand && matchedPromo.targetBrand !== 'all') {
            targetBrand = matchedPromo.targetBrand;
        }
    }

    const slotObj = {
        text,
        type,
        promoCode: type === 'promo' ? promoCode : '',
        targetBrand: (type === 'promo' || type === 'product') ? targetBrand : '',
        newsIndex: type === 'news' ? newsIndex : -1
    };

    if (editIdx >= 0 && editIdx < list.length) {
        list[editIdx] = slotObj;
    } else {
        if (list.length >= 20) {
            window.customAlert('Batas 20 Teks', 'Maksimal 20 teks running text bawah.', 'warning');
            return;
        }
        list.push(slotObj);
    }

    siteSettings.footerMarqueeList = list;
    siteSettings.footerMarquee = list.map(i => i.text).join(' || ');
    const fallbackInp = document.getElementById('set-footer-marquee');
    if (fallbackInp) fallbackInp.value = siteSettings.footerMarquee;

    await setDoc(doc(db, pathSettings, 'mainConfig'), {
        footerMarqueeList: list,
        footerMarquee: siteSettings.footerMarquee
    }, { merge: true }).catch(() => {});

    window.closeFooterMarqueeSlotForm();
    window.renderFooterMarqueeStudioSlots();
    window.showToast('Tersimpan', `Daftar running text bawah (${list.length}/20) berhasil diperbarui.`, 'success');
};

window.deleteFooterMarqueeSlotItem = async function(idx) {
    const list = [...ensureFooterMarqueeListInitialized()];
    list.splice(idx, 1);
    siteSettings.footerMarqueeList = list;
    siteSettings.footerMarquee = list.map(i => i.text).join(' || ');
    const fallbackInp = document.getElementById('set-footer-marquee');
    if (fallbackInp) fallbackInp.value = siteSettings.footerMarquee;

    await setDoc(doc(db, pathSettings, 'mainConfig'), {
        footerMarqueeList: list,
        footerMarquee: siteSettings.footerMarquee
    }, { merge: true }).catch(() => {});

    window.renderFooterMarqueeStudioSlots();
    window.showToast('Dihapus', 'Pesan running text bawah telah dihapus.', 'info');
};

window.renderFooterMarqueeStudioSlots = function() {
    const container = document.getElementById('footer-marquee-slots-container');
    const countBadge = document.getElementById('footer-marquee-slot-count-badge');
    const btnAdd = document.getElementById('btn-add-footer-marquee-slot');
    if (!container) return;

    const list = ensureFooterMarqueeListInitialized();
    if (countBadge) countBadge.innerText = `${list.length}/20`;
    if (btnAdd) btnAdd.disabled = list.length >= 20;

    if (list.length === 0) {
        container.innerHTML = `<div class="info-box text-center text-muted grid-span-full">Belum ada pesan running text bawah.</div>`;
        return;
    }

    let html = '';
    list.forEach((slot, idx) => {
        let actionBadge = `<span class="status-badge status-anon">INFO</span>`;
        let targetDetail = 'Membuka Katalog';

        if (slot.type === 'promo' || slot.promoCode) {
            actionBadge = `<span class="status-badge status-vip">PROMO: ${window.escapeHtml(slot.promoCode || '-')}</span>`;
            targetDetail = `Kode <b>${window.escapeHtml(slot.promoCode)}</b> &bull; Produk: <b>${window.escapeHtml(slot.targetBrand || 'Semua')}</b>`;
        } else if (slot.type === 'product' && slot.targetBrand) {
            actionBadge = `<span class="status-badge status-success">PRODUK: ${window.escapeHtml(slot.targetBrand)}</span>`;
            targetDetail = `Membuka produk <b>${window.escapeHtml(slot.targetBrand)}</b>`;
        } else if (slot.type === 'news') {
            actionBadge = `<span class="status-badge status-pending">BERITA #${(slot.newsIndex >= 0 ? slot.newsIndex + 1 : 1)}</span>`;
            targetDetail = `Membaca Berita #${(slot.newsIndex >= 0 ? slot.newsIndex + 1 : 1)}`;
        }

        html += `
        <div class="marquee-slot-card">
            <div>
                <div class="marquee-slot-head mb-2">
                    <span class="marquee-slot-num">TEKS BAWAH #${idx + 1}</span>
                    ${actionBadge}
                </div>
                <div class="fw-bold text-dark text-sm mb-1">"${window.escapeHtml(slot.text)}"</div>
                <div class="text-xs text-muted">${targetDetail}</div>
            </div>
            <div class="flex-gap mt-2">
                <button type="button" class="btn btn-outline btn-sm flex-1" onclick="window.openFooterMarqueeSlotForm(${idx})">
                    <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button type="button" class="btn btn-danger btn-sm" onclick="window.deleteFooterMarqueeSlotItem(${idx})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

// ==========================================
// PENGATURAN TOKO & JAM OPERASIONAL (#18 & #20)
// ==========================================
window.populateSettingsForm = function() {
    const storeOpenEl = document.getElementById('set-store-open');
    if (storeOpenEl) storeOpenEl.checked = siteSettings.isStoreOpen !== false;
    updateTopbarStoreStatusUI();

    const anonToggle = document.getElementById('set-anon-autodelete-6h');
    if (anonToggle) anonToggle.checked = siteSettings.anonAutoDelete6h !== false;

    const waterToggle = document.getElementById('set-water-ripple');
    if (waterToggle) waterToggle.checked = siteSettings.waterRippleEnabled !== false;

    // Jam Operasional Toko (#4 & #5)
    const opHoursToggle = document.getElementById('set-op-hours-enabled');
    const opOpenInp = document.getElementById('set-op-open-time');
    const opCloseInp = document.getElementById('set-op-close-time');

    if (opHoursToggle) opHoursToggle.checked = Boolean(siteSettings.opHoursEnabled);
    if (opOpenInp) opOpenInp.value = siteSettings.opOpenTime || '08:00';
    if (opCloseInp) opCloseInp.value = siteSettings.opCloseTime || '22:00';
    window.updateOpHoursAdminPreview();

    document.getElementById('set-logo-text').value = siteSettings.logoText || 'VIPER';
    document.getElementById('set-logo-accent').value = siteSettings.logoAccent || 'CELL';
    document.getElementById('set-marquee').value = siteSettings.marquee || '';
    const footerMarqueeEl = document.getElementById('set-footer-marquee');
    if (footerMarqueeEl) {
        footerMarqueeEl.value = siteSettings.footerMarquee || 'TERIMA KASIH TELAH BERBELANJA DI VIPERCELL — LAYANAN APLIKASI PREMIUM, TOP UP GAME & PRODUK DIGITAL || TRANSAKSI OTOMATIS & BERGARANSI — HUBUNGI CS BANTUAN JIKA BUTUH PANDUAN';
    }
    document.getElementById('set-wa').value = siteSettings.adminWa || '';
    document.getElementById('set-wa-channel').value = siteSettings.waChannelLink || '';
    document.getElementById('set-ig').value = siteSettings.igLink || '';
    document.getElementById('set-tt').value = siteSettings.ttLink || '';
    document.getElementById('set-qris-data').value = siteSettings.qrisStringData || '';
    document.getElementById('set-email-webhook').value = siteSettings.emailWebhookUrl || '';
    document.getElementById('set-webhook-secret').value = siteSettings.webhookSecret || 'VIPERCELL_SECRET_2026';

    tempLogoBase64 = siteSettings.logoImgBase64 || '';
    const prevLogo = document.getElementById('preview-logo');
    const btnDelLogo = document.getElementById('btn-del-logo');
    if (tempLogoBase64 && prevLogo) {
        prevLogo.src = tempLogoBase64;
        prevLogo.style.display = 'block';
        if (btnDelLogo) btnDelLogo.style.display = 'inline-flex';
    } else if (prevLogo) {
        prevLogo.style.display = 'none';
        if (btnDelLogo) btnDelLogo.style.display = 'none';
    }

    tempPwaIconBase64 = siteSettings.pwaIconBase64 || '';
    const prevPwa = document.getElementById('preview-pwa-icon');
    const btnDelPwa = document.getElementById('btn-del-pwa-icon');
    if (tempPwaIconBase64 && prevPwa) {
        prevPwa.src = tempPwaIconBase64;
        prevPwa.style.display = 'block';
        if (btnDelPwa) btnDelPwa.style.display = 'inline-flex';
    } else if (prevPwa) {
        prevPwa.style.display = 'none';
        if (btnDelPwa) btnDelPwa.style.display = 'none';
    }

    const qrisStatus = document.getElementById('qris-status-text');
    if (qrisStatus) {
        qrisStatus.innerHTML = siteSettings.qrisStringData
            ? '<span class="text-success fw-bold"><i class="fa-solid fa-circle-check"></i> String QRIS Aktif</span>'
            : 'Belum ada string QRIS';
    }

    window.renderMarqueeStudioSlots();
    window.renderFooterMarqueeStudioSlots();
    window.renderAdminBanners();
};

function compressImageToBase64(file, maxWidth = 600, quality = 0.78) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width;
                let h = img.height;
                if (w > maxWidth) {
                    h = Math.round((h * maxWidth) / w);
                    w = maxWidth;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/webp', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

window.previewManageImg = async function(input) {
    if (!input.files || !input.files[0]) return;
    tempManageImgBase64 = await compressImageToBase64(input.files[0], 300, 0.8);
    const prev = document.getElementById('preview-manage-img');
    if (prev) {
        prev.src = tempManageImgBase64;
        prev.style.display = 'block';
    }
};

window.uploadLogoImg = async function(input) {
    if (!input.files || !input.files[0]) return;
    tempLogoBase64 = await compressImageToBase64(input.files[0], 250, 0.85);
    const prev = document.getElementById('preview-logo');
    if (prev) { prev.src = tempLogoBase64; prev.style.display = 'block'; }
    document.getElementById('btn-del-logo').style.display = 'inline-flex';
};

window.removeLogoImg = function() {
    tempLogoBase64 = '';
    document.getElementById('preview-logo').style.display = 'none';
    document.getElementById('btn-del-logo').style.display = 'none';
};

window.uploadPwaIconImg = async function(input) {
    if (!input.files || !input.files[0]) return;
    tempPwaIconBase64 = await compressImageToBase64(input.files[0], 512, 0.88);
    const prev = document.getElementById('preview-pwa-icon');
    if (prev) { prev.src = tempPwaIconBase64; prev.style.display = 'block'; }
    document.getElementById('btn-del-pwa-icon').style.display = 'inline-flex';
};

window.removePwaIconImg = function() {
    tempPwaIconBase64 = '';
    document.getElementById('preview-pwa-icon').style.display = 'none';
    document.getElementById('btn-del-pwa-icon').style.display = 'none';
};

window.uploadBannerImg = async function(input) {
    if (!input.files || !input.files[0]) return;
    const b64 = await compressImageToBase64(input.files[0], 900, 0.8);
    const banners = [...(siteSettings.banners || []), b64];
    siteSettings.banners = banners;
    window.renderAdminBanners();
};

window.renderAdminBanners = function() {
    const grid = document.getElementById('admin-banner-list');
    if (!grid) return;
    const banners = siteSettings.banners || [];
    if (banners.length === 0) {
        grid.innerHTML = '<div class="text-xs text-muted">Belum ada banner.</div>';
        return;
    }
    grid.innerHTML = banners.map((b, idx) => `
        <div class="banner-admin-item">
            <img src="${b}" alt="Banner ${idx}">
            <button type="button" class="btn btn-danger btn-sm" style="position:absolute; top:6px; right:6px; padding:4px 8px;" onclick="window.removeBannerItem(${idx})">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');
};

window.removeBannerItem = function(idx) {
    siteSettings.banners.splice(idx, 1);
    window.renderAdminBanners();
};

window.decodeQRISImage = function(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code && code.data) {
                    document.getElementById('set-qris-data').value = code.data;
                    document.getElementById('qris-status-text').innerHTML = '<span class="text-success fw-bold"><i class="fa-solid fa-circle-check"></i> QRIS Terbaca</span>';
                    window.showToast('Berhasil', 'String QRIS berhasil diekstrak dari gambar.', 'success');
                } else {
                    window.customAlert('Gagal Membaca QR', 'Pastikan gambar kode QRIS terlihat jelas.', 'warning');
                }
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
};

window.testEmailWebhookConnection = async function() {
    const url = document.getElementById('set-email-webhook').value.trim();
    const secret = document.getElementById('set-webhook-secret').value.trim();
    if (!url) {
        window.customAlert('URL Kosong', 'Masukkan URL Google Apps Script terlebih dahulu.', 'warning');
        return;
    }

    siteSettings.emailWebhookUrl = url;
    siteSettings.webhookSecret = secret || 'VIPERCELL_SECRET_2026';

    const targetEmail = currentAdminUser?.email || 'miler.teves@gmail.com';
    window.showToast('Menguji...', `Mengirim email tes ke ${targetEmail}...`, 'info');

    try {
        await callUnifiedGasWebhook({
            action: 'SEND_ORDER_DELIVERY',
            orderId: 'VP-TEST-' + Math.floor(1000 + Math.random() * 8999),
            invoice: 'VP-TEST',
            email: targetEmail,
            buyerEmail: targetEmail,
            buyerName: 'Admin Vipercell',
            itemName: 'Tes Pengiriman Email Vipercell',
            productName: 'Tes Koneksi Email',
            variantName: 'Tes',
            totalAmount: 15000,
            totalFormatted: 'Rp 15.000',
            accountDetails: '[PRODUK EMAIL]\nFORMAT_UTUH : demo@outlook.com|Pass123!|M.C542_TOKEN|9e5f94bc-client-id\nEmail : demo@outlook.com\nPassword : Pass123!',
            targetId: 'Admin'
        });
        window.customAlert(
            'Tes Email Berhasil',
            `Email percobaan telah dikirim ke <b>${window.escapeHtml(targetEmail)}</b>.`,
            'success'
        );
    } catch (err) {
        window.customAlert('Tes Gagal', `${window.escapeHtml(err.message)}`, 'error');
    }
};

window.saveSiteSettings = async function() {
    const btn = document.getElementById('btn-save-settings');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;

    const marqueeListClean = ensureMarqueeListInitialized().slice(0, 20);
    const combinedMarqueeText = marqueeListClean.length > 0
        ? marqueeListClean.map(i => i.text).join(' || ')
        : document.getElementById('set-marquee').value.trim();

    const updated = {
        isStoreOpen: document.getElementById('set-store-open').checked,
        anonAutoDelete6h: document.getElementById('set-anon-autodelete-6h') ? document.getElementById('set-anon-autodelete-6h').checked : true,
        waterRippleEnabled: document.getElementById('set-water-ripple') ? document.getElementById('set-water-ripple').checked : true,
        // Pengaturan Jam Operasional Toko (#4 & #5)
        opHoursEnabled: Boolean(document.getElementById('set-op-hours-enabled')?.checked),
        opOpenTime: document.getElementById('set-op-open-time')?.value || '08:00',
        opCloseTime: document.getElementById('set-op-close-time')?.value || '22:00',
        logoText: document.getElementById('set-logo-text').value.trim() || 'VIPER',
        logoAccent: document.getElementById('set-logo-accent').value.trim() || 'CELL',
        marquee: combinedMarqueeText,
        marqueeList: marqueeListClean,
        footerMarquee: ensureFooterMarqueeListInitialized().length > 0
            ? ensureFooterMarqueeListInitialized().map(i => i.text).join(' || ')
            : ((document.getElementById('set-footer-marquee')?.value || '').trim() || 'TERIMA KASIH TELAH BERBELANJA DI VIPERCELL — LAYANAN APLIKASI PREMIUM, TOP UP GAME & PRODUK DIGITAL'),
        footerMarqueeList: ensureFooterMarqueeListInitialized().slice(0, 20),
        adminWa: document.getElementById('set-wa').value.trim(),
        waChannelLink: document.getElementById('set-wa-channel').value.trim(),
        igLink: document.getElementById('set-ig').value.trim(),
        ttLink: document.getElementById('set-tt').value.trim(),
        qrisStringData: document.getElementById('set-qris-data').value.trim(),
        emailWebhookUrl: document.getElementById('set-email-webhook').value.trim(),
        webhookSecret: document.getElementById('set-webhook-secret').value.trim() || 'VIPERCELL_SECRET_2026',
        logoImgBase64: tempLogoBase64,
        pwaIconBase64: tempPwaIconBase64,
        banners: siteSettings.banners || []
    };

    try {
        await setDoc(doc(db, pathSettings, 'mainConfig'), updated, { merge: true });
        siteSettings = { ...siteSettings, ...updated };
        updateTopbarStoreStatusUI();
        window.updateOpHoursAdminPreview();
        applyCustomAdminPwaIcon();
        window.showToast('Tersimpan', 'Pengaturan toko berhasil disimpan.', 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan pengaturan toko.', 'error');
    } finally {
        btn.innerHTML = ogHtml;
        btn.disabled = false;
    }
};

window.exportMembersCSV = function() {
    if (allUsersList.length === 0) {
        window.customAlert('Data Kosong', 'Belum ada data pengguna untuk diekspor.', 'warning');
        return;
    }
    const headers = ['UID', 'Nama', 'Tipe Akun', 'Email', 'Nomor WhatsApp', 'Device ID', 'Status Blokir', 'Tanggal Bergabung'];
    const rows = allUsersList.map(u => {
        const isAnon = Boolean(u.isAnonymous || u.isGuest || u.role === 'anonymous');
        return [
            u.uid || '-',
            `"${(u.name || 'Tamu').replace(/"/g, '""')}"`,
            isAnon ? 'TAMU' : 'MEMBER',
            u.email || '-',
            u.phone || u.whatsapp || '-',
            u.deviceId || '-',
            u.isBlocked ? 'DIBLOKIR' : 'AKTIF',
            u.createdAt ? new Date(u.createdAt).toLocaleString('id-ID') : '-'
        ].join(',');
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Data_Pelanggan_Vipercell_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.showToast('Diunduh', 'File CSV daftar pelanggan berhasil diunduh.', 'success');
};

// ==========================================
// POP-UP MODALS & NOTIFIKASI KECIL (#15 & #19)
// ==========================================
window.openModal = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('active');
        if (el.classList.contains('modal-overlay')) {
            document.body.classList.add('no-scroll');
        }
    }
};

window.closeModal = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('active');
        const anyOpen = document.querySelector('.modal-overlay.active');
        if (!anyOpen) {
            document.body.classList.remove('no-scroll');
        }
    }
};

window.customAlert = function(title, desc, type = 'info') {
    document.getElementById('ca-title').innerText = title;
    document.getElementById('ca-desc').innerHTML = desc;
    const icon = document.getElementById('ca-icon');
    icon.className = `msg-icon ${type}`;
    icon.innerHTML = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' :
                     type === 'error' ? '<i class="fa-solid fa-circle-xmark"></i>' :
                     type === 'warning' ? '<i class="fa-solid fa-triangle-exclamation"></i>' :
                     '<i class="fa-solid fa-circle-info"></i>';
    document.getElementById('custom-alert').classList.add('active');
};

window.closeAlert = function() {
    document.getElementById('custom-alert').classList.remove('active');
};

let confirmCallback = null;
window.openConfirm = function(title, desc, callback, type = 'delete') {
    document.getElementById('mc-title').innerText = title;
    document.getElementById('mc-desc').innerHTML = desc;
    const btn = document.getElementById('mc-confirm-btn');
    if (btn) {
        btn.className = type === 'success' ? 'btn btn-success btn-sm flex-1' : 'btn btn-danger btn-sm flex-1';
    }
    confirmCallback = callback;
    document.getElementById('modal-confirm').classList.add('active');
};

window.resolveConfirm = function(res) {
    document.getElementById('modal-confirm').classList.remove('active');
    if (confirmCallback) confirmCallback(res);
};

window.showToast = function(title, msg, type = 'info', actionCallback = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-xmark"></i>';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <h4>${window.escapeHtml(title)}</h4>
            <p>${window.escapeHtml(msg)}</p>
        </div>
        <div class="toast-progress-bar"></div>
    `;

    let autoRemoveTimer = null;
    const dismissToast = () => {
        if (autoRemoveTimer) clearTimeout(autoRemoveTimer);
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 200);
    };

    toast.addEventListener('click', () => {
        if (actionCallback) actionCallback();
        dismissToast();
    });

    toast.style.cursor = 'pointer';
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    autoRemoveTimer = setTimeout(() => {
        if (document.body.contains(toast)) {
            dismissToast();
        }
    }, 3400);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
    initAdminApp();
}