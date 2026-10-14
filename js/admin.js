import { 
    db, auth,
    signInWithEmailAndPassword, signOut, onAuthStateChanged,
    setPersistence, browserLocalPersistence,
    doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, collection, addDoc, query, where, getDocs, arrayUnion 
} from './firebase.js';

// ==========================================
// KONFIGURASI DATABASE + RECOVERY PATH LAMA
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

// Path cadangan untuk memulihkan pengaturan lama jika sebelumnya tersimpan di workspace/non-workspace
const fallbackSettingsPath = isWorkspace ? 'settings' : `artifacts/${appId}/public/data/settings`;

// ==========================================
// STATE & VARIABEL GLOBAL (ADMIN V21)
// ==========================================
let products = [];
let groupedBrands = []; 
let orders = [];
let promos = [];
let reviewsList = [];
let allLiveChats = [];

let adminChatUnsubscribe = null; 
let isAdminListening = false;

let siteSettings = { 
    logoText: 'VIPER',
    logoAccent: 'CELL',
    logoImgBase64: '',
    marquee: 'Selamat Datang di Vipercell! Layanan Otomatis 24 Jam.',
    qrisStringData: '00020101021126670016COM.NOBUBANK.WWW011893600503000000000051440014ID.CO.QRIS.WWW0215ID10200210007070303UMI5204581253033605802ID5919VIPERCELL INDONESIA6005AMBON61059711662070703A016304',
    adminWa: '085656321860',
    igLink: '',
    ttLink: '',
    newsList: [],
    banners: [],
    isStoreOpen: true,
    waChannelLink: ''
};

let currentAdminUser = null;
let isSettingsLoaded = false;
let currentGroupNominals = [];
let currentOrderFilter = 'ALL';
let currentAdminProdFilter = 'all';
let isSoundEnabled = localStorage.getItem('vipercell_admin_sound') !== 'off';

let isInitialOrderLoad = true;
let isInitialChatLoad = true;
let previousOrdersData = {};
let previousChatMsgCount = {};
let processingAutoOrderIds = new Set();
window.tempProcessStocks = []; 

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
        btn.style.background = isSoundEnabled ? '#dbeafe' : 'var(--surface)';
        btn.style.color = isSoundEnabled ? '#1d4ed8' : 'var(--text-muted)';
    }
}

// Notifikasi Push Sistem (OS/Browser) untuk Admin
function updateAdminNotifUI() {
    const btn = document.getElementById('btn-admin-notif-perm');
    const icon = document.getElementById('admin-notif-icon');
    if (!btn || !icon || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        icon.className = 'fa-solid fa-bell';
        btn.style.background = '#d1fae5';
        btn.style.color = '#047857';
    } else {
        icon.className = 'fa-regular fa-bell';
    }
}

window.requestAdminNotificationPermission = async function() {
    if (!('Notification' in window)) {
        window.customAlert('Tidak Didukung', 'Browser perangkat ini belum mendukung notifikasi sistem.', 'warning');
        return;
    }
    const perm = await Notification.requestPermission();
    updateAdminNotifUI();
    if (perm === 'granted') {
        sendAdminNativeNotification('Vipercell Admin Aktif!', 'Notifikasi pesanan & chat pelanggan siap dikirim ke perangkat Anda.');
        window.showToast('Notifikasi Aktif', 'Push notifikasi browser telah diaktifkan.', 'success');
    }
};

function sendAdminNativeNotification(title, bodyText) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const iconUrl = siteSettings.logoImgBase64 || 'https://cdn-icons-png.flaticon.com/512/3659/3659899.png';
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(title, { body: bodyText, icon: iconUrl, vibrate: [200, 100, 200] });
        }).catch(() => {
            new Notification(title, { body: bodyText, icon: iconUrl });
        });
    } else {
        new Notification(title, { body: bodyText, icon: iconUrl });
    }
}

window.copyTextToClipboard = function(text, label = 'Data') {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        window.showToast('Tersalin', `${label} berhasil disalin ke papan klip!`, 'success');
    });
};

