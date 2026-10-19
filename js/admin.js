/* ============================================================================
 * VIPERCELL V25.1 - ADMIN COMMAND CENTER ENGINE (FAST & UNIFIED GAS WEBHOOK READY)
 * Standar Arsitektur : Modular Feature Blocks ([FEATURE-01] s/d [FEATURE-13])
 * ============================================================================ */

import { 
    db, auth,
    signInWithEmailAndPassword, signOut, onAuthStateChanged,
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
const pathStocks = isWorkspace ? `artifacts/${appId}/public/data/stocks` : 'stocks';
const pathUsers = isWorkspace ? `artifacts/${appId}/public/data/users` : 'users';
const pathReviews = isWorkspace ? `artifacts/${appId}/public/data/reviews` : 'reviews';
const pathDeviceLocks = isWorkspace ? `artifacts/${appId}/public/data/device_locks` : 'device_locks';
const pathDeletedAccounts = isWorkspace ? `artifacts/${appId}/public/data/deleted_accounts` : 'deleted_accounts';
const pathMutations = isWorkspace ? `artifacts/${appId}/public/data/payment_mutations` : 'payment_mutations';

const fallbackSettingsPath = isWorkspace ? 'settings' : `artifacts/${appId}/public/data/settings`;

// ==========================================
// STATE & VARIABEL GLOBAL (ADMIN V25.0)
// ==========================================
let products = [];
let groupedBrands = []; 
let orders = [];
let promos = [];
let reviewsList = [];
let allLiveChats = [];
let allUsersList = [];
let deviceLocksMap = {};

let adminChatUnsubscribe = null; 
let isAdminListening = false;
let isPreloaderFinished = false;
let html5BarcodeScanner = null;
let subscriptionTickerInterval = null;
let preloaderSafetyTimer = null;

let siteSettings = { 
    logoText: 'VIPER',
    logoAccent: 'CELL',
    logoImgBase64: '',
    pwaIconBase64: '',
    marquee: 'Selamat Datang di Vipercell! Layanan Otomatis 24 Jam.',
    qrisStringData: '00020101021126670016COM.NOBUBANK.WWW011893600503000000000051440014ID.CO.QRIS.WWW0215ID10200210007070303UMI5204581253033605802ID5919VIPERCELL INDONESIA6005AMBON61059711662070703A016304',
    emailWebhookUrl: '',
    webhookSecret: 'VIPERCELL_SECRET_2026',
    adminWa: '085656321860',
    igLink: '',
    ttLink: '',
    newsList: [],
    banners: [],
    isStoreOpen: true,
    waChannelLink: '',
    deletedUids: [],
    blockedUids: [],
    blockedDevices: []
};

let currentAdminUser = null;
let isSettingsLoaded = false;
let currentGroupNominals = [];
let currentOrderFilter = 'ALL';
let currentAdminProdFilter = 'all';
let currentMemberFilter = 'ALL';
let isSoundEnabled = localStorage.getItem('vipercell_admin_sound') !== 'off';
let isAdminNotifEnabled = localStorage.getItem('vipercell_admin_notif') !== 'off';

let isInitialOrderLoad = true;
let isInitialChatLoad = true;
let previousOrdersData = {};
let previousChatMsgCount = {};
let processingAutoOrderIds = new Set();
let deductedStockOrderIds = new Set();
window.tempProcessStocks = []; 

/* ============================================================================
 * [FEATURE-01] ZERO-LEAK PRE-LOADER GATEKEEPER (ADMIN COMMAND CENTER)
 * ============================================================================ */
function updateAdminPreloaderStage(percent, statusText, subText = '') {
    const txtEl = document.getElementById('preloader-status-text');
    const fillEl = document.getElementById('preloader-bar-fill');
    const subEl = document.getElementById('preloader-stage-sub');

    if (txtEl && statusText) txtEl.innerText = statusText;
    if (fillEl) fillEl.style.width = `${Math.min(100, Math.max(10, percent))}%`;
    if (subEl && subText) subEl.innerText = subText;
}

function showAdminPreloaderRetry(reason) {
    const spinner = document.getElementById('preloader-spinner');
    const retryBox = document.getElementById('preloader-retry-box');
    const subEl = document.getElementById('preloader-stage-sub');
    if (spinner) spinner.style.display = 'none';
    if (subEl && reason) subEl.innerText = reason;
    if (retryBox) retryBox.style.display = 'block';
}

window.retryAdminPreloader = function() {
    const spinner = document.getElementById('preloader-spinner');
    const retryBox = document.getElementById('preloader-retry-box');
    if (spinner) spinner.style.display = 'block';
    if (retryBox) retryBox.style.display = 'none';
    initAdminApp();
};

function hideAdminPreloader() {
    if (preloaderSafetyTimer) {
        clearTimeout(preloaderSafetyTimer);
        preloaderSafetyTimer = null;
    }
    isPreloaderFinished = true;
    document.body.classList.remove('preloader-locked');
    document.body.classList.remove('no-scroll');

    // Jaminan Anti-Blank: Jika dashboard belum aktif saat preloader ditutup, wajib tampilkan layar login
    const dashEl = document.getElementById('admin-dashboard');
    const loginEl = document.getElementById('admin-login-screen');
    if (dashEl && loginEl) {
        const isDashVisible = dashEl.style.display === 'flex' || dashEl.style.display === 'block';
        if (!isDashVisible && !currentAdminUser) {
            loginEl.style.display = 'flex';
        }
    }

    const loader = document.getElementById('app-preloader-overlay');
    if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 250);
    }
}
/* ======================== END OF [FEATURE-01] ============================= */

// ==========================================
// UTILITAS KEAMANAN TEKS, SUARA & NOTIFIKASI PWA
// ==========================================
window.escapeHtml = function(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

function escapeJsStr(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function playNotificationSound(type = 'order') {
    if (!isSoundEnabled) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        if (type === 'order') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880, now + 0.12);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.45);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, now);
            osc.frequency.setValueAtTime(783.99, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        }
    } catch (e) {}
}

window.toggleSoundAlert = function() {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('vipercell_admin_sound', isSoundEnabled ? 'on' : 'off');
    updateSoundIconUI();
    if (isSoundEnabled) {
        playNotificationSound('chat');
        window.showToast('Suara Aktif', 'Notifikasi suara pesanan & chat diaktifkan.', 'success');
    } else {
        window.showToast('Suara Dimatikan', 'Notifikasi suara telah dibisukan.', 'info');
    }
};

function updateSoundIconUI() {
    const icon = document.getElementById('admin-sound-icon');
    const btn = document.getElementById('btn-sound-toggle');
    if (icon) icon.className = isSoundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    if (btn) {
        btn.style.background = isSoundEnabled ? 'rgba(37, 99, 235, 0.15)' : 'var(--surface)';
        btn.style.color = isSoundEnabled ? 'var(--primary-light)' : 'var(--text-muted)';
    }
}

function updateAdminNotifToggleUI() {
    const statusText = document.getElementById('set-admin-notif-status');
    const btn = document.getElementById('btn-set-admin-notif');
    const icon = document.getElementById('set-admin-bell-icon');
    if (!statusText || !btn || !icon) return;

    const granted = ('Notification' in window) && Notification.permission === 'granted';
    const isActive = isAdminNotifEnabled && granted;

    if (isActive) {
        statusText.innerText = 'Status: Aktif (Menerima Push Notifikasi)';
        statusText.className = 'text-success text-xs fw-bold';
        btn.innerText = 'Matikan';
        btn.className = 'btn btn-sm btn-danger';
        icon.className = 'fa-solid fa-bell text-success';
    } else {
        statusText.innerText = isAdminNotifEnabled ? 'Status: Belum diizinkan browser' : 'Status: Dinonaktifkan';
        statusText.className = 'text-muted text-xs';
        btn.innerText = 'Aktifkan';
        btn.className = 'btn btn-sm btn-primary';
        icon.className = 'fa-regular fa-bell-slash text-muted';
    }
}

window.toggleAdminNotificationSetting = async function() {
    if (!('Notification' in window)) {
        window.customAlert('Tidak Didukung', 'Browser perangkat ini belum mendukung notifikasi sistem.', 'warning');
        return;
    }
    const granted = Notification.permission === 'granted';
    if (isAdminNotifEnabled && granted) {
        isAdminNotifEnabled = false;
        localStorage.setItem('vipercell_admin_notif', 'off');
        updateAdminNotifToggleUI();
        window.showToast('Notifikasi Dimatikan', 'Push notifikasi sistem telah dinonaktifkan.', 'info');
        return;
    }

    if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
            updateAdminNotifToggleUI();
            return;
        }
    } else if (Notification.permission === 'denied') {
        window.customAlert('Izin Diblokir', 'Ubah izin Notifikasi situs menjadi "Izinkan" pada pengaturan browser kamu.', 'warning');
        return;
    }

    isAdminNotifEnabled = true;
    localStorage.setItem('vipercell_admin_notif', 'on');
    updateAdminNotifToggleUI();
    sendAdminNativeNotification('Vipercell Admin V25 Aktif!', 'Notifikasi pesanan, durasi langganan & chat siap dikirim.');
    window.showToast('Notifikasi Aktif', 'Push notifikasi sistem telah diaktifkan.', 'success');
};

function sendAdminNativeNotification(title, bodyText) {
    if (!isAdminNotifEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const iconUrl = siteSettings.pwaIconBase64 || siteSettings.logoImgBase64 || 'icon-192.png';
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, { body: bodyText, icon: iconUrl, vibrate: [200, 100, 200] });
        }).catch(() => {
            try { new Notification(title, { body: bodyText, icon: iconUrl }); } catch (e) {}
        });
    } else {
        try { new Notification(title, { body: bodyText, icon: iconUrl }); } catch (e) {}
    }
}

let adminManifestBlobUrl = null;
function applyAdminCustomPwaIcon() {
    const customIcon = siteSettings.pwaIconBase64 || siteSettings.logoImgBase64;
    if (!customIcon) return;

    const fav = document.getElementById('admin-favicon');
    const apple = document.getElementById('admin-apple-icon');
    const promptLogo = document.getElementById('admin-pwa-prompt-logo');
    const promptFallback = document.getElementById('admin-pwa-prompt-fallback');

    if (fav) fav.href = customIcon;
    if (apple) apple.href = customIcon;
    if (promptLogo) {
        promptLogo.src = customIcon;
        promptLogo.style.display = 'block';
        if (promptFallback) promptFallback.style.display = 'none';
    }

    try {
        const manifestObj = {
            id: "/",
            name: `${siteSettings.logoText || 'Viper'}${siteSettings.logoAccent || 'cell'} Admin Center V25`,
            short_name: `ViperAdmin`,
            description: "Admin Command Center Vipercell V25.0",
            start_url: window.location.origin + window.location.pathname,
            scope: window.location.origin + "/",
            display: "standalone",
            background_color: "#090d16",
            theme_color: "#2563eb",
            orientation: "any",
            icons: [
                {
                    src: customIcon,
                    sizes: "192x192",
                    type: customIcon.startsWith('data:image/webp') ? "image/webp" : "image/png",
                    purpose: "any"
                },
                {
                    src: customIcon,
                    sizes: "512x512",
                    type: customIcon.startsWith('data:image/webp') ? "image/webp" : "image/png",
                    purpose: "maskable"
                }
            ]
        };
        if (adminManifestBlobUrl) URL.revokeObjectURL(adminManifestBlobUrl);
        const blob = new Blob([JSON.stringify(manifestObj)], { type: 'application/json' });
        adminManifestBlobUrl = URL.createObjectURL(blob);
        const link = document.getElementById('admin-pwa-manifest');
        if (link) link.setAttribute('href', adminManifestBlobUrl);
    } catch (e) {}
}

window.copyTextToClipboard = function(text, label = 'Data') {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        window.showToast('Tersalin', `${label} berhasil disalin ke papan klip!`, 'success');
    });
};

/* ============================================================================
 * [FEATURE-07 & FEATURE-13] EMVCo TAG 59 MERCHANT EXTRACTOR &
 * UNIFIED GAS WEBHOOK CALLER + MACRODROID SIMULATOR
 * ============================================================================ */
function extractMerchantInfoFromQris(qrisString) {
    if (!qrisString || typeof qrisString !== 'string' || !qrisString.trim().startsWith('000201')) {
        return { merchantName: 'FORMAT QRIS BELUM VALID', merchantCity: '' };
    }
    const raw = qrisString.trim();
    let index = 0;
    let merchantName = 'VIPERCELL STORE';
    let merchantCity = '';

    while (index < raw.length - 4) {
        const tag = raw.substring(index, index + 2);
        const length = parseInt(raw.substring(index + 2, index + 4), 10);
        if (isNaN(length) || length <= 0 || index + 4 + length > raw.length) break;

        const value = raw.substring(index + 4, index + 4 + length);
        if (tag === '59' && value.trim()) merchantName = value.trim();
        if (tag === '60' && value.trim()) merchantCity = value.trim();
        if (tag === '63') break;
        index += 4 + length;
    }
    return { merchantName, merchantCity };
}

window.previewQrisMerchantTag59 = function() {
    const rawQris = document.getElementById('set-qris-string')?.value || '';
    const previewEl = document.getElementById('detected-qris-merchant-text');
    const boxEl = document.getElementById('qris-merchant-detected-preview');
    if (!previewEl) return;

    if (!rawQris.trim()) {
        previewEl.innerText = 'Belum ada string QRIS';
        if (boxEl) boxEl.className = 'info-box bg-warning-light border-warning mt-2 text-xs fw-bold text-warning';
        return;
    }

    const { merchantName, merchantCity } = extractMerchantInfoFromQris(rawQris);
    previewEl.innerText = merchantCity ? `${merchantName} (${merchantCity})` : merchantName;
    if (boxEl) {
        boxEl.className = merchantName === 'FORMAT QRIS BELUM VALID'
            ? 'info-box bg-danger-light border-danger mt-2 text-xs fw-bold text-danger'
            : 'info-box bg-success-light border-success mt-2 text-xs fw-bold text-success';
    }
};

function getActiveWebhookSecret() {
    const secretInp = document.getElementById('set-webhook-secret')?.value.trim();
    return secretInp || (siteSettings.webhookSecret || 'VIPERCELL_SECRET_2026').trim();
}

async function callUnifiedGasWebhook(payloadObj) {
    const inputUrl = document.getElementById('set-email-webhook')?.value.trim();
    const gasWebAppUrl = inputUrl || (siteSettings.emailWebhookUrl || '').trim();
    const activeSecret = getActiveWebhookSecret();

    if (!gasWebAppUrl || !gasWebAppUrl.startsWith('https://script.google.com/')) {
        throw new Error('URL Google Apps Script Webhook belum diatur atau tidak valid.');
    }

    const startTime = Date.now();
    const response = await fetch(gasWebAppUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
            projectId: 'vipercell-fc50e',
            secret: activeSecret,
            key: activeSecret,
            timestamp: startTime,
            ...payloadObj
        }),
        redirect: 'follow'
    });

    const rawText = await response.text();
    let result = null;
    try {
        result = JSON.parse(rawText);
    } catch (parseErr) {
        throw new Error('Respons GAS bukan JSON valid. Pastikan Web App di-deploy dengan akses "Siapa saja (Anyone)".');
    }

    if (!result || (result.ok === false && result.status !== 'ok')) {
        throw new Error((result && result.message) || (result && result.error) || 'Gagal menghubungi server GAS Webhook.');
    }
    if (result.executionMs === undefined) {
        result.executionMs = Date.now() - startTime;
    }
    return result;
}

async function triggerAutomatedEmailWebhook(orderData, replyMessage, customAction = 'SEND_ORDER_DELIVERY') {
    const buyerEmail = (orderData.userEmail || orderData.buyerEmail || '').trim();
    const inputUrl = document.getElementById('set-email-webhook')?.value.trim();
    const gasUrl = inputUrl || (siteSettings.emailWebhookUrl || '').trim();
    if (!gasUrl || !buyerEmail || !buyerEmail.includes('@')) return false;

    const itemObj = (orderData.items && orderData.items[0]) ? orderData.items[0] : {};
    const durDays = parseInt(orderData.durationDays || itemObj.durationDays || 0, 10);

    try {
        await callUnifiedGasWebhook({
            action: customAction,
            email: buyerEmail,
            to: buyerEmail,
            orderId: orderData.id,
            invoiceId: orderData.id,
            buyerName: orderData.buyerName || buyerEmail.split('@')[0],
            productName: itemObj.brandName || orderData.productName || 'Produk Digital',
            variantName: itemObj.exactItemName || orderData.variantName || itemObj.name || '-',
            itemName: itemObj.name || 'Layanan Digital Vipercell',
            totalAmount: orderData.finalTotal || 0,
            uniqueTotal: orderData.finalTotal || 0,
            totalFormatted: `Rp${(orderData.finalTotal || 0).toLocaleString('id-ID')}`,
            targetId: itemObj.playerInfo || orderData.targetId || '-',
            accountDetails: replyMessage || orderData.adminReply || 'Pesanan selesai diproses.',
            durationDays: durDays,
            subscriptionEndAt: orderData.subscriptionEndAt || 0
        });
        return true;
    } catch (e) {
        console.warn("Webhook Email Warning:", e.message);
        return false;
    }
}

window.copyMacroDroidJsonTemplate = function(bracketMode = 'curly') {
    const activeSecret = getActiveWebhookSecret();
    const template = bracketMode === 'square'
        ? `{\n  "secret": "${activeSecret}",\n  "projectId": "vipercell-fc50e",\n  "app": "[not_app_name]",\n  "title": "[not_title]",\n  "text": "[not_text]",\n  "big_text": "[not_big_text]"\n}`
        : `{\n  "secret": "${activeSecret}",\n  "projectId": "vipercell-fc50e",\n  "app": "{not_app_name}",\n  "title": "{not_title}",\n  "text": "{not_text}",\n  "big_text": "{not_big_text}"\n}`;

    navigator.clipboard.writeText(template).then(() => {
        window.showToast('Template JSON Disalin', `Template MacroDroid dengan secret "${activeSecret}" berhasil disalin!`, 'success');
    });
};

window.pingUnifiedGasWebhook = async function() {
    const outEl = document.getElementById('webhook-diagnostic-output');
    if (outEl) {
        outEl.style.display = 'block';
        outEl.className = 'mt-2 text-xs fw-bold text-primary';
        outEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menghubungi server Google Apps Script & memvalidasi Secret...`;
    }
    try {
        const res = await callUnifiedGasWebhook({ action: 'PING_TEST' });
        const quota = res.remainingEmailQuota !== undefined ? res.remainingEmailQuota : 'Aktif';
        if (outEl) {
            outEl.className = 'mt-2 text-xs fw-bold text-success';
            outEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Terhubung & Secret Valid! Sisa Kuota Email Harian GAS: <b>${quota} Email</b> (${res.executionMs || 0}ms)`;
        }
        window.showToast('Koneksi GAS Aktif', `Sisa kuota pengiriman email hari ini: ${quota}`, 'success');
    } catch (err) {
        if (outEl) {
            outEl.className = 'mt-2 text-xs fw-bold text-danger';
            outEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Gagal: ${window.escapeHtml(err.message)}`;
        }
        window.customAlert('Koneksi Webhook Gagal', err.message, 'error');
    }
};

window.simulateMacroDroidPaymentFromAdmin = async function() {
    const amountInp = document.getElementById('sim-payment-amount');
    const amountVal = parseInt(amountInp?.value || '0', 10);
    if (!amountVal || amountVal < 500) {
        window.customAlert('Nominal Tidak Valid', 'Masukkan angka nominal unik pembayaran yang ingin disimulasikan (contoh: 25142).', 'warning');
        return;
    }

    const btn = document.getElementById('btn-sim-payment');
    const ogHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    }

    try {
        const nowMs = Date.now();
        // 1. Tulis ke Firestore payment_mutations & settings/mainConfig agar listener langsung menangkap
        await addDoc(collection(db, pathMutations), {
            amount: amountVal,
            appName: 'SIMULATOR_ADMIN_V25',
            rawText: `Simulasi Pembayaran QRIS sebesar Rp ${amountVal.toLocaleString('id-ID')}`,
            createdAt: nowMs,
            timestamp: nowMs,
            isSimulation: true
        }).catch(() => {});

        await setDoc(doc(db, pathSettings, 'mainConfig'), {
            lastPaymentDetected: amountVal,
            lastPaymentTimestamp: nowMs,
            lastPaymentApp: 'SIMULATOR_ADMIN_V25'
        }, { merge: true }).catch(() => {});

        // 2. Cari pesanan UNPAID / PENDING_PAYMENT yang cocok di memori Admin dan lunaskan
        const matchedOrd = orders.find(o =>
            (o.status === 'UNPAID' || o.status === 'PENDING_PAYMENT') &&
            (Number(o.finalTotal) === amountVal || Number(o.uniqueTotal) === amountVal)
        );
        if (matchedOrd) {
            await updateDoc(doc(db, pathOrders, matchedOrd.dbId), {
                status: 'SUCCESS',
                paidAt: nowMs,
                paymentVerifiedBy: 'ADMIN_SIMULATOR_V25'
            });
        }

        // 3. Jika URL GAS Webhook terpasang, tembak juga ke GAS
        const gasUrl = document.getElementById('set-email-webhook')?.value.trim() || siteSettings.emailWebhookUrl;
        if (gasUrl && gasUrl.startsWith('https://script.google.com/')) {
            await callUnifiedGasWebhook({
                action: 'SIMULATE_MACRODROID',
                isSimulation: true,
                forceTest: true,
                app: 'SIMULATOR_ADMIN_V25.1',
                title: 'Pembayaran QRIS Diterima',
                text: `Pembayaran QRIS sebesar Rp ${amountVal.toLocaleString('id-ID')} berhasil diterima`,
                amount: amountVal
            }).catch(() => {});
        }

        if (matchedOrd) {
            window.showToast('Auto-Match Berhasil! 🎉', `Pesanan #${matchedOrd.id} (Rp${amountVal.toLocaleString('id-ID')}) otomatis LUNAS!`, 'success');
        } else {
            window.showToast('Sinyal Mutasi Dikirim', `Mutasi Rp${amountVal.toLocaleString('id-ID')} berhasil ditembakkan ke sistem.`, 'info');
        }
    } catch (err) {
        window.customAlert('Gagal Simulasi', err.message, 'error');
    } finally {
        if (btn && ogHtml) {
            btn.disabled = false;
            btn.innerHTML = ogHtml;
        }
    }
};

