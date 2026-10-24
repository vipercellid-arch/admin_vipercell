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
const pathDigiflazzCatalog = isWorkspace ? `artifacts/${appId}/public/data/digiflazz_catalog` : 'digiflazz_catalog';
const pathDigiflazzDeposits = isWorkspace ? `artifacts/${appId}/public/data/digiflazz_deposits` : 'digiflazz_deposits';
const pathBalanceLogs = isWorkspace ? `artifacts/${appId}/public/data/balance_logs` : 'balance_logs';

const fallbackSettingsPath = isWorkspace ? 'settings' : `artifacts/${appId}/public/data/settings`;

// Durasi pembersihan otomatis akun tamu 6 jam
const ANON_AUTO_DELETE_TTL_MS = 6 * 60 * 60 * 1000;
// Durasi pembersihan otomatis log mutasi Firebase setiap 1 jam (v27.9)
const MUTATION_AUTO_CLEAN_1H_MS = 60 * 60 * 1000;

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
let recentMutationsList = [];
let digiflazzCatalogList = [];
let digiflazzDepositsList = [];
let balanceLogsList = [];
let currentAdminBalanceSubTab = 'requests';
let currentAdminTopupOrderFilter = 'ALL';
let currentDigiflazzSubTab = 'catalog';
let currentDigiflazzTrxFilter = 'ALL';
let lastDigiflazzPriceSyncMs = 0;
let currentFinancialSourceFilter = 'ALL';
let currentFinancialPeriodFilter = 'ALL';
let pendingAdminPinCallback = null;
const processedAdminMutationIds = new Set();
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
    // Pengaturan Jam Operasional Toko
    opHoursEnabled: false,
    opOpenTime: '08:00',
    opCloseTime: '22:00',
    waterRippleEnabled: false,
    footerMarqueeShowPrice: true,
    footerMarqueeShowStatus: true,
    footerMarqueeSpeed: 'normal',
    deletedUids: [],
    blockedUids: [],
    blockedDevices: [],
    digiflazzBridgeUrl: 'http://139.59.60.91:3100',
    digiflazzUsername: '',
    digiflazzApiKey: '',
    digiflazzDevApiKey: '',
    digiflazzProdApiKey: '',
    digiflazzWebhookSecret: 'VIPERCELL_DF_WEBHOOK_2026',
    digiflazzEnvMode: 'development',
    digiflazzAutoHitOnPaid: true,
    digiflazzBalanceGuard: true,
    digiflazzMarkupType: 'smart_tiered',
    digiflazzMarkupValue: 1500,
    digiflazzMarkupMinRp: 1000,
    digiflazzMarkupRound: '100',
    digiflazzMarkupMemberPlusDisc: 35,
    digiflazzTier1: 1200,
    digiflazzTier2: 2000,
    digiflazzTier3: 3500,
    digiflazzTier4Pct: 2.5,
    digiflazzLastBalance: 0,
    adminSecurityPin: '',
    requireAdminPin: true,
    memberPlusEnabled: true,
    memberPlusMonthlyPrice: 25000,
    memberPlusLocalDiscountPct: 5,
    memberPlusTagline: 'Harga lebih hemat di semua produk, akses voucher eksklusif Member Plus, dan prioritas layanan.'
};

let currentOrderFilter = 'ALL';
let currentStockFilter = 'READY';
let currentMemberFilter = 'ALL';
let activeAdminChatId = null;

// State Hierarki Cek & Tambah Stok
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
let mutationOneHourAutoCleanInterval = null;
let adminWelcomeClockInterval = null;
let lastAdminTopMarqueeSig = '';

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
// EFEK SENTUHAN AIR BERWARNA / WATER RIPPLE CANVAS
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

function spawnAdminWaterRippleAt(clientX, clientY, isClick = false) {
    if (siteSettings.waterRippleEnabled === false) return;
    try {
        const hitEl = document.elementFromPoint(clientX, clientY);
        if (hitEl && hitEl.closest('footer, .admin-footer-neo, .admin-topbar, .admin-sidebar')) {
            return;
        }
    } catch (_) {}
    const canvas = waterRippleEngine.canvas || document.getElementById('water-ripple-canvas');
    if (!canvas) return;
    if (!waterRippleEngine.ctx) {
        waterRippleEngine.canvas = canvas;
        waterRippleEngine.ctx = canvas.getContext('2d');
    }
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const palette = isDark ? DARK_RIPPLE_COLORS : LIGHT_RIPPLE_COLORS;
    const colorPrefix = palette[Math.floor(Math.random() * palette.length)];

    if (waterRippleEngine.ripples.length > 26) {
        waterRippleEngine.ripples.shift();
    }

    waterRippleEngine.ripples.push({
        x: clientX,
        y: clientY,
        radius: isClick ? 4 : 2,
        maxRadius: isClick ? (74 + Math.random() * 40) : (42 + Math.random() * 24),
        speed: isClick ? 2.3 : 1.7,
        alpha: isClick ? 0.55 : 0.34,
        lineWidth: isClick ? 2.4 : 1.7,
        colorPrefix: colorPrefix,
        secondRing: isClick
    });

    if (!waterRippleEngine.animFrameId) {
        waterRippleEngine.animFrameId = requestAnimationFrame(renderWaterRipplesLoop);
    }
}

function initWaterRippleBackground() {
    const canvas = document.getElementById('water-ripple-canvas');
    if (!canvas) return;
    waterRippleEngine.canvas = canvas;
    waterRippleEngine.ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
        canvas.width = window.innerWidth || document.documentElement.clientWidth || 360;
        canvas.height = window.innerHeight || document.documentElement.clientHeight || 640;
    };
    resizeCanvas();

    if (!waterRippleEngine.initialized) {
        waterRippleEngine.initialized = true;
        window.addEventListener('resize', resizeCanvas, { passive: true });
        window.addEventListener('pointerdown', (e) => {
            if (siteSettings.waterRippleEnabled === false) return;
            spawnAdminWaterRippleAt(e.clientX, e.clientY, true);
        }, { passive: true });
        window.addEventListener('pointermove', (e) => {
            if (siteSettings.waterRippleEnabled === false) return;
            const now = performance.now();
            if (now - waterRippleEngine.lastMoveTime < 60) return;
            waterRippleEngine.lastMoveTime = now;
            spawnAdminWaterRippleAt(e.clientX, e.clientY, false);
        }, { passive: true });
        window.addEventListener('touchstart', (e) => {
            if (siteSettings.waterRippleEnabled === false) return;
            const t = e.touches && e.touches[0];
            if (t) spawnAdminWaterRippleAt(t.clientX, t.clientY, true);
        }, { passive: true });
    }
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
// PINTASAN BUKA / TUTUP TOKO DI TOPBAR
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
// JAM OPERASIONAL TOKO PREVIEW
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
        badgeEl.innerHTML = `<i class="fa-regular fa-clock"></i> Di Luar Jam Layanan (Hanya Stok Lokal Otomatis)`;
    } else if (opEnabled) {
        badgeEl.className = 'status-badge status-success';
        badgeEl.innerHTML = `<i class="fa-regular fa-clock"></i> Jam Layanan Aktif (${openTime} - ${closeTime})`;
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
        try {
            const secretSnap = await getDoc(doc(db, pathSettings, 'secretConfig'));
            if (secretSnap && secretSnap.exists()) {
                const secData = secretSnap.data();
                siteSettings = { ...siteSettings, ...secData };
                const u = (secData.digiflazzUsername || siteSettings.digiflazzUsername || '').trim();
                const dKey = (secData.digiflazzDevApiKey || siteSettings.digiflazzDevApiKey || secData.digiflazzApiKey || '').trim();
                const pKey = (secData.digiflazzProdApiKey || siteSettings.digiflazzProdApiKey || '').trim();
                const mMode = secData.digiflazzEnvMode || siteSettings.digiflazzEnvMode || 'development';
                if (u && (dKey || pKey)) {
                    const syncPayload = JSON.stringify({
                        u: u,
                        d: dKey,
                        p: pKey,
                        m: mMode,
                        s: secData.digiflazzWebhookSecret || siteSettings.digiflazzWebhookSecret || 'VIPERCELL_DF_WEBHOOK_2026'
                    });
                    const tokenStr = btoa(unescape(encodeURIComponent(syncPayload)));
                    siteSettings.digiflazzBridgeSyncToken = tokenStr;
                    setDoc(doc(db, pathSettings, 'mainConfig'), {
                        digiflazzUsername: u,
                        digiflazzDevApiKey: dKey,
                        digiflazzProdApiKey: pKey,
                        digiflazzApiKey: mMode === 'production' ? (pKey || dKey) : (dKey || pKey),
                        digiflazzEnvMode: mMode,
                        digiflazzBridgeSyncToken: tokenStr
                    }, { merge: true }).catch(() => {});
                }
            }
        } catch (e) {}
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
    }, 7500);

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
            if (typeof window.updateAdminWelcomeHeroUI === 'function') window.updateAdminWelcomeHeroUI(user);
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

    if (tabId === 'tab-balance') {
        if (typeof window.renderAdminBalanceTab === 'function') window.renderAdminBalanceTab();
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
        window.refreshAdminControlCenterUI();
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
// WEBHOOK CALLER & ANTI-EMAIL DOBEL
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

    // Mendukung Multi-URL Google Apps Script (dipisah koma) agar kuota pengiriman email harian tanpa batas
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

// Pengiriman Email dengan Proteksi Anti-Dobel, Cek Stok Gudang & Cek Izin Email User
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

    // Kunci segera di memori, localStorage, dan Firestore sebelum request dimulai
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

// Formatter Kredensial Stok Tanpa Link Default Ambil Kode
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

    // 0. Cek jika ini pesanan Langganan Bulanan Member Plus
    if (orderData.isMemberPlusOrder === true || orderData.orderType === 'MEMBER_PLUS_SUB') {
        processingAutoOrderIds.add(orderDbId);
        try {
            const nowMs = Date.now();
            const expMs = nowMs + (30 * 86400000);
            if (orderData.userId) {
                await setDoc(doc(db, pathUsers, orderData.userId), {
                    isMemberPlus: true,
                    memberPlusSince: nowMs,
                    memberPlusExpiresAt: expMs,
                    updatedAt: nowMs
                }, { merge: true }).catch(() => {});
            }
            const replyMsg = `[MEMBER PLUS AKTIF - 30 HARI]\nStatus      : Member Plus Aktif\nBerlaku s/d : ${new Date(expMs).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}\nKeuntungan  : Harga Spesial Member Plus & Voucher Eksklusif`;
            await updateDoc(doc(db, pathOrders, orderDbId), {
                status: 'SUCCESS',
                paymentVerified: true,
                paidAt: orderData.paidAt || nowMs,
                memberPlusActivated: true,
                autoDelivered: true,
                deliveredAt: nowMs,
                durationDays: 30,
                subscriptionStartAt: nowMs,
                subscriptionEndAt: expMs,
                subscriptionStatus: 'ACTIVE',
                adminReply: replyMsg
            }).catch(() => {});
            return true;
        } finally {
            setTimeout(() => processingAutoOrderIds.delete(orderDbId), 3000);
        }
    }

    // 1. Cek jika ini pesanan Isi Saldo Akun (Top Up Dompet Member)
    if (orderData.isTopupOrder === true || orderData.orderType === 'TOPUP_BALANCE') {
        processingAutoOrderIds.add(orderDbId);
        try {
            const credited = await creditTopupOrderBalanceIfNeeded(orderData, orderDbId);
            return credited;
        } finally {
            setTimeout(() => processingAutoOrderIds.delete(orderDbId), 3000);
        }
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

    // 2. Cek jika produk menggunakan jalur Otomatis Digiflazz (Prabayar / Pascabayar)
    if (procType === 'digiflazz' || procType === 'digiflazz_pasca' || item.isDigiflazz === true || Boolean(item.buyerSkuCode || orderData.digiflazzSku)) {
        try {
            if (siteSettings.digiflazzAutoHitOnPaid !== false) {
                const hitOk = await window.executeDigiflazzTransactionForOrder(orderData, orderDbId, true);
                return hitOk;
            } else {
                await updateDoc(doc(db, pathOrders, orderDbId), {
                    status: 'PENDING',
                    paymentVerified: true,
                    paidAt: orderData.paidAt || nowMs,
                    ...subFields
                }).catch(() => {});
                return false;
            }
        } finally {
            setTimeout(() => processingAutoOrderIds.delete(orderDbId), 3500);
        }
    }

    // 3. Produk Manual (atau Game non-Digiflazz tanpa stok lokal)
    if (procType === 'manual' || (item.type === 'game' && procType !== 'auto')) {
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
            // Hapus akun dari Firebase Authentication menggunakan token sesi jika tersedia
            if (anon.anonIdToken) {
                await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=AIzaSyBQGZjl7uj5CRiLWCvPQKjiK4HvIYnXSJg`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken: anon.anonIdToken })
                }).catch(() => {});
            }
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
    
    onSnapshot(doc(db, pathSettings, 'secretConfig'), (secSnap) => {
        if (secSnap.exists()) {
            siteSettings = { ...siteSettings, ...secSnap.data() };
            window.populateSettingsForm();
        }
    }, () => {});

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
        const nowMs = Date.now();
        recentMutationsList = [];

        snapshot.forEach((docSnap) => {
            const mData = { dbId: docSnap.id, ...docSnap.data() };
            const ts = getAdminMutationTimestampMs(mData, false);
            // Bersihkan otomatis log yang sudah melewati 1 jam (3.600.000 ms) langsung dari Firebase
            if (ts > 0 && (nowMs - ts >= MUTATION_AUTO_CLEAN_1H_MS)) {
                deleteDoc(doc(db, pathMutations, docSnap.id)).catch(() => {});
                return;
            }
            recentMutationsList.push(mData);
        });
        recentMutationsList.sort((a, b) => getAdminMutationTimestampMs(b, false) - getAdminMutationTimestampMs(a, false));

        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
                const mut = change.doc.data();
                const docId = change.doc.id;
                const cands = extractAdminCandidateAmountsFromMutation(mut);
                const primaryAmt = cands[0] || 0;
                const cleanFullText = getAdminCombinedMutationText(mut);

                if (docId && !mut.receivedAt) {
                    const nowStamp = Date.now();
                    mut.receivedAt = nowStamp;
                    updateDoc(doc(db, pathMutations, docId), {
                        receivedAt: nowStamp,
                        receivedAtIso: new Date(nowStamp).toISOString(),
                        amount: primaryAmt,
                        candidateAmounts: cands,
                        cleanText: cleanFullText,
                        status: mut.status || 'UNMATCHED'
                    }).catch(() => {});
                }

                if (!processedAdminMutationIds.has(docId)) {
                    const mutStatus = String(mut.status || '').toUpperCase();
                    if (mutStatus !== 'MATCHED' || !mut.matchedOrderId) {
                        const mutTime = getAdminMutationTimestampMs(mut, true);
                        if (mutTime > 0 && Math.abs(Date.now() - mutTime) < 1200000) {
                            cands.forEach(amt => {
                                autoMatchIncomingPaymentAmount(Number(amt), cleanFullText, docId);
                            });
                        }
                    }
                }
            }
        });

        // Jalankan pencocokan dua arah otomatis tanpa perlu Admin menekan tombol segarkan
        crossCheckAllUnpaidOrdersAgainstMutations();
        window.renderAdminQrisControlMonitor();
        window.generateAdminReports();
        window.renderAdminTopMultiMarquee();
    }, () => {});

    onSnapshot(collection(db, pathProducts), (snapshot) => {
        products = [];
        snapshot.forEach((docSnap) => { products.push({ dbId: docSnap.id, ...docSnap.data() }); });
        rebuildGroupedBrands();
        window.renderAdminCatalog();
        if (typeof window.updateFooterMarqueeControlPreview === 'function') window.updateFooterMarqueeControlPreview();
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

            // Jika pembayaran diterima (status PAID atau baru lunas tanpa adminReply), cek stok lokal
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
        
        crossCheckAllUnpaidOrdersAgainstMutations();
        window.generateAdminReports();
        window.renderAdminOrders();
        window.renderAdminMembers();
        if (typeof window.renderAdminBalanceTab === 'function') window.renderAdminBalanceTab();
        if (typeof window.renderDigiflazzTransactionsTable === 'function') window.renderDigiflazzTransactionsTable();
        if (typeof window.updateDigiflazzDashboardStats === 'function') window.updateDigiflazzDashboardStats();
        if (typeof window.renderAdminQrisControlMonitor === 'function') window.renderAdminQrisControlMonitor();
        if (typeof window.renderAdminTopMultiMarquee === 'function') window.renderAdminTopMultiMarquee();
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
            // Pastikan saran produk TIDAK PERNAH masuk ke daftar Chat Bantuan
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
        if (typeof window.renderAdminBalanceTab === 'function') window.renderAdminBalanceTab();
        window.generateAdminReports();
    });

    onSnapshot(collection(db, pathDigiflazzCatalog), (snapshot) => {
        digiflazzCatalogList = [];
        snapshot.forEach((docSnap) => {
            digiflazzCatalogList.push({ dbId: docSnap.id, ...docSnap.data() });
        });
        digiflazzCatalogList.sort((a, b) => String(a.brand || '').localeCompare(String(b.brand || '')) || (Number(a.price || 0) - Number(b.price || 0)));
        window.populateDigiflazzFilterDropdowns();
        window.renderDigiflazzCatalogTable();
        window.updateDigiflazzDashboardStats();
        window.generateAdminReports();
    }, () => {});

    onSnapshot(collection(db, pathDigiflazzDeposits), (snapshot) => {
        digiflazzDepositsList = [];
        snapshot.forEach((docSnap) => {
            digiflazzDepositsList.push({ dbId: docSnap.id, ...docSnap.data() });
        });
        digiflazzDepositsList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        window.renderDigiflazzDepositHistory();
    }, () => {});

    onSnapshot(collection(db, pathBalanceLogs), (snapshot) => {
        balanceLogsList = [];
        snapshot.forEach((docSnap) => {
            balanceLogsList.push({ dbId: docSnap.id, ...docSnap.data() });
        });
        balanceLogsList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        if (typeof window.renderAdminBalanceTab === 'function') window.renderAdminBalanceTab();
    }, () => {});
}

function stripAdminMacroDroidPlaceholders(str) {
    if (!str) return '';
    return String(str)
        .replace(/\[notification\]/gi, ' ')
        .replace(/\{notification\}/gi, ' ')
        .replace(/\[not_[a-z0-9_]+\]/gi, ' ')
        .replace(/\{not_[a-z0-9_]+\}/gi, ' ')
        .replace(/\[(?:hour|minute|second|system_time|dayofmonth|month_digit|year)\]/gi, ' ')
        .replace(/\{(?:hour|minute|second|system_time|dayofmonth|month_digit|year)\}/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getAdminCombinedMutationText(mut) {
    if (!mut) return '';
    const parts = [
        mut.title, mut.not_title,
        mut.text, mut.notification, mut.not_text,
        mut.bigText, mut.big_text, mut.not_big_text,
        mut.subText, mut.not_sub_text,
        mut.rawText, mut.cleanText, mut.message, mut.body, mut.isi
    ].map(stripAdminMacroDroidPlaceholders).filter(Boolean);

    const unique = [];
    parts.forEach(p => {
        if (p && !unique.includes(p)) unique.push(p);
    });
    return unique.join(' — ');
}

function cleanAdminCurrencyNumber(str) {
    if (str === null || str === undefined) return 0;
    let s = String(str).trim();
    s = s.replace(/[.,]\d{2}$/, '').replace(/,-$/, '');
    const digits = s.replace(/[^0-9]/g, '');
    if (!digits) return 0;
    const n = parseInt(digits, 10);
    return isNaN(n) ? 0 : n;
}

function extractAdminSmartCurrencyAmounts(rawText, directAmount) {
    const results = [];
    const addCand = (val, minAllowed = 1) => {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num >= minAllowed && num <= 50000000 && !results.includes(num)) {
            results.push(num);
        }
    };
    if (directAmount !== undefined && directAmount !== null && String(directAmount).trim() !== '') {
        const c = cleanAdminCurrencyNumber(directAmount);
        if (c > 0) addCand(c, 1);
    }
    if (!rawText) return results;

    let text = stripAdminMacroDroidPlaceholders(rawText)
        .replace(/\b\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}\b/g, ' ')
        .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
        .replace(/\b\d{1,2}\.\d{2}\s*(WIB|WITA|WIT|AM|PM)\b/gi, ' ');

    // Prioritas 1: Angka dengan Rp / IDR / qris / diterima (mendukung Rp 1 s/d Rp 50.000.000 termasuk Rp 345)
    const rpRegex = /(?:Rp\.?|IDR|sebesar|senilai|masuk|diterima|pembayaran|qris|total|nominal|\+)\s*[:\.]?\s*([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]{1,8}(?:[.,][0-9]{1,2})?)/gi;
    let m;
    while ((m = rpRegex.exec(text)) !== null) {
        const parsed = cleanAdminCurrencyNumber(m[1]);
        if (parsed > 0) addCand(parsed, 1);
    }

    // Prioritas 2: Angka ribuan atau 3-8 digit
    const genRegex = /\b([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]{3,8})\b/g;
    while ((m = genRegex.exec(text)) !== null) {
        const token = m[1];
        const parsed = cleanAdminCurrencyNumber(token);
        if (parsed > 0 && (parsed < 2020 || parsed > 2035 || token.includes('.') || token.includes(','))) {
            addCand(parsed, 50);
        }
    }
    return results;
}

function extractAdminCandidateAmountsFromMutation(mut) {
    if (!mut) return [];
    const list = [];
    const add = (n) => {
        const v = Math.round(Number(n) || 0);
        if (v >= 1 && !list.includes(v)) list.push(v);
    };
    if (Array.isArray(mut.candidateAmounts)) mut.candidateAmounts.forEach(add);
    if (mut.amount !== undefined && mut.amount !== null) add(cleanAdminCurrencyNumber(mut.amount));
    if (mut.detectedAmount !== undefined && mut.detectedAmount !== null) add(cleanAdminCurrencyNumber(mut.detectedAmount));
    const combined = getAdminCombinedMutationText(mut);
    if (combined) {
        extractAdminSmartCurrencyAmounts(combined, mut.amount).forEach(add);
    }
    return list;
}

function getAdminMutationTimestampMs(mut, fallbackNow = false) {
    if (!mut) return fallbackNow ? Date.now() : 0;
    const rawTs = mut.receivedAt || mut.createdAt || mut.timestamp || mut.receivedAtIso || 0;
    if (typeof rawTs === 'number' && rawTs > 1000000000000) return rawTs;
    if (typeof rawTs === 'string' && rawTs.trim()) {
        const asNum = Number(rawTs);
        if (!isNaN(asNum) && asNum > 1000000000000) return asNum;
        const parsedDate = new Date(rawTs).getTime();
        if (!isNaN(parsedDate) && parsedDate > 1000000000000) return parsedDate;
    }
    return fallbackNow ? Date.now() : 0;
}

async function autoMatchIncomingPaymentAmount(detectedAmount, rawNotifText = '', sourceMutationDocId = '') {
    const numAmt = Math.round(Number(detectedAmount) || 0);
    const unpaidMatch = orders.find(o => {
        if (o.status !== 'UNPAID' && o.status !== 'PENDING_PAYMENT') return false;
        const fTotal = Math.round(Number(o.finalTotal) || 0);
        const uTotal = Math.round(Number(o.uniqueTotal) || 0);
        const bTotal = Math.round(Number(o.baseTotal) || 0);
        if (numAmt > 0 && (fTotal === numAmt || uTotal === numAmt || (bTotal > 0 && bTotal === numAmt))) return true;
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
            if (sourceMutationDocId) {
                processedAdminMutationIds.add(sourceMutationDocId);
                updateDoc(doc(db, pathMutations, sourceMutationDocId), {
                    status: 'MATCHED',
                    matchedOrderId: unpaidMatch.id,
                    amount: numAmt
                }).catch(() => {});
            }
            playNotificationSound('order');
            const delivered = await attemptAutoStockDelivery(unpaidMatch, unpaidMatch.dbId);
            window.showToast(
                'Pembayaran QRIS Terverifikasi!',
                delivered
                    ? `Nominal Rp${(unpaidMatch.finalTotal || numAmt).toLocaleString('id-ID')} melunasi #${unpaidMatch.id} & stok otomatis dikirim!`
                    : `Nominal Rp${(unpaidMatch.finalTotal || numAmt).toLocaleString('id-ID')} diterima. #${unpaidMatch.id} kini berstatus PENDING (Siap Diproses Admin).`,
                'success'
            );
            return true;
        } catch (e) {}
    }
    return false;
}

function crossCheckAllUnpaidOrdersAgainstMutations() {
    if (!Array.isArray(orders) || !Array.isArray(recentMutationsList)) return;
    if (orders.length === 0 || recentMutationsList.length === 0) return;

    const nowMs = Date.now();
    const unpaidList = orders.filter(o => o.status === 'UNPAID' || o.status === 'PENDING_PAYMENT');
    if (unpaidList.length === 0) return;

    for (const mut of recentMutationsList) {
        if (!mut || !mut.dbId) continue;
        if (processedAdminMutationIds.has(mut.dbId)) continue;
        if (String(mut.status || '').toUpperCase() === 'MATCHED' && mut.matchedOrderId) continue;

        const mutTs = getAdminMutationTimestampMs(mut, true);
        if (mutTs > 0 && Math.abs(nowMs - mutTs) > 1200000) continue;

        const cands = extractAdminCandidateAmountsFromMutation(mut);
        const cleanFullText = getAdminCombinedMutationText(mut);
        for (const amt of cands) {
            autoMatchIncomingPaymentAmount(Number(amt), cleanFullText, mut.dbId);
        }
    }
}

async function autoCleanExpiredMutations1Hour(showToastIfCleaned = false) {
    const nowMs = Date.now();
    const expiredMuts = (recentMutationsList || []).filter(m => {
        if (!m || !m.dbId) return false;
        const ts = getAdminMutationTimestampMs(m, false);
        return ts > 0 && (nowMs - ts >= MUTATION_AUTO_CLEAN_1H_MS);
    });

    if (expiredMuts.length === 0) return 0;

    let deletedCount = 0;
    for (const exp of expiredMuts) {
        try {
            await deleteDoc(doc(db, pathMutations, exp.dbId));
            deletedCount++;
        } catch (e) {}
    }

    if (deletedCount > 0) {
        const expIds = new Set(expiredMuts.map(x => x.dbId));
        recentMutationsList = recentMutationsList.filter(m => !expIds.has(m.dbId));
        window.renderAdminQrisControlMonitor();
        window.generateAdminReports();
        window.renderAdminTopMultiMarquee();
        if (showToastIfCleaned) {
            window.showToast('Log Dibersihkan', `${deletedCount} mutasi lama berhasil dibersihkan.`, 'info');
        }
    }
    return deletedCount;
}

function startAdminGasWebhookPolling() {
    // 1. Jalankan pembersihan otomatis log mutasi > 1 jam setiap 60 detik & pencocokan otomatis
    if (mutationOneHourAutoCleanInterval) clearInterval(mutationOneHourAutoCleanInterval);
    setTimeout(() => {
        autoCleanExpiredMutations1Hour(false);
        crossCheckAllUnpaidOrdersAgainstMutations();
    }, 3500);

    mutationOneHourAutoCleanInterval = setInterval(() => {
        autoCleanExpiredMutations1Hour(false);
        crossCheckAllUnpaidOrdersAgainstMutations();
    }, 60000);

    // 2. Jalankan jam digital & sapaan dinamis pada Hero Selamat Datang Admin
    if (adminWelcomeClockInterval) clearInterval(adminWelcomeClockInterval);
    window.updateAdminWelcomeHeroUI(currentAdminUser);
    adminWelcomeClockInterval = setInterval(() => {
        window.updateAdminWelcomeClockTick();
    }, 1000);
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

    const isMpSub = Boolean(order.isMemberPlusOrder === true || order.orderType === 'MEMBER_PLUS_SUB' || String(order.id || '').toUpperCase().startsWith('MPLUS-'));
    const item = order.items && order.items[0] ? order.items[0] : {};
    const sBadge = order.status === 'SUCCESS' ? 'status-success' : (order.status === 'PENDING' ? 'status-pending' : 'status-unpaid');

    let actionBtnHtml = '';
    if (order.status !== 'SUCCESS') {
        actionBtnHtml = `
            <div class="flex-wrap-gap mt-3">
                <button class="btn btn-success flex-2" onclick="window.approveCashBarcodeDirectly('${order.dbId}')">
                    <i class="fa-solid ${isMpSub ? 'fa-crown' : 'fa-cash-register'}"></i> ${isMpSub ? 'Terima Tunai & Aktifkan Member Plus' : 'Terima Tunai & Selesaikan'}
                </button>
                ${!isMpSub ? `<button class="btn btn-outline flex-1" onclick="window.closeBarcodeScannerModal(); window.promptProcessOrder('${order.dbId}')">
                    <i class="fa-solid fa-sliders"></i> Proses Manual
                </button>` : ''}
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
            <div class="text-sm fw-bold text-dark">${window.escapeHtml(item.name || (isMpSub ? 'Langganan Member Plus (30 Hari)' : '-'))}</div>
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

    const isMpSub = Boolean(order.isMemberPlusOrder === true || order.orderType === 'MEMBER_PLUS_SUB' || String(order.id || '').toUpperCase().startsWith('MPLUS-'));
    if (isMpSub) {
        window.closeBarcodeScannerModal();
        await window.adminExecuteMemberPlusActivationDirect(dbId);
        return;
    }

    try {
        window.closeBarcodeScannerModal();
        const delivered = await attemptAutoStockDelivery(order, dbId);
        if (!delivered) {
            window.promptProcessOrder(dbId);
            window.showToast('Tunai Diterima (Pending)', `Pembayaran diterima. Silakan kirim pesanan ${order.id}.`, 'info');
        } else {
            window.showToast('Tunai Diterima & Terkirim', `Pembayaran ${order.id} diterima & pesanan otomatis dikirim.`, 'success');
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

function isAdminUserMemberPlusActive(u) {
    if (!u || u.isAnonymous || u.isGuest || u.role === 'anonymous') return false;
    const expMs = Number(u.memberPlusExpiresAt || 0);
    if (expMs > Date.now()) return true;
    if (u.isMemberPlus === true && expMs === 0) return true;
    return false;
}

function isOrderFromMemberPlusUser(o) {
    if (!o) return false;
    if (o.isMemberPlusUser === true || o.isMemberPlusOrder === true) return true;
    const uMatch = allUsersList.find(u =>
        (o.userId && u.uid === o.userId) ||
        (o.userEmail && u.email && u.email.toLowerCase() === o.userEmail.toLowerCase())
    );
    return isAdminUserMemberPlusActive(uMatch);
}

let currentAdminMembersSubTab = 'users';
let currentAdminMpOrderFilter = 'ALL';

window.switchAdminMembersSubTab = function(subTab = 'users') {
    currentAdminMembersSubTab = (subTab === 'mp_orders') ? 'mp_orders' : 'users';
    const btnUsers = document.getElementById('admin-members-subtab-btn-users');
    const btnMpOrders = document.getElementById('admin-members-subtab-btn-mp-orders');
    const panelUsers = document.getElementById('admin-members-panel-users');
    const panelMpOrders = document.getElementById('admin-members-panel-mp-orders');

    const isMpOrders = (currentAdminMembersSubTab === 'mp_orders');
    if (btnUsers) {
        btnUsers.className = isMpOrders ? 'btn btn-outline' : 'btn btn-primary';
    }
    if (btnMpOrders) {
        btnMpOrders.className = isMpOrders ? 'btn btn-warning' : 'btn btn-outline';
        if (!isMpOrders) {
            btnMpOrders.style.borderColor = '#d97706';
            btnMpOrders.style.color = '#b45309';
            btnMpOrders.style.fontWeight = '800';
        } else {
            btnMpOrders.style.color = '#422006';
            btnMpOrders.style.fontWeight = '900';
        }
    }
    if (panelUsers) panelUsers.style.display = isMpOrders ? 'none' : 'block';
    if (panelMpOrders) panelMpOrders.style.display = isMpOrders ? 'block' : 'none';

    if (isMpOrders) {
        window.renderAdminMemberPlusOrders();
    } else {
        window.renderAdminMembers();
    }
};

window.setAdminMpOrderFilter = function(filterType, btnEl) {
    currentAdminMpOrderFilter = filterType || 'ALL';
    document.querySelectorAll('#admin-mp-orders-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    window.renderAdminMemberPlusOrders();
};

window.renderAdminMemberPlusOrders = function() {
    const grid = document.getElementById('admin-mp-orders-grid');
    const badgeEl = document.getElementById('admin-mp-orders-pending-badge');
    const mpSubStatEl = document.getElementById('member-stat-mplus-sub');

    const mpOrders = (Array.isArray(orders) ? orders : []).filter(o =>
        o && (o.isMemberPlusOrder === true || o.orderType === 'MEMBER_PLUS_SUB' || String(o.id || '').toUpperCase().startsWith('MPLUS-'))
    ).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    const pendingMpOrders = mpOrders.filter(o =>
        !o.memberPlusActivated && o.status !== 'SUCCESS' && o.status !== 'CANCELLED' && o.status !== 'FAILED' && o.status !== 'EXPIRED'
    );

    if (badgeEl) {
        if (pendingMpOrders.length > 0) {
            badgeEl.style.display = 'inline-block';
            badgeEl.innerText = String(pendingMpOrders.length);
        } else {
            badgeEl.style.display = 'none';
        }
    }
    if (mpSubStatEl) {
        mpSubStatEl.innerText = pendingMpOrders.length > 0
            ? `${pendingMpOrders.length} pesanan menunggu aktivasi`
            : `${mpOrders.filter(o => o.status === 'SUCCESS' || o.memberPlusActivated).length} langganan selesai`;
    }

    if (!grid) return;

    const searchQ = (document.getElementById('admin-search-mp-orders')?.value || '').trim().toLowerCase();

    let filtered = mpOrders.filter(o => {
        const isDone = Boolean(o.status === 'SUCCESS' || o.memberPlusActivated === true);
        const isCancelledOrder = Boolean(o.status === 'CANCELLED' || o.status === 'FAILED' || o.status === 'EXPIRED');
        const isPending = Boolean(!isDone && !isCancelledOrder);
        if (currentAdminMpOrderFilter === 'PENDING') return isPending;
        if (currentAdminMpOrderFilter === 'ACTIVE') return isDone;
        if (currentAdminMpOrderFilter === 'CANCELLED') return isCancelledOrder;
        return true;
    });

    if (searchQ) {
        filtered = filtered.filter(o =>
            String(o.id || '').toLowerCase().includes(searchQ) ||
            String(o.buyerName || '').toLowerCase().includes(searchQ) ||
            String(o.userEmail || '').toLowerCase().includes(searchQ) ||
            String(o.userId || '').toLowerCase().includes(searchQ)
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="dashboard-panel text-center text-muted" style="grid-column: 1/-1; padding: 2rem;">Belum ada pesanan langganan Member Plus pada filter ini.</div>`;
        return;
    }

    grid.innerHTML = filtered.map(o => {
        const isDone = Boolean(o.status === 'SUCCESS' || o.memberPlusActivated === true);
        const isCancelled = Boolean(o.status === 'CANCELLED' || o.status === 'FAILED' || o.status === 'EXPIRED');
        const durDays = parseInt(o.durationDays || 30, 10) || 30;
        const dtStr = o.date ? new Date(o.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
        const payMethod = String(o.paymentMethod || 'balance').toLowerCase();
        const payBadge = payMethod === 'balance'
            ? `<span class="status-badge status-success"><i class="fa-solid fa-wallet"></i> SALDO AKUN</span>`
            : (payMethod === 'cash'
                ? `<span class="status-badge status-pending"><i class="fa-solid fa-barcode"></i> TUNAI KASIR</span>`
                : `<span class="status-badge status-info"><i class="fa-solid fa-qrcode"></i> QRIS</span>`);

        let statusBadge = `<span class="status-badge status-pending">MENUNGGU AKTIVASI</span>`;
        if (isDone) {
            statusBadge = `<span class="status-badge status-memberplus-gold"><i class="fa-solid fa-crown"></i> LANGGANAN AKTIF</span>`;
        } else if (isCancelled) {
            statusBadge = `<span class="status-badge status-failed">${window.escapeHtml(o.status)}</span>`;
        }

        const startDateStr = o.subscriptionStartAt
            ? new Date(o.subscriptionStartAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
            : dtStr;
        const endDateStr = o.subscriptionEndAt
            ? new Date(o.subscriptionEndAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
            : '-';

        let actionAreaHtml = '';
        if (isDone) {
            actionAreaHtml = `
                <div style="margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: rgba(245, 158, 11, 0.12); border: 1.5px solid #d97706; font-size: 0.78rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span class="text-muted fw-bold">STATUS AKUN:</span>
                        <strong style="color:#b45309;"><i class="fa-solid fa-crown"></i> MEMBER PLUS AKTIF (${durDays} HARI)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span class="text-muted fw-bold">MULAI LANGGANAN:</span>
                        <strong>${window.escapeHtml(startDateStr)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span class="text-muted fw-bold">TANGGAL AKHIR:</span>
                        <strong style="color:#15803d;">${window.escapeHtml(endDateStr)}</strong>
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-outline btn-sm text-danger border-danger flex-1" style="font-size:0.72rem;" onclick="window.adminRevokeMemberPlusUserWithPin('${escapeJsStr(o.userId || '')}', '${escapeJsStr(o.buyerName || o.userEmail || 'Member')}', '${escapeJsStr(o.dbId)}')">
                            <i class="fa-solid fa-user-slash"></i> Cabut Langganan
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" style="font-size:0.72rem;" title="Hapus Data Pesanan Langganan Ini" onclick="window.adminDeleteSingleMemberPlusOrder('${escapeJsStr(o.dbId)}')">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>`;
        } else if (!isCancelled) {
            actionAreaHtml = `
                <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-warning btn-sm flex-1" style="font-weight: 900; color: #422006;" onclick="window.adminExecuteMemberPlusActivationDirect('${escapeJsStr(o.dbId)}')">
                        <i class="fa-solid fa-crown"></i> Aktifkan Langganan
                    </button>
                    <button type="button" class="btn btn-outline btn-sm text-danger border-danger" onclick="window.adminCancelMemberPlusOrder('${escapeJsStr(o.dbId)}')">
                        <i class="fa-solid fa-xmark"></i> Batalkan
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" title="Hapus Data Pesanan" onclick="window.adminDeleteSingleMemberPlusOrder('${escapeJsStr(o.dbId)}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>`;
        } else {
            actionAreaHtml = `
                <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
                    <button type="button" class="btn btn-danger btn-sm w-full" onclick="window.adminDeleteSingleMemberPlusOrder('${escapeJsStr(o.dbId)}')">
                        <i class="fa-solid fa-trash-can"></i> Hapus Data Pesanan Ini
                    </button>
                </div>`;
        }

        return `
            <div class="member-card ${isDone ? 'member-card-gold' : ''}">
                <div>
                    <div class="flex-between align-center mb-2" style="gap: 8px; flex-wrap: wrap;">
                        <strong class="code-mono" style="font-size: 0.92rem;">#${window.escapeHtml(o.id)}</strong>
                        ${statusBadge}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <div style="font-weight: 900; font-size: 0.95rem;">${window.escapeHtml(o.buyerName || (o.userEmail ? o.userEmail.split('@')[0] : 'Member'))}</div>
                        <span class="text-xs text-muted d-block"><i class="fa-regular fa-envelope"></i> ${window.escapeHtml(o.userEmail || '-')}</span>
                        <span class="text-xs text-muted d-block"><i class="fa-regular fa-clock"></i> ${window.escapeHtml(dtStr)}</span>
                    </div>

                    <div class="member-meta-box">
                        <div class="member-meta-item">
                            <span>PAKET LANGGANAN</span>
                            <strong style="color:#b45309;"><i class="fa-solid fa-crown"></i> ${durDays} Hari</strong>
                        </div>
                        <div class="member-meta-item">
                            <span>BIAYA LANGGANAN</span>
                            <strong class="text-primary">Rp${Number(o.finalTotal || 0).toLocaleString('id-ID')}</strong>
                        </div>
                        <div class="member-meta-item" style="grid-column: 1 / -1; border-top: 1px dashed var(--border-subtle); padding-top: 6px; display:flex; justify-content:space-between; align-items:center;">
                            <span>Metode Bayar:</span>
                            ${payBadge}
                        </div>
                    </div>
                </div>
                ${actionAreaHtml}
            </div>`;
    }).join('');
};

window.adminExecuteMemberPlusActivationDirect = async function(orderDbId) {
    const order = orders.find(o => o.dbId === orderDbId);
    if (!order) return false;
    const durDays = parseInt(order.durationDays || 30, 10) || 30;
    const buyerLabel = order.buyerName || order.userEmail || order.id;

    try {
        const nowMs = Date.now();
        let nextExp = nowMs + (durDays * 86400000);
        let sinceMs = nowMs;

        if (order.userId) {
            const userRef = doc(db, pathUsers, order.userId);
            const uSnap = await getDoc(userRef).catch(() => null);
            if (uSnap && uSnap.exists()) {
                const uData = uSnap.data();
                const curExp = Number(uData.memberPlusExpiresAt || 0);
                const baseStart = curExp > nowMs ? curExp : nowMs;
                nextExp = baseStart + (durDays * 86400000);
                sinceMs = uData.memberPlusSince || nowMs;
            }
            await setDoc(userRef, {
                isMemberPlus: true,
                memberPlusSince: sinceMs,
                memberPlusExpiresAt: nextExp,
                memberPlusRevokedAt: 0,
                updatedAt: nowMs
            }, { merge: true });
        }

        const expFmt = new Date(nextExp).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        const replyMsg = `[LANGGANAN MEMBER PLUS AKTIF]
Status      : MEMBER PLUS VIP
Durasi      : ${durDays} Hari
Berlaku s/d : ${expFmt}
Keuntungan  : Harga Spesial Member Plus & Kode Promo Spesial telah aktif.`;

        await updateDoc(doc(db, pathOrders, orderDbId), {
            status: 'SUCCESS',
            paymentVerified: true,
            paidAt: order.paidAt || nowMs,
            memberPlusActivated: true,
            autoDelivered: true,
            deliveredAt: nowMs,
            durationDays: durDays,
            subscriptionStartAt: nowMs,
            subscriptionEndAt: nextExp,
            subscriptionStatus: 'ACTIVE',
            adminReply: replyMsg
        });

        window.showToast('Member Plus Aktif', `Langganan Member Plus ${buyerLabel} aktif hingga ${expFmt}.`, 'success');
        window.renderAdminMemberPlusOrders();
        window.renderAdminMembers();
        window.renderAdminOrders();
        return true;
    } catch (e) {
        window.customAlert('Gagal Mengaktifkan', 'Terjadi kendala saat mengaktifkan langganan Member Plus.', 'error');
        return false;
    }
};

window.adminApproveMemberPlusOrderWithPin = function(orderDbId) {
    const order = orders.find(o => o.dbId === orderDbId);
    if (!order) return;
    const durDays = parseInt(order.durationDays || 30, 10) || 30;
    const buyerLabel = order.buyerName || order.userEmail || order.id;

    window.requestAdminPinVerification(
        `Aktifkan Langganan Member Plus #${order.id} (${buyerLabel} - ${durDays} Hari)`,
        async () => {
            try {
                const nowMs = Date.now();
                let nextExp = nowMs + (durDays * 86400000);
                let sinceMs = nowMs;

                if (order.userId) {
                    const userRef = doc(db, pathUsers, order.userId);
                    const uSnap = await getDoc(userRef).catch(() => null);
                    if (uSnap && uSnap.exists()) {
                        const uData = uSnap.data();
                        const curExp = Number(uData.memberPlusExpiresAt || 0);
                        const baseStart = curExp > nowMs ? curExp : nowMs;
                        nextExp = baseStart + (durDays * 86400000);
                        sinceMs = uData.memberPlusSince || nowMs;
                    }
                    await setDoc(userRef, {
                        isMemberPlus: true,
                        memberPlusSince: sinceMs,
                        memberPlusExpiresAt: nextExp,
                        updatedAt: nowMs
                    }, { merge: true });
                }

                const expFmt = new Date(nextExp).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
                const replyMsg = `[LANGGANAN MEMBER PLUS AKTIF]
Status      : MEMBER PLUS VIP
Durasi      : ${durDays} Hari
Berlaku s/d : ${expFmt}
Keuntungan  : Harga Spesial Member Plus & Kode Promo Spesial telah aktif.`;

                await updateDoc(doc(db, pathOrders, orderDbId), {
                    status: 'SUCCESS',
                    paymentVerified: true,
                    paidAt: order.paidAt || nowMs,
                    memberPlusActivated: true,
                    autoDelivered: true,
                    deliveredAt: nowMs,
                    durationDays: durDays,
                    subscriptionStartAt: nowMs,
                    subscriptionEndAt: nextExp,
                    subscriptionStatus: 'ACTIVE',
                    adminReply: replyMsg
                });

                window.showToast('Member Plus Diaktifkan', `Akun ${buyerLabel} resmi menjadi Member Plus hingga ${expFmt}.`, 'success');
                window.renderAdminMemberPlusOrders();
                window.renderAdminMembers();
                window.renderAdminOrders();
            } catch (e) {
                window.customAlert('Gagal Mengaktifkan', 'Terjadi kendala saat mengaktifkan langganan Member Plus.', 'error');
            }
        }
    );
};

window.adminCancelMemberPlusOrder = function(orderDbId) {
    const order = orders.find(o => o.dbId === orderDbId);
    if (!order) return;
    window.openConfirm(
        'Batalkan Pesanan Langganan',
        `Batalkan pesanan langganan Member Plus <b>#${window.escapeHtml(order.id)}</b>?`,
        async (confirmed) => {
            if (!confirmed) return;
            try {
                await updateDoc(doc(db, pathOrders, orderDbId), {
                    status: 'CANCELLED',
                    cancelledAt: Date.now()
                });
                window.showToast('Pesanan Dibatalkan', `Pesanan #${order.id} telah dibatalkan.`, 'warning');
                window.renderAdminMemberPlusOrders();
                window.renderAdminOrders();
            } catch (e) {
                window.customAlert('Gagal', 'Tidak dapat membatalkan pesanan.', 'error');
            }
        },
        'delete'
    );
};

window.adminActivateMemberPlusUserWithPin = function(uid, displayName, durDays = 30) {
    if (!uid) return;
    const days = parseInt(durDays || 30, 10) || 30;
    window.requestAdminPinVerification(
        `Aktifkan / Tambah +${days} Hari Member Plus untuk ${displayName}`,
        async () => {
            try {
                const nowMs = Date.now();
                const userRef = doc(db, pathUsers, uid);
                const uSnap = await getDoc(userRef).catch(() => null);
                let curExp = 0;
                let sinceMs = nowMs;
                if (uSnap && uSnap.exists()) {
                    curExp = Number(uSnap.data().memberPlusExpiresAt || 0);
                    sinceMs = uSnap.data().memberPlusSince || nowMs;
                }
                const baseStart = curExp > nowMs ? curExp : nowMs;
                const nextExp = baseStart + (days * 86400000);

                await setDoc(userRef, {
                    isMemberPlus: true,
                    memberPlusSince: sinceMs,
                    memberPlusExpiresAt: nextExp,
                    memberPlusRevokedAt: 0,
                    updatedAt: nowMs
                }, { merge: true });

                const expStr = new Date(nextExp).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
                window.showToast('Member Plus Aktif', `${displayName} aktif sebagai Member Plus hingga ${expStr}.`, 'success');
                window.renderAdminMembers();
            } catch (e) {
                window.customAlert('Gagal', 'Tidak dapat mengaktifkan status Member Plus.', 'error');
            }
        }
    );
};

window.adminRevokeMemberPlusUserWithPin = function(uid, displayName, specificOrderDbId = '') {
    if (!uid && !specificOrderDbId) return;
    window.openConfirm(
        'Cabut Langganan Member Plus',
        `Nonaktifkan dan cabut status <b>Member Plus</b> untuk <b>${window.escapeHtml(displayName || 'Member')}</b> secara langsung?`,
        async (confirmed) => {
            if (!confirmed) return;
            try {
                const nowMs = Date.now();
                const userObj = allUsersList.find(u => u.uid === uid);
                const uEmail = (userObj?.email || '').toLowerCase();

                if (uid) {
                    await setDoc(doc(db, pathUsers, uid), {
                        isMemberPlus: false,
                        memberPlusExpiresAt: 0,
                        memberPlusRevokedAt: nowMs,
                        updatedAt: nowMs
                    }, { merge: true });
                }

                // Tandai seluruh pesanan langganan Member Plus aktif milik user ini sebagai REVOKED agar Web User langsung berubah real-time
                const relatedMpOrders = orders.filter(o => {
                    if (!o) return false;
                    const isMp = Boolean(o.isMemberPlusOrder === true || o.orderType === 'MEMBER_PLUS_SUB' || String(o.id || '').toUpperCase().startsWith('MPLUS-'));
                    if (!isMp) return false;
                    if (specificOrderDbId && o.dbId === specificOrderDbId) return true;
                    if (uid && o.userId === uid) return true;
                    if (uEmail && String(o.userEmail || '').toLowerCase() === uEmail) return true;
                    return false;
                });

                await Promise.all(relatedMpOrders.map(ord => {
                    if (!ord.dbId) return Promise.resolve();
                    return updateDoc(doc(db, pathOrders, ord.dbId), {
                        status: 'CANCELLED',
                        memberPlusActivated: false,
                        subscriptionStatus: 'REVOKED',
                        subscriptionEndAt: 0,
                        revokedAt: nowMs,
                        adminReply: '[LANGGANAN MEMBER PLUS DICABUT OLEH ADMIN]'
                    }).catch(() => {});
                }));

                window.showToast('Langganan Dicabut', `Status Member Plus ${displayName} berhasil dicabut secara real-time.`, 'warning');
                window.renderAdminMemberPlusOrders();
                window.renderAdminMembers();
            } catch (e) {
                window.customAlert('Gagal', 'Tidak dapat mencabut status Member Plus.', 'error');
            }
        },
        'delete'
    );
};

window.renderAdminMembers = function() {
    window.renderAdminMemberPlusOrders();

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
        if (isAnon || u.isDeleted === true) return;
        combinedUsersMap.set(u.uid, { ...u });
    });

    const activeUsersArray = Array.from(combinedUsersMap.values());

    const enrichedUsers = activeUsersArray.map(u => {
        const isAnon = Boolean(u.isAnonymous || u.isGuest || u.role === 'anonymous');
        const uEmail = (u.email || '').toLowerCase();
        const userOrders = orders.filter(o => o.userId === u.uid || (!isAnon && uEmail && o.userEmail?.toLowerCase() === uEmail));
        const successOrders = userOrders.filter(o => o.status === 'SUCCESS' && !o.isTopupOrder && o.orderType !== 'TOPUP_BALANCE');
        const liveSpent = successOrders.reduce((sum, o) => sum + (o.finalTotal || 0), 0);
        const preservedCnt = Math.max(0, Math.round(Number(u.preservedSuccessOrders || 0)));
        const preservedSpent = Math.max(0, Math.round(Number(u.preservedTotalSpent || 0)));
        const totalSpent = preservedSpent + liveSpent;

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
            totalTrx: preservedCnt + userOrders.length,
            successTrx: preservedCnt + successOrders.length,
            totalSpent
        };
    });

    const totalMemberEl = document.getElementById('member-stat-total');
    const totalMplusEl = document.getElementById('member-stat-mplus');
    const totalAnonEl = document.getElementById('member-stat-anon');
    const anonSubEl = document.getElementById('member-stat-anon-sub');
    const phoneEl = document.getElementById('member-stat-phone');
    const buyerEl = document.getElementById('member-stat-buyers');

    if (totalMemberEl) totalMemberEl.innerText = enrichedUsers.filter(u => !u.isAnon).length;
    if (totalMplusEl) totalMplusEl.innerText = enrichedUsers.filter(u => isAdminUserMemberPlusActive(u)).length;
    if (totalAnonEl) totalAnonEl.innerText = enrichedUsers.filter(u => u.isAnon).length;
    if (anonSubEl) anonSubEl.innerText = siteSettings.anonAutoDelete6h !== false ? 'Pembersihan 6 Jam: Aktif' : 'Pembersihan 6 Jam: Nonaktif';
    if (phoneEl) phoneEl.innerText = enrichedUsers.filter(u => u.email && u.email.includes('@')).length;
    if (buyerEl) buyerEl.innerText = enrichedUsers.filter(u => u.successTrx > 0).length;

    let filtered = enrichedUsers.filter(u => {
        const isMp = isAdminUserMemberPlusActive(u);
        if (currentMemberFilter === 'MEMBER_PLUS') return isMp;
        if (currentMemberFilter === 'MEMBER') return !u.isAnon && !isMp;
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

        const isMpActive = isAdminUserMemberPlusActive(u);
        const expMs = Number(u.memberPlusExpiresAt || 0);
        const mpExpDateStr = isMpActive && expMs > 0
            ? new Date(expMs).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';
        const remDays = isMpActive && expMs > Date.now()
            ? Math.max(1, Math.ceil((expMs - Date.now()) / 86400000))
            : 0;

        let statusRoleBadge = u.isAnon
            ? `<span class="status-badge status-anon"><i class="fa-solid fa-user"></i> TAMU</span>`
            : (isMpActive
                ? `<span class="status-badge status-memberplus-gold"><i class="fa-solid fa-crown"></i> MEMBER PLUS</span>`
                : `<span class="status-badge status-success"><i class="fa-solid fa-circle-check"></i> MEMBER</span>`);

        if (u.isBlocked) {
            statusRoleBadge = `<span class="status-badge status-failed"><i class="fa-solid fa-ban"></i> DIBLOKIR</span>`;
        }

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

        let memberPlusControlHtml = '';
        if (!u.isAnon) {
            if (isMpActive) {
                memberPlusControlHtml = `
                    <div style="margin-bottom: 8px; padding: 8px 10px; border-radius: 8px; background: rgba(245, 158, 11, 0.14); border: 1.5px solid #d97706; display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <div style="font-size: 0.74rem;">
                            <strong style="color: #b45309; display: block;"><i class="fa-solid fa-crown"></i> Member Plus Aktif ${remDays > 0 ? `(${remDays} Hari)` : ''}</strong>
                            <span class="text-muted">Berakhir: <b>${window.escapeHtml(mpExpDateStr || 'Aktif')}</b></span>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button type="button" class="btn btn-warning btn-sm" style="padding: 3px 8px; font-size: 0.7rem;" onclick="window.adminActivateMemberPlusUserWithPin('${escapeJsStr(u.uid)}', '${escapeJsStr(displayName)}', 30)" title="Tambah 30 Hari dengan PIN Admin">
                                +30 Hari
                            </button>
                            <button type="button" class="btn btn-outline btn-sm text-danger border-danger" style="padding: 3px 8px; font-size: 0.7rem;" onclick="window.adminRevokeMemberPlusUserWithPin('${escapeJsStr(u.uid)}', '${escapeJsStr(displayName)}')" title="Nonaktifkan Member Plus">
                                Cabut
                            </button>
                        </div>
                    </div>`;
            } else {
                memberPlusControlHtml = `
                    <div style="margin-bottom: 8px;">
                        <button type="button" class="btn btn-outline btn-sm" style="width: 100%; border-color: #d97706; color: #b45309; font-weight: 800; font-size: 0.74rem;" onclick="window.adminActivateMemberPlusUserWithPin('${escapeJsStr(u.uid)}', '${escapeJsStr(displayName)}', 30)">
                            <i class="fa-solid fa-crown" style="color: #f59e0b;"></i> Aktifkan Member Plus 30 Hari (PIN)
                        </button>
                    </div>`;
            }
        }

        html += `
        <div class="member-card ${isMpActive && !u.isBlocked ? 'member-card-gold' : ''}" style="${u.isBlocked ? 'border-color: var(--danger); opacity: 0.88;' : ''}">
            <div>
                <div class="member-card-head mb-2">
                    <div class="member-avatar ${u.isAnon ? 'anon-avatar' : ''} ${isMpActive && !u.isBlocked ? 'avatar-memberplus-gold' : ''}" style="${u.isBlocked ? 'background: var(--danger); color: #fff;' : ''}">${window.escapeHtml(initial)}</div>
                    <div style="flex:1; min-width:0;">
                        <div class="flex-between align-center mb-1" style="gap:6px;">
                            <strong class="text-dark" style="font-size:0.94rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(displayName)}</strong>
                            ${statusRoleBadge}
                        </div>
                        <span class="text-xs text-muted d-block" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="fa-regular fa-envelope"></i> ${window.escapeHtml(u.email || 'Akun Tamu')}</span>
                        ${isMpActive && mpExpDateStr ? `<small class="text-xs fw-bold" style="color:#d97706; display:block; margin-top:2px;"><i class="fa-solid fa-crown"></i> Berakhir: ${window.escapeHtml(mpExpDateStr)}</small>` : ''}
                    </div>
                </div>

                <div class="member-meta-box">
                    <div class="member-meta-item">
                        <span>SALDO AKUN</span>
                        <strong class="text-success">Rp${Number(u.balance || 0).toLocaleString('id-ID')}</strong>
                    </div>
                    <div class="member-meta-item">
                        <span>TOTAL BELANJA</span>
                        <strong class="text-primary">Rp${u.totalSpent.toLocaleString('id-ID')}</strong>
                    </div>
                    <div class="member-meta-item" style="grid-column: 1 / -1; border-top: 1px dashed var(--border-subtle); padding-top: 6px; display:flex; justify-content:space-between;">
                        <span>Trx: <b>${u.successTrx}x Selesai</b></span>
                        <span>UID: <b class="code-mono">#${window.escapeHtml(shortUid)}</b></span>
                    </div>
                </div>
            </div>

            <div>
                ${memberPlusControlHtml}
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
window.updateAdminWelcomeClockTick = function() {
    const now = new Date();
    const h = now.getHours();
    let greet = 'Selamat Malam';
    if (h >= 4 && h < 11) greet = 'Selamat Pagi';
    else if (h >= 11 && h < 15) greet = 'Selamat Siang';
    else if (h >= 15 && h < 18) greet = 'Selamat Sore';

    const greetEl = document.getElementById('admin-greeting-time');
    if (greetEl && greetEl.innerText !== greet) greetEl.innerText = greet;

    const dateEl = document.getElementById('admin-live-date-label');
    if (dateEl) {
        dateEl.innerText = now.toLocaleDateString('id-ID', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        });
    }

    const clockEl = document.getElementById('admin-live-clock-label');
    if (clockEl) {
        clockEl.innerText = now.toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) + ' WIT/WIB';
    }
};

window.updateAdminWelcomeHeroUI = function(userObj = currentAdminUser) {
    window.updateAdminWelcomeClockTick();
    const nameEl = document.getElementById('admin-welcome-name');
    if (!nameEl) return;

    let displayAdminName = 'Admin Vipercell';
    if (userObj) {
        if (userObj.displayName && userObj.displayName.trim()) {
            displayAdminName = userObj.displayName.trim();
        } else if (userObj.email) {
            const em = userObj.email.toLowerCase();
            if (em.startsWith('vipercell')) displayAdminName = 'Vipercell Admin';
            else if (em.startsWith('miller')) displayAdminName = 'Miller (Admin Utama)';
            else {
                const rawUser = em.split('@')[0].replace(/[._0-9]+/g, ' ').trim();
                displayAdminName = rawUser
                    ? rawUser.replace(/\b\w/g, c => c.toUpperCase())
                    : 'Admin Vipercell';
            }
        }
    }
    nameEl.innerText = displayAdminName;
};

window.jumpToFirebaseLogSection = function() {
    window.switchAdminTabByName('tab-qris');
};

window.handleAdminTopMarqueeBadgeClick = function() {
    const unreadChats = allLiveChats.filter(c => {
        const msgs = c.messages || [];
        return msgs.length > 0 && msgs[msgs.length - 1].sender === 'user';
    });
    if (unreadChats.length > 0) {
        window.switchAdminTabByName('tab-livechat');
        window.switchAdminCsSubTab('chat');
        window.openAdminChatDetailDesk(unreadChats[0].id);
        return;
    }
    window.switchAdminTabByName('tab-orders');
};

window.renderAdminTopMultiMarquee = function() { return; };

window.generateAdminReports = function() {
    const now = Date.now();
    const successOrders = orders.filter(o => o.status === 'SUCCESS');
    const unpaidOrders = orders.filter(o => o.status === 'UNPAID' || o.status === 'PENDING_PAYMENT');
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
    const archFin = (siteSettings.archivedFinancialSummary && typeof siteSettings.archivedFinancialSummary === 'object')
        ? siteSettings.archivedFinancialSummary
        : {};
    let totalRevenue = Math.max(0, Math.round(Number(archFin.totalIncome || 0)));
    let todayRevenue = 0;
    let todayCount = 0;
    let totalSales = Math.max(0, Math.round(Number(archFin.totalCount || 0))) + successOrders.length;
    let productCountMap = {};
    
    successOrders.forEach(o => {
        const amount = o.finalTotal || 0;
        totalRevenue += amount;
        if (new Date(o.date).toLocaleDateString('id-ID') === todayStr) {
            todayRevenue += amount;
            todayCount++;
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
    const todayCntSub = document.getElementById('report-today-count-sub');
    const saleEl = document.getElementById('report-sales');
    const unpaidSubEl = document.getElementById('report-unpaid-sub');
    const pendEl = document.getElementById('report-pending');

    if (revEl) revEl.innerText = `Rp${totalRevenue.toLocaleString('id-ID')}`;
    if (todayRevEl) todayRevEl.innerText = `Rp${todayRevenue.toLocaleString('id-ID')}`;
    if (todayCntSub) todayCntSub.innerText = `${todayCount} transaksi sukses hari ini`;
    if (saleEl) saleEl.innerText = totalSales;
    if (unpaidSubEl) unpaidSubEl.innerText = `${unpaidOrders.length} tagihan menunggu bayar`;
    if (pendEl) pendEl.innerText = needActionOrders.length;

    // Update Hero Pintasan Cepat & Ringkasan 6 Kartu Ekosistem Web Vipercell v27.9
    const unreadChatsCount = (allLiveChats || []).filter(c => {
        const msgs = c.messages || [];
        return msgs.length > 0 && msgs[msgs.length - 1].sender === 'user';
    }).length;
    const readyStocksCount = (stocksData || []).filter(s => s.status === 'Ready').length;
    const usedStocksCount = (stocksData || []).filter(s => s.status !== 'Ready').length;
    let sharingSlotsAvail = 0;
    (stocksData || []).filter(s => s.status === 'Ready').forEach(s => {
        if (s.isReusable) sharingSlotsAvail += 99;
        else sharingSlotsAvail += Math.max(0, parseInt(s.maxQuota || 1, 10) - parseInt(s.usedQuota || 0, 10));
    });

    const hOrd = document.getElementById('hero-quick-orders-sub');
    const hChat = document.getElementById('hero-quick-chat-sub');
    const hStock = document.getElementById('hero-quick-stock-sub');
    const hMut = document.getElementById('hero-quick-mut-sub');
    if (hOrd) hOrd.innerText = `${needActionOrders.length} Perlu Diproses`;
    if (hChat) hChat.innerText = `${unreadChatsCount} Belum Dibaca`;
    if (hStock) hStock.innerText = `${readyStocksCount} Baris Ready`;
    if (hMut) hMut.innerText = `${recentMutationsList.length} Log (< 1 Jam)`;

    // Kartu 1: Katalog
    const totalBrandsCount = groupedBrands.length;
    const totalVariantsCount = products.length;
    const soldOutVariantsCount = products.filter(p => Boolean(p.soldOut)).length;
    const readyVariantsCount = Math.max(0, totalVariantsCount - soldOutVariantsCount);
    const sumProdMain = document.getElementById('sum-prod-main');
    const sumProdSub = document.getElementById('sum-prod-sub');
    if (sumProdMain) sumProdMain.innerText = `${totalBrandsCount} Brand • ${totalVariantsCount} Variasi`;
    if (sumProdSub) sumProdSub.innerText = `${readyVariantsCount} variasi siap jual • ${soldOutVariantsCount} habis`;

    // Kartu 2: Gudang Stok
    const sumStockMain = document.getElementById('sum-stock-main');
    const sumStockSub = document.getElementById('sum-stock-sub');
    if (sumStockMain) sumStockMain.innerText = `${readyStocksCount} Stok Aktif (Ready)`;
    if (sumStockSub) sumStockSub.innerText = `${sharingSlotsAvail} slot tersedia • ${usedStocksCount} riwayat terpakai`;

    // Kartu 3: CS Bantuan & Saran
    const sumCsMain = document.getElementById('sum-cs-main');
    const sumCsSub = document.getElementById('sum-cs-sub');
    const sumCsBadge = document.getElementById('sum-cs-status-badge');
    if (sumCsMain) sumCsMain.innerText = `${unreadChatsCount} Chat Belum Dibaca`;
    if (sumCsSub) sumCsSub.innerText = `${allLiveChats.length} ruang chat • ${allSuggestions.length} saran produk`;
    if (sumCsBadge) {
        const totalAtt = unreadChatsCount + allSuggestions.length;
        sumCsBadge.className = totalAtt > 0 ? 'status-badge status-failed' : 'status-badge status-success';
        sumCsBadge.innerText = totalAtt > 0 ? `${totalAtt} PERLU RESPON` : 'TERJAWAB';
    }

    // Kartu 3B: Digiflazz Overview
    const dfActiveInCatalog = products.filter(p => p.processType === 'digiflazz' || p.processType === 'digiflazz_pasca' || p.isDigiflazz).length;
    const sumDfMain = document.getElementById('sum-df-main');
    const sumDfSub = document.getElementById('sum-df-sub');
    const heroDfSub = document.getElementById('hero-quick-df-sub');
    const heroDfBal = document.getElementById('hero-df-balance-label');
    if (sumDfMain) sumDfMain.innerText = `${digiflazzCatalogList.length} SKU Gudang`;
    if (sumDfSub) sumDfSub.innerText = `${dfActiveInCatalog} variasi aktif di katalog toko`;
    if (heroDfSub) heroDfSub.innerText = `${dfActiveInCatalog} Variasi Aktif`;
    if (heroDfBal) heroDfBal.innerText = `Rp${Number(siteSettings.digiflazzLastBalance || 0).toLocaleString('id-ID')}`;

    // Kartu 4: Pelanggan & Total Saldo
    const membersTotal = allUsersList.filter(u => !u.isAnonymous && !u.isGuest && u.role !== 'anonymous').length;
    const guestsTotal = allUsersList.filter(u => u.isAnonymous || u.isGuest || u.role === 'anonymous').length;
    const totalUserBalances = allUsersList.reduce((acc, u) => acc + Number(u.balance || 0), 0);
    const sumUserMain = document.getElementById('sum-user-main');
    const sumUserSub = document.getElementById('sum-user-sub');
    if (sumUserMain) sumUserMain.innerText = `${membersTotal} Member • ${guestsTotal} Tamu`;
    if (sumUserSub) sumUserSub.innerText = `Total saldo pengguna: Rp${totalUserBalances.toLocaleString('id-ID')}`;

    // Kartu 5: Mutasi Pembayaran QRIS
    const matchedMutsCount = recentMutationsList.filter(m => String(m.status || '').toUpperCase() === 'MATCHED').length;
    const sumQrisMain = document.getElementById('sum-qris-main');
    const sumQrisSub = document.getElementById('sum-qris-sub');
    if (sumQrisMain) sumQrisMain.innerText = `${recentMutationsList.length} Mutasi Masuk`;
    if (sumQrisSub) sumQrisSub.innerText = `${matchedMutsCount} pembayaran terverifikasi`;

    // Kartu 6: Promo, Berita & Ulasan
    const activePromosCount = promos.filter(p => p.active !== false).length;
    const activeNewsCount = (siteSettings.newsList || []).filter(n => !n.isHidden).length;
    const avgRating = reviewsData.length > 0
        ? (reviewsData.reduce((s, r) => s + Number(r.rating || 5), 0) / reviewsData.length).toFixed(1)
        : '5.0';
    const sumMktMain = document.getElementById('sum-marketing-main');
    const sumMktSub = document.getElementById('sum-marketing-sub');
    const sumRatBadge = document.getElementById('sum-rating-badge');
    if (sumMktMain) sumMktMain.innerText = `${activePromosCount} Promo • ${activeNewsCount} Berita`;
    if (sumMktSub) sumMktSub.innerText = `${reviewsData.length} ulasan pembeli terverifikasi`;
    if (sumRatBadge) sumRatBadge.innerText = `⭐ ${avgRating}`;
    
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

    if (document.getElementById('overview-financial-panel')?.style.display === 'block' && typeof window.renderFinancialReportPanel === 'function') {
        window.renderFinancialReportPanel();
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
        const isMpSub = Boolean(o.isMemberPlusOrder === true || o.orderType === 'MEMBER_PLUS_SUB' || String(o.id || '').toUpperCase().startsWith('MPLUS-'));
        const isTopup = Boolean(o.isTopupOrder === true || o.orderType === 'TOPUP_BALANCE' || String(o.id || '').toUpperCase().startsWith('TOPUP-'));
        if (isMpSub || isTopup) return false;

        const firstIt = (o.items && o.items[0]) ? o.items[0] : {};
        const isDfOrder = Boolean(o.digiflazzSku || firstIt.processType === 'digiflazz' || firstIt.processType === 'digiflazz_pasca' || firstIt.processType === 'ewallet_custom' || firstIt.isDigiflazz || firstIt.buyerSkuCode);

        const durDays = getOrderDurationDays(o);
        const endAt = o.subscriptionEndAt || (durDays > 0 && o.status === 'SUCCESS' ? (new Date(o.date).getTime() + durDays * 86400000) : 0);
        const isSubExpired = o.status === 'SUCCESS' && endAt > 0 && now >= endAt && o.subscriptionStatus !== 'KICKED';
        const isSubActive = o.status === 'SUCCESS' && endAt > 0 && now < endAt && o.subscriptionStatus !== 'KICKED';

        if (currentOrderFilter === 'LOCAL_ONLY') return !isDfOrder;
        if (currentOrderFilter === 'DIGIFLAZZ_ONLY') return isDfOrder;
        if (currentOrderFilter === 'NEED_ACTION') {
            return (!isDfOrder && (o.status === 'PENDING' || (o.status === 'SUCCESS' && !o.adminReply))) || isSubExpired;
        }
        if (currentOrderFilter === 'SUB_ACTIVE') return isSubActive;
        if (currentOrderFilter === 'SUB_EXPIRED') return isSubExpired;
        if (currentOrderFilter === 'SUCCESS') return o.status === 'SUCCESS' && (Boolean(o.adminReply) || Boolean(o.digiflazzSn) || Boolean(o.autoDelivered));
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

        const firstItemOrd = (o.items && o.items[0]) ? o.items[0] : {};
        const isDfOrd = Boolean(o.digiflazzSku || firstItemOrd.processType === 'digiflazz' || firstItemOrd.processType === 'digiflazz_pasca' || firstItemOrd.processType === 'ewallet_custom' || firstItemOrd.isDigiflazz || firstItemOrd.buyerSkuCode);

        let sBadge = `<span class="status-badge status-unpaid">MENUNGGU PEMBAYARAN</span>`;
        if (isDfOrd) {
            if (o.status === 'SUCCESS') sBadge = `<span class="status-badge status-success"><i class="fa-solid fa-bolt"></i> SUKSES OTOMATIS</span>`;
            else if (o.status === 'FAILED' || o.status === 'CANCELLED' || o.status === 'EXPIRED') sBadge = `<span class="status-badge status-failed">GAGAL OTOMATIS${o.balanceRefunded ? ' (REFUND)' : ''}</span>`;
            else sBadge = `<span class="status-badge status-pending"><i class="fa-solid fa-spinner fa-spin"></i> PENDING OTOMATIS</span>`;
        } else {
            if (o.status === 'PENDING') sBadge = `<span class="status-badge status-pending">DIPROSES ADMIN (LOKAL)</span>`;
            else if (o.status === 'FAILED') sBadge = `<span class="status-badge status-failed">GAGAL${o.balanceRefunded ? ' (REFUND)' : ''}</span>`;
            else if (o.status === 'CANCELLED') sBadge = `<span class="status-badge status-failed">DIBATALKAN${o.balanceRefunded ? ' (REFUND)' : ''}</span>`;
            else if (o.status === 'EXPIRED') sBadge = `<span class="status-badge status-failed">WAKTU HABIS</span>`;
            else if (o.status === 'SUCCESS' && !o.adminReply) sBadge = `<span class="status-badge status-pending">DIPROSES ADMIN (LOKAL)</span>`;
            else if (isSubExpired) sBadge = `<span class="status-badge status-failed">WAJIB KICK</span>`;
            else if (isSubKicked) sBadge = `<span class="status-badge status-anon">SUDAH DI-KICK</span>`;
            else if (o.status === 'SUCCESS') sBadge = `<span class="status-badge status-success">TERKIRIM & SELESAI</span>`;
        }

        const emailBadgeHtml = '';
        
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
        let paymentMethodStr = '<span class="status-badge status-unpaid"><i class="fa-solid fa-qrcode"></i> QRIS</span>';
        if (o.paymentMethod === 'cash') paymentMethodStr = '<span class="status-badge status-pending"><i class="fa-solid fa-barcode"></i> TUNAI</span>';
        else if (o.paymentMethod === 'balance') paymentMethodStr = '<span class="status-badge status-success"><i class="fa-solid fa-wallet"></i> SALDO AKUN</span>';
        
        const memberMatch = allUsersList.find(u => u.uid === o.userId || (o.userEmail && u.email?.toLowerCase() === o.userEmail.toLowerCase()));
        const buyerPhone = o.userPhone || (memberMatch ? (memberMatch.phone || memberMatch.whatsapp || '') : '');

        let actionBtn = '';
        if (isDfOrd) {
            actionBtn = `<button class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${o.dbId}')"><i class="fa-solid fa-eye"></i> Status</button>`;
        } else if (isSubExpired) {
            actionBtn = `
                <button class="btn btn-success btn-sm" onclick="window.markSubscriptionKicked('${o.dbId}')">
                    <i class="fa-solid fa-check"></i> Kick Selesai
                </button>
                <button class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${o.dbId}')">
                    <i class="fa-solid fa-sliders"></i>
                </button>`;
        } else if (o.status === 'PENDING' || o.status === 'UNPAID' || o.status === 'PENDING_PAYMENT' || (o.status === 'SUCCESS' && !o.adminReply)) {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="window.promptProcessOrder('${o.dbId}')"><i class="fa-solid fa-sliders"></i> Proses Lokal</button>`;
        } else {
            actionBtn = `<button class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${o.dbId}')"><i class="fa-solid fa-receipt"></i> Detail</button>`;
        }
            
        let deleteBtn = `<button aria-label="Hapus Order" class="btn-icon-only text-danger" style="width:34px; height:34px;" onclick="window.promptDeleteOrder('${o.dbId}', '${escapeJsStr(o.id)}')"><i class="fa-solid fa-trash"></i></button>`;
        
        const isMpOrder = isOrderFromMemberPlusUser(o);
        const mpOrderBadge = isMpOrder
            ? `<div style="margin-top:4px;"><span class="status-badge status-memberplus-gold" style="font-size:0.58rem; padding:2px 7px;"><i class="fa-solid fa-crown"></i> MEMBER PLUS</span></div>`
            : '';

        html += `<tr class="${isSubExpired ? 'row-sub-expired' : ''} ${isMpOrder ? 'row-order-memberplus' : ''}">
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
                ${mpOrderBadge}
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

    // Tampilkan Kotak Kontrol Digiflazz jika pesanan menggunakan produk Digiflazz
    const dfBox = document.getElementById('proc-digiflazz-box');
    const dfBadge = document.getElementById('proc-df-status-badge');
    const dfInfo = document.getElementById('proc-df-info-text');
    const firstItem = (order.items && order.items[0]) ? order.items[0] : {};
    const isDfOrder = Boolean(
        order.digiflazzSku ||
        firstItem.processType === 'digiflazz' ||
        firstItem.processType === 'digiflazz_pasca' ||
        firstItem.isDigiflazz ||
        firstItem.buyerSkuCode
    );
    if (dfBox) {
        if (isDfOrder) {
            dfBox.style.display = 'block';
            const skuCode = order.digiflazzSku || firstItem.buyerSkuCode || '-';
            const custNo = order.digiflazzCustomerNo || order.targetId || firstItem.playerInfo || '-';
            const dfSt = order.digiflazzStatus || (order.status === 'SUCCESS' && order.adminReply ? 'Sukses' : 'Belum Dikirim / Pending');
            const rcStr = order.digiflazzRc ? ` (RC: ${order.digiflazzRc})` : '';
            const snStr = order.digiflazzSn ? `<br><b>SN / Token:</b> <code class="code-mono">${window.escapeHtml(order.digiflazzSn)}</code>` : '';
            if (dfBadge) {
                dfBadge.className = `status-badge ${dfSt === 'Sukses' ? 'status-success' : (dfSt === 'Gagal' ? 'status-failed' : 'status-pending')}`;
                dfBadge.innerText = `${dfSt.toUpperCase()}${rcStr}`;
            }
            if (dfInfo) {
                dfInfo.innerHTML = `<b>SKU:</b> <code class="code-mono">${window.escapeHtml(skuCode)}</code> &bull; <b>Tujuan:</b> <code class="code-mono">${window.escapeHtml(custNo)}</code>${snStr}`;
            }
        } else {
            dfBox.style.display = 'none';
        }
    }

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

    const printWrapEl = document.getElementById('proc-print-receipt-wrap');
    if (printWrapEl) {
        printWrapEl.style.display = (order.status === 'SUCCESS') ? 'flex' : 'none';
    }

    // Pesanan Digiflazz 100% otomatis (tidak diproses manual oleh Admin); Pesanan Stok Lokal yang sudah SUCCESS juga terkunci
    const isCompletedLocked = Boolean(
        isDfOrder ||
        (order.status === 'SUCCESS' && (order.adminReply || order.digiflazzSn || order.autoDelivered)) ||
        order.status === 'FAILED' ||
        order.status === 'CANCELLED'
    );
    const replyArea = document.getElementById('proc-admin-reply');
    const replyLbl = document.getElementById('proc-admin-reply-label');
    const pullStockBtn = document.getElementById('btn-proc-pull-stock');
    const actionBtnsWrap = document.getElementById('proc-action-buttons-wrap');
    const lockedBanner = document.getElementById('proc-completed-locked-banner');

    if (isCompletedLocked) {
        if (replyArea) {
            replyArea.readOnly = true;
            if (!replyArea.value && order.digiflazzSn) {
                replyArea.value = `SN / Token: ${order.digiflazzSn}`;
            } else if (!replyArea.value && isDfOrder) {
                replyArea.value = `Status Otomatis Digiflazz: ${order.digiflazzStatus || order.status}`;
            }
        }
        if (replyLbl) replyLbl.innerText = isDfOrder ? 'Rincian Status Otomatis Digiflazz' : 'Rincian Pesanan (Terkunci)';
        if (pullStockBtn) pullStockBtn.style.display = 'none';
        if (actionBtnsWrap) actionBtnsWrap.style.display = 'none';
        if (lockedBanner) lockedBanner.style.display = (order.status === 'SUCCESS') ? 'block' : 'none';
    } else {
        if (replyArea) replyArea.readOnly = false;
        if (replyLbl) replyLbl.innerText = 'Rincian Akun / Stok Lokal yang Dikirim';
        if (pullStockBtn) pullStockBtn.style.display = 'inline-flex';
        if (actionBtnsWrap) actionBtnsWrap.style.display = 'flex';
        if (lockedBanner) lockedBanner.style.display = 'none';
    }

    window.openModal('modal-process-order');
};

window.copyCompletedOrderReply = function() {
    const val = document.getElementById('proc-admin-reply')?.value || '';
    if (!val) return;
    window.copyTextToClipboard(val, 'Rincian Pesanan');
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

window.markOrderComplete = async function(newStatus, pinAlreadyVerified = false) {
    const dbId = document.getElementById('proc-order-dbid').value;
    let replyText = document.getElementById('proc-admin-reply').value.trim();
    if (!dbId) return;
    const orderForPin = orders.find(o => o.dbId === dbId);
    if (newStatus === 'SUCCESS' && !pinAlreadyVerified && siteSettings.requireAdminPin !== false && (siteSettings.adminSecurityPin || '').trim() !== '') {
        window.requestAdminPinVerification(`Selesaikan Pesanan Manual #${orderForPin ? orderForPin.id : ''}`, () => {
            window.markOrderComplete(newStatus, true);
        });
        return;
    }
    
    const order = orders.find(o => o.dbId === dbId);
    const durDays = getOrderDurationDays(order);
    const now = Date.now();

    // Saat Admin menekan Selesaikan (SUCCESS), pastikan adminReply terisi agar status beralih ke TERKIRIM & SELESAI
    if (newStatus === 'SUCCESS' && !replyText) {
        replyText = 'Pesanan telah selesai diproses oleh Admin.';
    }

    const updatePayload = {
        status: newStatus,
        adminReply: newStatus === 'PENDING' ? '' : replyText,
        paymentVerified: newStatus === 'SUCCESS' || newStatus === 'PENDING'
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

        if (newStatus === 'SUCCESS' && order && (order.isTopupOrder === true || order.orderType === 'TOPUP_BALANCE')) {
            await creditTopupOrderBalanceIfNeeded(order, dbId);
        } else if ((newStatus === 'FAILED' || newStatus === 'CANCELLED') && order) {
            await refundFailedOrderBalanceIfNeeded(order, dbId, 'Pesanan Dibatalkan oleh Admin');
        }

        if (newStatus === 'SUCCESS' && order) {
            window.showToast('Pesanan Selesai', `Pesanan #${order.id} telah diselesaikan.`, 'success');
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
// SUB-TAB CS BANTUAN: CHAT BANTUAN VS SARAN PRODUK
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

// Saat Admin menandai sudah dibaca, hapus saran produk secara PERMANEN dari seluruh lapisan database
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
function isChatUserMemberPlus(chat) {
    if (!chat) return false;
    if (chat.isMemberPlusUser === true) return true;
    const matchedUser = allUsersList.find(u =>
        (chat.id && u.uid === chat.id) ||
        (chat.uid && u.uid === chat.uid) ||
        (chat.userEmail && u.email && u.email.toLowerCase() === chat.userEmail.toLowerCase())
    );
    return isAdminUserMemberPlusActive(matchedUser);
}

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
        const isMpChat = isChatUserMemberPlus(chat);
        const mpChatBadge = isMpChat
            ? `<span class="status-badge status-memberplus-gold" style="font-size:0.55rem; padding:1px 6px;"><i class="fa-solid fa-crown"></i> PLUS</span>`
            : '';

        html += `
            <div class="wa-chat-item ${isActive ? 'active' : ''} ${isMpChat ? 'chat-memberplus' : ''}" onclick="window.openAdminChatDetailDesk('${escapeJsStr(chat.id)}')">
                <div class="wa-avatar ${isMpChat ? 'avatar-memberplus-gold' : ''}">${window.escapeHtml(userName.charAt(0).toUpperCase())}</div>
                <div style="flex:1; min-width:0;">
                    <div class="flex-between align-center" style="gap:4px;">
                        <div style="display:flex; align-items:center; gap:5px; min-width:0;">
                            <strong class="text-dark" style="font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(userName)}</strong>
                            ${mpChatBadge}
                        </div>
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

    const isMpActiveChat = isChatUserMemberPlus(chat);
    const activeUserEl = document.getElementById('active-chat-user');
    if (activeUserEl) {
        const baseName = window.escapeHtml(chat.userInfo || `Pelanggan #${chat.id.slice(-4)}`);
        activeUserEl.innerHTML = isMpActiveChat
            ? `${baseName} <span class="status-badge status-memberplus-gold" style="font-size:0.6rem; padding:2px 7px; margin-left:6px;"><i class="fa-solid fa-crown"></i> MEMBER PLUS</span>`
            : baseName;
    }
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
                isBrandHidden: Boolean(p.isBrandHidden),
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

function getCategoryDisplayLabel(type) {
    const t = String(type || 'app').toLowerCase();
    if (t === 'game') return 'GAME';
    if (t === 'pulsa') return 'PULSA & DATA';
    if (t === 'pln') return 'LISTRIK PLN';
    if (t === 'ewallet') return 'E-WALLET';
    if (t === 'ppob') return 'TAGIHAN PPOB';
    if (t === 'tools') return 'TOOLS & EMAIL';
    return 'APLIKASI';
}

function detectDefaultCheckIdSku(brandName, prodType, inputType) {
    const b = String(brandName || '').toUpperCase();
    const t = String(prodType || '').toLowerCase();
    const inp = String(inputType || '').toLowerCase();
    if (t === 'pln' || inp === 'pln_token' || b.includes('PLN')) return 'pln';
    if (t === 'ewallet' || inp === 'ewallet_no' || b.includes('DANA') || b.includes('OVO') || b.includes('GOPAY') || b.includes('GO-PAY') || b.includes('SHOPEEPAY') || b.includes('LINKAJA') || b.includes('ISAKU')) {
        if (b.includes('DANA')) return 'dana';
        if (b.includes('OVO')) return 'ovo';
        if (b.includes('GOPAY') || b.includes('GO-PAY')) return 'gopay';
        if (b.includes('SHOPEE')) return 'shopeepay';
        if (b.includes('LINKAJA')) return 'linkaja';
        if (b.includes('ISAKU')) return 'isaku';
        return 'ewallet';
    }
    if (b.includes('MOBILE LEGENDS') || b.includes('MLBB')) return 'ml';
    if (b.includes('FREE FIRE') || b === 'FF') return 'ff';
    if (b.includes('PUBG')) return 'pubgm';
    if (b.includes('GENSHIN')) return 'genshin';
    if (b.includes('HONKAI')) return 'hsr';
    if (b.includes('VALORANT')) return 'valorant';
    if (b.includes('HONOR OF KINGS') || b.includes('HOK')) return 'hok';
    if (b.includes('CALL OF DUTY') || b.includes('CODM')) return 'codm';
    if (b.includes('ARENA BREAKOUT')) return 'ab';
    if (b.includes('POINT BLANK') || b.includes('PB')) return 'pb';
    if (b.includes('SUPER SUS')) return 'supersus';
    if (b.includes('BLOOD STRIKE')) return 'bloodstrike';
    if (b.includes('MAGIC CHESS')) return 'mcgg';
    if (t === 'game') return 'game_auto';
    return '';
}

window.autoFillCheckIdSkuByBrand = function() {
    const brandName = document.getElementById('manage-brand-name')?.value.trim() || '';
    const prodType = document.getElementById('manage-prod-type')?.value || 'app';
    const inputType = document.getElementById('manage-input-type')?.value || 'id_zone';
    const skuInp = document.getElementById('manage-check-id-sku');
    const chkEl = document.getElementById('manage-auto-check-id');
    const detected = detectDefaultCheckIdSku(brandName, prodType, inputType);
    if (skuInp) {
        skuInp.value = detected || brandName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    }
    if (chkEl && detected) {
        chkEl.checked = true;
    }
    window.showToast('SKU Cek ID Terisi', `Kode Cek ID disetel ke "${skuInp?.value || '-'}"`, 'info');
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

    const dfBalance = Number(siteSettings.digiflazzLastBalance || 0);
    const guardActive = siteSettings.digiflazzBalanceGuard !== false;

    let html = '';
    list.forEach(b => {
        const safeJsBrand = escapeJsStr(b.brandName);
        const typeLabel = getCategoryDisplayLabel(b.type);
        const imgHtml = b.imgUrlBase64
            ? `<img src="${b.imgUrlBase64}" class="catalog-thumb" alt="${window.escapeHtml(b.brandName)}">`
            : `<div class="catalog-thumb flex-center fw-900" style="background:var(--primary); color:#fff; font-size:1.25rem;">${window.escapeHtml(b.brandName.charAt(0))}</div>`;

        const autoCount = b.items.filter(i => (i.processType || 'auto') === 'auto').length;
        const dfCount = b.items.filter(i => i.processType === 'digiflazz' || i.processType === 'digiflazz_pasca' || i.processType === 'ewallet_custom' || i.isDigiflazz).length;
        const askAutoCount = b.items.filter(i => i.processType === 'ask_auto').length;
        const manualCount = b.items.filter(i => i.processType === 'manual').length;
        const gangguanVarCount = b.items.filter(i => Boolean(i.isVariantGangguan || i.sellerProductStatus === false)).length;
        const habisVarCount = b.items.filter(i => {
            if (i.isVariantGangguan || i.sellerProductStatus === false) return false;
            if ((i.processType === 'digiflazz' || i.isDigiflazz) && guardActive && Number(i.digiflazzModalPrice || 0) > 0 && dfBalance < Number(i.digiflazzModalPrice || 0)) {
                return true;
            }
            return Boolean(i.soldOut);
        }).length;

        const firstIt = b.items[0] || {};
        const hasAutoCheckId = Boolean(b.autoCheckIdBeforePay || firstIt.autoCheckIdBeforePay);
        const checkSku = b.checkIdSkuCode || firstIt.checkIdSkuCode || '';

        const totalVaultReady = b.items.reduce((acc, it) => acc + countReadyStockSlotsForVariant(b.brandName, it.name), 0);

        let topStatusHtml = '<span class="status-badge status-success" style="font-size:0.6rem;">AKTIF</span>';
        if (b.isGangguan) {
            topStatusHtml = '<span class="status-badge status-failed" style="font-size:0.6rem;">GANGGUAN</span>';
        } else if (gangguanVarCount > 0 && gangguanVarCount === b.items.length) {
            topStatusHtml = '<span class="status-badge status-failed" style="font-size:0.6rem;">GANGGUAN</span>';
        } else if (habisVarCount > 0 && habisVarCount === b.items.length) {
            topStatusHtml = '<span class="status-badge status-unpaid" style="font-size:0.6rem;">STOK HABIS</span>';
        }

        html += `
        <div class="catalog-card">
            <div>
                <div class="catalog-card-top mb-2">
                    ${imgHtml}
                    <div style="flex:1; min-width:0;">
                        <div class="flex-between align-center mb-1">
                            <span class="status-badge status-pending" style="font-size:0.6rem;">${typeLabel}</span>
                            ${topStatusHtml}
                        </div>
                        <h4 class="m-0 text-dark" style="font-size:1.02rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(b.brandName)}</h4>
                        <span class="text-xs text-muted">${b.items.length} Variasi &bull; ${dfCount > 0 ? `API Otomatis` : `Stok: <b class="text-primary">${totalVaultReady >= 999 ? 'Tersedia' : totalVaultReady}</b>`}</span>
                    </div>
                </div>
                <div class="flex-wrap-gap mb-2" style="gap:4px;">
                    ${dfCount > 0 ? `<span class="status-badge status-primary" style="font-size:0.58rem; background:var(--primary); color:#fff;">${dfCount} Digiflazz</span>` : ''}
                    ${autoCount > 0 ? `<span class="status-badge status-success" style="font-size:0.58rem;">${autoCount} Stok Lokal</span>` : ''}
                    ${askAutoCount > 0 ? `<span class="status-badge status-vip" style="font-size:0.58rem;">${askAutoCount} Tanya/Auto</span>` : ''}
                    ${manualCount > 0 ? `<span class="status-badge status-unpaid" style="font-size:0.58rem;">${manualCount} Manual</span>` : ''}
                    ${hasAutoCheckId ? `<span class="status-badge status-success" style="font-size:0.56rem;"><i class="fa-solid fa-user-check"></i> Cek ID (${window.escapeHtml(checkSku || 'Auto')})</span>` : ''}
                    ${gangguanVarCount > 0 ? `<span class="status-badge status-failed" style="font-size:0.56rem;">${gangguanVarCount} Gangguan</span>` : ''}
                    ${habisVarCount > 0 ? `<span class="status-badge status-unpaid" style="font-size:0.56rem;">${habisVarCount} Habis</span>` : ''}
                    ${b.isBrandHidden || b.items.some(i => i.isHidden) ? `<span class="status-badge status-hidden-badge" style="font-size:0.56rem;"><i class="fa-solid fa-eye-slash"></i> ${b.isBrandHidden ? 'Produk Disembunyikan' : b.items.filter(i => i.isHidden).length + ' Varian Disembunyikan'}</span>` : ''}
                </div>
            </div>
            <div class="flex-gap mt-2">
                <button class="btn btn-outline btn-sm flex-1" onclick="window.openEditBrandModal('${safeJsBrand}')">
                    <i class="fa-solid fa-pen-to-square"></i> Kelola Variasi
                </button>
                <button class="btn ${b.isBrandHidden || b.items.every(i => i.isHidden) ? 'btn-warning' : 'btn-outline'} btn-sm" onclick="window.toggleBrandHiddenQuick('${safeJsBrand}')" title="${b.isBrandHidden || b.items.every(i => i.isHidden) ? 'Tampilkan kembali di Web User' : 'Sembunyikan produk dari Web User'}">
                    <i class="fa-solid ${b.isBrandHidden || b.items.every(i => i.isHidden) ? 'fa-eye' : 'fa-eye-slash'}"></i>
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
    const checkIdWrap = document.getElementById('manage-check-id-config-wrap');
    const inpSelect = document.getElementById('manage-input-type');

    const needsTargetInput = (type === 'game' || type === 'tools' || type === 'pulsa' || type === 'pln' || type === 'ewallet' || type === 'ppob');
    if (gameWrap) gameWrap.style.display = needsTargetInput ? 'block' : 'none';
    if (appWrap) appWrap.style.display = (type === 'app') ? 'block' : 'none';
    if (checkIdWrap) checkIdWrap.style.display = (type === 'game' || type === 'pln' || type === 'ewallet' || type === 'ppob') ? 'block' : 'none';

    if (inpSelect) {
        if (type === 'pulsa') {
            inpSelect.value = 'phone';
        } else if (type === 'pln') {
            inpSelect.value = 'pln_token';
        } else if (type === 'ewallet') {
            inpSelect.value = 'ewallet_no';
        } else if (type === 'ppob') {
            inpSelect.value = 'pasca_no';
        }
    }
};

window.toggleTempNominalDigiflazzFields = function() {
    const statusMode = document.getElementById('temp-nom-status')?.value || 'auto';
    const dfWrap = document.getElementById('temp-nom-digiflazz-wrap');
    const ewWrap = document.getElementById('temp-nom-ewallet-custom-wrap');
    const stockModeWrap = document.getElementById('temp-nom-stock-mode-wrap');
    const isDf = (statusMode === 'digiflazz' || statusMode === 'digiflazz_pasca' || statusMode === 'ewallet_custom');
    if (dfWrap) dfWrap.style.display = isDf ? 'grid' : 'none';
    if (ewWrap) ewWrap.style.display = (statusMode === 'ewallet_custom') ? 'grid' : 'none';
    if (stockModeWrap) stockModeWrap.style.opacity = isDf ? '0.45' : '1';
    if (statusMode === 'ewallet_custom') {
        const priceInp = document.getElementById('temp-nom-price');
        if (priceInp && !priceInp.value) priceInp.value = '10000';
    }
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
    if (document.getElementById('manage-brand-hidden')) document.getElementById('manage-brand-hidden').checked = false;

    const autoCheckEl = document.getElementById('manage-auto-check-target') || document.getElementById('manage-auto-check-id');
    const checkSkuEl = document.getElementById('manage-check-id-sku');
    if (autoCheckEl) autoCheckEl.checked = false;
    if (checkSkuEl) checkSkuEl.value = '';

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

    const firstIt = bObj.items[0] || {};
    document.getElementById('modal-prod-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Produk: ${window.escapeHtml(brandName)}`;
    document.getElementById('manage-orig-brand').value = brandName;
    document.getElementById('manage-brand-name').value = bObj.brandName;
    document.getElementById('manage-prod-type').value = bObj.type || 'app';
    document.getElementById('manage-input-type').value = firstIt.inputType || 'id_zone';
    document.getElementById('manage-prod-desc').value = bObj.desc || '';
    document.getElementById('manage-brand-gangguan').checked = Boolean(bObj.isGangguan);
    if (document.getElementById('manage-brand-hidden')) document.getElementById('manage-brand-hidden').checked = Boolean(bObj.isBrandHidden || bObj.items.every(i => i.isHidden));

    const autoCheckEl = document.getElementById('manage-auto-check-target') || document.getElementById('manage-auto-check-id');
    const checkSkuEl = document.getElementById('manage-check-id-sku');
    const defaultSku = detectDefaultCheckIdSku(bObj.brandName, bObj.type, firstIt.inputType);
    if (autoCheckEl) {
        autoCheckEl.checked = (firstIt.autoCheckIdBeforePay !== undefined)
            ? Boolean(firstIt.autoCheckIdBeforePay)
            : Boolean(defaultSku);
    }
    if (checkSkuEl) {
        checkSkuEl.value = firstIt.checkIdSkuCode || defaultSku || '';
    }

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
        variantDesc: i.variantDesc || '',
        durationDays: parseInt(i.durationDays || 0, 10),
        processType: i.processType || 'auto',
        stockMode: i.stockMode || 'PRIVATE',
        buyerSkuCode: i.buyerSkuCode || '',
        digiflazzModalPrice: Number(i.digiflazzModalPrice || 0),
        minCustomNominal: Number(i.minCustomNominal || 10000),
        maxCustomNominal: Number(i.maxCustomNominal || 500000),
        adminFeeNominal: Number(i.adminFeeNominal || 1500),
        cutOffStart: i.cutOffStart || '',
        cutOffEnd: i.cutOffEnd || '',
        multi: i.multi !== false,
        isVariantGangguan: Boolean(i.isVariantGangguan || i.sellerProductStatus === false),
        isHidden: Boolean(i.isHidden),
        isCheckUsernameProduct: Boolean(i.isCheckUsernameProduct === true),
        memberPlusPriceNum: Number(i.memberPlusPriceNum || 0),
        soldOut: Boolean(i.soldOut),
        manualLockSoldOut: Boolean(i.manualLockSoldOut)
    }));

    window.cancelEditTempNominal();
    window.toggleManageGameInput();
    window.renderTempNominals();
    window.openModal('modal-manage-product');
};

window.onToggleTempCheckUsernameCheckbox = function(chkEl) {
    const priceInp = document.getElementById('temp-nom-price');
    if (chkEl && chkEl.checked && priceInp) {
        priceInp.value = '0';
    }
};

window.addTempNominal = function() {
    const name = document.getElementById('temp-nom-name').value.trim();
    const isCheckUsernameProduct = Boolean(document.getElementById('temp-nom-is-check-username')?.checked);
    const rawPriceVal = parseInt(document.getElementById('temp-nom-price').value, 10);
    const price = isCheckUsernameProduct ? 0 : (isNaN(rawPriceVal) ? 0 : rawPriceVal);
    const desc = (document.getElementById('temp-nom-desc')?.value || '').trim();
    const durationDays = parseInt(document.getElementById('temp-nom-duration')?.value || '0', 10) || 0;
    const statusMode = document.getElementById('temp-nom-status').value;
    const stockMode = document.getElementById('temp-nom-stock-mode')?.value || 'PRIVATE';
    const buyerSkuCode = (document.getElementById('temp-nom-sku')?.value || '').trim();
    const digiflazzModalPrice = parseInt(document.getElementById('temp-nom-modal')?.value || '0', 10) || 0;
    const minCustomNominal = Math.max(1000, parseInt(document.getElementById('temp-nom-min-custom')?.value || '10000', 10) || 10000);
    const maxCustomNominal = Math.min(500000, Math.max(minCustomNominal, parseInt(document.getElementById('temp-nom-max-custom')?.value || '500000', 10) || 500000));
    const adminFeeNominal = Math.max(0, parseInt(document.getElementById('temp-nom-admin-fee')?.value || '1500', 10) || 0);
    const editIdx = parseInt(document.getElementById('edit-variant-idx')?.value || '-1', 10);

    if (!name || (!isCheckUsernameProduct && statusMode !== 'digiflazz_pasca' && statusMode !== 'ewallet_custom' && price <= 0)) {
        window.customAlert('Belum Lengkap', 'Masukkan nama variasi dan harga yang valid (atau centang Produk Cek Username untuk harga Rp 0).', 'warning');
        return;
    }

    if ((statusMode === 'digiflazz' || statusMode === 'digiflazz_pasca') && !buyerSkuCode) {
        window.customAlert('Kode SKU Diperlukan', 'Masukkan Kode SKU Buyer Digiflazz untuk variasi otomatis Digiflazz.', 'warning');
        return;
    }

    const finalPrice = isCheckUsernameProduct ? 0 : (statusMode === 'ewallet_custom' ? (price > 0 ? price : minCustomNominal) : price);

    if (editIdx >= 0 && editIdx < tempProductVariants.length) {
        tempProductVariants[editIdx].name = name;
        tempProductVariants[editIdx].priceNum = finalPrice;
        tempProductVariants[editIdx].isCheckUsernameProduct = isCheckUsernameProduct;
        if (isCheckUsernameProduct) tempProductVariants[editIdx].memberPlusPriceNum = 0;
        tempProductVariants[editIdx].variantDesc = desc;
        tempProductVariants[editIdx].durationDays = durationDays;
        tempProductVariants[editIdx].processType = statusMode;
        tempProductVariants[editIdx].stockMode = stockMode;
        tempProductVariants[editIdx].buyerSkuCode = buyerSkuCode || (statusMode === 'ewallet_custom' ? 'CUSTOM_EWALLET' : '');
        tempProductVariants[editIdx].digiflazzModalPrice = digiflazzModalPrice;
        tempProductVariants[editIdx].minCustomNominal = minCustomNominal;
        tempProductVariants[editIdx].maxCustomNominal = maxCustomNominal;
        tempProductVariants[editIdx].adminFeeNominal = adminFeeNominal;
        window.showToast('Diperbarui', `Variasi "${name}" berhasil diperbarui.`, 'info');
    } else {
        tempProductVariants.push({
            dbId: null,
            name: name,
            priceNum: finalPrice,
            isCheckUsernameProduct: isCheckUsernameProduct,
            variantDesc: desc,
            durationDays: durationDays,
            processType: statusMode,
            stockMode: stockMode,
            buyerSkuCode: buyerSkuCode || (statusMode === 'ewallet_custom' ? 'CUSTOM_EWALLET' : ''),
            digiflazzModalPrice: digiflazzModalPrice,
            minCustomNominal: minCustomNominal,
            maxCustomNominal: maxCustomNominal,
            adminFeeNominal: adminFeeNominal,
            isVariantGangguan: false,
            isHidden: false,
            memberPlusPriceNum: 0,
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
    document.getElementById('temp-nom-price').value = v.isCheckUsernameProduct ? '0' : (v.priceNum ?? '');
    if (document.getElementById('temp-nom-is-check-username')) {
        document.getElementById('temp-nom-is-check-username').checked = Boolean(v.isCheckUsernameProduct);
    }
    if (document.getElementById('temp-nom-desc')) document.getElementById('temp-nom-desc').value = v.variantDesc || '';
    if (document.getElementById('temp-nom-duration')) document.getElementById('temp-nom-duration').value = v.durationDays || 0;
    document.getElementById('temp-nom-status').value = v.processType || 'auto';
    if (document.getElementById('temp-nom-stock-mode')) document.getElementById('temp-nom-stock-mode').value = v.stockMode || 'PRIVATE';
    if (document.getElementById('temp-nom-sku')) document.getElementById('temp-nom-sku').value = v.buyerSkuCode || '';
    if (document.getElementById('temp-nom-modal')) document.getElementById('temp-nom-modal').value = v.digiflazzModalPrice || 0;
    if (document.getElementById('temp-nom-min-custom')) document.getElementById('temp-nom-min-custom').value = v.minCustomNominal || 10000;
    if (document.getElementById('temp-nom-max-custom')) document.getElementById('temp-nom-max-custom').value = v.maxCustomNominal || 500000;
    if (document.getElementById('temp-nom-admin-fee')) document.getElementById('temp-nom-admin-fee').value = v.adminFeeNominal ?? 1500;
    window.toggleTempNominalDigiflazzFields();

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
    if (document.getElementById('temp-nom-is-check-username')) document.getElementById('temp-nom-is-check-username').checked = false;
    if (document.getElementById('temp-nom-desc')) document.getElementById('temp-nom-desc').value = '';
    if (document.getElementById('temp-nom-duration')) document.getElementById('temp-nom-duration').value = '0';
    document.getElementById('temp-nom-status').value = 'auto';
    if (document.getElementById('temp-nom-stock-mode')) document.getElementById('temp-nom-stock-mode').value = 'PRIVATE';
    if (document.getElementById('temp-nom-sku')) document.getElementById('temp-nom-sku').value = '';
    if (document.getElementById('temp-nom-modal')) document.getElementById('temp-nom-modal').value = '0';
    if (document.getElementById('temp-nom-min-custom')) document.getElementById('temp-nom-min-custom').value = '10000';
    if (document.getElementById('temp-nom-max-custom')) document.getElementById('temp-nom-max-custom').value = '500000';
    if (document.getElementById('temp-nom-admin-fee')) document.getElementById('temp-nom-admin-fee').value = '1500';
    window.toggleTempNominalDigiflazzFields();

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

        let modeBadge = '<span class="status-badge status-success" style="font-size:0.58rem;">STOK LOKAL</span>';
        if (v.processType === 'digiflazz') {
            modeBadge = `<span class="status-badge status-primary" style="font-size:0.58rem; background:var(--primary); color:#fff;">DIGIFLAZZ (${window.escapeHtml(v.buyerSkuCode || '-')})</span>`;
        } else if (v.processType === 'digiflazz_pasca') {
            modeBadge = `<span class="status-badge status-warning" style="font-size:0.58rem;">PASCA PPOB (${window.escapeHtml(v.buyerSkuCode || '-')})</span>`;
        } else if (v.processType === 'ewallet_custom') {
            modeBadge = `<span class="status-badge status-primary" style="font-size:0.58rem; background:#0284c7; color:#fff;">BEBAS NOMINAL (Rp${Number(v.minCustomNominal||10000).toLocaleString('id-ID')} - Rp${Number(v.maxCustomNominal||500000).toLocaleString('id-ID')})</span>`;
        } else if (v.processType === 'manual') {
            modeBadge = '<span class="status-badge status-unpaid" style="font-size:0.58rem;">MANUAL</span>';
        } else if (v.processType === 'ask_auto') {
            modeBadge = '<span class="status-badge status-vip" style="font-size:0.58rem;">TANYA/AUTO</span>';
        }

        const isDfMode = (v.processType === 'digiflazz' || v.processType === 'digiflazz_pasca' || v.processType === 'ewallet_custom');
        const formatBadge = (!isDfMode && v.stockMode === 'EMAIL_OAUTH')
            ? `<span class="status-badge status-email-oauth" style="font-size:0.58rem;">PRODUK EMAIL</span>`
            : ((!isDfMode && v.stockMode === 'SHARING') ? `<span class="status-badge status-pending" style="font-size:0.58rem;">SHARING</span>` : '');

        const vaultSlots = countReadyStockSlotsForVariant(currentBrandName, v.name);
        const vaultBadge = isDfMode
            ? `<span class="status-badge status-success" style="font-size:0.58rem;">API 24 Jam</span>`
            : `<span class="status-badge status-anon" style="font-size:0.58rem;">Stok Lokal: ${vaultSlots >= 999 ? 'Tersedia' : vaultSlots}</span>`;

        html += `
        <div class="flex-between align-center p-2" style="background:var(--surface); border:1.5px solid var(--border); border-radius:8px; gap:8px; flex-wrap:wrap;">
            <div style="flex:1; min-width:180px;">
                <div class="flex-gap align-center flex-wrap-gap">
                    <strong class="text-dark text-sm">${window.escapeHtml(v.name)}</strong>
                    <span class="text-primary fw-bold text-xs">${v.isCheckUsernameProduct ? '<span class="status-badge status-success" style="font-size:0.6rem;">CEK USERNAME (Rp0 / KEBAL MARKUP)</span>' : (v.processType === 'ewallet_custom' ? `Admin +Rp${Number(v.adminFeeNominal||0).toLocaleString('id-ID')}` : `Rp${Number(v.priceNum || 0).toLocaleString('id-ID')}`)}</span>
                    ${modeBadge}
                    ${formatBadge}
                    ${durBadge}
                    ${vaultBadge}
                </div>
                ${v.variantDesc ? `<div class="text-xs text-muted mt-1">${window.escapeHtml(v.variantDesc)}</div>` : ''}
            </div>
            <div class="flex-gap align-center flex-wrap-gap">
                <button type="button" class="btn btn-sm ${v.isHidden ? 'btn-warning' : 'btn-outline'}" onclick="window.toggleTempVariantHidden(${idx})" title="Sembunyikan / Tampilkan Variasi Ini (Misal untuk SKU Cek ID)">
                    <i class="fa-solid ${v.isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i> ${v.isHidden ? 'Disembunyikan' : 'Tampil'}
                </button>
                <button type="button" class="btn btn-sm ${v.isVariantGangguan ? 'btn-danger' : 'btn-outline'}" onclick="window.toggleTempVariantGangguan(${idx})" title="Tandai Gangguan pada Variasi Ini">
                    <i class="fa-solid fa-triangle-exclamation"></i> ${v.isVariantGangguan ? 'Gangguan' : 'Normal'}
                </button>
                <button type="button" class="btn btn-sm ${v.soldOut ? 'btn-warning' : 'btn-success'}" onclick="window.toggleTempVariantSoldOut(${idx})" title="Tandai Stok Habis / Tersedia">
                    ${v.soldOut ? 'Stok Habis' : 'Tersedia'}
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

window.toggleTempVariantGangguan = function(idx) {
    if (tempProductVariants[idx]) {
        tempProductVariants[idx].isVariantGangguan = !tempProductVariants[idx].isVariantGangguan;
        window.renderTempNominals();
    }
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
    const isBrandHidden = Boolean(document.getElementById('manage-brand-hidden')?.checked);

    const autoCheckIdBeforePay = (prodType === 'game' || prodType === 'pln' || prodType === 'ewallet' || prodType === 'ppob')
        ? Boolean((document.getElementById('manage-auto-check-target') || document.getElementById('manage-auto-check-id'))?.checked)
        : false;
    const rawCheckSku = (document.getElementById('manage-check-id-sku')?.value || '').trim();
    const checkIdSkuCode = rawCheckSku || detectDefaultCheckIdSku(brandName, prodType, inputType);

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
            const isDfMode = (procMode === 'digiflazz' || procMode === 'digiflazz_pasca' || procMode === 'ewallet_custom');
            const effectiveSoldOut = (procMode === 'auto' && readyVaultCount > 0 && !v.manualLockSoldOut)
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
                autoCheckIdBeforePay: autoCheckIdBeforePay,
                checkIdSkuCode: checkIdSkuCode,
                desc: desc,
                imgUrlBase64: tempManageImgBase64,
                isGangguan: isGangguan,
                isBrandHidden: isBrandHidden,
                isHidden: Boolean(v.isHidden || isBrandHidden),
                isCheckUsernameProduct: Boolean(v.isCheckUsernameProduct === true),
                priceNum: v.isCheckUsernameProduct ? 0 : Number(v.priceNum || 0),
                memberPlusPriceNum: v.isCheckUsernameProduct ? 0 : Number(v.memberPlusPriceNum || 0),
                isVariantGangguan: Boolean(v.isVariantGangguan),
                sellerProductStatus: !v.isVariantGangguan,
                processType: procMode,
                isDigiflazz: isDfMode,
                buyerSkuCode: isDfMode ? (v.buyerSkuCode || '') : '',
                digiflazzModalPrice: isDfMode ? Number(v.digiflazzModalPrice || 0) : 0,
                minCustomNominal: procMode === 'ewallet_custom' ? Number(v.minCustomNominal || 10000) : 0,
                maxCustomNominal: procMode === 'ewallet_custom' ? Math.min(500000, Number(v.maxCustomNominal || 500000)) : 0,
                adminFeeNominal: procMode === 'ewallet_custom' ? Number(v.adminFeeNominal || 0) : 0,
                cutOffStart: v.cutOffStart || '',
                cutOffEnd: v.cutOffEnd || '',
                multi: v.multi !== false,
                stockMode: v.stockMode || 'PRIVATE',
                stockCount: isDfMode ? 999 : ((procMode === 'auto' || procMode === 'ask_auto') ? readyVaultCount : (v.soldOut ? 0 : null)),
                soldOut: effectiveSoldOut,
                manualLockSoldOut: (procMode === 'manual') ? effectiveSoldOut : false
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

    // Hanya tampilkan produk yang menggunakan Gudang Stok Lokal (tidak mencampur produk Digiflazz)
    const sortedBrands = [...groupedBrands]
        .filter(b => b.items.some(i => i.processType !== 'digiflazz' && i.processType !== 'digiflazz_pasca' && !i.isDigiflazz))
        .sort((a, b) => a.brandName.localeCompare(b.brandName));

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

// Langkah 1 Cek Stok: Pilih Produk -> Muncul daftar Variasi di dalam produk tersebut
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

// Langkah 2 Cek Stok: Pilih Variasi -> Baru muncul stok aktif saat itu
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

// Langkah 1 Tambah Stok: Pilih Produk -> Muncul pilihan Variasi
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

// Langkah 2 Tambah Stok: Pilih Variasi -> Baru muncul form tambah stok & info stok aktif saat ini
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

    // 2. Perbarui kartu produk & variasi di panel hierarki
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

    // 3. Hanya tampilkan daftar item stok jika Produk & Variasi sudah dipilih
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
    document.getElementById('manage-promo-user').value = p.targetUser === 'new' ? 'new' : (p.targetUser === 'member_plus' ? 'member_plus' : 'member');
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
        const uLabel = userTarget === 'member_plus' ? 'Khusus Member Plus' : (userTarget === 'member' ? 'Khusus Member' : (userTarget === 'new' ? 'Transaksi Pertama' : 'Semua Pengguna'));
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
// PANEL KONTROL RUNNING TEXT BAWAH OTOMATIS & PUSAT VALIDASI QRIS v27.8
// ==========================================
window.updateFooterMarqueeControlPreview = function() {
    const showPrice = document.getElementById('set-footer-show-price')
        ? document.getElementById('set-footer-show-price').checked
        : (siteSettings.footerMarqueeShowPrice !== false);
    const showStatus = document.getElementById('set-footer-show-status')
        ? document.getElementById('set-footer-show-status').checked
        : (siteSettings.footerMarqueeShowStatus !== false);

    const activeBrands = groupedBrands.filter(b => !b.isGangguan);
    let readyCount = 0;
    let soldOutCount = 0;

    const previewStrip = document.getElementById('admin-footer-marquee-live-preview');
    let pillsHtml = '';

    activeBrands.forEach(b => {
        const prices = (b.items || []).map(i => Number(i.priceNum || 0)).filter(p => p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const totalSlots = b.items.reduce((acc, it) => acc + countReadyStockSlotsForVariant(b.brandName, it.name), 0);
        const allManualSold = b.items.length > 0 && b.items.every(it => Boolean(it.soldOut) && totalSlots <= 0);

        if (allManualSold) soldOutCount++;
        else readyCount++;

        const priceLabel = (showPrice && minPrice > 0 && !allManualSold) ? ` — Mulai Rp${minPrice.toLocaleString('id-ID')}` : '';
        const statusText = (allManualSold && showStatus) ? ' (Stok Habis)' : priceLabel;

        let badgeHtml = '';
        if (showStatus) {
            if (allManualSold) badgeHtml = `<span class="v278-preview-badge badge-sold">HABIS</span>`;
            else if (b.type === 'game') badgeHtml = `<span class="v278-preview-badge badge-game">GAME</span>`;
            else if (b.type === 'tools') badgeHtml = `<span class="v278-preview-badge">TOOLS</span>`;
            else badgeHtml = `<span class="v278-preview-badge">KATALOG</span>`;
        }

        pillsHtml += `
            <span class="v278-preview-pill">
                ${badgeHtml}
                <span>${window.escapeHtml(b.brandName + statusText)}</span>
            </span>
            <span style="color:#facc15; font-size:0.8rem;">✦</span>
        `;
    });

    const elActive = document.getElementById('ctrl-footer-active-count');
    const elReady = document.getElementById('ctrl-footer-ready-count');
    const elSold = document.getElementById('ctrl-footer-soldout-count');

    if (elActive) elActive.innerText = `${activeBrands.length} Produk`;
    if (elReady) elReady.innerText = `${readyCount} Produk`;
    if (elSold) elSold.innerText = `${soldOutCount} Produk`;

    if (previewStrip) {
        previewStrip.innerHTML = pillsHtml || `<span class="text-xs" style="color:#94a3b8;">Belum ada produk aktif di katalog.</span>`;
    }
};

window.renderAdminQrisControlMonitor = function() {
    const mutContainer = document.getElementById('admin-recent-mutations-log');
    const mutTotalBadge = document.getElementById('admin-mutations-total-badge');
    const searchVal = (document.getElementById('admin-search-mutation-log')?.value || '').trim().toLowerCase();

    if (mutContainer) {
        const nowMs = Date.now();
        const allMuts = (Array.isArray(recentMutationsList) ? recentMutationsList : []).filter(m => {
            const ts = getAdminMutationTimestampMs(m, false);
            return ts === 0 || (nowMs - ts < MUTATION_AUTO_CLEAN_1H_MS);
        });
        if (mutTotalBadge) mutTotalBadge.innerText = `${allMuts.length} Log Masuk`;

        let filteredMuts = allMuts;
        if (searchVal) {
            filteredMuts = allMuts.filter(m => {
                const fullTxt = getAdminCombinedMutationText(m).toLowerCase();
                const cands = extractAdminCandidateAmountsFromMutation(m).join(' ');
                const app = String(m.appName || m.source || '').toLowerCase();
                const ordId = String(m.matchedOrderId || '').toLowerCase();
                return fullTxt.includes(searchVal) || cands.includes(searchVal) || app.includes(searchVal) || ordId.includes(searchVal);
            });
        }

        if (filteredMuts.length === 0) {
            mutContainer.innerHTML = `<div class="text-xs text-muted p-3 text-center">Belum ada mutasi pembayaran yang masuk dalam 1 jam terakhir.</div>`;
        } else {
            mutContainer.innerHTML = filteredMuts.slice(0, 50).map((m, idx) => {
                const cands = extractAdminCandidateAmountsFromMutation(m);
                const primaryAmt = cands[0] || Number(m.amount || 0);
                const isMatched = String(m.status || '').toUpperCase() === 'MATCHED';
                const statusBadge = isMatched
                    ? `<span class="status-badge status-success"><i class="fa-solid fa-circle-check"></i> OTOMATIS COCOK (${window.escapeHtml(m.matchedOrderId || 'LUNAS')})</span>`
                    : `<span class="status-badge status-pending"><i class="fa-solid fa-inbox"></i> TERCATAT</span>`;

                const ts = getAdminMutationTimestampMs(m, false);
                const timeStr = ts > 0
                    ? new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : (m.timeSent ? `Jam ${window.escapeHtml(m.timeSent)}` : 'Baru saja');

                // Hitung sisa waktu sebelum dihapus otomatis oleh sistem 1 jam
                const remain1hMs = ts > 0 ? Math.max(0, MUTATION_AUTO_CLEAN_1H_MS - (nowMs - ts)) : MUTATION_AUTO_CLEAN_1H_MS;
                const remainMins = Math.max(1, Math.ceil(remain1hMs / 60000));

                const cleanTitle = stripAdminMacroDroidPlaceholders(m.title || m.not_title || '');
                const cleanBody = stripAdminMacroDroidPlaceholders(m.text || m.notification || m.not_text || m.bigText || m.big_text || '');
                const cleanCombined = getAdminCombinedMutationText(m);
                const appLabel = stripAdminMacroDroidPlaceholders(m.appName || '') || (m.source || 'Notifikasi Pembayaran');
                const rawOriginal = [m.title, m.text, m.rawText].filter(Boolean).join(' ');

                const allCandPills = cands.length > 0
                    ? cands.map(c => `<span class="v279-amount-pill">Rp${Number(c).toLocaleString('id-ID')}</span>`).join(' ')
                    : `<span class="status-badge status-failed" style="font-size:0.62rem;">Nominal Belum Terbaca</span>`;

                const safeCopyText = escapeJsStr(cleanCombined || rawOriginal || '');
                const safeDocId = escapeJsStr(m.dbId || '');

                return `
                <div class="v279-firebase-log-card ${isMatched ? 'log-matched' : ''}">
                    <div class="v279-log-head">
                        <div class="flex-gap align-center flex-wrap-gap">
                            <span class="v279-log-index">#${idx + 1}</span>
                            <strong class="v279-log-amount">${primaryAmt > 0 ? 'Rp' + primaryAmt.toLocaleString('id-ID') : 'Tanpa Nominal'}</strong>
                            ${statusBadge}
                            <span class="v279-log-app-tag"><i class="fa-solid fa-mobile-screen"></i> ${window.escapeHtml(appLabel)}</span>
                        </div>
                        <div class="flex-gap align-center">
                            <span class="text-xs text-muted fw-bold"><i class="fa-regular fa-clock"></i> ${timeStr}</span>
                            <span class="status-badge status-anon" style="font-size:0.58rem;" title="Dihapus otomatis setelah 1 jam">Auto-Hapus ${remainMins}m</span>
                            <button type="button" class="btn-icon-only" style="width:28px; height:28px; font-size:0.72rem;" title="Salin Isi Pesan" onclick="window.copyTextToClipboard('${safeCopyText}', 'Isi Notifikasi')">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                            ${m.dbId ? `<button type="button" class="btn-icon-only text-danger" style="width:28px; height:28px; font-size:0.72rem;" title="Hapus Permanen Log Ini" onclick="window.deleteSinglePaymentMutation('${safeDocId}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </div>
                    </div>

                    <div class="v279-log-body">
                        ${cleanTitle ? `<div class="v279-log-field"><span>JUDUL NOTIFIKASI:</span> <strong>${window.escapeHtml(cleanTitle)}</strong></div>` : ''}
                        ${cleanBody ? `<div class="v279-log-field"><span>ISI RINCIAN UANG:</span> <strong class="text-primary">${window.escapeHtml(cleanBody)}</strong></div>` : ''}
                        <div class="v279-log-raw-box">
                            <span class="text-xs fw-bold text-muted d-block mb-1">ISI PESAN NOTIFIKASI:</span>
                            <div class="code-mono text-xs" style="word-break:break-word; white-space:pre-wrap;">${window.escapeHtml(cleanCombined || rawOriginal || '(Pesan Kosong)')}</div>
                        </div>
                    </div>

                    <div class="v279-log-footer">
                        <div class="flex-gap align-center flex-wrap-gap">
                            <span class="text-xs text-muted fw-bold">Nominal Terbaca:</span>
                            ${allCandPills}
                        </div>
                        <span class="code-mono text-xs text-muted">ID: ${window.escapeHtml(m.dbId || '-')}</span>
                    </div>
                </div>`;
            }).join('');
        }
    }
};

window.refreshAdminControlCenterUI = function(showToastMsg = false) {
    window.updateFooterMarqueeControlPreview();
    window.renderAdminQrisControlMonitor();
    if (showToastMsg) {
        window.showToast('Disegarkan', 'Panel Kontrol Running Text & Log Firebase diperbarui.', 'info');
    }
};

window.refreshFirebaseMutationsLogNow = async function() {
    const icon = document.getElementById('icon-refresh-firebase-log');
    if (icon) icon.classList.add('fa-spin');
    try {
        const snap = await getDocs(collection(db, pathMutations));
        const nowMs = Date.now();
        recentMutationsList = [];
        for (const d of snap.docs) {
            const mData = { dbId: d.id, ...d.data() };
            const ts = getAdminMutationTimestampMs(mData, false);
            if (ts > 0 && (nowMs - ts >= MUTATION_AUTO_CLEAN_1H_MS)) {
                await deleteDoc(doc(db, pathMutations, d.id)).catch(() => {});
                continue;
            }
            recentMutationsList.push(mData);
        }
        recentMutationsList.sort((a, b) => getAdminMutationTimestampMs(b, false) - getAdminMutationTimestampMs(a, false));
        crossCheckAllUnpaidOrdersAgainstMutations();
        window.renderAdminQrisControlMonitor();
        window.generateAdminReports();
        window.showToast('Log Realtime Aktif', `Memuat ${recentMutationsList.length} log notifikasi aktif (< 1 jam) dari Firebase.`, 'success');
    } catch (e) {
        window.showToast('Gagal', 'Tidak dapat memuat ulang log dari Firebase.', 'error');
    } finally {
        setTimeout(() => {
            if (icon) icon.classList.remove('fa-spin');
        }, 300);
    }
};

window.deleteSinglePaymentMutation = async function(docId) {
    if (!docId) return;
    try {
        await deleteDoc(doc(db, pathMutations, docId));
        recentMutationsList = recentMutationsList.filter(m => m.dbId !== docId);
        window.renderAdminQrisControlMonitor();
        window.generateAdminReports();
        window.showToast('Dihapus Permanen', '1 item log notifikasi dihapus permanen dari Firebase.', 'info');
    } catch (e) {
        window.customAlert('Gagal', 'Tidak dapat menghapus item log.', 'error');
    }
};

window.copyMacroDroidDirectFirebaseUrl = function() {
    const directUrl = `https://firestore.googleapis.com/v1/projects/vipercell-fc50e/databases/(default)/documents/payment_mutations?key=AIzaSyBQGZjl7uj5CRiLWCvPQKjiK4HvIYnXSJg`;
    window.copyTextToClipboard(directUrl, 'Link Endpoint Firebase');
};

window.copyMacroDroidDirectFirebaseJson = function(bracketStyle = 'square') {
    const isCurly = bracketStyle === 'curly';
    const jsonBody = isCurly
        ? JSON.stringify({
            fields: {
                appName: { stringValue: "{not_app_name}" },
                title: { stringValue: "{not_title}" },
                text: { stringValue: "{notification}" },
                bigText: { stringValue: "{not_big_text}" },
                rawText: { stringValue: "{not_title} | {notification} | {not_big_text} | {not_sub_text} | {not_ticker}" },
                timeSent: { stringValue: "{hour}:{minute}:{second}" },
                source: { stringValue: "MACRODROID_GATEWAY" }
            }
        }, null, 2)
        : JSON.stringify({
            fields: {
                appName: { stringValue: "[not_app_name]" },
                title: { stringValue: "[not_title]" },
                text: { stringValue: "[notification]" },
                bigText: { stringValue: "[not_big_text]" },
                rawText: { stringValue: "[not_title] | [notification] | [not_big_text] | [not_sub_text] | [not_ticker]" },
                timeSent: { stringValue: "[hour]:[minute]:[second]" },
                source: { stringValue: "MACRODROID_GATEWAY" }
            }
        }, null, 2);

    const previewEl = document.getElementById('macrodroid-json-code-preview');
    if (previewEl) previewEl.textContent = jsonBody;

    window.copyTextToClipboard(
        jsonBody,
        isCurly ? 'Kode JSON MacroDroid {notification}' : 'Kode JSON MacroDroid [notification]'
    );
};

window.cleanOldPaymentMutations = function() {
    if (recentMutationsList.length === 0) {
        window.showToast('Sudah Bersih', 'Log notifikasi di Firebase sudah kosong.', 'info');
        return;
    }
    window.openConfirm(
        'Hapus Log Permanen dari Firebase',
        `Hapus permanen seluruh <b>${recentMutationsList.length} riwayat log notifikasi</b> dari koleksi <code>payment_mutations</code> di Firebase sekarang?`,
        async (confirmed) => {
            if (!confirmed) return;
            const toDelete = [...recentMutationsList];
            recentMutationsList = [];
            window.renderAdminQrisControlMonitor();
            for (const m of toDelete) {
                if (m.dbId) {
                    await deleteDoc(doc(db, pathMutations, m.dbId)).catch(() => {});
                }
            }
            window.generateAdminReports();
            window.showToast('Dihapus Permanen', 'Seluruh log notifikasi di Firebase telah dihapus permanen.', 'success');
        },
        'delete'
    );
};

// ==========================================
// PENGATURAN TOKO & JAM OPERASIONAL
// ==========================================
window.populateSettingsForm = function() {
    const storeOpenEl = document.getElementById('set-store-open');
    if (storeOpenEl) storeOpenEl.checked = siteSettings.isStoreOpen !== false;
    updateTopbarStoreStatusUI();

    const anonToggle = document.getElementById('set-anon-autodelete-6h');
    if (anonToggle) anonToggle.checked = siteSettings.anonAutoDelete6h !== false;

    const waterToggle = document.getElementById('set-water-ripple');
    if (waterToggle) waterToggle.checked = siteSettings.waterRippleEnabled !== false;

    const opHoursToggle = document.getElementById('set-op-hours-enabled');
    const opOpenInp = document.getElementById('set-op-open-time');
    const opCloseInp = document.getElementById('set-op-close-time');

    if (opHoursToggle) opHoursToggle.checked = Boolean(siteSettings.opHoursEnabled);
    if (opOpenInp) opOpenInp.value = siteSettings.opOpenTime || '08:00';
    if (opCloseInp) opCloseInp.value = siteSettings.opCloseTime || '22:00';
    window.updateOpHoursAdminPreview();

    const showPriceEl = document.getElementById('set-footer-show-price');
    const showStatusEl = document.getElementById('set-footer-show-status');
    const speedEl = document.getElementById('set-footer-speed');
    if (showPriceEl) showPriceEl.checked = siteSettings.footerMarqueeShowPrice !== false;
    if (showStatusEl) showStatusEl.checked = siteSettings.footerMarqueeShowStatus !== false;
    if (speedEl) speedEl.value = siteSettings.footerMarqueeSpeed || 'normal';

    document.getElementById('set-logo-text').value = siteSettings.logoText || 'VIPER';
    document.getElementById('set-logo-accent').value = siteSettings.logoAccent || 'CELL';
    document.getElementById('set-marquee').value = siteSettings.marquee || '';
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

    // Populate Digiflazz Settings (Dual API Key Development & Production + Balance Guard)
    const dfBridgeEl = document.getElementById('set-df-bridge-url');
    const dfEnvEl = document.getElementById('set-df-env-mode');
    const dfUserEl = document.getElementById('set-df-username');
    const dfDevKeyEl = document.getElementById('set-df-dev-apikey');
    const dfProdKeyEl = document.getElementById('set-df-prod-apikey');
    const dfSecretEl = document.getElementById('set-df-webhook-secret');
    const dfAutoEl = document.getElementById('set-df-autohit');
    const dfBalGuardEl = document.getElementById('set-df-balance-guard');
    const dfMkTypeEl = document.getElementById('df-markup-type');
    const dfMkValEl = document.getElementById('df-markup-value');
    const dfMkRoundEl = document.getElementById('df-markup-round');

    if (dfBridgeEl) dfBridgeEl.value = siteSettings.digiflazzBridgeUrl || 'http://139.59.60.91:3100';
    if (dfEnvEl) dfEnvEl.value = siteSettings.digiflazzEnvMode || 'development';
    if (dfUserEl) dfUserEl.value = siteSettings.digiflazzUsername || '';
    if (dfDevKeyEl) dfDevKeyEl.value = siteSettings.digiflazzDevApiKey || siteSettings.digiflazzApiKey || '';
    if (dfProdKeyEl) dfProdKeyEl.value = siteSettings.digiflazzProdApiKey || '';
    if (dfSecretEl) dfSecretEl.value = siteSettings.digiflazzWebhookSecret || 'VIPERCELL_DF_WEBHOOK_2026';
    if (dfAutoEl) dfAutoEl.checked = siteSettings.digiflazzAutoHitOnPaid !== false;
    if (dfBalGuardEl) dfBalGuardEl.checked = siteSettings.digiflazzBalanceGuard !== false;
    if (typeof window.onChangeDigiflazzEnvMode === 'function') window.onChangeDigiflazzEnvMode();
    if (typeof window.onChangeAdminMarkupScope === 'function') {
        window.onChangeAdminMarkupScope();
    }

    const dfModeBadge = document.getElementById('df-connection-mode-badge');
    if (dfModeBadge) {
        const hasBridge = Boolean((siteSettings.digiflazzBridgeUrl || '').trim());
        dfModeBadge.className = `status-badge ${hasBridge ? 'status-success' : 'status-pending'}`;
        dfModeBadge.innerText = hasBridge ? 'SERVER BRIDGE TERHUBUNG' : 'SIAP DIGUNAKAN';
    }

    const adminPinEl = document.getElementById('set-admin-security-pin');
    const reqAdminPinEl = document.getElementById('set-require-admin-pin');
    const adminPinBadge = document.getElementById('admin-pin-status-badge');
    const adminPinResetWrap = document.getElementById('admin-pin-locked-reset-wrap');
    const adminPinEyeBtn = document.getElementById('btn-eye-admin-security-pin');
    const adminPinLbl = document.getElementById('lbl-set-admin-security-pin');
    const hasPin = Boolean((siteSettings.adminSecurityPin || '').trim().length === 6);
    if (adminPinEl) {
        adminPinEl.value = hasPin ? '••••••' : (siteSettings.adminSecurityPin || '');
        adminPinEl.disabled = hasPin;
        adminPinEl.readOnly = hasPin;
        adminPinEl.style.opacity = hasPin ? '0.75' : '1';
        adminPinEl.style.cursor = hasPin ? 'not-allowed' : 'text';
    }
    if (adminPinEyeBtn) adminPinEyeBtn.style.display = hasPin ? 'none' : 'inline-flex';
    if (adminPinResetWrap) adminPinResetWrap.style.display = hasPin ? 'block' : 'none';
    if (adminPinLbl) {
        adminPinLbl.innerText = hasPin
            ? 'PIN Transaksi Admin (Terkunci • Reset via Kata Sandi)'
            : 'Atur PIN Transaksi Admin Pertama Kali (6 Angka)';
    }
    if (reqAdminPinEl) reqAdminPinEl.checked = siteSettings.requireAdminPin !== false;
    if (adminPinBadge) {
        adminPinBadge.className = `status-badge ${hasPin ? 'status-success' : 'status-pending'}`;
        adminPinBadge.innerText = hasPin ? 'TERKUNCI & AKTIF' : 'BELUM DISETEL';
    }

    const mpEnabledEl = document.getElementById('set-memberplus-enabled');
    const mpPriceEl = document.getElementById('set-memberplus-price');
    const mpDiscEl = document.getElementById('set-memberplus-discount-pct');
    const mpTagEl = document.getElementById('set-memberplus-tagline');
    if (mpEnabledEl) mpEnabledEl.checked = siteSettings.memberPlusEnabled !== false;
    if (mpPriceEl) mpPriceEl.value = siteSettings.memberPlusMonthlyPrice ?? 25000;
    if (mpDiscEl) mpDiscEl.value = siteSettings.memberPlusLocalDiscountPct ?? 5;
    if (mpTagEl) mpTagEl.value = siteSettings.memberPlusTagline || 'Harga lebih hemat di semua produk, akses voucher eksklusif Member Plus, dan prioritas layanan.';

    const dfMkMinEl = document.getElementById('df-markup-min-rp');
    const dfMkMpDiscEl = document.getElementById('df-markup-memberplus-disc');
    const dfT1El = document.getElementById('df-tier-1');
    const dfT2El = document.getElementById('df-tier-2');
    const dfT3El = document.getElementById('df-tier-3');
    const dfT4El = document.getElementById('df-tier-4-pct');
    if (dfMkMinEl) dfMkMinEl.value = siteSettings.digiflazzMarkupMinRp ?? 1000;
    if (dfMkMpDiscEl) dfMkMpDiscEl.value = siteSettings.digiflazzMarkupMemberPlusDisc ?? 35;
    if (dfT1El) dfT1El.value = siteSettings.digiflazzTier1 ?? 1200;
    if (dfT2El) dfT2El.value = siteSettings.digiflazzTier2 ?? 2000;
    if (dfT3El) dfT3El.value = siteSettings.digiflazzTier3 ?? 3500;
    if (dfT4El) dfT4El.value = siteSettings.digiflazzTier4Pct ?? 2.5;

    window.updateDigiflazzDashboardStats();
    window.renderMarqueeStudioSlots();
    window.refreshAdminControlCenterUI();
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

    window.showToast('Menguji...', 'Mengecek koneksi ke Server Validasi Pembayaran QRIS...', 'info');

    try {
        const res = await callUnifiedGasWebhook({
            action: 'PING_TEST'
        });
        window.customAlert(
            'Server Validasi QRIS Aktif!',
            `Terhubung ke <b>${window.escapeHtml(res.engine || 'VIPERCELL_QRIS_VALIDATOR')}</b> .<br>Project Firebase: <b>${window.escapeHtml(res.projectId || 'vipercell-fc50e')}</b>.<br>Siap menerima POST JSON dari MacroDroid!`,
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
        // Pengaturan Jam Operasional Toko
        opHoursEnabled: Boolean(document.getElementById('set-op-hours-enabled')?.checked),
        opOpenTime: document.getElementById('set-op-open-time')?.value || '08:00',
        opCloseTime: document.getElementById('set-op-close-time')?.value || '22:00',
        logoText: document.getElementById('set-logo-text').value.trim() || 'VIPER',
        logoAccent: document.getElementById('set-logo-accent').value.trim() || 'CELL',
        marquee: combinedMarqueeText,
        marqueeList: marqueeListClean,
        footerMarqueeShowPrice: document.getElementById('set-footer-show-price') ? document.getElementById('set-footer-show-price').checked : true,
        footerMarqueeShowStatus: document.getElementById('set-footer-show-status') ? document.getElementById('set-footer-show-status').checked : true,
        footerMarqueeSpeed: document.getElementById('set-footer-speed')?.value || 'normal',
        adminWa: document.getElementById('set-wa').value.trim(),
        waChannelLink: document.getElementById('set-wa-channel').value.trim(),
        igLink: document.getElementById('set-ig').value.trim(),
        ttLink: document.getElementById('set-tt').value.trim(),
        qrisStringData: document.getElementById('set-qris-data').value.trim(),
        emailWebhookUrl: document.getElementById('set-email-webhook').value.trim(),
        webhookSecret: document.getElementById('set-webhook-secret').value.trim() || 'VIPERCELL_SECRET_2026',
        logoImgBase64: tempLogoBase64,
        pwaIconBase64: tempPwaIconBase64,
        banners: siteSettings.banners || [],
        adminSecurityPin: (siteSettings.adminSecurityPin && String(siteSettings.adminSecurityPin).trim().length === 6)
            ? String(siteSettings.adminSecurityPin).trim()
            : (document.getElementById('set-admin-security-pin')?.value || '').replace(/[^0-9]/g, '').slice(0, 6),
        requireAdminPin: document.getElementById('set-require-admin-pin') ? document.getElementById('set-require-admin-pin').checked : true,
        memberPlusEnabled: document.getElementById('set-memberplus-enabled') ? document.getElementById('set-memberplus-enabled').checked : true,
        memberPlusMonthlyPrice: Math.max(1000, parseInt(document.getElementById('set-memberplus-price')?.value || '25000', 10) || 25000),
        memberPlusLocalDiscountPct: Math.min(50, Math.max(1, parseInt(document.getElementById('set-memberplus-discount-pct')?.value || '5', 10) || 5)),
        memberPlusTagline: (document.getElementById('set-memberplus-tagline')?.value || '').trim()
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
// POP-UP MODALS & NOTIFIKASI KECIL
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

// Inisialisasi dijalankan di bagian paling bawah file setelah seluruh modul siap

// ============================================================================
// PUSAT KONTROL DIGIFLAZZ & MANAJEMEN SALDO AKUN PENGGUNA
// ============================================================================

// Pure JS MD5 implementation sesuai spesifikasi RFC 1321 untuk Signature Digiflazz: md5(username + apiKey + suffix)
function md5Digiflazz(inputStr) {
    function rotateLeft(lValue, iShiftBits) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
        const lX8 = (lX & 0x80000000);
        const lY8 = (lY & 0x80000000);
        const lX4 = (lX & 0x40000000);
        const lY4 = (lY & 0x40000000);
        const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        if (lX4 | lY4) {
            if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        } else {
            return (lResult ^ lX8 ^ lY8);
        }
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(str) {
        let lWordCount;
        const lMessageLength = str.length;
        const lNumberOfWordsTemp1 = lMessageLength + 8;
        const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
        const lWordArray = Array(lNumberOfWords - 1).fill(0);
        let lBytePosition = 0;
        let lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function wordToHex(lValue) {
        let wordToHexValue = "", wordToHexValueTemp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            wordToHexValueTemp = "0" + lByte.toString(16);
            wordToHexValue = wordToHexValue + wordToHexValueTemp.substr(wordToHexValueTemp.length - 2, 2);
        }
        return wordToHexValue;
    }
    const utf8Str = unescape(encodeURIComponent(String(inputStr || '')));
    const x = convertToWordArray(utf8Str);
    let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    for (let k = 0; k < x.length; k += 16) {
        const AA = a, BB = b, CC = c, DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB); b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613); b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8); d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122); d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E); b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], S22, 0x02441453);
        c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], S34, 0x04881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244); d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3); d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k + 6], S43, 0xA3014314); b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82); d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// 1. Kredit Saldo Akun Otomatis untuk Pesanan Top Up Dompet (Anti-Dobel Kredit)
async function creditTopupOrderBalanceIfNeeded(orderData, orderDbId) {
    if (!orderData || !orderDbId) return false;
    const uid = orderData.userId;
    const topupAmt = Math.round(Number(orderData.topupAmount || orderData.baseTotal || orderData.finalTotal || 0));
    if (!uid || topupAmt <= 0) return false;

    const orderRef = doc(db, pathOrders, orderDbId);
    const userRef = doc(db, pathUsers, uid);
    const nowMs = Date.now();
    let creditedSuccess = false;

    try {
        await runTransaction(db, async (transaction) => {
            const ordSnap = await transaction.get(orderRef);
            if (!ordSnap.exists()) return;
            const oData = ordSnap.data();
            if (oData.balanceCredited === true) {
                creditedSuccess = true;
                return;
            }
            const uSnap = await transaction.get(userRef);
            const curBal = uSnap.exists() ? Math.round(Number(uSnap.data().balance || 0)) : 0;
            const nextBal = curBal + topupAmt;

            if (uSnap.exists()) {
                transaction.update(userRef, {
                    balance: nextBal,
                    balanceUpdatedAt: nowMs
                });
            } else {
                transaction.set(userRef, {
                    uid: uid,
                    email: orderData.userEmail || '',
                    name: orderData.buyerName || 'Pelanggan',
                    balance: nextBal,
                    balanceUpdatedAt: nowMs,
                    createdAt: nowMs
                }, { merge: true });
            }

            const replyMsg = `[PENGISIAN SALDO BERHASIL]
Nominal Masuk : Rp${topupAmt.toLocaleString('id-ID')}
Saldo Akhir   : Rp${nextBal.toLocaleString('id-ID')}
Waktu         : ${new Date(nowMs).toLocaleString('id-ID')}`;
            transaction.update(orderRef, {
                status: 'SUCCESS',
                paymentVerified: true,
                paidAt: oData.paidAt || nowMs,
                balanceCredited: true,
                balanceCreditedAt: nowMs,
                autoDelivered: true,
                deliveredAt: nowMs,
                adminReply: replyMsg
            });
            creditedSuccess = true;
        });

        if (creditedSuccess) {
            await addDoc(collection(db, pathBalanceLogs), {
                uid: uid,
                userEmail: orderData.userEmail || '',
                type: 'TOPUP',
                amount: topupAmt,
                orderId: orderData.id,
                note: `Isi Saldo via ${(orderData.paymentMethod || 'qris').toUpperCase()}`,
                createdAt: nowMs
            }).catch(() => {});
            window.showToast('Saldo Ditambahkan', `Saldo Rp${topupAmt.toLocaleString('id-ID')} masuk ke akun #${orderData.id}`, 'success');
        }
        return creditedSuccess;
    } catch (e) {
        console.error('Credit Topup Balance Error:', e);
        return false;
    }
}

// 3. Navigasi Sub-Tab di Pusat Digiflazz (Termasuk Tab 5: Hitung Keuntungan)
window.switchDigiflazzSubTab = function(subTab) {
    currentDigiflazzSubTab = subTab;
    ['catalog', 'trx', 'deposit', 'config', 'profit'].forEach(k => {
        const btn = document.getElementById(`df-subtab-btn-${k}`);
        const panel = document.getElementById(`df-panel-${k}`);
        if (btn) btn.classList.toggle('active', k === subTab);
        if (panel) {
            panel.classList.toggle('active', k === subTab);
            panel.style.display = k === subTab ? 'block' : 'none';
        }
    });
    if (subTab === 'catalog') window.renderDigiflazzCatalogTable();
    else if (subTab === 'trx') window.renderDigiflazzTransactionsTable();
    else if (subTab === 'deposit') window.renderDigiflazzDepositHistory();
    else if (subTab === 'profit' && typeof window.renderDigiflazzProfitAnalytics === 'function') {
        window.renderDigiflazzProfitAnalytics();
        window.updateDigiflazzProfitSimulator();
    }
};

// Helper: Ambil API Key Aktif sesuai Mode Lingkungan Transaksi (Development vs Production)
function hydrateAdminDigiflazzSyncToken() {
    const token = String(siteSettings.digiflazzBridgeSyncToken || '').trim();
    if (!token) return;
    try {
        const jsonStr = decodeURIComponent(escape(atob(token)));
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed === 'object') {
            if (parsed.u && !siteSettings.digiflazzUsername) siteSettings.digiflazzUsername = String(parsed.u).trim();
            if (parsed.d && (!siteSettings.digiflazzDevApiKey || siteSettings.digiflazzDevApiKey === 'dev-apikey')) {
                siteSettings.digiflazzDevApiKey = String(parsed.d).trim();
            }
            if (parsed.p && (!siteSettings.digiflazzProdApiKey || siteSettings.digiflazzProdApiKey === 'dev-apikey')) {
                siteSettings.digiflazzProdApiKey = String(parsed.p).trim();
            }
            if (parsed.m && !siteSettings.digiflazzEnvMode) {
                siteSettings.digiflazzEnvMode = String(parsed.m).trim();
            }
        }
    } catch (e) {}
}

function getActiveDigiflazzApiKey(preferAlternate = false) {
    hydrateAdminDigiflazzSyncToken();
    const cleanKey = (k) => (k && k !== 'dev-apikey' ? String(k).trim() : '');
    const mode = document.getElementById('set-df-env-mode')?.value || siteSettings.digiflazzEnvMode || 'development';
    const devKey = cleanKey(document.getElementById('set-df-dev-apikey')?.value) || cleanKey(siteSettings.digiflazzDevApiKey) || cleanKey(siteSettings.digiflazzApiKey);
    const prodKey = cleanKey(document.getElementById('set-df-prod-apikey')?.value) || cleanKey(siteSettings.digiflazzProdApiKey) || cleanKey(siteSettings.digiflazzApiKey);
    if (!preferAlternate) {
        return mode === 'production' ? (prodKey || devKey) : (devKey || prodKey);
    }
    return mode === 'production' ? (devKey || prodKey) : (prodKey || devKey);
}

window.onChangeDigiflazzEnvMode = function() {
    const mode = document.getElementById('set-df-env-mode')?.value || siteSettings.digiflazzEnvMode || 'development';
    const banner = document.getElementById('df-env-active-indicator');
    const badge = document.getElementById('df-connection-mode-badge');
    const devCard = document.getElementById('df-dev-key-card');
    const prodCard = document.getElementById('df-prod-key-card');
    const quickDevBtn = document.getElementById('btn-df-quick-mode-dev');
    const quickProdBtn = document.getElementById('btn-df-quick-mode-prod');
    const simBadge = document.getElementById('df-sim-dev-badge');

    if (quickDevBtn) quickDevBtn.classList.toggle('active', mode === 'development');
    if (quickProdBtn) quickProdBtn.classList.toggle('active', mode === 'production');
    if (simBadge) {
        simBadge.className = mode === 'production' ? 'status-badge status-success' : 'status-badge status-pending';
        simBadge.innerText = mode === 'production' ? 'MODE LIVE AKTIF' : 'MODE DEVELOPMENT AKTIF';
    }
    if (badge) {
        badge.className = mode === 'production' ? 'status-badge status-success' : 'status-badge status-pending';
        badge.innerText = mode === 'production' ? 'PRODUCTION (LIVE)' : 'DEVELOPMENT (TESTING)';
    }
    if (banner) {
        if (mode === 'production') {
            banner.style.background = 'rgba(16, 185, 129, 0.14)';
            banner.style.borderColor = 'var(--success)';
            banner.innerHTML = `<i class="fa-solid fa-bolt text-success"></i> <div><strong class="text-success">MODE AKTIF: PRODUCTION (TRANSAKSI REAL)</strong><br>Transaksi menggunakan <b>API Key Production</b>.</div>`;
        } else {
            banner.style.background = 'rgba(245, 158, 11, 0.14)';
            banner.style.borderColor = '#f59e0b';
            banner.innerHTML = `<i class="fa-solid fa-flask" style="color:#d97706;"></i> <div><strong style="color:#d97706;">MODE AKTIF: DEVELOPMENT (TESTING)</strong><br>Transaksi menggunakan <b>API Key Development</b> dengan parameter <code>testing: true</code>.</div>`;
        }
    }
    if (devCard) devCard.style.opacity = mode === 'development' ? '1' : '0.65';
    if (prodCard) prodCard.style.opacity = mode === 'production' ? '1' : '0.65';
    window.syncQuickWebUserControlBarUI();
};

window.updateDigiflazzEnvBadgePreview = window.onChangeDigiflazzEnvMode;

window.syncQuickWebUserControlBarUI = function() {
    const isClosed = Boolean(siteSettings.isStoreClosed);
    const autoHit = siteSettings.digiflazzAutoHitOnPaid !== false;
    const balGuard = siteSettings.digiflazzBalanceGuard !== false;
    const mpEnabled = siteSettings.memberPlusEnabled !== false;

    const setPill = (btnId, lblId, isOn, textStr) => {
        const btn = document.getElementById(btnId);
        const lbl = document.getElementById(lblId);
        if (lbl) lbl.innerText = textStr;
        if (btn) {
            btn.classList.toggle('pill-on', isOn);
            btn.classList.toggle('pill-off', !isOn);
        }
    };

    setPill('btn-quick-web-store-status', 'lbl-quick-web-store-status', !isClosed, isClosed ? 'Toko: TUTUP' : 'Toko: BUKA');
    setPill('btn-quick-web-autohit', 'lbl-quick-web-autohit', autoHit, `Auto-Hit: ${autoHit ? 'ON' : 'OFF'}`);
    setPill('btn-quick-web-balguard', 'lbl-quick-web-balguard', balGuard, `Proteksi Saldo: ${balGuard ? 'ON' : 'OFF'}`);
    setPill('btn-quick-web-memberplus', 'lbl-quick-web-memberplus', mpEnabled, `Member Plus: ${mpEnabled ? 'ON' : 'OFF'}`);
};

window.quickSwitchDigiflazzEnvMode = async function(targetMode) {
    const mode = targetMode === 'production' ? 'production' : 'development';
    const sel = document.getElementById('set-df-env-mode');
    if (sel) sel.value = mode;
    siteSettings.digiflazzEnvMode = mode;
    window.onChangeDigiflazzEnvMode();
    await window.saveDigiflazzSettings();
};

window.quickToggleWebUserControl = async function(settingKey) {
    let nextVal = true;
    if (settingKey === 'isStoreClosed') {
        nextVal = !Boolean(siteSettings.isStoreClosed);
    } else if (settingKey === 'digiflazzAutoHitOnPaid') {
        nextVal = !(siteSettings.digiflazzAutoHitOnPaid !== false);
        const chk = document.getElementById('set-df-autohit');
        if (chk) chk.checked = nextVal;
    } else if (settingKey === 'digiflazzBalanceGuard') {
        nextVal = !(siteSettings.digiflazzBalanceGuard !== false);
        const chk = document.getElementById('set-df-balance-guard');
        if (chk) chk.checked = nextVal;
    } else if (settingKey === 'memberPlusEnabled') {
        nextVal = !(siteSettings.memberPlusEnabled !== false);
        const chk = document.getElementById('set-memberplus-enabled');
        if (chk) chk.checked = nextVal;
    }
    siteSettings[settingKey] = nextVal;
    window.syncQuickWebUserControlBarUI();
    try {
        await setDoc(doc(db, pathSettings, 'mainConfig'), { [settingKey]: nextVal }, { merge: true });
        window.populateSettingsForm();
        window.showToast('Kendali Web User', 'Pengaturan Web User berhasil diperbarui secara realtime.', 'success');
    } catch (e) {
        window.customAlert('Gagal Menyimpan', window.escapeHtml(e.message), 'error');
    }
};

window.pingAndMonitorDigiflazzApi = async function() {
    const saldo = await window.checkDigiflazzBalance(false);
    const mode = (document.getElementById('set-df-env-mode')?.value || siteSettings.digiflazzEnvMode || 'development').toUpperCase();
    if (saldo !== null) {
        window.showToast('Koneksi API Normal', `Mode ${mode} siap digunakan • Saldo: Rp${Number(saldo).toLocaleString('id-ID')}`, 'success');
    }
};

window.applyAdminDevTestPreset = function(presetNo) {
    const custInp = document.getElementById('df-sim-test-custno');
    const skuInp = document.getElementById('df-sim-test-sku');
    if (custInp && presetNo) custInp.value = presetNo;
    if (skuInp && presetNo === '530000000001' && (!skuInp.value || skuInp.value === 'xld10')) {
        skuInp.value = 'pln';
    } else if (skuInp && presetNo !== '530000000001' && skuInp.value === 'pln') {
        skuInp.value = 'xld10';
    }
};

window.runAdminDigiflazzDevTest = async function() {
    const sku = (document.getElementById('df-sim-test-sku')?.value || 'xld10').trim();
    const cNo = (document.getElementById('df-sim-test-custno')?.value || '087800001230').trim();
    const resBox = document.getElementById('df-sim-test-result');
    const btn = document.getElementById('btn-df-run-dev-test');
    const ogHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menguji...';
    }

    try {
        const username = (siteSettings.digiflazzUsername || document.getElementById('set-df-username')?.value || 'username').trim();
        const apiKey = getActiveDigiflazzApiKey();
        const refId = 'TEST-' + Date.now();
        const sign = md5Digiflazz(username + apiKey + refId);
        const isPasca = sku.toLowerCase() === 'pln' || sku.toLowerCase() === 'bpjs' || sku.toLowerCase() === 'pdam';

        const payload = {
            username: username,
            buyer_sku_code: sku,
            customer_no: cNo,
            ref_id: refId,
            testing: true,
            sign: sign
        };
        if (isPasca) payload.commands = 'inq-pasca';

        const res = await callDigiflazzApi('/v1/transaction', payload);
        const d = res?.data || {};
        if (resBox) {
            resBox.style.display = 'block';
            const st = String(d.status || 'Sukses');
            const rc = String(d.rc || '00');
            const sn = String(d.sn || d.customer_name || '-');
            const msg = String(d.message || '-');
            const cls = st === 'Sukses' ? 'text-success' : (st === 'Pending' ? 'text-warning' : 'text-danger');
            resBox.innerHTML = `
                <div class="${cls} fw-bold mb-1"><i class="fa-solid fa-flask"></i> Hasil Uji: ${window.escapeHtml(st.toUpperCase())} (RC ${window.escapeHtml(rc)})</div>
                <div><b>Ref ID:</b> <span class="code-mono">${window.escapeHtml(refId)}</span> &bull; <b>SKU:</b> <span class="code-mono">${window.escapeHtml(sku)}</span></div>
                <div><b>Tujuan:</b> <span class="code-mono">${window.escapeHtml(cNo)}</span> &bull; <b>SN / Nama:</b> <span class="code-mono">${window.escapeHtml(sn)}</span></div>
                <div><b>Pesan Respon:</b> ${window.escapeHtml(msg)}</div>
            `;
        }
        window.showToast('Uji Transaksi Selesai', `Status: ${d.status || 'OK'} (RC ${d.rc || '00'})`, d.status === 'Gagal' ? 'warning' : 'success');
    } catch (e) {
        if (resBox) {
            resBox.style.display = 'block';
            resBox.innerHTML = `<div class="text-danger fw-bold"><i class="fa-solid fa-circle-xmark"></i> Gagal: ${window.escapeHtml(e.message)}</div>`;
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = ogHtml;
        }
    }
};

// 4. Hitung Harga Jual Otomatis Berdasarkan Markup (Member Biasa / Member Plus & Semua / Kategori / Brand)
function getDefaultMarkupRuleForTier(tier = 'regular') {
    const isMp = (tier === 'member_plus');
    const baseT1 = Number(siteSettings.digiflazzTier1 || 1200);
    const baseT2 = Number(siteSettings.digiflazzTier2 || 2000);
    const baseT3 = Number(siteSettings.digiflazzTier3 || 3500);
    const baseT4 = Number(siteSettings.digiflazzTier4Pct || 2.5);
    const baseVal = Number(siteSettings.digiflazzMarkupValue ?? 1500);
    const baseMin = Number(siteSettings.digiflazzMarkupMinRp ?? 1000);
    const discPct = Math.min(80, Math.max(5, Number(siteSettings.digiflazzMarkupMemberPlusDisc ?? 35)));
    const factor = isMp ? (1 - discPct / 100) : 1;

    return {
        type: siteSettings.digiflazzMarkupType || 'smart_tiered',
        value: isMp ? Math.max(200, Math.round(baseVal * factor)) : baseVal,
        minRp: isMp ? Math.max(200, Math.round(baseMin * factor)) : baseMin,
        round: siteSettings.digiflazzMarkupRound || '100',
        tier1: isMp ? Math.max(200, Math.round(baseT1 * factor)) : baseT1,
        tier2: isMp ? Math.max(200, Math.round(baseT2 * factor)) : baseT2,
        tier3: isMp ? Math.max(200, Math.round(baseT3 * factor)) : baseT3,
        tier4Pct: isMp ? Number(Math.max(0.5, baseT4 * factor).toFixed(1)) : baseT4
    };
}

function getMarkupRuleForTarget(tier = 'regular', category = '', brand = '') {
    const rules = siteSettings.digiflazzMarkupRules || {};
    const tierObj = rules[tier] || {};
    const brandKey = String(brand || '').trim().toUpperCase();
    const catKey = String(category || '').trim().toUpperCase();

    if (brandKey && tierObj.brands && tierObj.brands[brandKey]) {
        return tierObj.brands[brandKey];
    }
    if (catKey && tierObj.categories && tierObj.categories[catKey]) {
        return tierObj.categories[catKey];
    }
    if (tierObj.all) {
        return tierObj.all;
    }
    // Jika Member Plus belum punya rule tersendiri tapi Member Biasa punya rule, turunkan otomatis dari Member Biasa
    if (tier === 'member_plus') {
        const regRule = getMarkupRuleForTarget('regular', category, brand);
        if (regRule) {
            const discPct = Math.min(80, Math.max(5, Number(siteSettings.digiflazzMarkupMemberPlusDisc ?? 35)));
            const factor = 1 - (discPct / 100);
            return {
                type: regRule.type || 'smart_tiered',
                value: Math.max(200, Math.round(Number(regRule.value || 1500) * factor)),
                minRp: Math.max(200, Math.round(Number(regRule.minRp || 1000) * factor)),
                round: regRule.round || '100',
                tier1: Math.max(200, Math.round(Number(regRule.tier1 || 1200) * factor)),
                tier2: Math.max(200, Math.round(Number(regRule.tier2 || 2000) * factor)),
                tier3: Math.max(200, Math.round(Number(regRule.tier3 || 3500) * factor)),
                tier4Pct: Number(Math.max(0.5, Number(regRule.tier4Pct || 2.5) * factor).toFixed(1))
            };
        }
    }
    return null;
}

window.switchAdminMarkupTargetTier = function(tier = 'regular') {
    const isMp = (tier === 'member_plus');
    const hidEl = document.getElementById('df-markup-target-tier');
    const dispEl = document.getElementById('df-markup-active-tier-Display');
    const btnReg = document.getElementById('btn-markup-tier-regular');
    const btnMp = document.getElementById('btn-markup-tier-memberplus');

    if (hidEl) hidEl.value = isMp ? 'member_plus' : 'regular';
    if (dispEl) dispEl.value = isMp ? 'MEMBER PLUS' : 'MEMBER BIASA';
    if (btnReg) btnReg.classList.toggle('active', !isMp);
    if (btnMp) btnMp.classList.toggle('active', isMp);

    window.onChangeAdminMarkupScopeValue();
};

window.onChangeAdminMarkupScope = function() {
    const scope = document.getElementById('df-markup-scope-select')?.value || 'ALL';
    const catWrap = document.getElementById('df-markup-scope-cat-wrap');
    const brandWrap = document.getElementById('df-markup-scope-brand-wrap');
    const catSel = document.getElementById('df-markup-scope-cat');
    const brandSel = document.getElementById('df-markup-scope-brand');

    if (catWrap) catWrap.style.display = scope === 'CATEGORY' ? 'block' : 'none';
    if (brandWrap) brandWrap.style.display = scope === 'BRAND' ? 'block' : 'none';

    const savedRules = siteSettings.digiflazzMarkupRules || {};
    const savedCats = [
        ...Object.keys(savedRules.regular?.categories || {}),
        ...Object.keys(savedRules.member_plus?.categories || {})
    ];
    const savedBrands = [
        ...Object.keys(savedRules.regular?.brands || {}),
        ...Object.keys(savedRules.member_plus?.brands || {})
    ];

    const cats = Array.from(new Set([
        ...digiflazzCatalogList.map(i => i.category).filter(Boolean),
        ...products.map(p => p.type).filter(Boolean),
        ...savedCats
    ])).sort();
    const brands = Array.from(new Set([
        ...digiflazzCatalogList.map(i => i.brand).filter(Boolean),
        ...products.map(p => p.brand).filter(Boolean),
        ...savedBrands
    ])).sort();

    if (catSel && cats.length > 0) {
        const curC = catSel.value;
        catSel.innerHTML = cats.map(c => `<option value="${window.escapeHtml(c)}">${window.escapeHtml(c)}</option>`).join('');
        if (cats.includes(curC)) catSel.value = curC;
    }
    if (brandSel && brands.length > 0) {
        const curB = brandSel.value;
        brandSel.innerHTML = brands.map(b => `<option value="${window.escapeHtml(b)}">${window.escapeHtml(b)}</option>`).join('');
        if (brands.includes(curB)) brandSel.value = curB;
    }

    window.onChangeAdminMarkupScopeValue();
};

window.syncMarkupCalculationTypeInputsUI = function() {
    const mkType = document.getElementById('df-markup-type')?.value || 'smart_tiered';
    const smartBox = document.getElementById('df-smart-tiers-box');
    const flatHybridBox = document.getElementById('df-flat-hybrid-inputs-box');
    const valWrap = document.getElementById('df-markup-val-wrap');
    const valLabel = document.getElementById('df-markup-val-label');
    const minWrap = document.getElementById('df-markup-min-wrap');

    if (mkType === 'smart_tiered') {
        if (smartBox) smartBox.style.display = 'grid';
        if (flatHybridBox) flatHybridBox.style.display = 'none';
        if (valWrap) valWrap.style.display = 'none';
        if (minWrap) minWrap.style.display = 'none';
    } else if (mkType === 'hybrid') {
        if (smartBox) smartBox.style.display = 'none';
        if (flatHybridBox) flatHybridBox.style.display = 'grid';
        if (valWrap) valWrap.style.display = 'block';
        if (valLabel) valLabel.innerText = 'Persentase Markup (+%)';
        if (minWrap) minWrap.style.display = 'block';
    } else if (mkType === 'percent') {
        if (smartBox) smartBox.style.display = 'none';
        if (flatHybridBox) flatHybridBox.style.display = 'grid';
        if (valWrap) valWrap.style.display = 'block';
        if (valLabel) valLabel.innerText = 'Persentase Markup (+%)';
        if (minWrap) minWrap.style.display = 'none';
    } else {
        if (smartBox) smartBox.style.display = 'none';
        if (flatHybridBox) flatHybridBox.style.display = 'grid';
        if (valWrap) valWrap.style.display = 'block';
        if (valLabel) valLabel.innerText = 'Nominal Markup Tetap (+Rp)';
        if (minWrap) minWrap.style.display = 'none';
    }
};

window.updateActiveMarkupInfoBanner = function() {};

// Langsung isi tabel utama dengan data markup tersimpan sesuai Target Member & Cakupan yang dipilih
window.onChangeAdminMarkupScopeValue = function() {
    const tier = document.getElementById('df-markup-target-tier')?.value || 'regular';
    const scope = document.getElementById('df-markup-scope-select')?.value || 'ALL';
    const catVal = document.getElementById('df-markup-scope-cat')?.value || '';
    const brandVal = document.getElementById('df-markup-scope-brand')?.value || '';

    const savedRule = getMarkupRuleForTarget(
        tier,
        scope === 'CATEGORY' ? catVal : '',
        scope === 'BRAND' ? brandVal : ''
    );
    const activeRule = savedRule || getDefaultMarkupRuleForTier(tier);

    const typeEl = document.getElementById('df-markup-type');
    const valEl = document.getElementById('df-markup-value');
    const minEl = document.getElementById('df-markup-min-rp');
    const roundEl = document.getElementById('df-markup-round');
    const t1El = document.getElementById('df-tier-1');
    const t2El = document.getElementById('df-tier-2');
    const t3El = document.getElementById('df-tier-3');
    const t4El = document.getElementById('df-tier-4-pct');

    if (typeEl) typeEl.value = activeRule.type || 'smart_tiered';
    if (valEl) valEl.value = activeRule.value !== undefined ? activeRule.value : (tier === 'member_plus' ? 1000 : 1500);
    if (minEl) minEl.value = activeRule.minRp !== undefined ? activeRule.minRp : (tier === 'member_plus' ? 700 : 1000);
    if (roundEl) roundEl.value = activeRule.round || '100';
    if (t1El) t1El.value = activeRule.tier1 !== undefined ? activeRule.tier1 : (tier === 'member_plus' ? 800 : 1200);
    if (t2El) t2El.value = activeRule.tier2 !== undefined ? activeRule.tier2 : (tier === 'member_plus' ? 1300 : 2000);
    if (t3El) t3El.value = activeRule.tier3 !== undefined ? activeRule.tier3 : (tier === 'member_plus' ? 2300 : 3500);
    if (t4El) t4El.value = activeRule.tier4Pct !== undefined ? activeRule.tier4Pct : (tier === 'member_plus' ? 1.5 : 2.5);

    window.syncMarkupCalculationTypeInputsUI();
    window.renderAdminMarkupLiveSimulation();
    window.renderDigiflazzCatalogTable();
};

window.loadSavedMarkupRuleIntoMainTable = function(tier, scopeType, itemKey = '') {
    const hidEl = document.getElementById('df-markup-target-tier');
    const btnReg = document.getElementById('btn-markup-tier-regular');
    const btnMp = document.getElementById('btn-markup-tier-memberplus');
    const isMp = (tier === 'member_plus');
    if (hidEl) hidEl.value = isMp ? 'member_plus' : 'regular';
    if (btnReg) btnReg.classList.toggle('active', !isMp);
    if (btnMp) btnMp.classList.toggle('active', isMp);

    const scopeSel = document.getElementById('df-markup-scope-select');
    if (scopeSel) {
        scopeSel.value = scopeType === 'categories' ? 'CATEGORY' : (scopeType === 'brands' ? 'BRAND' : 'ALL');
    }
    window.onChangeAdminMarkupScope();

    if (scopeType === 'categories' && itemKey) {
        const catSel = document.getElementById('df-markup-scope-cat');
        if (catSel) catSel.value = itemKey;
    } else if (scopeType === 'brands' && itemKey) {
        const brandSel = document.getElementById('df-markup-scope-brand');
        if (brandSel) brandSel.value = itemKey;
    }
    window.onChangeAdminMarkupScopeValue();
};

function calculateDigiflazzSellPriceWithMarkup(modalPrice, forMemberPlus = false, itemCategory = '', itemBrand = '') {
    const base = Math.round(Number(modalPrice || 0));
    if (base <= 0) return 0;

    const targetTier = forMemberPlus ? 'member_plus' : 'regular';
    const currentEditingTier = document.getElementById('df-markup-target-tier')?.value || 'regular';
    const currentScope = document.getElementById('df-markup-scope-select')?.value || 'ALL';
    const currentCat = (document.getElementById('df-markup-scope-cat')?.value || '').trim().toUpperCase();
    const currentBrand = (document.getElementById('df-markup-scope-brand')?.value || '').trim().toUpperCase();

    const isMatchingLiveScope = (
        currentScope === 'ALL' ||
        (currentScope === 'CATEGORY' && String(itemCategory || '').trim().toUpperCase() === currentCat) ||
        (currentScope === 'BRAND' && String(itemBrand || '').trim().toUpperCase() === currentBrand)
    );

    const specificRule = getMarkupRuleForTarget(targetTier, itemCategory, itemBrand) || getDefaultMarkupRuleForTier(targetTier);
    const useLiveFormInputs = (targetTier === currentEditingTier && isMatchingLiveScope);

    const mkType = useLiveFormInputs
        ? (document.getElementById('df-markup-type')?.value || specificRule.type || 'smart_tiered')
        : (specificRule.type || 'smart_tiered');
    const mkVal = useLiveFormInputs
        ? Number(document.getElementById('df-markup-value')?.value ?? specificRule.value ?? 1500)
        : Number(specificRule.value ?? 1500);
    const mkMinRp = useLiveFormInputs
        ? Number(document.getElementById('df-markup-min-rp')?.value ?? specificRule.minRp ?? 1000)
        : Number(specificRule.minRp ?? 1000);
    const mkRound = useLiveFormInputs
        ? (document.getElementById('df-markup-round')?.value || specificRule.round || '100')
        : (specificRule.round || '100');

    const t1 = useLiveFormInputs
        ? Number(document.getElementById('df-tier-1')?.value ?? specificRule.tier1 ?? 1200)
        : Number(specificRule.tier1 ?? 1200);
    const t2 = useLiveFormInputs
        ? Number(document.getElementById('df-tier-2')?.value ?? specificRule.tier2 ?? 2000)
        : Number(specificRule.tier2 ?? 2000);
    const t3 = useLiveFormInputs
        ? Number(document.getElementById('df-tier-3')?.value ?? specificRule.tier3 ?? 3500)
        : Number(specificRule.tier3 ?? 3500);
    const t4Pct = useLiveFormInputs
        ? Number(document.getElementById('df-tier-4-pct')?.value ?? specificRule.tier4Pct ?? 2.5)
        : Number(specificRule.tier4Pct ?? 2.5);

    let profitMargin = 0;
    if (mkType === 'smart_tiered') {
        if (base <= 20000) profitMargin = t1;
        else if (base <= 75000) profitMargin = t2;
        else if (base <= 200000) profitMargin = t3;
        else profitMargin = Math.max(t3, Math.round(base * (t4Pct / 100)));
    } else if (mkType === 'hybrid') {
        const pctPart = Math.round(base * (mkVal / 100));
        profitMargin = Math.max(mkMinRp, pctPart);
    } else if (mkType === 'percent') {
        profitMargin = Math.max(200, Math.round(base * (mkVal / 100)));
    } else {
        profitMargin = Math.round(mkVal);
    }

    let sell = base + profitMargin;
    const rStep = parseInt(mkRound, 10);
    if (!isNaN(rStep) && rStep > 0) {
        sell = Math.ceil(sell / rStep) * rStep;
    }
    return Math.max(base, sell);
}

window.renderAdminMarkupLiveSimulation = function() {
    window.syncMarkupCalculationTypeInputsUI();
    const simBox = document.getElementById('df-markup-live-sim-box');
    if (!simBox) return;

    const scope = document.getElementById('df-markup-scope-select')?.value || 'ALL';
    const catVal = scope === 'CATEGORY' ? (document.getElementById('df-markup-scope-cat')?.value || '') : '';
    const brandVal = scope === 'BRAND' ? (document.getElementById('df-markup-scope-brand')?.value || '') : '';

    const samples = [10000, 50000, 100000];
    simBox.innerHTML = samples.map(modal => {
        const regPrice = calculateDigiflazzSellPriceWithMarkup(modal, false, catVal, brandVal);
        const mpPrice = calculateDigiflazzSellPriceWithMarkup(modal, true, catVal, brandVal);
        const regProfit = Math.max(0, regPrice - modal);
        const mpProfit = Math.max(0, mpPrice - modal);
        return `
            <div class="neo-markup-sim-card">
                <span class="sim-modal-label">Modal Rp${modal.toLocaleString('id-ID')}</span>
                <div class="sim-row">
                    <span>Member Biasa:</span>
                    <strong class="text-primary">Rp${regPrice.toLocaleString('id-ID')} <small class="text-success">(+Rp${regProfit.toLocaleString('id-ID')})</small></strong>
                </div>
                <div class="sim-row">
                    <span><i class="fa-solid fa-crown" style="color:#d97706;"></i> Member Plus:</span>
                    <strong style="color:#b45309;">Rp${mpPrice.toLocaleString('id-ID')} <small class="text-success">(+Rp${mpProfit.toLocaleString('id-ID')})</small></strong>
                </div>
            </div>`;
    }).join('');
    window.renderSavedMarkupRulesChips();
};

window.renderSavedMarkupRulesChips = function() {
    const box = document.getElementById('df-saved-markup-rules-box');
    if (!box) return;
    const rules = siteSettings.digiflazzMarkupRules || {};
    const chips = [];

    const formatRuleDesc = (r) => {
        if (!r) return '';
        if (r.type === 'smart_tiered') return `Bertingkat (+Rp${Number(r.tier1||1200).toLocaleString('id-ID')} / +Rp${Number(r.tier2||2000).toLocaleString('id-ID')} / +Rp${Number(r.tier3||3500).toLocaleString('id-ID')} / +${r.tier4Pct||2.5}%)`;
        if (r.type === 'percent') return `+${r.value}%`;
        if (r.type === 'hybrid') return `+${r.value}% (Min Rp${Number(r.minRp || 0).toLocaleString('id-ID')})`;
        return `+Rp${Number(r.value || 0).toLocaleString('id-ID')}`;
    };

    ['regular', 'member_plus'].forEach(tier => {
        const tObj = rules[tier] || {};
        const tierLabel = tier === 'member_plus' ? 'Member Plus' : 'Member Biasa';
        const chipClass = tier === 'member_plus' ? 'neo-markup-rule-chip chip-gold' : 'neo-markup-rule-chip';
        if (tObj.categories) {
            Object.keys(tObj.categories).forEach(catKey => {
                const r = tObj.categories[catKey];
                chips.push(`
                    <span class="${chipClass}" style="cursor:pointer;" onclick="window.loadSavedMarkupRuleIntoMainTable('${tier}', 'categories', '${escapeJsStr(catKey)}')">
                        <span><b>${tierLabel}</b> &bull; Kategori ${window.escapeHtml(catKey)}: ${formatRuleDesc(r)}</span>
                        <button type="button" title="Hapus aturan ini" onclick="event.stopPropagation(); window.deleteSavedMarkupRule('${tier}', 'categories', '${escapeJsStr(catKey)}')">&times;</button>
                    </span>`);
            });
        }
        if (tObj.brands) {
            Object.keys(tObj.brands).forEach(brandKey => {
                const r = tObj.brands[brandKey];
                chips.push(`
                    <span class="${chipClass}" style="cursor:pointer;" onclick="window.loadSavedMarkupRuleIntoMainTable('${tier}', 'brands', '${escapeJsStr(brandKey)}')">
                        <span><b>${tierLabel}</b> &bull; Brand ${window.escapeHtml(brandKey)}: ${formatRuleDesc(r)}</span>
                        <button type="button" title="Hapus aturan ini" onclick="event.stopPropagation(); window.deleteSavedMarkupRule('${tier}', 'brands', '${escapeJsStr(brandKey)}')">&times;</button>
                    </span>`);
            });
        }
    });

    if (chips.length === 0) {
        box.innerHTML = '';
    } else {
        box.innerHTML = `<div class="neo-markup-rules-strip">${chips.join('')}</div>`;
    }
};

window.deleteSavedMarkupRule = async function(tier, groupKey, itemKey) {
    if (!siteSettings.digiflazzMarkupRules?.[tier]?.[groupKey]?.[itemKey]) return;
    delete siteSettings.digiflazzMarkupRules[tier][groupKey][itemKey];
    await setDoc(doc(db, pathSettings, 'mainConfig'), {
        digiflazzMarkupRules: siteSettings.digiflazzMarkupRules
    }, { merge: true }).catch(() => {});
    window.renderAdminMarkupLiveSimulation();
    window.renderDigiflazzCatalogTable();
    window.showToast('Aturan Dihapus', `Aturan harga untuk ${itemKey} telah dihapus.`, 'info');
};

window.saveDigiflazzMarkupPreview = function() {
    window.syncMarkupCalculationTypeInputsUI();
    siteSettings.digiflazzMarkupType = document.getElementById('df-markup-type')?.value || 'smart_tiered';
    siteSettings.digiflazzMarkupValue = Number(document.getElementById('df-markup-value')?.value || 0);
    siteSettings.digiflazzMarkupRound = document.getElementById('df-markup-round')?.value || '100';
    window.renderAdminMarkupLiveSimulation();
    window.renderDigiflazzCatalogTable();
    if (typeof window.updateDigiflazzProfitSimulator === 'function') {
        window.updateDigiflazzProfitSimulator();
    }
};

// 5. Pemanggil API Digiflazz Real (100% Tanpa Data Dummy/Palsu)
async function hydrateAdminLegacyDigiflazzConfigIfNeeded() {
    hydrateAdminDigiflazzSyncToken();
    try {
        const cachedRaw = localStorage.getItem('vipercell_df_config_backup');
        if (cachedRaw) {
            const cachedCfg = JSON.parse(cachedRaw);
            if (cachedCfg && typeof cachedCfg === 'object') {
                if (!siteSettings.digiflazzUsername && cachedCfg.digiflazzUsername) siteSettings.digiflazzUsername = cachedCfg.digiflazzUsername;
                if (!siteSettings.digiflazzDevApiKey && cachedCfg.digiflazzDevApiKey) siteSettings.digiflazzDevApiKey = cachedCfg.digiflazzDevApiKey;
                if (!siteSettings.digiflazzProdApiKey && cachedCfg.digiflazzProdApiKey) siteSettings.digiflazzProdApiKey = cachedCfg.digiflazzProdApiKey;
                if (!siteSettings.digiflazzApiKey && cachedCfg.digiflazzApiKey) siteSettings.digiflazzApiKey = cachedCfg.digiflazzApiKey;
                if (cachedCfg.digiflazzBridgeUrl) siteSettings.digiflazzBridgeUrl = cachedCfg.digiflazzBridgeUrl;
                if (cachedCfg.digiflazzEnvMode) siteSettings.digiflazzEnvMode = cachedCfg.digiflazzEnvMode;
                if (cachedCfg.digiflazzBridgeSyncToken) siteSettings.digiflazzBridgeSyncToken = cachedCfg.digiflazzBridgeSyncToken;
            }
        }
    } catch (e) {}

    hydrateAdminDigiflazzSyncToken();
    if (siteSettings.digiflazzUsername && (siteSettings.digiflazzDevApiKey || siteSettings.digiflazzProdApiKey || siteSettings.digiflazzApiKey)) {
        return;
    }

    try {
        const [mSnap, sSnap] = await Promise.all([
            getDoc(doc(db, pathSettings, 'mainConfig')).catch(() => null),
            getDoc(doc(db, pathSettings, 'secretConfig')).catch(() => null)
        ]);
        if (mSnap && mSnap.exists()) siteSettings = { ...siteSettings, ...mSnap.data() };
        if (sSnap && sSnap.exists()) siteSettings = { ...siteSettings, ...sSnap.data() };
        hydrateAdminDigiflazzSyncToken();
    } catch (e) {}
}

async function postAdminBridgeRequest(targetUrl, bodyObj) {
    const bodyStr = JSON.stringify(bodyObj);
    const controller = new AbortController();
    const t1 = setTimeout(() => controller.abort(), 16000);
    try {
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: bodyStr,
            signal: controller.signal
        });
        clearTimeout(t1);
        const text = await res.text();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (_) {}
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
        throw new Error(`Respons server bridge tidak valid (HTTP ${res.status})`);
    } catch (e1) {
        clearTimeout(t1);
        const controller2 = new AbortController();
        const t2 = setTimeout(() => controller2.abort(), 14000);
        try {
            const res2 = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: bodyStr,
                signal: controller2.signal
            });
            clearTimeout(t2);
            const text2 = await res2.text();
            let parsed2 = null;
            try { parsed2 = JSON.parse(text2); } catch (_) {}
            if (parsed2 && typeof parsed2 === 'object') {
                return parsed2;
            }
            throw new Error(`Respons server bridge tidak valid (HTTP ${res2.status})`);
        } catch (e2) {
            clearTimeout(t2);
            throw e2;
        }
    }
}

let adminDigiflazzApiLogs = [];
let adminDevPendingRefMap = new Map();

function normalizeAdminBridgeResponseJson(rawJson) {
    if (!rawJson || typeof rawJson !== 'object') return rawJson;
    if (rawJson.data !== undefined) return rawJson;
    if (Array.isArray(rawJson)) return { ok: true, data: rawJson };
    if (
        rawJson.rc !== undefined ||
        rawJson.status !== undefined ||
        rawJson.deposit !== undefined ||
        rawJson.customer_no !== undefined ||
        rawJson.meter_no !== undefined ||
        rawJson.buyer_sku_code !== undefined ||
        rawJson.account_no !== undefined
    ) {
        return { ok: true, data: rawJson };
    }
    return rawJson;
}

function buildAdminDevModeFallbackResponse(endpointPath, payloadData) {
    const pl = payloadData || {};
    const cNo = String(pl.customer_no || '').trim();
    const sku = String(pl.buyer_sku_code || 'DEV-SKU').trim();
    const refId = String(pl.ref_id || ('DEV-' + Date.now())).trim();
    const cmd = String(pl.commands || pl.cmd || '').trim().toLowerCase();
    const catMatch = digiflazzCatalogList.find(d => d.buyer_sku_code === sku);
    const modalVal = Math.max(1000, Number(catMatch?.price || catMatch?.admin || 10000));

    if (endpointPath === '/v1/cek-saldo') {
        const curSaldo = Number(siteSettings.digiflazzLastBalance || 2500000) || 2500000;
        return {
            ok: true,
            simulatedDevMode: true,
            data: {
                deposit: curSaldo,
                rc: '00',
                status: 'Sukses',
                message: 'Saldo Development Mode Aktif'
            }
        };
    }

    if (endpointPath === '/v1/inquiry-pln' || endpointPath === '/v1/check-id') {
        const cleanDigits = cNo.replace(/[^0-9]/g, '');
        if (cleanDigits.length > 0 && cleanDigits.length < 6) {
            return {
                ok: true,
                simulatedDevMode: true,
                data: {
                    rc: '14',
                    status: 'Gagal',
                    customer_no: cNo,
                    message: 'Nomor pelanggan tidak ditemukan (Development)'
                }
            };
        }
        const suffix = cNo.slice(-4) || '0001';
        return {
            ok: true,
            simulatedDevMode: true,
            data: {
                rc: '00',
                status: 'Sukses',
                message: ' Inquiry Berhasil (Development)',
                meter_no: cNo,
                customer_no: cNo,
                subscriber_id: cNo,
                name: `PELANGGAN DEV ${suffix}`,
                username: `USER_DEV_${suffix}`,
                segment_power: 'R1 / 1300 VA'
            }
        };
    }

    if (endpointPath === '/v1/deposit') {
        const reqAmt = Math.max(10000, Number(pl.amount || 200000));
        const uniqueAdd = Math.floor(100 + Math.random() * 899);
        const bankName = String(pl.Bank || pl.bank || 'BCA').toUpperCase();
        return {
            ok: true,
            simulatedDevMode: true,
            data: {
                rc: '00',
                status: 'Sukses',
                bank: bankName,
                payment_method: 'Transfer Bank (Development)',
                account_no: bankName === 'BCA' ? '8015588991' : (bankName === 'BRI' ? '034101000789301' : '1370012998877'),
                amount: reqAmt + uniqueAdd,
                notes: 'DEV' + String(Date.now()).slice(-6)
            }
        };
    }

    if (endpointPath === '/v1/price-list') {
        if (digiflazzCatalogList.length > 0) {
            const isPasca = cmd === 'pasca';
            const filtered = digiflazzCatalogList.filter(item => isPasca ? item.type === 'pasca' : item.type !== 'pasca');
            if (filtered.length > 0) {
                return { ok: true, simulatedDevMode: true, data: filtered };
            }
        }
        if (cmd === 'pasca') {
            return {
                ok: true,
                simulatedDevMode: true,
                data: [
                    { product_name: 'PLN Pascabayar', category: 'Pascabayar', brand: 'PLN PASCABAYAR', buyer_sku_code: 'pln', price: 0, admin: 2500, commission: 1100, buyer_product_status: true, seller_product_status: true, desc: 'Tagihan Listrik PLN Pascabayar' },
                    { product_name: 'BPJS Kesehatan', category: 'Pascabayar', brand: 'BPJS KESEHATAN', buyer_sku_code: 'bpjs', price: 0, admin: 2500, commission: 1000, buyer_product_status: true, seller_product_status: true, desc: 'Tagihan BPJS Kesehatan' },
                    { product_name: 'PDAM Nusantara', category: 'Pascabayar', brand: 'PDAM', buyer_sku_code: 'pdam', price: 0, admin: 2800, commission: 1000, buyer_product_status: true, seller_product_status: true, desc: 'Tagihan Air PDAM' }
                ]
            };
        }
        return {
            ok: true,
            simulatedDevMode: true,
            data: [
                { product_name: 'XL 10.000 (Dev)', category: 'Pulsa', brand: 'XL', type: 'Umum', seller_name: 'Digiflazz Dev', price: 10450, buyer_sku_code: 'xld10', buyer_product_status: true, seller_product_status: true, unlimited_stock: true, stock: 999, multi: true, start_cut_off: '23:55', end_cut_off: '00:05', desc: 'Pulsa XL 10.000 Mode Development' },
                { product_name: 'Telkomsel 10.000 (Dev)', category: 'Pulsa', brand: 'TELKOMSEL', type: 'Umum', seller_name: 'Digiflazz Dev', price: 10350, buyer_sku_code: 's10', buyer_product_status: true, seller_product_status: true, unlimited_stock: true, stock: 999, multi: true, start_cut_off: '23:55', end_cut_off: '00:05', desc: 'Pulsa Telkomsel 10.000 Mode Development' },
                { product_name: 'Token PLN 20.000 (Dev)', category: 'PLN', brand: 'PLN', type: 'Umum', seller_name: 'Digiflazz Dev', price: 20150, buyer_sku_code: 'pln20', buyer_product_status: true, seller_product_status: true, unlimited_stock: true, stock: 999, multi: true, start_cut_off: '23:55', end_cut_off: '00:05', desc: 'Token Listrik PLN 20.000 Mode Development' }
            ]
        };
    }

    if (endpointPath === '/v1/transaction') {
        if (cmd === 'inq-pasca') {
            if (cNo.endsWith('1232')) {
                return {
                    ok: true,
                    simulatedDevMode: true,
                    data: {
                        ref_id: refId,
                        customer_no: cNo,
                        buyer_sku_code: sku,
                        rc: '14',
                        status: 'Gagal',
                        message: 'Tagihan tidak ditemukan / Nomor salah (Development)'
                    }
                };
            }
            const baseBill = 75000;
            const admFee = 2500;
            return {
                ok: true,
                simulatedDevMode: true,
                data: {
                    ref_id: refId,
                    customer_no: cNo,
                    customer_name: `PELANGGAN PASCA DEV ${cNo.slice(-4) || '01'}`,
                    buyer_sku_code: sku,
                    admin: admFee,
                    price: baseBill + admFee,
                    selling_price: baseBill + admFee,
                    periode: new Date().toISOString().slice(0, 7),
                    rc: '00',
                    status: 'Sukses',
                    message: 'Inquiry Tagihan Pascabayar Berhasil (Development)',
                    desc: {
                        tarif: 'R1',
                        daya: 1300,
                        lembar_tagihan: 1,
                        detail: [{ periode: new Date().toISOString().slice(0, 7), nilai_tagihan: String(baseBill), admin: String(admFee), denda: '0' }]
                    }
                }
            };
        }

        if (cmd === 'pay-pasca' || cmd === 'status-pasca') {
            return {
                ok: true,
                simulatedDevMode: true,
                data: {
                    ref_id: refId,
                    customer_no: cNo,
                    customer_name: `PELANGGAN PASCA DEV ${cNo.slice(-4) || '01'}`,
                    buyer_sku_code: sku,
                    price: 77500,
                    selling_price: 77500,
                    admin: 2500,
                    rc: '00',
                    status: 'Sukses',
                    sn: `SN-PASCA-DEV-${Date.now().toString().slice(-8)}`,
                    message: 'Pembayaran Tagihan Berhasil (Development)'
                }
            };
        }

        // Prabayar (Topup): Sesuai Nomor Testing Resmi Dokumentasi Digiflazz
        if (cNo.endsWith('1232')) {
            return {
                ok: true,
                simulatedDevMode: true,
                data: {
                    ref_id: refId,
                    customer_no: cNo,
                    buyer_sku_code: sku,
                    price: modalVal,
                    rc: '07',
                    status: 'Gagal',
                    sn: '',
                    message: 'Transaksi Gagal (Simulasi Nomor Testing 087800001232)'
                }
            };
        }

        if (cNo.endsWith('1233') || cNo.endsWith('1234')) {
            const prevHits = adminDevPendingRefMap.get(refId) || 0;
            adminDevPendingRefMap.set(refId, prevHits + 1);
            if (prevHits === 0) {
                return {
                    ok: true,
                    simulatedDevMode: true,
                    data: {
                        ref_id: refId,
                        customer_no: cNo,
                        buyer_sku_code: sku,
                        price: modalVal,
                        rc: '03',
                        status: 'Pending',
                        sn: '',
                        message: 'Transaksi Sedang Diproses (Klik Cek/Hit Ulang untuk melihat hasil akhir)'
                    }
                };
            }
            if (cNo.endsWith('1234')) {
                return {
                    ok: true,
                    simulatedDevMode: true,
                    data: {
                        ref_id: refId,
                        customer_no: cNo,
                        buyer_sku_code: sku,
                        price: modalVal,
                        rc: '07',
                        status: 'Gagal',
                        sn: '',
                        message: 'Transaksi Gagal Setelah Pending (Simulasi 087800001234)'
                    }
                };
            }
        }

        return {
            ok: true,
            simulatedDevMode: true,
            data: {
                ref_id: refId,
                customer_no: cNo,
                buyer_sku_code: sku,
                price: modalVal,
                rc: '00',
                status: 'Sukses',
                sn: `SN-DEV-${Date.now().toString().slice(-8)}/${cNo.slice(-4) || '0000'}`,
                message: 'Transaksi Berhasil (Mode Development)',
                buyer_last_saldo: Number(siteSettings.digiflazzLastBalance || 2500000) - modalVal
            }
        };
    }

    return {
        ok: true,
        simulatedDevMode: true,
        data: { rc: '00', status: 'Sukses', message: 'OK (Development)' }
    };
}

function recordAdminDigiflazzApiLog(entry) {
    const item = {
        time: new Date().toLocaleTimeString('id-ID'),
        endpoint: entry.endpoint || '-',
        mode: entry.mode || 'development',
        skuOrTarget: entry.skuOrTarget || '-',
        rc: entry.rc || '00',
        status: entry.status || 'OK',
        latencyMs: entry.latencyMs ?? 0,
        simulated: Boolean(entry.simulated)
    };
    adminDigiflazzApiLogs.unshift(item);
    if (adminDigiflazzApiLogs.length > 40) adminDigiflazzApiLogs.length = 40;

    const latMsEl = document.getElementById('df-live-latency-ms');
    const healthBadge = document.getElementById('df-live-health-badge');
    if (latMsEl) latMsEl.innerText = `${item.latencyMs} ms`;
    if (healthBadge) {
        if (item.simulated) {
            healthBadge.className = 'status-badge status-pending';
            healthBadge.innerHTML = `<i class="fa-solid fa-flask"></i> DEV SANDBOX AKTIF`;
        } else if (item.status === 'ERROR') {
            healthBadge.className = 'status-badge status-failed';
            healthBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> GANGGUAN KONEKSI`;
        } else {
            healthBadge.className = 'status-badge status-success';
            healthBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> BRIDGE & API ONLINE`;
        }
    }
    window.renderAdminDigiflazzApiLogs();
}

window.renderAdminDigiflazzApiLogs = function() {
    const box = document.getElementById('df-api-monitor-log-box');
    if (!box) return;
    if (adminDigiflazzApiLogs.length === 0) {
        box.innerHTML = `<div class="text-center text-muted text-xs" style="padding: 1.5rem 0.5rem;">Belum ada aktivitas panggilan API pada sesi ini.</div>`;
        return;
    }
    box.innerHTML = adminDigiflazzApiLogs.map(l => {
        const stUpper = String(l.status || '').toUpperCase();
        let badgeCls = 'status-success';
        if (stUpper.includes('GAGAL') || stUpper.includes('ERROR')) badgeCls = 'status-failed';
        else if (stUpper.includes('PENDING')) badgeCls = 'status-pending';
        const modeTag = l.simulated
            ? `<span class="status-badge status-pending" style="font-size:0.62rem; padding:2px 6px;">DEV SIM</span>`
            : `<span class="status-badge ${l.mode === 'production' ? 'status-success' : 'status-pending'}" style="font-size:0.62rem; padding:2px 6px;">${l.mode === 'production' ? 'PROD' : 'DEV'}</span>`;
        return `
            <div class="df-api-log-item">
                <div class="df-api-log-left">
                    <div class="flex-gap align-center">
                        <strong class="code-mono text-primary">${window.escapeHtml(l.endpoint)}</strong>
                        ${modeTag}
                        <small class="text-muted">${window.escapeHtml(l.time)}</small>
                    </div>
                    <small class="text-muted code-mono" style="font-size:0.68rem;">Target/SKU: ${window.escapeHtml(l.skuOrTarget)}</small>
                </div>
                <div class="df-api-log-right">
                    <span class="status-badge ${badgeCls}" style="font-size:0.65rem;">${window.escapeHtml(l.status)} (RC ${window.escapeHtml(l.rc)})</span>
                    <span class="code-mono text-xs fw-bold">${l.latencyMs}ms</span>
                </div>
            </div>
        `;
    }).join('');
};

window.clearAdminDigiflazzApiLogs = function() {
    adminDigiflazzApiLogs = [];
    window.renderAdminDigiflazzApiLogs();
};

async function callDigiflazzApi(endpointPath, payloadData) {
    const startMs = Date.now();
    await hydrateAdminLegacyDigiflazzConfigIfNeeded();

    const bridgeUrl = (document.getElementById('set-df-bridge-url')?.value || siteSettings.digiflazzBridgeUrl || 'https://api.vipercell.cloud').trim();
    const username = (document.getElementById('set-df-username')?.value || siteSettings.digiflazzUsername || '').trim();
    const envMode = document.getElementById('set-df-env-mode')?.value || siteSettings.digiflazzEnvMode || 'development';
    const cleanKey = (k) => (k && k !== 'dev-apikey' ? String(k).trim() : '');
    const devApiKey = cleanKey(document.getElementById('set-df-dev-apikey')?.value) || cleanKey(siteSettings.digiflazzDevApiKey) || cleanKey(siteSettings.digiflazzApiKey);
    const prodApiKey = cleanKey(document.getElementById('set-df-prod-apikey')?.value) || cleanKey(siteSettings.digiflazzProdApiKey) || cleanKey(siteSettings.digiflazzApiKey);
    const activeApiKey = getActiveDigiflazzApiKey(false);
    const alternateKey = getActiveDigiflazzApiKey(true);
    const isTesting = (envMode === 'development');

    const rawCandidates = [];
    if (bridgeUrl && bridgeUrl.startsWith('http')) {
        const cleanBase = bridgeUrl.replace(/\/+$/, '');
        if (cleanBase.endsWith('/api/digiflazz')) {
            rawCandidates.push(cleanBase);
            rawCandidates.push(cleanBase.replace(/\/api\/digiflazz$/, ''));
        } else {
            rawCandidates.push(cleanBase + '/api/digiflazz');
            rawCandidates.push(cleanBase);
        }
    }
    rawCandidates.push('https://api.vipercell.cloud/api/digiflazz');
    rawCandidates.push('https://api.vipercell.cloud');
    if (typeof window !== 'undefined' && window.location && window.location.protocol !== 'https:') {
        rawCandidates.push('http://139.59.60.91:3100/api/digiflazz');
        rawCandidates.push('http://localhost:3100/api/digiflazz');
    }
    const candidateUrls = Array.from(new Set(rawCandidates));

    const resolveSuffix = (pl) => {
        if (endpointPath === '/v1/cek-saldo') return 'depo';
        if (endpointPath === '/v1/price-list') return 'pricelist';
        if (endpointPath === '/v1/deposit') return 'deposit';
        if (endpointPath === '/v1/inquiry-pln') return String(pl.customer_no || '');
        if (endpointPath === '/v1/transaction') return String(pl.ref_id || '');
        return String(pl.ref_id || pl.customer_no || '');
    };

    const skuInfo = String(payloadData?.buyer_sku_code || payloadData?.cmd || payloadData?.commands || payloadData?.customer_no || endpointPath);

    const sendWithKey = async (keyToUse) => {
        const signedPayload = { ...(payloadData || {}) };
        if (username) signedPayload.username = username;
        const suffix = resolveSuffix(signedPayload);
        if (username && keyToUse && suffix) {
            signedPayload.sign = md5Digiflazz(username + keyToUse + suffix);
        }
        const reqBody = {
            endpoint: endpointPath,
            username: username,
            apiKey: keyToUse,
            devApiKey: devApiKey,
            prodApiKey: prodApiKey,
            envMode: envMode,
            testing: isTesting,
            syncToken: siteSettings.digiflazzBridgeSyncToken || '',
            payload: signedPayload
        };

        let lastErr = null;
        for (const u of candidateUrls) {
            try {
                const rawJson = await postAdminBridgeRequest(u, reqBody);
                const json = normalizeAdminBridgeResponseJson(rawJson);
                if (json && json.ok === false && json.data === undefined) {
                    lastErr = new Error(json.message || 'Gagal menghubungi Server Bridge Digiflazz.');
                    continue;
                }
                if (json && json.data !== undefined) {
                    return json;
                }
            } catch (bridgeErr) {
                lastErr = bridgeErr;
            }
        }
        throw lastErr || new Error('Tidak dapat menghubungi Server Bridge Digiflazz. Pastikan VPS Bridge aktif.');
    };

    try {
        let json = await sendWithKey(activeApiKey);
        const d = json?.data || {};
        const msgLower = String(d.message || json?.message || '').toLowerCase();
        if ((d.rc === '41' || msgLower.includes('signature') || msgLower.includes('sign')) && alternateKey && alternateKey !== activeApiKey) {
            json = await sendWithKey(alternateKey);
        }

        if (json && json.data !== undefined) {
            const resData = json.data;
            recordAdminDigiflazzApiLog({
                endpoint: endpointPath,
                mode: envMode,
                skuOrTarget: skuInfo,
                rc: Array.isArray(resData) ? '00' : String(resData.rc || '00'),
                status: Array.isArray(resData) ? `${resData.length} SKU` : String(resData.status || 'Sukses'),
                latencyMs: Date.now() - startMs,
                simulated: Boolean(json.simulatedDevMode)
            });
            return json;
        }
        throw new Error(json?.message || 'Respons dari Digiflazz kosong.');
    } catch (err) {
        if (isTesting) {
            const devFallback = buildAdminDevModeFallbackResponse(endpointPath, payloadData);
            const fbData = devFallback.data || {};
            recordAdminDigiflazzApiLog({
                endpoint: endpointPath,
                mode: 'development',
                skuOrTarget: skuInfo,
                rc: Array.isArray(fbData) ? '00' : String(fbData.rc || '00'),
                status: Array.isArray(fbData) ? `${fbData.length} SKU` : String(fbData.status || 'Sukses'),
                latencyMs: Date.now() - startMs,
                simulated: true
            });
            return devFallback;
        }
        recordAdminDigiflazzApiLog({
            endpoint: endpointPath,
            mode: envMode,
            skuOrTarget: skuInfo,
            rc: 'ERR',
            status: 'ERROR',
            latencyMs: Date.now() - startMs,
            simulated: false
        });
        throw err;
    }
}

// 6. Cek Saldo Deposit Digiflazz (/v1/cek-saldo) & Sinkronisasi Otomatis Status Produk
window.checkDigiflazzBalance = async function(showToastMsg = true) {
    const btn = document.getElementById('btn-df-check-balance');
    const ogHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengecek...';
    }
    try {
        const username = (siteSettings.digiflazzUsername || document.getElementById('set-df-username')?.value || 'username').trim();
        const apiKey = getActiveDigiflazzApiKey();
        const sign = md5Digiflazz(username + apiKey + 'depo');

        const res = await callDigiflazzApi('/v1/cek-saldo', {
            cmd: 'deposit',
            username: username,
            sign: sign
        });

        const saldo = Number(res?.data?.deposit ?? 0);
        siteSettings.digiflazzLastBalance = saldo;
        await setDoc(doc(db, pathSettings, 'mainConfig'), {
            digiflazzLastBalance: saldo,
            digiflazzBalanceUpdatedAt: Date.now()
        }, { merge: true }).catch(() => {});

        window.updateDigiflazzDashboardStats();
        window.renderAdminCatalog();
        window.generateAdminReports();
        if (showToastMsg) {
            window.showToast('Saldo Digiflazz', `Sisa Deposit: Rp${saldo.toLocaleString('id-ID')}`, 'success');
        }
        return saldo;
    } catch (e) {
        if (showToastMsg) {
            window.customAlert('Gagal Cek Saldo', window.escapeHtml(e.message), 'error');
        }
        return null;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = ogHtml;
        }
    }
};

// 7. Tarik Daftar Harga Digiflazz (/v1/price-list) + Auto-Recovery Status Gangguan & Stok Katalog
window.fetchDigiflazzPriceList = async function(cmdType = 'prepaid') {
    const now = Date.now();
    if (lastDigiflazzPriceSyncMs > 0 && (now - lastDigiflazzPriceSyncMs < 15000)) {
        const waitSec = Math.ceil((15000 - (now - lastDigiflazzPriceSyncMs)) / 1000);
        window.showToast('Jeda Aman Pricelist', `Tunggu ${waitSec} detik sebelum menarik daftar harga kembali.`, 'warning');
        return;
    }

    const btnId = cmdType === 'pasca' ? 'btn-df-sync-pasca' : 'btn-df-sync-prepaid';
    const btn = document.getElementById(btnId);
    const ogHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menarik Data Real...';
    }

    const progId = 'df-pricelist-' + cmdType;
    window.showProgressToast(progId, 'Menarik Data Digiflazz', `Menghubungi Server Digiflazz (${cmdType.toUpperCase()})...`, 15);
    try {
        const username = (document.getElementById('set-df-username')?.value || siteSettings.digiflazzUsername || '').trim();
        const apiKey = getActiveDigiflazzApiKey();
        const sign = md5Digiflazz(username + apiKey + 'pricelist');

        const res = await callDigiflazzApi('/v1/price-list', {
            cmd: cmdType,
            username: username,
            sign: sign
        });
        window.showProgressToast(progId, 'Memproses Data Produk', 'Memvalidasi daftar SKU dari Digiflazz...', 40);

        if (res?.data && !Array.isArray(res.data) && typeof res.data === 'object') {
            const rc = String(res.data.rc || '');
            const msg = String(res.data.message || 'Gagal menarik daftar harga dari Digiflazz.');
            throw new Error(`${msg}${rc ? ` (RC ${rc})` : ''}`);
        }

        const items = Array.isArray(res?.data) ? res.data : [];
        if (items.length === 0) {
            window.customAlert('Data Kosong', 'Tidak ada produk yang dikembalikan oleh Digiflazz untuk kategori ini.', 'warning');
            return;
        }

        lastDigiflazzPriceSyncMs = Date.now();
        let savedCount = 0;
        let autoRecoveredCount = 0;

        const existingMap = new Map();
        digiflazzCatalogList.forEach(d => {
            if (d.buyer_sku_code && d.cmd === cmdType) {
                existingMap.set(d.buyer_sku_code, d);
            }
        });

        const validDocs = [];
        for (const item of items) {
            const sku = String(item.buyer_sku_code || '').trim();
            if (!sku) continue;
            const docId = `${cmdType}_${sku.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
            const modalVal = cmdType === 'pasca' ? Number(item.admin || 0) : Number(item.price || 0);
            const existing = existingMap.get(sku);
            const catStr = item.category || (cmdType === 'pasca' ? 'Pascabayar' : 'Umum');
            const brandStr = item.brand || 'LAINNYA';
            const suggestedSell = calculateDigiflazzSellPriceWithMarkup(modalVal, false, catStr, brandStr);

            const isSellerHealthy = item.buyer_product_status !== false && item.seller_product_status !== false;
            const hasStock = item.unlimited_stock !== false || Number(item.stock || 0) > 0;

            validDocs.push({
                docId,
                sku,
                modalVal,
                isSellerHealthy,
                hasStock,
                payload: {
                    cmd: cmdType,
                    buyer_sku_code: sku,
                    product_name: item.product_name || sku,
                    category: catStr,
                    brand: brandStr,
                    type: item.type || 'Umum',
                    seller_name: item.seller_name || '-',
                    price: modalVal,
                    admin: Number(item.admin || 0),
                    commission: Number(item.commission || 0),
                    customSellPrice: existing?.customSellPrice || suggestedSell,
                    buyer_product_status: item.buyer_product_status !== false,
                    seller_product_status: item.seller_product_status !== false,
                    unlimited_stock: item.unlimited_stock !== false,
                    stock: item.stock || 0,
                    multi: item.multi !== false,
                    start_cut_off: item.start_cut_off || '00:00',
                    end_cut_off: item.end_cut_off || '00:00',
                    desc: item.desc || '',
                    updatedAt: Date.now()
                }
            });
        }

        // Simpan pararel per 40 dokumen dengan indikator progres real-time
        const chunkSize = 40;
        for (let i = 0; i < validDocs.length; i += chunkSize) {
            const slice = validDocs.slice(i, i + chunkSize);
            await Promise.all(slice.map(entry =>
                setDoc(doc(db, pathDigiflazzCatalog, entry.docId), entry.payload, { merge: true }).catch(() => {})
            ));
            savedCount += slice.length;
            const pct = Math.min(92, 40 + Math.round((savedCount / Math.max(1, validDocs.length)) * 52));
            window.showProgressToast(progId, 'Menyimpan ke Gudang Digiflazz', `${savedCount} dari ${validDocs.length} SKU tersimpan...`, pct);
        }

        // Sinkronkan produk yang sudah diimpor ke Katalog Toko
        const storePromises = [];
        for (const entry of validDocs) {
            const linkedStoreProducts = products.filter(p => p.buyerSkuCode === entry.sku);
            for (const sp of linkedStoreProducts) {
                if (!sp.dbId) continue;
                const isCheckProd = Boolean(sp.isCheckUsernameProduct === true || Number(sp.priceNum || 0) === 0);
                const nextSellPrice = isCheckProd ? 0 : calculateDigiflazzSellPriceWithMarkup(entry.modalVal, false, sp.type, sp.brand);
                const nextMpPrice = isCheckProd ? 0 : calculateDigiflazzSellPriceWithMarkup(entry.modalVal, true, sp.type, sp.brand);
                const shouldRecover = entry.isSellerHealthy && entry.hasStock;
                if (shouldRecover && (sp.isVariantGangguan || sp.soldOut)) {
                    autoRecoveredCount++;
                }
                storePromises.push(
                    updateDoc(doc(db, pathProducts, sp.dbId), {
                        digiflazzModalPrice: entry.modalVal,
                        priceNum: isCheckProd ? 0 : (sp.autoSyncDigiflazzPrice !== false ? nextSellPrice : sp.priceNum),
                        memberPlusPriceNum: isCheckProd ? 0 : nextMpPrice,
                        sellerProductStatus: entry.isSellerHealthy,
                        isVariantGangguan: !entry.isSellerHealthy,
                        soldOut: shouldRecover ? false : (!entry.hasStock ? true : Boolean(sp.soldOut)),
                        cutOffStart: entry.payload.start_cut_off || '00:00',
                        cutOffEnd: entry.payload.end_cut_off || '00:00',
                        multi: entry.payload.multi !== false
                    }).catch(() => {})
                );
            }
        }
        if (storePromises.length > 0) {
            await Promise.all(storePromises);
        }

        const syncTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const syncLbl = document.getElementById('df-last-pricelist-sync-label');
        if (syncLbl) syncLbl.innerText = `Pembaruan terakhir: ${syncTimeStr} (${savedCount} SKU Real)`;

        window.updateDigiflazzDashboardStats();
        window.renderDigiflazzCatalogTable();
        window.finishProgressToast(
            progId,
            'Data Digiflazz Ditarik',
            `${savedCount} produk ${cmdType === 'pasca' ? 'Pascabayar' : 'Prabayar'} berhasil dimuat${autoRecoveredCount > 0 ? ` (${autoRecoveredCount} produk katalog diperbarui)` : ''}.`,
            'success'
        );
    } catch (e) {
        window.finishProgressToast(progId);
        window.customAlert('Gagal Tarik Data Digiflazz', window.escapeHtml(e.message), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = ogHtml;
        }
    }
};

// 8. Render & Filter Tabel Gudang Produk Digiflazz
window.populateDigiflazzFilterDropdowns = function() {
    const catSel = document.getElementById('df-filter-category');
    const brandSel = document.getElementById('df-filter-brand');
    if (!catSel || !brandSel) return;

    const prevCat = catSel.value || 'ALL';
    const prevBrand = brandSel.value || 'ALL';

    const cats = Array.from(new Set(digiflazzCatalogList.map(i => i.category).filter(Boolean))).sort();
    catSel.innerHTML = `<option value="ALL">Semua Kategori (${cats.length})</option>` +
        cats.map(c => `<option value="${window.escapeHtml(c)}">${window.escapeHtml(c)}</option>`).join('');
    if (cats.includes(prevCat)) catSel.value = prevCat;

    const activeCat = catSel.value;
    const filteredForBrands = activeCat === 'ALL'
        ? digiflazzCatalogList
        : digiflazzCatalogList.filter(i => i.category === activeCat);
    const brands = Array.from(new Set(filteredForBrands.map(i => i.brand).filter(Boolean))).sort();

    brandSel.innerHTML = `<option value="ALL">Semua Brand (${brands.length})</option>` +
        brands.map(b => `<option value="${window.escapeHtml(b)}">${window.escapeHtml(b)}</option>`).join('');
    if (brands.includes(prevBrand)) brandSel.value = prevBrand;
};

window.onChangeDigiflazzCategoryFilter = function() {
    window.populateDigiflazzFilterDropdowns();
    window.renderDigiflazzCatalogTable();
};

function getFilteredDigiflazzWarehouseItems() {
    const cmdFilter = document.getElementById('df-filter-cmd')?.value || 'ALL';
    const catFilter = document.getElementById('df-filter-category')?.value || 'ALL';
    const brandFilter = document.getElementById('df-filter-brand')?.value || 'ALL';
    const impFilter = document.getElementById('df-filter-imported')?.value || 'ALL';
    const q = (document.getElementById('df-search-sku')?.value || '').trim().toLowerCase();

    return digiflazzCatalogList.filter(item => {
        if (cmdFilter !== 'ALL' && item.cmd !== cmdFilter) return false;
        if (catFilter !== 'ALL' && item.category !== catFilter) return false;
        if (brandFilter !== 'ALL' && item.brand !== brandFilter) return false;

        const isImported = products.some(p =>
            (p.buyerSkuCode && p.buyerSkuCode === item.buyer_sku_code)
        );
        const isHealthy = item.buyer_product_status !== false && item.seller_product_status !== false;

        if (impFilter === 'IMPORTED' && !isImported) return false;
        if (impFilter === 'NOT_IMPORTED' && isImported) return false;
        if (impFilter === 'GANGGUAN' && isHealthy) return false;

        if (q) {
            const matchSku = (item.buyer_sku_code || '').toLowerCase().includes(q);
            const matchName = (item.product_name || '').toLowerCase().includes(q);
            const matchBrand = (item.brand || '').toLowerCase().includes(q);
            if (!matchSku && !matchName && !matchBrand) return false;
        }
        return true;
    });
}

window.renderDigiflazzCatalogTable = function() {
    const tbody = document.getElementById('df-catalog-tbody');
    if (!tbody) return;

    const list = getFilteredDigiflazzWarehouseItems();
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">Tidak ada produk Digiflazz pada filter ini. Klik <b>Tarik Produk Prabayar</b> atau <b>Tambah SKU Manual</b> di atas.</td></tr>`;
        return;
    }

    const dfBalance = Number(siteSettings.digiflazzLastBalance || 0);
    const guardActive = siteSettings.digiflazzBalanceGuard !== false;

    tbody.innerHTML = list.slice(0, 120).map(item => {
        const sku = item.buyer_sku_code || '-';
        const safeDocId = escapeJsStr(item.dbId);
        const isPasca = item.cmd === 'pasca';
        const modalPrice = Number(item.price || item.admin || 0);
        const autoMarkupPrice = calculateDigiflazzSellPriceWithMarkup(modalPrice);
        const sellPrice = Number(autoMarkupPrice || item.customSellPrice || modalPrice);
        const estProfit = Math.max(0, sellPrice - modalPrice);
        const storeProd = products.find(p => p.buyerSkuCode === sku);

        const isSellerHealthy = item.buyer_product_status !== false && item.seller_product_status !== false;
        const hasSellerStock = item.unlimited_stock !== false || Number(item.stock || 0) > 0;
        const isBalanceEnough = !guardActive || isPasca || modalPrice <= 0 || dfBalance >= modalPrice;

        let statusBadge = `<span class="status-badge status-success">AKTIF</span>`;
        if (!isSellerHealthy) {
            statusBadge = `<span class="status-badge status-failed">GANGGUAN</span>`;
        } else if (!hasSellerStock) {
            statusBadge = `<span class="status-badge status-unpaid">STOK HABIS</span>`;
        } else if (!isBalanceEnough) {
            statusBadge = `<span class="status-badge status-warning" title="Saldo deposit Digiflazz kurang dari harga modal">SALDO KURANG</span>`;
        }

        const catalogStatusBadge = storeProd
            ? `<span class="status-badge status-primary" style="background:var(--primary); color:#fff; font-size:0.58rem;"><i class="fa-solid fa-check"></i> DI KATALOG (Rp${Number(storeProd.priceNum || 0).toLocaleString('id-ID')})</span>`
            : `<span class="status-badge status-anon" style="font-size:0.58rem;">BELUM DI KATALOG</span>`;

        const cutOffStr = (item.start_cut_off && item.start_cut_off !== '00:00')
            ? `${window.escapeHtml(item.start_cut_off)} - ${window.escapeHtml(item.end_cut_off)}`
            : '24 Jam Nonstop';

        return `<tr>
            <td>
                <strong class="code-mono text-primary">${window.escapeHtml(sku)}</strong><br>
                <span class="status-badge ${isPasca ? 'status-warning' : 'status-pending'}" style="font-size:0.55rem;">${isPasca ? 'PASCABAYAR' : 'PRABAYAR'}</span>
            </td>
            <td>
                <strong class="text-dark">${window.escapeHtml(item.product_name || sku)}</strong><br>
                <small class="text-muted text-xs">Seller: ${window.escapeHtml(item.seller_name || '-')}</small>
            </td>
            <td>
                <span class="fw-bold text-xs d-block">${window.escapeHtml(item.brand || '-')}</span>
                <small class="text-muted text-xs">${window.escapeHtml(item.category || '-')}</small>
            </td>
            <td>
                <strong class="text-dark">Rp${modalPrice.toLocaleString('id-ID')}</strong>
                ${isPasca && item.commission ? `<br><small class="text-success text-xs">Komisi: Rp${Number(item.commission).toLocaleString('id-ID')}</small>` : ''}
            </td>
            <td>
                <div class="flex-gap align-center">
                    <input type="number" id="df-sell-inp-${window.escapeHtml(item.dbId)}" class="form-control fw-bold" style="max-width:115px; padding:4px 8px; font-size:0.8rem;" value="${sellPrice}" min="0">
                </div>
                <small class="text-success fw-bold text-xs">+Rp${estProfit.toLocaleString('id-ID')} laba</small>
            </td>
            <td>
                <span class="text-xs d-block">${cutOffStr}</span>
                <small class="text-xs ${item.multi !== false ? 'text-success' : 'text-warning'}">${item.multi !== false ? 'Multi Trx: Ya' : 'Multi Trx: Tidak'}</small>
            </td>
            <td>
                ${statusBadge}<br>${catalogStatusBadge}
            </td>
            <td>
                <div class="flex-gap align-center flex-wrap-gap">
                    <button type="button" class="btn ${storeProd ? 'btn-success' : 'btn-primary'} btn-sm" onclick="window.importSingleDigiflazzSkuToCatalog('${safeDocId}')">
                        <i class="fa-solid ${storeProd ? 'fa-arrows-rotate' : 'fa-cart-plus'}"></i> ${storeProd ? (storeProd.isCheckUsernameProduct ? 'Cek ID (Rp0)' : 'Update') : 'Tarik ke Katalog'}
                    </button>
                    <button type="button" class="btn ${storeProd?.isCheckUsernameProduct || item.isCheckUsernameProduct ? 'btn-warning' : 'btn-outline'} btn-sm" onclick="window.markDigiflazzSkuAsCheckUsername('${safeDocId}')" title="Jadikan Produk Cek Username Gratis (Rp 0 & Kebal Markup)">
                        <i class="fa-solid fa-user-check"></i> Rp0 Cek ID
                    </button>
                    <button type="button" class="btn-icon-only text-danger" style="width:32px; height:32px;" onclick="window.deleteDigiflazzWarehouseItem('${safeDocId}')" title="Hapus dari Gudang Digiflazz">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
};

// Pemetaan Kategori Digiflazz ke Kategori Katalog Toko:
// Pulsa -> 'pulsa', PLN -> 'pln', E-Wallet -> 'ewallet', Tagihan -> 'ppob', Game -> 'game' (Tidak pernah masuk 'app'!)
function mapDigiflazzCategoryToStoreType(dfCategory, dfCmd, dfBrand) {
    if (dfCmd === 'pasca') return { prodType: 'ppob', inputType: 'pasca_no' };
    const catUp = String(dfCategory || '').toUpperCase();
    const brandUp = String(dfBrand || '').toUpperCase();

    if (catUp.includes('PLN') || brandUp.includes('PLN')) {
        return { prodType: 'pln', inputType: 'pln_token' };
    }
    if (
        catUp.includes('E-MONEY') ||
        catUp.includes('EWALLET') ||
        catUp.includes('SALDO') ||
        brandUp.includes('DANA') ||
        brandUp.includes('OVO') ||
        brandUp.includes('GOPAY') ||
        brandUp.includes('GO-PAY') ||
        brandUp.includes('SHOPEE') ||
        brandUp.includes('LINKAJA') ||
        brandUp.includes('ISAKU') ||
        brandUp.includes('MAXIM') ||
        brandUp.includes('GRAB')
    ) {
        return { prodType: 'ewallet', inputType: 'ewallet_no' };
    }
    if (catUp.includes('PULSA') || catUp.includes('DATA') || catUp.includes('PAKET') || catUp.includes('MASA AKTIF') || catUp.includes('TELPON') || catUp.includes('SMS') || brandUp.includes('TELKOMSEL') || brandUp.includes('INDOSAT') || brandUp.includes('XL') || brandUp.includes('AXIS') || brandUp.includes('TRI') || brandUp.includes('SMARTFREN') || brandUp.includes('BY.U')) {
        return { prodType: 'pulsa', inputType: 'phone' };
    }
    if (catUp.includes('GAME') || catUp.includes('VOUCHER') || brandUp.includes('LEGENDS') || brandUp.includes('FREE FIRE') || brandUp.includes('VALORANT') || brandUp.includes('PUBG') || brandUp.includes('GENSHIN') || brandUp.includes('HONOR OF KINGS')) {
        const needsZone = brandUp.includes('MOBILE LEGENDS') || brandUp.includes('MAGIC CHESS');
        return { prodType: 'game', inputType: needsZone ? 'id_zone' : 'id_only' };
    }
    return { prodType: 'game', inputType: 'id_only' };
}

// Tarik SKU ke Katalog Toko:
// - Keterangan singkat otomatis dari Digiflazz TIDAK dimasukkan ke katalog, biarkan kosong atau pertahankan yang diisi Admin!
// - Otomatis mengisi checkIdSkuCode & autoCheckIdBeforePay untuk Game, PLN, dan E-Wallet!
// - Membedakan isVariantGangguan vs soldOut!
window.markDigiflazzSkuAsCheckUsername = async function(dfDocId) {
    const dfItem = digiflazzCatalogList.find(d => d.dbId === dfDocId);
    if (!dfItem) return;
    dfItem.isCheckUsernameProduct = true;
    dfItem.customSellPrice = 0;
    const inpEl = document.getElementById(`df-sell-inp-${dfItem.dbId}`);
    if (inpEl) inpEl.value = '0';

    await updateDoc(doc(db, pathDigiflazzCatalog, dfItem.dbId), {
        isCheckUsernameProduct: true,
        customSellPrice: 0
    }).catch(() => {});

    await window.importSingleDigiflazzSkuToCatalog(dfDocId, true, true);
    window.renderDigiflazzCatalogTable();
    window.showToast('Produk Cek Username (Rp 0)', `SKU ${dfItem.buyer_sku_code} ditandai sebagai Produk Cek Username (Gratis Rp 0 & Kebal Markup).`, 'success');
};

window.importSingleDigiflazzSkuToCatalog = async function(dfDocId, silent = false, forceCheckUsernameFree = false) {
    const dfItem = digiflazzCatalogList.find(d => d.dbId === dfDocId);
    if (!dfItem) return false;

    const existingSkuProdCheck = products.find(p => p.buyerSkuCode === dfItem.buyer_sku_code);
    const isLockedCheckUsername = Boolean(
        forceCheckUsernameFree ||
        dfItem.isCheckUsernameProduct === true ||
        existingSkuProdCheck?.isCheckUsernameProduct === true
    );

    const inpEl = document.getElementById(`df-sell-inp-${dfItem.dbId}`);
    const rawInpPrice = inpEl ? parseInt(inpEl.value, 10) : NaN;
    const sellPrice = isLockedCheckUsername
        ? 0
        : (!isNaN(rawInpPrice) && rawInpPrice >= 0 ? rawInpPrice : calculateDigiflazzSellPriceWithMarkup(dfItem.price, false, dfItem.category, dfItem.brand));

    await updateDoc(doc(db, pathDigiflazzCatalog, dfItem.dbId), {
        customSellPrice: sellPrice
    }).catch(() => {});

    const { prodType, inputType } = mapDigiflazzCategoryToStoreType(dfItem.category, dfItem.cmd, dfItem.brand);
    const brandTitle = String(dfItem.brand || 'Produk Digiflazz').trim();
    const existingBrandProd = products.find(p => (p.brand || '').toLowerCase() === brandTitle.toLowerCase());
    const finalBrandName = existingBrandProd ? existingBrandProd.brand : brandTitle;
    const finalProdType = (existingBrandProd && existingBrandProd.type && existingBrandProd.type !== 'app') ? existingBrandProd.type : prodType;
    const finalInputType = existingBrandProd?.inputType || inputType;

    const existingSkuProd = products.find(p => p.buyerSkuCode === dfItem.buyer_sku_code);
    const isSellerHealthy = dfItem.buyer_product_status !== false && dfItem.seller_product_status !== false;
    const hasSellerStock = dfItem.unlimited_stock !== false || Number(dfItem.stock || 0) > 0;

    const autoCheckSku = existingBrandProd?.checkIdSkuCode || detectDefaultCheckIdSku(finalBrandName, finalProdType, finalInputType);
    const shouldAutoCheck = existingBrandProd?.autoCheckIdBeforePay !== undefined
        ? Boolean(existingBrandProd.autoCheckIdBeforePay)
        : Boolean(autoCheckSku);

    // Keterangan singkat otomatis dari Digiflazz TIDAK boleh masuk ke katalog
    const preservedVariantDesc = existingSkuProd?.variantDesc && !String(existingSkuProd.variantDesc).startsWith('Kode SKU:')
        ? existingSkuProd.variantDesc
        : '';
    const preservedBrandDesc = existingBrandProd?.desc && !String(existingBrandProd.desc).startsWith('Layanan otomatis')
        ? existingBrandProd.desc
        : '';

    const memberPlusPrice = isLockedCheckUsername ? 0 : calculateDigiflazzSellPriceWithMarkup(dfItem.price || dfItem.admin || 0, true, dfItem.category, dfItem.brand);
    const isCheckIdHelperSku = isLockedCheckUsername || /cek\s*(id|nama|username)|inquiry/i.test(String(dfItem.product_name || '')) || /^cek/i.test(String(dfItem.buyer_sku_code || ''));
    const resolvedCheckSku = isLockedCheckUsername ? dfItem.buyer_sku_code : autoCheckSku;
    const payload = {
        brand: finalBrandName,
        name: dfItem.product_name || dfItem.buyer_sku_code,
        isCheckUsernameProduct: isLockedCheckUsername,
        priceNum: isLockedCheckUsername ? 0 : sellPrice,
        memberPlusPriceNum: isLockedCheckUsername ? 0 : (memberPlusPrice > 0 && memberPlusPrice < sellPrice ? memberPlusPrice : Math.max(Number(dfItem.price || 0), Math.round(sellPrice * 0.96))),
        isHidden: existingSkuProd?.isHidden !== undefined ? Boolean(existingSkuProd.isHidden) : isCheckIdHelperSku,
        variantDesc: preservedVariantDesc,
        durationDays: 0,
        type: finalProdType,
        inputType: finalInputType,
        requireAppTarget: false,
        appTargetLabel: '',
        appTargetPlaceholder: '',
        autoCheckIdBeforePay: Boolean(shouldAutoCheck || isLockedCheckUsername),
        checkIdSkuCode: resolvedCheckSku,
        desc: preservedBrandDesc,
        imgUrlBase64: existingBrandProd?.imgUrlBase64 || '',
        isGangguan: Boolean(existingBrandProd?.isGangguan),
        isVariantGangguan: !isSellerHealthy,
        processType: dfItem.cmd === 'pasca' ? 'digiflazz_pasca' : 'digiflazz',
        isDigiflazz: true,
        buyerSkuCode: dfItem.buyer_sku_code,
        digiflazzModalPrice: Number(dfItem.price || dfItem.admin || 0),
        digiflazzAdminFee: Number(dfItem.admin || 0),
        digiflazzCommission: Number(dfItem.commission || 0),
        cutOffStart: dfItem.start_cut_off || '00:00',
        cutOffEnd: dfItem.end_cut_off || '00:00',
        multi: dfItem.multi !== false,
        sellerProductStatus: isSellerHealthy,
        stockMode: 'PRIVATE',
        stockCount: hasSellerStock ? 999 : 0,
        soldOut: !hasSellerStock,
        manualLockSoldOut: false
    };

    try {
        if (existingSkuProd && existingSkuProd.dbId) {
            await updateDoc(doc(db, pathProducts, existingSkuProd.dbId), payload);
        } else {
            await addDoc(collection(db, pathProducts), payload);
        }
        if (!silent) {
            window.showToast('Berhasil Ditarik', `${dfItem.product_name} ditambahkan/diperbarui di Katalog Toko.`, 'success');
        }
        return true;
    } catch (e) {
        if (!silent) {
            window.customAlert('Gagal', 'Tidak dapat menyimpan produk ke Katalog Toko.', 'error');
        }
        return false;
    }
};

window.importFilteredDigiflazzToStoreCatalog = function() {
    const list = getFilteredDigiflazzWarehouseItems();
    if (list.length === 0) {
        window.customAlert('Kosong', 'Tidak ada produk Digiflazz pada filter saat ini.', 'warning');
        return;
    }
    window.openConfirm(
        'Tarik Produk ke Katalog Toko',
        `Tarik dan sinkronkan <b>${list.length} variasi produk Digiflazz</b> dari hasil filter ini ke Katalog Toko utama?`,
        async (confirmed) => {
            if (!confirmed) return;
            const progId = 'df-import-catalog';
            window.showProgressToast(progId, 'Menarik Produk ke Katalog', `Memproses 0 / ${list.length} variasi...`, 10);
            let okCount = 0;
            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                const ok = await window.importSingleDigiflazzSkuToCatalog(item.dbId, true);
                if (ok) okCount++;
                const pct = Math.min(98, Math.round(((i + 1) / list.length) * 95));
                window.showProgressToast(progId, 'Menarik Produk ke Katalog', `Memproses ${i + 1} / ${list.length} variasi...`, pct);
            }
            window.finishProgressToast(progId, 'Selesai Ditarik ke Katalog', `${okCount} variasi produk Digiflazz aktif di Katalog Toko.`, 'success');
        },
        'success'
    );
};

window.applyMarkupToAllCatalogDigiflazzProducts = async function() {
    const progId = 'df-apply-markup';
    window.showProgressToast(progId, 'Menerapkan Markup Harga', 'Menyimpan aturan & menghitung ulang harga produk...', 20);
    const targetTier = document.getElementById('df-markup-target-tier')?.value || 'regular';
    const scope = document.getElementById('df-markup-scope-select')?.value || 'ALL';
    const scopeCat = (document.getElementById('df-markup-scope-cat')?.value || '').trim();
    const scopeBrand = (document.getElementById('df-markup-scope-brand')?.value || '').trim();

    const mkType = document.getElementById('df-markup-type')?.value || 'smart_tiered';
    const mkVal = Number(document.getElementById('df-markup-value')?.value || 0);
    const mkMinRp = Number(document.getElementById('df-markup-min-rp')?.value || 0);
    const mkRound = document.getElementById('df-markup-round')?.value || '100';
    const mpDiscPct = Number(document.getElementById('df-markup-memberplus-disc')?.value || 35);
    const tier1 = Number(document.getElementById('df-tier-1')?.value || 1200);
    const tier2 = Number(document.getElementById('df-tier-2')?.value || 2000);
    const tier3 = Number(document.getElementById('df-tier-3')?.value || 3500);
    const tier4Pct = Number(document.getElementById('df-tier-4-pct')?.value || 2.5);

    const ruleEntry = {
        type: mkType,
        value: mkVal,
        minRp: mkMinRp,
        round: mkRound,
        tier1,
        tier2,
        tier3,
        tier4Pct,
        updatedAt: Date.now()
    };

    const markupRules = siteSettings.digiflazzMarkupRules ? JSON.parse(JSON.stringify(siteSettings.digiflazzMarkupRules)) : {};
    if (!markupRules[targetTier]) markupRules[targetTier] = { all: null, categories: {}, brands: {} };
    if (!markupRules[targetTier].categories) markupRules[targetTier].categories = {};
    if (!markupRules[targetTier].brands) markupRules[targetTier].brands = {};

    if (scope === 'CATEGORY' && scopeCat) {
        markupRules[targetTier].categories[scopeCat.toUpperCase()] = ruleEntry;
    } else if (scope === 'BRAND' && scopeBrand) {
        markupRules[targetTier].brands[scopeBrand.toUpperCase()] = ruleEntry;
    } else {
        markupRules[targetTier].all = ruleEntry;
    }

    siteSettings.digiflazzMarkupRules = markupRules;
    siteSettings.digiflazzMarkupType = mkType;
    siteSettings.digiflazzMarkupValue = mkVal;
    siteSettings.digiflazzMarkupMinRp = mkMinRp;
    siteSettings.digiflazzMarkupRound = mkRound;
    siteSettings.digiflazzMarkupMemberPlusDisc = mpDiscPct;

    const rootUpdatePayload = {
        digiflazzMarkupType: mkType,
        digiflazzMarkupValue: mkVal,
        digiflazzMarkupMinRp: mkMinRp,
        digiflazzMarkupRound: mkRound,
        digiflazzMarkupMemberPlusDisc: mpDiscPct,
        digiflazzMarkupRules: markupRules
    };
    if (targetTier === 'regular' && scope === 'ALL') {
        siteSettings.digiflazzTier1 = tier1;
        siteSettings.digiflazzTier2 = tier2;
        siteSettings.digiflazzTier3 = tier3;
        siteSettings.digiflazzTier4Pct = tier4Pct;
        rootUpdatePayload.digiflazzTier1 = tier1;
        rootUpdatePayload.digiflazzTier2 = tier2;
        rootUpdatePayload.digiflazzTier3 = tier3;
        rootUpdatePayload.digiflazzTier4Pct = tier4Pct;
    }
    await setDoc(doc(db, pathSettings, 'mainConfig'), rootUpdatePayload, { merge: true }).catch(() => {});

    const matchesScope = (itemCat, itemBrand) => {
        if (scope === 'CATEGORY' && scopeCat) {
            return String(itemCat || '').toUpperCase() === scopeCat.toUpperCase();
        }
        if (scope === 'BRAND' && scopeBrand) {
            return String(itemBrand || '').toUpperCase() === scopeBrand.toUpperCase();
        }
        return true;
    };

    // 1. Update harga jual di Gudang Digiflazz (hanya produk yang bukan Produk Cek Username Rp 0)
    if (targetTier === 'regular') {
        for (const dItem of digiflazzCatalogList) {
            if (dItem.isCheckUsernameProduct === true) continue;
            if (!matchesScope(dItem.category, dItem.brand)) continue;
            const modal = Number(dItem.price || dItem.admin || 0);
            if (modal > 0 && dItem.dbId) {
                const nextSell = calculateDigiflazzSellPriceWithMarkup(modal, false, dItem.category, dItem.brand);
                dItem.customSellPrice = nextSell;
                updateDoc(doc(db, pathDigiflazzCatalog, dItem.dbId), { customSellPrice: nextSell }).catch(() => {});
            }
        }
    }

    // 2. Update harga jual produk di Katalog Toko sesuai targetTier & scope (lewati Produk Cek Username Rp 0)
    let updatedCatalog = 0;
    for (const p of products) {
        if (p.isCheckUsernameProduct === true || Number(p.priceNum || 0) === 0) continue;
        if (!matchesScope(p.type, p.brand)) continue;
        if ((p.processType === 'digiflazz' || p.isDigiflazz) && Number(p.digiflazzModalPrice || 0) > 0 && p.dbId) {
            if (targetTier === 'member_plus') {
                const newMpSell = calculateDigiflazzSellPriceWithMarkup(p.digiflazzModalPrice, true, p.type, p.brand);
                if (newMpSell > 0 && newMpSell !== p.memberPlusPriceNum) {
                    await updateDoc(doc(db, pathProducts, p.dbId), { memberPlusPriceNum: newMpSell }).catch(() => {});
                    updatedCatalog++;
                }
            } else {
                const newRegSell = calculateDigiflazzSellPriceWithMarkup(p.digiflazzModalPrice, false, p.type, p.brand);
                const newMpSell = calculateDigiflazzSellPriceWithMarkup(p.digiflazzModalPrice, true, p.type, p.brand);
                const updatePayload = { priceNum: newRegSell };
                if (!p.memberPlusPriceNum || p.memberPlusPriceNum >= newRegSell) {
                    updatePayload.memberPlusPriceNum = newMpSell;
                }
                await updateDoc(doc(db, pathProducts, p.dbId), updatePayload).catch(() => {});
                updatedCatalog++;
            }
        }
    }

    window.updateActiveMarkupInfoBanner();
    window.renderDigiflazzCatalogTable();
    const tierName = targetTier === 'member_plus' ? 'Member Plus' : 'Member Biasa';
    const scopeName = scope === 'CATEGORY' ? `Kategori ${scopeCat}` : (scope === 'BRAND' ? `Brand ${scopeBrand}` : 'Semua Produk');
    window.finishProgressToast(progId, 'Markup Diterapkan', `Aturan harga ${tierName} (${scopeName}) disimpan & ${updatedCatalog} produk katalog diperbarui.`, 'success');
};

window.deleteDigiflazzWarehouseItem = async function(dfDocId) {
    if (!dfDocId) return;
    await deleteDoc(doc(db, pathDigiflazzCatalog, dfDocId)).catch(() => {});
    window.showToast('Dihapus', 'Item dihapus dari Gudang Digiflazz.', 'info');
};

window.clearDigiflazzWarehouseCache = function() {
    if (digiflazzCatalogList.length === 0) return;
    window.openConfirm(
        'Kosongkan Gudang Digiflazz',
        `Hapus seluruh <b>${digiflazzCatalogList.length} SKU</b> dari Gudang Data Digiflazz? (Produk yang sudah tampil di Katalog Toko tidak ikut terhapus).`,
        async (confirmed) => {
            if (!confirmed) return;
            for (const d of digiflazzCatalogList) {
                await deleteDoc(doc(db, pathDigiflazzCatalog, d.dbId)).catch(() => {});
            }
            window.showToast('Dikosongkan', 'Gudang Data Digiflazz berhasil dikosongkan.', 'info');
        }
    );
};

// 9. Tambah SKU Digiflazz Manual
window.openAddManualDigiflazzSkuModal = function() {
    document.getElementById('mdf-cmd').value = 'prepaid';
    document.getElementById('mdf-sku').value = '';
    document.getElementById('mdf-brand').value = '';
    document.getElementById('mdf-category').value = 'Games';
    document.getElementById('mdf-name').value = '';
    document.getElementById('mdf-modal').value = '10000';
    document.getElementById('mdf-sell').value = String(calculateDigiflazzSellPriceWithMarkup(10000));
    document.getElementById('mdf-also-import').checked = true;
    window.openModal('modal-manual-df-sku');
};

window.saveManualDigiflazzSku = async function() {
    const cmd = document.getElementById('mdf-cmd').value;
    const sku = document.getElementById('mdf-sku').value.trim();
    const brand = document.getElementById('mdf-brand').value.trim();
    const category = document.getElementById('mdf-category').value.trim() || 'Umum';
    const name = document.getElementById('mdf-name').value.trim();
    const modal = parseInt(document.getElementById('mdf-modal').value, 10) || 0;
    const sell = parseInt(document.getElementById('mdf-sell').value, 10) || 0;
    const alsoImport = document.getElementById('mdf-also-import').checked;

    if (!sku || !brand || !name) {
        window.customAlert('Belum Lengkap', 'Harap isi Kode SKU, Brand, dan Nama Produk.', 'warning');
        return;
    }

    const docId = `${cmd}_${sku.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    await setDoc(doc(db, pathDigiflazzCatalog, docId), {
        cmd: cmd,
        buyer_sku_code: sku,
        product_name: name,
        category: category,
        brand: brand,
        type: 'Umum',
        seller_name: 'Digiflazz',
        price: modal,
        admin: cmd === 'pasca' ? modal : 0,
        commission: 0,
        customSellPrice: sell,
        buyer_product_status: true,
        seller_product_status: true,
        unlimited_stock: true,
        stock: 999,
        multi: true,
        start_cut_off: '00:00',
        end_cut_off: '00:00',
        desc: '',
        updatedAt: Date.now()
    }, { merge: true });

    if (alsoImport) {
        setTimeout(() => window.importSingleDigiflazzSkuToCatalog(docId, true), 250);
    }

    window.closeModal('modal-manual-df-sku');
    window.showToast('SKU Disimpan', `SKU ${sku} berhasil disimpan ke Gudang Digiflazz.`, 'success');
};

// 10. Eksekusi Transaksi Digiflazz + Refund Saldo Otomatis jika Gagal
function cleanDigiflazzCustomerNo(rawTarget, inputType = '') {
    const s = String(rawTarget || '').trim();
    const idZoneMatch = s.match(/ID\s*:\s*([^\s|]+)\s*\|\s*Zone\s*:\s*([^\s|]+)/i);
    if (idZoneMatch) {
        return `${idZoneMatch[1].trim()}${idZoneMatch[2].trim()}`;
    }
    const parenMatch = s.match(/^([^\s(]+)\s*\(([^)]+)\)$/);
    if (parenMatch) {
        return `${parenMatch[1].trim()}${parenMatch[2].trim()}`;
    }
    return s.replace(/^(Tujuan|ID|Target|No\.?\s*Pelanggan|No\.?\s*Meter|No\.?\s*HP)\s*:\s*/i, '').trim();
}

async function refundFailedOrderBalanceIfNeeded(orderData, orderDbId, reasonStr = 'Transaksi Digiflazz Gagal') {
    if (!orderData || !orderDbId) return false;
    const pm = String(orderData.paymentMethod || '').toLowerCase();
    if ((pm !== 'balance' && pm !== 'saldo') || !orderData.userId || orderData.balanceRefunded === true) return false;
    const refundAmt = Math.round(Number(orderData.finalTotal || orderData.baseTotal || 0));
    if (refundAmt <= 0) return false;

    const orderRef = doc(db, pathOrders, orderDbId);
    const userRef = doc(db, pathUsers, orderData.userId);
    const nowMs = Date.now();
    let refunded = false;

    try {
        await runTransaction(db, async (tx) => {
            const oSnap = await tx.get(orderRef);
            if (!oSnap.exists() || oSnap.data().balanceRefunded === true) return;
            const uSnap = await tx.get(userRef);
            if (!uSnap.exists()) return;
            const uData = uSnap.data();
            if (uData.isAnonymous || uData.isGuest) return;
            const curBal = Math.round(Number(uData.balance || 0));
            const nextBal = curBal + refundAmt;

            tx.update(userRef, {
                balance: nextBal,
                balanceUpdatedAt: nowMs
            });
            tx.update(orderRef, {
                balanceRefunded: true,
                balanceRefundedAt: nowMs,
                adminReply: `[PENGEMBALIAN SALDO OTOMATIS]\nAlasan       : ${reasonStr}\nDana Kembali : Rp${refundAmt.toLocaleString('id-ID')}\nSaldo Akhir  : Rp${nextBal.toLocaleString('id-ID')}`
            });
            refunded = true;
        });

        if (refunded) {
            await addDoc(collection(db, pathBalanceLogs), {
                uid: orderData.userId,
                userEmail: orderData.userEmail || '',
                type: 'REFUND',
                amount: refundAmt,
                orderId: orderData.id,
                note: `Refund otomatis pesanan gagal #${orderData.id}`,
                createdAt: nowMs
            }).catch(() => {});
            window.showToast('Saldo Dikembalikan', `Rp${refundAmt.toLocaleString('id-ID')} dikembalikan ke saldo pembeli untuk #${orderData.id}`, 'info');
        }
        return refunded;
    } catch (e) {
        console.error('Auto Refund Error:', e);
        return false;
    }
}

window.executeDigiflazzTransactionForOrder = async function(orderData, orderDbId, isAutoTrigger = false) {
    if (!orderData || !orderDbId) return false;
    const item = (orderData.items && orderData.items[0]) ? orderData.items[0] : {};
    const sku = String(orderData.digiflazzSku || item.buyerSkuCode || '').trim();
    const customerNo = cleanDigiflazzCustomerNo(
        orderData.digiflazzCustomerNo || orderData.targetId || item.playerInfo || '',
        item.inputType || ''
    );
    const refId = String(orderData.digiflazzRefId || orderData.id || '').trim();

    if (!sku || !customerNo || !refId) {
        if (!isAutoTrigger) {
            window.customAlert('Data Kurang', 'Kode SKU atau Nomor Tujuan pelanggan tidak lengkap.', 'warning');
        }
        return false;
    }

    const orderAgeMs = Date.now() - new Date(orderData.date).getTime();
    if (orderAgeMs > 90 * 86400000) {
        if (!isAutoTrigger) {
            window.customAlert('Melewati Batas 90 Hari', 'Transaksi yang sudah lewat 90 hari tidak boleh di-hit ulang karena akan membuat transaksi baru.', 'error');
        }
        return false;
    }

    const lastHit = Number(orderData.digiflazzLastHitAt || 0);
    if (!isAutoTrigger && lastHit > 0 && (Date.now() - lastHit < 60000) && orderData.digiflazzStatus === 'Pending') {
        const remSec = Math.ceil((60000 - (Date.now() - lastHit)) / 1000);
        window.customAlert('Jeda Aman 1 Menit', `Harap tunggu <b>${remSec} detik</b> lagi sebelum memanggil ulang status transaksi yang sama.`, 'warning');
        return false;
    }

    const username = (siteSettings.digiflazzUsername || 'username').trim();
    const apiKey = getActiveDigiflazzApiKey();
    const sign = md5Digiflazz(username + apiKey + refId);
    const isTesting = (siteSettings.digiflazzEnvMode || 'development') === 'development';
    const isPasca = (item.processType === 'digiflazz_pasca' || orderData.digiflazzCommand === 'pay-pasca');

    const sellBudget = Math.round(Number(orderData.baseTotal || orderData.finalTotal || 0));
    const reqPayload = {
        username: username,
        buyer_sku_code: sku,
        customer_no: customerNo,
        ref_id: refId,
        sign: sign
    };
    if (isTesting) reqPayload.testing = true;
    if (isPasca) {
        reqPayload.commands = (orderData.digiflazzStatus === 'Pending' && lastHit > 0) ? 'status-pasca' : 'pay-pasca';
    } else {
        if (sellBudget > 0) reqPayload.max_price = sellBudget;
        if (customerNo.includes('.')) reqPayload.allow_dot = true;
    }

    const nowMs = Date.now();
    await updateDoc(doc(db, pathOrders, orderDbId), {
        digiflazzRefId: refId,
        digiflazzSku: sku,
        digiflazzCustomerNo: customerNo,
        digiflazzLastHitAt: nowMs,
        digiflazzInFlight: true
    }).catch(() => {});

    try {
        const res = await callDigiflazzApi('/v1/transaction', reqPayload);
        const d = res?.data || {};
        const statusStr = String(d.status || 'Pending');
        const rcStr = String(d.rc || '03');
        const snStr = String(d.sn || '');
        const msgStr = String(d.message || '');
        const modalPrice = Number(d.price || item.digiflazzModalPrice || 0);

        if (d.buyer_last_saldo !== undefined) {
            siteSettings.digiflazzLastBalance = Number(d.buyer_last_saldo);
            setDoc(doc(db, pathSettings, 'mainConfig'), { digiflazzLastBalance: siteSettings.digiflazzLastBalance }, { merge: true }).catch(() => {});
        }

        // Parse PLN Token jika SN berformat TOKEN/NAMA/TARIF/DAYA/KWH
        const plnFields = {};
        if (snStr && snStr.includes('/')) {
            const parts = snStr.split('/').map(s => s.trim()).filter(Boolean);
            const firstClean = (parts[0] || '').replace(/[^0-9]/g, '');
            if (firstClean.length >= 16 || sku.toLowerCase().includes('pln')) {
                plnFields.plnTokenNumber = parts[0] || snStr;
                if (parts[1]) plnFields.plnSubscriberName = parts[1];
                if (parts[2]) plnFields.plnSegmentPower = parts.slice(2, 4).join(' / ');
                if (parts[4]) plnFields.plnKwh = parts[4];
            }
        }

        if (statusStr === 'Sukses' || rcStr === '00') {
            let replyText = `[TRANSAKSI BERHASIL]\nProduk   : ${item.name || sku}\nTujuan   : ${customerNo}`;
            if (orderData.verifiedTargetName) {
                replyText += `\nAtas Nama: ${orderData.verifiedTargetName}`;
            }
            if (plnFields.plnTokenNumber) {
                replyText += `\nToken PLN: ${plnFields.plnTokenNumber}`;
                if (plnFields.plnSubscriberName) replyText += `\nPelanggan: ${plnFields.plnSubscriberName}`;
                if (plnFields.plnSegmentPower) replyText += `\nTarif/Daya: ${plnFields.plnSegmentPower}`;
                if (plnFields.plnKwh) replyText += `\nJumlah kWh: ${plnFields.plnKwh}`;
            } else {
                replyText += `\nSN/Ref   : ${snStr || 'Sukses Diproses'}`;
            }
            replyText += `\nStatus   : Sukses (RC ${rcStr})`;

            await updateDoc(doc(db, pathOrders, orderDbId), {
                status: 'SUCCESS',
                paymentVerified: true,
                paidAt: orderData.paidAt || nowMs,
                autoDelivered: true,
                deliveredAt: nowMs,
                adminReply: replyText,
                digiflazzStatus: 'Sukses',
                digiflazzRc: rcStr,
                digiflazzSn: snStr,
                digiflazzMessage: msgStr,
                digiflazzPrice: modalPrice,
                digiflazzInFlight: false,
                ...plnFields
            });
            window.showToast('Digiflazz Sukses', `Pesanan #${orderData.id} sukses! SN: ${snStr || '-'}`, 'success');
            return true;
        } else if (statusStr === 'Gagal') {
            await updateDoc(doc(db, pathOrders, orderDbId), {
                status: 'FAILED',
                paymentVerified: true,
                paidAt: orderData.paidAt || nowMs,
                digiflazzStatus: 'Gagal',
                digiflazzRc: rcStr,
                digiflazzMessage: msgStr,
                digiflazzInFlight: false
            });
            await refundFailedOrderBalanceIfNeeded(orderData, orderDbId, `${msgStr || 'Transaksi Digiflazz Gagal'} (RC ${rcStr})`);
            if (!isAutoTrigger) {
                window.customAlert('Transaksi Digiflazz Gagal', `RC ${window.escapeHtml(rcStr)}: ${window.escapeHtml(msgStr)}`, 'error');
            }
            return false;
        } else {
            await updateDoc(doc(db, pathOrders, orderDbId), {
                status: 'PENDING',
                paymentVerified: true,
                paidAt: orderData.paidAt || nowMs,
                digiflazzStatus: 'Pending',
                digiflazzRc: rcStr,
                digiflazzMessage: msgStr || 'Transaksi sedang diproses',
                digiflazzInFlight: false
            });
            if (!isAutoTrigger) {
                window.showToast('Status Pending', `Transaksi #${orderData.id} sedang diproses oleh Digiflazz (RC ${rcStr}).`, 'info');
            }
            return false;
        }
    } catch (e) {
        await updateDoc(doc(db, pathOrders, orderDbId), { digiflazzInFlight: false }).catch(() => {});
        if (!isAutoTrigger) {
            window.customAlert('Gagal Menghubungi Digiflazz', window.escapeHtml(e.message), 'error');
        }
        return false;
    }
};

window.triggerDigiflazzFromOrderModal = async function() {
    const dbId = document.getElementById('proc-order-dbid')?.value;
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;
    await window.executeDigiflazzTransactionForOrder(order, dbId, false);
    window.promptProcessOrder(dbId);
};

// 11. Tabel Monitor Transaksi Digiflazz & Alat Cek PLN / Pascabayar
window.setDigiflazzTrxFilter = function(filterVal, btnEl) {
    currentDigiflazzTrxFilter = filterVal;
    document.querySelectorAll('#df-panel-trx .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    window.renderDigiflazzTransactionsTable();
};

window.renderDigiflazzTransactionsTable = function() {
    const tbody = document.getElementById('df-trx-tbody');
    if (!tbody) return;

    let dfOrders = orders.filter(o => {
        const it = o.items && o.items[0] ? o.items[0] : {};
        return Boolean(o.digiflazzSku || it.processType === 'digiflazz' || it.processType === 'digiflazz_pasca' || it.processType === 'ewallet_custom' || it.isDigiflazz || it.buyerSkuCode);
    });

    const badgeCnt = document.getElementById('df-badge-trx-count');
    if (badgeCnt) badgeCnt.innerText = String(dfOrders.length);

    if (currentDigiflazzTrxFilter !== 'ALL') {
        dfOrders = dfOrders.filter(o => {
            const st = (o.digiflazzStatus || '').toUpperCase();
            if (currentDigiflazzTrxFilter === 'SUCCESS') return st === 'SUKSES' || (o.status === 'SUCCESS' && Boolean(o.adminReply));
            if (currentDigiflazzTrxFilter === 'PENDING') return st === 'PENDING' || o.status === 'PENDING';
            if (currentDigiflazzTrxFilter === 'FAILED') return st === 'GAGAL' || o.status === 'FAILED';
            return true;
        });
    }

    const qTrx = (document.getElementById('df-search-trx-input')?.value || '').trim().toLowerCase();
    if (qTrx) {
        dfOrders = dfOrders.filter(o => {
            const it = o.items && o.items[0] ? o.items[0] : {};
            return String(o.id || '').toLowerCase().includes(qTrx) ||
                   String(o.digiflazzSku || it.buyerSkuCode || '').toLowerCase().includes(qTrx) ||
                   String(o.digiflazzCustomerNo || o.targetId || '').toLowerCase().includes(qTrx) ||
                   String(o.digiflazzSn || '').toLowerCase().includes(qTrx) ||
                   String(it.name || o.productName || '').toLowerCase().includes(qTrx);
        });
    }

    if (dfOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">Belum ada transaksi Digiflazz pada filter ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = dfOrders.slice(0, 80).map(o => {
        const it = o.items && o.items[0] ? o.items[0] : {};
        const sku = o.digiflazzSku || it.buyerSkuCode || '-';
        const cNo = o.digiflazzCustomerNo || o.targetId || it.playerInfo || '-';
        const modal = Number(o.digiflazzPrice || it.digiflazzModalPrice || 0);
        const sell = Number(o.finalTotal || 0);
        const profit = sell - modal;
        const dfSt = o.digiflazzStatus || (o.status === 'SUCCESS' && o.adminReply ? 'Sukses' : (o.status === 'UNPAID' ? 'Belum Bayar' : 'Pending'));
        const rc = o.digiflazzRc || '-';
        const sn = o.digiflazzSn || '-';

        let stBadge = `<span class="status-badge status-pending">${window.escapeHtml(dfSt)} (RC ${window.escapeHtml(rc)})</span>`;
        if (dfSt === 'Sukses') stBadge = `<span class="status-badge status-success">SUKSES (RC ${window.escapeHtml(rc)})</span>`;
        else if (dfSt === 'Gagal') stBadge = `<span class="status-badge status-failed">GAGAL (RC ${window.escapeHtml(rc)})</span>`;

        return `<tr>
            <td>
                <strong class="code-mono text-dark">#${window.escapeHtml(o.id)}</strong><br>
                <small class="text-muted text-xs">${new Date(o.date).toLocaleString('id-ID')}</small>
            </td>
            <td>
                <strong class="text-dark">${window.escapeHtml(it.name || o.productName || '-')}</strong><br>
                <span class="code-mono text-xs text-primary">SKU: ${window.escapeHtml(sku)}</span>
            </td>
            <td>
                <code class="code-mono fw-bold">${window.escapeHtml(cNo)}</code>
                ${o.verifiedTargetName ? `<br><small class="text-success fw-bold text-xs"><i class="fa-solid fa-user-check"></i> ${window.escapeHtml(o.verifiedTargetName)}</small>` : ''}
            </td>
            <td>
                <span class="text-xs text-muted d-block">Modal: Rp${modal.toLocaleString('id-ID')}</span>
                <strong class="text-primary text-xs">Jual: Rp${sell.toLocaleString('id-ID')}</strong>
                ${modal > 0 ? `<br><small class="text-success fw-bold text-xs">Laba: +Rp${profit.toLocaleString('id-ID')}</small>` : ''}
            </td>
            <td>${stBadge}</td>
            <td>
                <span class="code-mono text-xs fw-bold">${window.escapeHtml(sn)}</span>
                ${o.digiflazzMessage ? `<br><small class="text-muted text-xs">${window.escapeHtml(o.digiflazzMessage)}</small>` : ''}
            </td>
            <td>
                <div class="flex-gap align-center">
                    <button type="button" class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${escapeJsStr(o.dbId)}')">
                        <i class="fa-solid fa-eye"></i> Detail
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
};

window.adminInquiryPlnCustomer = async function() {
    const cNo = (document.getElementById('df-tool-pln-no')?.value || '').trim();
    const resBox = document.getElementById('df-tool-pln-result');
    if (!cNo) {
        window.customAlert('Nomor Kosong', 'Masukkan Nomor Meter atau ID Pelanggan PLN.', 'warning');
        return;
    }
    const username = (siteSettings.digiflazzUsername || 'username').trim();
    const apiKey = getActiveDigiflazzApiKey();
    const sign = md5Digiflazz(username + apiKey + cNo);

    try {
        const res = await callDigiflazzApi('/v1/inquiry-pln', {
            username: username,
            customer_no: cNo,
            sign: sign
        });
        const d = res?.data || {};
        if (resBox) {
            resBox.style.display = 'block';
            if (d.status === 'Sukses' || d.rc === '00') {
                resBox.innerHTML = `
                    <div class="text-success fw-bold mb-1"><i class="fa-solid fa-circle-check"></i> ID PLN Valid (RC ${window.escapeHtml(d.rc || '00')})</div>
                    <div><b>Nama Pelanggan:</b> ${window.escapeHtml(d.name || '-')}</div>
                    <div><b>Daya / Golongan:</b> ${window.escapeHtml(d.segment_power || '-')}</div>
                    <div><b>No. Meter / ID:</b> ${window.escapeHtml(d.meter_no || d.customer_no || cNo)}</div>
                `;
            } else {
                resBox.innerHTML = `<div class="text-danger fw-bold"><i class="fa-solid fa-circle-xmark"></i> Gagal (${window.escapeHtml(d.message || 'Nomor tidak ditemukan')})</div>`;
            }
        }
    } catch (e) {
        window.customAlert('Error', window.escapeHtml(e.message), 'error');
    }
};

window.adminInquiryPascaBill = async function() {
    const sku = (document.getElementById('df-tool-pasca-sku')?.value || '').trim();
    const cNo = (document.getElementById('df-tool-pasca-no')?.value || '').trim();
    const resBox = document.getElementById('df-tool-pasca-result');
    if (!sku || !cNo) {
        window.customAlert('Belum Lengkap', 'Masukkan Kode SKU Pascabayar dan Nomor Pelanggan.', 'warning');
        return;
    }
    const refId = 'INQ-' + Date.now();
    const username = (siteSettings.digiflazzUsername || 'username').trim();
    const apiKey = getActiveDigiflazzApiKey();
    const sign = md5Digiflazz(username + apiKey + refId);
    const isTesting = (siteSettings.digiflazzEnvMode || 'development') === 'development';

    try {
        const res = await callDigiflazzApi('/v1/transaction', {
            commands: 'inq-pasca',
            username: username,
            buyer_sku_code: sku,
            customer_no: cNo,
            ref_id: refId,
            testing: isTesting,
            sign: sign
        });
        const d = res?.data || {};
        if (resBox) {
            resBox.style.display = 'block';
            if (d.status === 'Sukses' || d.rc === '00') {
                resBox.innerHTML = `
                    <div class="text-success fw-bold mb-1"><i class="fa-solid fa-circle-check"></i> Tagihan Ditemukan</div>
                    <div><b>Nama Pelanggan:</b> ${window.escapeHtml(d.customer_name || '-')}</div>
                    <div><b>Periode:</b> ${window.escapeHtml(d.periode || '-')}</div>
                    <div><b>Total Tagihan:</b> <strong class="text-primary">Rp${Number(d.selling_price || d.price || 0).toLocaleString('id-ID')}</strong> (Admin: Rp${Number(d.admin || 0).toLocaleString('id-ID')})</div>
                `;
            } else {
                resBox.innerHTML = `<div class="text-danger fw-bold"><i class="fa-solid fa-circle-xmark"></i> ${window.escapeHtml(d.message || 'Tagihan tidak ditemukan')} (RC ${window.escapeHtml(d.rc || '-')})</div>`;
            }
        }
    } catch (e) {
        window.customAlert('Error', window.escapeHtml(e.message), 'error');
    }
};

// 12. Request Tiket Deposit Digiflazz (/v1/deposit)
window.requestDigiflazzDepositTicket = async function() {
    const amount = parseInt(document.getElementById('df-dep-amount')?.value || '0', 10);
    const bank = document.getElementById('df-dep-bank')?.value || 'BCA';
    const ownerName = (document.getElementById('df-dep-owner')?.value || '').trim();

    if (!amount || amount < 10000 || !ownerName) {
        window.customAlert('Data Belum Lengkap', 'Masukkan nominal deposit (minimal Rp10.000) dan nama pemilik rekening pengirim.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-df-req-deposit');
    const ogHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses Tiket...';
    }

    try {
        const username = (siteSettings.digiflazzUsername || 'username').trim();
        const apiKey = getActiveDigiflazzApiKey();
        const sign = md5Digiflazz(username + apiKey + 'deposit');

        const res = await callDigiflazzApi('/v1/deposit', {
            username: username,
            amount: amount,
            Bank: bank,
            bank: bank,
            owner_name: ownerName,
            sign: sign
        });

        const d = res?.data || {};
        if (d.rc && d.rc !== '00') {
            throw new Error(d.message || `Gagal menarik tiket deposit (RC ${d.rc})`);
        }

        const ticketObj = {
            bank: d.bank || bank,
            payment_method: d.payment_method || 'Bank Transfer',
            account_no: d.account_no || '-',
            notes: d.notes || '-',
            amount: Number(d.amount || amount),
            owner_name: ownerName,
            rc: d.rc || '00',
            createdAt: Date.now()
        };

        await addDoc(collection(db, pathDigiflazzDeposits), ticketObj).catch(() => {});

        const activeBox = document.getElementById('df-active-deposit-box');
        if (activeBox) {
            activeBox.innerHTML = `
                <div class="flex-between align-center mb-2">
                    <span class="status-badge status-success"><i class="fa-solid fa-circle-check"></i> TIKET DEPOSIT AKTIF</span>
                    <strong class="text-primary">${window.escapeHtml(ticketObj.bank)} (${window.escapeHtml(ticketObj.payment_method)})</strong>
                </div>
                <div class="mb-2">
                    <span class="text-xs text-muted d-block">NOMOR REKENING TUJUAN:</span>
                    <div class="flex-between align-center">
                        <strong class="code-mono" style="font-size:1.05rem;">${window.escapeHtml(ticketObj.account_no)}</strong>
                        <button type="button" class="btn btn-outline btn-sm" onclick="window.copyTextToClipboard('${escapeJsStr(ticketObj.account_no)}', 'Nomor Rekening')"><i class="fa-regular fa-copy"></i> Salin</button>
                    </div>
                </div>
                <div class="mb-2">
                    <span class="text-xs text-muted d-block">JUMLAH AKHIR YANG HARUS DITRANSFER:</span>
                    <div class="flex-between align-center">
                        <strong class="text-success" style="font-size:1.2rem;">Rp${ticketObj.amount.toLocaleString('id-ID')}</strong>
                        <button type="button" class="btn btn-warning btn-sm" onclick="window.copyTextToClipboard('${ticketObj.amount}', 'Nominal Transfer')"><i class="fa-regular fa-copy"></i> Salin Nominal</button>
                    </div>
                </div>
                <div>
                    <span class="text-xs text-muted d-block">BERITA / CATATAN TRANSFER WAJIB (NOTES):</span>
                    <div class="flex-between align-center">
                        <strong class="code-mono text-danger" style="font-size:1.1rem;">${window.escapeHtml(ticketObj.notes)}</strong>
                        <button type="button" class="btn btn-primary btn-sm" onclick="window.copyTextToClipboard('${escapeJsStr(ticketObj.notes)}', 'Berita Transfer')"><i class="fa-regular fa-copy"></i> Salin Berita</button>
                    </div>
                </div>
            `;
        }
        window.showToast('Tiket Deposit Dibuat', `Transfer tepat Rp${ticketObj.amount.toLocaleString('id-ID')} dengan berita ${ticketObj.notes}`, 'success');
    } catch (e) {
        window.customAlert('Gagal Membuat Tiket', window.escapeHtml(e.message), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = ogHtml;
        }
    }
};

window.renderDigiflazzDepositHistory = function() {
    const tbody = document.getElementById('df-deposit-history-tbody');
    if (!tbody) return;
    if (digiflazzDepositsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Belum ada riwayat tiket deposit.</td></tr>`;
        return;
    }
    tbody.innerHTML = digiflazzDepositsList.slice(0, 30).map(d => `
        <tr>
            <td><small class="text-xs">${new Date(d.createdAt || Date.now()).toLocaleString('id-ID')}</small></td>
            <td><strong>${window.escapeHtml(d.bank || '-')}</strong><br><small class="text-muted text-xs">${window.escapeHtml(d.payment_method || '-')}</small></td>
            <td><code class="code-mono fw-bold">${window.escapeHtml(d.account_no || '-')}</code></td>
            <td><strong class="text-success">Rp${Number(d.amount || 0).toLocaleString('id-ID')}</strong></td>
            <td><span class="status-badge status-pending code-mono">${window.escapeHtml(d.notes || '-')}</span></td>
            <td>${window.escapeHtml(d.owner_name || '-')}</td>
            <td>
                <button type="button" class="btn-icon-only text-danger" style="width:30px; height:30px;" onclick="window.deleteDigiflazzDepositItem('${escapeJsStr(d.dbId)}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
};

window.deleteDigiflazzDepositItem = async function(dbId) {
    if (!dbId) return;
    await deleteDoc(doc(db, pathDigiflazzDeposits, dbId)).catch(() => {});
};

// 13. Simpan & Tes Pengaturan Koneksi Digiflazz (Dual API Key + Proteksi Saldo + Sinkronisasi ke VPS Bridge)
window.saveDigiflazzSettings = async function() {
    const bridgeUrl = (document.getElementById('set-df-bridge-url')?.value || 'http://139.59.60.91:3100').trim();
    const envMode = document.getElementById('set-df-env-mode')?.value || 'development';
    const username = (document.getElementById('set-df-username')?.value || siteSettings.digiflazzUsername || '').trim();
    const rawDevInp = (document.getElementById('set-df-dev-apikey')?.value || '').trim();
    const rawProdInp = (document.getElementById('set-df-prod-apikey')?.value || '').trim();
    const devApiKey = rawDevInp || siteSettings.digiflazzDevApiKey || '';
    const prodApiKey = rawProdInp || siteSettings.digiflazzProdApiKey || '';

    if (envMode === 'production' && !prodApiKey) {
        window.customAlert('API Key Production Kosong', 'Mode saat ini adalah <b>Production</b>. Harap masukkan <b>API Key Production</b> terlebih dahulu agar transaksi berjalan lancar.', 'warning');
        return;
    }
    const effectiveDevKey = devApiKey || prodApiKey || 'dev-sandbox-vipercell';
    const activeKey = envMode === 'production' ? prodApiKey : effectiveDevKey;
    const webhookSecret = (document.getElementById('set-df-webhook-secret')?.value || 'VIPERCELL_DF_WEBHOOK_2026').trim();
    const autoHit = Boolean(document.getElementById('set-df-autohit')?.checked);
    const balGuard = Boolean(document.getElementById('set-df-balance-guard')?.checked);

    const syncTokenPayload = JSON.stringify({
        u: username,
        d: devApiKey,
        p: prodApiKey,
        m: envMode,
        s: webhookSecret
    });
    const bridgeSyncToken = btoa(unescape(encodeURIComponent(syncTokenPayload)));

    const publicConfig = {
        digiflazzBridgeUrl: bridgeUrl,
        digiflazzEnvMode: envMode,
        digiflazzUsername: username,
        digiflazzDevApiKey: devApiKey,
        digiflazzProdApiKey: prodApiKey,
        digiflazzApiKey: activeKey,
        digiflazzAutoHitOnPaid: autoHit,
        digiflazzBalanceGuard: balGuard,
        digiflazzBridgeSyncToken: bridgeSyncToken
    };

    const secretConfig = {
        digiflazzUsername: username,
        digiflazzDevApiKey: devApiKey,
        digiflazzProdApiKey: prodApiKey,
        digiflazzApiKey: activeKey,
        digiflazzWebhookSecret: webhookSecret,
        digiflazzEnvMode: envMode
    };

    try {
        await setDoc(doc(db, pathSettings, 'mainConfig'), publicConfig, { merge: true });
        await setDoc(doc(db, pathSettings, 'secretConfig'), secretConfig, { merge: true });
        siteSettings = { ...siteSettings, ...publicConfig, ...secretConfig };
        try {
            localStorage.setItem('vipercell_df_config_backup', JSON.stringify({
                digiflazzBridgeUrl: bridgeUrl,
                digiflazzUsername: username,
                digiflazzDevApiKey: devApiKey,
                digiflazzProdApiKey: prodApiKey,
                digiflazzApiKey: activeKey,
                digiflazzEnvMode: envMode,
                digiflazzBridgeSyncToken: bridgeSyncToken
            }));
        } catch (e) {}

        // Sinkronkan juga kredensial ke VPS Bridge agar tersimpan di memori VPS
        if (bridgeUrl && bridgeUrl.startsWith('http')) {
            fetch(bridgeUrl.replace(/\/+$/, ''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'SAVE_BRIDGE_CONFIG',
                    username: username,
                    devApiKey: devApiKey,
                    prodApiKey: prodApiKey,
                    envMode: envMode,
                    webhookSecret: webhookSecret
                })
            }).catch(() => {});
        }

        window.populateSettingsForm();
        window.renderAdminCatalog();
        window.showToast('Tersimpan', `Konfigurasi Digiflazz (${envMode.toUpperCase()}) berhasil disimpan.`, 'success');
    } catch (e) {
        window.customAlert('Gagal', 'Tidak dapat menyimpan konfigurasi Digiflazz.', 'error');
    }
};

window.testDigiflazzBridgeConnection = async function() {
    await window.saveDigiflazzSettings();
    await window.checkDigiflazzBalance(true);
};

// 14. Kalkulator & Analitik Keuntungan Digiflazz (Sub-Tab 5: Hitung Keuntungan)
window.updateDigiflazzProfitSimulator = function() {
    const modalVal = Math.max(0, parseInt(document.getElementById('df-sim-modal')?.value || '0', 10) || 0);
    const qtyVal = Math.max(1, parseInt(document.getElementById('df-sim-qty')?.value || '1', 10) || 1);
    const sellVal = calculateDigiflazzSellPriceWithMarkup(modalVal);
    const unitProfit = Math.max(0, sellVal - modalVal);
    const totalProfit = unitProfit * qtyVal;
    const marginPct = modalVal > 0 ? ((unitProfit / modalVal) * 100).toFixed(1) : '0.0';

    const sellEl = document.getElementById('df-sim-sell-result');
    const unitEl = document.getElementById('df-sim-unit-profit');
    const totalEl = document.getElementById('df-sim-total-profit');
    if (sellEl) sellEl.innerText = `Rp${sellVal.toLocaleString('id-ID')}`;
    if (unitEl) unitEl.innerText = `+Rp${unitProfit.toLocaleString('id-ID')} (${marginPct}%)`;
    if (totalEl) totalEl.innerText = `+Rp${totalProfit.toLocaleString('id-ID')}`;
};

window.renderDigiflazzProfitAnalytics = function() {
    const dfOrders = orders.filter(o => {
        const it = o.items && o.items[0] ? o.items[0] : {};
        return Boolean(o.digiflazzSku || it.processType === 'digiflazz' || it.processType === 'digiflazz_pasca' || it.processType === 'ewallet_custom' || it.isDigiflazz || it.buyerSkuCode);
    });
    const dfSuccess = dfOrders.filter(o => o.status === 'SUCCESS' || o.digiflazzStatus === 'Sukses');

    const now = new Date();
    const todayStr = now.toDateString();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    let totalOmzet = 0;
    let totalModal = 0;
    let totalNetProfit = 0;
    let todayProfit = 0;
    let todayCount = 0;
    let monthProfit = 0;
    let monthCount = 0;

    const enrichedRows = dfSuccess.map(o => {
        const it = o.items && o.items[0] ? o.items[0] : {};
        const sku = o.digiflazzSku || it.buyerSkuCode || '-';
        const sell = Math.round(Number(o.finalTotal || o.baseTotal || 0));
        let modal = Math.round(Number(o.digiflazzPrice || it.digiflazzModalPrice || 0));
        if (modal <= 0 && sku !== '-') {
            const catMatch = digiflazzCatalogList.find(d => d.buyer_sku_code === sku);
            if (catMatch) modal = Math.round(Number(catMatch.price || catMatch.admin || 0));
        }
        const net = modal > 0 ? (sell - modal) : 0;
        const pct = modal > 0 ? ((net / modal) * 100) : 0;

        totalOmzet += sell;
        totalModal += modal;
        totalNetProfit += net;

        const dObj = new Date(o.date);
        if (dObj.toDateString() === todayStr) {
            todayProfit += net;
            todayCount++;
        }
        if (dObj.getMonth() === curMonth && dObj.getFullYear() === curYear) {
            monthProfit += net;
            monthCount++;
        }

        return {
            order: o,
            itemName: it.name || o.productName || sku,
            sku: sku,
            sell: sell,
            modal: modal,
            net: net,
            pct: pct
        };
    });

    const avgMargin = totalModal > 0 ? ((totalNetProfit / totalModal) * 100).toFixed(1) : '0.0';

    const setEl = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
    };

    setEl('df-prof-omzet-all', `Rp${totalOmzet.toLocaleString('id-ID')}`);
    setEl('df-prof-modal-all', `Rp${totalModal.toLocaleString('id-ID')}`);
    setEl('df-prof-net-all', `Rp${totalNetProfit.toLocaleString('id-ID')}`);
    setEl('df-prof-today', `Rp${todayProfit.toLocaleString('id-ID')}`);
    setEl('df-prof-today-cnt', `${todayCount} transaksi sukses hari ini`);
    setEl('df-prof-month', `Rp${monthProfit.toLocaleString('id-ID')}`);
    setEl('df-prof-month-cnt', `${monthCount} transaksi sukses bulan ini`);
    setEl('df-prof-margin-avg', `${avgMargin}%`);

    const tbody = document.getElementById('df-profit-breakdown-tbody');
    if (!tbody) return;
    if (enrichedRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">Belum ada transaksi Digiflazz sukses untuk dihitung keuntungannya.</td></tr>`;
        return;
    }

    tbody.innerHTML = enrichedRows.slice(0, 100).map(r => `
        <tr>
            <td>
                <strong class="code-mono text-dark">#${window.escapeHtml(r.order.id)}</strong><br>
                <small class="text-muted text-xs">${new Date(r.order.date).toLocaleString('id-ID')}</small>
            </td>
            <td>
                <strong class="text-dark">${window.escapeHtml(r.itemName)}</strong><br>
                <span class="code-mono text-xs text-primary">SKU: ${window.escapeHtml(r.sku)}</span>
            </td>
            <td><span class="text-dark fw-bold">Rp${r.modal.toLocaleString('id-ID')}</span></td>
            <td><strong class="text-primary">Rp${r.sell.toLocaleString('id-ID')}</strong></td>
            <td><strong class="${r.net >= 0 ? 'text-success' : 'text-danger'}">${r.net >= 0 ? '+' : ''}Rp${r.net.toLocaleString('id-ID')}</strong></td>
            <td><span class="status-badge ${r.pct >= 0 ? 'status-success' : 'status-failed'}">${r.pct.toFixed(1)}%</span></td>
        </tr>
    `).join('');
};

window.exportDigiflazzProfitCsv = function() {
    const dfOrders = orders.filter(o => {
        const it = o.items && o.items[0] ? o.items[0] : {};
        return (o.status === 'SUCCESS' || o.digiflazzStatus === 'Sukses') &&
            Boolean(o.digiflazzSku || it.processType === 'digiflazz' || it.processType === 'digiflazz_pasca' || it.processType === 'ewallet_custom' || it.isDigiflazz || it.buyerSkuCode);
    });
    if (dfOrders.length === 0) {
        window.customAlert('Belum Ada Data', 'Belum ada transaksi Digiflazz sukses untuk diekspor.', 'warning');
        return;
    }
    const headers = ['Waktu', 'Order ID', 'Produk', 'SKU', 'Tujuan', 'Harga Modal', 'Harga Jual', 'Laba Bersih'];
    const rows = dfOrders.map(o => {
        const it = o.items && o.items[0] ? o.items[0] : {};
        const sku = o.digiflazzSku || it.buyerSkuCode || '-';
        const modal = Math.round(Number(o.digiflazzPrice || it.digiflazzModalPrice || 0));
        const sell = Math.round(Number(o.finalTotal || o.baseTotal || 0));
        const net = sell - modal;
        return [
            `"${new Date(o.date).toLocaleString('id-ID')}"`,
            `"#${o.id}"`,
            `"${String(it.name || o.productName || sku).replace(/"/g, '""')}"`,
            `"${sku}"`,
            `"${String(o.digiflazzCustomerNo || o.targetId || '').replace(/"/g, '""')}"`,
            modal,
            sell,
            net
        ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Laba_Digiflazz_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

window.updateDigiflazzDashboardStats = function() {
    const balEl = document.getElementById('df-stat-balance');
    const skuEl = document.getElementById('df-stat-sku-total');
    const skuSubEl = document.getElementById('df-stat-sku-active-sub');
    const trxEl = document.getElementById('df-stat-trx-total');
    const trxSubEl = document.getElementById('df-stat-trx-sub');
    const profEl = document.getElementById('df-stat-profit');
    const catBadge = document.getElementById('df-badge-catalog-count');

    const activeInStore = products.filter(p => p.processType === 'digiflazz' || p.processType === 'digiflazz_pasca' || p.processType === 'ewallet_custom' || p.isDigiflazz).length;
    const dfOrders = orders.filter(o => {
        const it = o.items && o.items[0] ? o.items[0] : {};
        return Boolean(o.digiflazzSku || it.processType === 'digiflazz' || it.processType === 'digiflazz_pasca' || it.processType === 'ewallet_custom' || it.isDigiflazz || it.buyerSkuCode);
    });
    const dfSuccess = dfOrders.filter(o => o.status === 'SUCCESS' || o.digiflazzStatus === 'Sukses');
    const dfPending = dfOrders.filter(o => o.status === 'PENDING' || o.digiflazzStatus === 'Pending');

    let estProfit = 0;
    dfSuccess.forEach(o => {
        const it = o.items && o.items[0] ? o.items[0] : {};
        const modal = Number(o.digiflazzPrice || it.digiflazzModalPrice || 0);
        const sell = Number(o.finalTotal || 0);
        if (modal > 0 && sell > modal) estProfit += (sell - modal);
    });

    if (balEl) balEl.innerText = `Rp${Number(siteSettings.digiflazzLastBalance || 0).toLocaleString('id-ID')}`;
    if (skuEl) skuEl.innerText = `${digiflazzCatalogList.length} SKU`;
    if (skuSubEl) skuSubEl.innerText = `${activeInStore} aktif di katalog toko`;
    if (trxEl) trxEl.innerText = String(dfOrders.length);
    if (trxSubEl) trxSubEl.innerText = `${dfSuccess.length} sukses • ${dfPending.length} pending`;
    if (profEl) profEl.innerText = `Rp${estProfit.toLocaleString('id-ID')}`;
    if (catBadge) catBadge.innerText = String(digiflazzCatalogList.length);
    if (currentDigiflazzSubTab === 'profit' && typeof window.renderDigiflazzProfitAnalytics === 'function') {
        window.renderDigiflazzProfitAnalytics();
    }
};


// ============================================================================
// FITUR TAMBAHAN PENGELOLAAN KEUANGAN, SEMBUNYIKAN PRODUK, PIN ADMIN & MEMBER PLUS
// ============================================================================

// Variabel state finansial & PIN dideklarasikan di bagian atas file

window.toggleAdminInputEye = function(inputId, btnEl) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const icon = btnEl ? btnEl.querySelector('i') : null;
    if (inp.type === 'password') {
        inp.type = 'text';
        if (icon) icon.className = 'fa-regular fa-eye-slash';
    } else {
        inp.type = 'password';
        if (icon) icon.className = 'fa-regular fa-eye';
    }
};

window.updateDigiflazzEnvBadgePreview = function() {
    window.onChangeDigiflazzEnvMode();
};

// 1. Sembunyikan / Tampilkan Produk & Variasi (Misal untuk Produk Cek ID)
window.toggleTempVariantHidden = function(idx) {
    if (tempProductVariants[idx]) {
        tempProductVariants[idx].isHidden = !tempProductVariants[idx].isHidden;
        window.renderTempNominals();
    }
};

window.toggleBrandHiddenQuick = async function(brandName) {
    const bObj = groupedBrands.find(b => b.brandName === brandName);
    if (!bObj) return;
    const currentlyHidden = Boolean(bObj.isBrandHidden || bObj.items.every(i => i.isHidden));
    const nextHidden = !currentlyHidden;

    try {
        for (const item of bObj.items) {
            if (item.dbId) {
                await updateDoc(doc(db, pathProducts, item.dbId), {
                    isBrandHidden: nextHidden,
                    isHidden: nextHidden
                });
            }
        }
        window.showToast(
            nextHidden ? 'Produk Disembunyikan' : 'Produk Ditampilkan',
            nextHidden
                ? `Produk "${brandName}" kini disembunyikan dari katalog Web User.`
                : `Produk "${brandName}" kini ditampilkan kembali di katalog Web User.`,
            nextHidden ? 'warning' : 'success'
        );
    } catch (e) {
        window.customAlert('Gagal', 'Tidak dapat mengubah status visibilitas produk.', 'error');
    }
};

// 2. Verifikasi PIN Keamanan Admin (M-Banking 6 Titik + Keypad Interaktif)
window.syncAdminPinDotsUI = function() {
    const inp = document.getElementById('admin-pin-verify-input');
    const row = document.getElementById('admin-pin-dots-row');
    if (!inp || !row) return;
    const val = String(inp.value || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (inp.value !== val) inp.value = val;
    row.querySelectorAll('.pin-dot').forEach((d, idx) => {
        d.classList.toggle('filled', idx < val.length);
    });
};

window.pressAdminPinKeypad = function(key) {
    const inp = document.getElementById('admin-pin-verify-input');
    if (!inp) return;
    let cur = String(inp.value || '').replace(/[^0-9]/g, '');
    if (key === 'CLEAR') cur = '';
    else if (key === 'BACK') cur = cur.slice(0, -1);
    else if (/^[0-9]$/.test(key) && cur.length < 6) cur += key;
    inp.value = cur;
    window.syncAdminPinDotsUI();
    if (cur.length === 6) {
        setTimeout(() => window.confirmAdminPinVerification(), 120);
    }
};

document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modal-admin-pin-verify');
    if (!modal || !modal.classList.contains('active')) return;
    if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        window.pressAdminPinKeypad(e.key);
    } else if (e.key === 'Backspace') {
        e.preventDefault();
        window.pressAdminPinKeypad('BACK');
    } else if (e.key === 'Escape') {
        window.closeAdminPinModal();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        window.confirmAdminPinVerification();
    }
});

window.requestAdminPinVerification = function(actionTitle, onVerifiedCallback) {
    const savedPin = String(siteSettings.adminSecurityPin || '').trim();
    if (!savedPin || siteSettings.requireAdminPin === false) {
        if (typeof onVerifiedCallback === 'function') onVerifiedCallback();
        return;
    }
    pendingAdminPinCallback = onVerifiedCallback;
    const descEl = document.getElementById('admin-pin-modal-desc');
    const inpEl = document.getElementById('admin-pin-verify-input');
    const errEl = document.getElementById('admin-pin-error-helper');
    if (descEl) {
        descEl.innerHTML = `<b class="text-primary">${window.escapeHtml(actionTitle || 'Konfirmasi Tindakan Admin')}</b>`;
    }
    if (inpEl) inpEl.value = '';
    if (errEl) {
        errEl.className = 'text-xs text-muted d-block mb-2';
        errEl.innerText = 'Gunakan tombol angka di bawah atau keyboard fisik';
    }
    window.syncAdminPinDotsUI();
    window.openModal('modal-admin-pin-verify');
    setTimeout(() => inpEl?.focus(), 120);
};

window.closeAdminPinModal = function() {
    pendingAdminPinCallback = null;
    window.closeModal('modal-admin-pin-verify');
};

window.confirmAdminPinVerification = function() {
    const entered = (document.getElementById('admin-pin-verify-input')?.value || '').trim();
    const savedPin = String(siteSettings.adminSecurityPin || '').trim();
    if (!entered || entered !== savedPin) {
        const inp = document.getElementById('admin-pin-verify-input');
        const row = document.getElementById('admin-pin-dots-row');
        const errEl = document.getElementById('admin-pin-error-helper');
        if (inp) inp.value = '';
        window.syncAdminPinDotsUI();
        if (row) {
            row.classList.remove('pin-error-shake');
            void row.offsetWidth;
            row.classList.add('pin-error-shake');
        }
        if (errEl) {
            errEl.className = 'text-xs text-danger fw-bold d-block mb-2';
            errEl.innerText = 'PIN Admin tidak sesuai! Silakan coba lagi.';
        }
        return;
    }
    const cb = pendingAdminPinCallback;
    pendingAdminPinCallback = null;
    window.closeModal('modal-admin-pin-verify');
    if (typeof cb === 'function') cb();
};

// ============================================================================
// TAB BARU: PANTAU SALDO & TOP UP SALDO MEMBER (#tab-balance)
// ============================================================================
window.switchAdminBalanceSubTab = function(subTab = 'requests') {
    currentAdminBalanceSubTab = subTab;
    ['requests', 'wallets', 'logs'].forEach(k => {
        const btn = document.getElementById(`bal-subtab-btn-${k}`);
        const panel = document.getElementById(`bal-panel-${k}`);
        if (btn) btn.classList.toggle('active', k === subTab);
        if (panel) panel.style.display = (k === subTab) ? 'block' : 'none';
    });
    window.renderAdminBalanceTab();
};

window.setAdminTopupOrderFilter = function(filterVal, btnEl) {
    currentAdminTopupOrderFilter = filterVal || 'ALL';
    document.querySelectorAll('#bal-topup-filter-pills .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    window.renderAdminTopupOrdersTable();
};

window.renderAdminBalanceTab = function() {
    const membersOnly = allUsersList.filter(u => u && !u.isAnonymous && !u.isGuest && u.role !== 'anonymous');
    const totalActiveBal = membersOnly.reduce((acc, u) => acc + Math.max(0, Math.round(Number(u.balance || 0))), 0);
    const membersWithBalCount = membersOnly.filter(u => Number(u.balance || 0) > 0).length;

    const topupOrders = orders.filter(o =>
        o && (o.isTopupOrder === true || o.orderType === 'TOPUP_BALANCE' || String(o.id || '').toUpperCase().startsWith('TOPUP-'))
    );
    const pendingTopups = topupOrders.filter(o => o.status === 'UNPAID' || o.status === 'PENDING' || o.status === 'PENDING_PAYMENT');
    const pendingTopupSum = pendingTopups.reduce((acc, o) => acc + Number(o.topupAmount || o.baseTotal || o.finalTotal || 0), 0);

    const todayStr = new Date().toLocaleDateString('id-ID');
    const todaySuccessTopups = topupOrders.filter(o => o.status === 'SUCCESS' && new Date(o.date).toLocaleDateString('id-ID') === todayStr);
    const todayTopupSum = todaySuccessTopups.reduce((acc, o) => acc + Number(o.topupAmount || o.baseTotal || o.finalTotal || 0), 0);

    const refundLogs = balanceLogsList.filter(l => String(l.type || '').toUpperCase() === 'REFUND');

    const setEl = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
    };
    setEl('bal-stat-total-active', `Rp${totalActiveBal.toLocaleString('id-ID')}`);
    setEl('bal-stat-members-with-bal', `${membersWithBalCount} dari ${membersOnly.length} member memiliki saldo`);
    setEl('bal-stat-pending-topup', String(pendingTopups.length));
    setEl('bal-stat-pending-topup-rp', `Total Rp${pendingTopupSum.toLocaleString('id-ID')} menunggu`);
    setEl('bal-stat-today-topup', `Rp${todayTopupSum.toLocaleString('id-ID')}`);
    setEl('bal-stat-today-topup-cnt', `${todaySuccessTopups.length} top up selesai hari ini`);
    setEl('bal-stat-refund-total', `${refundLogs.length}x`);
    setEl('bal-badge-pending-count', String(pendingTopups.length));

    const sideDot = document.getElementById('badge-balance-topup');
    if (sideDot) sideDot.style.display = pendingTopups.length > 0 ? 'inline-block' : 'none';

    window.renderAdminTopupOrdersTable();
    window.renderAdminMemberWalletsTable();
    window.renderAdminBalanceLogsTable();
};

window.renderAdminTopupOrdersTable = function() {
    const tbody = document.getElementById('admin-topup-orders-tbody');
    if (!tbody) return;

    const q = (document.getElementById('admin-search-topup-order')?.value || '').trim().toLowerCase();
    let list = orders.filter(o =>
        o && (o.isTopupOrder === true || o.orderType === 'TOPUP_BALANCE' || String(o.id || '').toUpperCase().startsWith('TOPUP-'))
    ).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    if (currentAdminTopupOrderFilter === 'PENDING') {
        list = list.filter(o => o.status === 'UNPAID' || o.status === 'PENDING' || o.status === 'PENDING_PAYMENT');
    } else if (currentAdminTopupOrderFilter === 'SUCCESS') {
        list = list.filter(o => o.status === 'SUCCESS');
    } else if (currentAdminTopupOrderFilter === 'FAILED') {
        list = list.filter(o => o.status === 'FAILED' || o.status === 'CANCELLED' || o.status === 'EXPIRED');
    }

    if (q) {
        list = list.filter(o =>
            String(o.id || '').toLowerCase().includes(q) ||
            String(o.buyerName || '').toLowerCase().includes(q) ||
            String(o.userEmail || '').toLowerCase().includes(q)
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">Belum ada permintaan isi saldo pada filter ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.slice(0, 100).map(o => {
        const nom = Math.round(Number(o.topupAmount || o.baseTotal || o.finalTotal || 0));
        const tot = Math.round(Number(o.finalTotal || nom));
        const pm = String(o.paymentMethod || 'qris').toLowerCase();
        const pmBadge = pm === 'cash'
            ? `<span class="status-badge status-pending"><i class="fa-solid fa-barcode"></i> TUNAI KASIR</span>`
            : `<span class="status-badge status-unpaid"><i class="fa-solid fa-qrcode"></i> QRIS OTOMATIS</span>`;

        let stBadge = `<span class="status-badge status-pending">MENUNGGU PEMBAYARAN</span>`;
        if (o.status === 'SUCCESS' || o.balanceCredited === true) {
            stBadge = `<span class="status-badge status-success"><i class="fa-solid fa-circle-check"></i> SALDO MASUK</span>`;
        } else if (o.status === 'FAILED' || o.status === 'CANCELLED' || o.status === 'EXPIRED') {
            stBadge = `<span class="status-badge status-failed">${window.escapeHtml(o.status)}</span>`;
        }

        const canApprove = (o.status !== 'SUCCESS' && !o.balanceCredited && o.status !== 'CANCELLED' && o.status !== 'FAILED');
        const actionHtml = canApprove
            ? `<div class="flex-gap align-center flex-wrap-gap">
                   <button type="button" class="btn btn-success btn-sm" onclick="window.adminApproveTopupOrder('${escapeJsStr(o.dbId)}')">
                       <i class="fa-solid fa-check"></i> Setujui &amp; Isi Saldo
                   </button>
                   <button type="button" class="btn btn-danger btn-sm" onclick="window.adminCancelTopupOrder('${escapeJsStr(o.dbId)}')">
                       <i class="fa-solid fa-xmark"></i> Batal
                   </button>
               </div>`
            : `<button type="button" class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${escapeJsStr(o.dbId)}')"><i class="fa-solid fa-receipt"></i> Detail</button>`;

        return `<tr>
            <td>
                <strong class="code-mono text-dark">#${window.escapeHtml(o.id)}</strong><br>
                <small class="text-muted text-xs">${new Date(o.date).toLocaleString('id-ID')}</small>
            </td>
            <td>
                <strong class="text-dark">${window.escapeHtml(o.buyerName || 'Member')}</strong><br>
                <small class="text-muted text-xs">${window.escapeHtml(o.userEmail || '-')}</small>
            </td>
            <td><strong class="text-success">+Rp${nom.toLocaleString('id-ID')}</strong></td>
            <td><strong class="text-primary">Rp${tot.toLocaleString('id-ID')}</strong></td>
            <td>${pmBadge}</td>
            <td>${stBadge}</td>
            <td>${actionHtml}</td>
        </tr>`;
    }).join('');
};

window.adminApproveTopupOrder = function(orderDbId) {
    const ord = orders.find(o => o.dbId === orderDbId);
    if (!ord) return;
    const nom = Math.round(Number(ord.topupAmount || ord.baseTotal || ord.finalTotal || 0));
    window.requestAdminPinVerification(`Setujui Isi Saldo #${ord.id} (+Rp${nom.toLocaleString('id-ID')})`, async () => {
        const ok = await creditTopupOrderBalanceIfNeeded(ord, orderDbId);
        if (ok) {
            window.renderAdminBalanceTab();
        } else {
            window.customAlert('Gagal', 'Tidak dapat mengkreditkan saldo ke akun member.', 'error');
        }
    });
};

window.adminCancelTopupOrder = function(orderDbId) {
    const ord = orders.find(o => o.dbId === orderDbId);
    if (!ord) return;
    window.openConfirm('Batalkan Permintaan Top Up', `Batalkan tagihan isi saldo <b>#${window.escapeHtml(ord.id)}</b>?`, async (confirmed) => {
        if (!confirmed) return;
        await updateDoc(doc(db, pathOrders, orderDbId), {
            status: 'CANCELLED',
            cancelledAt: Date.now()
        }).catch(() => {});
        window.showToast('Dibatalkan', `Permintaan #${ord.id} telah dibatalkan.`, 'info');
        window.renderAdminBalanceTab();
    });
};

window.renderAdminMemberWalletsTable = function() {
    const tbody = document.getElementById('admin-member-wallets-tbody');
    if (!tbody) return;

    const q = (document.getElementById('admin-search-wallet-member')?.value || '').trim().toLowerCase();
    let list = allUsersList.filter(u => u && !u.isAnonymous && !u.isGuest && u.role !== 'anonymous');

    if (q) {
        list = list.filter(u =>
            String(u.name || '').toLowerCase().includes(q) ||
            String(u.email || '').toLowerCase().includes(q) ||
            String(u.uid || '').toLowerCase().includes(q)
        );
    }

    list.sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">Tidak ada member ditemukan.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.slice(0, 120).map(u => {
        const bal = Math.round(Number(u.balance || 0));
        const isMp = isAdminUserMemberPlusActive(u);
        const hasPin = Boolean(u.trxPin && String(u.trxPin).length === 6);
        const uOrders = orders.filter(o => o.status === 'SUCCESS' && !o.isTopupOrder && (o.userId === u.uid || (u.email && o.userEmail?.toLowerCase() === u.email.toLowerCase())));
        const spent = Math.max(0, Math.round(Number(u.preservedTotalSpent || 0))) + uOrders.reduce((s, o) => s + Number(o.finalTotal || 0), 0);
        const totalCnt = Math.max(0, Math.round(Number(u.preservedSuccessOrders || 0))) + uOrders.length;
        const dispName = u.name || (u.email ? u.email.split('@')[0] : 'Member');

        return `<tr>
            <td>
                <strong class="text-dark">${window.escapeHtml(dispName)}</strong><br>
                <small class="text-muted text-xs">${window.escapeHtml(u.email || '-')}</small>
            </td>
            <td>
                ${isMp
                    ? `<span class="status-badge status-memberplus-gold"><i class="fa-solid fa-crown"></i> MEMBER PLUS</span>`
                    : `<span class="status-badge status-success">MEMBER</span>`}
            </td>
            <td>
                ${hasPin
                    ? `<span class="status-badge status-success"><i class="fa-solid fa-lock"></i> PIN AKTIF</span>`
                    : `<span class="status-badge status-anon">BELUM DISETEL</span>`}
            </td>
            <td><strong class="text-success" style="font-size:1rem;">Rp${bal.toLocaleString('id-ID')}</strong></td>
            <td><span class="text-primary fw-bold">Rp${spent.toLocaleString('id-ID')}</span> <small class="text-muted text-xs">(${totalCnt}x)</small></td>
            <td>
                <button type="button" class="btn btn-primary btn-sm" onclick="window.openAdminAdjustBalanceModal('${escapeJsStr(u.uid)}')">
                    <i class="fa-solid fa-sliders"></i> Tambah / Kurangi Saldo
                </button>
            </td>
        </tr>`;
    }).join('');
};

window.openAdminAdjustBalanceModal = function(uid) {
    const u = allUsersList.find(x => x.uid === uid);
    if (!u) return;
    const dispName = u.name || (u.email ? u.email.split('@')[0] : 'Member');
    const curBal = Math.round(Number(u.balance || 0));

    document.getElementById('adj-bal-uid').value = uid;
    document.getElementById('adj-bal-type').value = 'ADD';
    document.getElementById('adj-bal-amount').value = '';
    document.getElementById('adj-bal-note').value = '';
    const infoBox = document.getElementById('adj-bal-user-info');
    if (infoBox) {
        infoBox.innerHTML = `
            <div class="flex-between align-center">
                <div>
                    <strong class="text-dark d-block">${window.escapeHtml(dispName)}</strong>
                    <span class="text-xs text-muted">${window.escapeHtml(u.email || uid)}</span>
                </div>
                <div class="text-right">
                    <span class="text-xs text-muted d-block">SALDO SAAT INI</span>
                    <strong class="text-success" style="font-size:1.1rem;">Rp${curBal.toLocaleString('id-ID')}</strong>
                </div>
            </div>`;
    }
    window.openModal('modal-adjust-user-balance');
};

window.submitAdminBalanceAdjustment = function() {
    const uid = document.getElementById('adj-bal-uid')?.value || '';
    const adjType = document.getElementById('adj-bal-type')?.value || 'ADD';
    const rawAmt = parseInt(document.getElementById('adj-bal-amount')?.value || '0', 10);
    const note = (document.getElementById('adj-bal-note')?.value || '').trim() || (adjType === 'ADD' ? 'Penambahan Saldo oleh Admin' : 'Pemotongan Saldo oleh Admin');

    if (!uid || isNaN(rawAmt) || rawAmt <= 0) {
        window.customAlert('Nominal Tidak Valid', 'Masukkan nominal saldo lebih dari Rp0.', 'warning');
        return;
    }

    const u = allUsersList.find(x => x.uid === uid);
    const dispName = u ? (u.name || u.email || uid) : uid;
    const actionLabel = `${adjType === 'ADD' ? 'Tambah' : 'Potong'} Saldo Rp${rawAmt.toLocaleString('id-ID')} (${dispName})`;

    window.closeModal('modal-adjust-user-balance');
    window.requestAdminPinVerification(actionLabel, async () => {
        try {
            const userRef = doc(db, pathUsers, uid);
            const nowMs = Date.now();
            let finalBal = 0;

            await runTransaction(db, async (tx) => {
                const uSnap = await tx.get(userRef);
                const curBal = uSnap.exists() ? Math.round(Number(uSnap.data().balance || 0)) : 0;
                finalBal = adjType === 'ADD' ? (curBal + rawAmt) : Math.max(0, curBal - rawAmt);
                tx.set(userRef, {
                    balance: finalBal,
                    balanceUpdatedAt: nowMs
                }, { merge: true });
            });

            await addDoc(collection(db, pathBalanceLogs), {
                uid: uid,
                userEmail: u?.email || '',
                type: adjType === 'ADD' ? 'ADMIN_ADD' : 'ADMIN_DEDUCT',
                amount: adjType === 'ADD' ? rawAmt : -rawAmt,
                orderId: 'ADMIN-' + String(nowMs).slice(-6),
                note: note,
                createdAt: nowMs
            }).catch(() => {});

            window.showToast('Saldo Diperbarui', `Saldo ${dispName} kini Rp${finalBal.toLocaleString('id-ID')}.`, 'success');
            window.renderAdminBalanceTab();
        } catch (e) {
            window.customAlert('Gagal', 'Tidak dapat memperbarui saldo member.', 'error');
        }
    });
};

window.renderAdminBalanceLogsTable = function() {
    const tbody = document.getElementById('admin-balance-logs-tbody');
    if (!tbody) return;

    const q = (document.getElementById('admin-search-balance-logs')?.value || '').trim().toLowerCase();
    let list = [...balanceLogsList];
    if (q) {
        list = list.filter(l =>
            String(l.userEmail || '').toLowerCase().includes(q) ||
            String(l.orderId || '').toLowerCase().includes(q) ||
            String(l.note || '').toLowerCase().includes(q) ||
            String(l.type || '').toLowerCase().includes(q)
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">Belum ada riwayat mutasi saldo tercatat.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.slice(0, 120).map(l => {
        const amt = Math.round(Number(l.amount || 0));
        const t = String(l.type || 'MUTASI').toUpperCase();
        let badge = `<span class="status-badge status-anon">${window.escapeHtml(t)}</span>`;
        if (t === 'TOPUP' || t === 'ADMIN_ADD') badge = `<span class="status-badge status-success">${window.escapeHtml(t)}</span>`;
        else if (t === 'REFUND') badge = `<span class="status-badge status-pending"><i class="fa-solid fa-rotate-left"></i> AUTO-REFUND</span>`;
        else if (t === 'PURCHASE' || t === 'MEMBER_PLUS' || t === 'ADMIN_DEDUCT') badge = `<span class="status-badge status-unpaid">${window.escapeHtml(t)}</span>`;

        const amtHtml = amt >= 0
            ? `<strong class="text-success">+Rp${amt.toLocaleString('id-ID')}</strong>`
            : `<strong class="text-danger">-Rp${Math.abs(amt).toLocaleString('id-ID')}</strong>`;

        return `<tr>
            <td><small class="text-xs">${new Date(l.createdAt || Date.now()).toLocaleString('id-ID')}</small></td>
            <td><strong class="text-dark text-xs">${window.escapeHtml(l.userEmail || l.uid || '-')}</strong></td>
            <td>${badge}</td>
            <td>${amtHtml}</td>
            <td><code class="code-mono text-xs">${window.escapeHtml(l.orderId || '-')}</code></td>
            <td><span class="text-xs">${window.escapeHtml(l.note || '-')}</span></td>
        </tr>`;
    }).join('');
};

// 3. Panel Laporan Pemasukan, Pengeluaran & Laba Lengkap (Produk Lokal Vipercell vs Digiflazz)
function classifyOrderFinancialRow(order) {
    const it = (order.items && order.items[0]) ? order.items[0] : {};
    const isTopup = Boolean(order.isTopupOrder === true || order.orderType === 'TOPUP_BALANCE');
    const isMemberPlus = Boolean(order.isMemberPlusOrder === true || order.orderType === 'MEMBER_PLUS_SUB');
    const isDf = Boolean(
        !isTopup && !isMemberPlus && (
            order.digiflazzSku ||
            it.processType === 'digiflazz' ||
            it.processType === 'digiflazz_pasca' ||
            it.processType === 'ewallet_custom' ||
            it.isDigiflazz ||
            it.buyerSkuCode
        )
    );

    let sourceCode = 'VIPERCELL';
    let sourceLabel = 'Produk Lokal Vipercell';
    if (isDf) {
        sourceCode = 'DIGIFLAZZ';
        sourceLabel = 'Produk Digiflazz';
    } else if (isMemberPlus) {
        sourceCode = 'MEMBER_PLUS';
        sourceLabel = 'Langganan Member Plus';
    } else if (isTopup) {
        sourceCode = 'MEMBER_PLUS';
        sourceLabel = 'Isi Saldo Akun';
    }

    const income = Math.round(Number(order.finalTotal || order.baseTotal || 0));
    let expense = 0;
    if (isDf) {
        expense = Math.round(Number(order.digiflazzPrice || it.digiflazzModalPrice || 0));
        if (expense <= 0) {
            const sku = order.digiflazzSku || it.buyerSkuCode || '';
            const matchedSku = digiflazzCatalogList.find(d => d.buyer_sku_code === sku);
            if (matchedSku) expense = Math.round(Number(matchedSku.price || matchedSku.admin || 0));
        }
    } else if (isTopup) {
        // Pengisian saldo member menambah kas namun menjadi kewajiban saldo member
        expense = 0;
    } else {
        expense = Math.round(Number(it.modalPrice || 0));
    }

    const netProfit = Math.max(0, income - expense);
    return {
        order,
        sourceCode,
        sourceLabel,
        itemName: it.name || order.productName || 'Pesanan',
        targetInfo: order.digiflazzCustomerNo || order.targetId || it.playerInfo || order.userEmail || '-',
        paymentMethod: (order.paymentMethod || 'qris').toUpperCase(),
        income,
        expense,
        netProfit,
        dateObj: new Date(order.date)
    };
}

function getFilteredFinancialRows() {
    const now = new Date();
    const todayStr = now.toLocaleDateString('id-ID');
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    const successOrders = orders.filter(o => o.status === 'SUCCESS');
    const rows = successOrders.map(classifyOrderFinancialRow);

    return rows.filter(r => {
        if (currentFinancialSourceFilter !== 'ALL' && r.sourceCode !== currentFinancialSourceFilter) {
            return false;
        }
        if (currentFinancialPeriodFilter === 'TODAY') {
            return r.dateObj.toLocaleDateString('id-ID') === todayStr;
        }
        if (currentFinancialPeriodFilter === 'MONTH') {
            return r.dateObj.getMonth() === curMonth && r.dateObj.getFullYear() === curYear;
        }
        return true;
    });
}

window.openFinancialReportPanel = function(defaultPeriod = 'ALL') {
    currentFinancialPeriodFilter = defaultPeriod || 'ALL';
    const panel = document.getElementById('overview-financial-panel');
    if (panel) {
        panel.style.display = 'block';
        document.getElementById('fin-pill-period-all')?.classList.toggle('active', currentFinancialPeriodFilter === 'ALL');
        document.getElementById('fin-pill-period-today')?.classList.toggle('active', currentFinancialPeriodFilter === 'TODAY');
        document.getElementById('fin-pill-period-month')?.classList.toggle('active', currentFinancialPeriodFilter === 'MONTH');
        window.renderFinancialReportPanel();
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.closeFinancialReportPanel = function() {
    const panel = document.getElementById('overview-financial-panel');
    if (panel) panel.style.display = 'none';
};

window.setFinancialSourceFilter = function(src, btnEl) {
    currentFinancialSourceFilter = src;
    ['all', 'vipercell', 'digiflazz', 'memberplus'].forEach(k => {
        document.getElementById(`fin-pill-source-${k}`)?.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    window.renderFinancialReportPanel();
};

window.setFinancialPeriodFilter = function(period, btnEl) {
    currentFinancialPeriodFilter = period;
    ['all', 'today', 'month'].forEach(k => {
        document.getElementById(`fin-pill-period-${k}`)?.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    window.renderFinancialReportPanel();
};

window.renderFinancialReportPanel = function() {
    const tbody = document.getElementById('fin-report-tbody');
    if (!tbody) return;

    const rows = getFilteredFinancialRows();
    const todayStr = new Date().toLocaleDateString('id-ID');

    const archFin = (currentFinancialPeriodFilter === 'ALL' && siteSettings.archivedFinancialSummary && typeof siteSettings.archivedFinancialSummary === 'object')
        ? siteSettings.archivedFinancialSummary
        : {};
    let totalIncome = currentFinancialSourceFilter === 'ALL'
        ? Math.max(0, Math.round(Number(archFin.totalIncome || 0)))
        : (currentFinancialSourceFilter === 'DIGIFLAZZ'
            ? Math.max(0, Math.round(Number(archFin.digiflazzIncome || 0)))
            : (currentFinancialSourceFilter === 'VIPERCELL' ? Math.max(0, Math.round(Number(archFin.vipercellIncome || 0))) : 0));
    let totalExpense = currentFinancialSourceFilter === 'ALL'
        ? Math.max(0, Math.round(Number(archFin.totalExpense || 0)))
        : (currentFinancialSourceFilter === 'DIGIFLAZZ' ? Math.max(0, Math.round(Number(archFin.digiflazzExpense || 0))) : 0);
    let totalNet = currentFinancialSourceFilter === 'ALL'
        ? Math.max(0, Math.round(Number(archFin.totalNetProfit || 0)))
        : Math.max(0, totalIncome - totalExpense);
    let vipercellIncome = Math.max(0, Math.round(Number(archFin.vipercellIncome || 0)));
    let digiflazzIncome = Math.max(0, Math.round(Number(archFin.digiflazzIncome || 0)));
    let todaySaldoIncome = 0;
    const archivedCount = currentFinancialPeriodFilter === 'ALL' ? Math.max(0, Math.round(Number(archFin.totalCount || 0))) : 0;

    orders.filter(o => o.status === 'SUCCESS').forEach(o => {
        const row = classifyOrderFinancialRow(o);
        if (row.dateObj.toLocaleDateString('id-ID') === todayStr) {
            todaySaldoIncome += row.income;
        }
    });

    rows.forEach(r => {
        totalIncome += r.income;
        totalExpense += r.expense;
        totalNet += r.netProfit;
        if (r.sourceCode === 'DIGIFLAZZ') digiflazzIncome += r.income;
        else vipercellIncome += r.income;
    });

    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setTxt('fin-stat-income', `Rp${totalIncome.toLocaleString('id-ID')}`);
    setTxt('fin-stat-income-sub', `${archivedCount + rows.length} transaksi selesai`);
    setTxt('fin-stat-expense', `Rp${totalExpense.toLocaleString('id-ID')}`);
    setTxt('fin-stat-netprofit', `Rp${totalNet.toLocaleString('id-ID')}`);
    const marginPct = totalIncome > 0 ? ((totalNet / totalIncome) * 100).toFixed(1) : '0.0';
    setTxt('fin-stat-margin-sub', `Margin bersih: ${marginPct}%`);
    setTxt('fin-stat-split', `Lokal Rp${vipercellIncome.toLocaleString('id-ID')} | DF Rp${digiflazzIncome.toLocaleString('id-ID')}`);
    setTxt('fin-stat-today-saldo-sub', `Saldo Hari Ini: Rp${todaySaldoIncome.toLocaleString('id-ID')}`);

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">Belum ada data transaksi selesai pada filter ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.slice(0, 150).map(r => {
        let srcBadge = `<span class="status-badge status-success"><i class="fa-solid fa-vault"></i> VIPERCELL LOKAL</span>`;
        if (r.sourceCode === 'DIGIFLAZZ') {
            srcBadge = `<span class="status-badge status-pending"><i class="fa-solid fa-microchip"></i> DIGIFLAZZ</span>`;
        } else if (r.sourceCode === 'MEMBER_PLUS') {
            srcBadge = `<span class="status-badge status-vip"><i class="fa-solid fa-crown"></i> ${window.escapeHtml(r.sourceLabel.toUpperCase())}</span>`;
        }

        return `<tr>
            <td>
                <strong class="code-mono text-dark">#${window.escapeHtml(r.order.id)}</strong><br>
                <small class="text-muted text-xs">${r.dateObj.toLocaleString('id-ID')}</small>
            </td>
            <td>${srcBadge}</td>
            <td>
                <strong class="text-dark">${window.escapeHtml(r.itemName)}</strong><br>
                <small class="text-muted text-xs">${window.escapeHtml(r.targetInfo)}</small>
            </td>
            <td><span class="status-badge status-unpaid">${window.escapeHtml(r.paymentMethod)}</span></td>
            <td class="text-success fw-bold">+Rp${r.income.toLocaleString('id-ID')}</td>
            <td class="text-danger fw-bold">-Rp${r.expense.toLocaleString('id-ID')}</td>
            <td class="text-primary fw-900">Rp${r.netProfit.toLocaleString('id-ID')}</td>
        </tr>`;
    }).join('');
};

// Unduh Data Keuangan Lengkap dalam Bentuk Sheet (.xlsx) atau CSV
window.exportFinancialReportSheet = function(format = 'xlsx') {
    const rows = getFilteredFinancialRows();
    if (rows.length === 0) {
        window.customAlert('Data Kosong', 'Belum ada data transaksi pada filter ini untuk diunduh.', 'warning');
        return;
    }

    const totalInc = rows.reduce((s, r) => s + r.income, 0);
    const totalExp = rows.reduce((s, r) => s + r.expense, 0);
    const totalNet = rows.reduce((s, r) => s + r.netProfit, 0);

    const sheetData = rows.map((r, idx) => ({
        'No': idx + 1,
        'Tanggal & Waktu': r.dateObj.toLocaleString('id-ID'),
        'Nomor Invoice': `#${r.order.id}`,
        'Kategori Sumber': r.sourceLabel,
        'Nama Produk / Layanan': r.itemName,
        'Tujuan / Pembeli': r.targetInfo,
        'Email Pembeli': r.order.userEmail || '-',
        'Metode Pembayaran': r.paymentMethod,
        'Pemasukan / Harga Jual (Rp)': r.income,
        'Pengeluaran / Harga Modal (Rp)': r.expense,
        'Laba Bersih (Rp)': r.netProfit
    }));

    sheetData.push({
        'No': '',
        'Tanggal & Waktu': 'TOTAL KESELURUHAN',
        'Nomor Invoice': `${rows.length} Transaksi`,
        'Kategori Sumber': '',
        'Nama Produk / Layanan': '',
        'Tujuan / Pembeli': '',
        'Email Pembeli': '',
        'Metode Pembayaran': '',
        'Pemasukan / Harga Jual (Rp)': totalInc,
        'Pengeluaran / Harga Modal (Rp)': totalExp,
        'Laba Bersih (Rp)': totalNet
    });

    const dateStamp = new Date().toISOString().slice(0, 10);

    if (format === 'xlsx' && typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws['!cols'] = [
            { wch: 5 }, { wch: 22 }, { wch: 15 }, { wch: 22 },
            { wch: 30 }, { wch: 24 }, { wch: 24 }, { wch: 16 },
            { wch: 22 }, { wch: 22 }, { wch: 18 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Laporan Keuangan Vipercell');
        XLSX.writeFile(wb, `Laporan_Keuangan_Vipercell_${dateStamp}.xlsx`);
        window.showToast('Sheet Diunduh', 'File Excel (.xlsx) Laporan Keuangan berhasil diunduh.', 'success');
        return;
    }

    const headers = Object.keys(sheetData[0]);
    const csvLines = [
        headers.join(','),
        ...sheetData.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Keuangan_Vipercell_${dateStamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.showToast('CSV Diunduh', 'File CSV Laporan Keuangan berhasil diunduh.', 'success');
};

// Hapus Data Pendapatan Lama & Sisakan Data Saldo/Transaksi Pada Hari Itu Saja
window.clearOldRevenueKeepTodayOnly = function() {
    const todayStr = new Date().toLocaleDateString('id-ID');
    const oldOrders = orders.filter(o => new Date(o.date).toLocaleDateString('id-ID') !== todayStr);
    const todayOrders = orders.filter(o => new Date(o.date).toLocaleDateString('id-ID') === todayStr);

    if (oldOrders.length === 0) {
        window.customAlert('Sudah Bersih', `Saat ini hanya tersisa data transaksi hari ini (${todayOrders.length} transaksi). Tidak ada data hari sebelumnya untuk dihapus.`, 'info');
        return;
    }

    window.openConfirm(
        'Hapus Data Pendapatan Lama',
        `Hapus <b>${oldOrders.length} data transaksi</b> dari hari-hari sebelumnya dan <b>sisakan hanya ${todayOrders.length} data transaksi &amp; saldo pada hari ini (${todayStr})</b>?`,
        async (confirmed) => {
            if (!confirmed) return;
            window.requestAdminPinVerification('Hapus Data Pendapatan Lama (Sisakan Hari Ini)', async () => {
                try {
                    let deletedCount = 0;
                    for (const oldOrd of oldOrders) {
                        if (oldOrd.dbId) {
                            await deleteDoc(doc(db, pathOrders, oldOrd.dbId)).catch(() => {});
                            deletedCount++;
                        }
                    }
                    window.renderFinancialReportPanel();
                    window.generateAdminReports();
                    window.showToast('Berhasil Dibersihkan', `${deletedCount} data pendapatan lama dihapus. Hanya data hari ini yang disisakan.`, 'success');
                } catch (e) {
                    window.customAlert('Gagal', 'Terjadi kesalahan saat membersihkan data pendapatan lama.', 'error');
                }
            });
        },
        'delete'
    );
};


window.toggleCheckIdSkuBox = function() {
    const chk = document.getElementById('manage-auto-check-target') || document.getElementById('manage-auto-check-id');
    const wrap = document.getElementById('manage-check-id-sku-wrap');
    if (wrap && chk) {
        wrap.style.display = chk.checked ? 'block' : 'none';
    }
};

// ============================================================================
// PRINT STRUK LANGSUNG BLUETOOTH 58MM (WEB ADMIN) & POLLER PENDING DIGIFLAZZ
// ============================================================================
let adminCachedBtDevice = null;
let adminCachedBtChar = null;

function formatAdminThermal58mmText(order) {
    const W = 32;
    const sep = '-'.repeat(W);
    const center = (s) => {
        const clean = String(s || '').trim().slice(0, W);
        return ' '.repeat(Math.max(0, Math.floor((W - clean.length) / 2))) + clean;
    };
    const kv = (lbl, val) => {
        const l = String(lbl || '').slice(0, 10).padEnd(10, ' ');
        const v = String(val || '-').trim();
        const lines = [`${l}: ${v.slice(0, W - 12)}`];
        let rem = v.slice(W - 12);
        while (rem.length > 0) {
            lines.push(' '.repeat(12) + rem.slice(0, W - 12));
            rem = rem.slice(W - 12);
        }
        return lines.join('\n');
    };

    const item = (order.items && order.items[0]) ? order.items[0] : {};
    const dtStr = order.date ? new Date(order.date).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : '-';
    const targetNo = String(order.digiflazzCustomerNo || order.targetId || item.playerInfo || '-').trim();
    const custName = String(order.plnSubscriberName || order.verifiedTargetName || order.buyerName || order.userEmail || 'PELANGGAN').toUpperCase();
    const payMethod = order.paymentMethod === 'cash' ? 'TUNAI' : (order.paymentMethod === 'balance' ? 'SALDO AKUN' : 'QRIS');
    const totalStr = 'Rp' + Number(order.finalTotal || 0).toLocaleString('id-ID');

    const lines = [
        center('VIPERCELL'),
        center('AMBON MALUKU INDONESIA'),
        center(dtStr),
        sep,
        center('STRUK PEMBELIAN'),
        sep,
        kv('NO. TRX', '#' + (order.id || '-')),
        kv('PRODUK', String(item.name || order.productName || '-').replace(/\(x\d+\)/i, '').trim()),
        kv('TUJUAN', targetNo),
        kv('PELANGGAN', custName),
        kv('METODE', payMethod),
        kv('STATUS', order.status === 'SUCCESS' ? 'LUNAS' : String(order.status || '-')),
        kv('TOTAL BYR', totalStr),
        sep
    ];

    if (order.plnTokenNumber) {
        lines.push(center('TOKEN PLN'));
        lines.push(center(order.plnTokenNumber));
        lines.push(sep);
    } else if (order.digiflazzSn) {
        lines.push(center('SN / REFERENSI'));
        lines.push(center(order.digiflazzSn));
        lines.push(sep);
    } else if (order.adminReply) {
        lines.push(center('RINCIAN PESANAN'));
        String(order.adminReply).split('\n').map(x => x.trim()).filter(Boolean).slice(0, 6).forEach(l => {
            for (let i = 0; i < l.length; i += W) lines.push(l.slice(i, i + W));
        });
        lines.push(sep);
    }

    lines.push(center('Terima kasih'));
    lines.push(sep);
    return lines.join('\n');
}

window.adminPrintOrderBluetooth58mm = async function(explicitDbId = null) {
    const dbId = explicitDbId || document.getElementById('proc-order-dbid')?.value || '';
    const order = orders.find(o => o.dbId === dbId || o.id === dbId);
    if (!order) {
        window.showToast('Pesanan Tidak Ditemukan', 'Pilih pesanan terlebih dahulu untuk mencetak struk.', 'warning');
        return;
    }

    const receiptText = formatAdminThermal58mmText(order);
    const encoder = new TextEncoder();
    const initBytes = new Uint8Array([0x1B, 0x40, 0x1B, 0x61, 0x00]);
    const bodyBytes = encoder.encode(receiptText.replace(/\n/g, '\r\n') + '\r\n\r\n\r\n');
    const payload = new Uint8Array(initBytes.length + bodyBytes.length);
    payload.set(initBytes, 0);
    payload.set(bodyBytes, initBytes.length);

    if (navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function') {
        try {
            const BT_SERVICES = [
                '000018f0-0000-1000-8000-00805f9b34fb',
                'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
                '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                '0000ff00-0000-1000-8000-00805f9b34fb',
                '0000ffe0-0000-1000-8000-00805f9b34fb',
                '00001101-0000-1000-8000-00805f9b34fb'
            ];
            if (!adminCachedBtChar || !adminCachedBtDevice?.gatt?.connected) {
                const dev = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: BT_SERVICES
                });
                adminCachedBtDevice = dev;
                const server = await dev.gatt.connect();
                const services = await server.getPrimaryServices();
                for (const s of services) {
                    const chars = await s.getCharacteristics();
                    for (const c of chars) {
                        if (c.properties.write || c.properties.writeWithoutResponse) {
                            adminCachedBtChar = c;
                            break;
                        }
                    }
                    if (adminCachedBtChar) break;
                }
            }
            if (adminCachedBtChar) {
                for (let i = 0; i < payload.length; i += 100) {
                    const chunk = payload.slice(i, i + 100);
                    if (adminCachedBtChar.properties.writeWithoutResponse) {
                        await adminCachedBtChar.writeValueWithoutResponse(chunk);
                    } else {
                        await adminCachedBtChar.writeValue(chunk);
                    }
                    await new Promise(r => setTimeout(r, 25));
                }
                window.showToast('Struk Dicetak (58mm)', `Struk #${order.id} berhasil dikirim ke printer Bluetooth 58mm.`, 'success');
                return;
            }
        } catch (btErr) {
            if (btErr && btErr.name === 'NotFoundError') return;
        }
    }

    const w = window.open('', '_blank', 'width=340,height=600');
    if (w) {
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk #${window.escapeHtml(order.id)}</title><style>@page{size:58mm auto;margin:0mm;}body{width:58mm;margin:0;padding:3mm 2mm;font-family:"Courier New",Courier,monospace;font-size:11px;font-weight:700;line-height:1.32;color:#000;background:#fff;}pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:inherit;}</style></head><body><pre>${window.escapeHtml(receiptText)}</pre><script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},600);},180);};</script></body></html>`);
        w.document.close();
    }
};

// Poller Otomatis Transaksi Digiflazz yang Masih Pending (Jeda Aman >= 62 Detik)
setInterval(async () => {
    if (!currentAdmin) return;
    const nowMs = Date.now();
    const pendingDf = orders.filter(o =>
        o.status === 'PENDING' &&
        (o.digiflazzStatus === 'Pending' || o.digiflazzPending === true) &&
        o.digiflazzRefId &&
        o.digiflazzSku &&
        o.digiflazzCustomerNo &&
        o.digiflazzInFlight !== true &&
        (nowMs - Number(o.digiflazzLastHitAt || 0) >= 62000)
    );
    for (const ord of pendingDf.slice(0, 2)) {
        try {
            await window.executeDigiflazzTransactionForOrder(ord, ord.dbId, true);
        } catch (_) {}
    }
}, 25000);

// ============================================================================
// PEMBARUAN v28.7: PROGRESS TOAST TOP-CENTER, INPUT GAMBAR VIA LINK URL,
// BULK ACTION GUDANG DIGIFLAZZ, & INDIKATOR LOADING TOMBOL OTOMATIS
// ============================================================================

window.showProgressToast = function(toastId, title, msg, pct = 15) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const domId = `admin-prog-toast-${toastId}`;
    let toast = document.getElementById(domId);
    const safePct = Math.max(5, Math.min(100, Math.round(Number(pct || 0))));
    if (!toast) {
        toast = document.createElement('div');
        toast.id = domId;
        toast.className = 'toast-item toast-info show';
        toast.style.pointerEvents = 'auto';
        toast.innerHTML = `
            <div class="toast-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
            <div class="toast-content" style="width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <h4 class="prog-toast-title">${window.escapeHtml(title)}</h4>
                    <span class="prog-toast-pct" style="font-size:0.72rem; font-weight:900; color:var(--primary);">${safePct}%</span>
                </div>
                <p class="prog-toast-msg">${window.escapeHtml(msg)}</p>
                <div style="width:100%; height:5px; background:var(--border-subtle); border-radius:99px; overflow:hidden; margin-top:5px;">
                    <div class="prog-toast-fill" style="height:100%; width:${safePct}%; background:var(--primary); transition:width 0.22s ease;"></div>
                </div>
            </div>
        `;
        container.appendChild(toast);
    } else {
        const tEl = toast.querySelector('.prog-toast-title');
        const mEl = toast.querySelector('.prog-toast-msg');
        const pEl = toast.querySelector('.prog-toast-pct');
        const fEl = toast.querySelector('.prog-toast-fill');
        if (tEl) tEl.innerText = title;
        if (mEl) mEl.innerText = msg;
        if (pEl) pEl.innerText = `${safePct}%`;
        if (fEl) fEl.style.width = `${safePct}%`;
    }
};

window.finishProgressToast = function(toastId, doneTitle = '', doneMsg = '', type = 'success') {
    const domId = `admin-prog-toast-${toastId}`;
    const toast = document.getElementById(domId);
    if (toast) {
        const pEl = toast.querySelector('.prog-toast-pct');
        const fEl = toast.querySelector('.prog-toast-fill');
        if (pEl) pEl.innerText = '100%';
        if (fEl) fEl.style.width = '100%';
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 200);
        }, 260);
    }
    if (doneTitle) {
        window.showToast(doneTitle, doneMsg, type);
    }
};

// Poin 11: Input Gambar / Ikon Menggunakan Link URL
window.applyManageProductImgUrl = function(urlVal) {
    const clean = String(urlVal || '').trim();
    if (!clean) return;
    tempManageImgBase64 = clean;
    const prev = document.getElementById('preview-manage-img');
    if (prev) {
        prev.src = clean;
        prev.style.display = 'block';
    }
};

window.applyStoreLogoUrl = function(urlVal) {
    const clean = String(urlVal || '').trim();
    if (!clean) return;
    tempLogoBase64 = clean;
    const prev = document.getElementById('preview-logo');
    if (prev) {
        prev.src = clean;
        prev.style.display = 'block';
    }
    const delBtn = document.getElementById('btn-del-logo');
    if (delBtn) delBtn.style.display = 'inline-flex';
};

window.applyPwaIconUrl = function(urlVal) {
    const clean = String(urlVal || '').trim();
    if (!clean) return;
    tempPwaIconBase64 = clean;
    const prev = document.getElementById('preview-pwa-icon');
    if (prev) {
        prev.src = clean;
        prev.style.display = 'block';
    }
    const delBtn = document.getElementById('btn-del-pwa-icon');
    if (delBtn) delBtn.style.display = 'inline-flex';
};

window.addBannerFromUrlInput = function() {
    const inp = document.getElementById('set-banner-url-input');
    const clean = String(inp?.value || '').trim();
    if (!clean || (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('data:image/'))) {
        window.customAlert('Link URL Tidak Valid', 'Masukkan link URL gambar yang diawali https:// atau http://.', 'warning');
        return;
    }
    siteSettings.banners = [...(siteSettings.banners || []), clean];
    if (inp) inp.value = '';
    window.renderAdminBanners();
    window.showToast('Banner Ditambahkan', 'Gambar banner dari link URL berhasil ditambahkan. Jangan lupa klik Simpan Pengaturan Toko.', 'success');
};

window.applyNewsImgUrl = function(urlVal) {
    const clean = String(urlVal || '').trim();
    if (!clean) return;
    tempNewsImgBase64 = clean;
    const prevImg = document.getElementById('preview-news-img');
    const placeholder = document.getElementById('preview-news-placeholder');
    const btnRemove = document.getElementById('btn-remove-news-img');
    const statusLbl = document.getElementById('news-img-status-label');

    if (prevImg) { prevImg.src = clean; prevImg.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
    if (btnRemove) btnRemove.style.display = 'inline-flex';
    if (statusLbl) statusLbl.innerText = 'Link gambar siap disimpan';
};

// Poin 15 & 17: Sinkronisasi Massal Harga & Status Katalog Digiflazz + Kelola Produk Gangguan
window.syncAllDigiflazzCatalogPricesAndStatus = async function() {
    const dfProds = products.filter(p => p.isDigiflazz || p.processType === 'digiflazz' || p.processType === 'digiflazz_pasca');
    if (dfProds.length === 0) {
        window.customAlert('Belum Ada Produk', 'Belum ada produk Digiflazz di Katalog Toko.', 'info');
        return;
    }
    const progId = 'df-sync-all-cat';
    window.showProgressToast(progId, 'Sinkronisasi Katalog Digiflazz', `Memperbarui 0 / ${dfProds.length} produk...`, 12);

    let updatedCnt = 0;
    const warehouseMap = new Map();
    digiflazzCatalogList.forEach(d => {
        if (d.buyer_sku_code) warehouseMap.set(d.buyer_sku_code, d);
    });

    for (let i = 0; i < dfProds.length; i++) {
        const sp = dfProds[i];
        const wItem = warehouseMap.get(sp.buyerSkuCode);
        if (sp.dbId && wItem) {
            const modalVal = Number(wItem.price || wItem.admin || sp.digiflazzModalPrice || 0);
            const isCheckFree = Boolean(sp.isCheckUsernameProduct === true || Number(sp.priceNum || 0) === 0);
            const regSell = isCheckFree ? 0 : calculateDigiflazzSellPriceWithMarkup(modalVal, false, sp.type, sp.brand);
            const mpSell = isCheckFree ? 0 : calculateDigiflazzSellPriceWithMarkup(modalVal, true, sp.type, sp.brand);
            const isHealthy = wItem.buyer_product_status !== false && wItem.seller_product_status !== false;
            const hasStock = wItem.unlimited_stock !== false || Number(wItem.stock || 0) > 0;

            await updateDoc(doc(db, pathProducts, sp.dbId), {
                digiflazzModalPrice: modalVal,
                priceNum: isCheckFree ? 0 : regSell,
                memberPlusPriceNum: isCheckFree ? 0 : mpSell,
                sellerProductStatus: isHealthy,
                isVariantGangguan: !isHealthy,
                soldOut: !hasStock
            }).catch(() => {});
            updatedCnt++;
        }
        const pct = Math.min(98, Math.round(((i + 1) / dfProds.length) * 95));
        window.showProgressToast(progId, 'Sinkronisasi Katalog Digiflazz', `Memperbarui ${i + 1} / ${dfProds.length} produk...`, pct);
    }

    window.finishProgressToast(progId, 'Sinkronisasi Selesai', `${updatedCnt} produk Digiflazz di Katalog Toko telah disinkronkan.`, 'success');
};

window.autoHideGangguanDigiflazzProducts = async function() {
    const dfProds = products.filter(p => p.isDigiflazz || p.processType === 'digiflazz' || p.processType === 'digiflazz_pasca');
    if (dfProds.length === 0) {
        window.customAlert('Belum Ada Produk', 'Belum ada produk Digiflazz di Katalog Toko.', 'info');
        return;
    }
    const progId = 'df-gangguan-manage';
    window.showProgressToast(progId, 'Memeriksa Status Gangguan', 'Menyesuaikan visibilitas produk gangguan...', 25);

    let hiddenCount = 0;
    let restoredCount = 0;
    for (let i = 0; i < dfProds.length; i++) {
        const p = dfProds[i];
        if (!p.dbId || p.isCheckUsernameProduct) continue;
        const isGangguan = Boolean(p.isVariantGangguan || p.sellerProductStatus === false);
        if (isGangguan && !p.isHidden) {
            await updateDoc(doc(db, pathProducts, p.dbId), { isHidden: true }).catch(() => {});
            hiddenCount++;
        } else if (!isGangguan && p.isHidden && !p.isBrandHidden) {
            await updateDoc(doc(db, pathProducts, p.dbId), { isHidden: false }).catch(() => {});
            restoredCount++;
        }
    }
    window.finishProgressToast(
        progId,
        'Produk Gangguan Dikelola',
        `${hiddenCount} produk gangguan disembunyikan & ${restoredCount} produk normal ditampilkan kembali.`,
        'success'
    );
};

// Efek Sentuh & Indikator Bekerja pada Seluruh Tombol di Web Admin (Tanpa Merusak innerHTML)
const ADMIN_INTERACTIVE_BTN_SEL = 'button, .btn, .menu-item, .nav-item, .mobile-nav-item, .cs-subtab-btn, .filter-pill, .btn-icon-only, .neo-tier-btn, .mbanking-key-btn';

document.addEventListener('pointerdown', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(ADMIN_INTERACTIVE_BTN_SEL) : null;
    if (!btn || btn.disabled) return;
    btn.classList.add('btn-tap-pressed');
    setTimeout(() => {
        btn.classList.remove('btn-tap-pressed');
    }, 180);
}, { passive: true });

document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(ADMIN_INTERACTIVE_BTN_SEL) : null;
    if (!btn || btn.disabled) return;
    btn.classList.add('btn-working-indicator');
    setTimeout(() => {
        btn.classList.remove('btn-working-indicator');
    }, 480);
}, true);

// ============================================================================
// PEMBARUAN v28.9: RESET PIN ADMIN VIA KATA SANDI, PEMBERSIHAN TRANSAKSI MASSAL
// DENGAN SIMPAN STATISTIK USER & KEUANGAN, SERTA KELOLA RIWAYAT MEMBER PLUS
// ============================================================================

window.openAdminResetPinModal = function() {
    const passInp = document.getElementById('admin-reset-pin-password');
    const newInp = document.getElementById('admin-reset-pin-new');
    const confInp = document.getElementById('admin-reset-pin-confirm');
    if (passInp) passInp.value = '';
    if (newInp) newInp.value = '';
    if (confInp) confInp.value = '';
    window.openModal('modal-admin-reset-pin');
    setTimeout(() => passInp?.focus(), 100);
};

window.submitAdminResetPinWithPassword = async function() {
    if (!currentAdminUser || !currentAdminUser.email) {
        window.customAlert('Sesi Tidak Valid', 'Silakan login ulang sebagai Admin.', 'error');
        return;
    }
    const passVal = (document.getElementById('admin-reset-pin-password')?.value || '').trim();
    const newPin = (document.getElementById('admin-reset-pin-new')?.value || '').replace(/[^0-9]/g, '');
    const confPin = (document.getElementById('admin-reset-pin-confirm')?.value || '').replace(/[^0-9]/g, '');

    if (!passVal) {
        window.customAlert('Kata Sandi Kosong', 'Masukkan kata sandi login akun Admin Anda.', 'warning');
        return;
    }
    if (newPin.length !== 6) {
        window.customAlert('Format PIN Harus 6 Angka', 'PIN Transaksi Admin wajib terdiri dari 6 digit angka.', 'warning');
        return;
    }
    if (newPin !== confPin) {
        window.customAlert('Konfirmasi PIN Berbeda', 'Ketik ulang 6 digit PIN baru yang sama pada kolom konfirmasi.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-submit-admin-reset-pin');
    const ogHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi...';
    }

    try {
        await signInWithEmailAndPassword(auth, currentAdminUser.email, passVal);
        await setDoc(doc(db, pathSettings, 'mainConfig'), {
            adminSecurityPin: newPin,
            adminPinUpdatedAt: Date.now()
        }, { merge: true });
        siteSettings.adminSecurityPin = newPin;
        window.closeModal('modal-admin-reset-pin');
        window.populateSettingsForm();
        window.showToast('PIN Admin Diperbarui', 'PIN Transaksi Admin 6 digit baru berhasil diaktifkan.', 'success');
    } catch (err) {
        window.customAlert('Kata Sandi Salah', 'Kata sandi akun Admin yang Anda masukkan tidak sesuai.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = ogHtml;
        }
    }
};

window.adminDeleteSingleMemberPlusOrder = function(orderDbId) {
    const ord = orders.find(o => o.dbId === orderDbId);
    if (!ord) return;
    window.openConfirm(
        'Hapus Data Pesanan Langganan',
        `Hapus dokumen pesanan langganan <b>#${window.escapeHtml(ord.id)}</b> dari database? (Status Member Plus aktif pada akun pengguna tidak akan tercabut).`,
        async (confirmed) => {
            if (!confirmed) return;
            try {
                await deleteDoc(doc(db, pathOrders, orderDbId));
                window.showToast('Dihapus', `Data pesanan #${ord.id} berhasil dihapus.`, 'success');
                window.renderAdminMemberPlusOrders();
            } catch (e) {
                window.customAlert('Gagal', 'Tidak dapat menghapus data pesanan langganan.', 'error');
            }
        },
        'delete'
    );
};

window.adminCleanCancelledMemberPlusOrders = function() {
    const cancelledMp = orders.filter(o => {
        if (!o || !o.dbId) return false;
        const isMp = Boolean(o.isMemberPlusOrder === true || o.orderType === 'MEMBER_PLUS_SUB' || String(o.id || '').toUpperCase().startsWith('MPLUS-'));
        if (!isMp) return false;
        return o.status === 'CANCELLED' || o.status === 'FAILED' || o.status === 'EXPIRED' || o.status === 'UNPAID';
    });

    if (cancelledMp.length === 0) {
        window.customAlert('Sudah Bersih', 'Tidak ada data pesanan langganan Member Plus yang batal, gagal, atau kedaluwarsa.', 'info');
        return;
    }

    window.openConfirm(
        'Hapus Pesanan Member Plus Batal/Gagal',
        `Ditemukan <b>${cancelledMp.length} pesanan langganan Member Plus</b> berstatus Batal / Gagal / Kedaluwarsa. Hapus semuanya agar tidak memakan memori?`,
        async (confirmed) => {
            if (!confirmed) return;
            const progId = 'clean-mp-cancelled';
            window.showProgressToast(progId, 'Membersihkan Pesanan Batal', `Menghapus 0 / ${cancelledMp.length} data...`, 15);
            let delCount = 0;
            for (let i = 0; i < cancelledMp.length; i++) {
                await deleteDoc(doc(db, pathOrders, cancelledMp[i].dbId)).catch(() => {});
                delCount++;
                const pct = Math.min(98, Math.round(((i + 1) / cancelledMp.length) * 95));
                window.showProgressToast(progId, 'Membersihkan Pesanan Batal', `Menghapus ${delCount} / ${cancelledMp.length} data...`, pct);
            }
            window.finishProgressToast(progId, 'Berhasil Dibersihkan', `${delCount} data pesanan Member Plus batal/gagal dihapus.`, 'success');
            window.renderAdminMemberPlusOrders();
        },
        'delete'
    );
};

window.adminCleanAllMemberPlusOrderHistory = function() {
    const allMp = orders.filter(o => {
        if (!o || !o.dbId) return false;
        return Boolean(o.isMemberPlusOrder === true || o.orderType === 'MEMBER_PLUS_SUB' || String(o.id || '').toUpperCase().startsWith('MPLUS-'));
    });

    if (allMp.length === 0) {
        window.customAlert('Sudah Bersih', 'Belum ada riwayat pesanan langganan Member Plus untuk dibersihkan.', 'info');
        return;
    }

    window.openConfirm(
        'Bersihkan Seluruh Riwayat Pesanan Member Plus',
        `Hapus seluruh <b>${allMp.length} dokumen riwayat pesanan Member Plus</b>? (Masa aktif Member Plus yang sudah menempel di profil akun member tetap aman dan tidak berubah).`,
        async (confirmed) => {
            if (!confirmed) return;
            window.requestAdminPinVerification('Bersihkan Riwayat Pesanan Member Plus', async () => {
                const progId = 'clean-mp-all';
                window.showProgressToast(progId, 'Membersihkan Riwayat Member Plus', `Menghapus 0 / ${allMp.length} dokumen...`, 15);
                let delCount = 0;
                for (let i = 0; i < allMp.length; i++) {
                    await deleteDoc(doc(db, pathOrders, allMp[i].dbId)).catch(() => {});
                    delCount++;
                    const pct = Math.min(98, Math.round(((i + 1) / allMp.length) * 95));
                    window.showProgressToast(progId, 'Membersihkan Riwayat Member Plus', `Menghapus ${delCount} / ${allMp.length} dokumen...`, pct);
                }
                window.finishProgressToast(progId, 'Riwayat Dibersihkan', `${delCount} dokumen riwayat pesanan Member Plus telah dihapus.`, 'success');
                window.renderAdminMemberPlusOrders();
            });
        },
        'delete'
    );
};

window.openAdminPurgeAllTransactionsModal = function() {
    const passInp = document.getElementById('admin-purge-password-input');
    const summaryEl = document.getElementById('admin-purge-summary-stats');
    if (passInp) passInp.value = '';
    if (summaryEl) {
        const totalOrd = orders.length;
        const totalMut = recentMutationsList.length;
        const totalBalLogs = balanceLogsList.length;
        summaryEl.innerHTML = `
            <div>&bull; <b>${totalOrd} Dokumen Pesanan &amp; Struk</b> di koleksi <code>orders</code></div>
            <div>&bull; <b>${totalMut} Log Mutasi Pembayaran QRIS</b> di koleksi <code>payment_mutations</code></div>
            <div>&bull; <b>${totalBalLogs} Log Riwayat Mutasi Saldo</b> di koleksi <code>balance_logs</code></div>
        `;
    }
    window.openModal('modal-admin-purge-transactions');
    setTimeout(() => passInp?.focus(), 100);
};

window.executeAdminPurgeAllTransactionsWithPassword = async function() {
    if (!currentAdminUser || !currentAdminUser.email) {
        window.customAlert('Sesi Admin Tidak Valid', 'Silakan masuk ulang ke akun Admin.', 'error');
        return;
    }
    const passVal = (document.getElementById('admin-purge-password-input')?.value || '').trim();
    const includeBalLogs = Boolean(document.getElementById('admin-purge-include-bal-logs')?.checked);

    if (!passVal) {
        window.customAlert('Kata Sandi Diperlukan', 'Masukkan kata sandi login akun Admin Anda untuk menghapus seluruh data transaksi.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-confirm-admin-purge-trx');
    const ogHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi...';
    }

    try {
        // 1. Verifikasi Kata Sandi Login Admin ke Firebase Auth
        await signInWithEmailAndPassword(auth, currentAdminUser.email, passVal);
        window.closeModal('modal-admin-purge-transactions');

        const progId = 'admin-purge-all-trx';
        window.showProgressToast(progId, 'Menyimpan Statistik & Rekap', 'Mengamankan total belanja user & rekap penjualan Admin...', 12);

        // 2. Hitung & Akumulasikan Total Pesanan + Total Belanja ke masing-masing akun Member (users/{uid})
        const successOrders = orders.filter(o => o && o.status === 'SUCCESS');
        const userStatsDelta = new Map();

        let addIncome = 0;
        let addExpense = 0;
        let addNetProfit = 0;
        let addVipercellIncome = 0;
        let addDigiflazzIncome = 0;
        let addDigiflazzExpense = 0;
        let addSuccessCount = 0;

        successOrders.forEach(o => {
            const finRow = classifyOrderFinancialRow(o);
            addIncome += finRow.income;
            addExpense += finRow.expense;
            addNetProfit += finRow.netProfit;
            addSuccessCount += 1;
            if (finRow.sourceCode === 'DIGIFLAZZ') {
                addDigiflazzIncome += finRow.income;
                addDigiflazzExpense += finRow.expense;
            } else {
                addVipercellIncome += finRow.income;
            }

            const isTopup = Boolean(o.isTopupOrder === true || o.orderType === 'TOPUP_BALANCE');
            if (!isTopup) {
                let targetUid = o.userId || '';
                if (!targetUid && o.userEmail) {
                    const matchedUser = allUsersList.find(u => u.email && u.email.toLowerCase() === String(o.userEmail).toLowerCase());
                    if (matchedUser) targetUid = matchedUser.uid;
                }
                if (targetUid) {
                    const prev = userStatsDelta.get(targetUid) || { count: 0, spent: 0 };
                    prev.count += 1;
                    prev.spent += Math.round(Number(o.finalTotal || o.baseTotal || 0));
                    userStatsDelta.set(targetUid, prev);
                }
            }
        });

        // Simpan akumulasi statistik belanja ke setiap dokumen Member
        const userEntries = Array.from(userStatsDelta.entries());
        for (let i = 0; i < userEntries.length; i += 25) {
            const slice = userEntries.slice(i, i + 25);
            await Promise.all(slice.map(([uid, delta]) => {
                const uObj = allUsersList.find(u => u.uid === uid);
                if (!uObj || uObj.isAnonymous || uObj.isGuest) return Promise.resolve();
                const nextCnt = Math.max(0, Math.round(Number(uObj.preservedSuccessOrders || 0))) + delta.count;
                const nextSpent = Math.max(0, Math.round(Number(uObj.preservedTotalSpent || 0))) + delta.spent;
                uObj.preservedSuccessOrders = nextCnt;
                uObj.preservedTotalSpent = nextSpent;
                return setDoc(doc(db, pathUsers, uid), {
                    preservedSuccessOrders: nextCnt,
                    preservedTotalSpent: nextSpent,
                    updatedAt: Date.now()
                }, { merge: true }).catch(() => {});
            }));
        }

        // 3. Simpan akumulasi rekap keuangan ke settings/mainConfig agar laporan penjualan Admin tetap utuh
        const curArch = (siteSettings.archivedFinancialSummary && typeof siteSettings.archivedFinancialSummary === 'object')
            ? siteSettings.archivedFinancialSummary
            : {};
        const updatedArchivedSummary = {
            totalIncome: Math.max(0, Math.round(Number(curArch.totalIncome || 0))) + addIncome,
            totalExpense: Math.max(0, Math.round(Number(curArch.totalExpense || 0))) + addExpense,
            totalNetProfit: Math.max(0, Math.round(Number(curArch.totalNetProfit || 0))) + addNetProfit,
            vipercellIncome: Math.max(0, Math.round(Number(curArch.vipercellIncome || 0))) + addVipercellIncome,
            digiflazzIncome: Math.max(0, Math.round(Number(curArch.digiflazzIncome || 0))) + addDigiflazzIncome,
            digiflazzExpense: Math.max(0, Math.round(Number(curArch.digiflazzExpense || 0))) + addDigiflazzExpense,
            totalCount: Math.max(0, Math.round(Number(curArch.totalCount || 0))) + addSuccessCount,
            lastPurgedAt: Date.now()
        };
        await setDoc(doc(db, pathSettings, 'mainConfig'), {
            archivedFinancialSummary: updatedArchivedSummary
        }, { merge: true }).catch(() => {});
        siteSettings.archivedFinancialSummary = updatedArchivedSummary;

        // 4. Hapus seluruh dokumen pesanan/struk di koleksi orders
        const orderDocsToDelete = [...orders].filter(o => o && o.dbId);
        let deletedOrders = 0;
        for (let i = 0; i < orderDocsToDelete.length; i += 35) {
            const slice = orderDocsToDelete.slice(i, i + 35);
            await Promise.all(slice.map(o => deleteDoc(doc(db, pathOrders, o.dbId)).catch(() => {})));
            deletedOrders += slice.length;
            const pct = Math.min(80, 25 + Math.round((deletedOrders / Math.max(1, orderDocsToDelete.length)) * 55));
            window.showProgressToast(progId, 'Menghapus Data Pesanan & Struk', `${deletedOrders} / ${orderDocsToDelete.length} pesanan dihapus...`, pct);
        }

        // 5. Hapus seluruh dokumen mutasi QRIS di koleksi payment_mutations
        const mutSnap = await getDocs(collection(db, pathPaymentMutations)).catch(() => null);
        if (mutSnap && !mutSnap.empty) {
            const mutDocs = [];
            mutSnap.forEach(d => mutDocs.push(d.id));
            for (let i = 0; i < mutDocs.length; i += 35) {
                const slice = mutDocs.slice(i, i + 35);
                await Promise.all(slice.map(id => deleteDoc(doc(db, pathPaymentMutations, id)).catch(() => {})));
            }
        }

        // 6. Opsional: Hapus log mutasi saldo lama jika dicentang (Saldo akun di users/{uid} tetap utuh)
        if (includeBalLogs) {
            window.showProgressToast(progId, 'Membersihkan Log Mutasi', 'Menghapus riwayat log mutasi saldo lama...', 90);
            const balDocs = [...balanceLogsList].filter(l => l && l.dbId);
            for (let i = 0; i < balDocs.length; i += 35) {
                const slice = balDocs.slice(i, i + 35);
                await Promise.all(slice.map(l => deleteDoc(doc(db, pathBalanceLogs, l.dbId)).catch(() => {})));
            }
        }

        window.generateAdminReports();
        window.renderAdminOrders();
        window.renderAdminMembers();
        window.renderAdminBalanceTab();
        window.renderFinancialReportPanel();
        window.finishProgressToast(
            progId,
            'Database Transaksi Dibersihkan',
            `${deletedOrders} data pesanan & struk dihapus. Saldo akun, statistik belanja user, dan rekap penjualan Admin tetap tersimpan aman.`,
            'success'
        );
    } catch (err) {
        window.customAlert('Kata Sandi Salah / Gagal', 'Kata sandi akun Admin tidak sesuai atau terjadi gangguan jaringan.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = ogHtml;
        }
    }
};

// Jalankan Inisialisasi Panel Admin setelah seluruh fungsi dan variabel terdaftar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
    initAdminApp();
}