// ==========================================
// UTILITAS UMUM & TEMA (DEFAULT AWAL: PUTIH / LIGHT)
// ==========================================
window.resizeImageBase64 = function(file, callback, maxWidth, maxHeight) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let w = img.width, h = img.height;
            if(w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
            if(h > maxHeight) { w = Math.round(w * maxHeight / h); h = maxHeight; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/webp', 0.75)); 
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
    if(icon) icon.className = newTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    const metaTheme = document.getElementById('meta-theme-color');
    if(metaTheme) metaTheme.setAttribute('content', newTheme === 'dark' ? '#0f172a' : '#ffffff');
};

window.openModal = (id) => {
    const el = document.getElementById(id);
    if(el) { el.classList.add('active'); document.body.classList.add('no-scroll'); }
};
window.closeModal = (id) => {
    const el = document.getElementById(id);
    if(el) { el.classList.remove('active'); document.body.classList.remove('no-scroll'); }
};

window.customAlert = (title, message, type = 'info') => {
    const titleEl = document.getElementById('ca-title');
    const descEl = document.getElementById('ca-desc');
    const iconEl = document.getElementById('ca-icon');
    const extraEl = document.getElementById('ca-extra-action');
    const alertEl = document.getElementById('custom-alert');
    
    if(titleEl) titleEl.innerText = title;
    if(descEl) descEl.innerHTML = message;
    if(extraEl) extraEl.innerHTML = '';
    if(iconEl) {
        iconEl.className = `msg-icon ${type}`;
        if(type === 'success') iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        else if(type === 'error') iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        else if(type === 'warning') iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        else iconEl.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
    }
    if(alertEl) alertEl.classList.add('active');
    document.body.classList.add('no-scroll');
};

window.closeAlert = () => {
    const alertEl = document.getElementById('custom-alert');
    const extraEl = document.getElementById('ca-extra-action');
    if(alertEl) alertEl.classList.remove('active');
    if(extraEl) extraEl.innerHTML = '';
    document.body.classList.remove('no-scroll');
};

window.showToast = function(title, msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    let icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : (type === 'error' ? '<i class="fa-solid fa-circle-xmark"></i>' : '<i class="fa-solid fa-bolt"></i>');
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><h4>${window.escapeHtml(title)}</h4><p>${window.escapeHtml(msg)}</p></div>`;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 4500);
};

let promptCallback = null;
window.openConfirm = function(title, message, callback, actionType = 'warning') {
    const titleEl = document.getElementById('mc-title');
    const descEl = document.getElementById('mc-desc');
    const iconContainer = document.getElementById('mc-icon-container');
    const confirmBtn = document.getElementById('mc-confirm-btn');
    
    if(titleEl) titleEl.innerText = title;
    if(descEl) descEl.innerHTML = message;
    promptCallback = callback;
    
    if (iconContainer && confirmBtn) {
        if (actionType === 'delete') {
            iconContainer.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            iconContainer.style.background = '#fee2e2';
            iconContainer.style.color = '#b91c1c';
            confirmBtn.className = 'btn btn-danger flex-1';
        } else if (actionType === 'success') {
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            iconContainer.style.background = '#d1fae5';
            iconContainer.style.color = '#047857';
            confirmBtn.className = 'btn btn-success flex-1';
        } else {
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
            iconContainer.style.background = '#dbeafe';
            iconContainer.style.color = '#1d4ed8';
            confirmBtn.className = 'btn btn-primary flex-1';
        }
    }
    window.openModal('modal-confirm');
};

window.resolveConfirm = function(isConfirmed) {
    window.closeModal('modal-confirm');
    if(promptCallback) promptCallback(isConfirmed);
};

window.switchAdminTab = function(tabId, btnEl) {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
    if (btnEl) btnEl.classList.add('active');
    const targetEl = document.getElementById(tabId);
    if (targetEl) targetEl.style.display = 'block';
    
    const titleText = btnEl && btnEl.querySelector('span') ? btnEl.querySelector('span').innerText : 'Command Center';
    const pageTitle = document.getElementById('admin-page-title');
    if(pageTitle) pageTitle.innerText = titleText;
    
    if(window.innerWidth <= 768) {
        const sidebar = document.getElementById('admin-sidebar');
        if(sidebar) sidebar.classList.remove('active');
    }
};

window.jumpToPendingOrders = function() {
    const orderTabBtn = document.querySelectorAll('.admin-tab')[1];
    window.switchAdminTab('tab-orders', orderTabBtn);
    const pillNeedAction = document.querySelectorAll('#tab-orders .filter-pill')[1];
    window.setAdminOrderFilter('NEED_ACTION', pillNeedAction);
};

// ==========================================
// AUTHENTICATION KHUSUS EMAIL & PASSWORD
// ==========================================
async function verifyAdminAccess(user) {
    let role = 'user';
    const allowedEmails = ['vipercell.id@gmail.com', 'viperdev4@gmail.com']; 
    
    if (allowedEmails.includes(user.email)) {
        role = 'superadmin';
    } else {
        const userDoc = await getDoc(doc(db, pathUsers, user.uid));
        if (userDoc.exists() && userDoc.data().role) {
            role = userDoc.data().role;
        }
    }

    if (role === 'admin' || role === 'superadmin') {
        currentAdminUser = user;
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'flex';
        const emailLbl = document.getElementById('admin-logged-email');
        if (emailLbl) emailLbl.innerText = user.email || 'Otoritas Penuh';
        
        updateSoundIconUI();
        updateAdminNotifUI();
        window.showToast('Berhasil Masuk', `Selamat bertugas kembali, Admin!`, 'success');
        listenAdminData();
    } else {
        await signOut(auth);
        window.customAlert('Akses Ditolak', 'Akun ini tidak memiliki otoritas Administrator Vipercell.', 'error');
        resetLoginButtons();
    }
}

function resetLoginButtons() {
    const btn = document.getElementById('btn-admin-login');
    if(btn) { btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> <span>Masuk ke Command Center</span>'; btn.disabled = false; }
}

window.processAdminLogin = async function() {
    const em = document.getElementById('admin-email').value.trim();
    const pw = document.getElementById('admin-pass').value.trim();
    if(!em || !pw) { window.customAlert('Data Kosong', 'Email dan Kata Sandi Administrator wajib diisi!', 'warning'); return; }
    
    const btn = document.getElementById('btn-admin-login');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memverifikasi Otoritas...</span>'; 
    btn.disabled = true;
    
    try {
        await signInWithEmailAndPassword(auth, em, pw);
    } catch(e) {
        window.customAlert('Akses Ditolak', 'Email atau kata sandi administrator salah.', 'error');
        resetLoginButtons();
    }
};

window.logoutAdmin = async function() {
    await signOut(auth);
    window.location.reload();
};

async function initAdminApp() {
    const savedTheme = localStorage.getItem('vipercell_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = document.getElementById('admin-theme-icon');
    if(icon) icon.className = savedTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    
    await setPersistence(auth, browserLocalPersistence);
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await verifyAdminAccess(user);
        } else {
            document.getElementById('admin-login-screen').style.display = 'flex';
            document.getElementById('admin-dashboard').style.display = 'none';
            resetLoginButtons();
        }
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
// DATA LISTENERS + AUTO-RECOVERY PENGATURAN LAMA
// ==========================================
function mergeValidSettings(target, source) {
    if (!source) return target;
    const result = { ...target };
    Object.keys(source).forEach(key => {
        const val = source[key];
        if (val !== undefined && val !== null) {
            // Jangan timpa string default yang sudah ada dengan string kosong kecuali memang disengaja
            if (typeof val === 'string' && val.trim() === '' && ['logoText', 'logoAccent', 'qrisStringData', 'adminWa'].includes(key) && result[key]) {
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

    // 1. SETTINGS (DENGAN AUTO-RECOVERY DARI PATH LAMA & LOCAL CACHE)
    const cachedSettings = localStorage.getItem('vipercell_settings_backup');
    if (cachedSettings) {
        try { siteSettings = mergeValidSettings(siteSettings, JSON.parse(cachedSettings)); } catch (e) {}
    }

    onSnapshot(doc(db, pathSettings, 'mainConfig'), async (docSnap) => {
        if (docSnap.exists()) {
            const dbData = docSnap.data();
            siteSettings = mergeValidSettings(siteSettings, dbData);
            
            // Jika dokumen utama kehilangan data penting (misal ter-reset kosong di versi sebelumnya), cek fallback path lama
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
            // Cek path alternatif sebelum membuat dokumen baru
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
    });

    // 2. PRODUCTS (SUPPORT APP, GAME, DAN TOOLS)
    onSnapshot(collection(db, pathProducts), (snapshot) => {
        products = [];
        snapshot.forEach((docSnap) => { products.push({ dbId: docSnap.id, ...docSnap.data() }); });
        groupedBrands = [];
        products.forEach(p => {
            const brandName = p.brand || p.name;
            const existing = groupedBrands.find(b => b.brandName === brandName);
            if(existing) {
                existing.items.push(p);
                if(p.imgUrlBase64 && !existing.imgUrlBase64) existing.imgUrlBase64 = p.imgUrlBase64;
                if(p.desc && !existing.desc) existing.desc = p.desc;
            } else {
                groupedBrands.push({
                    brandName: brandName,
                    type: p.type || 'app',
                    imgUrlBase64: p.imgUrlBase64 || '',
                    desc: p.desc || '',
                    isGangguan: p.isGangguan || false,
                    items: [p]
                });
            }
        });
        window.renderAdminProducts();
        
        // Gudang stok mendukung Aplikasi Premium ('app') dan Tools Digital ('tools')
        const stockableBrands = groupedBrands.filter(b => b.type === 'app' || b.type === 'tools');
        const filterSel = document.getElementById('view-stock-category');
        if(filterSel) {
            const curFil = filterSel.value;
            let selFilHtml = '<option value="">-- Pilih Brand Untuk Dilihat --</option>';
            stockableBrands.forEach(b => {
                const labelType = b.type === 'tools' ? '[Tools]' : '[App]';
                selFilHtml += `<option value="${window.escapeHtml(b.brandName)}">${labelType} ${window.escapeHtml(b.brandName)}</option>`;
            });
            filterSel.innerHTML = selFilHtml;
            if(stockableBrands.some(b => b.brandName === curFil)) filterSel.value = curFil;
        }
        const addSel = document.getElementById('stock-brand-select');
        if(addSel) {
            const curAdd = addSel.value;
            let selAddHtml = '<option value="">-- Pilih Produk Aplikasi / Tools --</option>';
            stockableBrands.forEach(b => {
                const labelType = b.type === 'tools' ? '[Tools]' : '[App]';
                selAddHtml += `<option value="${window.escapeHtml(b.brandName)}">${labelType} ${window.escapeHtml(b.brandName)}</option>`;
            });
            addSel.innerHTML = selAddHtml;
            if(stockableBrands.some(b => b.brandName === curAdd)) addSel.value = curAdd;
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
        snapshot.forEach(docSnap => reviewsList.push({dbId: docSnap.id, ...docSnap.data()}));
        reviewsList.sort((a,b) => b.timestamp - a.timestamp);
        window.renderReviews();
    });

    // 5. ORDERS (AUTO-KIRIM STOK MULTI-QTY UNTUK APP & TOOLS)
    onSnapshot(collection(db, pathOrders), (snapshot) => {
        let newOrders = [];
        snapshot.forEach((docSnap) => {
            newOrders.push({ dbId: docSnap.id, ...docSnap.data() });
        });

        if(isInitialOrderLoad) {
            snapshot.forEach((docSnap) => {
                let data = docSnap.data();
                previousOrdersData[docSnap.id] = { status: data.status, adminReply: data.adminReply };
            });
            isInitialOrderLoad = false;
        } else {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added" || change.type === "modified") {
                    let data = change.doc.data();
                    let dbId = change.doc.id; 
                    
                    let oldData = previousOrdersData[dbId] || {};
                    let oldStatus = oldData.status;
                    
                    if (!oldStatus && (data.status === 'PENDING' || data.status === 'UNPAID')) {
                        playNotificationSound('order');
                        sendAdminNativeNotification('Pesanan Baru Masuk! 🛒', `Invoice ${data.id} sebesar Rp${(data.finalTotal || 0).toLocaleString('id-ID')}`);
                        window.showToast('Pesanan Baru!', `Invoice ${data.id} baru saja dibuat.`, 'info');
                    }
                    else if ((oldStatus === 'PENDING' || oldStatus === 'UNPAID' || !oldStatus) && data.status === 'SUCCESS' && !data.adminReply) {
                        playNotificationSound('order');
                        let hasAutoStockItem = data.items && data.items.some(i => i.type === 'app' || i.type === 'tools');
                        let isManualProcess = data.items && data.items.some(i => i.processType === 'manual');
                        
                        if (hasAutoStockItem && !isManualProcess) {
                            window.autoProcessOrder(data, dbId);
                        } else {
                            sendAdminNativeNotification('Pembayaran Lunas (Butuh Proses) ⚡', `Invoice ${data.id} menunggu pengiriman manual Anda.`);
                            window.showToast('Pembayaran Lunas!', `Invoice ${data.id} menunggu proses manual Anda.`, 'success');
                        }
                    }
                    
                    previousOrdersData[dbId] = { status: data.status, adminReply: data.adminReply };
                }
                if (change.type === "removed") {
                    delete previousOrdersData[change.doc.id];
                }
            });
        }
        
        orders = newOrders.sort((a,b) => new Date(b.date) - new Date(a.date));
        window.renderAdminOrders();
        window.generateAdminReports();
        
        const hasPending = orders.some(o => o.status === 'PENDING' || (o.status === 'SUCCESS' && !o.adminReply));
        const adminOrderTabBadge = document.getElementById('admin-tab-order-badge');
        if(adminOrderTabBadge) adminOrderTabBadge.style.display = hasPending ? 'inline-block' : 'none';
    });
    
    // 6. LIVE CHAT
    listenAdminLiveChat();
}

// ==========================================
// AUTO-KIRIM STOK MULTI-QTY (MENDUKUNG APP & TOOLS)
// ==========================================
window.autoProcessOrder = async function(orderData, orderDbId) {
    if (processingAutoOrderIds.has(orderDbId)) return;
    processingAutoOrderIds.add(orderDbId);

    const targetItem = orderData.items.find(i => i.type === 'app' || i.type === 'tools');
    if(!targetItem) {
        processingAutoOrderIds.delete(orderDbId);
        return;
    }
    
    const targetBrand = targetItem.brandName || targetItem.name.split(' - ')[0];
    const exactItemName = targetItem.exactItemName || targetItem.name.replace(`(x${targetItem.qty})`, '').trim();
    const neededQty = parseInt(targetItem.qty) || 1;
    
    try {
        const q = query(
            collection(db, pathStocks),
            where("brand", "==", targetBrand),
            where("itemName", "==", exactItemName),
            where("status", "==", "Ready")
        );
        const snap = await getDocs(q);
        
        if (snap.docs.length >= neededQty) {
            const selectedDocs = snap.docs.slice(0, neededQty);
            let accountDetailsList = [];

            for (let idx = 0; idx < selectedDocs.length; idx++) {
                const stockDoc = selectedDocs[idx];
                const stockData = stockDoc.data();
                const parts = stockData.data.split('|');
                
                const headerTitle = neededQty > 1 ? `[DATA ITEM #${idx + 1}]` : `[DETAIL PESANAN ANDA]`;
                accountDetailsList.push(
                    `${headerTitle}\nEmail/Kode : ${parts[0] || '-'}\nSandi/Pin  : ${parts[1] || '-'}\nKeterangan : ${parts[2] || '-'}`
                );

                await updateDoc(doc(db, pathStocks, stockDoc.id), {
                    status: 'Used',
                    usedAt: Date.now(),
                    orderId: orderData.id
                });
            }

            const replyText = `Terima kasih! Pembayaran Anda telah terverifikasi otomatis.\n\n${accountDetailsList.join('\n\n')}\n\nSilakan diamankan dan hubungi Live Chat jika ada kendala.`;
            await updateDoc(doc(db, pathOrders, orderDbId), { adminReply: replyText });
            window.showToast('Auto-Delivery Sukses', `${neededQty} stok terkirim otomatis untuk ${orderData.id}`, 'success');

            const curView = document.getElementById('view-stock-category')?.value;
            if (curView === targetBrand) window.renderAdminStocksByCategory();
        } else {
            sendAdminNativeNotification('Stok Gudang Kurang! ⚠️', `Invoice ${orderData.id} butuh ${neededQty} stok ${exactItemName}. Segera proses manual!`);
            window.showToast('Stok Kurang / Habis!', `Invoice ${orderData.id} butuh ${neededQty} stok ${exactItemName}, tersedia ${snap.docs.length}.`, 'error');
        }
    } catch(e) {
        console.error("Auto Process Gagal: ", e);
    } finally {
        setTimeout(() => processingAutoOrderIds.delete(orderDbId), 3000);
    }
};