window.testSendOtpFromAdmin = async function() {
    const emailInp = document.getElementById('sim-test-email');
    const targetEmail = (emailInp?.value || '').trim();
    if (!targetEmail || !targetEmail.includes('@')) {
        window.customAlert('Email Kosong', 'Masukkan alamat email tujuan untuk menguji pengiriman OTP.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-sim-email');
    const ogHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    }

    try {
        const testOtp = String(Math.floor(100000 + Math.random() * 900000));
        await callUnifiedGasWebhook({
            action: 'SEND_OTP_EMAIL',
            email: targetEmail,
            to: targetEmail,
            otpCode: testOtp,
            otp: testOtp,
            userName: 'Tester Admin Vipercell',
            expiryMinutes: 5
        });
        window.customAlert('Tes Email OTP Berhasil!', `Kode OTP uji coba (<b>${testOtp}</b>) berhasil dikirim ke <b>${window.escapeHtml(targetEmail)}</b>.`, 'success');
    } catch (err) {
        window.customAlert('Gagal Mengirim Email', err.message, 'error');
    } finally {
        if (btn && ogHtml) {
            btn.disabled = false;
            btn.innerHTML = ogHtml;
        }
    }
};
/* ======================== END OF [FEATURE-07 & 13] ======================== */

// ==========================================
// POP-UP NOTIFIKASI TENGAH + SWIPE TO DISMISS
// ==========================================
window.showToast = function(title, msg, type = 'info', actionCallback = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    let icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : (type === 'error' ? '<i class="fa-solid fa-circle-xmark"></i>' : (type === 'warning' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-bolt"></i>'));
    const hintText = actionCallback ? 'Ketuk untuk buka &bull; Geser untuk tutup' : 'Geser ke kiri/kanan untuk tutup';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <h4>${window.escapeHtml(title)}</h4>
            <p>${window.escapeHtml(msg)}</p>
            <span class="toast-swipe-hint">${hintText}</span>
        </div>
    `;

    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let autoRemoveTimer = null;

    const dismissToast = (dir = 1) => {
        if (autoRemoveTimer) clearTimeout(autoRemoveTimer);
        toast.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
        toast.style.transform = `translateX(${dir * 120}%)`;
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 220);
    };

    const onDragStart = (clientX) => {
        startX = clientX;
        currentX = 0;
        isDragging = true;
        toast.style.transition = 'none';
    };

    const onDragMove = (clientX) => {
        if (!isDragging) return;
        currentX = clientX - startX;
        toast.style.transform = `translateX(${currentX}px)`;
        toast.style.opacity = String(Math.max(0.2, 1 - Math.abs(currentX) / 180));
    };

    const onDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        if (Math.abs(currentX) > 65) {
            dismissToast(currentX > 0 ? 1 : -1);
        } else {
            toast.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
            toast.style.transform = 'translateY(0) translateX(0)';
            toast.style.opacity = '1';
            if (Math.abs(currentX) < 10 && actionCallback) {
                actionCallback();
                dismissToast(1);
            }
        }
    };

    toast.addEventListener('touchstart', (e) => onDragStart(e.touches[0].clientX), { passive: true });
    toast.addEventListener('touchmove', (e) => onDragMove(e.touches[0].clientX), { passive: true });
    toast.addEventListener('touchend', onDragEnd);

    toast.addEventListener('mousedown', (e) => onDragStart(e.clientX));
    window.addEventListener('mousemove', (e) => { if (isDragging) onDragMove(e.clientX); });
    window.addEventListener('mouseup', () => { if (isDragging) onDragEnd(); });

    toast.style.cursor = actionCallback ? 'pointer' : 'grab';
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 15);
    autoRemoveTimer = setTimeout(() => {
        if (document.body.contains(toast)) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }
    }, 4800);
};

// ==========================================
// UTILITAS UMUM & TEMA
// ==========================================
window.resizeImageBase64 = function(file, callback, maxWidth, maxHeight) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            if (h > maxHeight) { w = Math.round(w * maxHeight / h); h = maxHeight; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/webp', 0.8)); 
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.toggleTheme = function() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('vipercell_theme', newTheme);
    const icon = document.getElementById('admin-theme-icon');
    if (icon) icon.className = newTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    const metaTheme = document.getElementById('meta-theme-color');
    if (metaTheme) metaTheme.setAttribute('content', newTheme === 'dark' ? '#090d16' : '#ffffff');
};

window.openModal = (id) => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); document.body.classList.add('no-scroll'); }
};
window.closeModal = (id) => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('active'); document.body.classList.remove('no-scroll'); }
};

window.customAlert = (title, message, type = 'info') => {
    const titleEl = document.getElementById('ca-title');
    const descEl = document.getElementById('ca-desc');
    const iconEl = document.getElementById('ca-icon');
    const extraEl = document.getElementById('ca-extra-action');
    const alertEl = document.getElementById('custom-alert');
    
    if (titleEl) titleEl.innerText = title;
    if (descEl) descEl.innerHTML = message;
    if (extraEl) extraEl.innerHTML = '';
    if (iconEl) {
        iconEl.className = `msg-icon ${type}`;
        if (type === 'success') iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        else if (type === 'error') iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        else if (type === 'warning') iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        else iconEl.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
    }
    if (alertEl) alertEl.classList.add('active');
    document.body.classList.add('no-scroll');
};

window.closeAlert = () => {
    const alertEl = document.getElementById('custom-alert');
    const extraEl = document.getElementById('ca-extra-action');
    if (alertEl) alertEl.classList.remove('active');
    if (extraEl) extraEl.innerHTML = '';
    document.body.classList.remove('no-scroll');
};

let promptCallback = null;
window.openConfirm = function(title, message, callback, actionType = 'warning') {
    const titleEl = document.getElementById('mc-title');
    const descEl = document.getElementById('mc-desc');
    const iconContainer = document.getElementById('mc-icon-container');
    const confirmBtn = document.getElementById('mc-confirm-btn');
    
    if (titleEl) titleEl.innerText = title;
    if (descEl) descEl.innerHTML = message;
    promptCallback = callback;
    
    if (iconContainer && confirmBtn) {
        if (actionType === 'delete') {
            iconContainer.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            iconContainer.style.background = 'rgba(239, 68, 68, 0.15)';
            iconContainer.style.color = '#ef4444';
            confirmBtn.className = 'btn btn-danger flex-1';
        } else if (actionType === 'success') {
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            iconContainer.style.background = 'rgba(16, 185, 129, 0.15)';
            iconContainer.style.color = '#10b981';
            confirmBtn.className = 'btn btn-success flex-1';
        } else {
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
            iconContainer.style.background = 'rgba(37, 99, 235, 0.15)';
            iconContainer.style.color = 'var(--primary-light)';
            confirmBtn.className = 'btn btn-primary flex-1';
        }
    }
    window.openModal('modal-confirm');
};

window.resolveConfirm = function(isConfirmed) {
    window.closeModal('modal-confirm');
    if (promptCallback) promptCallback(isConfirmed);
};

window.switchAdminTab = function(tabId, btnEl) {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
    if (btnEl) btnEl.classList.add('active');
    const targetEl = document.getElementById(tabId);
    if (targetEl) targetEl.style.display = 'block';
    
    const titleText = btnEl && btnEl.querySelector('span') ? btnEl.querySelector('span').innerText : 'Command Center';
    const pageTitle = document.getElementById('admin-page-title');
    if (pageTitle) pageTitle.innerText = titleText;
    
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('admin-sidebar');
        if (sidebar) sidebar.classList.remove('active');
    }
};

window.switchAdminTabByName = function(tabId) {
    const btn = document.querySelector(`.admin-tab[data-tab="${tabId}"]`);
    window.switchAdminTab(tabId, btn);
};

window.jumpToPendingOrders = function() {
    window.switchAdminTabByName('tab-orders');
    const pillNeedAction = document.querySelector('#tab-orders .filter-pill[data-ofilter="NEED_ACTION"]');
    window.setAdminOrderFilter('NEED_ACTION', pillNeedAction);
};

window.jumpToExpiredSubscriptions = function() {
    window.switchAdminTabByName('tab-orders');
    const pillSubExp = document.querySelector('#tab-orders .filter-pill[data-ofilter="SUB_EXPIRED"]');
    window.setAdminOrderFilter('SUB_EXPIRED', pillSubExp);
};

// ==========================================
// AUTHENTICATION KHUSUS EMAIL & PASSWORD (ANTI-HANG V25.2)
// ==========================================
let isVerifyingAdmin = false;

async function verifyAdminAccess(user) {
    if (!user || isVerifyingAdmin) return;
    isVerifyingAdmin = true;
    try {
        updateAdminPreloaderStage(55, 'Sedang memuat data...', 'Memverifikasi otoritas administrator...');
        let role = 'user';
        const allowedEmails = [
            'vipercell.id@gmail.com',
            'viperdev4@gmail.com',
            'millertipak63@gmail.com',
            'vipercell@bot.id'
        ];
        const cleanEmail = (user.email || '').trim().toLowerCase();

        if (allowedEmails.includes(cleanEmail)) {
            role = 'superadmin';
        } else {
            // Gunakan Promise.race dengan batas waktu 3.5 detik agar getDoc tidak pernah macet selamanya
            const userDoc = await Promise.race([
                getDoc(doc(db, pathUsers, user.uid)),
                new Promise((resolve) => setTimeout(() => resolve(null), 3500))
            ]).catch(() => null);

            if (userDoc && typeof userDoc.exists === 'function' && userDoc.exists() && userDoc.data().role) {
                role = userDoc.data().role;
            }
        }

        if (role === 'admin' || role === 'superadmin') {
            currentAdminUser = user;
            const loginScreen = document.getElementById('admin-login-screen');
            const dashScreen = document.getElementById('admin-dashboard');
            if (loginScreen) loginScreen.style.display = 'none';
            if (dashScreen) dashScreen.style.display = 'flex';

            const emailLbl = document.getElementById('admin-logged-email');
            if (emailLbl) emailLbl.innerText = user.email || 'Otoritas Penuh';

            updateSoundIconUI();
            updateAdminNotifToggleUI();
            updateAdminPreloaderStage(85, 'Sedang memuat data...', 'Menghubungkan data pesanan & gudang stok...');
            listenAdminData();
            startAdminSubscriptionLiveTicker();
            updateAdminPreloaderStage(100, 'Siap!', 'Membuka Command Center...');
            resetLoginButtons();
            setTimeout(hideAdminPreloader, 120);
        } else {
            currentAdminUser = null;
            await signOut(auth).catch(() => {});
            const loginScreen = document.getElementById('admin-login-screen');
            const dashScreen = document.getElementById('admin-dashboard');
            if (loginScreen) loginScreen.style.display = 'flex';
            if (dashScreen) dashScreen.style.display = 'none';
            hideAdminPreloader();
            window.customAlert('Akses Ditolak', `Akun <b>${window.escapeHtml(user.email || '')}</b> tidak memiliki otoritas Administrator Vipercell.`, 'error');
            resetLoginButtons();
        }
    } catch (err) {
        console.error("Verify Admin Error:", err);
        const loginScreen = document.getElementById('admin-login-screen');
        if (loginScreen) loginScreen.style.display = 'flex';
        hideAdminPreloader();
        resetLoginButtons();
    } finally {
        isVerifyingAdmin = false;
    }
}

function resetLoginButtons() {
    const btn = document.getElementById('btn-admin-login');
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> <span>Masuk ke Command Center</span>'; btn.disabled = false; }
}

window.processAdminLogin = async function() {
    const em = document.getElementById('admin-email').value.trim();
    const pw = document.getElementById('admin-pass').value.trim();
    if (!em || !pw) { window.customAlert('Data Kosong', 'Email dan Kata Sandi Administrator wajib diisi!', 'warning'); return; }
    
    const btn = document.getElementById('btn-admin-login');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memverifikasi Otoritas...</span>'; 
    btn.disabled = true;
    
    try {
        const cred = await signInWithEmailAndPassword(auth, em, pw);
        if (cred && cred.user) {
            await verifyAdminAccess(cred.user);
        }
    } catch (e) {
        console.error("Admin Login Error:", e);
        window.customAlert('Akses Ditolak', 'Email atau kata sandi administrator salah, atau periksa koneksi internet Anda.', 'error');
        resetLoginButtons();
    }
};

window.logoutAdmin = async function() {
    currentAdminUser = null;
    await signOut(auth).catch(() => {});
    window.location.reload();
};

async function initAdminApp() {
    const savedTheme = localStorage.getItem('vipercell_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = document.getElementById('admin-theme-icon');
    if (icon) icon.className = savedTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';

    if (!navigator.onLine) {
        updateAdminPreloaderStage(20, 'Koneksi Terputus', 'Periksa sambungan internet Anda.');
        showAdminPreloaderRetry('Perangkat sedang offline.');
        return;
    }

    updateAdminPreloaderStage(30, 'Sedang memuat data...', 'Memeriksa sesi keamanan...');

    // Timer Pengaman Cepat (4.5 Detik): Mencegah loading berputar selamanya jika IndexedDB/Auth lambat
    if (preloaderSafetyTimer) clearTimeout(preloaderSafetyTimer);
    preloaderSafetyTimer = setTimeout(() => {
        if (!isPreloaderFinished) {
            if (auth.currentUser && !auth.currentUser.isAnonymous) {
                verifyAdminAccess(auth.currentUser);
            } else {
                const loginScreen = document.getElementById('admin-login-screen');
                const dashScreen = document.getElementById('admin-dashboard');
                if (loginScreen && (!dashScreen || dashScreen.style.display !== 'flex')) {
                    loginScreen.style.display = 'flex';
                }
                resetLoginButtons();
                hideAdminPreloader();
            }
        }
    }, 4500);

    // Jangan gunakan "await setPersistence" secara blocking karena sudah dijalankan di firebase.js
    // dan dapat menyebabkan deadlock IndexedDB pada browser mobile / PWA.
    setPersistence(auth, browserLocalPersistence).catch(() => {});

    onAuthStateChanged(auth, async (user) => {
        if (user && !user.isAnonymous) {
            await verifyAdminAccess(user);
        } else {
            if (user && user.isAnonymous) {
                signOut(auth).catch(() => {});
            }
            if (!currentAdminUser) {
                const loginScreen = document.getElementById('admin-login-screen');
                const dashScreen = document.getElementById('admin-dashboard');
                if (loginScreen) loginScreen.style.display = 'flex';
                if (dashScreen) dashScreen.style.display = 'none';
                resetLoginButtons();
                hideAdminPreloader();
            }
        }
    }, (authErr) => {
        console.warn("onAuthStateChanged Error:", authErr);
        const loginScreen = document.getElementById('admin-login-screen');
        if (loginScreen) loginScreen.style.display = 'flex';
        resetLoginButtons();
        hideAdminPreloader();
    });

    window.addEventListener('resize', () => {
        const mainPanel = document.getElementById('admin-chat-main-panel');
        const sidePanel = document.getElementById('admin-chat-sidebar-panel');
        if (!mainPanel || !sidePanel) return;

        if (window.innerWidth > 768) {
            sidePanel.style.display = 'flex';
            mainPanel.style.display = 'flex';
            mainPanel.style.transform = 'none';
        } else {
            const activeId = document.getElementById('admin-active-chat-id-desk')?.value;
            if (activeId) {
                sidePanel.style.display = 'none';
                mainPanel.style.display = 'flex';
            } else {
                sidePanel.style.display = 'flex';
                mainPanel.style.display = 'none';
            }
        }
    });
}

// ==========================================
// DATA LISTENERS REAL-TIME
// ==========================================
function mergeValidSettings(target, source) {
    if (!source) return target;
    const result = { ...target };
    Object.keys(source).forEach(key => {
        const val = source[key];
        if (val !== undefined && val !== null) {
            if (typeof val === 'string' && val.trim() === '' && ['logoText', 'logoAccent', 'qrisStringData', 'adminWa', 'webhookSecret'].includes(key) && result[key]) {
                return;
            }
            result[key] = val;
        }
    });
    return result;
}

function listenAdminData() {
    if (isAdminListening) return;
    isAdminListening = true;

    const cachedSettings = localStorage.getItem('vipercell_settings_backup');
    if (cachedSettings) {
        try { siteSettings = mergeValidSettings(siteSettings, JSON.parse(cachedSettings)); } catch (e) {}
    }

    // 1. SETTINGS
    onSnapshot(doc(db, pathSettings, 'mainConfig'), async (docSnap) => {
        if (docSnap.exists()) {
            const dbData = docSnap.data();
            siteSettings = mergeValidSettings(siteSettings, dbData);
            
            if (!dbData.logoImgBase64 && (!dbData.banners || dbData.banners.length === 0)) {
                try {
                    const fallbackSnap = await getDoc(doc(db, fallbackSettingsPath, 'mainConfig'));
                    if (fallbackSnap.exists()) {
                        siteSettings = mergeValidSettings(siteSettings, fallbackSnap.data());
                    }
                } catch (err) {}
            }
            localStorage.setItem('vipercell_settings_backup', JSON.stringify(siteSettings));
        } else {
            try {
                const fallbackSnap = await getDoc(doc(db, fallbackSettingsPath, 'mainConfig'));
                if (fallbackSnap.exists()) {
                    siteSettings = mergeValidSettings(siteSettings, fallbackSnap.data());
                    await setDoc(doc(db, pathSettings, 'mainConfig'), siteSettings, { merge: true });
                }
            } catch (err) {}
        }
        isSettingsLoaded = true;
        window.populateAdminSettings();
        window.renderAdminBanners();
        window.renderAdminNews();
        window.renderAdminMembers();
        applyAdminCustomPwaIcon();
    });

    // 2. PRODUCTS
    onSnapshot(collection(db, pathProducts), (snapshot) => {
        products = [];
        snapshot.forEach((docSnap) => { products.push({ dbId: docSnap.id, ...docSnap.data() }); });
        groupedBrands = [];
        products.forEach(p => {
            const brandName = p.brand || p.name;
            const existing = groupedBrands.find(b => b.brandName === brandName);
            if (existing) {
                existing.items.push(p);
                if (p.imgUrlBase64 && !existing.imgUrlBase64) existing.imgUrlBase64 = p.imgUrlBase64;
                if (p.desc && !existing.desc) existing.desc = p.desc;
                if (p.requireAppTarget) existing.requireAppTarget = true;
                if (p.appTargetLabel && !existing.appTargetLabel) existing.appTargetLabel = p.appTargetLabel;
                if (p.appTargetPlaceholder && !existing.appTargetPlaceholder) existing.appTargetPlaceholder = p.appTargetPlaceholder;
            } else {
                groupedBrands.push({
                    brandName: brandName,
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
        window.renderAdminProducts();
        populateNewsBrandDropdown();
        
        const stockableBrands = groupedBrands.filter(b => b.type === 'app' || b.type === 'tools');
        const filterSel = document.getElementById('view-stock-category');
        if (filterSel) {
            const curFil = filterSel.value;
            let selFilHtml = '<option value="">-- Pilih Brand Untuk Dilihat --</option>';
            stockableBrands.forEach(b => {
                const labelType = b.type === 'tools' ? '[Tools]' : '[App]';
                selFilHtml += `<option value="${window.escapeHtml(b.brandName)}">${labelType} ${window.escapeHtml(b.brandName)}</option>`;
            });
            filterSel.innerHTML = selFilHtml;
            if (stockableBrands.some(b => b.brandName === curFil)) filterSel.value = curFil;
        }
        const addSel = document.getElementById('stock-brand-select');
        if (addSel) {
            const curAdd = addSel.value;
            let selAddHtml = '<option value="">-- Pilih Produk Aplikasi / Tools --</option>';
            stockableBrands.forEach(b => {
                const labelType = b.type === 'tools' ? '[Tools]' : '[App]';
                selAddHtml += `<option value="${window.escapeHtml(b.brandName)}">${labelType} ${window.escapeHtml(b.brandName)}</option>`;
            });
            addSel.innerHTML = selAddHtml;
            if (stockableBrands.some(b => b.brandName === curAdd)) addSel.value = curAdd;
        }
    });

    // 3. PROMOS
    onSnapshot(collection(db, pathPromos), (snapshot) => {
        promos = [];
        snapshot.forEach((docSnap) => { promos.push({ dbId: docSnap.id, ...docSnap.data() }); });
        window.renderAdminPromos();
    });
    
    // 4. REVIEWS
    onSnapshot(collection(db, pathReviews), (snapshot) => {
        reviewsList = [];
        snapshot.forEach(docSnap => reviewsList.push({ dbId: docSnap.id, ...docSnap.data() }));
        reviewsList.sort((a, b) => b.timestamp - a.timestamp);
        window.renderReviews();
    });

    // 5. USERS & DEVICE LOCKS
    onSnapshot(collection(db, pathDeviceLocks), (snapshot) => {
        deviceLocksMap = {};
        snapshot.forEach(docSnap => {
            deviceLocksMap[docSnap.id] = { lockId: docSnap.id, ...docSnap.data() };
        });
        window.renderAdminMembers();
    }, () => {});

    onSnapshot(collection(db, pathUsers), (snapshot) => {
        allUsersList = [];
        snapshot.forEach(docSnap => {
            allUsersList.push({ uid: docSnap.id, ...docSnap.data() });
        });
        allUsersList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        window.renderAdminMembers();
    });

    // 6. ORDERS
    onSnapshot(collection(db, pathOrders), (snapshot) => {
        let newOrders = [];
        snapshot.forEach((docSnap) => {
            let d = { dbId: docSnap.id, ...docSnap.data() };
            // Jika status PAID dari MacroDroid GAS Webhook, konversi ke SUCCESS
            if (d.status === 'PAID') {
                updateDoc(doc(db, pathOrders, d.dbId), { status: 'SUCCESS' }).catch(() => {});
                d.status = 'SUCCESS';
            }
            newOrders.push(d);
        });

        if (isInitialOrderLoad) {
            snapshot.forEach((docSnap) => {
                let data = docSnap.data();
                previousOrdersData[docSnap.id] = { status: data.status, adminReply: data.adminReply };
                if (data.status === 'SUCCESS') deductedStockOrderIds.add(docSnap.id);
            });
            isInitialOrderLoad = false;
        } else {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added" || change.type === "modified") {
                    let data = change.doc.data();
                    let dbId = change.doc.id; 
                    if (data.status === 'PAID') data.status = 'SUCCESS';
                    
                    let oldData = previousOrdersData[dbId] || {};
                    let oldStatus = oldData.status;
                    
                    if (!oldStatus && (data.status === 'PENDING' || data.status === 'UNPAID' || data.status === 'PENDING_PAYMENT')) {
                        playNotificationSound('order');
                        sendAdminNativeNotification('Pesanan Baru Masuk! 🛒', `Invoice ${data.id} sebesar Rp${(data.finalTotal || 0).toLocaleString('id-ID')}`);
                        window.showToast('Pesanan Baru Masuk!', `Invoice ${data.id} (${data.paymentMethod === 'cash' ? 'Tunai Barcode' : 'QRIS'})`, 'info', () => {
                            window.switchAdminTabByName('tab-orders');
                        });
                    }
                    else if ((oldStatus === 'PENDING' || oldStatus === 'UNPAID' || oldStatus === 'PENDING_PAYMENT' || !oldStatus) && data.status === 'SUCCESS') {
                        playNotificationSound('order');
                        deductProductQuotaOnSuccess(data, dbId);

                        if (!data.adminReply) {
                            let hasAutoStockItem = data.items && data.items.some(i => i.type === 'app' || i.type === 'tools');
                            let isManualProcess = data.items && data.items.some(i => i.processType === 'manual');
                            
                            if (hasAutoStockItem && !isManualProcess) {
                                window.autoProcessOrder(data, dbId);
                            } else {
                                ensureOrderSubscriptionInitialized(data, dbId);
                                sendAdminNativeNotification('Pembayaran Lunas (Butuh Proses) ⚡', `Invoice ${data.id} menunggu pengiriman manual Anda.`);
                                window.showToast('Pembayaran Lunas!', `Invoice ${data.id} menunggu proses manual Anda.`, 'success', () => {
                                    window.switchAdminTabByName('tab-orders');
                                    window.promptProcessOrder(dbId);
                                });
                            }
                        }
                    }
                    
                    previousOrdersData[dbId] = { status: data.status, adminReply: data.adminReply };
                }
                if (change.type === "removed") {
                    delete previousOrdersData[change.doc.id];
                }
            });
        }
        
        orders = newOrders.sort((a, b) => new Date(b.date) - new Date(a.date));
        updateSubscriptionCountersAndBadges();
        window.renderAdminOrders();
        window.generateAdminReports();
        window.renderAdminMembers();
    });
    
    // 7. LIVE CHAT
    listenAdminLiveChat();
}

/* ============================================================================
 * [FEATURE-08 & FEATURE-09] MULTI-QUOTA SHARING VAULT AUTO-DELIVERY &
 * SUBSCRIPTION DURATION TRACKER / KICK MANAGER
 * ============================================================================ */
function getOrderDurationDays(order) {
    if (!order) return 0;
    if (typeof order.durationDays === 'number' && order.durationDays > 0) return order.durationDays;
    const item = order.items && order.items[0];
    if (item && typeof item.durationDays === 'number' && item.durationDays > 0) return item.durationDays;
    if (item && item.productDbId) {
        const prod = products.find(p => p.dbId === item.productDbId);
        if (prod && typeof prod.durationDays === 'number' && prod.durationDays > 0) return prod.durationDays;
    }
    return 0;
}

async function ensureOrderSubscriptionInitialized(orderData, orderDbId) {
    const durDays = getOrderDurationDays(orderData);
    if (durDays <= 0 || orderData.subscriptionEndAt) return {};

    const startMs = Date.now();
    const endMs = startMs + (durDays * 86400000);
    const subFields = {
        durationDays: durDays,
        subscriptionStartAt: startMs,
        subscriptionEndAt: endMs,
        subscriptionStatus: 'ACTIVE'
    };
    await updateDoc(doc(db, pathOrders, orderDbId), subFields).catch(() => {});
    return subFields;
}

function formatRemainingDurationMs(diffMs) {
    if (diffMs <= 0) return '00h 00j 00m 00d';
    const totalSec = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n) => (n < 10 ? '0' + n : String(n));
    return `${days} Hari : ${pad(hours)}j : ${pad(mins)}m : ${pad(secs)}d`;
}

function updateSubscriptionCountersAndBadges() {
    const now = Date.now();
    let activeSubCount = 0;
    let expiredSubCount = 0;

    orders.forEach(o => {
        if (o.status !== 'SUCCESS') return;
        const durDays = getOrderDurationDays(o);
        const endAt = o.subscriptionEndAt || (durDays > 0 ? (new Date(o.date).getTime() + durDays * 86400000) : 0);
        if (!endAt || o.subscriptionStatus === 'KICKED') return;

        if (now >= endAt) {
            expiredSubCount++;
        } else {
            activeSubCount++;
        }
    });

    const activeBadge = document.getElementById('badge-sub-active-count');
    const expiredBadge = document.getElementById('badge-sub-expired-count');
    const headerKickBtn = document.getElementById('btn-header-kick-alert');
    const headerKickCount = document.getElementById('header-kick-count');

    if (activeBadge) activeBadge.innerText = String(activeSubCount);
    if (expiredBadge) expiredBadge.innerText = String(expiredSubCount);
    if (headerKickCount) headerKickCount.innerText = String(expiredSubCount);
    if (headerKickBtn) headerKickBtn.style.display = expiredSubCount > 0 ? 'inline-flex' : 'none';

    const hasPending = orders.some(o => o.status === 'PENDING' || (o.status === 'SUCCESS' && !o.adminReply)) || expiredSubCount > 0;
    const adminOrderTabBadge = document.getElementById('admin-tab-order-badge');
    if (adminOrderTabBadge) adminOrderTabBadge.style.display = hasPending ? 'inline-block' : 'none';
}

function startAdminSubscriptionLiveTicker() {
    if (subscriptionTickerInterval) clearInterval(subscriptionTickerInterval);
    subscriptionTickerInterval = setInterval(() => {
        const now = Date.now();
        document.querySelectorAll('.sub-live-timer').forEach(el => {
            const endAt = parseInt(el.getAttribute('data-end') || '0', 10);
            const subStatus = el.getAttribute('data-substatus') || 'ACTIVE';
            if (!endAt || subStatus === 'KICKED') return;

            const diff = endAt - now;
            if (diff <= 0) {
                el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 🚨 DURASI LANGGANAN HABIS — WAJIB KICK!`;
                el.className = 'sub-countdown-box sub-expired sub-live-timer';
                const parentTr = el.closest('tr');
                if (parentTr && !parentTr.classList.contains('row-sub-expired')) {
                    parentTr.classList.add('row-sub-expired');
                }
            } else {
                el.innerHTML = `<i class="fa-solid fa-stopwatch"></i> Sisa Durasi: <b>${formatRemainingDurationMs(diff)}</b>`;
            }
        });
    }, 1000);
}

