import { 
    db, auth,
    signInWithEmailAndPassword, signOut, onAuthStateChanged,
    setPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup,
    doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, collection, addDoc, query, where, getDocs, arrayUnion 
} from './firebase.js';

// ==========================================
// KONFIGURASI DATABASE
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

// ==========================================
// STATE & VARIABEL GLOBAL (ADMIN)
// ==========================================
let products = [];
let groupedBrands = []; 
let orders = [];
let promos = [];
let reviewsList = [];
let allLiveChats = [];
let currentOrderFilter = 'ALL';

let adminChatUnsubscribe = null; 

let siteSettings = { 
    logoText: 'VIPER', logoAccent: 'CELL', logoImgBase64: '', marquee: '',
    qrisStringData: '', adminWa: '', igLink: '', ttLink: '',
    newsList: [], banners: [], isStoreOpen: true, waChannelLink: ''
};

let currentAdminUser = null;
let isSettingsLoaded = false;
let currentGroupNominals = [];

// Variabel Memori (Sistem Anti-Spam Notifikasi & Auto-Process Lock)
let isInitialOrderLoad = true;
let isInitialChatLoad = true;
let previousOrdersData = {};
let previousChatMsgCount = {};
let autoProcessingLocks = {};
window.tempProcessStocks = []; 

// Status Suara Notifikasi Browser
let isSoundEnabled = localStorage.getItem('vipercell_admin_sound') !== 'false';

// ==========================================
// UTILITAS KEAMANAN TEKS & KARAKTER KUTIP
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

window.escapeJsStr = function(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
};

// ==========================================
// NOTIFIKASI SUARA WEB AUDIO (PENGGANTI TELEGRAM)
// ==========================================
window.playAdminDing = function(type = 'order') {
    if (!isSoundEnabled) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'order') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.45);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1); // G5
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.35);
        }
    } catch (e) {
        // Abaikan jika browser memblokir autoplay sebelum interaksi pertama
    }
};

window.toggleSoundAlert = function() {
    isSoundEnabled = !isSoundEnabled;
    localStorage.setItem('vipercell_admin_sound', isSoundEnabled ? 'true' : 'false');
    updateSoundIconUI();
    if (isSoundEnabled) {
        window.playAdminDing('chat');
        window.showToast('Suara Aktif', 'Notifikasi suara pesanan & chat diaktifkan.', 'success');
    } else {
        window.showToast('Suara Bisu', 'Notifikasi suara dimatikan.', 'info');
    }
};

function updateSoundIconUI() {
    const icon = document.getElementById('admin-sound-icon');
    if (icon) {
        icon.className = isSoundEnabled ? 'fa-solid fa-volume-high text-success' : 'fa-solid fa-volume-xmark text-danger';
    }
}

// ==========================================
// UTILITAS UMUM & UI NEO-BRUTALISM
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
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('vipercell_theme', newTheme);
    const icon = document.getElementById('admin-theme-icon');
    if(icon) icon.className = newTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
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
        if(type === 'success') iconEl.innerHTML = '<i class="fa-solid fa-circle-check text-success"></i>';
        else if(type === 'error') iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark text-danger"></i>';
        else if(type === 'warning') iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-warning"></i>';
        else iconEl.innerHTML = '<i class="fa-solid fa-circle-info text-primary"></i>';
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
            iconContainer.className = 'msg-icon bg-danger-light text-danger';
            confirmBtn.className = 'btn btn-danger flex-1';
        } else if (actionType === 'success') {
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            iconContainer.className = 'msg-icon bg-success-light text-success';
            confirmBtn.className = 'btn btn-success flex-1';
        } else {
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
            iconContainer.className = 'msg-icon bg-warning-light text-warning';
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
    if(btnEl) btnEl.classList.add('active');
    const targetEl = document.getElementById(tabId);
    if(targetEl) targetEl.style.display = 'block';
    
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
    const pillBtns = document.querySelectorAll('.filter-pill');
    if (pillBtns.length > 1) {
        window.setAdminOrderFilter('NEED_ACTION', pillBtns[1]);
    }
};

window.copyTextHelper = function(text, label = 'Data') {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        window.showToast('Tersalin!', `${label} berhasil disalin ke clipboard.`, 'success');
    });
};

// ==========================================
// AUTHENTICATION & LOGIN FLOW
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
        
        window.showToast('Akses Diterima', 'Selamat datang di Vipercell Admin V20!', 'success');
        listenAdminData();
    } else {
        await signOut(auth);
        window.customAlert('Akses Ditolak', 'Akun ini tidak memiliki otoritas Administrator.', 'error');
        resetLoginButtons();
    }
}

function resetLoginButtons() {
    const btn = document.getElementById('btn-admin-login');
    const btnG = document.getElementById('btn-admin-google');
    if(btn) { btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> <span>Masuk ke Sistem</span>'; btn.disabled = false; }
    if(btnG) { btnG.innerHTML = '<i class="fa-brands fa-google" style="color:#ea4335;"></i> <span>Masuk dengan Google</span>'; btnG.disabled = false; }
}

window.processAdminLogin = async function() {
    const em = document.getElementById('admin-email').value.trim();
    const pw = document.getElementById('admin-pass').value.trim();
    if(!em || !pw) { window.customAlert('Gagal', 'Email dan Kata Sandi wajib diisi!', 'error'); return; }
    
    const btn = document.getElementById('btn-admin-login');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memverifikasi...</span>'; 
    btn.disabled = true;
    
    try {
        await signInWithEmailAndPassword(auth, em, pw);
    } catch(e) {
        window.customAlert('Akses Ditolak', 'Email atau Kata Sandi tidak valid.', 'error');
        resetLoginButtons();
    }
};

window.processAdminGoogleLogin = async function() {
    const provider = new GoogleAuthProvider();
    const btn = document.getElementById('btn-admin-google');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memverifikasi...</span>'; 
    btn.disabled = true;
    
    try {
        await signInWithPopup(auth, provider);
    } catch(e) {
        window.customAlert('Batal / Gagal', 'Login Google dibatalkan atau gagal.', 'error');
        resetLoginButtons();
    }
};

window.logoutAdmin = async function() {
    await signOut(auth);
    window.location.reload();
};

async function initAdminApp() {
    const savedTheme = localStorage.getItem('vipercell_theme') || 'dark';
    const icon = document.getElementById('admin-theme-icon');
    if(icon) icon.className = savedTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    updateSoundIconUI();
    
    // Perbaikan Bug Resize Live Chat Mobile -> Desktop
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
                mainPanel.style.transform = 'translateX(0)';
            } else {
                sidePanel.style.display = 'flex';
                mainPanel.style.display = 'none';
            }
        }
    });

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
}