// ==========================================
// RINGKASAN & ANALITIK DASHBOARD
// ==========================================
window.generateAdminReports = function() {
    const successOrders = orders.filter(o => o.status === 'SUCCESS');
    const needActionOrders = orders.filter(o => o.status === 'PENDING' || (o.status === 'SUCCESS' && !o.adminReply));
    
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

    if(revEl) revEl.innerText = `Rp${totalRevenue.toLocaleString('id-ID')}`;
    if(todayRevEl) todayRevEl.innerText = `Rp${todayRevenue.toLocaleString('id-ID')}`;
    if(saleEl) saleEl.innerText = totalSales;
    if(pendEl) pendEl.innerText = needActionOrders.length;
    
    const sortedProducts = Object.entries(productCountMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    const topTbody = document.getElementById('report-top-products');
    if(topTbody) {
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
                rHtml += `<tr>
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
    if(!tbody) return;
    
    const searchInput = document.getElementById('admin-search-order');
    let queryText = searchInput ? searchInput.value.trim().toUpperCase() : '';
    
    let filteredOrders = orders.filter(o => {
        if (currentOrderFilter === 'NEED_ACTION') {
            return o.status === 'PENDING' || (o.status === 'SUCCESS' && !o.adminReply);
        }
        if (currentOrderFilter === 'UNPAID') return o.status === 'UNPAID';
        if (currentOrderFilter === 'SUCCESS') return o.status === 'SUCCESS' && !!o.adminReply;
        if (currentOrderFilter === 'FAILED') return o.status === 'FAILED' || o.status === 'EXPIRED';
        return true;
    });

    if (queryText !== '') {
        filteredOrders = filteredOrders.filter(o => {
            const matchId = o.id && o.id.toUpperCase().includes(queryText);
            const matchEmail = o.userEmail && o.userEmail.toUpperCase().includes(queryText);
            const matchItem = o.items && o.items.some(i => (i.name || '').toUpperCase().includes(queryText) || (i.playerInfo || '').toUpperCase().includes(queryText));
            return matchId || matchEmail || matchItem;
        });
    }
    
    if(filteredOrders.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2.5rem;">Tidak ada pesanan pada filter ini.</td></tr>`; 
        return; 
    }
    
    let renderLimit = filteredOrders.slice(0, 100);
    let html = '';
    renderLimit.forEach(o => {
        let sBadge = `<span class="status-badge status-unpaid">UNPAID</span>`;
        if (o.status === 'PENDING') sBadge = `<span class="status-badge status-pending">PENDING</span>`;
        else if (o.status === 'FAILED') sBadge = `<span class="status-badge status-failed">FAILED</span>`;
        else if (o.status === 'EXPIRED') sBadge = `<span class="status-badge status-failed">EXPIRED</span>`;
        else if (o.status === 'SUCCESS' && !o.adminReply) sBadge = `<span class="status-badge status-pending">LUNAS - BELUM DIKIRIM</span>`;
        else if (o.status === 'SUCCESS') sBadge = `<span class="status-badge status-success">SELESAI</span>`;
        
        let itemsDesc = (o.items || []).map(i => {
            const safeTarget = escapeJsStr(i.playerInfo || '');
            const copyTargetBtn = (i.type === 'game' || (i.playerInfo && i.playerInfo.includes(':')))
                ? `<button class="btn btn-outline btn-sm" style="padding:2px 6px; min-height:22px; font-size:0.65rem; margin-left:6px;" onclick="window.copyTextToClipboard('${safeTarget}', 'Data Target')" title="Salin Target"><i class="fa-regular fa-copy"></i> Salin</button>`
                : '';
            return `<strong class="text-dark">${window.escapeHtml(i.name)}</strong><br><span class="text-muted text-xs">${window.escapeHtml(i.playerInfo)}</span>${copyTargetBtn}`;
        }).join('<br>');

        let promoDesc = o.promoCode ? `<br><small class="text-success text-xs fw-bold">Voucher: ${window.escapeHtml(o.promoCode)} (-Rp${o.promoDiscount})</small>` : '';
        let paymentMethodStr = o.paymentMethod === 'cash' ? '<span class="status-badge status-pending">TUNAI</span>' : '<span class="status-badge status-unpaid">QRIS</span>';
        
        let actionBtn = '';
        if(o.status === 'PENDING' || o.status === 'UNPAID' || o.status === 'EXPIRED' || (o.status === 'SUCCESS' && !o.adminReply)) {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="window.promptProcessOrder('${o.dbId}')"><i class="fa-solid fa-bolt"></i> Proses</button>`;
        } else {
            actionBtn = `<button class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${o.dbId}')" title="Lihat/Edit Balasan"><i class="fa-solid fa-eye"></i> Detail</button>`;
        }
            
        let deleteBtn = `<button aria-label="Hapus Order" class="btn-icon-only text-danger" style="width:34px; height:34px;" title="Hapus Permanen" onclick="window.promptDeleteOrder('${o.dbId}', '${escapeJsStr(o.id)}')"><i class="fa-solid fa-trash"></i></button>`;
        
        html += `<tr>
            <td>
                <div class="flex-gap align-center">
                    <strong class="text-dark">${window.escapeHtml(o.id)}</strong>
                    <button class="btn-icon-only" style="width:24px; height:24px; font-size:0.7rem;" onclick="window.copyTextToClipboard('${escapeJsStr(o.id)}', 'Invoice ID')" title="Salin Invoice"><i class="fa-regular fa-copy"></i></button>
                </div>
                <small class="text-muted text-xs">${new Date(o.date).toLocaleString('id-ID')}</small>
            </td>
            <td>${itemsDesc}${promoDesc}</td>
            <td><span class="text-xs fw-bold">${window.escapeHtml(o.userEmail || '-')}</span></td>
            <td>${paymentMethodStr}</td>
            <td class="text-primary fw-bold">Rp${(o.finalTotal || 0).toLocaleString('id-ID')}</td>
            <td>${sBadge}</td>
            <td><div class="flex-gap align-center">${actionBtn} ${deleteBtn}</div></td>
        </tr>`;
    });
    tbody.innerHTML = html;
};

window.exportOrdersCSV = function() {
    if (orders.length === 0) {
        window.customAlert('Data Kosong', 'Belum ada data pesanan untuk diekspor.', 'warning');
        return;
    }
    const headers = ['Invoice ID', 'Tanggal', 'Email Pembeli', 'Produk', 'Tujuan/Info', 'Metode Bayar', 'Total Bayar (Rp)', 'Status'];
    const rows = orders.map(o => {
        const itemStr = (o.items || []).map(i => i.name).join('; ');
        const infoStr = (o.items || []).map(i => i.playerInfo).join('; ');
        return [
            o.id,
            new Date(o.date).toLocaleString('id-ID'),
            o.userEmail || '-',
            `"${(itemStr || '').replace(/"/g, '""')}"`,
            `"${(infoStr || '').replace(/"/g, '""')}"`,
            o.paymentMethod || 'qris',
            o.finalTotal || 0,
            o.status
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
    const expiredList = orders.filter(o => o.status === 'EXPIRED');
    if (expiredList.length === 0) {
        window.customAlert('Bersih!', 'Tidak ada pesanan berstatus EXPIRED saat ini.', 'info');
        return;
    }
    window.openConfirm('Bersihkan Pesanan Expired', `Hapus permanen <b>${expiredList.length} pesanan</b> yang sudah EXPIRED dari database?`, async (confirmed) => {
        if (confirmed) {
            try {
                for (const ord of expiredList) {
                    await deleteDoc(doc(db, pathOrders, ord.dbId));
                }
                window.showToast('Selesai Dibersihkan', `${expiredList.length} pesanan expired telah dihapus.`, 'success');
            } catch (e) {
                window.customAlert('Gagal', 'Terjadi kesalahan saat menghapus data expired.', 'error');
            }
        }
    }, 'delete');
};

window.promptProcessOrder = async function(dbId) {
    const order = orders.find(o => o.dbId === dbId);
    if(!order) return;
    
    document.getElementById('proc-inv').innerText = order.id;
    document.getElementById('proc-order-id').value = dbId;
    
    let defaultReply = order.adminReply || `Pesanan Anda telah berhasil diproses! Silakan cek di dalam game/aplikasi. Terima kasih telah berbelanja di Vipercell!`;
    document.getElementById('proc-reply').value = defaultReply;
    
    const list = document.getElementById('proc-items-list');
    list.innerHTML = '<strong class="text-dark mb-1 d-block">Rincian Item & Tujuan:</strong>' +
        order.items.map(i => `<div class="text-sm fw-bold text-primary">${window.escapeHtml(i.name)} (${i.processType || 'auto'})</div><div class="text-xs text-muted">${window.escapeHtml(i.playerInfo)}</div>`).join('<hr style="margin:6px 0;">');
    
    const hasStockable = order.items.some(i => i.type === 'app' || i.type === 'tools');
    const stockSec = document.getElementById('proc-stock-section');
    const stockSel = document.getElementById('proc-stock-select');
    
    if(hasStockable && !order.adminReply) {
        stockSec.style.display = 'block';
        stockSel.innerHTML = '<option value="">Memuat stok Ready dari Gudang...</option>';
        
        const targetItem = order.items.find(i => i.type === 'app' || i.type === 'tools');
        const targetBrand = targetItem.brandName || targetItem.name.split(' - ')[0];
        const exactItemName = targetItem.exactItemName || targetItem.name.replace(`(x${targetItem.qty})`, '').trim();
        
        try {
            const q = query(collection(db, pathStocks), where("brand", "==", targetBrand), where("itemName", "==", exactItemName), where("status", "==", "Ready"));
            const snap = await getDocs(q);
            
            if(snap.empty) {
                stockSel.innerHTML = '<option value="">-- Gudang Stok Varian Ini Kosong (Ketik Manual di Bawah) --</option>';
            } else {
                let selHtml = '<option value="">-- Jangan Pakai Stok Gudang (Ketik Manual) --</option>';
                window.tempProcessStocks = [];
                snap.forEach((s) => {
                    const data = {dbId: s.id, ...s.data()};
                    window.tempProcessStocks.push(data);
                    const em = data.data.split('|')[0];
                    selHtml += `<option value="${data.dbId}">${window.escapeHtml(em)} | [Ready]</option>`;
                });
                stockSel.innerHTML = selHtml;
                
                stockSel.onchange = function() {
                    const sId = this.value; if(!sId) return;
                    const sData = window.tempProcessStocks.find(x => x.dbId === sId);
                    if(sData) {
                        const parts = sData.data.split('|');
                        document.getElementById('proc-reply').value = `[DETAIL PESANAN ANDA]\nEmail/Kode : ${parts[0] || '-'}\nSandi/Pin  : ${parts[1] || '-'}\nKeterangan : ${parts[2] || '-'}`;
                    }
                };
                if (window.tempProcessStocks.length > 0) {
                    stockSel.value = window.tempProcessStocks[0].dbId;
                    stockSel.onchange();
                }
            }
        } catch(e) {
            stockSel.innerHTML = '<option value="">Gagal memuat stok.</option>';
        }
    } else {
        stockSec.style.display = 'none';
    }
    window.openModal('modal-process-order');
};

window.markOrderComplete = async function(statusType) {
    const dbId = document.getElementById('proc-order-id').value;
    const reply = document.getElementById('proc-reply').value.trim();
    const order = orders.find(o => o.dbId === dbId);
    if (!order) return;
    
    const btn = document.getElementById(statusType === 'SUCCESS' ? 'btn-proc-success' : 'btn-proc-fail');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memproses...</span>';
    btn.disabled = true;
    
    try {
        if(statusType === 'SUCCESS') {
            if(order.items.some(i => i.type === 'app' || i.type === 'tools')) {
                const stockSel = document.getElementById('proc-stock-select');
                if(stockSel && stockSel.value) {
                    await updateDoc(doc(db, pathStocks, stockSel.value), { status: 'Used', usedAt: Date.now(), orderId: order.id });
                }
            }
        }
        
        processingAutoOrderIds.add(dbId);
        await updateDoc(doc(db, pathOrders, dbId), {
            status: statusType,
            adminReply: statusType === 'SUCCESS' ? reply : ''
        });
        window.closeModal('modal-process-order');
        
        if(statusType === 'SUCCESS') window.showToast('Transaksi Selesai', `Invoice ${order.id} telah diselesaikan & dikirim.`, 'success');
        else window.showToast('Dibatalkan', `Invoice ${order.id} ditandai gagal.`, 'info');
    } catch(e) {
        window.customAlert('Error', 'Gagal memperbarui status pesanan.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
        setTimeout(() => processingAutoOrderIds.delete(dbId), 2000);
    }
};

window.promptDeleteOrder = function(dbId, invoiceId) {
    window.openConfirm("Hapus Pesanan", `Hapus permanen data Invoice <b>${window.escapeHtml(invoiceId)}</b>?`, async (confirmed) => {
        if(confirmed) {
            await deleteDoc(doc(db, pathOrders, dbId));
            window.showToast("Terhapus", `Invoice ${invoiceId} berhasil dihapus.`, "success");
        }
    }, 'delete');
};

// ==========================================
// GUDANG STOK AKUN & LISENSI (APP + TOOLS)
// ==========================================
window.updateAdminStockItemSelect = function() {
    const brandName = document.getElementById('stock-brand-select').value;
    const itemSel = document.getElementById('stock-item-select');
    let html = '<option value="">-- Pilih Varian Item --</option>';
    if(!brandName) { itemSel.innerHTML = html; return; }
    
    const brand = groupedBrands.find(b => b.brandName === brandName);
    if(brand) {
        brand.items.forEach(i => {
            html += `<option value="${window.escapeHtml(i.name)}">${window.escapeHtml(i.name)}</option>`;
        });
    }
    itemSel.innerHTML = html;
};

window.renderAdminStocksByCategory = async function() {
    const brand = document.getElementById('view-stock-category').value;
    const tb = document.getElementById('admin-stock-list');
    const readyCountEl = document.getElementById('stock-ready-count');
    const usedCountEl = document.getElementById('stock-used-count');
    
    if(!brand) {
        if (readyCountEl) readyCountEl.innerText = '0';
        if (usedCountEl) usedCountEl.innerText = '0';
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 3rem;"><i class="fa-solid fa-filter" style="font-size:2rem; display:block; margin-bottom:10px;"></i> Pilih kategori brand untuk menampilkan daftar stok.</td></tr>';
        return;
    }
    
    tb.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data gudang stok...</td></tr>';
    
    try {
        const q = query(collection(db, pathStocks), where("brand", "==", brand));
        const snap = await getDocs(q);
        let localStocks = [];
        snap.forEach(d => localStocks.push({dbId: d.id, ...d.data()}));
        
        const readyTotal = localStocks.filter(s => s.status === 'Ready').length;
        const usedTotal = localStocks.filter(s => s.status !== 'Ready').length;
        if (readyCountEl) readyCountEl.innerText = readyTotal;
        if (usedCountEl) usedCountEl.innerText = usedTotal;

        if(localStocks.length === 0) {
            tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2rem;">Belum ada stok untuk produk ini.</td></tr>';
            return;
        }
        
        localStocks.sort((a,b) => b.createdAt - a.createdAt);
        let html = '';
        localStocks.forEach((s, i) => {
            const parts = (s.data || '').split('|');
            const em = parts[0] || '-'; const pw = parts[1] || '-'; const dur = parts[2] || '-';
            const badge = s.status === 'Ready'
                ? '<span class="status-badge status-success">READY</span>'
                : `<span class="status-badge status-failed">TERJUAL ${s.orderId ? `(${window.escapeHtml(s.orderId)})` : ''}</span>`;
            html += `<tr>
                <td><strong>${i+1}</strong></td>
                <td><strong class="text-dark">${window.escapeHtml(s.brand)}</strong><br><small class="text-primary fw-bold">${window.escapeHtml(s.itemName || '-')}</small></td>
                <td><strong class="text-dark">${window.escapeHtml(em)}</strong><br><small class="text-muted">${window.escapeHtml(pw)}</small></td>
                <td class="text-dark text-xs">${window.escapeHtml(dur)}</td>
                <td>${badge}</td>
                <td><button aria-label="Hapus Stok" class="btn-icon-only text-danger" style="width:32px; height:32px;" onclick="window.deleteStock('${s.dbId}')"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
        });
        tb.innerHTML = html;
    } catch(e) {
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Gagal mengambil data stok.</td></tr>';
    }
};

window.addStockMassal = async function() {
    const brand = document.getElementById('stock-brand-select').value;
    const itemName = document.getElementById('stock-item-select').value;
    const rawData = document.getElementById('stock-bulk-input').value.trim();
    
    if(!brand || !itemName || !rawData) {
        window.customAlert('Data Belum Lengkap', 'Pilih produk, varian item, dan masukkan minimal 1 baris data akun/lisensi.', 'warning');
        return;
    }
    
    const btn = document.getElementById('btn-add-stock');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;
    try {
        const lines = rawData.split('\n').filter(l => l.trim() !== '');
        let count = 0;
        for(const line of lines) {
            const parts = line.split('|');
            if(parts.length >= 2) {
                await addDoc(collection(db, pathStocks), { brand: brand, itemName: itemName, data: line.trim(), status: 'Ready', createdAt: Date.now() });
                count++;
            }
        }
        document.getElementById('stock-bulk-input').value = '';
        
        const viewSel = document.getElementById('view-stock-category');
        if (viewSel) {
            viewSel.value = brand;
            window.renderAdminStocksByCategory();
        }
        
        window.customAlert('Berhasil Disimpan', `<b>${count} stok</b> berhasil ditambahkan ke gudang <b>${window.escapeHtml(brand)} - ${window.escapeHtml(itemName)}</b>.`, 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menambah stok ke database.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteStock = async function(dbId) {
    window.openConfirm('Hapus Stok', 'Hapus baris stok ini secara permanen?', async (confirmed) => {
        if(confirmed) {
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

// ==========================================
// MANAJEMEN ULASAN PEMBELI
// ==========================================
window.renderReviews = function() {
    const list = document.getElementById('admin-reviews-list');
    if(!list) return;
    
    if(reviewsList.length === 0) {
        list.innerHTML = '<div class="text-center text-muted w-100 dashboard-panel" style="padding: 3rem;"><i class="fa-solid fa-comment-slash" style="font-size:2.5rem; margin-bottom:10px; display:block;"></i>Belum ada ulasan dari pembeli.</div>';
        return;
    }
    
    let html = '';
    reviewsList.forEach(r => {
        let stars = '';
        for(let i=0; i<5; i++) {
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
    if(!replyTxt) return window.customAlert('Peringatan', 'Kolom balasan tidak boleh kosong.', 'warning');
    
    const btn = document.getElementById('btn-save-review-reply');
    const og = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        await updateDoc(doc(db, pathReviews, dbId), { adminReply: replyTxt });
        window.closeModal('modal-reply-review');
        window.showToast('Tersimpan', 'Balasan ulasan berhasil dipublikasikan.', 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan balasan ulasan.', 'error');
    } finally {
        btn.innerHTML = og; btn.disabled = false;
    }
};

window.deleteReview = async function(dbId) {
    window.openConfirm('Hapus Ulasan', 'Hapus ulasan pembeli ini secara permanen?', async (confirmed) => {
        if(confirmed) {
            await deleteDoc(doc(db, pathReviews, dbId));
            window.showToast('Terhapus', 'Ulasan berhasil dihapus.', 'info');
        }
    }, 'delete');
};

// ==========================================
// MANAJEMEN KATALOG MODERN + KATEGORI TOOLS + KLONING VARIAN
// ==========================================
window.setAdminProdFilter = function(filterType, btnEl) {
    currentAdminProdFilter = filterType;
    document.querySelectorAll('#tab-products .filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    window.renderAdminProducts();
};

window.renderAdminProducts = function() {
    const container = document.getElementById('admin-prod-list');
    if(!container) return;

    const searchQ = (document.getElementById('admin-search-prod')?.value || '').trim().toLowerCase();
    let list = currentAdminProdFilter === 'all' ? groupedBrands : groupedBrands.filter(b => b.type === currentAdminProdFilter);

    if (searchQ) {
        list = list.filter(b => b.brandName.toLowerCase().includes(searchQ) || b.items.some(i => i.name.toLowerCase().includes(searchQ)));
    }

    if(list.length === 0) {
        container.innerHTML = `<div class="dashboard-panel text-center text-muted" style="grid-column: 1/-1; padding: 2.5rem;">Tidak ada produk ditemukan pada kategori/pencarian ini.</div>`;
        return;
    }
    
    let html = '';
    list.forEach(b => {
        const safeJsBrand = escapeJsStr(b.brandName);
        const imgHtml = b.imgUrlBase64
            ? `<img src="${b.imgUrlBase64}" style="width:58px; height:58px; object-fit:cover; border-radius:14px; border:var(--brutal-border);" loading="lazy" alt="${window.escapeHtml(b.brandName)}">`
            : `<div style="width:58px; height:58px; background:var(--primary); color:white; display:flex; justify-content:center; align-items:center; border-radius:14px; border:var(--brutal-border); font-weight:900; font-size:1.5rem;">${window.escapeHtml(b.brandName.charAt(0))}</div>`;
        
        const itemsCount = b.items.length;
        const isSoldOut = b.items.every(i => i.soldOut);
        const prices = b.items.map(i => i.priceNum || 0).filter(p => p > 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        
        let typeBadge = '<span class="status-badge status-unpaid">📱 APLIKASI</span>';
        if (b.type === 'game') typeBadge = '<span class="status-badge status-pending">🎮 GAME</span>';
        else if (b.type === 'tools') typeBadge = '<span class="status-badge status-tools">🛠️ TOOLS</span>';

        let statusBadgeHtml = isSoldOut ? '<span class="status-badge status-failed">HABIS</span>' : '<span class="status-badge status-success">AKTIF</span>';
        if (b.isGangguan) statusBadgeHtml = '<span class="status-badge status-pending">GANGGUAN</span>';
        
        html += `
        <div class="admin-prod-card">
            <div>
                <div class="admin-prod-card-head">
                    ${imgHtml}
                    <div style="flex:1; overflow:hidden;">
                        <div class="flex-wrap-gap mb-1">${typeBadge} ${statusBadgeHtml}</div>
                        <strong class="text-dark" style="font-size:1.12rem; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.escapeHtml(b.brandName)}</strong>
                        <span class="text-xs text-muted fw-bold">${itemsCount} Varian &bull; Mulai Rp${minPrice.toLocaleString('id-ID')}</span>
                    </div>
                </div>
            </div>
            <div class="admin-prod-card-actions">
                <button class="btn btn-primary btn-sm flex-1" onclick="window.openProductGroupModal('${safeJsBrand}')">
                    <i class="fa-solid fa-pen-to-square"></i> Edit & Varian
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
    if (!inputGroup) return;
    // Tampilkan pilihan format input untuk Game maupun Tools
    if (type === 'game' || type === 'tools') {
        inputGroup.style.display = 'block';
    } else {
        inputGroup.style.display = 'none';
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
    if(brandName) {
        const group = groupedBrands.find(b => b.brandName === brandName);
        if(group) {
            document.getElementById('modal-prod-title').innerHTML = `<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Produk: ${window.escapeHtml(brandName)}`;
            document.getElementById('manage-prod-old-brand').value = brandName;
            document.getElementById('manage-prod-type').value = group.type || 'app';
            document.getElementById('manage-prod-brand').value = group.brandName;
            document.getElementById('manage-prod-img-base64').value = group.imgUrlBase64 || '';
            document.getElementById('manage-prod-desc').value = group.desc || '';
            document.getElementById('manage-prod-file-name').innerText = group.imgUrlBase64 ? 'Ikon tersimpan (Klik gambar untuk mengganti)' : 'Klik kotak kamera untuk upload ikon';
            updateProdModalPreviewImg(group.imgUrlBase64 || '');
            
            const gangguanEl = document.getElementById('manage-prod-gangguan');
            if(gangguanEl) gangguanEl.checked = group.isGangguan || false;
            
            currentGroupNominals = group.items.map(i => ({ dbId: i.dbId, name: i.name, priceNum: i.priceNum, processType: i.processType || 'auto', soldOut: i.soldOut || false }));
            
            const allSoldOut = currentGroupNominals.length > 0 && currentGroupNominals.every(n => n.soldOut);
            document.getElementById('manage-prod-soldout').checked = allSoldOut;
            
            let inpType = group.items[0]?.inputType || (group.type === 'game' ? 'id_zone' : 'none');
            const targetEl = document.querySelector(`#group-tipe-input .type-card input[value="${inpType}"]`);
            if(targetEl) window.selectInputType(inpType, targetEl.parentElement);
        }
    } else {
        document.getElementById('modal-prod-title').innerHTML = '<i class="fa-solid fa-box-open text-primary"></i> Tambah Produk Baru';
        document.getElementById('manage-prod-old-brand').value = '';
        document.getElementById('manage-prod-type').value = 'app';
        document.getElementById('manage-prod-brand').value = '';
        document.getElementById('manage-prod-desc').value = '';
        document.getElementById('manage-prod-img-base64').value = '';
        document.getElementById('manage-prod-file-name').innerText = 'Klik kotak kamera di kiri untuk mengunggah ikon (Auto WebP).';
        updateProdModalPreviewImg('');
        document.getElementById('manage-prod-soldout').checked = false;
        
        const gangguanEl = document.getElementById('manage-prod-gangguan');
        if(gangguanEl) gangguanEl.checked = false;
        
        const defaultEl = document.querySelector(`#group-tipe-input .type-card input[value="none"]`);
        if(defaultEl) window.selectInputType('none', defaultEl.parentElement);
    }
    
    window.toggleInputTypeBox();
    window.clearTempNominalInput();
    window.renderTempNominals();
    window.openModal('modal-manage-product');
};

window.clearTempNominalInput = function() {
    document.getElementById('temp-nom-name').value = '';
    document.getElementById('temp-nom-price').value = '';
    document.getElementById('temp-nom-status').value = 'auto';
    document.getElementById('temp-nom-index').value = '-1';
    document.getElementById('btn-add-item').innerHTML = '<i class="fa-solid fa-plus"></i> <span>Tambah</span>';
    document.getElementById('btn-cancel-edit-item').style.display = 'none';
};

window.editTempNominal = function(idx) {
    const item = currentGroupNominals[idx];
    if(!item) return;
    document.getElementById('temp-nom-name').value = item.name;
    document.getElementById('temp-nom-price').value = item.priceNum;
    document.getElementById('temp-nom-status').value = item.processType;
    document.getElementById('temp-nom-index').value = idx;
    document.getElementById('btn-add-item').innerHTML = '<i class="fa-solid fa-check"></i> <span>Update</span>';
    document.getElementById('btn-cancel-edit-item').style.display = 'inline-flex';
};

// Fitur Baru: Kloning Varian 1x Klik (Mempercepat Input Varian Serupa)
window.cloneTempNominal = function(idx) {
    const item = currentGroupNominals[idx];
    if (!item) return;
    currentGroupNominals.splice(idx + 1, 0, {
        dbId: null,
        name: item.name + ' (Copy)',
        priceNum: item.priceNum,
        processType: item.processType,
        soldOut: item.soldOut
    });
    window.renderTempNominals();
    window.showToast('Varian Dikloning', 'Silakan sesuaikan nama atau harga varian hasil duplikasi.', 'info');
};

window.sortTempNominalsByPrice = function() {
    currentGroupNominals.sort((a, b) => (a.priceNum || 0) - (b.priceNum || 0));
    window.renderTempNominals();
};

window.addOrUpdateTempNominal = function() {
    const idx = parseInt(document.getElementById('temp-nom-index').value);
    const name = document.getElementById('temp-nom-name').value.trim();
    const priceNum = parseInt(document.getElementById('temp-nom-price').value) || 0;
    const processType = document.getElementById('temp-nom-status').value || 'auto';
    if(!name || priceNum <= 0) {
        window.customAlert('Input Belum Lengkap', 'Nama Varian dan Harga Jual harus diisi dengan benar.', 'warning');
        return;
    }
    
    if (idx >= 0) {
        currentGroupNominals[idx].name = name;
        currentGroupNominals[idx].priceNum = priceNum;
        currentGroupNominals[idx].processType = processType;
    } else {
        currentGroupNominals.push({ dbId: null, name, priceNum, processType, soldOut: false });
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
    if(!container) return;
    
    if(currentGroupNominals.length === 0) {
        container.innerHTML = `<div class="text-center text-muted text-sm" style="padding: 14px;">Belum ada varian harga. Isi form di atas lalu klik <b>Tambah</b>.</div>`;
        return;
    }
    
    let html = '';
    currentGroupNominals.forEach((nom, index) => {
        const isSold = nom.soldOut ? 'checked' : '';
        const badgeType = nom.processType === 'manual'
            ? `<span class="status-badge status-pending" style="font-size:0.6rem; padding:2px 6px;">MANUAL</span>`
            : `<span class="status-badge status-success" style="font-size:0.6rem; padding:2px 6px;">OTOMATIS</span>`;
        html += `
        <div class="flex-between align-center bg-surface" style="padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--border); margin-bottom: 8px;">
            <div>
                <div class="fw-bold text-dark text-sm">${window.escapeHtml(nom.name)} ${badgeType}</div>
                <div class="text-primary fw-bold text-xs">Rp${nom.priceNum.toLocaleString('id-ID')}</div>
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
    
    let inputType = 'none';
    const checkedType = document.querySelector('input[name="manage_input_type"]:checked');
    if(checkedType) inputType = checkedType.value;
    
    if(!brand) { window.customAlert('Error', 'Nama Brand / Produk wajib diisi.', 'error'); return; }
    if(currentGroupNominals.length === 0) { window.customAlert('Error', 'Tambahkan minimal 1 varian harga ke dalam produk ini.', 'error'); return; }
    
    const btn = document.getElementById('btn-save-group');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan Produk...</span>';
    btn.disabled = true;
    try {
        const oldGroup = groupedBrands.find(b => b.brandName === oldBrand);
        const oldDbIds = oldGroup ? oldGroup.items.map(i => i.dbId) : [];
        const newDbIds = currentGroupNominals.map(n => n.dbId).filter(id => id);
        
        const toDelete = oldDbIds.filter(id => !newDbIds.includes(id));
        for(const id of toDelete) { await deleteDoc(doc(db, pathProducts, id)); }
        
        for(const nom of currentGroupNominals) {
            const prodData = {
                type: type,
                brand: brand,
                name: nom.name,
                priceNum: nom.priceNum,
                processType: nom.processType || 'auto',
                imgUrlBase64: imgBase64,
                desc: desc,
                soldOut: nom.soldOut,
                inputType: (type === 'game' || type === 'tools') ? inputType : null,
                isGangguan: isGangguan 
            };
            if(nom.dbId) await updateDoc(doc(db, pathProducts, nom.dbId), prodData);
            else await addDoc(collection(db, pathProducts), prodData);
        }
        
        window.closeModal('modal-manage-product');
        window.showToast('Produk Tersimpan', `Seluruh varian ${brand} berhasil diperbarui.`, 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan grup produk.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteProductGroup = function(brandName) {
    window.openConfirm("Hapus Brand Produk", `Hapus seluruh varian item dalam brand <b>${window.escapeHtml(brandName)}</b>?`, async (confirmed) => {
        if(confirmed) {
            const group = groupedBrands.find(b => b.brandName === brandName);
            if(group) {
                for(const item of group.items) { await deleteDoc(doc(db, pathProducts, item.dbId)); }
                window.showToast('Terhapus', `Produk ${brandName} telah dihapus.`, 'info');
            }
        }
    }, 'delete');
};

const manageProdImgEl = document.getElementById('manage-prod-img-file');
if(manageProdImgEl) {
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

// ==========================================
// VOUCHER & PROMO MANAGEMENT
// ==========================================
window.renderAdminPromos = function() {
    const tbody = document.getElementById('admin-promo-list');
    if(!tbody) return;
    
    if(promos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">Belum ada kode promo aktif.</td></tr>';
        return;
    }
    let html = '';
    promos.forEach(p => {
        const typeStr = p.type === 'percent' ? `${p.amount}%` : `Rp${p.amount.toLocaleString('id-ID')}`;
        const targetStr = p.targetBrand === 'all' ? 'Semua Produk' : (p.targetBrand || 'Semua');
        const userTgt = p.targetUser === 'new' ? 'Transaksi Pertama' : 'Semua User';
        
        html += `<tr>
            <td><strong class="text-dark">${window.escapeHtml(p.code)}</strong></td>
            <td><span class="status-badge status-success">${typeStr}</span></td>
            <td class="text-dark">${window.escapeHtml(targetStr)}</td>
            <td><span class="text-warning text-xs fw-bold">${userTgt}</span></td>
            <td class="text-dark fw-bold">${p.usedCount || 0} / ${p.maxUses}</td>
            <td>${p.active ? '<span class="status-badge status-success">AKTIF</span>' : '<span class="status-badge status-failed">NONAKTIF</span>'}</td>
            <td>
                <div class="flex-gap align-center">
                    <button class="btn-icon-only" style="width:32px; height:32px;" onclick="window.openPromoModal('${p.dbId}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon-only text-danger" style="width:32px; height:32px;" onclick="window.deletePromo('${p.dbId}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
};

window.openPromoModal = function(dbId = null) {
    const targetSelect = document.getElementById('manage-promo-target');
    if (targetSelect) {
        let selHtml = '<option value="all">Semua Produk</option>';
        groupedBrands.forEach(b => { selHtml += `<option value="${window.escapeHtml(b.brandName)}">Khusus: ${window.escapeHtml(b.brandName)}</option>`; });
        targetSelect.innerHTML = selHtml;
    }
    if(dbId) {
        const p = promos.find(x => x.dbId === dbId);
        if (!p) return;
        document.getElementById('modal-promo-title').innerText = 'Edit Kode Promo';
        document.getElementById('manage-promo-id').value = p.dbId;
        document.getElementById('manage-promo-code').value = p.code;
        document.getElementById('manage-promo-type').value = p.type || 'nominal';
        document.getElementById('manage-promo-amount').value = p.amount;
        document.getElementById('manage-promo-max').value = p.maxUses;
        if(targetSelect) document.getElementById('manage-promo-target').value = p.targetBrand || 'all';
        if(document.getElementById('manage-promo-user')) document.getElementById('manage-promo-user').value = p.targetUser || 'all';
        document.getElementById('manage-promo-active').checked = p.active;
    } else {
        document.getElementById('modal-promo-title').innerText = 'Buat Kode Promo Baru';
        document.getElementById('manage-promo-id').value = '';
        document.getElementById('manage-promo-code').value = '';
        document.getElementById('manage-promo-type').value = 'nominal';
        document.getElementById('manage-promo-amount').value = '';
        document.getElementById('manage-promo-max').value = '';
        if(targetSelect) document.getElementById('manage-promo-target').value = 'all';
        if(document.getElementById('manage-promo-user')) document.getElementById('manage-promo-user').value = 'all';
        document.getElementById('manage-promo-active').checked = true;
    }
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
        maxUses: parseInt(document.getElementById('manage-promo-max').value) || 0,
        active: document.getElementById('manage-promo-active').checked,
        usedCount: 0 
    };
    if(!data.code || data.amount <= 0 || data.maxUses <= 0) {
        window.customAlert('Data Tidak Valid', 'Pastikan kode voucher, nilai potongan, dan batas kuota diisi dengan benar.', 'warning');
        return;
    }
    
    const btn = document.getElementById('btn-save-promo');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;
    try {
        if(dbId) {
            delete data.usedCount; 
            await updateDoc(doc(db, pathPromos, dbId), data);
        } else {
            await addDoc(collection(db, pathPromos), data);
        }
        window.closeModal('modal-manage-promo');
        window.showToast('Promo Tersimpan', `Kode promo ${data.code} siap digunakan.`, 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan kode promo.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deletePromo = function(dbId) {
    window.openConfirm("Hapus Promo", "Hapus kode promo ini secara permanen?", async (confirmed) => {
        if(confirmed) {
            await deleteDoc(doc(db, pathPromos, dbId));
            window.showToast('Terhapus', 'Kode promo berhasil dihapus.', 'info');
        }
    }, 'delete');
};

// ==========================================
// BERITA & KOMUNITAS WEB (KARTU VISUAL MODERN)
// ==========================================
window.renderAdminNews = function() {
    const list = document.getElementById('admin-news-list');
    if(!list) return;
    const newsData = siteSettings.newsList || [];
    if(newsData.length === 0) {
        list.innerHTML = '<p class="text-muted text-center p-3" style="grid-column: 1/-1;">Belum ada artikel berita atau pengumuman.</p>';
        return;
    }
    
    let html = '';
    newsData.forEach((t, i) => {
        const thumbHtml = t.imageUrl
            ? `<img src="${t.imageUrl}" class="admin-news-thumb" alt="Thumb">`
            : `<div class="admin-news-thumb" style="background:linear-gradient(135deg, var(--primary), #1d4ed8); display:flex; align-items:center; justify-content:center; color:#fff; font-size:2rem;"><i class="fa-solid fa-newspaper"></i></div>`;

        html += `
        <div class="admin-news-card">
            <div>
                ${thumbHtml}
                <div style="padding: 12px;">
                    <strong class="text-dark d-block mb-1" style="font-size:0.95rem;">${window.escapeHtml(t.title)}</strong>
                    <p class="text-muted text-xs mb-0" style="display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${window.escapeHtml(t.desc)}</p>
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
    document.getElementById('manage-news-index').value = index;
    const prevImg = document.getElementById('manage-news-preview');
    if (index > -1 && siteSettings.newsList && siteSettings.newsList[index]) {
        const news = siteSettings.newsList[index];
        document.getElementById('manage-news-title').value = news.title || '';
        document.getElementById('manage-news-image').value = news.imageUrl || '';
        document.getElementById('manage-news-desc').value = news.desc || '';
        document.getElementById('modal-news-title').innerHTML = '<i class="fa-solid fa-pen text-primary"></i> Edit Artikel Berita';
        if (news.imageUrl && prevImg) { prevImg.src = news.imageUrl; prevImg.style.display = 'block'; }
        else if (prevImg) { prevImg.style.display = 'none'; }
    } else {
        document.getElementById('manage-news-title').value = '';
        document.getElementById('manage-news-image').value = '';
        document.getElementById('manage-news-desc').value = '';
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
    if(!file) return;
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
    if(!title || !desc) { window.customAlert('Error', 'Judul dan Isi Artikel wajib diisi.', 'error'); return; }
    
    const btn = document.getElementById('btn-save-news');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;
    try {
        const newsList = siteSettings.newsList ? [...siteSettings.newsList] : [];
        if (idx > -1) newsList[idx] = { title, imageUrl, desc, isHidden: false };
        else newsList.push({ title, imageUrl, desc, isHidden: false });
        
        await setDoc(doc(db, pathSettings, 'mainConfig'), { newsList: newsList }, { merge: true });
        window.closeModal('modal-manage-news');
        window.showToast('Tersimpan', 'Artikel berita berhasil dipublikasikan.', 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan berita.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteNews = async function(index) {
    window.openConfirm('Hapus Berita', 'Hapus artikel berita ini secara permanen?', async (confirmed) => {
        if(confirmed) {
            const newsList = [...siteSettings.newsList];
            newsList.splice(index, 1);
            await setDoc(doc(db, pathSettings, 'mainConfig'), { newsList: newsList }, { merge: true });
            window.showToast('Dihapus', 'Artikel berita berhasil dihapus.', 'info');
        }
    }, 'delete');
};

// ==========================================
// PENGATURAN WEB (SAFE MERGE ANTI-HILANG DATA)
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
    if(!isSettingsLoaded) return;
    const newSettings = {
        ...siteSettings,
        logoText: document.getElementById('set-logo-text').value.trim() || siteSettings.logoText || 'VIPER',
        logoAccent: document.getElementById('set-logo-accent').value.trim() || siteSettings.logoAccent || 'CELL',
        logoImgBase64: document.getElementById('set-logo-base64').value || siteSettings.logoImgBase64 || '', 
        marquee: document.getElementById('set-marquee').value.trim() || siteSettings.marquee || '',
        adminWa: document.getElementById('set-wa').value.trim() || siteSettings.adminWa || '085656321860',
        igLink: document.getElementById('set-ig').value.trim(),
        ttLink: document.getElementById('set-tt').value.trim(),
        qrisStringData: document.getElementById('set-qris-string').value.trim() || siteSettings.qrisStringData || '',
        waChannelLink: document.getElementById('set-wa-channel') ? document.getElementById('set-wa-channel').value.trim() : (siteSettings.waChannelLink || ''),
        isStoreOpen: document.getElementById('set-store-status') ? document.getElementById('set-store-status').checked : true
    };
    try {
        await setDoc(doc(db, pathSettings, 'mainConfig'), newSettings, { merge: true });
        localStorage.setItem('vipercell_settings_backup', JSON.stringify(newSettings));
        if (showNotification) {
            window.showToast('Pengaturan Disimpan', 'Konfigurasi web berhasil diamankan.', 'success');
        }
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan pengaturan web.', 'error');
    }
};

window.populateAdminSettings = function() {
    document.getElementById('set-logo-text').value = siteSettings.logoText || 'VIPER';
    document.getElementById('set-logo-accent').value = siteSettings.logoAccent || 'CELL';
    document.getElementById('set-logo-base64').value = siteSettings.logoImgBase64 || '';
    
    document.getElementById('set-marquee').value = siteSettings.marquee || '';
    document.getElementById('set-wa').value = siteSettings.adminWa || '';
    document.getElementById('set-ig').value = siteSettings.igLink || '';
    document.getElementById('set-tt').value = siteSettings.ttLink || '';
    document.getElementById('set-qris-string').value = siteSettings.qrisStringData || '';
    
    if(document.getElementById('set-wa-channel')) document.getElementById('set-wa-channel').value = siteSettings.waChannelLink || '';
    
    const isOpen = siteSettings.isStoreOpen !== false;
    const storeStatusEl = document.getElementById('set-store-status');
    if(storeStatusEl) storeStatusEl.checked = isOpen;

    const quickBtn = document.getElementById('btn-quick-store-toggle');
    const quickTxt = document.getElementById('quick-store-text');
    if (quickBtn && quickTxt) {
        quickBtn.className = isOpen ? 'btn btn-sm btn-success' : 'btn btn-sm btn-danger';
        quickTxt.innerText = isOpen ? 'TOKO BUKA' : 'TOKO TUTUP';
    }
    
    if(siteSettings.logoImgBase64) {
        const p = document.getElementById('set-logo-preview');
        p.src = siteSettings.logoImgBase64; p.style.display = 'block';
        document.getElementById('set-logo-file-name').innerText = "Gambar Logo Aktif";
    }
    
    const adminLogoEl = document.getElementById('admin-header-logo-img');
    const defAdminIco = document.getElementById('admin-header-default-icon');
    if(siteSettings.logoImgBase64) {
        if(adminLogoEl){ adminLogoEl.src = siteSettings.logoImgBase64; adminLogoEl.style.display = 'inline-block'; }
        if(defAdminIco) defAdminIco.style.display = 'none';
    } else {
        if(adminLogoEl) adminLogoEl.style.display = 'none';
        if(defAdminIco) defAdminIco.style.display = 'flex';
    }
};

const logoUploadEl = document.getElementById('logo-upload');
if(logoUploadEl) {
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

const bannerUploadEl = document.getElementById('banner-upload');
if(bannerUploadEl) {
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
    if(!list) return;
    const banners = siteSettings.banners || [];
    if(banners.length === 0){
        list.innerHTML = '<div class="text-muted text-sm p-3 text-center">Belum ada spanduk/banner promo yang diunggah.</div>';
        return;
    }
    
    let html = '<div class="grid-2col">';
    banners.forEach((b64, idx) => {
        html += `
        <div style="position:relative; border:var(--brutal-border); border-radius:12px; overflow:hidden; box-shadow:var(--brutal-shadow-sm);">
            <img src="${b64}" style="width:100%; height:140px; object-fit:cover; display:block;" loading="lazy" alt="Banner">
            <button aria-label="Hapus Banner" class="btn btn-danger btn-sm" style="position:absolute; top:8px; right:8px;" onclick="window.deleteBanner(${idx})"><i class="fa-solid fa-trash"></i> Hapus</button>
        </div>`;
    });
    html += '</div>';
    list.innerHTML = html;
};

window.deleteBanner = async function(idx) {
    window.openConfirm('Hapus Banner', 'Hapus spanduk promo ini dari halaman utama?', async (confirmed) => {
        if(confirmed) {
            const banners = siteSettings.banners || [];
            banners.splice(idx, 1);
            await setDoc(doc(db, pathSettings, 'mainConfig'), { banners: banners }, { merge: true });
            siteSettings.banners = banners;
            window.renderAdminBanners();
            window.showToast('Terhapus', 'Banner telah dihapus.', 'info');
        }
    }, 'delete');
};

// ==========================================
// LIVE CHAT ADMIN + NOTIFIKASI PUSH
// ==========================================
function listenAdminLiveChat() {
    if(adminChatUnsubscribe) adminChatUnsubscribe();
    
    adminChatUnsubscribe = onSnapshot(collection(db, pathChats), (snapshot) => {
        let newChats = [];
        snapshot.forEach(docSnap => { 
            newChats.push({ id: docSnap.id, ...docSnap.data() });
        });

        if(isInitialChatLoad) {
            snapshot.forEach(docSnap => { 
                let cData = docSnap.data();
                previousChatMsgCount[docSnap.id] = cData.messages ? cData.messages.length : 0;
            });
            isInitialChatLoad = false;
        } else {
            snapshot.docChanges().forEach(change => {
                if(change.type === "added" || change.type === "modified") {
                    let cData = change.doc.data();
                    let docId = change.doc.id;
                    
                    let oldMsgCount = previousChatMsgCount[docId] || 0;
                    let newMsgCount = cData.messages ? cData.messages.length : 0;
                    
                    if(newMsgCount > oldMsgCount) {
                        let lastMsg = cData.messages[newMsgCount - 1];
                        if(lastMsg && lastMsg.sender === 'user') {
                            playNotificationSound('chat');
                            sendAdminNativeNotification(`Chat Baru: ${cData.userInfo || 'Pelanggan'} 💬`, lastMsg.text);
                            window.showToast(`Chat: ${cData.userInfo || 'Pelanggan'}`, lastMsg.text, 'info');
                        }
                    }
                    previousChatMsgCount[docId] = newMsgCount;
                }
                if (change.type === "removed") {
                    delete previousChatMsgCount[change.doc.id];
                }
            });
        }
        
        allLiveChats = newChats.sort((a,b) => b.updatedAt - a.updatedAt);
        window.renderAdminChatList();
        
        const hasUnreadAny = allLiveChats.some(c => {
            const msgs = c.messages || [];
            return msgs.length > 0 && msgs[msgs.length - 1].sender === 'user';
        });
        const badge = document.getElementById('admin-chat-tab-badge');
        if(badge) badge.style.display = hasUnreadAny ? 'inline-block' : 'none';
        
        const countPill = document.getElementById('chat-active-count-pill');
        if (countPill) countPill.innerText = allLiveChats.length;
        
        const activeId = document.getElementById('admin-active-chat-id-desk')?.value;
        if(activeId) {
            const targetChat = allLiveChats.find(c => c.id === activeId);
            if(targetChat) window.openAdminChatDetailDesk(activeId); 
        }
    });
}

window.renderAdminChatList = function() {
    const list = document.getElementById('admin-chat-list');
    if(!list) return;
    if(allLiveChats.length === 0) {
        list.innerHTML = '<div class="chat-empty-state"><i class="fa-solid fa-comments"></i><p>Belum ada sesi chat pelanggan aktif.</p></div>';
        document.getElementById('admin-chat-empty').style.display = 'flex';
        document.getElementById('admin-chat-active').style.display = 'none';
        return;
    }
    
    const activeId = document.getElementById('admin-active-chat-id-desk')?.value;
    let html = '';
    
    allLiveChats.forEach(chat => {
        const msgs = chat.messages || [];
        const lastMsg = msgs.length > 0 ? msgs[msgs.length-1] : null;
        const hasUnread = lastMsg && lastMsg.sender === 'user';
        const isActive = chat.id === activeId ? 'active' : '';
        
        html += `
            <div id="chat-card-${chat.id}" class="chat-user-item ${isActive}" onclick="window.openAdminChatDetailDesk('${chat.id}')">
                <div class="chat-user-info">
                    <strong class="chat-user-name">${window.escapeHtml(chat.userInfo || 'Pelanggan')}</strong>
                    <span class="chat-user-msg">${lastMsg ? window.escapeHtml(lastMsg.text) : '...'}</span>
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
    if(!chat) return;
    
    document.getElementById('admin-chat-empty').style.display = 'none';
    document.getElementById('admin-chat-active').style.display = 'flex';
    document.getElementById('admin-active-chat-id-desk').value = chatId;
    document.getElementById('admin-chat-title-desk').innerText = chat.userInfo || 'Pelanggan';
    
    const mainPanel = document.getElementById('admin-chat-main-panel');
    const sidePanel = document.getElementById('admin-chat-sidebar-panel');
    
    if(window.innerWidth <= 768) {
        sidePanel.style.display = 'none';
        mainPanel.style.display = 'flex';
    }
    
    const body = document.getElementById('admin-chat-body-desktop');
    let html = '';
    
    (chat.messages || []).forEach(msg => {
        const isAdmin = msg.sender === 'admin';
        html += `
            <div class="chat-msg ${isAdmin ? 'admin' : 'user'}">
                ${window.escapeHtml(msg.text)}
                <span class="chat-time">${new Date(msg.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;
    });
    body.innerHTML = html;
    
    setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
    document.querySelectorAll('.chat-user-item').forEach(el => el.classList.remove('active'));
    const activeCard = document.getElementById(`chat-card-${chatId}`);
    if(activeCard) activeCard.classList.add('active');
};

window.insertQuickReplyDesk = function(text) {
    const input = document.getElementById('admin-chat-input-desk');
    if(input) { input.value = text; input.focus(); }
};

window.sendAdminChatDesk = async function() {
    const chatId = document.getElementById('admin-active-chat-id-desk').value;
    const input = document.getElementById('admin-chat-input-desk');
    const text = input.value.trim();
    if(!text || !chatId) return;
    
    input.value = '';
    const chatRef = doc(db, pathChats, chatId);
    await updateDoc(chatRef, {
        updatedAt: Date.now(),
        messages: arrayUnion({ sender: 'admin', text: text, timestamp: Date.now() })
    });
};

window.resolveChatDesktop = async function() {
    const chatId = document.getElementById('admin-active-chat-id-desk').value;
    if(!chatId) return;
    
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
            
            if(window.innerWidth <= 768) {
                window.backToChatListMobile();
            }
            window.showToast('Sesi Selesai', 'Sesi obrolan telah ditutup.', 'success');
        } catch(e) {
            window.customAlert('Gagal', 'Tidak dapat menghapus sesi obrolan.', 'error');
        } finally {
            btn.innerHTML = ogHtml; btn.disabled = false;
        }
    }, 'delete');
};

// Inisialisasi Aplikasi Admin
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
    initAdminApp();
}