// Aksi Admin: Tandai Sudah Dikeluarkan (Kick Selesai) + Opsi Kembalikan Slot Sharing & Kirim Email Pengingat
window.markSubscriptionKicked = function(orderDbId) {
    const order = orders.find(o => o.dbId === orderDbId);
    if (!order) return;

    window.openConfirm(
        'Konfirmasi Kick Akun Langganan',
        `Tandai bahwa akun pembeli pada pesanan <b>#${window.escapeHtml(order.id)}</b> sudah dikeluarkan (Kick) dari aplikasi?<br><br><small class="text-muted">Sistem juga akan mengirim email pemberitahuan masa aktif berakhir ke pembeli (jika Webhook GAS aktif).</small>`,
        async (confirmed) => {
            if (!confirmed) return;
            try {
                await updateDoc(doc(db, pathOrders, orderDbId), {
                    subscriptionStatus: 'KICKED',
                    kickedAt: Date.now()
                });

                // Jika pesanan menggunakan stok Sharing dari koleksi stocks, kembalikan 1 slot kuota jika stok masih ada
                if (order.usedStockIds && Array.isArray(order.usedStockIds)) {
                    for (const sId of order.usedStockIds) {
                        const sRef = doc(db, pathStocks, sId);
                        const sSnap = await getDoc(sRef).catch(() => null);
                        if (sSnap && sSnap.exists()) {
                            const sData = sSnap.data();
                            if ((sData.maxQuota || 1) > 1 && (sData.usedQuota || 0) > 0) {
                                const nextUsed = Math.max(0, (sData.usedQuota || 1) - 1);
                                await updateDoc(sRef, {
                                    usedQuota: nextUsed,
                                    status: 'Ready'
                                }).catch(() => {});
                            }
                        }
                    }
                }

                triggerAutomatedEmailWebhook(order, '', 'SEND_EXPIRY_REMINDER');
                window.closeModal('modal-process-order');
                window.showToast('Kick Selesai!', `Pesanan #${order.id} telah ditandai KICKED.`, 'success');
            } catch (err) {
                window.customAlert('Gagal', 'Tidak dapat memperbarui status Kick pesanan.', 'error');
            }
        },
        'success'
    );
};

window.markSubscriptionKickedFromModal = function() {
    const dbId = document.getElementById('proc-order-id')?.value;
    if (dbId) window.markSubscriptionKicked(dbId);
};

window.extendOrderSubscriptionDays = async function(addDays, explicitDbId = null) {
    const dbId = explicitDbId || document.getElementById('proc-order-id')?.value;
    const order = orders.find(o => o.dbId === dbId);
    if (!order || !addDays) return;

    const now = Date.now();
    const currentEnd = order.subscriptionEndAt && order.subscriptionEndAt > now ? order.subscriptionEndAt : now;
    const newEnd = currentEnd + (addDays * 86400000);
    const newDuration = (parseInt(order.durationDays || 0, 10)) + addDays;

    try {
        await updateDoc(doc(db, pathOrders, dbId), {
            durationDays: newDuration,
            subscriptionStartAt: order.subscriptionStartAt || now,
            subscriptionEndAt: newEnd,
            subscriptionStatus: 'ACTIVE'
        });
        window.showToast('Durasi Diperpanjang', `Masa aktif #${order.id} ditambah +${addDays} Hari.`, 'success');
        if (document.getElementById('modal-process-order')?.classList.contains('active')) {
            window.promptProcessOrder(dbId);
        }
    } catch (e) {
        window.customAlert('Gagal', 'Gagal memperpanjang durasi langganan.', 'error');
    }
};

async function deductProductQuotaOnSuccess(orderData, orderDbId) {
    if (deductedStockOrderIds.has(orderDbId) || orderData.stockQuotaDeducted) return;
    deductedStockOrderIds.add(orderDbId);

    const item = orderData.items && orderData.items[0];
    if (!item || !item.productDbId) return;

    const prodObj = products.find(p => p.dbId === item.productDbId);
    if (!prodObj || typeof prodObj.stockCount !== 'number') return;

    const boughtQty = parseInt(item.qty) || 1;
    const newStockCount = Math.max(0, prodObj.stockCount - boughtQty);
    const shouldMarkSoldOut = newStockCount === 0 ? true : prodObj.soldOut;

    try {
        await updateDoc(doc(db, pathProducts, prodObj.dbId), {
            stockCount: newStockCount,
            soldOut: shouldMarkSoldOut
        });
        await updateDoc(doc(db, pathOrders, orderDbId), { stockQuotaDeducted: true });
    } catch (e) {
        console.error("Gagal mengurangi kuota stok varian:", e);
    }
}

window.autoProcessOrder = async function(orderData, orderDbId) {
    if (processingAutoOrderIds.has(orderDbId)) return;
    processingAutoOrderIds.add(orderDbId);

    const targetItem = orderData.items.find(i => i.type === 'app' || i.type === 'tools');
    if (!targetItem) {
        processingAutoOrderIds.delete(orderDbId);
        return;
    }
    
    const targetBrand = targetItem.brandName || targetItem.name.split(' - ')[0];
    const exactItemName = targetItem.exactItemName || targetItem.name.replace(`(x${targetItem.qty})`, '').trim();
    const neededQty = parseInt(targetItem.qty) || 1;
    const nowMs = Date.now();
    const durDays = getOrderDurationDays(orderData);
    const subFields = durDays > 0 ? {
        durationDays: durDays,
        subscriptionStartAt: nowMs,
        subscriptionEndAt: nowMs + (durDays * 86400000),
        subscriptionStatus: 'ACTIVE'
    } : {};
    
    try {
        const q = query(
            collection(db, pathStocks),
            where("brand", "==", targetBrand),
            where("itemName", "==", exactItemName),
            where("status", "==", "Ready")
        );
        const snap = await getDocs(q);

        // 1. Prioritaskan Stok Mode Kirim Berulang-ulang (Reusable Link/Tools)
        const reusableDoc = snap.docs.find(d => d.data().isReusable === true);
        if (reusableDoc) {
            const rData = reusableDoc.data();
            const parts = (rData.data || '').split('|');
            const replyText = `Terima kasih! Pembayaran Anda telah diverifikasi otomatis.\n\n[AKSES LAYANAN / TOOLS DIGITAL (x${neededQty})]\nEmail / Link : ${parts[0] || '-'}\nPassword / Pin : ${parts[1] || '-'}\nPanduan        : ${parts[2] || '-'}\n\nSilakan langsung diakses dan hubungi Live Chat jika ada kendala.`;

            await updateDoc(doc(db, pathStocks, reusableDoc.id), {
                sentCount: increment(neededQty),
                lastSentAt: nowMs,
                lastOrderId: orderData.id
            });
            await updateDoc(doc(db, pathOrders, orderDbId), {
                adminReply: replyText,
                usedStockIds: [reusableDoc.id],
                ...subFields
            });
            triggerAutomatedEmailWebhook({ ...orderData, ...subFields, status: 'SUCCESS' }, replyText);
            window.showToast('Auto-Delivery (Reusable) Sukses', `Link/Stok berulang terkirim otomatis untuk ${orderData.id}`, 'success');
            return;
        }
        
        // 2. Stok Sharing Multi-Kuota (usedQuota < maxQuota) maupun Private (maxQuota = 1)
        const availableDocs = snap.docs.filter(d => {
            const sd = d.data();
            const maxQ = parseInt(sd.maxQuota || 1, 10);
            const usedQ = parseInt(sd.usedQuota || 0, 10);
            return usedQ < maxQ;
        });

        if (availableDocs.length > 0) {
            let accountDetailsList = [];
            let usedStockIds = [];
            let fulfilled = 0;

            for (const stockDoc of availableDocs) {
                if (fulfilled >= neededQty) break;
                const stockData = stockDoc.data();
                const maxQ = parseInt(stockData.maxQuota || 1, 10);
                let usedQ = parseInt(stockData.usedQuota || 0, 10);

                while (usedQ < maxQ && fulfilled < neededQty) {
                    usedQ++;
                    fulfilled++;
                    const parts = (stockData.data || '').split('|');
                    const slotTag = maxQ > 1 ? ` (Slot Sharing #${usedQ}/${maxQ})` : '';
                    const headerTitle = neededQty > 1 ? `[DATA AKUN #${fulfilled}${slotTag}]` : `[DETAIL PESANAN ANDA${slotTag}]`;
                    accountDetailsList.push(
                        `${headerTitle}\nEmail : ${parts[0] || '-'}\nPassword : ${parts[1] || '-'}\nProfil/Info : ${parts[2] || '-'}`
                    );
                }

                usedStockIds.push(stockDoc.id);
                await updateDoc(doc(db, pathStocks, stockDoc.id), {
                    usedQuota: usedQ,
                    status: usedQ >= maxQ ? 'Used' : 'Ready',
                    usedAt: nowMs,
                    orderId: orderData.id,
                    buyers: arrayUnion({
                        orderId: orderData.id,
                        buyerEmail: orderData.userEmail || '',
                        sentAt: new Date(nowMs).toISOString()
                    })
                });
            }

            if (fulfilled > 0) {
                const replyText = `Terima kasih! Pembayaran Anda telah terverifikasi otomatis.\n\n${accountDetailsList.join('\n\n')}\n\nSilakan diamankan dan hubungi Live Chat jika ada kendala.`;
                await updateDoc(doc(db, pathOrders, orderDbId), {
                    adminReply: replyText,
                    usedStockIds: usedStockIds,
                    ...subFields
                });
                triggerAutomatedEmailWebhook({ ...orderData, ...subFields, status: 'SUCCESS' }, replyText);
                window.showToast('Auto-Delivery Vault Sukses', `${fulfilled} slot stok terkirim otomatis untuk ${orderData.id}`, 'success');

                const curView = document.getElementById('view-stock-category')?.value;
                if (curView === targetBrand) window.renderAdminStocksByCategory();
                return;
            }
        }

        // Jika stok habis/kurang, tetap inisialisasi durasi dan beri peringatan ke Admin
        await ensureOrderSubscriptionInitialized(orderData, orderDbId);
        sendAdminNativeNotification('Stok Gudang Kurang! ⚠️', `Invoice ${orderData.id} butuh ${neededQty} stok ${exactItemName}. Segera proses manual!`);
        window.showToast('Stok Vault Habis!', `Invoice ${orderData.id} butuh ${neededQty} stok ${exactItemName}. Klik untuk proses manual.`, 'error', () => {
            window.promptProcessOrder(orderDbId);
        });
    } catch (e) {
        console.error("Auto Process Gagal: ", e);
    } finally {
        setTimeout(() => processingAutoOrderIds.delete(orderDbId), 3000);
    }
};
/* ======================== END OF [FEATURE-08 & 09] ======================== */