// ==========================================
// DATA LISTENERS (REAL-TIME FIRESTORE)
// ==========================================
let isAdminListening = false;
function listenAdminData() {
    if (isAdminListening) return;
    isAdminListening = true;

    // 1. SETTINGS
    onSnapshot(doc(db, pathSettings, 'mainConfig'), (docSnap) => {
        if (docSnap.exists()) {
            siteSettings = { ...siteSettings, ...docSnap.data() };
        } else {
            setDoc(doc(db, pathSettings, 'mainConfig'), siteSettings).catch(()=>{});
        }
        isSettingsLoaded = true;
        window.populateAdminSettings();
        window.renderAdminBanners();
        window.renderAdminNews();
    });

    // 2. PRODUCTS
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
                groupedBrands.push({ brandName: brandName, type: p.type, imgUrlBase64: p.imgUrlBase64 || '', desc: p.desc || '', isGangguan: p.isGangguan || false, items: [p] });
            }
        });
        window.renderAdminProducts();
        
        const appBrands = groupedBrands.filter(b => b.type === 'app');
        const filterSel = document.getElementById('view-stock-category');
        if(filterSel) {
            const curFil = filterSel.value;
            let selFilHtml = '<option value="">-- Pilih Brand Untuk Dilihat --</option>';
            appBrands.forEach(b => { selFilHtml += `<option value="${window.escapeHtml(b.brandName)}">${window.escapeHtml(b.brandName)}</option>`; });
            filterSel.innerHTML = selFilHtml;
            if(appBrands.some(b => b.brandName === curFil)) filterSel.value = curFil;
        }
        const addSel = document.getElementById('stock-brand-select');
        if(addSel) {
            const curAdd = addSel.value;
            let selAddHtml = '<option value="">-- Pilih Produk Aplikasi --</option>';
            appBrands.forEach(b => { selAddHtml += `<option value="${window.escapeHtml(b.brandName)}">${window.escapeHtml(b.brandName)}</option>`; });
            addSel.innerHTML = selAddHtml;
            if(appBrands.some(b => b.brandName === curAdd)) addSel.value = curAdd;
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

    // 5. ORDERS + AUTO-KIRIM STOK MULTI-QTY
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
                    
                    // Pesanan Baru Masuk
                    if (!oldStatus && (data.status === 'PENDING' || data.status === 'UNPAID')) {
                        window.playAdminDing('order');
                        window.showToast('Pesanan Baru!', `Invoice ${data.id} baru saja dibuat.`, 'info');
                    }
                    // Pembayaran Lunas -> Cek Auto-Process atau Manual
                    else if ((oldStatus === 'PENDING' || oldStatus === 'UNPAID' || !oldStatus) && data.status === 'SUCCESS' && !data.adminReply) {
                        window.playAdminDing('order');
                        let hasAppItem = data.items && data.items.some(i => i.type === 'app');
                        let isManualProcess = data.items && data.items.some(i => i.processType === 'manual');
                        
                        if (hasAppItem && !isManualProcess) {
                            window.autoProcessOrder(data, dbId);
                        } else {
                            window.showToast('Pembayaran Lunas!', `Invoice ${data.id} butuh proses manual!`, 'success');
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
// PENGIRIMAN STOK OTOMATIS MULTI-QTY (DIPERBAIKI MATANG)
// ==========================================
window.autoProcessOrder = async function(orderData, orderDbId) {
    if (autoProcessingLocks[orderDbId]) return;
    autoProcessingLocks[orderDbId] = true;

    const appItem = orderData.items.find(i => i.type === 'app');
    if(!appItem) {
        delete autoProcessingLocks[orderDbId];
        return;
    }
    
    const targetBrand = appItem.brandName || appItem.name.split(' - ')[0];
    const exactItemName = appItem.exactItemName || appItem.name.replace(`(x${appItem.qty})`, '').trim();
    const neededQty = parseInt(appItem.qty) || 1;
    
    try {
        const q = query(
            collection(db, pathStocks),
            where("brand", "==", targetBrand),
            where("itemName", "==", exactItemName),
            where("status", "==", "Ready")
        );
        const snap = await getDocs(q);
        
        // Pastikan jumlah stok mencukupi sesuai qty yang dibeli
        if (snap.docs.length >= neededQty) {
            const selectedDocs = snap.docs.slice(0, neededQty);
            let accountsTextBlocks = [];

            for (let idx = 0; idx < selectedDocs.length; idx++) {
                const stockDoc = selectedDocs[idx];
                const stockData = stockDoc.data();
                const parts = stockData.data.split('|');

                // Tandai masing-masing stok sebagai Used
                await updateDoc(doc(db, pathStocks, stockDoc.id), {
                    status: 'Used',
                    usedAt: Date.now(),
                    orderId: orderData.id
                });

                const headerLabel = neededQty > 1 ? `[AKUN #${idx + 1}]\n` : '';
                accountsTextBlocks.push(
                    `${headerLabel}Email/NoHP : ${parts[0] || '-'}\nPassword   : ${parts[1] || '-'}\nKeterangan : ${parts[2] || '-'}`
                );
            }

            const replyText = `Terima kasih! Pembayaran Anda telah lunas.\n\nBerikut Detail ${neededQty} Akun Premium (${targetBrand} - ${exactItemName}):\n\n` +
                              accountsTextBlocks.join('\n------------------------\n') +
                              `\n\nSilakan langsung diamankan. Hubungi Live Chat jika butuh bantuan.`;

            await updateDoc(doc(db, pathOrders, orderDbId), { adminReply: replyText });
            window.showToast('Auto-Delivery Sukses!', `${neededQty} akun terkirim otomatis ke Invoice ${orderData.id}.`, 'success');
        } else {
            window.showToast('Stok Kurang / Kosong!', `Invoice ${orderData.id} butuh ${neededQty} stok (${exactItemName}), tersedia ${snap.docs.length}. Proses secara manual!`, 'error');
        }
    } catch(e) {
        console.error("Auto Process Gagal: ", e);
    } finally {
        delete autoProcessingLocks[orderDbId];
    }
};

// ==========================================
// RINGKASAN & LAPORAN DASHBOARD LENGKAP
// ==========================================
window.generateAdminReports = function() {
    const successOrders = orders.filter(o => o.status === 'SUCCESS');
    const needActionCount = orders.filter(o => o.status === 'PENDING' || (o.status === 'SUCCESS' && !o.adminReply)).length;
    
    const todayStr = new Date().toLocaleDateString('id-ID');
    let totalRevenue = 0;
    let todayRevenue = 0;
    let totalSales = successOrders.length;
    let productCountMap = {};
    
    successOrders.forEach(o => {
        const orderTotal = o.finalTotal || 0;
        totalRevenue += orderTotal;
        if (new Date(o.date).toLocaleDateString('id-ID') === todayStr) {
            todayRevenue += orderTotal;
        }
        (o.items || []).forEach(item => {
            const cleanName = item.brandName ? `${item.brandName} - ${item.exactItemName || item.name}` : item.name;
            if (!productCountMap[cleanName]) productCountMap[cleanName] = { qty: 0, revenue: 0 };
            const iQty = item.qty || 1;
            productCountMap[cleanName].qty += iQty;
            productCountMap[cleanName].revenue += ((item.priceNum || 0) * iQty);
        });
    });
    
    const revEl = document.getElementById('report-revenue');
    const todayRevEl = document.getElementById('report-today-revenue');
    const saleEl = document.getElementById('report-sales');
    const pendEl = document.getElementById('report-pending');

    if(revEl) revEl.innerText = `Rp${totalRevenue.toLocaleString('id-ID')}`;
    if(todayRevEl) todayRevEl.innerText = `Rp${todayRevenue.toLocaleString('id-ID')}`;
    if(saleEl) saleEl.innerText = totalSales;
    if(pendEl) pendEl.innerText = needActionCount;
    
    // Tabel Top 5 Produk Terlaris
    const sortedProducts = Object.entries(productCountMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    const topTbody = document.getElementById('report-top-products');
    if(topTbody) {
        if (sortedProducts.length === 0) {
            topTbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Belum ada data penjualan sukses.</td></tr>';
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

    // Tabel 5 Transaksi Terbaru
    const recentTbody = document.getElementById('report-recent-orders');
    if (recentTbody) {
        const recentFive = orders.slice(0, 5);
        if (recentFive.length === 0) {
            recentTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada transaksi masuk.</td></tr>';
        } else {
            let rHtml = '';
            recentFive.forEach(o => {
                const badgeCls = o.status === 'SUCCESS' ? 'status-success' : (o.status === 'PENDING' ? 'status-pending' : (o.status === 'UNPAID' ? 'status-unpaid' : 'status-failed'));
                const itemTitle = o.items && o.items[0] ? o.items[0].name : '-';
                rHtml += `<tr>
                    <td><strong class="text-dark">${window.escapeHtml(o.id)}</strong></td>
                    <td><span class="text-xs">${window.escapeHtml(itemTitle)}</span></td>
                    <td class="fw-bold">Rp${(o.finalTotal || 0).toLocaleString('id-ID')}</td>
                    <td><span class="status-badge ${badgeCls}">${o.status}</span></td>
                </tr>`;
            });
            recentTbody.innerHTML = rHtml;
        }
    }
};

// ==========================================
// MANAJEMEN PESANAN (FILTER, EXPORT CSV, CLEAN EXPIRED)
// ==========================================
window.setAdminOrderFilter = function(filterType, btnEl) {
    currentOrderFilter = filterType;
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
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
        } else if (currentOrderFilter === 'UNPAID') {
            return o.status === 'UNPAID';
        } else if (currentOrderFilter === 'SUCCESS') {
            return o.status === 'SUCCESS' && !!o.adminReply;
        } else if (currentOrderFilter === 'FAILED') {
            return o.status === 'FAILED' || o.status === 'EXPIRED';
        }
        return true;
    });

    if (queryText !== '') {
        filteredOrders = filteredOrders.filter(o => {
            const matchId = o.id && o.id.toUpperCase().includes(queryText);
            const matchEmail = o.userEmail && o.userEmail.toUpperCase().includes(queryText);
            const matchItem = o.items && o.items.some(i => i.name.toUpperCase().includes(queryText) || (i.playerInfo && i.playerInfo.toUpperCase().includes(queryText)));
            return matchId || matchEmail || matchItem;
        });
    }
    
    if(filteredOrders.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2.5rem;">Tidak ada pesanan yang sesuai dengan filter/pencarian.</td></tr>`; 
        return; 
    }
    
    let renderLimit = filteredOrders.slice(0, 100);
    let html = '';
    renderLimit.forEach(o => {
        const needsManualSend = o.status === 'SUCCESS' && !o.adminReply;
        let sBadge = '';
        if (needsManualSend) {
            sBadge = `<span class="status-badge status-pending"><i class="fa-solid fa-bell"></i> LUNAS (BELUM DIKIRIM)</span>`;
        } else if (o.status === 'UNPAID') {
            sBadge = `<span class="status-badge status-unpaid">UNPAID</span>`;
        } else if (o.status === 'PENDING') {
            sBadge = `<span class="status-badge status-pending">PENDING</span>`;
        } else if (o.status === 'FAILED' || o.status === 'EXPIRED') {
            sBadge = `<span class="status-badge status-failed">${o.status}</span>`;
        } else {
            sBadge = `<span class="status-badge status-success">SELESAI</span>`;
        }
        
        let itemsDesc = (o.items || []).map(i => {
            const pInfo = i.playerInfo || '';
            const copyTargetBtn = i.type === 'game'
                ? `<button class="btn btn-outline btn-sm" style="padding:2px 6px; min-height:22px; font-size:0.65rem; margin-left:6px;" onclick="window.copyTextHelper('${window.escapeJsStr(pInfo)}', 'Data Target')"><i class="fa-regular fa-copy"></i> Salin ID</button>`
                : '';
            return `<strong class="text-dark">${window.escapeHtml(i.name)}</strong><br><span class="text-muted text-xs">${window.escapeHtml(pInfo)}</span>${copyTargetBtn}`;
        }).join('<br>');

        let promoDesc = o.promoCode ? `<br><small class="text-success text-xs fw-bold">Voucher: ${window.escapeHtml(o.promoCode)} (-Rp${o.promoDiscount})</small>` : '';
        let paymentMethodStr = o.paymentMethod === 'cash' ? '<span class="status-badge status-pending">TUNAI</span>' : '<span class="status-badge status-unpaid">QRIS</span>';
        
        let actionBtn = '';
        if(o.status === 'PENDING' || o.status === 'UNPAID' || o.status === 'EXPIRED' || needsManualSend) {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="window.promptProcessOrder('${o.dbId}')"><i class="fa-solid fa-bolt"></i> Proses</button>`;
        } else {
            actionBtn = `<button class="btn btn-outline btn-sm" onclick="window.promptProcessOrder('${o.dbId}')" title="Lihat / Edit Balasan"><i class="fa-solid fa-eye"></i> Detail</button>`;
        }
            
        let deleteBtn = `<button aria-label="Hapus Order" class="btn-icon-only text-danger" style="width:34px; height:34px;" title="Hapus Permanen" onclick="window.promptDeleteOrder('${o.dbId}', '${window.escapeJsStr(o.id)}')"><i class="fa-solid fa-trash"></i></button>`;
        
        html += `<tr>
            <td>
                <strong class="text-dark" style="font-size:0.95rem;">${window.escapeHtml(o.id)}</strong><br>
                <small class="text-muted text-xs">${new Date(o.date).toLocaleString('id-ID')}</small>
            </td>
            <td>${itemsDesc}${promoDesc}</td>
            <td><span class="text-sm fw-bold">${window.escapeHtml(o.userEmail || '-')}</span></td>
            <td>${paymentMethodStr}</td>
            <td class="text-primary fw-bold" style="font-size:0.98rem;">Rp${(o.finalTotal || 0).toLocaleString('id-ID')}</td>
            <td>${sBadge}</td>
            <td><div class="flex-gap align-center">${actionBtn} ${deleteBtn}</div></td>
        </tr>`;
    });
    if (filteredOrders.length > 100) html += `<tr><td colspan="7" class="text-center text-muted">Menampilkan 100 pesanan terbaru...</td></tr>`;
    tbody.innerHTML = html;
};

window.exportOrdersCSV = function() {
    if (orders.length === 0) {
        window.customAlert('Data Kosong', 'Belum ada data pesanan untuk diekspor.', 'warning');
        return;
    }
    const headers = ['Invoice_ID', 'Waktu', 'Email_Pembeli', 'Produk', 'Target_Tujuan', 'Metode_Bayar', 'Total_Bayar', 'Status'];
    const rows = orders.map(o => {
        const itemStr = (o.items || []).map(i => i.name).join('; ');
        const targetStr = (o.items || []).map(i => i.playerInfo).join('; ');
        return [
            o.id,
            new Date(o.date).toLocaleString('id-ID'),
            o.userEmail || '-',
            `"${itemStr.replace(/"/g, '""')}"`,
            `"${targetStr.replace(/"/g, '""')}"`,
            o.paymentMethod || 'qris',
            o.finalTotal || 0,
            o.status
        ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Vipercell_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.showToast('Berhasil Ekspor', 'File CSV laporan transaksi berhasil diunduh.', 'success');
};

window.cleanExpiredOrders = function() {
    const expiredList = orders.filter(o => o.status === 'EXPIRED');
    if (expiredList.length === 0) {
        window.customAlert('Bersih!', 'Tidak ada pesanan berstatus EXPIRED saat ini.', 'info');
        return;
    }
    window.openConfirm('Bersihkan Pesanan Expired', `Hapus permanen <b>${expiredList.length} pesanan EXPIRED</b> agar database lebih rapi?`, async (confirmed) => {
        if (confirmed) {
            for (const exp of expiredList) {
                await deleteDoc(doc(db, pathOrders, exp.dbId)).catch(()=>{});
            }
            window.showToast('Database Bersih', `${expiredList.length} pesanan Expired telah dihapus.`, 'success');
        }
    }, 'delete');
};

window.promptProcessOrder = async function(dbId) {
    const order = orders.find(o => o.dbId === dbId);
    if(!order) return;
    
    document.getElementById('proc-inv').innerText = order.id;
    document.getElementById('proc-order-id').value = dbId;
    
    let defaultReply = order.adminReply || `Pesanan Anda telah berhasil diproses! Silakan cek akun/aplikasi Anda. Terima kasih telah berbelanja di Vipercell!`;
    document.getElementById('proc-reply').value = defaultReply;
    
    const list = document.getElementById('proc-items-list');
    list.innerHTML = '<strong class="text-dark mb-1 d-block">Rincian Item & Tujuan:</strong>' +
        order.items.map(i => `
            <div class="flex-between align-center mt-1" style="background:var(--bg); padding:8px 10px; border-radius:8px; border:1.5px solid var(--border);">
                <div>
                    <strong class="text-dark text-sm">${window.escapeHtml(i.name)}</strong> <span class="status-badge status-unpaid">${i.processType || 'auto'}</span><br>
                    <small class="text-primary fw-bold">${window.escapeHtml(i.playerInfo)}</small>
                </div>
                <button type="button" class="btn btn-outline btn-sm" onclick="window.copyTextHelper('${window.escapeJsStr(i.playerInfo)}', 'Target Tujuan')"><i class="fa-regular fa-copy"></i> Salin</button>
            </div>
        `).join('');
    
    const hasApp = order.items.some(i => i.type === 'app');
    const stockSec = document.getElementById('proc-stock-section');
    const stockSel = document.getElementById('proc-stock-select');
    
    if(hasApp && !order.adminReply) {
        stockSec.style.display = 'block';
        stockSel.innerHTML = '<option value="">Memuat stok Ready dari Gudang...</option>';
        
        const appItem = order.items.find(i => i.type === 'app');
        const targetBrand = appItem.brandName || appItem.name.split(' - ')[0];
        const exactItemName = appItem.exactItemName || appItem.name.replace(`(x${appItem.qty})`, '').trim();
        
        try {
            const q = query(collection(db, pathStocks), where("brand", "==", targetBrand), where("itemName", "==", exactItemName), where("status", "==", "Ready"));
            const snap = await getDocs(q);
            
            if(snap.empty) {
                stockSel.innerHTML = '<option value="">-- Gudang Stok Varian Ini Kosong (Isi Manual di Bawah) --</option>';
            } else {
                let selHtml = '<option value="">-- Pilih Stok Manual (Atau Biarkan Kosong) --</option>';
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
                        document.getElementById('proc-reply').value = `Terima kasih! Berikut Detail Akun Premium Kamu:\n\nEmail/NoHP : ${parts[0] || '-'}\nPassword   : ${parts[1] || '-'}\nKeterangan : ${parts[2] || '-'}`;
                    }
                };
                if (window.tempProcessStocks.length > 0) {
                    stockSel.value = window.tempProcessStocks[0].dbId;
                    stockSel.onchange();
                }
            }
        } catch(e) {
            stockSel.innerHTML = '<option value="">Gagal mengambil daftar stok.</option>';
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
            if(order.items.some(i => i.type === 'app')) {
                const stockSel = document.getElementById('proc-stock-select');
                if(stockSel && stockSel.value) {
                    await updateDoc(doc(db, pathStocks, stockSel.value), { status: 'Used', usedAt: Date.now(), orderId: order.id });
                }
            }
        }
        
        await updateDoc(doc(db, pathOrders, dbId), { status: statusType, adminReply: statusType === 'SUCCESS' ? reply : '' });
        window.closeModal('modal-process-order');
        
        if(statusType === 'SUCCESS') window.showToast('Pesanan Selesai!', `Invoice ${order.id} telah diselesaikan.`, 'success');
        else window.showToast('Pesanan Dibatalkan', `Invoice ${order.id} ditandai FAILED.`, 'info');
    } catch(e) {
        window.customAlert('Error', 'Gagal memperbarui status pesanan.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.promptDeleteOrder = function(dbId, invoiceId) {
    window.openConfirm("Hapus Invoice", `Hapus permanen data transaksi <b>${window.escapeHtml(invoiceId)}</b>?`, async (confirmed) => {
        if(confirmed) {
            await deleteDoc(doc(db, pathOrders, dbId));
            window.showToast("Terhapus", `Invoice ${invoiceId} berhasil dihapus.`, "success");
        }
    }, 'delete');
};

// ==========================================
// GUDANG STOK AKUN PREMIUM
// ==========================================
window.updateAdminStockItemSelect = function() {
    const brandName = document.getElementById('stock-brand-select').value;
    const itemSel = document.getElementById('stock-item-select');
    let html = '<option value="">-- Pilih Varian Durasi / Item --</option>';
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
        tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 3rem;"><i class="fa-solid fa-filter" style="font-size:2rem; display:block; margin-bottom:10px;"></i> Pilih kategori brand di atas untuk merender tabel stok.</td></tr>';
        return;
    }
    
    tb.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Mengambil data stok dari server...</td></tr>';
    
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
            tb.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding:2.5rem;">Gudang stok kosong untuk produk ini.</td></tr>';
            return;
        }
        
        localStocks.sort((a,b) => (a.status === 'Ready' ? -1 : 1) || (b.createdAt - a.createdAt));
        let html = '';
        localStocks.forEach((s, i) => {
            const parts = (s.data || '').split('|');
            const em = parts[0] || '-'; const pw = parts[1] || '-'; const dur = parts[2] || '-';
            const badge = s.status === 'Ready'
                ? '<span class="status-badge status-success">READY</span>'
                : `<span class="status-badge status-failed">TERJUAL ${s.orderId ? '(' + window.escapeHtml(s.orderId) + ')' : ''}</span>`;
            html += `<tr>
                <td><b>${i+1}</b></td>
                <td><strong class="text-dark">${window.escapeHtml(s.brand)}</strong><br><small class="text-primary fw-bold">${window.escapeHtml(s.itemName || '-')}</small></td>
                <td><strong class="text-dark">${window.escapeHtml(em)}</strong><br><small class="text-muted code-input">${window.escapeHtml(pw)}</small></td>
                <td class="text-dark text-sm">${window.escapeHtml(dur)}</td>
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
        window.customAlert('Data Belum Lengkap', 'Pilih produk, varian item, dan masukkan minimal 1 baris data akun (Email|Password|Info).', 'warning');
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
                await addDoc(collection(db, pathStocks), {
                    brand: brand,
                    itemName: itemName,
                    data: line.trim(),
                    status: 'Ready',
                    createdAt: Date.now()
                });
                count++;
            }
        }
        document.getElementById('stock-bulk-input').value = '';
        
        const filterSel = document.getElementById('view-stock-category');
        if (filterSel) {
            filterSel.value = brand;
            window.renderAdminStocksByCategory();
        }
        
        window.showToast('Stok Ditambahkan', `${count} akun baru siap dikirim otomatis!`, 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan stok ke database.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteStock = async function(dbId) {
    window.openConfirm('Hapus Stok', 'Hapus baris stok akun ini secara permanen?', async (confirmed) => {
        if(confirmed) {
            await deleteDoc(doc(db, pathStocks, dbId));
            window.showToast('Terhapus', 'Data stok akun telah dihapus.', 'info');
            window.renderAdminStocksByCategory(); 
        }
    }, 'delete');
};

window.deleteUsedStocksByCategory = async function() {
    const brand = document.getElementById('view-stock-category').value;
    if (!brand) {
        window.customAlert('Pilih Kategori', 'Pilih brand terlebih dahulu di dropdown filter stok.', 'warning');
        return;
    }
    window.openConfirm('Hapus Stok Terjual', `Bersihkan semua stok yang sudah berstatus <b>TERJUAL (Used)</b> pada produk <b>${window.escapeHtml(brand)}</b>?`, async (confirmed) => {
        if (confirmed) {
            const q = query(collection(db, pathStocks), where("brand", "==", brand), where("status", "==", "Used"));
            const snap = await getDocs(q);
            let delCount = 0;
            for (const d of snap.docs) {
                await deleteDoc(doc(db, pathStocks, d.id));
                delCount++;
            }
            window.showToast('Gudang Dibersihkan', `${delCount} stok terjual berhasil dihapus.`, 'success');
            window.renderAdminStocksByCategory();
        }
    }, 'delete');
};

// ==========================================
// MANAJEMEN PRODUK (KATALOG & HARGA)
// ==========================================
window.renderAdminProducts = function() {
    const tbody = document.getElementById('admin-prod-list');
    if(!tbody) return;
    if(groupedBrands.length === 0) {
        tbody.innerHTML = `<div class="dashboard-panel text-center text-muted">Katalog masih kosong. Klik tombol "Tambah Brand / Produk Baru" di atas.</div>`;
        return;
    }
    
    let html = '';
    groupedBrands.forEach(b => {
        const safeHtmlBrand = window.escapeHtml(b.brandName);
        const safeJsBrand = window.escapeJsStr(b.brandName);
        const imgHtml = b.imgUrlBase64
            ? `<img src="${b.imgUrlBase64}" style="width:54px; height:54px; object-fit:cover; border-radius:12px; border:2px solid var(--border);" loading="lazy" alt="${safeHtmlBrand}">`
            : `<div style="width:54px; height:54px; background:var(--accent-yellow); color:#0f172a; border:2px solid var(--border); display:flex; justify-content:center; align-items:center; border-radius:12px; font-weight:900; font-size:1.5rem;">${safeHtmlBrand.charAt(0)}</div>`;
        
        const itemsCount = b.items.length;
        const isSoldOut = b.items.every(i => i.soldOut);
        
        let statusBadgeHtml = isSoldOut ? '<span class="status-badge status-failed">HABIS SEMUA</span>' : '<span class="status-badge status-success">AKTIF</span>';
        if (b.isGangguan) statusBadgeHtml = '<span class="status-badge status-pending">GANGGUAN SERVER</span>';
        
        html += `
        <div class="dashboard-panel flex-between align-center mb-2" style="padding:1.2rem; flex-wrap:wrap; gap:12px;">
            <div class="flex-gap align-center">
                ${imgHtml}
                <div>
                    <strong class="text-dark" style="font-size:1.12rem;">${safeHtmlBrand}</strong><br>
                    <span class="text-xs fw-bold text-muted">${b.type === 'app' ? '📱 APLIKASI PREMIUM' : '🎮 TOP UP GAME'} &bull; ${itemsCount} Varian Harga</span>
                </div>
            </div>
            <div class="flex-wrap-gap align-center">
                ${statusBadgeHtml}
                <button class="btn btn-outline btn-sm" onclick="window.openProductGroupModal('${safeJsBrand}')"><i class="fa-solid fa-pen"></i> Kelola Varian</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteProductGroup('${safeJsBrand}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    });
    tbody.innerHTML = html;
};

window.toggleInputTypeBox = function() {
    const type = document.getElementById('manage-prod-type').value;
    const inputGroup = document.getElementById('group-tipe-input');
    if (inputGroup) inputGroup.style.display = type === 'game' ? 'block' : 'none';
};

window.selectInputType = function(val, el) {
    document.querySelectorAll('.type-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    el.querySelector('input').checked = true;
};

window.openProductGroupModal = function(brandName = null) {
    currentGroupNominals = [];
    if(brandName) {
        const group = groupedBrands.find(b => b.brandName === brandName);
        if(group) {
            document.getElementById('modal-prod-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Grup Produk';
            document.getElementById('manage-prod-old-brand').value = brandName;
            document.getElementById('manage-prod-type').value = group.type;
            document.getElementById('manage-prod-brand').value = group.brandName;
            document.getElementById('manage-prod-img-base64').value = group.imgUrlBase64 || '';
            document.getElementById('manage-prod-desc').value = group.desc || '';
            document.getElementById('manage-prod-file-name').innerText = group.imgUrlBase64 ? 'Gambar Tersimpan' : 'Belum ada gambar';
            
            const gangguanEl = document.getElementById('manage-prod-gangguan');
            if(gangguanEl) gangguanEl.checked = group.isGangguan || false;
            
            currentGroupNominals = group.items.map(i => ({
                dbId: i.dbId,
                name: i.name,
                priceNum: i.priceNum,
                processType: i.processType || 'auto',
                soldOut: i.soldOut || false
            }));
            
            const allSoldOut = currentGroupNominals.length > 0 && currentGroupNominals.every(n => n.soldOut);
            document.getElementById('manage-prod-soldout').checked = allSoldOut;
            
            let inpType = group.items[0]?.inputType || 'id_zone';
            const targetEl = document.querySelector(`.type-card input[value="${inpType}"]`);
            if(targetEl) window.selectInputType(inpType, targetEl.parentElement);
        }
    } else {
        document.getElementById('modal-prod-title').innerHTML = '<i class="fa-solid fa-plus"></i> Tambah Brand Produk Baru';
        document.getElementById('manage-prod-old-brand').value = '';
        document.getElementById('manage-prod-type').value = 'game';
        document.getElementById('manage-prod-brand').value = '';
        document.getElementById('manage-prod-desc').value = '';
        document.getElementById('manage-prod-img-base64').value = '';
        document.getElementById('manage-prod-file-name').innerText = 'Belum ada gambar';
        document.getElementById('manage-prod-soldout').checked = false;
        
        const gangguanEl = document.getElementById('manage-prod-gangguan');
        if(gangguanEl) gangguanEl.checked = false;
        
        const defaultEl = document.querySelector(`.type-card input[value="id_zone"]`);
        if(defaultEl) window.selectInputType('id_zone', defaultEl.parentElement);
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
    document.getElementById('btn-add-item').innerHTML = '<i class="fa-solid fa-plus"></i> Tambah Varian ke Daftar';
    document.getElementById('btn-cancel-edit-item').style.display = 'none';
};

window.editTempNominal = function(idx) {
    const item = currentGroupNominals[idx];
    if(!item) return;
    document.getElementById('temp-nom-name').value = item.name;
    document.getElementById('temp-nom-price').value = item.priceNum;
    document.getElementById('temp-nom-status').value = item.processType;
    document.getElementById('temp-nom-index').value = idx;
    document.getElementById('btn-add-item').innerHTML = '<i class="fa-solid fa-check"></i> Simpan Perubahan Varian';
    document.getElementById('btn-cancel-edit-item').style.display = 'inline-flex';
};

window.addOrUpdateTempNominal = function() {
    const idx = parseInt(document.getElementById('temp-nom-index').value);
    const name = document.getElementById('temp-nom-name').value.trim();
    const priceNum = parseInt(document.getElementById('temp-nom-price').value) || 0;
    const processType = document.getElementById('temp-nom-status').value || 'auto';
    if(!name || priceNum <= 0) {
        window.customAlert('Input Belum Valid', 'Nama Varian dan Harga Jual wajib diisi dengan benar.', 'warning');
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
    if(!container) return;
    
    if(currentGroupNominals.length === 0) {
        container.innerHTML = `<div class="text-center text-muted text-sm" style="padding: 12px;">Belum ada varian ditambahkan. Isi form di atas lalu klik "Tambah Varian ke Daftar".</div>`;
        return;
    }
    
    let html = '';
    currentGroupNominals.forEach((nom, index) => {
        const isSold = nom.soldOut ? 'checked' : '';
        const badgeType = nom.processType === 'manual'
            ? `<span class="status-badge status-pending">MANUAL</span>`
            : `<span class="status-badge status-success">AUTO</span>`;
        html += `
        <div class="flex-between align-center" style="padding: 10px 12px; background: var(--bg); border: 2px solid var(--border); border-radius: 10px; margin-bottom: 8px;">
            <div>
                <div class="fw-bold text-dark text-sm">${window.escapeHtml(nom.name)} ${badgeType}</div>
                <div class="text-primary fw-bold text-xs">Rp${nom.priceNum.toLocaleString('id-ID')}</div>
            </div>
            <div class="flex-gap align-center">
                <label class="text-xs fw-bold text-danger pointer flex-gap align-center" style="margin:0;">
                    <input type="checkbox" class="large-checkbox" style="width:16px; height:16px;" onchange="window.toggleIndividualSoldOut(${index}, this.checked)" ${isSold}> Habis
                </label>
                <button class="btn-icon-only text-primary" style="width:32px; height:32px;" onclick="window.editTempNominal(${index})" title="Edit Varian"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon-only text-danger" style="width:32px; height:32px;" onclick="window.removeTempNominal(${index})" title="Hapus Varian"><i class="fa-solid fa-trash"></i></button>
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
    
    let inputType = 'id_zone';
    const checkedType = document.querySelector('input[name="manage_input_type"]:checked');
    if(checkedType) inputType = checkedType.value;
    
    if(!brand) { window.customAlert('Error', 'Nama Brand / Produk wajib diisi.', 'error'); return; }
    if(currentGroupNominals.length === 0) { window.customAlert('Error', 'Tambahkan minimal 1 varian harga ke dalam grup produk ini.', 'error'); return; }
    
    const btn = document.getElementById('btn-save-group');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan Katalog...</span>';
    btn.disabled = true;
    try {
        const oldGroup = groupedBrands.find(b => b.brandName === oldBrand);
        const oldDbIds = oldGroup ? oldGroup.items.map(i => i.dbId) : [];
        const newDbIds = currentGroupNominals.map(n => n.dbId).filter(id => id);
        
        const toDelete = oldDbIds.filter(id => !newDbIds.includes(id));
        for(const id of toDelete) { await deleteDoc(doc(db, pathProducts, id)); }
        
        for(const nom of currentGroupNominals) {
            const prodData = {
                type: type, brand: brand, name: nom.name, priceNum: nom.priceNum,
                processType: nom.processType || 'auto', imgUrlBase64: imgBase64, desc: desc,
                soldOut: nom.soldOut, inputType: type === 'game' ? inputType : null, isGangguan: isGangguan 
            };
            if(nom.dbId) await updateDoc(doc(db, pathProducts, nom.dbId), prodData);
            else await addDoc(collection(db, pathProducts), prodData);
        }
        
        window.closeModal('modal-manage-product');
        window.showToast('Tersimpan!', `Katalog produk ${brand} berhasil diperbarui.`, 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan grup produk.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteProductGroup = function(brandName) {
    window.openConfirm("Hapus Grup Produk", `Hapus seluruh varian dari produk <b>${window.escapeHtml(brandName)}</b>?`, async (confirmed) => {
        if(confirmed) {
            const group = groupedBrands.find(b => b.brandName === brandName);
            if(group) {
                for(const item of group.items) { await deleteDoc(doc(db, pathProducts, item.dbId)); }
                window.showToast('Dihapus', `Grup produk ${brandName} telah dihapus.`, 'info');
            }
        }
    }, 'delete');
};

const manageProdImgEl = document.getElementById('manage-prod-img-file');
if(manageProdImgEl) {
    manageProdImgEl.addEventListener('change', function(e) {
        if (e.target.files[0]) {
            document.getElementById('manage-prod-file-name').innerText = e.target.files[0].name;
            window.resizeImageBase64(e.target.files[0], (b64) => {
                document.getElementById('manage-prod-img-base64').value = b64;
                window.renderTempNominals(); 
            }, 600, 600);
        }
    });
}

// ==========================================
// ULASAN PEMBELI & BALASAN ADMIN
// ==========================================
window.renderReviews = function() {
    const list = document.getElementById('admin-reviews-list');
    if(!list) return;
    
    if(reviewsList.length === 0) {
        list.innerHTML = '<div class="dashboard-panel text-center text-muted" style="padding: 3rem;">Belum ada ulasan yang masuk dari pembeli.</div>';
        return;
    }
    
    let html = '';
    reviewsList.forEach(r => {
        let stars = '';
        for(let i=0; i<5; i++) {
            stars += `<i class="fa-${i < r.rating ? 'solid' : 'regular'} fa-star text-warning text-xs"></i>`;
        }
        
        const invBadge = r.orderId ? `<span class="status-badge status-unpaid">#${window.escapeHtml(r.orderId)}</span>` : '';
        const adminReplyHtml = r.adminReply 
            ? `<div class="mt-2 text-sm bg-primary-light border-primary" style="padding:10px 12px; border-radius:8px;">
                 <strong class="text-primary"><i class="fa-solid fa-reply"></i> Balasan Admin:</strong><br>
                 <span class="text-dark">${window.escapeHtml(r.adminReply)}</span>
               </div>` 
            : '';

        html += `
        <div class="dashboard-panel flex-between align-center mb-2" style="padding: 1.3rem; flex-wrap:wrap; gap:14px;">
            <div style="flex:1; min-width:240px;">
                <div class="flex-gap align-center mb-1">
                    <strong class="text-dark" style="font-size:1rem;">${window.escapeHtml(r.userName || 'Pelanggan')}</strong>
                    <small class="text-muted">(${window.escapeHtml(r.userEmail || '-')})</small>
                    ${invBadge}
                </div>
                <div class="mb-2">${stars} <span class="text-primary fw-bold text-sm ms-2">${window.escapeHtml(r.brandName)}</span></div>
                <p class="bg-bg border-border text-dark" style="padding:10px 12px; border-radius:8px; margin:0; font-size:0.92rem;">"${window.escapeHtml(r.text)}"</p>
                ${adminReplyHtml}
                <small class="text-muted text-xs d-block mt-2"><i class="fa-regular fa-clock"></i> ${new Date(r.timestamp).toLocaleString('id-ID')}</small>
            </div>
            
            <div class="flex-gap">
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
    if(!replyTxt) return window.customAlert('Balasan Kosong', 'Silakan tulis balasan untuk ulasan ini.', 'warning');
    
    const btn = document.getElementById('btn-save-review-reply');
    const og = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        await updateDoc(doc(db, pathReviews, dbId), { adminReply: replyTxt });
        window.closeModal('modal-reply-review');
        window.showToast('Balasan Dipublikasikan', 'Balasan Anda kini tampil di bawah ulasan pembeli.', 'success');
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
            window.showToast('Terhapus', 'Ulasan berhasil dihapus.', 'success');
        }
    }, 'delete');
};

// ==========================================
// MANAJEMEN VOUCHER & PROMO
// ==========================================
window.renderAdminPromos = function() {
    const tbody = document.getElementById('admin-promo-list');
    if(!tbody) return;
    
    if(promos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">Belum ada kode promo dibuat.</td></tr>';
        return;
    }
    let html = '';
    promos.forEach(p => {
        const typeStr = p.type === 'percent' ? `${p.amount}%` : `Rp${p.amount.toLocaleString('id-ID')}`;
        const targetStr = p.targetBrand === 'all' ? 'Semua Produk' : (p.targetBrand || 'Semua');
        const userTgt = p.targetUser === 'new' ? 'Khusus User Baru' : 'Semua User';
        
        html += `<tr>
            <td><strong class="text-dark code-input" style="font-size:0.95rem;">${window.escapeHtml(p.code)}</strong></td>
            <td><span class="status-badge status-success">${typeStr}</span></td>
            <td class="text-dark">${window.escapeHtml(targetStr)}</td>
            <td><span class="text-warning text-xs fw-bold">${userTgt}</span></td>
            <td class="text-dark fw-bold">${p.usedCount || 0} / ${p.maxUses}</td>
            <td>${p.active ? '<span class="status-badge status-success">AKTIF</span>' : '<span class="status-badge status-failed">NONAKTIF</span>'}</td>
            <td>
                <div class="flex-gap align-center">
                    <button class="btn-icon-only text-primary" style="width:32px; height:32px;" onclick="window.openPromoModal('${p.dbId}')"><i class="fa-solid fa-pen"></i></button>
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
        window.customAlert('Data Tidak Valid', 'Kode Promo, Nilai Potongan, dan Kuota wajib diisi lebih dari 0.', 'warning');
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
        window.showToast('Sukses', `Kode promo ${data.code} disimpan.`, 'success');
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
            window.showToast('Dihapus', 'Kode promo berhasil dihapus.', 'info');
        }
    }, 'delete');
};

// ==========================================
// BERITA & KOMUNITAS WEB
// ==========================================
window.renderAdminNews = function() {
    const list = document.getElementById('admin-news-list');
    if(!list) return;
    const newsData = siteSettings.newsList || [];
    if(newsData.length === 0) {
        list.innerHTML = '<p class="text-muted text-center p-3">Belum ada pengumuman atau berita komunitas.</p>';
        return;
    }
    
    let html = '';
    newsData.forEach((t, i) => {
        html += `<div class="info-box bg-bg mb-2 flex-between align-center">
            <div><strong class="text-dark">${window.escapeHtml(t.title)}</strong><br><small class="text-muted">Artikel Informasi</small></div>
            <div class="flex-gap">
                <button class="btn-icon-only text-primary" style="width:32px; height:32px;" onclick="window.openNewsModal(${i})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon-only text-danger" style="width:32px; height:32px;" onclick="window.deleteNews(${i})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    });
    list.innerHTML = html;
};

window.openNewsModal = function(index = -1) {
    document.getElementById('manage-news-index').value = index;
    if (index > -1 && siteSettings.newsList && siteSettings.newsList[index]) {
        const news = siteSettings.newsList[index];
        document.getElementById('manage-news-title').value = news.title || '';
        document.getElementById('manage-news-image').value = news.imageUrl || '';
        document.getElementById('manage-news-desc').value = news.desc || '';
        document.getElementById('modal-news-title').innerText = "Edit Berita / Pengumuman";
    } else {
        document.getElementById('manage-news-title').value = '';
        document.getElementById('manage-news-image').value = '';
        document.getElementById('manage-news-desc').value = '';
        document.getElementById('modal-news-title').innerText = "Tambah Berita Baru";
    }
    window.openModal('modal-manage-news');
};

window.handleNewsUpload = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    window.resizeImageBase64(file, (b64) => {
        document.getElementById('manage-news-image').value = b64;
        window.showToast('Gambar Siap', 'Gambar lampiran berita berhasil diproses.', 'success');
    }, 800, 600);
};

window.saveNews = async function() {
    const idx = parseInt(document.getElementById('manage-news-index').value);
    const title = document.getElementById('manage-news-title').value.trim();
    const imageUrl = document.getElementById('manage-news-image').value.trim();
    const desc = document.getElementById('manage-news-desc').value.trim();
    if(!title || !desc) { window.customAlert('Error', 'Judul dan Isi Pengumuman wajib diisi.', 'error'); return; }
    
    const btn = document.getElementById('btn-save-news');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;
    try {
        const newsList = siteSettings.newsList ? [...siteSettings.newsList] : [];
        if (idx > -1) newsList[idx] = { title, imageUrl, desc, isHidden: false };
        else newsList.push({ title, imageUrl, desc, isHidden: false });
        
        await updateDoc(doc(db, pathSettings, 'mainConfig'), { newsList: newsList });
        window.closeModal('modal-manage-news');
        window.showToast('Tersimpan', 'Berita berhasil dipublikasikan.', 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan berita.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteNews = async function(index) {
    window.openConfirm('Hapus Berita', 'Hapus berita/informasi ini secara permanen?', async (confirmed) => {
        if(confirmed) {
            const newsList = [...siteSettings.newsList];
            newsList.splice(index, 1);
            await updateDoc(doc(db, pathSettings, 'mainConfig'), { newsList: newsList });
            window.showToast('Dihapus', 'Berita berhasil dihapus.', 'info');
        }
    }, 'delete');
};

// ==========================================
// PENGATURAN WEB & QUICK STORE TOGGLE
// ==========================================
window.quickToggleStoreStatus = async function() {
    if (!isSettingsLoaded) return;
    const newStatus = !(siteSettings.isStoreOpen !== false);
    try {
        await updateDoc(doc(db, pathSettings, 'mainConfig'), { isStoreOpen: newStatus });
        window.showToast(
            newStatus ? 'Toko Dibuka!' : 'Toko Ditutup!',
            newStatus ? 'Pelanggan kini dapat melakukan transaksi.' : 'Transaksi sementara dinonaktifkan untuk pelanggan.',
            newStatus ? 'success' : 'info'
        );
    } catch (e) {
        window.customAlert('Error', 'Gagal mengubah status toko.', 'error');
    }
};

window.saveSettingsManual = async function(showNotification = false) {
    if(!isSettingsLoaded) return;
    const newSettings = {
        ...siteSettings,
        logoText: document.getElementById('set-logo-text').value.trim(),
        logoAccent: document.getElementById('set-logo-accent').value.trim(),
        logoImgBase64: document.getElementById('set-logo-base64').value, 
        marquee: document.getElementById('set-marquee').value.trim(),
        adminWa: document.getElementById('set-wa').value.trim(),
        igLink: document.getElementById('set-ig').value.trim(),
        ttLink: document.getElementById('set-tt').value.trim(),
        qrisStringData: document.getElementById('set-qris-string').value.trim(),
        waChannelLink: document.getElementById('set-wa-channel') ? document.getElementById('set-wa-channel').value.trim() : '',
        isStoreOpen: document.getElementById('set-store-status') ? document.getElementById('set-store-status').checked : true
    };
    try {
        await updateDoc(doc(db, pathSettings, 'mainConfig'), newSettings);
        if (showNotification) {
            window.showToast('Pengaturan Disimpan', 'Perubahan konfigurasi web telah aktif.', 'success');
        }
    } catch (e) {
        window.customAlert('Error', 'Gagal menyimpan pengaturan web.', 'error');
    }
};

window.populateAdminSettings = function() {
    document.getElementById('set-logo-text').value = siteSettings.logoText || '';
    document.getElementById('set-logo-accent').value = siteSettings.logoAccent || '';
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

    // Update Tombol Quick Toggle di Header
    const quickBtn = document.getElementById('btn-quick-store-toggle');
    const quickTxt = document.getElementById('quick-store-text');
    if (quickBtn && quickTxt) {
        quickBtn.className = isOpen ? 'btn btn-sm btn-success' : 'btn btn-sm btn-danger';
        quickTxt.innerText = isOpen ? 'TOKO BUKA' : 'TOKO TUTUP';
    }
    
    if(siteSettings.logoImgBase64) {
        const p = document.getElementById('set-logo-preview');
        p.src = siteSettings.logoImgBase64; p.style.display = 'block';
        document.getElementById('set-logo-file-name').innerText = "Gambar Tersimpan";
    }
    
    const adminLogoEl = document.getElementById('admin-header-logo-img');
    const defAdminIco = document.getElementById('admin-header-default-icon');
    if(siteSettings.logoImgBase64) {
        if(adminLogo)