// ==========================================
// KASIR SCANNER BARCODE TUNAI
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
        { fps: 12, qrbox: { width: 260, height: 120 } },
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
        readerBox.innerHTML = `<div class="p-3 text-center text-xs" style="color:#94a3b8;"><i class="fa-solid fa-camera-slash" style="font-size:1.8rem; display:block; margin-bottom:6px;"></i>Kamera tidak diizinkan atau tidak tersedia. Gunakan kolom input kode di bawah.</div>`;
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
    const invCode = rawCode.trim().toUpperCase();
    const resBox = document.getElementById('scanned-order-result');
    if (!invCode || !resBox) return;

    const order = orders.find(o => o.id.toUpperCase() === invCode);
    resBox.style.display = 'block';

    if (!order) {
        resBox.innerHTML = `<div class="info-box bg-danger-light border-danger text-danger fw-bold text-xs"><i class="fa-solid fa-circle-xmark"></i> Invoice <b>${window.escapeHtml(invCode)}</b> tidak ditemukan di database!</div>`;
        return;
    }

    const item = order.items && order.items[0] ? order.items[0] : {};
    const sBadge = order.status === 'SUCCESS' ? 'status-success' : (order.status === 'PENDING' ? 'status-pending' : 'status-unpaid');

    let actionBtnHtml = '';
    if (order.status !== 'SUCCESS') {
        actionBtnHtml = `
            <div class="flex-wrap-gap mt-3">
                <button class="btn btn-success flex-2" onclick="window.approveCashBarcodeDirectly('${order.dbId}')">
                    <i class="fa-solid fa-cash-register"></i> Terima Tunai & Selesaikan Otomatis
                </button>
                <button class="btn btn-outline flex-1" onclick="window.closeBarcodeScannerModal(); window.promptProcessOrder('${order.dbId}')">
                    <i class="fa-solid fa-sliders"></i> Proses Manual
                </button>
            </div>`;
    } else {
        actionBtnHtml = `<div class="info-box bg-success-light border-success text-success fw-bold text-center text-xs mt-2"><i class="fa-solid fa-circle-check"></i> Transaksi ini sudah LUNAS & SELESAI.</div>`;
    }

    resBox.innerHTML = `
        <div class="dashboard-panel mb-0" style="padding: 1rem; background: var(--bg);">
            <div class="flex-between align-center mb-2">
                <strong class="text-primary" style="font-size:1.05rem;">#${window.escapeHtml(order.id)}</strong>
                <span class="status-badge ${sBadge}">${order.status} (${(order.paymentMethod || 'cash').toUpperCase()})</span>
            </div>
            <div class="text-sm fw-bold text-dark">${window.escapeHtml(item.name || '-')}</div>
            <div class="text-xs text-muted mb-2">${window.escapeHtml(item.playerInfo || '')} &bull; Pembeli: ${window.escapeHtml(order.userEmail || '-')}</div>
            <div class="flex-between align-center" style="padding-top:8px; border-top:1.5px dashed var(--border-subtle);">
                <span class="text-xs fw-bold text-muted">TAGIHAN TUNAI KASIR:</span>
                <strong class="text-success" style="font-size:1.3rem; font-family:'Space Grotesk',sans-serif;">Rp${(order.finalTotal || 0).toLocaleString('id-ID')}</strong>
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
        const isGameOrManual = order.items && order.items.some(i => i.type === 'game' || i.processType === 'manual');
        if (isGameOrManual) {
            await updateDoc(doc(db, pathOrders, dbId), { status: 'SUCCESS' });
            await ensureOrderSubscriptionInitialized(order, dbId);
            window.promptProcessOrder(dbId);
            window.showToast('Tunai Diterima!', `Silakan kirim pesanan manual untuk ${order.id}.`, 'success');
        } else {
            await updateDoc(doc(db, pathOrders, dbId), { status: 'SUCCESS' });
            window.showToast('Kasir Tunai Berhasil!', `Pembayaran ${order.id} diterima & stok otomatis sedang dikirim.`, 'success');
        }
    } catch (e) {
        window.customAlert('Gagal', 'Gagal memverifikasi pembayaran kasir.', 'error');
    }
};

/* ============================================================================
 * [FEATURE-12] DIREKTORI MEMBER & ANONIM + FITUR BLOCK & CASCADE CLEANUP
 * ============================================================================ */
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
        if (u.isDeleted === true || deletedList.includes(u.uid)) return;
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
        const userOrders = orders.filter(o => o.userId === u.uid || (uEmail && o.userEmail?.toLowerCase() === uEmail));
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
    const phoneEl = document.getElementById('member-stat-phone');
    const buyerEl = document.getElementById('member-stat-buyers');

    if (totalMemberEl) totalMemberEl.innerText = enrichedUsers.filter(u => !u.isAnon).length;
    if (totalAnonEl) totalAnonEl.innerText = enrichedUsers.filter(u => u.isAnon).length;
    if (phoneEl) phoneEl.innerText = enrichedUsers.filter(u => u.resolvedPhone && u.resolvedPhone.trim() !== '').length;
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
        grid.innerHTML = `<div class="dashboard-panel text-center text-muted" style="grid-column: 1/-1; padding: 2.5rem;">Tidak ada data akun pada filter/pencarian ini.</div>`;
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
            ? `<span class="status-badge status-anon"><i class="fa-solid fa-user-secret"></i> ANONIM</span>`
            : `<span class="status-badge status-success"><i class="fa-solid fa-circle-check"></i> MEMBER</span>`;

        if (u.isBlocked) {
            statusRoleBadge = `<span class="status-badge status-failed"><i class="fa-solid fa-ban"></i> DIBLOKIR</span>`;
        }

        let cleanWa = phoneStr.replace(/[^0-9]/g, '');
        if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1);
        const waBtnHtml = cleanWa
            ? `<a href="https://wa.me/${cleanWa}?text=${encodeURIComponent(`Halo kak ${displayName}, Admin Vipercell menghubungi terkait layanan...`)}" target="_blank" class="btn btn-success btn-sm" title="Hubungi via WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>`
            : `<button class="btn btn-outline btn-sm" disabled title="Belum ada nomor WA"><i class="fa-brands fa-whatsapp"></i></button>`;

        const emailBtnHtml = (u.email && u.email.includes('@'))
            ? `<a href="mailto:${encodeURIComponent(u.email)}?subject=${encodeURIComponent('Informasi Akun Vipercell')}" class="btn btn-outline btn-sm" title="Kirim Email"><i class="fa-regular fa-envelope"></i></a>`
            : '';

        const blockBtnHtml = u.isBlocked
            ? `<button class="btn btn-warning btn-sm" onclick="window.toggleBlockUserAccount('${escapeJsStr(u.uid)}', '${escapeJsStr(u.deviceId || '')}', false)" title="Buka Blokir Akun & Perangkat">
                   <i class="fa-solid fa-unlock"></i> Buka Blokir
               </button>`
            : `<button class="btn btn-outline btn-sm text-warning border-warning" onclick="window.toggleBlockUserAccount('${escapeJsStr(u.uid)}', '${escapeJsStr(u.deviceId || '')}', true)" title="Blokir Akun & Perangkat Ini">
                   <i class="fa-solid fa-ban"></i> Blokir
               </button>`;

        html += `
        <div class="member-card" style="${u.isBlocked ? 'border-color: var(--danger); opacity: 0.88;' : ''}">
            <div>
                <div class="member-card-head mb-2">
                    <div class="member-avatar ${u.isAnon ? 'anon-avatar' : ''}" style="${u.isBlocked ? 'background: var(--danger); color: #fff;' : ''}">${window.escapeHtml(initial)}</div>
                    <div style="flex:1; min-width:0;">
                        <div class="flex-between align-center mb-1">
                            <strong class="text-dark" style="font-size:0.96rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(displayName)}</strong>
                            ${statusRoleBadge}
                        </div>
                        <span class="text-xs text-muted d-block" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="fa-regular fa-envelope"></i> ${window.escapeHtml(u.email || 'Tanpa Email')}</span>
                        <span class="text-xs text-success fw-bold d-block"><i class="fa-brands fa-whatsapp"></i> ${window.escapeHtml(phoneStr || 'Belum ada No. WA')}</span>
                    </div>
                </div>

                <div class="member-meta-box">
                    <div class="member-meta-item">
                        <span>TRANSAKSI SUKSES</span>
                        <strong>${u.successTrx}x (Total ${u.totalTrx}x)</strong>
                    </div>
                    <div class="member-meta-item">
                        <span>TOTAL BELANJA</span>
                        <strong class="text-primary">Rp${u.totalSpent.toLocaleString('id-ID')}</strong>
                    </div>
                    <div class="member-meta-item" style="grid-column: 1 / -1; border-top: 1px dashed var(--border-subtle); padding-top: 6px; display:flex; justify-content:space-between;">
                        <span>Bergabung: <b>${joinDate}</b></span>
                        <span>UID: <b>#${window.escapeHtml(shortUid)}</b></span>
                    </div>
                </div>
            </div>

            <div class="member-actions-row">
                <button class="btn btn-primary btn-sm flex-1" onclick="window.startChatWithMember('${escapeJsStr(u.uid)}', '${escapeJsStr(displayName)}', '${escapeJsStr(u.email || '')}')">
                    <i class="fa-solid fa-comments"></i> Chat
                </button>
                ${waBtnHtml}
                ${emailBtnHtml}
                ${blockBtnHtml}
                <button class="btn btn-danger btn-sm" onclick="window.promptDeleteAccount('${escapeJsStr(u.uid)}')" title="Hapus Permanen">
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
        }, 200);
    } catch (e) {
        window.customAlert('Gagal', 'Tidak dapat membuka ruang chat dengan pengguna ini.', 'error');
    }
};

window.toggleBlockUserAccount = async function(uid, deviceId, shouldBlock) {
    if (!uid) return;
    const actionLabel = shouldBlock ? 'Blokir' : 'Buka Blokir';

    window.openConfirm(
        `${actionLabel} Pengguna`,
        shouldBlock
            ? `Blokir akun dan perangkat pengguna ini? Pengguna akan langsung dikeluarkan dari toko dan tidak bisa masuk kembali.`
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
                    shouldBlock ? 'Akun Diblokir' : 'Blokir Dibuka',
                    shouldBlock ? 'Pengguna & perangkat telah diblokir secara real-time.' : 'Akses pengguna telah dipulihkan.',
                    shouldBlock ? 'warning' : 'success'
                );
            } catch (err) {
                console.error("Block Toggle Error:", err);
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
            <div><b>Nama Akun:</b> ${window.escapeHtml(userObj.name || 'Tamu')} (${userObj.isAnonymous || userObj.isGuest ? 'Anonim' : 'Member'})</div>
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

        if (!deletedUids.includes(uid)) deletedUids.push(uid);

        if (!releaseDeviceLock) {
            if (!blockedUids.includes(uid)) blockedUids.push(uid);
            if (deviceId && !blockedDevices.includes(deviceId)) blockedDevices.push(deviceId);
        } else {
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

        await setDoc(doc(db, pathUsers, uid), { isDeleted: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
        await deleteDoc(doc(db, pathUsers, uid)).catch(() => {});
        await deleteDoc(doc(db, pathChats, uid)).catch(() => {});

        setDoc(doc(db, pathDeletedAccounts, uid), { deletedAt: Date.now(), deletedBy: currentAdminUser?.email || 'admin' }).catch(() => {});
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
        window.showToast('Akun Dihapus', 'Akun pengguna berhasil dihapus secara permanen.', 'success');
    } catch (e) {
        console.error("Delete Account Error:", e);
        window.customAlert('Error', 'Gagal menyelesaikan penghapusan akun.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = ogHtml;
    }
};

window.bulkDeleteInactiveGuests = function() {
    const deletedList = Array.isArray(siteSettings.deletedUids) ? siteSettings.deletedUids : [];
    const emptyGuests = allUsersList.filter(u => {
        if (!u.uid || u.isDeleted || deletedList.includes(u.uid)) return false;
        const isAnon = Boolean(u.isAnonymous || u.isGuest || u.role === 'anonymous');
        if (!isAnon) return false;
        const hasOrder = orders.some(o => o.userId === u.uid);
        return !hasOrder;
    });

    if (emptyGuests.length === 0) {
        window.customAlert('Bersih!', 'Tidak ada akun Tamu (Anonim) dengan 0 transaksi saat ini.', 'info');
        return;
    }

    window.openConfirm(
        'Bersihkan Akun Tamu Kosong',
        `Ditemukan <b>${emptyGuests.length} akun Tamu (Anonim)</b> yang belum pernah bertransaksi (0 Transaksi). Hapus semuanya sekarang?`,
        async (confirmed) => {
            if (!confirmed) return;
            try {
                let updatedDeletedUids = Array.isArray(siteSettings.deletedUids) ? [...siteSettings.deletedUids] : [];
                let count = 0;

                for (const g of emptyGuests) {
                    if (!updatedDeletedUids.includes(g.uid)) updatedDeletedUids.push(g.uid);
                    await setDoc(doc(db, pathUsers, g.uid), { isDeleted: true }, { merge: true }).catch(() => {});
                    await deleteDoc(doc(db, pathUsers, g.uid)).catch(() => {});
                    if (g.deviceId) {
                        deleteDoc(doc(db, pathDeviceLocks, g.deviceId)).catch(() => {});
                    }
                    count++;
                }

                await setDoc(doc(db, pathSettings, 'mainConfig'), {
                    deletedUids: updatedDeletedUids
                }, { merge: true });

                siteSettings.deletedUids = updatedDeletedUids;
                allUsersList = allUsersList.filter(u => !updatedDeletedUids.includes(u.uid));
                window.renderAdminMembers();

                window.showToast('Selesai Dibersihkan', `${count} akun tamu tanpa transaksi telah dihapus.`, 'success');
            } catch (e) {
                window.customAlert('Gagal', 'Terjadi kesalahan saat menghapus akun tamu.', 'error');
            }
        },
        'delete'
    );
};
/* ======================== END OF [FEATURE-12] ============================= */

// ==========================================
// RINGKASAN & ANALITIK DASHBOARD
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
                    <td><strong>${window.escapeHtml(o.id)}</strong></td>
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
// MANAJEMEN PESANAN MASUK + COUNTDOWN DURASI + KIRIM EMAIL & WA
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
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2.5rem;">Tidak ada pesanan pada filter ini.</td></tr>`; 
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

        let sBadge = `<span class="status-badge status-unpaid">UNPAID</span>`;
        if (o.status === 'PENDING') sBadge = `<span class="status-badge status-pending">PENDING</span>`;
        else if (o.status === 'FAILED') sBadge = `<span class="status-badge status-failed">FAILED</span>`;
        else if (o.status === 'CANCELLED') sBadge = `<span class="status-badge status-failed">DIBATALKAN</span>`;
        else if (o.status === 'EXPIRED') sBadge = `<span class="status-badge status-failed">EXPIRED</span>`;
        else if (o.status === 'SUCCESS' && !o.adminReply) sBadge = `<span class="status-badge status-pending">LUNAS - BELUM DIKIRIM</span>`;
        else if (isSubExpired) sBadge = `<span class="status-badge status-failed danger-blink">🚨 WAJIB KICK!</span>`;
        else if (isSubKicked) sBadge = `<span class="status-badge status-anon">SUDAH DI-KICK</span>`;
        else if (o.status === 'SUCCESS') sBadge = `<span class="status-badge status-success">SELESAI</span>`;
        
        let itemsDesc = (o.items || []).map(i => {
            const safeTarget = escapeJsStr(i.playerInfo || '');
            const copyTargetBtn = (i.type === 'game' || (i.playerInfo && i.playerInfo.includes(':')))
                ? `<button class="btn btn-outline btn-sm" style="padding:2px 6px; min-height:22px; font-size:0.65rem; margin-left:6px;" onclick="window.copyTextToClipboard('${safeTarget}', 'Data Tujuan')" title="Salin Tujuan"><i class="fa-regular fa-copy"></i> Salin</button>`
                : '';
            return `<strong class="text-dark">${window.escapeHtml(i.name)}</strong><br><span class="text-muted text-xs">${window.escapeHtml(i.playerInfo)}</span>${copyTargetBtn}`;
        }).join('<br>');

        // Kotak Countdown Durasi Langganan (Khusus Admin)
        let subCountdownHtml = '';
        if (isSubExpired) {
            subCountdownHtml = `
                <div class="sub-countdown-box sub-expired sub-live-timer" data-end="${endAt}" data-substatus="ACTIVE">
                    <i class="fa-solid fa-triangle-exclamation"></i> 🚨 DURASI LANGGANAN HABIS — WAKTUNYA KICK AKUN!
                </div>
                ${o.adminReply ? `<div class="text-xs text-muted mt-1" style="font-family:monospace; max-width:340px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Akun: ${window.escapeHtml(o.adminReply.replace(/\n/g, ' | '))}</div>` : ''}`;
        } else if (isSubActive) {
            const diff = endAt - now;
            subCountdownHtml = `
                <div class="sub-countdown-box sub-running sub-live-timer" data-end="${endAt}" data-substatus="ACTIVE">
                    <i class="fa-solid fa-stopwatch"></i> Sisa Durasi: <b>${formatRemainingDurationMs(diff)}</b>
                </div>`;
        } else if (isSubKicked) {
            subCountdownHtml = `
                <div class="sub-countdown-box sub-kicked" data-end="${endAt}" data-substatus="KICKED">
                    <i class="fa-solid fa-user-check"></i> Durasi Selesai & Sudah Dikeluarkan (Kick)
                </div>`;
        }

        let promoDesc = o.promoCode ? `<br><small class="text-success text-xs fw-bold">Voucher: ${window.escapeHtml(o.promoCode)} (-Rp${o.promoDiscount})</small>` : '';
        let paymentMethodStr = o.paymentMethod === 'cash' ? '<span class="status-badge status-pending"><i class="fa-solid fa-barcode"></i> TUNAI</span>' : '<span class="status-badge status-unpaid"><i class="fa-solid fa-qrcode"></i> QRIS</span>';
        
        const memberMatch = allUsersList.find(u => u.uid === o.userId || (o.userEmail && u.email?.toLowerCase() === o.userEmail.toLowerCase()));
        const buyerPhone = o.userPhone || (memberMatch ? (memberMatch.phone || memberMatch.whatsapp || '') : '');

        let actionBtn = '';
        if (isSubExpired) {
            actionBtn = `
                <button class="btn btn-success btn-sm" onclick="window.markSubscriptionKicked('${o.dbId}')" title="Tandai akun sudah di-kick dari aplikasi">
                    <i class="fa-solid fa-check"></i> Kick Selesai
                </button>
                <button class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${o.dbId}')" title="Detail / Perpanjang Durasi">
                    <i class="fa-solid fa-sliders"></i>
                </button>`;
        } else if (o.status === 'PENDING' || o.status === 'UNPAID' || o.status === 'PENDING_PAYMENT' || o.status === 'EXPIRED' || (o.status === 'SUCCESS' && !o.adminReply)) {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="window.promptProcessOrder('${o.dbId}')"><i class="fa-solid fa-bolt"></i> Proses</button>`;
        } else {
            actionBtn = `<button class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${o.dbId}')" title="Lihat Rincian, Durasi & Kirim Email/WA"><i class="fa-solid fa-paper-plane"></i> Detail / Kirim</button>`;
        }
            
        let deleteBtn = `<button aria-label="Hapus Order" class="btn-icon-only text-danger" style="width:34px; height:34px;" title="Hapus Permanen" onclick="window.promptDeleteOrder('${o.dbId}', '${escapeJsStr(o.id)}')"><i class="fa-solid fa-trash"></i></button>`;
        
        html += `<tr class="${isSubExpired ? 'row-sub-expired' : ''}">
            <td>
                <div class="flex-gap align-center">
                    <strong class="text-dark">${window.escapeHtml(o.id)}</strong>
                    <button class="btn-icon-only" style="width:24px; height:24px; font-size:0.7rem;" onclick="window.copyTextToClipboard('${escapeJsStr(o.id)}', 'Invoice ID')" title="Salin Invoice"><i class="fa-regular fa-copy"></i></button>
                </div>
                <small class="text-muted text-xs">${new Date(o.date).toLocaleString('id-ID')}</small>
            </td>
            <td>${itemsDesc}${promoDesc}${subCountdownHtml}</td>
            <td>
                <span class="text-xs fw-bold d-block">${window.escapeHtml(o.userEmail || '-')}</span>
                ${buyerPhone ? `<small class="text-success fw-bold text-xs"><i class="fa-brands fa-whatsapp"></i> ${window.escapeHtml(buyerPhone)}</small>` : ''}
            </td>
            <td>${paymentMethodStr}</td>
            <td class="text-primary fw-bold">Rp${(o.finalTotal || 0).toLocaleString('id-ID')}</td>
            <td>${sBadge}</td>
            <td><div class="flex-gap align-center flex-wrap-gap">${actionBtn} ${deleteBtn}</div></td>
        </tr>`;
    });
    tbody.innerHTML = html;
};

window.exportOrdersCSV = function() {
    if (orders.length === 0) {
        window.customAlert('Data Kosong', 'Belum ada data pesanan untuk diekspor.', 'warning');
        return;
    }
    const headers = ['Invoice ID', 'Tanggal', 'Email Pembeli', 'No WA', 'Produk', 'Tujuan/Info', 'Metode Bayar', 'Total Bayar (Rp)', 'Status', 'Status Langganan'];
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
    window.showToast('CSV Diunduh', 'File laporan transaksi berhasil diunduh.', 'success');
};

window.cleanExpiredOrders = function() {
    const expiredList = orders.filter(o => o.status === 'EXPIRED' || o.status === 'CANCELLED');
    if (expiredList.length === 0) {
        window.customAlert('Bersih!', 'Tidak ada pesanan berstatus EXPIRED atau DIBATALKAN saat ini.', 'info');
        return;
    }
    window.openConfirm('Bersihkan Pesanan Expired & Batal', `Hapus permanen <b>${expiredList.length} pesanan</b> yang berstatus EXPIRED / CANCELLED dari database?`, async (confirmed) => {
        if (confirmed) {
            try {
                for (const ord of expiredList) {
                    await deleteDoc(doc(db, pathOrders, ord.dbId));
                }
                window.showToast('Selesai Dibersihkan', `${expiredList.length} pesanan expired/batal telah dihapus.`, 'success');
            } catch (e) {
                window.customAlert('Gagal', 'Terjadi kesalahan saat menghapus data expired.', 'error');
            }
        }
    }, 'delete');
};

window.promptProcessOrder = async function(dbId) {
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;
    
    document.getElementById('proc-order-id').value = dbId;

    const memberMatch = allUsersList.find(u => u.uid === order.userId || (order.userEmail && u.email?.toLowerCase() === order.userEmail.toLowerCase()));
    const buyerEmail = order.userEmail || (memberMatch ? memberMatch.email : '');
    const buyerPhone = order.userPhone || (memberMatch ? (memberMatch.phone || memberMatch.whatsapp || '') : '');

    const emailInp = document.getElementById('proc-buyer-email');
    const phoneInp = document.getElementById('proc-buyer-phone');
    if (emailInp) emailInp.value = buyerEmail || '';
    if (phoneInp) phoneInp.value = buyerPhone || '';
    
    const summaryEl = document.getElementById('proc-ereceipt-summary');
    if (summaryEl) {
        const badgeCls = order.status === 'SUCCESS' ? 'status-success' : (order.status === 'PENDING' ? 'status-pending' : 'status-unpaid');
        summaryEl.innerHTML = `
            <div>
                <span class="text-xs text-muted fw-bold d-block">INVOICE #${window.escapeHtml(order.id)} &bull; ${new Date(order.date).toLocaleString('id-ID')}</span>
                <strong class="text-dark" style="font-size:0.95rem;"><i class="fa-regular fa-envelope"></i> ${window.escapeHtml(buyerEmail || '-')}</strong>
            </div>
            <div style="text-align:right;">
                <span class="status-badge ${badgeCls} mb-1">${order.status} (${(order.paymentMethod || 'qris').toUpperCase()})</span>
                <div class="text-primary fw-bold" style="font-size:1.15rem; font-family:'Space Grotesk',sans-serif;">Rp${(order.finalTotal || 0).toLocaleString('id-ID')}</div>
            </div>
        `;
    }

    // Panel Kontrol Durasi Langganan di dalam Modal
    const subBox = document.getElementById('proc-subscription-box');
    const subTxt = document.getElementById('proc-sub-countdown-text');
    const durDays = getOrderDurationDays(order);
    if (subBox && subTxt) {
        if (durDays > 0) {
            subBox.style.display = 'block';
            const endAt = order.subscriptionEndAt || (new Date(order.date).getTime() + durDays * 86400000);
            const remain = endAt - Date.now();
            if (order.subscriptionStatus === 'KICKED') {
                subTxt.innerHTML = `<span class="text-muted">Sudah Dikeluarkan (KICKED)</span>`;
            } else if (remain <= 0) {
                subTxt.innerHTML = `<span class="text-danger">🚨 DURASI HABIS (${durDays} Hari) — Wajib Kick Sekarang!</span>`;
            } else {
                subTxt.innerHTML = `<span class="text-primary">Aktif (${durDays} Hari) &bull; Sisa: ${formatRemainingDurationMs(remain)}</span>`;
            }
        } else {
            subBox.style.display = 'none';
        }
    }

    let defaultReply = order.adminReply || `Terima kasih telah berbelanja di Vipercell! Pesanan #${order.id} Anda telah berhasil diproses.`;
    document.getElementById('proc-reply').value = defaultReply;
    
    const list = document.getElementById('proc-items-list');
    list.innerHTML = '<strong class="text-dark mb-1 d-block">Rincian Item & Data Tujuan:</strong>' +
        order.items.map(i => `<div class="text-sm fw-bold text-primary">${window.escapeHtml(i.name)} (${i.processType || 'auto'})</div><div class="text-xs text-muted">${window.escapeHtml(i.playerInfo)}</div>`).join('<hr style="margin:6px 0;">');
    
    const hasStockable = order.items.some(i => i.type === 'app' || i.type === 'tools');
    const stockSec = document.getElementById('proc-stock-section');
    const stockSel = document.getElementById('proc-stock-select');
    
    if (hasStockable) {
        stockSec.style.display = 'block';
        stockSel.innerHTML = '<option value="">Memuat stok Ready dari Gudang...</option>';
        
        const targetItem = order.items.find(i => i.type === 'app' || i.type === 'tools');
        const targetBrand = targetItem.brandName || targetItem.name.split(' - ')[0];
        const exactItemName = targetItem.exactItemName || targetItem.name.replace(`(x${targetItem.qty})`, '').trim();
        
        try {
            const q = query(collection(db, pathStocks), where("brand", "==", targetBrand), where("itemName", "==", exactItemName), where("status", "==", "Ready"));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                stockSel.innerHTML = '<option value="">-- Gudang Stok Varian Ini Kosong (Ketik Manual di Bawah) --</option>';
            } else {
                let selHtml = '<option value="">-- Jangan Pakai Stok Gudang (Ketik Manual) --</option>';
                window.tempProcessStocks = [];
                snap.forEach((s) => {
                    const data = { dbId: s.id, ...s.data() };
                    const maxQ = parseInt(data.maxQuota || 1, 10);
                    const usedQ = parseInt(data.usedQuota || 0, 10);
                    if (!data.isReusable && usedQ >= maxQ) return;

                    window.tempProcessStocks.push(data);
                    const em = (data.data || '').split('|')[0];
                    let modeTag = '[Private 1x]';
                    if (data.isReusable) modeTag = '[Reusable ∞]';
                    else if (maxQ > 1) modeTag = `[Sharing ${usedQ}/${maxQ}]`;

                    selHtml += `<option value="${data.dbId}">${modeTag} ${window.escapeHtml(em)}</option>`;
                });
                stockSel.innerHTML = selHtml;
                
                stockSel.onchange = function() {
                    const sId = this.value; if (!sId) return;
                    const sData = window.tempProcessStocks.find(x => x.dbId === sId);
                    if (sData) {
                        const parts = (sData.data || '').split('|');
                        document.getElementById('proc-reply').value = `[DETAIL PESANAN #${order.id}]\nEmail : ${parts[0] || '-'}\nPassword : ${parts[1] || '-'}\nProfil/Info : ${parts[2] || '-'}`;
                    }
                };
                if (!order.adminReply && window.tempProcessStocks.length > 0) {
                    stockSel.value = window.tempProcessStocks[0].dbId;
                    stockSel.onchange();
                }
            }
        } catch (e) {
            stockSel.innerHTML = '<option value="">Gagal memuat stok.</option>';
        }
    } else {
        stockSec.style.display = 'none';
    }
    window.openModal('modal-process-order');
};

window.applyOrderMessageTemplate = function(templateType) {
    const dbId = document.getElementById('proc-order-id').value;
    const order = orders.find(o => o.dbId === dbId);
    const inv = order ? order.id : 'VP-XXXXXX';
    const itemName = order && order.items && order.items[0] ? order.items[0].name : 'Layanan Vipercell';
    const targetInfo = order && order.items && order.items[0] ? order.items[0].playerInfo : '-';
    const totalRp = order ? (order.finalTotal || 0).toLocaleString('id-ID') : '0';

    const replyBox = document.getElementById('proc-reply');
    if (!replyBox) return;

    if (templateType === 'game') {
        replyBox.value = `[TOP UP GAME BERHASIL - #${inv}]\nProduk : ${itemName}\nTujuan : ${targetInfo}\nStatus : SUKSES TERKIRIM\n\nSilakan cek langsung di dalam akun game Anda. Terima kasih telah berbelanja di Vipercell!`;
    } else if (templateType === 'app') {
        replyBox.value = `[AKUN APLIKASI PREMIUM - #${inv}]\nEmail : \nPassword : \nProfil/Info : Bergaransi Resmi Vipercell\n\nSilakan login dan jangan mengubah data profil yang telah ditentukan. Hubungi CS jika butuh bantuan.`;
    } else if (templateType === 'tools') {
        replyBox.value = `[AKSES TOOLS DIGITAL - #${inv}]\nLink Akses : https://\nKode/Pin : -\nPanduan : Silakan buka tautan di atas untuk mengakses layanan.\n\nTerima kasih telah berbelanja di Vipercell!`;
    } else if (templateType === 'remind') {
        replyBox.value = `Halo kak, kami dari Admin Vipercell ingin menginformasikan bahwa pesanan #${inv} (${itemName}) sebesar Rp${totalRp} sedang menunggu konfirmasi pembayaran. Silakan selesaikan pembayaran atau hubungi Live Chat kami jika butuh bantuan.`;
    }
};

window.sendOrderNotificationToEmail = async function() {
    const dbId = document.getElementById('proc-order-id').value;
    const order = orders.find(o => o.dbId === dbId);
    const targetEmail = document.getElementById('proc-buyer-email')?.value.trim() || '';
    const replyText = document.getElementById('proc-reply')?.value.trim() || '';

    if (!targetEmail || !targetEmail.includes('@')) {
        window.customAlert('Email Kosong', 'Masukkan alamat email pembeli yang valid terlebih dahulu.', 'warning');
        return;
    }

    const inv = order ? order.id : 'VP-XXXXXX';
    const itemTitle = order && order.items && order.items[0] ? order.items[0].name : 'Pesanan Vipercell';
    const totalRp = order ? (order.finalTotal || 0).toLocaleString('id-ID') : '0';

    const btn = document.getElementById('btn-send-order-email');
    const ogHtml = btn ? btn.innerHTML : '';
    const gasUrl = document.getElementById('set-email-webhook')?.value.trim() || (siteSettings.emailWebhookUrl || '').trim();

    if (gasUrl && order) {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mengirim via GAS...`;
        }
        try {
            const sent = await triggerAutomatedEmailWebhook({ ...order, userEmail: targetEmail }, replyText, 'SEND_ORDER_DELIVERY');
            if (sent) {
                window.showToast('Email Otomatis Terkirim!', `E-Receipt & data akun berhasil dikirim ke ${targetEmail} via GAS Webhook.`, 'success');
                return;
            }
        } finally {
            if (btn && ogHtml) {
                btn.disabled = false;
                btn.innerHTML = ogHtml;
            }
        }
    }

    const subject = `Bukti & Data Pesanan Vipercell #${inv} - ${itemTitle}`;
    const body = `Halo Pelanggan Vipercell,\n\nTerima kasih telah berbelanja di Vipercell! Berikut rincian transaksi Anda:\n\nNomor Invoice : #${inv}\nProduk        : ${itemTitle}\nTotal Tagihan : Rp${totalRp}\n\n=== RINCIAN PESANAN / DATA AKUN ===\n${replyText}\n===================================\n\nJika ada kendala atau pertanyaan, silakan balas pesan ini atau hubungi Live Chat di website Vipercell.\n\nSalam hangat,\nAdmin Vipercell`;

    window.open(`mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
};

window.sendOrderNotificationToWA = function() {
    const dbId = document.getElementById('proc-order-id').value;
    const order = orders.find(o => o.dbId === dbId);
    let rawPhone = document.getElementById('proc-buyer-phone')?.value.trim() || '';
    const replyText = document.getElementById('proc-reply')?.value.trim() || '';

    if (!rawPhone) {
        window.customAlert('Nomor WA Kosong', 'Silakan ketik nomor WhatsApp pembeli pada kolom Nomor WhatsApp di atas.', 'warning');
        return;
    }

    let cleanWa = rawPhone.replace(/[^0-9]/g, '');
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.substring(1);

    const inv = order ? order.id : 'VP-XXXXXX';
    const itemTitle = order && order.items && order.items[0] ? order.items[0].name : 'Pesanan Vipercell';
    const totalRp = order ? (order.finalTotal || 0).toLocaleString('id-ID') : '0';

    const waMessage = `*VIPERCELL OFFICIAL STORE*\nHalo kak, berikut rincian pesanan Anda:\n\n*No. Invoice :* #${inv}\n*Produk :* ${itemTitle}\n*Total :* Rp${totalRp}\n\n*DATA PESANAN / AKUN :*\n${replyText}\n\n_Terima kasih telah berbelanja di Vipercell!_`;

    window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(waMessage)}`, '_blank');
};

window.markOrderComplete = async function(statusType) {
    const dbId = document.getElementById('proc-order-id').value;
    const reply = document.getElementById('proc-reply').value.trim();
    const buyerEmail = document.getElementById('proc-buyer-email')?.value.trim() || '';
    const buyerPhone = document.getElementById('proc-buyer-phone')?.value.trim() || '';
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;
    
    const btn = document.getElementById(statusType === 'SUCCESS' ? 'btn-proc-success' : 'btn-proc-fail');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memproses...</span>';
    btn.disabled = true;
    
    try {
        let usedStockIds = order.usedStockIds || [];
        let subFields = {};

        if (statusType === 'SUCCESS') {
            if (order.items.some(i => i.type === 'app' || i.type === 'tools')) {
                const stockSel = document.getElementById('proc-stock-select');
                if (stockSel && stockSel.value) {
                    const chosenStock = window.tempProcessStocks.find(x => x.dbId === stockSel.value);
                    usedStockIds = [stockSel.value];
                    if (chosenStock && chosenStock.isReusable) {
                        await updateDoc(doc(db, pathStocks, stockSel.value), {
                            sentCount: increment(1),
                            lastSentAt: Date.now(),
                            lastOrderId: order.id
                        });
                    } else if (chosenStock) {
                        const maxQ = parseInt(chosenStock.maxQuota || 1, 10);
                        const nextUsed = parseInt(chosenStock.usedQuota || 0, 10) + 1;
                        await updateDoc(doc(db, pathStocks, stockSel.value), {
                            usedQuota: nextUsed,
                            status: nextUsed >= maxQ ? 'Used' : 'Ready',
                            usedAt: Date.now(),
                            orderId: order.id,
                            buyers: arrayUnion({
                                orderId: order.id,
                                buyerEmail: buyerEmail || order.userEmail || '',
                                sentAt: new Date().toISOString()
                            })
                        });
                    }
                }
            }
            await deductProductQuotaOnSuccess(order, dbId);
            subFields = await ensureOrderSubscriptionInitialized(order, dbId);
        }
        
        processingAutoOrderIds.add(dbId);
        await updateDoc(doc(db, pathOrders, dbId), {
            status: statusType,
            userEmail: buyerEmail || order.userEmail || '',
            userPhone: buyerPhone || order.userPhone || '',
            adminReply: statusType === 'SUCCESS' ? reply : '',
            usedStockIds: usedStockIds,
            ...subFields
        });

        if (statusType === 'SUCCESS') {
            triggerAutomatedEmailWebhook({ ...order, ...subFields, userEmail: buyerEmail || order.userEmail, status: 'SUCCESS' }, reply);
        }

        window.closeModal('modal-process-order');
        
        if (statusType === 'SUCCESS') window.showToast('Transaksi Selesai', `Invoice ${order.id} telah diselesaikan & dikirim.`, 'success');
        else window.showToast('Dibatalkan', `Invoice ${order.id} ditandai gagal.`, 'info');
    } catch (e) {
        window.customAlert('Error', 'Gagal memperbarui status pesanan.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
        setTimeout(() => processingAutoOrderIds.delete(dbId), 2000);
    }
};

window.promptDeleteOrder = function(dbId, invoiceId) {
    window.openConfirm("Hapus Pesanan", `Hapus permanen data Invoice <b>${window.escapeHtml(invoiceId)}</b>?`, async (confirmed) => {
        if (confirmed) {
            await deleteDoc(doc(db, pathOrders, dbId));
            window.showToast("Terhapus", `Invoice ${invoiceId} berhasil dihapus.`, "success");
        }
    }, 'delete');
};

/* ============================================================================
 * [FEATURE-08] GUDANG STOK VAULT MULTI-KUOTA SHARING (1 AKUN = N PEMBELI)
 * ============================================================================ */
window.toggleStockQuotaInput = function() {
    const mode = document.getElementById('stock-mode-select')?.value || 'PRIVATE';
    const quotaBox = document.getElementById('stock-sharing-quota-box');
    const reusableChk = document.getElementById('stock-reusable-toggle');

    if (quotaBox) quotaBox.style.display = mode === 'SHARING' ? 'block' : 'none';
    if (reusableChk) reusableChk.checked = (mode === 'REUSABLE');
};

window.updateAdminStockItemSelect = function() {
    const brandName = document.getElementById('stock-brand-select').value;
    const itemSel = document.getElementById('stock-item-select');
    const modeSel = document.getElementById('stock-mode-select');
    let html = '<option value="">-- Pilih Varian Item --</option>';
    if (!brandName) { itemSel.innerHTML = html; return; }
    
    const brand = groupedBrands.find(b => b.brandName === brandName);
    if (brand) {
        if (modeSel) {
            if (brand.type === 'tools') modeSel.value = 'REUSABLE';
            else if (brand.brandName.toLowerCase().includes('sharing')) modeSel.value = 'SHARING';
            else modeSel.value = 'PRIVATE';
            window.toggleStockQuotaInput();
        }
        brand.items.forEach(i => {
            html += `<option value="${window.escapeHtml(i.name)}">${window.escapeHtml(i.name)}</option>`;
        });
    }
    itemSel.innerHTML = html;
};

window.renderAdminStocksByCategory = async function() {
    const brand = document.getElementById('view-stock-category').value;
    const tb = document.getElementById('admin-stock-list');
    const mobContainer = document.getElementById('admin-stock-mobile-cards');
    const readyCountEl = document.getElementById('stock-ready-count');
    const sharingCountEl = document.getElementById('stock-sharing-count');
    const reusableCountEl = document.getElementById('stock-reusable-count');
    const usedCountEl = document.getElementById('stock-used-count');
    
    if (!brand) {
        if (readyCountEl) readyCountEl.innerText = '0';
        if (sharingCountEl) sharingCountEl.innerText = '0';
        if (reusableCountEl) reusableCountEl.innerText = '0';
        if (usedCountEl) usedCountEl.innerText = '0';
        if (tb) tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 3rem;">Pilih kategori brand di atas untuk menampilkan daftar stok.</td></tr>';
        if (mobContainer) mobContainer.innerHTML = '<div class="text-center text-muted p-3">Pilih kategori brand di atas untuk menampilkan daftar stok.</div>';
        return;
    }
    
    if (tb) tb.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data gudang stok...</td></tr>';
    if (mobContainer) mobContainer.innerHTML = '<div class="text-center p-3"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data gudang stok...</div>';
    
    try {
        const q = query(collection(db, pathStocks), where("brand", "==", brand));
        const snap = await getDocs(q);
        let localStocks = [];
        snap.forEach(d => localStocks.push({ dbId: d.id, ...d.data() }));
        
        let totalReadySlots = 0;
        let sharingDocsCount = 0;
        let reusableDocsCount = 0;
        let usedDocsCount = 0;

        localStocks.forEach(s => {
            const maxQ = parseInt(s.maxQuota || 1, 10);
            const usedQ = parseInt(s.usedQuota || 0, 10);
            if (s.status === 'Ready' && s.isReusable) {
                reusableDocsCount++;
            } else if (s.status === 'Ready' && usedQ < maxQ) {
                totalReadySlots += (maxQ - usedQ);
                if (maxQ > 1) sharingDocsCount++;
            } else {
                usedDocsCount++;
            }
        });

        if (readyCountEl) readyCountEl.innerText = String(totalReadySlots);
        if (sharingCountEl) sharingCountEl.innerText = String(sharingDocsCount);
        if (reusableCountEl) reusableCountEl.innerText = String(reusableDocsCount);
        if (usedCountEl) usedCountEl.innerText = String(usedDocsCount);

                if (localStocks.length === 0) {
            if (tb) tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Belum ada stok untuk produk ini.</td></tr>';
            if (mobContainer) mobContainer.innerHTML = '<div class="text-center text-muted p-3">Belum ada stok untuk produk ini.</div>';
            return;
        }
        
        localStocks.sort((a, b) => b.createdAt - a.createdAt);
        let tableHtml = '';
        let mobHtml = '';

        localStocks.forEach((s, i) => {
            const parts = (s.data || '').split('|');
            const em = parts[0] || '-';
            const pw = parts[1] || '-';
            const dur = parts[2] || '-';
            const safeCredCopy = escapeJsStr(`${em} | ${pw}`);

            const maxQ = parseInt(s.maxQuota || 1, 10);
            const usedQ = parseInt(s.usedQuota || 0, 10);
            const pctUsed = Math.min(100, Math.round((usedQ / maxQ) * 100));

            let badge = '';
            let quotaProgressHtml = '';

            if (s.status === 'Ready' && s.isReusable) {
                badge = `<span class="status-badge status-tools"><i class="fa-solid fa-infinity"></i> REUSABLE (${s.sentCount || 0}x Terkirim)</span>`;
            } else if (maxQ > 1) {
                const isFull = usedQ >= maxQ || s.status !== 'Ready';
                badge = isFull
                    ? `<span class="status-badge status-failed"><i class="fa-solid fa-users"></i> SHARING HABIS (${usedQ}/${maxQ})</span>`
                    : `<span class="status-badge status-success"><i class="fa-solid fa-users"></i> SHARING READY (${usedQ}/${maxQ} Terpakai)</span>`;
                quotaProgressHtml = `
                    <div class="stock-quota-bar-mini">
                        <div class="stock-quota-fill-mini" style="width:${pctUsed}%; background:${isFull ? 'var(--danger)' : 'var(--primary)'};"></div>
                    </div>
                    <small class="text-muted text-xs d-block mt-1">Sisa Slot: <b>${Math.max(0, maxQ - usedQ)}</b> dari <b>${maxQ}</b> Pembeli</small>`;
            } else if (s.status === 'Ready' && usedQ < maxQ) {
                badge = `<span class="status-badge status-success">PRIVATE READY (0/1)</span>`;
            } else {
                badge = `<span class="status-badge status-failed">TERJUAL ${s.orderId ? `(#${window.escapeHtml(s.orderId)})` : ''}</span>`;
            }

            tableHtml += `<tr>
                <td><strong>${i + 1}</strong></td>
                <td><strong class="text-dark">${window.escapeHtml(s.brand)}</strong><br><small class="text-primary fw-bold">${window.escapeHtml(s.itemName || '-')}</small></td>
                <td>
                    <strong class="text-dark">${window.escapeHtml(em)}</strong>
                    <button class="btn-icon-only" style="width:22px; height:22px; font-size:0.65rem; margin-left:4px;" onclick="window.copyTextToClipboard('${safeCredCopy}', 'Data Stok')"><i class="fa-regular fa-copy"></i></button>
                    <br><small class="text-muted">${window.escapeHtml(pw)}</small>
                </td>
                <td class="text-dark text-xs">${window.escapeHtml(dur)}</td>
                <td>
                    ${badge}
                    ${quotaProgressHtml}
                </td>
                <td>
                    <div class="flex-gap">
                        <button class="btn-icon-only" style="width:30px; height:30px;" onclick="window.changeStockMaxQuotaPrompt('${s.dbId}', ${maxQ}, ${usedQ})" title="Atur Kuota Pembeli (Sharing)"><i class="fa-solid fa-users-gear"></i></button>
                        <button class="btn-icon-only" style="width:30px; height:30px;" onclick="window.toggleStockReusableMode('${s.dbId}', ${!s.isReusable})" title="Ubah Mode Reusable Tanpa Batas"><i class="fa-solid fa-repeat"></i></button>
                        <button aria-label="Hapus Stok" class="btn-icon-only text-danger" style="width:30px; height:30px;" onclick="window.deleteStock('${s.dbId}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;

            mobHtml += `
            <div class="stock-mob-card">
                <div class="stock-mob-top">
                    <strong class="text-dark text-sm">#${i + 1} &bull; ${window.escapeHtml(s.itemName || s.brand)}</strong>
                    ${badge}
                </div>
                <div class="stock-mob-cred">
                    <div>
                        <div><b>Email/Link:</b> ${window.escapeHtml(em)}</div>
                        <div><b>Pass/Kode:</b> ${window.escapeHtml(pw)}</div>
                    </div>
                    <button class="btn-icon-only" style="width:32px; height:32px; flex-shrink:0;" onclick="window.copyTextToClipboard('${safeCredCopy}', 'Data Stok')">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                </div>
                ${quotaProgressHtml}
                <div class="stock-mob-foot">
                    <span><i class="fa-solid fa-circle-info"></i> ${window.escapeHtml(dur)}</span>
                    <div class="flex-gap">
                        <button class="btn btn-outline btn-sm" style="padding:3px 8px; min-height:28px;" onclick="window.changeStockMaxQuotaPrompt('${s.dbId}', ${maxQ}, ${usedQ})">
                            <i class="fa-solid fa-users-gear"></i> Kuota (${maxQ})
                        </button>
                        <button class="btn btn-outline btn-sm" style="padding:3px 8px; min-height:28px;" onclick="window.toggleStockReusableMode('${s.dbId}', ${!s.isReusable})">
                            <i class="fa-solid fa-repeat"></i> ${s.isReusable ? '1x' : '∞'}
                        </button>
                        <button class="btn btn-danger btn-sm" style="padding:3px 10px; min-height:28px;" onclick="window.deleteStock('${s.dbId}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        });

        if (tb) tb.innerHTML = tableHtml;
        if (mobContainer) mobContainer.innerHTML = mobHtml;
    } catch (e) {
        if (tb) tb.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Gagal mengambil data stok.</td></tr>';
        if (mobContainer) mobContainer.innerHTML = '<div class="text-center text-danger p-3">Gagal mengambil data stok.</div>';
    }
};

window.changeStockMaxQuotaPrompt = async function(dbId, currentMax = 1, currentUsed = 0) {
    const input = prompt(`Ubah kuota maksimal pembeli (Sharing) untuk baris akun ini:\n(Saat ini terpakai: ${currentUsed} pembeli)`, String(currentMax));
    if (input === null) return;
    const newMax = parseInt(input, 10);
    if (isNaN(newMax) || newMax < 1) {
        window.customAlert('Input Tidak Valid', 'Kuota minimal adalah 1 pembeli.', 'warning');
        return;
    }
    try {
        await updateDoc(doc(db, pathStocks, dbId), {
            maxQuota: newMax,
            stockMode: newMax > 1 ? 'SHARING' : 'PRIVATE',
            status: currentUsed < newMax ? 'Ready' : 'Used'
        });
        window.showToast('Kuota Diperbarui', `Kuota akun diubah menjadi ${newMax} pembeli.`, 'success');
        window.renderAdminStocksByCategory();
    } catch (e) {
        window.customAlert('Gagal', 'Tidak dapat mengubah kuota stok.', 'error');
    }
};

window.toggleStockReusableMode = async function(dbId, newReusableState) {
    try {
        await updateDoc(doc(db, pathStocks, dbId), {
            isReusable: Boolean(newReusableState),
            status: 'Ready'
        });
        window.showToast('Mode Stok Diubah', newReusableState ? 'Stok disetel ke Mode Kirim Berulang-ulang (∞).' : 'Stok disetel ke Mode Kuota/Sekali Pakai.', 'success');
        window.renderAdminStocksByCategory();
    } catch (e) {
        window.customAlert('Gagal', 'Gagal mengubah mode stok.', 'error');
    }
};

window.addStockMassal = async function() {
    const brand = document.getElementById('stock-brand-select').value;
    const itemName = document.getElementById('stock-item-select').value;
    const stockMode = document.getElementById('stock-mode-select')?.value || 'PRIVATE';
    const defaultSharingQuota = Math.max(1, parseInt(document.getElementById('stock-sharing-quota')?.value || '5', 10));
    const rawData = document.getElementById('stock-bulk-input').value.trim();
    
    if (!brand || !itemName || !rawData) {
        window.customAlert('Data Belum Lengkap', 'Pilih produk, varian item, dan masukkan minimal 1 baris data akun atau link tools.', 'warning');
        return;
    }
    
    const btn = document.getElementById('btn-add-stock');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;
    try {
        const lines = rawData.split('\n').filter(l => l.trim() !== '');
        let count = 0;
        let totalSlotsAdded = 0;

        for (const rawLine of lines) {
            let lineText = rawLine.trim();
            let lineMaxQuota = stockMode === 'SHARING' ? defaultSharingQuota : 1;
            const isReusable = (stockMode === 'REUSABLE');

            // Cek jika baris memiliki sintaks kustom kuota "|| N" di ujung (Contoh: email|pass|profil || 4)
            if (lineText.includes('||')) {
                const splitQuota = lineText.split('||');
                lineText = splitQuota[0].trim();
                const parsedQ = parseInt(splitQuota[1].trim(), 10);
                if (!isNaN(parsedQ) && parsedQ >= 1) {
                    lineMaxQuota = parsedQ;
                }
            }

            const cleanLine = lineText.includes('|') ? lineText : `${lineText}|-|Akses Otomatis`;
            await addDoc(collection(db, pathStocks), {
                brand: brand,
                itemName: itemName,
                data: cleanLine,
                stockMode: isReusable ? 'REUSABLE' : (lineMaxQuota > 1 ? 'SHARING' : 'PRIVATE'),
                maxQuota: isReusable ? 999999 : lineMaxQuota,
                usedQuota: 0,
                buyers: [],
                isReusable: isReusable,
                sentCount: 0,
                status: 'Ready',
                createdAt: Date.now()
            });
            count++;
            totalSlotsAdded += lineMaxQuota;
        }
        document.getElementById('stock-bulk-input').value = '';
        
        const viewSel = document.getElementById('view-stock-category');
        if (viewSel) {
            viewSel.value = brand;
            window.renderAdminStocksByCategory();
        }
        
        const modeDesc = stockMode === 'REUSABLE'
            ? '(Mode Kirim Berulang ∞)'
            : (stockMode === 'SHARING' ? `(Mode Sharing: Total ${totalSlotsAdded} Slot Pembeli)` : '(Mode Private 1x Pakai)');

        window.customAlert('Berhasil Disimpan', `<b>${count} baris akun ${modeDesc}</b> berhasil ditambahkan ke gudang <b>${window.escapeHtml(brand)} - ${window.escapeHtml(itemName)}</b>.`, 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menambah stok ke database.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteStock = async function(dbId) {
    window.openConfirm('Hapus Stok', 'Hapus baris stok ini secara permanen?', async (confirmed) => {
        if (confirmed) {
            await deleteDoc(doc(db, pathStocks, dbId));
            window.showToast('Terhapus', 'Stok berhasil dihapus.', 'info');
            window.renderAdminStocksByCategory(); 
        }
    }, 'delete');
};

window.deleteUsedStocksByCategory = async function() {
    const brand = document.getElementById('view-stock-category').value;
    if (!brand) {
        window.customAlert('Pilih Kategori', 'Pilih kategori produk terlebih dahulu di dropdown.', 'warning');
        return;
    }
    window.openConfirm('Bersihkan Stok Terjual', `Hapus semua stok berstatus <b>Terjual (Used)</b> pada produk <b>${window.escapeHtml(brand)}</b>?`, async (confirmed) => {
        if (confirmed) {
            try {
                const q = query(collection(db, pathStocks), where("brand", "==", brand), where("status", "==", "Used"));
                const snap = await getDocs(q);
                let delCount = 0;
                for (const d of snap.docs) {
                    await deleteDoc(doc(db, pathStocks, d.id));
                    delCount++;
                }
                window.showToast('Gudang Dibersihkan', `${delCount} stok terjual berhasil dihapus.`, 'success');
                window.renderAdminStocksByCategory();
            } catch (e) {
                window.customAlert('Gagal', 'Gagal membersihkan stok terjual.', 'error');
            }
        }
    }, 'delete');
};
/* ======================== END OF [FEATURE-08] ============================= */

// ==========================================
// MANAJEMEN ULASAN PEMBELI
// ==========================================
window.renderReviews = function() {
    const list = document.getElementById('admin-reviews-list');
    if (!list) return;
    
    if (reviewsList.length === 0) {
        list.innerHTML = '<div class="text-center text-muted w-100 dashboard-panel" style="padding: 3rem;"><i class="fa-solid fa-comment-slash" style="font-size:2.5rem; margin-bottom:10px; display:block;"></i>Belum ada ulasan dari pembeli.</div>';
        return;
    }
    
    let html = '';
    reviewsList.forEach(r => {
        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += `<i class="fa-${i < r.rating ? 'solid' : 'regular'} fa-star text-warning text-xs"></i>`;
        }
        
        const invTag = r.orderId ? `<span class="status-badge status-unpaid">#${window.escapeHtml(r.orderId)}</span>` : '';
        const adminReplyHtml = r.adminReply 
            ? `<div class="mt-2 text-sm bg-primary-light border-primary" style="padding:10px 12px; border-radius:8px;">
                 <strong class="text-primary"><i class="fa-solid fa-reply"></i> Balasan Admin:</strong><br>
                 <span class="text-dark">${window.escapeHtml(r.adminReply)}</span>
               </div>` 
            : '';

        html += `
        <div class="dashboard-panel flex-between align-start-mobile mb-2" style="padding: 1.2rem; gap: 15px;">
            <div style="flex:1;">
                <div class="flex-wrap-gap align-center mb-1">
                    <strong class="text-dark" style="font-size:1rem;">${window.escapeHtml(r.userName || 'Pelanggan')}</strong>
                    <small class="text-muted">(${window.escapeHtml(r.userEmail || '-')})</small>
                    ${invTag}
                </div>
                <div class="mb-2">${stars} <span class="text-primary fw-bold text-sm ms-2">${window.escapeHtml(r.brandName)}</span></div>
                <p class="bg-bg border-border text-dark" style="padding:10px 12px; border-radius:8px; margin:0; font-size:0.9rem;">"${window.escapeHtml(r.text)}"</p>
                ${adminReplyHtml}
                <small class="text-muted text-xs d-block mt-2"><i class="fa-regular fa-clock"></i> ${new Date(r.timestamp).toLocaleString('id-ID')}</small>
            </div>
            
            <div class="flex-gap align-center">
                <button class="btn btn-primary btn-sm" onclick="window.promptReplyReview('${r.dbId}')">
                    <i class="fa-solid fa-reply"></i> ${r.adminReply ? 'Edit Balasan' : 'Balas'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteReview('${r.dbId}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
};

window.promptReplyReview = function(dbId) {
    const rev = reviewsList.find(r => r.dbId === dbId);
    if (!rev) return;

    document.getElementById('reply-review-id').value = dbId;
    document.getElementById('reply-review-text').innerText = `"${rev.text}"`;
    document.getElementById('reply-review-input').value = rev.adminReply || '';
    
    window.openModal('modal-reply-review');
};

window.submitReviewReply = async function() {
    const dbId = document.getElementById('reply-review-id').value;
    const replyTxt = document.getElementById('reply-review-input').value.trim();
    if (!replyTxt) return window.customAlert('Peringatan', 'Kolom balasan tidak boleh kosong.', 'warning');
    
    const btn = document.getElementById('btn-save-review-reply');
    const og = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        await updateDoc(doc(db, pathReviews, dbId), { adminReply: replyTxt });
        window.closeModal('modal-reply-review');
        window.showToast('Tersimpan', 'Balasan ulasan berhasil dipublikasikan.', 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan balasan ulasan.', 'error');
    } finally {
        btn.innerHTML = og; btn.disabled = false;
    }
};

window.deleteReview = async function(dbId) {
    window.openConfirm('Hapus Ulasan', 'Hapus ulasan pembeli ini secara permanen?', async (confirmed) => {
        if (confirmed) {
            await deleteDoc(doc(db, pathReviews, dbId));
            window.showToast('Terhapus', 'Ulasan berhasil dihapus.', 'info');
        }
    }, 'delete');
};

/* ============================================================================
 * [FEATURE-04, FEATURE-05 & FEATURE-09] MANAJEMEN KATALOG, BUILDER VARIAN,
 * DURASI HARI, DESKRIPSI VARIAN OPSIONAL & INPUT DATA TUJUAN APP OPSIONAL
 * ============================================================================ */
window.setAdminProdFilter = function(filterType, btnEl) {
    currentAdminProdFilter = filterType;
    document.querySelectorAll('#tab-products .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    window.renderAdminProducts();
};

window.renderAdminProducts = function() {
    const container = document.getElementById('admin-prod-list');
    if (!container) return;

    const searchQ = (document.getElementById('admin-search-prod')?.value || '').trim().toLowerCase();
    let list = currentAdminProdFilter === 'all' ? groupedBrands : groupedBrands.filter(b => b.type === currentAdminProdFilter);

    if (searchQ) {
        list = list.filter(b => b.brandName.toLowerCase().includes(searchQ) || b.items.some(i => i.name.toLowerCase().includes(searchQ)));
    }

    if (list.length === 0) {
        container.innerHTML = `<div class="dashboard-panel text-center text-muted" style="grid-column: 1/-1; padding: 2.5rem;">Tidak ada produk ditemukan pada kategori/pencarian ini.</div>`;
        return;
    }
    
    let html = '';
    list.forEach(b => {
        const safeJsBrand = escapeJsStr(b.brandName);
        const imgHtml = b.imgUrlBase64
            ? `<img src="${b.imgUrlBase64}" style="width:56px; height:56px; object-fit:cover; border-radius:14px; border:var(--brutal-border);" loading="lazy" alt="${window.escapeHtml(b.brandName)}">`
            : `<div style="width:56px; height:56px; background:var(--primary); color:white; display:flex; justify-content:center; align-items:center; border-radius:14px; border:var(--brutal-border); font-weight:900; font-size:1.4rem;">${window.escapeHtml(b.brandName.charAt(0))}</div>`;
        
        const itemsCount = b.items.length;
        const isSoldOut = b.items.every(i => i.soldOut || (typeof i.stockCount === 'number' && i.stockCount === 0));
        const prices = b.items.map(i => i.priceNum || 0).filter(p => p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const hasDurationItem = b.items.some(i => i.durationDays && i.durationDays > 0);
        
        let typeBadge = '<span class="status-badge status-unpaid">📱 APLIKASI</span>';
        if (b.type === 'game') typeBadge = '<span class="status-badge status-pending">🎮 GAME</span>';
        else if (b.type === 'tools') typeBadge = '<span class="status-badge status-tools">🛠️ TOOLS</span>';

        let statusBadgeHtml = isSoldOut ? '<span class="status-badge status-failed">HABIS</span>' : '<span class="status-badge status-success">AKTIF</span>';
        if (b.isGangguan) statusBadgeHtml = '<span class="status-badge status-pending">GANGGUAN</span>';
        const durBadgeHtml = hasDurationItem ? '<span class="status-badge status-tools"><i class="fa-solid fa-stopwatch"></i> BERDURASI</span>' : '';
        
        html += `
        <div class="admin-prod-card">
            <div>
                <div class="admin-prod-card-head">
                    ${imgHtml}
                    <div style="flex:1; overflow:hidden;">
                        <div class="flex-wrap-gap mb-1">${typeBadge} ${statusBadgeHtml} ${durBadgeHtml}</div>
                        <strong class="text-dark" style="font-size:1.08rem; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(b.brandName)}</strong>
                        <span class="text-xs text-muted fw-bold">${itemsCount} Varian &bull; Mulai Rp${minPrice.toLocaleString('id-ID')}</span>
                    </div>
                </div>
            </div>
            <div class="admin-prod-card-actions">
                <button class="btn btn-primary btn-sm flex-1" onclick="window.openProductGroupModal('${safeJsBrand}')">
                    <i class="fa-solid fa-pen-to-square"></i> Edit Varian & Durasi
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteProductGroup('${safeJsBrand}')" title="Hapus Produk">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

window.toggleInputTypeBox = function() {
    const type = document.getElementById('manage-prod-type').value;
    const inputGroup = document.getElementById('group-tipe-input');
    const appTargetGroup = document.getElementById('group-app-target-config');

    if (inputGroup) {
        inputGroup.style.display = (type === 'game' || type === 'tools') ? 'block' : 'none';
    }
    if (appTargetGroup) {
        appTargetGroup.style.display = (type === 'app') ? 'block' : 'none';
    }
};

window.toggleAppTargetCustomFields = function() {
    const chk = document.getElementById('manage-prod-require-app-target');
    const box = document.getElementById('app-target-custom-fields');
    if (box) {
        box.style.display = (chk && chk.checked) ? 'grid' : 'none';
    }
};

window.selectInputType = function(val, el) {
    document.querySelectorAll('#group-tipe-input .type-card').forEach(c => c.classList.remove('active'));
    if (el) {
        el.classList.add('active');
        const radio = el.querySelector('input');
        if (radio) radio.checked = true;
    }
};

function updateProdModalPreviewImg(b64) {
    const imgPrev = document.getElementById('manage-prod-img-preview');
    const placeholder = document.getElementById('manage-prod-img-placeholder');
    if (b64) {
        if (imgPrev) { imgPrev.src = b64; imgPrev.style.display = 'block'; }
        if (placeholder) placeholder.style.display = 'none';
    } else {
        if (imgPrev) { imgPrev.src = ''; imgPrev.style.display = 'none'; }
        if (placeholder) placeholder.style.display = 'flex';
    }
}

window.openProductGroupModal = function(brandName = null) {
    currentGroupNominals = [];
    const reqAppChk = document.getElementById('manage-prod-require-app-target');
    const targetLblInp = document.getElementById('manage-prod-target-label');
    const targetPhInp = document.getElementById('manage-prod-target-placeholder');

    if (brandName) {
        const group = groupedBrands.find(b => b.brandName === brandName);
        if (group) {
            document.getElementById('modal-prod-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Produk: ${window.escapeHtml(brandName)}`;
            document.getElementById('manage-prod-old-brand').value = brandName;
            document.getElementById('manage-prod-type').value = group.type || 'app';
            document.getElementById('manage-prod-brand').value = group.brandName;
            document.getElementById('manage-prod-img-base64').value = group.imgUrlBase64 || '';
            document.getElementById('manage-prod-desc').value = group.desc || '';
            document.getElementById('manage-prod-file-name').innerText = group.imgUrlBase64 ? 'Ikon tersimpan (Klik gambar untuk mengganti)' : 'Klik kotak kamera untuk upload ikon';
            updateProdModalPreviewImg(group.imgUrlBase64 || '');
            
            const gangguanEl = document.getElementById('manage-prod-gangguan');
            if (gangguanEl) gangguanEl.checked = group.isGangguan || false;

            const firstItem = group.items[0] || {};
            if (reqAppChk) reqAppChk.checked = Boolean(group.requireAppTarget || firstItem.requireAppTarget);
            if (targetLblInp) targetLblInp.value = group.appTargetLabel || firstItem.appTargetLabel || '';
            if (targetPhInp) targetPhInp.value = group.appTargetPlaceholder || firstItem.appTargetPlaceholder || '';
            window.toggleAppTargetCustomFields();
            
            currentGroupNominals = group.items.map(i => ({
                dbId: i.dbId,
                name: i.name,
                priceNum: i.priceNum,
                durationDays: typeof i.durationDays === 'number' ? i.durationDays : 0,
                variantDesc: i.variantDesc || i.description || '',
                stockCount: typeof i.stockCount === 'number' ? i.stockCount : null,
                processType: i.processType || 'auto',
                soldOut: i.soldOut || false
            }));
            
            const allSoldOut = currentGroupNominals.length > 0 && currentGroupNominals.every(n => n.soldOut);
            document.getElementById('manage-prod-soldout').checked = allSoldOut;
            
            let inpType = firstItem.inputType || (group.type === 'game' ? 'id_zone' : 'none');
            const targetEl = document.querySelector(`#group-tipe-input .type-card input[value="${inpType}"]`);
            if (targetEl) window.selectInputType(inpType, targetEl.parentElement);
        }
    } else {
        document.getElementById('modal-prod-title').innerHTML = '<i class="fa-solid fa-box-open text-primary"></i> Tambah Produk Baru';
        document.getElementById('manage-prod-old-brand').value = '';
        document.getElementById('manage-prod-type').value = 'app';
        document.getElementById('manage-prod-brand').value = '';
        document.getElementById('manage-prod-desc').value = '';
        document.getElementById('manage-prod-img-base64').value = '';
        document.getElementById('manage-prod-file-name').innerText = 'Klik kotak kamera untuk mengunggah ikon (Auto WebP).';
        updateProdModalPreviewImg('');
        document.getElementById('manage-prod-soldout').checked = false;
        
        const gangguanEl = document.getElementById('manage-prod-gangguan');
        if (gangguanEl) gangguanEl.checked = false;

        if (reqAppChk) reqAppChk.checked = false;
        if (targetLblInp) targetLblInp.value = '';
        if (targetPhInp) targetPhInp.value = '';
        window.toggleAppTargetCustomFields();
        
        const defaultEl = document.querySelector(`#group-tipe-input .type-card input[value="none"]`);
        if (defaultEl) window.selectInputType('none', defaultEl.parentElement);
    }
    
    window.toggleInputTypeBox();
    window.clearTempNominalInput();
    window.renderTempNominals();
    window.openModal('modal-manage-product');
};

window.clearTempNominalInput = function() {
    document.getElementById('temp-nom-name').value = '';
    document.getElementById('temp-nom-price').value = '';
    const durInp = document.getElementById('temp-nom-duration');
    if (durInp) durInp.value = '';
    const stockInp = document.getElementById('temp-nom-stock');
    if (stockInp) stockInp.value = '';
    const descInp = document.getElementById('temp-nom-desc');
    if (descInp) descInp.value = '';
    document.getElementById('temp-nom-status').value = 'auto';
    document.getElementById('temp-nom-index').value = '-1';
    document.getElementById('btn-add-item').innerHTML = '<i class="fa-solid fa-plus"></i> <span>Tambah Varian</span>';
    document.getElementById('btn-cancel-edit-item').style.display = 'none';
};

window.editTempNominal = function(idx) {
    const item = currentGroupNominals[idx];
    if (!item) return;
    document.getElementById('temp-nom-name').value = item.name;
    document.getElementById('temp-nom-price').value = item.priceNum;
    const durInp = document.getElementById('temp-nom-duration');
    if (durInp) durInp.value = item.durationDays > 0 ? item.durationDays : '';
    const stockInp = document.getElementById('temp-nom-stock');
    if (stockInp) stockInp.value = typeof item.stockCount === 'number' ? item.stockCount : '';
    const descInp = document.getElementById('temp-nom-desc');
    if (descInp) descInp.value = item.variantDesc || '';
    document.getElementById('temp-nom-status').value = item.processType;
    document.getElementById('temp-nom-index').value = idx;
    document.getElementById('btn-add-item').innerHTML = '<i class="fa-solid fa-check"></i> <span>Update Varian</span>';
    document.getElementById('btn-cancel-edit-item').style.display = 'inline-flex';
};

window.cloneTempNominal = function(idx) {
    const item = currentGroupNominals[idx];
    if (!item) return;
    currentGroupNominals.splice(idx + 1, 0, {
        dbId: null,
        name: item.name + ' (Copy)',
        priceNum: item.priceNum,
        durationDays: item.durationDays || 0,
        variantDesc: item.variantDesc || '',
        stockCount: item.stockCount,
        processType: item.processType,
        soldOut: item.soldOut
    });
    window.renderTempNominals();
    window.showToast('Varian Dikloning', 'Silakan sesuaikan nama atau harga varian hasil duplikasi.', 'info');
};

window.adjustAllTempPrices = function(deltaAmount) {
    if (currentGroupNominals.length === 0) return;
    currentGroupNominals.forEach(n => {
        const nextPrice = (n.priceNum || 0) + deltaAmount;
        n.priceNum = nextPrice > 500 ? nextPrice : 500;
    });
    window.renderTempNominals();
    window.showToast('Harga Disesuaikan', `Seluruh varian diubah sebesar ${deltaAmount > 0 ? '+' : ''}Rp${deltaAmount.toLocaleString('id-ID')}`, 'info');
};

window.sortTempNominalsByPrice = function() {
    currentGroupNominals.sort((a, b) => (a.priceNum || 0) - (b.priceNum || 0));
    window.renderTempNominals();
};

window.addOrUpdateTempNominal = function() {
    const idx = parseInt(document.getElementById('temp-nom-index').value);
    const name = document.getElementById('temp-nom-name').value.trim();
    const priceNum = parseInt(document.getElementById('temp-nom-price').value) || 0;
    const durationDays = Math.max(0, parseInt(document.getElementById('temp-nom-duration')?.value || '0', 10) || 0);
    const rawStock = document.getElementById('temp-nom-stock')?.value.trim() || '';
    const stockCount = rawStock !== '' && !isNaN(parseInt(rawStock)) ? Math.max(0, parseInt(rawStock)) : null;
    const variantDesc = document.getElementById('temp-nom-desc')?.value.trim() || '';
    const processType = document.getElementById('temp-nom-status').value || 'auto';

    if (!name || priceNum <= 0) {
        window.customAlert('Input Belum Lengkap', 'Nama Varian dan Harga Jual harus diisi dengan benar.', 'warning');
        return;
    }
    
    if (idx >= 0) {
        currentGroupNominals[idx].name = name;
        currentGroupNominals[idx].priceNum = priceNum;
        currentGroupNominals[idx].durationDays = durationDays;
        currentGroupNominals[idx].variantDesc = variantDesc;
        currentGroupNominals[idx].stockCount = stockCount;
        currentGroupNominals[idx].processType = processType;
        if (stockCount === 0) currentGroupNominals[idx].soldOut = true;
    } else {
        currentGroupNominals.push({
            dbId: null,
            name,
            priceNum,
            durationDays,
            variantDesc,
            stockCount,
            processType,
            soldOut: stockCount === 0
        });
    }
    
    window.clearTempNominalInput();
    document.getElementById('manage-prod-soldout').checked = false; 
    window.renderTempNominals();
};

window.removeTempNominal = function(index) {
    currentGroupNominals.splice(index, 1);
    window.renderTempNominals();
};

window.toggleIndividualSoldOut = function(index, isChecked) {
    currentGroupNominals[index].soldOut = isChecked;
    const allSoldOut = currentGroupNominals.length > 0 && currentGroupNominals.every(n => n.soldOut);
    document.getElementById('manage-prod-soldout').checked = allSoldOut;
};

window.toggleAllSoldOut = function(isChecked) {
    currentGroupNominals.forEach(n => n.soldOut = isChecked);
    window.renderTempNominals();
};

window.renderTempNominals = function() {
    const container = document.getElementById('manage-prod-nominals-list');
    const countSpan = document.getElementById('temp-nom-count');
    if (countSpan) countSpan.innerText = currentGroupNominals.length;
    if (!container) return;
    
    if (currentGroupNominals.length === 0) {
        container.innerHTML = `<div class="text-center text-muted text-sm" style="padding: 14px;">Belum ada varian harga. Isi form di atas lalu klik <b>Tambah Varian</b>.</div>`;
        return;
    }
    
    let html = '';
    currentGroupNominals.forEach((nom, index) => {
        const isSold = nom.soldOut ? 'checked' : '';
        const badgeType = nom.processType === 'manual'
            ? `<span class="status-badge status-pending" style="font-size:0.6rem; padding:2px 6px;">MANUAL</span>`
            : `<span class="status-badge status-success" style="font-size:0.6rem; padding:2px 6px;">OTOMATIS</span>`;
        const durBadge = nom.durationDays > 0
            ? `<span class="status-badge status-primary" style="font-size:0.6rem; padding:2px 6px; background:rgba(37,99,235,0.14); color:var(--primary-light);"><i class="fa-regular fa-clock"></i> ${nom.durationDays} Hari</span>`
            : '';
        const stockLabel = typeof nom.stockCount === 'number'
            ? `<span class="status-badge status-tools" style="font-size:0.6rem; padding:2px 6px;">Stok: ${nom.stockCount}</span>`
            : `<span class="text-muted text-xs">Stok: ∞</span>`;
        const descLine = nom.variantDesc
            ? `<div class="text-muted text-xs mt-1"><i class="fa-regular fa-file-lines"></i> ${window.escapeHtml(nom.variantDesc)}</div>`
            : '';

        html += `
        <div class="flex-between align-center bg-surface" style="padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--border); margin-bottom: 8px; flex-wrap:wrap; gap:8px;">
            <div style="flex:1; min-width:200px;">
                <div class="fw-bold text-dark text-sm">${window.escapeHtml(nom.name)} ${badgeType} ${durBadge} ${stockLabel}</div>
                <div class="text-primary fw-bold text-xs">Rp${nom.priceNum.toLocaleString('id-ID')}</div>
                ${descLine}
            </div>
            <div class="flex-gap align-center">
                <label class="text-xs text-danger fw-bold pointer flex-gap align-center" style="margin-right:4px;">
                    <input type="checkbox" class="large-checkbox" style="width:16px; height:16px;" onchange="window.toggleIndividualSoldOut(${index}, this.checked)" ${isSold}> Habis
                </label>
                <button class="btn-icon-only" style="width:30px; height:30px;" onclick="window.cloneTempNominal(${index})" title="Duplikat Varian"><i class="fa-regular fa-clone"></i></button>
                <button class="btn-icon-only" style="width:30px; height:30px;" onclick="window.editTempNominal(${index})" title="Edit Varian"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon-only text-danger" style="width:30px; height:30px;" onclick="window.removeTempNominal(${index})" title="Hapus Varian"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

window.saveProductGroup = async function() {
    const type = document.getElementById('manage-prod-type').value;
    const brand = document.getElementById('manage-prod-brand').value.trim();
    const desc = document.getElementById('manage-prod-desc').value.trim();
    const imgBase64 = document.getElementById('manage-prod-img-base64').value;
    const oldBrand = document.getElementById('manage-prod-old-brand').value;
    
    const gangguanEl = document.getElementById('manage-prod-gangguan');
    const isGangguan = gangguanEl ? gangguanEl.checked : false;

    const requireAppTarget = type === 'app' && Boolean(document.getElementById('manage-prod-require-app-target')?.checked);
    const appTargetLabel = document.getElementById('manage-prod-target-label')?.value.trim() || '';
    const appTargetPlaceholder = document.getElementById('manage-prod-target-placeholder')?.value.trim() || '';
    
    let inputType = 'none';
    const checkedType = document.querySelector('input[name="manage_input_type"]:checked');
    if (checkedType) inputType = checkedType.value;
    
    if (!brand) { window.customAlert('Error', 'Nama Brand / Produk wajib diisi.', 'error'); return; }
    if (currentGroupNominals.length === 0) { window.customAlert('Error', 'Tambahkan minimal 1 varian harga ke dalam produk ini.', 'error'); return; }
    
    const btn = document.getElementById('btn-save-group');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan Produk...</span>';
    btn.disabled = true;
    try {
        const oldGroup = groupedBrands.find(b => b.brandName === oldBrand);
        const oldDbIds = oldGroup ? oldGroup.items.map(i => i.dbId) : [];
        const newDbIds = currentGroupNominals.map(n => n.dbId).filter(id => id);
        
        const toDelete = oldDbIds.filter(id => !newDbIds.includes(id));
        for (const id of toDelete) { await deleteDoc(doc(db, pathProducts, id)); }
        
        for (const nom of currentGroupNominals) {
            const prodData = {
                type: type,
                brand: brand,
                name: nom.name,
                priceNum: nom.priceNum,
                durationDays: nom.durationDays || 0,
                hasDuration: Boolean(nom.durationDays && nom.durationDays > 0),
                variantDesc: nom.variantDesc || '',
                description: nom.variantDesc || '',
                stockCount: typeof nom.stockCount === 'number' ? nom.stockCount : null,
                processType: nom.processType || 'auto',
                imgUrlBase64: imgBase64,
                desc: desc,
                soldOut: nom.soldOut,
                requireAppTarget: requireAppTarget,
                appTargetLabel: requireAppTarget ? appTargetLabel : '',
                appTargetPlaceholder: requireAppTarget ? appTargetPlaceholder : '',
                inputType: (type === 'game' || type === 'tools') ? inputType : (requireAppTarget ? 'app_target' : null),
                isGangguan: isGangguan 
            };
            if (nom.dbId) await updateDoc(doc(db, pathProducts, nom.dbId), prodData);
            else await addDoc(collection(db, pathProducts), prodData);
        }
        
        window.closeModal('modal-manage-product');
        window.showToast('Produk Tersimpan', `Seluruh varian ${brand} berhasil diperbarui.`, 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan grup produk.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteProductGroup = function(brandName) {
    window.openConfirm("Hapus Brand Produk", `Hapus seluruh varian item dalam brand <b>${window.escapeHtml(brandName)}</b>?`, async (confirmed) => {
        if (confirmed) {
            const group = groupedBrands.find(b => b.brandName === brandName);
            if (group) {
                for (const item of group.items) { await deleteDoc(doc(db, pathProducts, item.dbId)); }
                window.showToast('Terhapus', `Produk ${brandName} telah dihapus.`, 'info');
            }
        }
    }, 'delete');
};

const manageProdImgEl = document.getElementById('manage-prod-img-file');
if (manageProdImgEl) {
    manageProdImgEl.addEventListener('change', function(e) {
        if (e.target.files[0]) {
            document.getElementById('manage-prod-file-name').innerText = 'File: ' + e.target.files[0].name;
            window.resizeImageBase64(e.target.files[0], (b64) => {
                document.getElementById('manage-prod-img-base64').value = b64;
                updateProdModalPreviewImg(b64);
            }, 600, 600);
        }
    });
}
/* ======================== END OF [FEATURE-04 & 05] ======================== */

/* ============================================================================
 * [FEATURE-06] STUDIO VOUCHER & PROMO (2-KOLOM + LIVE PREVIEW + PRESET CEPAT)
 * ============================================================================ */
window.generateRandomPromoCode = function() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = 'VIPER';
    for (let i = 0; i < 4; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    const inp = document.getElementById('manage-promo-code');
    if (inp) {
        inp.value = res;
        window.updatePromoLivePreview();
    }
};

window.setPromoQuickPreset = function(type, amountVal) {
    const typeEl = document.getElementById('manage-promo-type');
    const amtEl = document.getElementById('manage-promo-amount');
    if (typeEl) typeEl.value = type;
    if (amtEl) amtEl.value = amountVal;
    window.updatePromoLivePreview();
};

window.updatePromoLivePreview = function() {
    const code = (document.getElementById('manage-promo-code')?.value || 'KODEPROMO').trim().toUpperCase();
    const type = document.getElementById('manage-promo-type')?.value || 'nominal';
    const amount = parseInt(document.getElementById('manage-promo-amount')?.value) || 0;
    const target = document.getElementById('manage-promo-target')?.value || 'all';
    const userTgt = document.getElementById('manage-promo-user')?.value || 'all';
    const minOrder = parseInt(document.getElementById('manage-promo-min-order')?.value) || 0;
    const maxUses = parseInt(document.getElementById('manage-promo-max')?.value) || 50;
    const expiry = document.getElementById('manage-promo-expiry')?.value || '';

    const prevCode = document.getElementById('prev-promo-code');
    const prevAmt = document.getElementById('prev-promo-amount');
    const prevUser = document.getElementById('prev-promo-user-badge');
    const prevMeta = document.getElementById('prev-promo-meta');

    if (prevCode) prevCode.innerText = code || 'KODEPROMO';
    if (prevAmt) {
        prevAmt.innerText = type === 'percent' ? `Diskon ${amount}%` : `Potongan Rp${amount.toLocaleString('id-ID')}`;
    }
    if (prevUser) {
        prevUser.innerText = userTgt === 'new' ? 'KHUSUS TRANSAKSI PERTAMA' : 'SEMUA PELANGGAN';
    }
    if (prevMeta) {
        const tgtStr = target === 'all' ? 'Semua Produk' : target;
        const minStr = minOrder > 0 ? ` • Min. Rp${minOrder.toLocaleString('id-ID')}` : '';
        const expStr = expiry ? ` • s/d ${expiry}` : '';
        prevMeta.innerText = `Produk: ${tgtStr} • Kuota ${maxUses}x${minStr}${expStr}`;
    }
};

window.renderAdminPromos = function() {
    const container = document.getElementById('admin-promo-list');
    if (!container) return;
    
    if (promos.length === 0) {
        container.innerHTML = '<div class="dashboard-panel text-center text-muted" style="grid-column: 1/-1; padding: 2.5rem;"><i class="fa-solid fa-ticket" style="font-size:2.2rem; display:block; margin-bottom:8px;"></i>Belum ada voucher promo yang dibuat. Klik <b>Buat Voucher Promo Baru</b> di atas.</div>';
        return;
    }

    let html = '';
    promos.forEach(p => {
        const typeStr = p.type === 'percent' ? `Diskon ${p.amount}%` : `Potongan Rp${p.amount.toLocaleString('id-ID')}`;
        const targetStr = p.targetBrand === 'all' ? 'Semua Produk' : (p.targetBrand || 'Semua');
        const userTgt = p.targetUser === 'new' ? 'Pembeli Baru' : 'Semua User';
        const minOrderStr = p.minOrder > 0 ? ` &bull; Min. Rp${p.minOrder.toLocaleString('id-ID')}` : '';
        const expStr = p.expiryDate ? `<div class="text-xs text-muted mt-1"><i class="fa-regular fa-calendar"></i> Berlaku s/d: <b>${window.escapeHtml(p.expiryDate)}</b></div>` : '';
        const used = p.usedCount || 0;
        const max = p.maxUses || 1;
        const pct = Math.min(100, Math.round((used / max) * 100));
        
        html += `
        <div class="promo-coupon-card">
            <div>
                <div class="promo-coupon-top">
                    <div class="flex-gap align-center">
                        <span class="promo-code-pill">${window.escapeHtml(p.code)}</span>
                        <button class="btn-icon-only" style="width:28px; height:28px; font-size:0.75rem;" onclick="window.copyTextToClipboard('${escapeJsStr(p.code)}', 'Kode Voucher')" title="Salin Kode"><i class="fa-regular fa-copy"></i></button>
                    </div>
                    ${p.active ? '<span class="status-badge status-success">AKTIF</span>' : '<span class="status-badge status-failed">NONAKTIF</span>'}
                </div>

                <div class="promo-coupon-body">
                    <div class="promo-discount-val">${typeStr}</div>
                    <div class="text-xs text-muted fw-bold mb-1">
                        <i class="fa-solid fa-layer-group text-primary"></i> ${window.escapeHtml(targetStr)} &bull; <i class="fa-solid fa-user-tag text-warning"></i> ${userTgt}${minOrderStr}
                    </div>
                    ${expStr}
                    <div class="promo-quota-bar">
                        <div class="promo-quota-fill" style="width: ${pct}%;"></div>
                    </div>
                    <div class="flex-between text-xs text-muted fw-bold">
                        <span>Terpakai: <b>${used}</b> dari <b>${max}</b> kuota</span>
                        <span>${pct}%</span>
                    </div>
                </div>
            </div>

            <div class="promo-coupon-foot">
                <button class="btn btn-outline btn-sm" onclick="window.openPromoModal('${p.dbId}')">
                    <i class="fa-solid fa-pen"></i> Edit Voucher
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.deletePromo('${p.dbId}')">
                    <i class="fa-solid fa-trash"></i> Hapus
                </button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
};

window.openPromoModal = function(dbId = null) {
    const targetSelect = document.getElementById('manage-promo-target');
    if (targetSelect) {
        let selHtml = '<option value="all">Semua Produk</option>';
        groupedBrands.forEach(b => { selHtml += `<option value="${window.escapeHtml(b.brandName)}">Khusus: ${window.escapeHtml(b.brandName)}</option>`; });
        targetSelect.innerHTML = selHtml;
    }
    if (dbId) {
        const p = promos.find(x => x.dbId === dbId);
        if (!p) return;
        document.getElementById('modal-promo-title').innerHTML = '<i class="fa-solid fa-ticket text-primary"></i> Edit Voucher Promo';
        document.getElementById('manage-promo-id').value = p.dbId;
        document.getElementById('manage-promo-code').value = p.code;
        document.getElementById('manage-promo-type').value = p.type || 'nominal';
        document.getElementById('manage-promo-amount').value = p.amount;
        document.getElementById('manage-promo-max').value = p.maxUses;
        if (document.getElementById('manage-promo-min-order')) document.getElementById('manage-promo-min-order').value = p.minOrder || 0;
        if (document.getElementById('manage-promo-expiry')) document.getElementById('manage-promo-expiry').value = p.expiryDate || '';
        if (targetSelect) document.getElementById('manage-promo-target').value = p.targetBrand || 'all';
        if (document.getElementById('manage-promo-user')) document.getElementById('manage-promo-user').value = p.targetUser || 'all';
        document.getElementById('manage-promo-active').checked = p.active;
    } else {
        document.getElementById('modal-promo-title').innerHTML = '<i class="fa-solid fa-ticket text-primary"></i> Studio Pembuat Kode Promo';
        document.getElementById('manage-promo-id').value = '';
        document.getElementById('manage-promo-code').value = '';
        document.getElementById('manage-promo-type').value = 'nominal';
        document.getElementById('manage-promo-amount').value = '';
        document.getElementById('manage-promo-max').value = '50';
        if (document.getElementById('manage-promo-min-order')) document.getElementById('manage-promo-min-order').value = '0';
        if (document.getElementById('manage-promo-expiry')) document.getElementById('manage-promo-expiry').value = '';
        if (targetSelect) document.getElementById('manage-promo-target').value = 'all';
        if (document.getElementById('manage-promo-user')) document.getElementById('manage-promo-user').value = 'all';
        document.getElementById('manage-promo-active').checked = true;
    }
    window.updatePromoLivePreview();
    window.openModal('modal-manage-promo');
};

window.savePromo = async function() {
    const dbId = document.getElementById('manage-promo-id').value;
    const data = {
        code: document.getElementById('manage-promo-code').value.trim().toUpperCase().replace(/\s+/g, ''),
        type: document.getElementById('manage-promo-type').value,
        amount: parseInt(document.getElementById('manage-promo-amount').value) || 0,
        targetBrand: document.getElementById('manage-promo-target') ? document.getElementById('manage-promo-target').value : 'all',
        targetUser: document.getElementById('manage-promo-user') ? document.getElementById('manage-promo-user').value : 'all',
        minOrder: parseInt(document.getElementById('manage-promo-min-order')?.value) || 0,
        expiryDate: document.getElementById('manage-promo-expiry')?.value || '',
        maxUses: parseInt(document.getElementById('manage-promo-max').value) || 0,
        active: document.getElementById('manage-promo-active').checked,
        usedCount: 0 
    };
    if (!data.code || data.amount <= 0 || data.maxUses <= 0) {
        window.customAlert('Data Tidak Valid', 'Pastikan kode voucher, nilai potongan, dan batas kuota diisi dengan benar.', 'warning');
        return;
    }
    
    const btn = document.getElementById('btn-save-promo');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;
    try {
        if (dbId) {
            delete data.usedCount; 
            await updateDoc(doc(db, pathPromos, dbId), data);
        } else {
            await addDoc(collection(db, pathPromos), data);
        }
        window.closeModal('modal-manage-promo');
        window.showToast('Promo Tersimpan', `Kode voucher ${data.code} siap digunakan.`, 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan kode promo.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deletePromo = function(dbId) {
    window.openConfirm("Hapus Promo", "Hapus kode promo ini secara permanen?", async (confirmed) => {
        if (confirmed) {
            await deleteDoc(doc(db, pathPromos, dbId));
            window.showToast('Terhapus', 'Kode promo berhasil dihapus.', 'info');
        }
    }, 'delete');
};
/* ======================== END OF [FEATURE-06] ============================= */

// ==========================================
// BERITA & KOMUNITAS WEB (DENGAN CENTANG TOMBOL PRODUK TERKAIT)
// ==========================================
function populateNewsBrandDropdown() {
    const sel = document.getElementById('manage-news-linked-brand');
    if (!sel) return;
    const curVal = sel.value;
    let html = '<option value="">-- Pilih Produk yang Ditampilkan di Berita --</option>';
    groupedBrands.forEach(b => {
        html += `<option value="${window.escapeHtml(b.brandName)}">${window.escapeHtml(b.brandName)}</option>`;
    });
    sel.innerHTML = html;
    if (curVal) sel.value = curVal;
}

window.toggleNewsProductSelect = function() {
    const chk = document.getElementById('manage-news-enable-btn');
    const box = document.getElementById('manage-news-product-box');
    if (box) box.style.display = (chk && chk.checked) ? 'block' : 'none';
};

window.renderAdminNews = function() {
    const list = document.getElementById('admin-news-list');
    if (!list) return;
    const newsData = siteSettings.newsList || [];
    if (newsData.length === 0) {
        list.innerHTML = '<p class="text-muted text-center p-3" style="grid-column: 1/-1;">Belum ada artikel berita atau pengumuman.</p>';
        return;
    }
    
    let html = '';
    newsData.forEach((t, i) => {
        const thumbHtml = t.imageUrl
            ? `<img src="${t.imageUrl}" class="admin-news-thumb" alt="Thumb">`
            : `<div class="admin-news-thumb" style="background:linear-gradient(135deg, var(--primary), #1e3a8a); display:flex; align-items:center; justify-content:center; color:#fff; font-size:2rem;"><i class="fa-solid fa-newspaper"></i></div>`;

        const linkedTagHtml = (t.enableProductBtn && t.linkedBrand)
            ? `<span class="status-badge status-success mt-1"><i class="fa-solid fa-cart-shopping"></i> Tombol: ${window.escapeHtml(t.linkedBrand)}</span>`
            : '';

        html += `
        <div class="admin-news-card">
            <div>
                ${thumbHtml}
                <div style="padding: 12px;">
                    <strong class="text-dark d-block mb-1" style="font-size:0.92rem;">${window.escapeHtml(t.title)}</strong>
                    <p class="text-muted text-xs mb-1" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${window.escapeHtml(t.desc)}</p>
                    ${linkedTagHtml}
                </div>
            </div>
            <div class="flex-between align-center" style="padding: 10px 12px; border-top: 1.5px dashed var(--border-subtle);">
                <button class="btn btn-outline btn-sm" onclick="window.openNewsModal(${i})"><i class="fa-solid fa-pen"></i> Edit</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteNews(${i})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
};

window.openNewsModal = function(index = -1) {
    populateNewsBrandDropdown();
    document.getElementById('manage-news-index').value = index;
    const prevImg = document.getElementById('manage-news-preview');
    const chkBtn = document.getElementById('manage-news-enable-btn');
    const brandSel = document.getElementById('manage-news-linked-brand');

    if (index > -1 && siteSettings.newsList && siteSettings.newsList[index]) {
        const news = siteSettings.newsList[index];
        document.getElementById('manage-news-title').value = news.title || '';
        document.getElementById('manage-news-image').value = news.imageUrl || '';
        document.getElementById('manage-news-desc').value = news.desc || '';
        if (chkBtn) chkBtn.checked = Boolean(news.enableProductBtn);
        if (brandSel) brandSel.value = news.linkedBrand || '';
        window.toggleNewsProductSelect();
        document.getElementById('modal-news-title').innerHTML = '<i class="fa-solid fa-pen text-primary"></i> Edit Artikel Berita';
        if (news.imageUrl && prevImg) { prevImg.src = news.imageUrl; prevImg.style.display = 'block'; }
        else if (prevImg) { prevImg.style.display = 'none'; }
    } else {
        document.getElementById('manage-news-title').value = '';
        document.getElementById('manage-news-image').value = '';
        document.getElementById('manage-news-desc').value = '';
        if (chkBtn) chkBtn.checked = false;
        if (brandSel) brandSel.value = '';
        window.toggleNewsProductSelect();
        document.getElementById('modal-news-title').innerHTML = '<i class="fa-solid fa-newspaper text-primary"></i> Buat Artikel Berita Baru';
        if (prevImg) prevImg.style.display = 'none';
    }
    window.openModal('modal-manage-news');
};

window.clearNewsImage = function() {
    document.getElementById('manage-news-image').value = '';
    const prevImg = document.getElementById('manage-news-preview');
    if (prevImg) prevImg.style.display = 'none';
};

window.handleNewsUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    window.resizeImageBase64(file, (b64) => {
        document.getElementById('manage-news-image').value = b64;
        const prevImg = document.getElementById('manage-news-preview');
        if (prevImg) { prevImg.src = b64; prevImg.style.display = 'block'; }
        window.showToast('Gambar Siap', 'Gambar sampul berita berhasil dimuat.', 'success');
    }, 800, 600);
};

window.saveNews = async function() {
    const idx = parseInt(document.getElementById('manage-news-index').value);
    const title = document.getElementById('manage-news-title').value.trim();
    const imageUrl = document.getElementById('manage-news-image').value.trim();
    const desc = document.getElementById('manage-news-desc').value.trim();
    const enableProductBtn = Boolean(document.getElementById('manage-news-enable-btn')?.checked);
    const linkedBrand = document.getElementById('manage-news-linked-brand')?.value || '';

    if (!title || !desc) { window.customAlert('Error', 'Judul dan Isi Artikel wajib diisi.', 'error'); return; }
    if (enableProductBtn && !linkedBrand) {
        window.customAlert('Pilih Produk', 'Silakan pilih produk yang ingin dihubungkan pada berita ini.', 'warning');
        return;
    }
    
    const btn = document.getElementById('btn-save-news');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;
    try {
        const newsList = siteSettings.newsList ? [...siteSettings.newsList] : [];
        const newsObj = {
            title,
            imageUrl,
            desc,
            enableProductBtn,
            linkedBrand: enableProductBtn ? linkedBrand : '',
            isHidden: false
        };
        if (idx > -1) newsList[idx] = newsObj;
        else newsList.push(newsObj);
        
        await setDoc(doc(db, pathSettings, 'mainConfig'), { newsList: newsList }, { merge: true });
        window.closeModal('modal-manage-news');
        window.showToast('Tersimpan', 'Artikel berita berhasil dipublikasikan.', 'success');
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan berita.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteNews = async function(index) {
    window.openConfirm('Hapus Berita', 'Hapus artikel berita ini secara permanen?', async (confirmed) => {
        if (confirmed) {
            const newsList = [...siteSettings.newsList];
            newsList.splice(index, 1);
            await setDoc(doc(db, pathSettings, 'mainConfig'), { newsList: newsList }, { merge: true });
            window.showToast('Dihapus', 'Artikel berita berhasil dihapus.', 'info');
        }
    }, 'delete');
};

// ==========================================
// PENGATURAN WEB, IKON PWA & WEBHOOK EMAIL
// ==========================================
window.quickToggleStoreStatus = async function() {
    if (!isSettingsLoaded) return;
    const newStatus = siteSettings.isStoreOpen === false ? true : false;
    const storeCheckEl = document.getElementById('set-store-status');
    if (storeCheckEl) storeCheckEl.checked = newStatus;

    try {
        await setDoc(doc(db, pathSettings, 'mainConfig'), { isStoreOpen: newStatus }, { merge: true });
        window.showToast(
            newStatus ? 'Toko Dibuka!' : 'Toko Ditutup!',
            newStatus ? 'Pelanggan kini dapat melakukan transaksi.' : 'Transaksi ditutup sementara untuk pelanggan.',
            newStatus ? 'success' : 'info'
        );
    } catch (e) {
        window.customAlert('Gagal', 'Gagal mengubah status toko.', 'error');
    }
};

window.saveSettingsManual = async function(showNotification = false) {
    if (!isSettingsLoaded) return;
    const newSettings = {
        ...siteSettings,
        logoText: document.getElementById('set-logo-text').value.trim() || siteSettings.logoText || 'VIPER',
        logoAccent: document.getElementById('set-logo-accent').value.trim() || siteSettings.logoAccent || 'CELL',
        logoImgBase64: document.getElementById('set-logo-base64').value || siteSettings.logoImgBase64 || '', 
        pwaIconBase64: document.getElementById('set-pwa-icon-base64').value || siteSettings.pwaIconBase64 || '',
        marquee: document.getElementById('set-marquee').value.trim() || siteSettings.marquee || '',
        adminWa: document.getElementById('set-wa').value.trim() || siteSettings.adminWa || '085656321860',
        igLink: document.getElementById('set-ig').value.trim(),
        ttLink: document.getElementById('set-tt').value.trim(),
        qrisStringData: document.getElementById('set-qris-string').value.trim() || siteSettings.qrisStringData || '',
        emailWebhookUrl: document.getElementById('set-email-webhook') ? document.getElementById('set-email-webhook').value.trim() : (siteSettings.emailWebhookUrl || ''),
        webhookSecret: document.getElementById('set-webhook-secret') ? (document.getElementById('set-webhook-secret').value.trim() || 'VIPERCELL_SECRET_2026') : (siteSettings.webhookSecret || 'VIPERCELL_SECRET_2026'),
        waChannelLink: document.getElementById('set-wa-channel') ? document.getElementById('set-wa-channel').value.trim() : (siteSettings.waChannelLink || ''),
        isStoreOpen: document.getElementById('set-store-status') ? document.getElementById('set-store-status').checked : true
    };
    try {
        await setDoc(doc(db, pathSettings, 'mainConfig'), newSettings, { merge: true });
        localStorage.setItem('vipercell_settings_backup', JSON.stringify(newSettings));
        if (showNotification) {
            window.showToast('Pengaturan Disimpan', 'Konfigurasi web & webhook berhasil diamankan.', 'success');
        }
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan pengaturan web.', 'error');
    }
};

window.populateAdminSettings = function() {
    document.getElementById('set-logo-text').value = siteSettings.logoText || 'VIPER';
    document.getElementById('set-logo-accent').value = siteSettings.logoAccent || 'CELL';
    document.getElementById('set-logo-base64').value = siteSettings.logoImgBase64 || '';
    document.getElementById('set-pwa-icon-base64').value = siteSettings.pwaIconBase64 || '';
    
    document.getElementById('set-marquee').value = siteSettings.marquee || '';
    document.getElementById('set-wa').value = siteSettings.adminWa || '';
    document.getElementById('set-ig').value = siteSettings.igLink || '';
    document.getElementById('set-tt').value = siteSettings.ttLink || '';
    document.getElementById('set-qris-string').value = siteSettings.qrisStringData || '';
    if (document.getElementById('set-email-webhook')) document.getElementById('set-email-webhook').value = siteSettings.emailWebhookUrl || '';
    if (document.getElementById('set-webhook-secret')) document.getElementById('set-webhook-secret').value = siteSettings.webhookSecret || 'VIPERCELL_SECRET_2026';
    if (document.getElementById('set-wa-channel')) document.getElementById('set-wa-channel').value = siteSettings.waChannelLink || '';

    window.previewQrisMerchantTag59();

    const isOpen = siteSettings.isStoreOpen !== false;
    const storeStatusEl = document.getElementById('set-store-status');
    if (storeStatusEl) storeStatusEl.checked = isOpen;

    const quickBtn = document.getElementById('btn-quick-store-toggle');
    const quickTxt = document.getElementById('quick-store-text');
    if (quickBtn && quickTxt) {
        quickBtn.className = isOpen ? 'btn btn-sm btn-success' : 'btn btn-sm btn-danger';
        quickTxt.innerText = isOpen ? 'TOKO BUKA' : 'TOKO TUTUP';
    }
    
    if (siteSettings.logoImgBase64) {
        const p = document.getElementById('set-logo-preview');
        if (p) { p.src = siteSettings.logoImgBase64; p.style.display = 'block'; }
        document.getElementById('set-logo-file-name').innerText = "Gambar Logo Aktif";
    }

    if (siteSettings.pwaIconBase64) {
        const pwaPrev = document.getElementById('set-pwa-icon-preview');
        if (pwaPrev) { pwaPrev.src = siteSettings.pwaIconBase64; pwaPrev.style.display = 'block'; }
        document.getElementById('set-pwa-file-name').innerText = "Ikon Kustom PWA Aktif";
    }
    
    const adminLogoEl = document.getElementById('admin-header-logo-img');
    const defAdminIco = document.getElementById('admin-header-default-icon');
    if (siteSettings.logoImgBase64) {
        if (adminLogoEl) { adminLogoEl.src = siteSettings.logoImgBase64; adminLogoEl.style.display = 'inline-block'; }
        if (defAdminIco) defAdminIco.style.display = 'none';
    } else {
        if (adminLogoEl) adminLogoEl.style.display = 'none';
        if (defAdminIco) defAdminIco.style.display = 'flex';
    }
};

const logoUploadEl = document.getElementById('logo-upload');
if (logoUploadEl) {
    logoUploadEl.addEventListener('change', function(e) {
        if (e.target.files[0]) {
            document.getElementById('set-logo-file-name').innerText = e.target.files[0].name;
            window.resizeImageBase64(e.target.files[0], (b64) => {
                document.getElementById('set-logo-base64').value = b64; 
                const p = document.getElementById('set-logo-preview');
                p.src = b64; p.style.display = 'block';
                window.saveSettingsManual(true); 
            }, 500, 500);
        }
    });
}

const pwaIconUploadEl = document.getElementById('pwa-icon-upload');
if (pwaIconUploadEl) {
    pwaIconUploadEl.addEventListener('change', function(e) {
        if (e.target.files[0]) {
            document.getElementById('set-pwa-file-name').innerText = e.target.files[0].name;
            window.resizeImageBase64(e.target.files[0], (b64) => {
                document.getElementById('set-pwa-icon-base64').value = b64;
                const p = document.getElementById('set-pwa-icon-preview');
                if (p) { p.src = b64; p.style.display = 'block'; }
                window.saveSettingsManual(true);
            }, 512, 512);
        }
    });
}

const bannerUploadEl = document.getElementById('banner-upload');
if (bannerUploadEl) {
    bannerUploadEl.addEventListener('change', function(e) {
        if (e.target.files[0]) {
            window.resizeImageBase64(e.target.files[0], async (b64) => {
                const banners = siteSettings.banners || [];
                banners.push(b64);
                await setDoc(doc(db, pathSettings, 'mainConfig'), { banners: banners }, { merge: true });
                siteSettings.banners = banners;
                window.renderAdminBanners();
                window.showToast('Banner Ditambahkan', 'Spanduk promo baru berhasil diunggah.', 'success');
                e.target.value = ''; 
            }, 1200, 600); 
        }
    });
}

window.renderAdminBanners = function() {
    const list = document.getElementById('admin-banner-list');
    if (!list) return;
    const banners = siteSettings.banners || [];
    if (banners.length === 0) {
        list.innerHTML = '<div class="text-muted text-sm p-3 text-center">Belum ada spanduk/banner promo yang diunggah.</div>';
        return;
    }
    
    let html = '<div class="grid-2col" style="gap:10px;">';
    banners.forEach((b64, idx) => {
        html += `
        <div style="position:relative; border:var(--brutal-border); border-radius:12px; overflow:hidden;">
            <img src="${b64}" style="width:100%; height:115px; object-fit:cover; display:block;" loading="lazy" alt="Banner">
            <button aria-label="Hapus Banner" class="btn btn-danger btn-sm" style="position:absolute; top:8px; right:8px;" onclick="window.deleteBanner(${idx})"><i class="fa-solid fa-trash"></i> Hapus</button>
        </div>`;
    });
    html += '</div>';
    list.innerHTML = html;
};

window.deleteBanner = async function(idx) {
    window.openConfirm('Hapus Banner', 'Hapus spanduk promo ini dari halaman utama?', async (confirmed) => {
        if (confirmed) {
            const banners = siteSettings.banners || [];
            banners.splice(idx, 1);
            await setDoc(doc(db, pathSettings, 'mainConfig'), { banners: banners }, { merge: true });
            siteSettings.banners = banners;
            window.renderAdminBanners();
            window.showToast('Terhapus', 'Banner telah dihapus.', 'info');
        }
    }, 'delete');
};

/* ============================================================================
 * [FEATURE-11] LIVE CHAT ADMIN + TAP TO NAVIGATE TOAST
 * ============================================================================ */
function listenAdminLiveChat() {
    if (adminChatUnsubscribe) adminChatUnsubscribe();
    
    adminChatUnsubscribe = onSnapshot(collection(db, pathChats), (snapshot) => {
        let newChats = [];
        snapshot.forEach(docSnap => { 
            newChats.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (isInitialChatLoad) {
            snapshot.forEach(docSnap => { 
                let cData = docSnap.data();
                previousChatMsgCount[docSnap.id] = cData.messages ? cData.messages.length : 0;
            });
            isInitialChatLoad = false;
        } else {
            snapshot.docChanges().forEach(change => {
                if (change.type === "added" || change.type === "modified") {
                    let cData = change.doc.data();
                    let docId = change.doc.id;
                    
                    let oldMsgCount = previousChatMsgCount[docId] || 0;
                    let newMsgCount = cData.messages ? cData.messages.length : 0;
                    
                    if (newMsgCount > oldMsgCount) {
                        let lastMsg = cData.messages[newMsgCount - 1];
                        if (lastMsg && lastMsg.sender === 'user') {
                            playNotificationSound('chat');
                            sendAdminNativeNotification(`Chat Baru: ${cData.userInfo || 'Pelanggan'} 💬`, lastMsg.text);
                            window.showToast(`Pesan dari ${cData.userInfo || 'Pelanggan'}`, lastMsg.text, 'info', () => {
                                window.switchAdminTabByName('tab-livechat');
                                setTimeout(() => window.openAdminChatDetailDesk(docId), 150);
                            });
                        }
                    }
                    previousChatMsgCount[docId] = newMsgCount;
                }
                if (change.type === "removed") {
                    delete previousChatMsgCount[change.doc.id];
                }
            });
        }
        
        allLiveChats = newChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        window.renderAdminChatList();
        window.renderAdminMembers();
        
        const hasUnreadAny = allLiveChats.some(c => {
            const msgs = c.messages || [];
            return msgs.length > 0 && msgs[msgs.length - 1].sender === 'user';
        });
        const badge = document.getElementById('admin-chat-tab-badge');
        if (badge) badge.style.display = hasUnreadAny ? 'inline-block' : 'none';
        
        const countPill = document.getElementById('chat-active-count-pill');
        if (countPill) countPill.innerText = allLiveChats.length;
        
        const activeId = document.getElementById('admin-active-chat-id-desk')?.value;
        if (activeId) {
            const targetChat = allLiveChats.find(c => c.id === activeId);
            if (targetChat) window.openAdminChatDetailDesk(activeId); 
        }
    });
}

window.renderAdminChatList = function() {
    const list = document.getElementById('admin-chat-list');
    if (!list) return;
    if (allLiveChats.length === 0) {
        list.innerHTML = '<div class="chat-empty-state"><i class="fa-solid fa-comments"></i><p>Belum ada sesi chat pelanggan aktif.</p></div>';
        document.getElementById('admin-chat-empty').style.display = 'flex';
        document.getElementById('admin-chat-active').style.display = 'none';
        return;
    }
    
    const activeId = document.getElementById('admin-active-chat-id-desk')?.value;
    let html = '';
    
    allLiveChats.forEach(chat => {
        const msgs = chat.messages || [];
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const hasUnread = lastMsg && lastMsg.sender === 'user';
        const isActive = chat.id === activeId ? 'active' : '';
        
        html += `
            <div id="chat-card-${chat.id}" class="chat-user-item ${isActive}" onclick="window.openAdminChatDetailDesk('${chat.id}')">
                <div class="chat-user-info">
                    <strong class="chat-user-name">${window.escapeHtml(chat.userInfo || 'Pelanggan')}</strong>
                    <span class="chat-user-msg">${lastMsg ? window.escapeHtml(lastMsg.text) : 'Ruang chat dibuka...'}</span>
                </div>
                ${hasUnread ? '<span class="status-badge status-failed" style="font-size:0.6rem; padding:2px 6px;">BARU</span>' : ''}
            </div>
        `;
    });
    list.innerHTML = html;
};

window.backToChatListMobile = function() {
    document.getElementById('admin-active-chat-id-desk').value = '';
    const mainPanel = document.getElementById('admin-chat-main-panel');
    const sidePanel = document.getElementById('admin-chat-sidebar-panel');
    
    if (window.innerWidth <= 768) {
        mainPanel.style.display = 'none';
        sidePanel.style.display = 'flex';
    }
};

window.openAdminChatDetailDesk = function(chatId) {
    const chat = allLiveChats.find(c => c.id === chatId);
    if (!chat) return;
    
    document.getElementById('admin-chat-empty').style.display = 'none';
    document.getElementById('admin-chat-active').style.display = 'flex';
    document.getElementById('admin-active-chat-id-desk').value = chatId;
    document.getElementById('admin-chat-title-desk').innerText = chat.userInfo || 'Pelanggan';
    const subEl = document.getElementById('admin-chat-sub-desk');
    if (subEl) {
        subEl.innerHTML = chat.userEmail
            ? `<i class="fa-regular fa-envelope"></i> ${window.escapeHtml(chat.userEmail)}`
            : `<i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> Pelanggan Tamu / Live Chat`;
    }
    
    const mainPanel = document.getElementById('admin-chat-main-panel');
    const sidePanel = document.getElementById('admin-chat-sidebar-panel');
    
    if (window.innerWidth <= 768) {
        sidePanel.style.display = 'none';
        mainPanel.style.display = 'flex';
    }
    
    const body = document.getElementById('admin-chat-body-desktop');
    let html = '';
    
    (chat.messages || []).forEach(msg => {
        const isUser = msg.sender === 'user';
        const cls = isUser ? 'user' : 'admin';

        html += `
            <div class="chat-msg ${cls}">
                ${window.escapeHtml(msg.text).replace(/\n/g, '<br>')}
                <span class="chat-time">${new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        `;
    });
    body.innerHTML = html;
    
    setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
    document.querySelectorAll('.chat-user-item').forEach(el => el.classList.remove('active'));
    const activeCard = document.getElementById(`chat-card-${chatId}`);
    if (activeCard) activeCard.classList.add('active');
};

window.insertQuickReplyDesk = function(text) {
    const input = document.getElementById('admin-chat-input-desk');
    if (input) { input.value = text; input.focus(); }
};

window.sendAdminChatDesk = async function() {
    const chatId = document.getElementById('admin-active-chat-id-desk').value;
    const input = document.getElementById('admin-chat-input-desk');
    const text = input.value.trim();
    if (!text || !chatId) return;
    
    input.value = '';
    const chatRef = doc(db, pathChats, chatId);
    await setDoc(chatRef, {
        updatedAt: Date.now(),
        messages: arrayUnion({ sender: 'admin', text: text, timestamp: Date.now() })
    }, { merge: true });
};

window.resolveChatDesktop = async function() {
    const chatId = document.getElementById('admin-active-chat-id-desk').value;
    if (!chatId) return;
    
    window.openConfirm('Tutup Sesi Chat', 'Tandai selesai dan hapus riwayat sesi obrolan ini?', async (confirmed) => {
        if (!confirmed) return;
        const btn = document.getElementById('btn-resolve-chat');
        const ogHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;
        try {
            await deleteDoc(doc(db, pathChats, chatId));
            document.getElementById('admin-active-chat-id-desk').value = '';
            document.getElementById('admin-chat-empty').style.display = 'flex';
            document.getElementById('admin-chat-active').style.display = 'none';
            
            if (window.innerWidth <= 768) {
                window.backToChatListMobile();
            }
            window.showToast('Sesi Selesai', 'Sesi obrolan telah ditutup.', 'success');
        } catch (e) {
            window.customAlert('Gagal', 'Tidak dapat menghapus sesi obrolan.', 'error');
        } finally {
            btn.innerHTML = ogHtml; btn.disabled = false;
        }
    }, 'delete');
};
/* ======================== END OF [FEATURE-11] ============================= */

// Inisialisasi Aplikasi Admin Command Center V25.0
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
    initAdminApp();
}
