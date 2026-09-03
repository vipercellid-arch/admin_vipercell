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
const pathSaran = isWorkspace ? `artifacts/${appId}/public/data/saran` : 'saran';

// ==========================================
// STATE & VARIABEL GLOBAL (ADMIN)
// ==========================================
let products = [];
let groupedBrands = []; 
let orders = [];
let promos = [];
let vipUsers = []; 
let saranList = [];
let allLiveChats = [];

let siteSettings = { 
    logoText: 'VIPER', logoAccent: 'CELL', logoImgBase64: '', marquee: '',
    qrisImageBase64: '', adminWa: '', igLink: '', ttLink: '',
    newsList: [], banners: [], isStoreOpen: true, waChannelLink: '', botQrisActive: false,
    membership: { price: 50000, disc: 5 }
};

let currentAdminUser = null;
let isSettingsLoaded = false;
let currentGroupNominals = [];
let adminChatUnsubscribe = null;
let previousChatCount = 0;
let previousOrdersData = {};
window.tempProcessStocks = []; // Untuk modal ACC Manual

// ==========================================
// UTILITAS & UI MODALS
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
            callback(canvas.toDataURL('image/webp', 0.7)); 
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
    const alertEl = document.getElementById('custom-alert');
    
    if(titleEl) titleEl.innerText = title;
    if(descEl) descEl.innerHTML = message;
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
    if(alertEl) alertEl.classList.remove('active');
    document.body.classList.remove('no-scroll');
};

window.showToast = function(title, msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    let icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-info"></i>';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-content"><h4>${title}</h4><p>${msg}</p></div>`;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 5000);
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
            iconContainer.style.color = 'var(--danger)'; confirmBtn.style.background = 'var(--danger)'; confirmBtn.style.borderColor = 'var(--danger)';
        } else if (actionType === 'success') {
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
            iconContainer.style.color = 'var(--success)'; confirmBtn.style.background = 'var(--success)'; confirmBtn.style.borderColor = 'var(--success)';
        } else {
            iconContainer.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
            iconContainer.style.color = 'var(--primary-light)'; confirmBtn.style.background = 'var(--primary)'; confirmBtn.style.borderColor = 'var(--primary)';
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
    btnEl.classList.add('active');
    document.getElementById(tabId).style.display = 'block';
    
    const titleText = btnEl.querySelector('span') ? btnEl.querySelector('span').innerText : 'Dashboard Admin';
    const pageTitle = document.getElementById('admin-page-title');
    if(pageTitle) pageTitle.innerText = titleText;
    
    if(window.innerWidth <= 768) {
        const sidebar = document.getElementById('admin-sidebar');
        if(sidebar) sidebar.classList.remove('active');
    }
};

// ==========================================
// SISTEM NOTIFIKASI NATIVE ADMIN
// ==========================================
window.requestSystemNotificationAdmin = async function() {
    const btn = document.getElementById('btn-admin-notif');
    if (!('Notification' in window)) {
        window.customAlert('Tidak Didukung', 'Browser tidak mendukung notifikasi native.', 'warning');
        return;
    }
    
    // Unlock Audio Context on Mobile
    const audio = document.getElementById('notif-sound');
    if(audio) { audio.volume = 0; audio.play().catch(()=>{}); setTimeout(()=>{ audio.volume = 1; }, 500); }
    
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            window.customAlert('Berhasil', 'Sistem notifikasi HP aktif. Alarm akan berbunyi saat ada pesanan atau obrolan masuk.', 'success');
            if(btn) { btn.style.color = 'var(--success)'; btn.style.borderColor = 'var(--success)'; }
        } else {
            window.customAlert('Ditolak', 'Izin ditolak. Silakan izinkan melalui pengaturan browser.', 'warning');
        }
    } catch(e) {}
};

window.fireNativeNotificationAdmin = function(title, msg, type = 'info') {
    window.showToast(title, msg, type);
    
    const audio = document.getElementById('notif-sound');
    if (audio) audio.play().catch(()=>{});
    
    if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body: msg, icon: '/favicon.ico' }); } catch(e) {}
    }
};

// ==========================================
// AUTHENTICATION & LOGIN FLOW (SANGAT RINGAN)
// ==========================================
async function verifyAdminAccess(user) {
    let role = 'user';
    const allowedEmails = ['vipercell.id@gmail.com', 'viperdev4@gmail.com']; // Founder bypass
    
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
        
        window.customAlert('Akses Diterima', `Selamat datang, ${user.email}. Role: ${role.toUpperCase()}`, 'success');
        listenAdminData();
    } else {
        await signOut(auth);
        window.customAlert('Akses Ditolak', 'Identitas tidak dikenal. Anda bukan Administrator.', 'error');
        resetLoginButtons();
    }
}

function resetLoginButtons() {
    const btn = document.getElementById('btn-admin-login');
    const btnG = document.getElementById('btn-admin-google');
    if(btn) { btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> <span>Masuk Sistem</span>'; btn.disabled = false; }
    if(btnG) { btnG.innerHTML = '<i class="fa-brands fa-google"></i> <span>Masuk dengan Google</span>'; btnG.disabled = false; }
}

window.processAdminLogin = async function() {
    const em = document.getElementById('admin-email').value.trim();
    const pw = document.getElementById('admin-pass').value.trim();
    if(!em || !pw) { window.customAlert('Gagal', 'Kredensial wajib diisi!', 'error'); return; }
    
    const btn = document.getElementById('btn-admin-login');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memverifikasi...</span>'; 
    btn.disabled = true;
    
    try {
        await signInWithEmailAndPassword(auth, em, pw);
        // Ter-handle otomatis di onAuthStateChanged
    } catch(e) {
        window.customAlert('Akses Ditolak', 'Kredensial tidak valid.', 'error');
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
        // Ter-handle otomatis di onAuthStateChanged
    } catch(e) {
        window.customAlert('Akses Ditolak', 'Otentikasi Google gagal atau dibatalkan.', 'error');
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
// DATA LISTENERS
// ==========================================
function listenAdminData() {
    onSnapshot(doc(db, pathSettings, 'mainConfig'), (docSnap) => {
        if (docSnap.exists()) {
            siteSettings = { ...siteSettings, ...docSnap.data() };
            if(!siteSettings.membership) siteSettings.membership = { price: 50000, disc: 5 };
        } else {
            setDoc(doc(db, pathSettings, 'mainConfig'), siteSettings).catch(()=>{});
        }
        isSettingsLoaded = true;
        window.populateAdminSettings();
        window.renderAdminBanners();
        window.renderAdminNews();
    });

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
        
        // Update Filter Dropdowns untuk Stok
        const appBrands = groupedBrands.filter(b => b.type === 'app');
        
        const filterSel = document.getElementById('view-stock-category');
        if(filterSel) {
            const curFil = filterSel.value;
            let selFilHtml = '<option value="">-- Pilih Kategori untuk Melihat --</option>';
            appBrands.forEach(b => { selFilHtml += `<option value="${b.brandName}">${b.brandName}</option>`; });
            filterSel.innerHTML = selFilHtml;
            if(appBrands.some(b => b.brandName === curFil)) filterSel.value = curFil;
        }

        const addSel = document.getElementById('stock-brand-select');
        if(addSel) {
            const curAdd = addSel.value;
            let selAddHtml = '<option value="">-- Pilih Produk/Aplikasi --</option>';
            appBrands.forEach(b => { selAddHtml += `<option value="${b.brandName}">${b.brandName}</option>`; });
            addSel.innerHTML = selAddHtml;
            if(appBrands.some(b => b.brandName === curAdd)) addSel.value = curAdd;
        }
    });

    onSnapshot(collection(db, pathPromos), (snapshot) => {
        promos = [];
        snapshot.forEach((docSnap) => { promos.push({ dbId: docSnap.id, ...docSnap.data() }); });
        window.renderAdminPromos();
    });
    
    // PEMANGKASAN MEMORI: Snapshot hanya ditujukan untuk yang berstatus VIP saja!
    onSnapshot(query(collection(db, pathUsers), where("tier", "==", "vip")), (snapshot) => {
        vipUsers = [];
        snapshot.forEach(docSnap => vipUsers.push({uid: docSnap.id, ...docSnap.data()}));
        window.renderAdminMembers();
    });

    // LISTENER KOTAK SARAN
    onSnapshot(collection(db, pathSaran), (snapshot) => {
        saranList = [];
        snapshot.forEach(docSnap => saranList.push({dbId: docSnap.id, ...docSnap.data()}));
        saranList.sort((a,b) => b.createdAt - a.createdAt);
        window.renderSaran();
    });

    onSnapshot(collection(db, pathOrders), (snapshot) => {
        let newOrders = [];
        snapshot.forEach((docSnap) => {
            let data = { dbId: docSnap.id, ...docSnap.data() };
            newOrders.push(data);
            
            let oldStatus = previousOrdersData[data.id];
            if (data.status === 'PENDING' && oldStatus !== 'PENDING') {
                window.fireNativeNotificationAdmin('Pesanan Baru', `Menunggu proses manual untuk Invoice ${data.id}`, 'info');
            }
            previousOrdersData[data.id] = data.status;
        });
        
        orders = newOrders.sort((a,b) => new Date(b.date) - new Date(a.date));
        window.renderAdminOrders();
        window.generateAdminReports();
        window.renderAdminMembers(); // Update jumlah transaksi VIP
        
        const hasPending = orders.some(o => o.status === 'PENDING' || o.status === 'UNPAID');
        const adminOrderTabBadge = document.getElementById('admin-tab-order-badge');
        if(adminOrderTabBadge) adminOrderTabBadge.style.display = hasPending ? 'inline-block' : 'none';
    });
    
    listenAdminLiveChat();
}

// ==========================================
// KOTAK SARAN (AUTO DELETE)
// ==========================================
window.renderSaran = function() {
    const list = document.getElementById('admin-saran-list');
    if(!list) return;
    
    if(saranList.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding: 3rem; color:var(--text-muted); background:var(--surface); border:1px solid var(--border); border-radius:12px;"><i class="fa-solid fa-envelope-circle-check" style="font-size:3rem; margin-bottom:10px; opacity:0.5;"></i><br>Tidak ada saran masuk.</div>';
        return;
    }
    
    let html = '';
    saranList.forEach(s => {
        html += `
        <div style="background:var(--surface); border:1px dashed var(--primary-light); padding:1.2rem; border-radius:12px; display:flex; justify-content:space-between; align-items:center; gap: 15px; flex-wrap:wrap;">
            <div style="flex:1;">
                <strong style="color:var(--text); font-size:1.05rem;">${s.name || 'Anonim'}</strong> <small style="color:var(--text-muted);">(${s.email || '-'})</small>
                <p style="font-size:0.95rem; color:var(--text); margin-top:5px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px;">"${s.message}"</p>
                <small style="color:var(--primary-light); font-size: 0.75rem; display:block; margin-top:5px;"><i class="fa-regular fa-clock"></i> ${new Date(s.createdAt).toLocaleString('id-ID')}</small>
            </div>
            <button class="btn btn-outline" style="color:var(--danger); border-color:var(--danger); white-space:nowrap; height: fit-content;" onclick="window.deleteSaran('${s.dbId}')">
                <i class="fa-solid fa-check-double"></i> Tandai Dibaca (Hapus)
            </button>
        </div>`;
    });
    list.innerHTML = html;
};

window.deleteSaran = async function(dbId) {
    await deleteDoc(doc(db, pathSaran, dbId));
    window.showToast('Sukses', 'Saran telah dibaca dan otomatis dihapus dari pangkalan data.', 'success');
};

// ==========================================
// RINGKASAN & LAPORAN DASHBOARD
// ==========================================
window.generateAdminReports = function() {
    const successOrders = orders.filter(o => o.status === 'SUCCESS');
    const pendingOrdersCount = orders.filter(o => o.status === 'PENDING' || o.status === 'UNPAID').length;
    
    let totalRevenue = 0; let totalSales = successOrders.length;
    let productCountMap = {};
    
    successOrders.forEach(o => {
        totalRevenue += o.finalTotal;
        o.items.forEach(item => {
            if (!productCountMap[item.name]) productCountMap[item.name] = { qty: 0, revenue: 0 };
            productCountMap[item.name].qty += 1;
            productCountMap[item.name].revenue += item.priceNum;
        });
    });
    
    const revEl = document.getElementById('report-revenue');
    const saleEl = document.getElementById('report-sales');
    const pendEl = document.getElementById('report-pending');
    if(revEl) revEl.innerText = `Rp${totalRevenue.toLocaleString('id-ID')}`;
    if(saleEl) saleEl.innerText = totalSales;
    if(pendEl) pendEl.innerText = pendingOrdersCount;
    
    const sortedProducts = Object.entries(productCountMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    const topTbody = document.getElementById('report-top-products');
    
    if(topTbody) {
        if (sortedProducts.length === 0) {
            topTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Belum ada penjualan.</td></tr>';
        } else {
            let html = '';
            sortedProducts.forEach(prod => {
                html += `<tr>
                    <td><strong>${prod[0]}</strong></td>
                    <td><span class="status-badge status-success">${prod[1].qty} Kali</span></td>
                    <td>Rp${prod[1].revenue.toLocaleString('id-ID')}</td>
                </tr>`;
            });
            topTbody.innerHTML = html;
        }
    }
};

// ==========================================
// MANAJEMEN PESANAN (ORDERS)
// ==========================================
window.renderAdminOrders = function() {
    const tbody = document.getElementById('admin-order-list');
    if(!tbody) return;
    
    const searchInput = document.getElementById('admin-search-order');
    let queryText = ''; if(searchInput) queryText = searchInput.value.trim().toUpperCase();
    
    let filteredOrders = orders;
    if (queryText !== '') filteredOrders = orders.filter(o => o.id.includes(queryText));
    
    if(filteredOrders.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding: 2rem;">${queryText ? 'Tidak ada invoice yang cocok' : 'Kosong'}</td></tr>`; 
        return; 
    }
    
    let renderLimit = filteredOrders.slice(0, 100);
    let html = '';
    renderLimit.forEach(o => {
        const sBadge = o.status === 'UNPAID' ? `<span class="status-badge status-unpaid">UNPAID</span>` : o.status === 'PENDING' ? `<span class="status-badge status-pending">PENDING</span>` : o.status === 'FAILED' ? `<span class="status-badge status-failed">FAILED</span>` : o.status === 'EXPIRED' ? `<span class="status-badge status-failed" style="background:rgba(239, 68, 68, 0.2);">EXPIRED</span>` : `<span class="status-badge status-success">SUCCESS</span>`;
        let itemsDesc = o.items.map(i => `${i.name} <br><span style="color:var(--text-muted);font-size:0.75rem">${i.playerInfo}</span>`).join('<br>');
        
        let promoDesc = '';
        if (o.memberDiscountApplied) promoDesc += `<br><small style="color:var(--primary-light);">Potongan VIP (-Rp${o.memberDiscountApplied})</small>`;
        if (o.promoCode) promoDesc += `<br><small style="color:var(--success);">Promo: ${o.promoCode} (-Rp${o.promoDiscount})</small>`;
        
        let paymentMethodStr = o.paymentMethod === 'cash' ? 'Cash/Manual' : 'QRIS';
        
        let actionBtn = '';
        if(o.status === 'PENDING' || o.status === 'UNPAID' || o.status === 'EXPIRED' || (o.status === 'SUCCESS' && !o.adminReply)) {
            actionBtn = `<button aria-label="Proses Manual" class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.75rem;" onclick="window.promptProcessOrder('${o.dbId}')" title="Proses / ACC Manual"><i class="fa-solid fa-bolt"></i> Manual ACC</button>`;
        } else {
            actionBtn = `<span style="font-size:0.75rem;color:var(--text-muted)">Ditinjau/Selesai</span>`;
        }
            
        let deleteBtn = `<button aria-label="Hapus Order" class="btn btn-outline" style="padding:0.4rem; margin-left:4px; color:var(--danger); border-color:transparent;" title="Hapus Permanen" onclick="window.promptDeleteOrder('${o.dbId}', '${o.id}')"><i class="fa-solid fa-trash"></i></button>`;
        
        html += `<tr>
            <td><strong>${o.id}</strong></td>
            <td><small style="color:var(--text-muted)">${new Date(o.date).toLocaleDateString()}</small><br>${itemsDesc}${promoDesc}</td>
            <td>${o.customerWa}</td>
            <td>${paymentMethodStr}</td>
            <td>Rp${o.finalTotal.toLocaleString('id-ID')}</td>
            <td>${sBadge}</td>
            <td style="white-space:nowrap;">${actionBtn} ${deleteBtn}</td>
        </tr>`;
    });
    if (filteredOrders.length > 100) html += `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Menampilkan 100 pesanan terbaru...</td></tr>`;
    tbody.innerHTML = html;
};

window.promptProcessOrder = async function(dbId) {
    const order = orders.find(o => o.dbId === dbId);
    if(!order) return;
    
    document.getElementById('proc-inv').innerText = order.id;
    document.getElementById('proc-order-id').value = dbId;
    
    let defaultReply = '';
    if(order.items[0].type === 'membership') defaultReply = `Paket VIP MEMBER+ berhasil diaktifkan. Terima kasih!`;
    else if(order.items[0].type === 'game') defaultReply = `Pesanan Top Up Game Anda telah berhasil diproses. Silakan cek akun Anda.`;
    document.getElementById('proc-reply').value = defaultReply;
    
    const list = document.getElementById('proc-items-list');
    list.innerHTML = '<strong>Detail Item:</strong><ul style="margin-left:20px; font-size:0.85rem; color:var(--text);">' + order.items.map(i => `<li>${i.name} (${i.processType || 'auto'})<br><small style="color:var(--text-muted);">${i.playerInfo}</small></li>`).join('') + '</ul>';
    
    const hasApp = order.items.some(i => i.type === 'app');
    const stockSec = document.getElementById('proc-stock-section');
    const stockSel = document.getElementById('proc-stock-select');
    
    if(hasApp) {
        stockSec.style.display = 'block';
        stockSel.innerHTML = '<option value="">Memuat stok ready dari Database...</option>';
        
        const appItem = order.items.find(i => i.type === 'app');
        const targetBrand = appItem.brandName || appItem.name.split(' - ')[0];
        const exactItemName = appItem.exactItemName || appItem.name;
        
        try {
            const q = query(collection(db, pathStocks), where("brand", "==", targetBrand), where("itemName", "==", exactItemName), where("status", "==", "Ready"));
            const snap = await getDocs(q);
            
            if(snap.empty) {
                stockSel.innerHTML = '<option value="" disabled>Stok Varian Ini Sedang Kosong!</option>';
            } else {
                let selHtml = '<option value="">-- Pilih Stok --</option>';
                window.tempProcessStocks = [];
                snap.forEach((s) => {
                    const data = {dbId: s.id, ...s.data()};
                    window.tempProcessStocks.push(data);
                    const em = data.data.split('|')[0];
                    selHtml += `<option value="${data.dbId}">${em} | [Ready]</option>`;
                });
                stockSel.innerHTML = selHtml;
                
                stockSel.onchange = function() {
                    const sId = this.value; if(!sId) return;
                    const sData = window.tempProcessStocks.find(x => x.dbId === sId);
                    if(sData) {
                        const parts = sData.data.split('|');
                        document.getElementById('proc-reply').value = `Detail Akun Premium Kamu:\nEmail/NoHP: ${parts[0] || '-'}\nPassword: ${parts[1] || '-'}\nDetail Tambahan: ${parts[2] || '-'}`;
                    }
                };
                if (window.tempProcessStocks.length > 0) { stockSel.value = window.tempProcessStocks[0].dbId; stockSel.onchange(); }
            }
        } catch(e) {
            stockSel.innerHTML = '<option value="" disabled>Gagal mengambil stok.</option>';
        }
    } else {
        stockSec.style.display = 'none';
    }
    window.openModal('modal-process-order');
};

window.markOrderComplete = async function(statusType) {
    const dbId = document.getElementById('proc-order-id').value;
    const reply = document.getElementById('proc-reply').value;
    const order = orders.find(o => o.dbId === dbId);
    
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
            if(order.items[0].type === 'membership') {
                const userQ = query(collection(db, pathUsers), where("email", "==", order.userEmail));
                const userSnap = await getDocs(userQ);
                if(!userSnap.empty) {
                    const uDoc = userSnap.docs[0]; const curData = uDoc.data();
                    let months = order.items[0].itemDuration || 1;
                    let newExp = curData.tierExp || Date.now();
                    if(newExp < Date.now()) newExp = Date.now();
                    newExp += (months * 30 * 24 * 60 * 60 * 1000);
                    await updateDoc(doc(db, pathUsers, uDoc.id), { tier: 'vip', tierExp: newExp });
                }
            }
        }
        await updateDoc(doc(db, pathOrders, dbId), { status: statusType, adminReply: reply });
        window.closeModal('modal-process-order');
        if(statusType === 'SUCCESS') window.customAlert('Sukses', 'Pesanan berhasil diselesaikan.', 'success');
        else window.customAlert('Dibatalkan', 'Pesanan digagalkan.', 'info');
    } catch(e) {
        window.customAlert('Error', 'Gagal memproses pesanan.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.promptDeleteOrder = function(dbId, invoiceId) {
    window.openConfirm("Hapus Permanen", `Hapus seluruh riwayat Invoice ${invoiceId}?`, async (confirmed) => {
        if(confirmed) {
            await deleteDoc(doc(db, pathOrders, dbId));
            window.customAlert("Terhapus", `Invoice ${invoiceId} berhasil dihapus.`, "success");
        }
    }, 'delete');
};

// ==========================================
// STOK AKUN PREMIUM (HEMAT MEMORI 80%)
// ==========================================
window.updateAdminStockItemSelect = function() {
    const brandName = document.getElementById('stock-brand-select').value;
    const itemSel = document.getElementById('stock-item-select');
    let html = '<option value="">-- Pilih Varian Item --</option>';
    if(!brandName) { itemSel.innerHTML = html; return; }
    
    const brand = groupedBrands.find(b => b.brandName === brandName);
    if(brand) { brand.items.forEach(i => { html += `<option value="${i.name}">${i.name}</option>`; }); }
    itemSel.innerHTML = html;
};

window.renderAdminStocksByCategory = async function() {
    const brand = document.getElementById('view-stock-category').value;
    const tb = document.getElementById('admin-stock-list');
    
    if(!brand) {
        tb.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 3rem; color:var(--text-muted);"><i class="fa-solid fa-filter" style="font-size:2rem; display:block; margin-bottom:10px; opacity:0.5;"></i> Pilih kategori produk di atas untuk merender tabel stok. (Penghematan Memori Aktif)</td></tr>';
        return;
    }
    
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Mengambil data dari server...</td></tr>';
    
    try {
        const q = query(collection(db, pathStocks), where("brand", "==", brand));
        const snap = await getDocs(q);
        let localStocks = [];
        snap.forEach(d => localStocks.push({dbId: d.id, ...d.data()}));
        
        if(localStocks.length === 0) {
            tb.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Stok kosong untuk kategori ini.</td></tr>';
            return;
        }
        
        localStocks.sort((a,b) => b.createdAt - a.createdAt);
        let html = '';
        localStocks.forEach((s, i) => {
            const parts = s.data.split('|');
            const em = parts[0] || '-'; const pw = parts[1] || '-'; const dur = parts[2] || '-';
            const badge = s.status === 'Ready' ? '<span class="status-badge status-success">Ready</span>' : '<span class="status-badge status-failed">Terjual</span>';
            html += `<tr>
                <td>${i+1}</td>
                <td><strong>${s.brand}</strong><br><small style="color:var(--primary-light)">${s.itemName || '-'}</small></td>
                <td><strong>${em}</strong><br><small style="color:var(--text-muted)">${pw}</small></td>
                <td>${dur}</td>
                <td>${badge}</td>
                <td><button aria-label="Hapus Stok" class="btn btn-outline" style="color:var(--danger); padding:4px;" onclick="window.deleteStock('${s.dbId}')"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
        });
        tb.innerHTML = html;
    } catch(e) {
        tb.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger);">Gagal mengambil data.</td></tr>';
    }
};

window.addStockMassal = async function() {
    const brand = document.getElementById('stock-brand-select').value;
    const itemName = document.getElementById('stock-item-select').value;
    const rawData = document.getElementById('stock-bulk-input').value.trim();
    
    if(!brand || !itemName || !rawData) { window.customAlert('Error', 'Pilih produk, varian, dan masukkan data secara lengkap.', 'error'); return; }
    
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
        
        // Refresh tabel jika kategori yang sedang dilihat sama
        const curView = document.getElementById('view-stock-category').value;
        if(curView === brand) window.renderAdminStocksByCategory();
        
        window.customAlert('Sukses', `${count} Akun berhasil ditambahkan ke stok.`, 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menambah stok.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteStock = async function(dbId) {
    window.openConfirm('Hapus Stok', 'Hapus stok akun ini secara permanen?', async (confirmed) => {
        if(confirmed) {
            await deleteDoc(doc(db, pathStocks, dbId));
            window.customAlert('Dihapus', 'Stok akun dihapus.', 'info');
            window.renderAdminStocksByCategory(); // Refresh
        }
    }, 'delete');
};

// ==========================================
// MANAJEMEN PRODUK
// ==========================================
window.renderAdminProducts = function() {
    const tbody = document.getElementById('admin-prod-list');
    if(!tbody) return;
    if(groupedBrands.length === 0) { tbody.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--text-muted);">Katalog kosong. Klik Tambah Grup Baru.</div>`; return; }
    
    let html = '';
    groupedBrands.forEach(b => {
        const imgHtml = b.imgUrlBase64 ? `<img src="${b.imgUrlBase64}" style="width:40px; height:40px; object-fit:cover; border-radius:8px;" loading="lazy" alt="${b.brandName}">` : `<div style="width:40px; height:40px; background:var(--primary); color:white; display:flex; justify-content:center; align-items:center; border-radius:8px; font-weight:bold;">${b.brandName.charAt(0)}</div>`;
        const itemsCount = b.items.length;
        const isSoldOut = b.items.every(i => i.soldOut);
        
        let statusBadgeHtml = isSoldOut ? '<span class="status-badge status-failed">Habis Semua</span>' : '<span class="status-badge status-success">Tersedia</span>';
        if (b.isGangguan) statusBadgeHtml = '<span class="status-badge status-failed" style="background:var(--warning); color:black; border-color:var(--warning);">Gangguan Server</span>';
        
        html += `
        <div style="background:var(--surface); border:1px solid var(--border); padding:1rem; border-radius:12px; display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    ${imgHtml}
                    <div>
                        <strong style="font-size:1.05rem;">${b.brandName}</strong><br>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${b.type === 'app' ? 'Aplikasi Premium' : 'Top Up Game'} &bull; ${itemsCount} Varian</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    ${statusBadgeHtml}
                    <button aria-label="Edit Grup" class="btn btn-outline" style="padding:6px 12px; font-size:0.8rem;" onclick="window.openProductGroupModal('${b.brandName}')"><i class="fa-solid fa-pen"></i> Edit</button>
                    <button aria-label="Hapus Grup" class="btn btn-danger" style="padding:6px 12px; font-size:0.8rem;" onclick="window.deleteProductGroup('${b.brandName}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    });
    tbody.innerHTML = html;
};

window.toggleInputTypeBox = function() {
    const type = document.getElementById('manage-prod-type').value;
    const inputGroup = document.getElementById('group-tipe-input');
    inputGroup.style.display = type === 'game' ? 'block' : 'none';
};

window.selectInputType = function(val, el) {
    document.querySelectorAll('.type-card').forEach(c => {
        c.classList.remove('active');
        c.style.background = 'var(--surface)';
        c.style.borderColor = 'var(--border)';
        c.querySelector('i').style.color = 'var(--text-muted)';
    });
    el.classList.add('active');
    el.style.background = 'rgba(37,99,235,0.08)';
    el.style.borderColor = 'var(--primary-light)';
    el.querySelector('i').style.color = 'var(--primary-light)';
    el.querySelector('input').checked = true;
    
    const previewBox = document.getElementById('type-preview-box');
    if(val === 'id_only') previewBox.innerText = 'Contoh: 123456789 (9 digit Player ID)';
    else if(val === 'id_zone') previewBox.innerText = 'Player ID: 12345678 -> Zone ID: (1234)';
    else if(val === 'custom') previewBox.innerText = 'Contoh: Server Asia, Nama Karakter Viper';
};

window.openProductGroupModal = function(brandName = null) {
    currentGroupNominals = [];
    if(brandName) {
        const group = groupedBrands.find(b => b.brandName === brandName);
        if(group) {
            document.getElementById('modal-prod-title').innerHTML = '<i class="fa-solid fa-box-open"></i> Edit Grup Item';
            document.getElementById('manage-prod-old-brand').value = brandName;
            document.getElementById('manage-prod-type').value = group.type;
            document.getElementById('manage-prod-brand').value = group.brandName;
            document.getElementById('manage-prod-img-base64').value = group.imgUrlBase64 || '';
            document.getElementById('manage-prod-desc').value = group.desc || '';
            document.getElementById('manage-prod-file-name').innerText = group.imgUrlBase64 ? 'Gambar tersimpan' : 'Belum ada gambar';
            
            const gangguanEl = document.getElementById('manage-prod-gangguan');
            if(gangguanEl) gangguanEl.checked = group.isGangguan || false;
            
            currentGroupNominals = group.items.map(i => ({ dbId: i.dbId, name: i.name, priceNum: i.priceNum, processType: i.processType || 'auto', soldOut: i.soldOut || false }));
            
            const allSoldOut = currentGroupNominals.length > 0 && currentGroupNominals.every(n => n.soldOut);
            document.getElementById('manage-prod-soldout').checked = allSoldOut;
            let inpType = group.items[0]?.inputType || 'id_zone';
            const targetEl = document.querySelector(`.type-card input[value="${inpType}"]`);
            if(targetEl) window.selectInputType(inpType, targetEl.parentElement);
        }
    } else {
        document.getElementById('modal-prod-title').innerHTML = '<i class="fa-solid fa-box-open"></i> Tambah Item Baru';
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
    document.getElementById('btn-add-item').innerHTML = '<i class="fa-solid fa-plus"></i> Tambah ke Daftar';
    document.getElementById('btn-cancel-edit-item').style.display = 'none';
};

window.editTempNominal = function(idx) {
    const item = currentGroupNominals[idx];
    if(!item) return;
    document.getElementById('temp-nom-name').value = item.name;
    document.getElementById('temp-nom-price').value = item.priceNum;
    document.getElementById('temp-nom-status').value = item.processType;
    document.getElementById('temp-nom-index').value = idx;
    document.getElementById('btn-add-item').innerHTML = '<i class="fa-solid fa-check"></i> Update Item';
    document.getElementById('btn-cancel-edit-item').style.display = 'block';
};

window.addOrUpdateTempNominal = function() {
    const idx = parseInt(document.getElementById('temp-nom-index').value);
    const name = document.getElementById('temp-nom-name').value.trim();
    const priceNum = parseInt(document.getElementById('temp-nom-price').value) || 0;
    const processType = document.getElementById('temp-nom-status').value || 'auto';
    if(!name || priceNum <= 0) { window.customAlert('Error', 'Nama Item dan Harga Jual wajib diisi dan valid.', 'error'); return; }
    
    if (idx >= 0) {
        currentGroupNominals[idx].name = name; currentGroupNominals[idx].priceNum = priceNum; currentGroupNominals[idx].processType = processType;
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
        container.innerHTML = `<div style="text-align:center; color:#64748b; font-size:0.8rem; padding: 10px;">Belum ada nominal ditambahkan.</div>`;
        return;
    }
    
    const groupImg = document.getElementById('manage-prod-img-base64').value;
    const fallbackImg = `<div style="width:30px; height:30px; background:var(--primary); color:white; display:flex; justify-content:center; align-items:center; border-radius:6px; font-weight:bold; font-size:14px;">V</div>`;
    const finalImg = groupImg ? `<img src="${groupImg}" style="width:30px; height:30px; border-radius:6px; object-fit:cover;" alt="Icon">` : fallbackImg;
    let html = '';
    
    currentGroupNominals.forEach((nom, index) => {
        const isSold = nom.soldOut ? 'checked' : '';
        const badgeType = nom.processType === 'manual' ? `<span style="font-size:0.65rem; color:var(--warning); border:1px solid var(--warning); padding:1px 4px; border-radius:4px;">Manual</span>` : `<span style="font-size:0.65rem; color:var(--success); border:1px solid var(--success); padding:1px 4px; border-radius:4px;">Auto</span>`;
        html += `
        <div style="display: flex; justify-content: space-between; align-items: center; background: transparent; padding: 10px 0; border-bottom: 1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:10px;">
                ${finalImg}
                <div>
                    <div style="font-size: 0.85rem; font-weight: bold; color: var(--text);">${nom.name} ${badgeType}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Rp${nom.priceNum.toLocaleString('id-ID')}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" style="width:18px; height:18px; cursor:pointer; accent-color: var(--danger);" title="Tandai Habis Individual" onchange="window.toggleIndividualSoldOut(${index}, this.checked)" ${isSold}>
                <button aria-label="Edit Item" class="btn btn-outline" style="border: none; color: var(--primary-light); padding: 5px; font-size:1rem;" onclick="window.editTempNominal(${index})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button aria-label="Hapus Item" class="btn btn-outline" style="border: none; color: #ef4444; padding: 5px; font-size:1rem;" onclick="window.removeTempNominal(${index})" title="Hapus"><i class="fa-solid fa-trash"></i></button>
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
    
    if(!brand) { window.customAlert('Error', 'Nama Brand wajib diisi.', 'error'); return; }
    if(currentGroupNominals.length === 0) { window.customAlert('Error', 'Tambahkan minimal 1 nominal ke dalam grup ini.', 'error'); return; }
    
    const btn = document.getElementById('btn-save-group');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
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
        window.customAlert('Sukses', `Seluruh item grup ${brand} tersimpan.`, 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan grup.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteProductGroup = function(brandName) {
    window.openConfirm("Hapus Grup", `Menghapus seluruh item ${brandName}?`, async (confirmed) => {
        if(confirmed) {
            const group = groupedBrands.find(b => b.brandName === brandName);
            if(group) {
                for(const item of group.items) { await deleteDoc(doc(db, pathProducts, item.dbId)); }
                window.customAlert('Sukses', `Semua Item ${brandName} telah dihapus.`, 'info');
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
            }, 800, 800);
        }
    });
}

// ==========================================
// PROMO MANAGEMENT
// ==========================================
window.renderAdminPromos = function() {
    const tbody = document.getElementById('admin-promo-list');
    if(!tbody) return;
    
    if(promos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Belum ada kode promo</td></tr>';
        return;
    }
    let html = '';
    promos.forEach(p => {
        const typeStr = p.type === 'percent' ? `${p.amount}%` : `Rp${p.amount.toLocaleString('id-ID')}`;
        const targetStr = p.targetBrand === 'all' ? 'Semua Produk' : (p.targetBrand || 'Semua');
        let userTgt = 'Semua';
        if(p.targetUser === 'reseller') userTgt = 'Member+ VIP';
        if(p.targetUser === 'new') userTgt = 'User Baru';
        
        html += `<tr>
            <td><strong>${p.code}</strong></td>
            <td><span class="status-badge status-success">${typeStr}</span></td>
            <td>${targetStr}</td>
            <td><span style="color:var(--warning); font-size:0.8rem;">${userTgt}</span></td>
            <td>${p.usedCount || 0} / ${p.maxUses}</td>
            <td>${p.active ? '<span class="status-badge status-success">Aktif</span>' : '<span class="status-badge status-failed">Mati</span>'}</td>
            <td style="white-space:nowrap;">
                <button aria-label="Edit Promo" class="btn btn-outline" style="padding:0.4rem; font-size:0.75rem; margin-right:4px;" onclick="window.openPromoModal('${p.dbId}')"><i class="fa-solid fa-pen"></i></button>
                <button aria-label="Hapus Promo" class="btn btn-danger" style="padding:0.4rem; font-size:0.75rem;" onclick="window.deletePromo('${p.dbId}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
};

window.openPromoModal = function(dbId = null) {
    const targetSelect = document.getElementById('manage-promo-target');
    if (targetSelect) {
        let selHtml = '<option value="all">Semua Produk (Bebas)</option>';
        groupedBrands.forEach(b => { selHtml += `<option value="${b.brandName}">Khusus: ${b.brandName}</option>`; });
        targetSelect.innerHTML = selHtml;
    }
    if(dbId) {
        const p = promos.find(x => x.dbId === dbId);
        document.getElementById('modal-promo-title').innerText = 'Edit Promo';
        document.getElementById('manage-promo-id').value = p.dbId;
        document.getElementById('manage-promo-code').value = p.code;
        document.getElementById('manage-promo-type').value = p.type || 'nominal';
        document.getElementById('manage-promo-amount').value = p.amount;
        document.getElementById('manage-promo-max').value = p.maxUses;
        if(targetSelect) document.getElementById('manage-promo-target').value = p.targetBrand || 'all';
        if(document.getElementById('manage-promo-user')) document.getElementById('manage-promo-user').value = p.targetUser || 'all';
        document.getElementById('manage-promo-active').checked = p.active;
    } else {
        document.getElementById('modal-promo-title').innerText = 'Buat Promo Baru';
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
        code: document.getElementById('manage-promo-code').value.trim().toUpperCase(),
        type: document.getElementById('manage-promo-type').value,
        amount: parseInt(document.getElementById('manage-promo-amount').value) || 0,
        targetBrand: document.getElementById('manage-promo-target') ? document.getElementById('manage-promo-target').value : 'all',
        targetUser: document.getElementById('manage-promo-user') ? document.getElementById('manage-promo-user').value : 'all',
        maxUses: parseInt(document.getElementById('manage-promo-max').value) || 0,
        active: document.getElementById('manage-promo-active').checked,
        usedCount: 0 
    };
    if(!data.code || data.amount <= 0 || data.maxUses <= 0) { window.customAlert('Error', 'Data promo tidak valid.', 'error'); return; }
    
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
        window.customAlert('Sukses', 'Promo disimpan.', 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan promo.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deletePromo = function(dbId) {
    window.openConfirm("Hapus", "Hapus Promo ini?", async (confirmed) => {
        if(confirmed) {
            await deleteDoc(doc(db, pathPromos, dbId));
            window.customAlert('Sukses', 'Promo Dihapus.', 'success');
        }
    }, 'delete');
};

// ==========================================
// MEMBER VIP MANAGEMENT (OPTIMIZED)
// ==========================================
window.renderAdminMembers = function() {
    const tbody = document.getElementById('admin-member-list');
    if(!tbody) return;
    if(vipUsers.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Belum ada member VIP aktif.</td></tr>'; return; }
    
    let html = '';
    vipUsers.forEach(u => {
        const exp = u.tierExp || 0;
        const isExpired = Date.now() > exp;
        const color = isExpired ? '#94a3b8' : '#f59e0b';
        const badge = `<span style="background:rgba(0,0,0,0.2); border:1px solid ${color}; color:${color}; padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: bold; text-transform:uppercase;">${isExpired ? 'EXPIRED' : 'VIP ACTIVE'}</span>`;
        
        let expStr = isExpired ? '<span style="color:var(--danger)">Berakhir</span>' : new Date(exp).toLocaleDateString('id-ID');
        let trxCount = orders.filter(o => o.userEmail === u.email && o.status === 'SUCCESS').length;
        
        const actBtn = `<button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; border-color:var(--danger); color:var(--danger);" onclick="window.adminRemoveUserTier('${u.uid}')"><i class="fa-solid fa-user-minus"></i> Cabut VIP</button>`;
        
        html += `
        <tr>
            <td><strong>${u.name || 'User'}</strong><br><small style="color:var(--text-muted)">${u.email}</small></td>
            <td>${badge}</td>
            <td><small>${expStr}</small></td>
            <td>${trxCount}</td>
            <td style="white-space:nowrap;">${actBtn}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
};

window.adminRemoveUserTier = function(uid) {
    window.openConfirm('Cabut Status', 'Anda yakin ingin mereset pengguna ini kembali ke BASIC (Bronze)?', async (res) => {
        if(res) {
            await updateDoc(doc(db, pathUsers, uid), { tier: 'bronze', tierExp: 0 });
            window.customAlert('Sukses', 'Status pengguna telah dikembalikan ke Bronze.', 'success');
        }
    }, 'delete');
};

window.saveMemberSettings = async function() {
    const btn = document.getElementById('btn-save-member');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;
    try {
        const memSettings = {
            price: parseInt(document.getElementById('set-member-price').value) || 50000,
            disc: parseFloat(document.getElementById('set-member-disc').value) || 5
        };
        await updateDoc(doc(db, pathSettings, 'mainConfig'), { membership: memSettings });
        window.customAlert('Sukses', 'Pengaturan harga & diskon Member+ VIP berhasil disimpan.', 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

// FITUR BARU: TAMBAH VIP MANUAL MELALUI ADMIN
window.openAddVipModal = function() {
    document.getElementById('add-vip-email').value = '';
    document.getElementById('add-vip-duration').value = '1';
    window.openModal('modal-add-vip');
};

window.addVipManual = async function() {
    const email = document.getElementById('add-vip-email').value.trim();
    const months = parseInt(document.getElementById('add-vip-duration').value) || 1;
    
    if(!email) { window.customAlert('Peringatan', 'Email pengguna wajib diisi.', 'warning'); return; }
    
    const btn = document.getElementById('btn-save-vip');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Memproses...</span>';
    btn.disabled = true;
    
    try {
        // Melakukan kueri untuk mencari user ID berdasarkan email
        const q = query(collection(db, pathUsers), where("email", "==", email));
        const snap = await getDocs(q);
        
        if(snap.empty) {
            window.customAlert('Tidak Ditemukan', 'Pengguna dengan email tersebut belum mendaftar di sistem.', 'warning');
        } else {
            const uDoc = snap.docs[0];
            const curData = uDoc.data();
            let newExp = curData.tierExp || Date.now();
            if(newExp < Date.now()) newExp = Date.now();
            newExp += (months * 30 * 24 * 60 * 60 * 1000);
            
            await updateDoc(doc(db, pathUsers, uDoc.id), { tier: 'vip', tierExp: newExp });
            window.closeModal('modal-add-vip');
            window.customAlert('Sukses', `Akses VIP selama ${months} bulan berhasil diberikan ke ${email}.`, 'success');
        }
    } catch (e) {
        window.customAlert('Error', 'Gagal memberikan akses VIP.', 'error');
    } finally {
        btn.innerHTML = ogHtml;
        btn.disabled = false;
    }
};

// ==========================================
// NEWS / BERITA
// ==========================================
window.renderAdminNews = function() {
    const list = document.getElementById('admin-news-list');
    if(!list) return;
    const newsData = siteSettings.newsList || [];
    if(newsData.length === 0) { list.innerHTML = '<p style="color:var(--text-muted)">Belum ada info komunitas.</p>'; return; }
    
    let html = '';
    newsData.forEach((t, i) => {
        html += `<div style="background:var(--surface); border:1px solid var(--border); padding:1rem; border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div><strong>${t.title}</strong><br><small style="color:var(--text-muted)">Info/Promo</small></div>
            <div>
                <button aria-label="Edit Info" class="btn btn-outline" style="margin-right:4px;" onclick="window.openNewsModal(${i})"><i class="fa-solid fa-pen"></i></button>
                <button aria-label="Hapus Info" class="btn btn-danger" onclick="window.deleteNews(${i})"><i class="fa-solid fa-trash"></i></button>
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
        document.getElementById('modal-news-title').innerText = "Edit Berita / Info";
    } else {
        document.getElementById('manage-news-title').value = '';
        document.getElementById('manage-news-image').value = '';
        document.getElementById('manage-news-desc').value = '';
        document.getElementById('modal-news-title').innerText = "Tambah Berita / Info";
    }
    window.openModal('modal-manage-news');
};

window.handleNewsUpload = function(event) {
    const file = event.target.files[0];
    if(!file) return;
    window.resizeImageBase64(file, (b64) => {
        document.getElementById('manage-news-image').value = b64;
        window.customAlert('Berhasil', 'Gambar berhasil dimuat dari perangkat HP Anda.', 'success');
    }, 800, 600);
};

window.saveNews = async function() {
    const idx = parseInt(document.getElementById('manage-news-index').value);
    const title = document.getElementById('manage-news-title').value.trim();
    const imageUrl = document.getElementById('manage-news-image').value.trim();
    const desc = document.getElementById('manage-news-desc').value.trim();
    if(!title || !desc) { window.customAlert('Error', 'Judul dan Konten wajib diisi.', 'error'); return; }
    
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
        window.customAlert('Sukses', 'Berita berhasil disimpan.', 'success');
    } catch(e) {
        window.customAlert('Error', 'Gagal menyimpan.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

window.deleteNews = async function(index) {
    window.openConfirm('Hapus Info', 'Hapus berita/informasi ini secara permanen?', async (confirmed) => {
        if(confirmed) {
            const newsList = [...siteSettings.newsList];
            newsList.splice(index, 1);
            await updateDoc(doc(db, pathSettings, 'mainConfig'), { newsList: newsList });
            window.customAlert('Dihapus', 'Berita berhasil dihapus.', 'info');
        }
    }, 'delete');
};

// ==========================================
// PENGATURAN WEB (SETTINGS)
// ==========================================
window.saveSettingsManual = async function() {
    if(!isSettingsLoaded) return;
    const botQrisEl = document.getElementById('set-bot-qris');
    const newSettings = {
        ...siteSettings,
        logoText: document.getElementById('set-logo-text').value.trim(),
        logoAccent: document.getElementById('set-logo-accent').value.trim(),
        logoImgBase64: document.getElementById('set-logo-base64').value, 
        marquee: document.getElementById('set-marquee').value.trim(),
        adminWa: document.getElementById('set-wa').value.trim(),
        igLink: document.getElementById('set-ig').value.trim(),
        ttLink: document.getElementById('set-tt').value.trim(),
        qrisImageBase64: document.getElementById('set-qris-base64').value,
        waChannelLink: document.getElementById('set-wa-channel') ? document.getElementById('set-wa-channel').value.trim() : '',
        isStoreOpen: document.getElementById('set-store-status') ? document.getElementById('set-store-status').checked : true,
        botQrisActive: botQrisEl ? botQrisEl.checked : siteSettings.botQrisActive
    };
    await updateDoc(doc(db, pathSettings, 'mainConfig'), newSettings);
};

window.populateAdminSettings = function() {
    document.getElementById('set-logo-text').value = siteSettings.logoText || '';
    document.getElementById('set-logo-accent').value = siteSettings.logoAccent || '';
    document.getElementById('set-logo-base64').value = siteSettings.logoImgBase64 || '';
    
    document.getElementById('set-marquee').value = siteSettings.marquee || '';
    document.getElementById('set-wa').value = siteSettings.adminWa || '';
    document.getElementById('set-ig').value = siteSettings.igLink || '';
    document.getElementById('set-tt').value = siteSettings.ttLink || '';
    document.getElementById('set-qris-base64').value = siteSettings.qrisImageBase64 || '';
    
    if(document.getElementById('set-wa-channel')) document.getElementById('set-wa-channel').value = siteSettings.waChannelLink || '';
    const storeStatusEl = document.getElementById('set-store-status');
    if(storeStatusEl) storeStatusEl.checked = siteSettings.isStoreOpen !== false;
    const botQrisEl = document.getElementById('set-bot-qris');
    if(botQrisEl) botQrisEl.checked = siteSettings.botQrisActive || false;
    
    const memSettings = siteSettings.membership || { price: 50000, disc: 5 };
    const pEl = document.getElementById('set-member-price'); if(pEl) pEl.value = memSettings.price;
    const dEl = document.getElementById('set-member-disc'); if(dEl) dEl.value = memSettings.disc;
    
    if(siteSettings.logoImgBase64) {
        const p = document.getElementById('set-logo-preview');
        p.src = siteSettings.logoImgBase64; p.style.display = 'block';
        document.getElementById('set-logo-file-name').innerText = "Gambar Dimuat";
    }
    if(siteSettings.qrisImageBase64) {
        const p = document.getElementById('set-qris-preview');
        p.src = siteSettings.qrisImageBase64; p.style.display = 'block';
        document.getElementById('set-qris-file-name').innerText = "QRIS Dimuat";
    }
    
    const adminLogoEl = document.getElementById('admin-header-logo-img');
    const defAdminIco = document.getElementById('admin-header-default-icon');
    if(siteSettings.logoImgBase64) {
        if(adminLogoEl){ adminLogoEl.src = siteSettings.logoImgBase64; adminLogoEl.style.display = 'inline-block'; }
        if(defAdminIco) defAdminIco.style.display = 'none';
    } else {
        if(adminLogoEl) adminLogoEl.style.display = 'none';
        if(defAdminIco) defAdminIco.style.display = 'inline-block';
    }
};

const qrisUploadEl = document.getElementById('set-qris-upload');
if(qrisUploadEl) {
    qrisUploadEl.addEventListener('change', function(e) {
        if (e.target.files[0]) {
            document.getElementById('set-qris-file-name').innerText = e.target.files[0].name;
            window.resizeImageBase64(e.target.files[0], (b64) => {
                document.getElementById('set-qris-base64').value = b64;
                const p = document.getElementById('set-qris-preview');
                p.src = b64; p.style.display = 'block';
                window.saveSettingsManual();
            }, 800, 800);
        }
    });
}

const logoUploadEl = document.getElementById('logo-upload');
if(logoUploadEl) {
    logoUploadEl.addEventListener('change', function(e) {
        if (e.target.files[0]) {
            document.getElementById('set-logo-file-name').innerText = e.target.files[0].name;
            window.resizeImageBase64(e.target.files[0], (b64) => {
                document.getElementById('set-logo-base64').value = b64; 
                const p = document.getElementById('set-logo-preview');
                p.src = b64; p.style.display = 'block';
                window.saveSettingsManual(); 
            }, 800, 800);
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
                await updateDoc(doc(db, pathSettings, 'mainConfig'), { banners: banners });
                siteSettings.banners = banners;
                window.renderAdminBanners();
                window.customAlert('Sukses', 'Banner berhasil ditambahkan.', 'success');
                e.target.value = ''; 
            }, 1200, 600); 
        }
    });
}

window.renderAdminBanners = function() {
    const list = document.getElementById('admin-banner-list');
    if(!list) return;
    const banners = siteSettings.banners || [];
    if(banners.length === 0){ list.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Belum ada banner.</span>'; return; }
    
    let html = '';
    banners.forEach((b64, idx) => {
        html += `
        <div style="position:relative; border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-bottom: 10px;">
            <img src="${b64}" style="width:100%; height:100px; object-fit:cover;" loading="lazy" alt="Banner">
            <button aria-label="Hapus Banner" class="btn btn-danger" style="position:absolute; top:5px; right:5px; padding:5px 8px;" onclick="window.deleteBanner(${idx})"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });
    list.innerHTML = html;
};

window.deleteBanner = async function(idx) {
    window.openConfirm('Hapus', 'Hapus banner ini?', async (confirmed) => {
        if(confirmed) {
            const banners = siteSettings.banners || [];
            banners.splice(idx, 1);
            await updateDoc(doc(db, pathSettings, 'mainConfig'), { banners: banners });
            siteSettings.banners = banners;
            window.renderAdminBanners();
            window.customAlert('Dihapus', 'Banner telah dihapus', 'info');
        }
    }, 'delete');
};

// ==========================================
// LIVE CHAT (ADMIN - MOBILE OPTIMIZED)
// ==========================================
function listenAdminLiveChat() {
    if(adminChatUnsubscribe) adminChatUnsubscribe();
    adminChatUnsubscribe = onSnapshot(collection(db, pathChats), (snapshot) => {
        allLiveChats = [];
        snapshot.forEach(docSnap => { allLiveChats.push({ id: docSnap.id, ...docSnap.data() }); });
        allLiveChats.sort((a,b) => b.updatedAt - a.updatedAt);
        window.renderAdminChatList();
        
        if (allLiveChats.length > 0 && allLiveChats[0].messages.length > 0) {
            const latestMsg = allLiveChats[0].messages[allLiveChats[0].messages.length-1];
            if (latestMsg.sender === 'user' && previousChatCount !== 0 && allLiveChats.length >= previousChatCount) {
                window.fireNativeNotificationAdmin('Pesan Masuk', `Pesan baru dari ${allLiveChats[0].userInfo}`, 'info');
            }
        }
        previousChatCount = allLiveChats.length;
        const badge = document.getElementById('admin-chat-tab-badge');
        if(badge) badge.style.display = allLiveChats.length > 0 ? 'inline-block' : 'none';
        
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
        list.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 2rem;">Tidak ada pesan aktif.</p>';
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
            <div id="chat-card-${chat.id}" class="admin-chat-card ${isActive}" onclick="window.openAdminChatDetailDesk('${chat.id}')">
                <div style="flex:1; overflow:hidden;">
                    <strong style="color:var(--text); font-size:0.9rem; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${chat.userInfo || 'User'}</strong>
                    <small style="color:var(--text-muted); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${lastMsg ? lastMsg.text : '...'}</small>
                </div>
                ${hasUnread ? '<span class="notif-dot" style="position:static; display:inline-block;"></span>' : ''}
            </div>
        `;
    });
    list.innerHTML = html;
};

window.backToChatListMobile = function() {
    document.getElementById('admin-chat-main-panel').style.display = 'none';
    document.getElementById('admin-chat-sidebar-panel').style.display = 'flex';
};

window.openAdminChatDetailDesk = function(chatId) {
    const chat = allLiveChats.find(c => c.id === chatId);
    if(!chat) return;
    
    document.getElementById('admin-chat-empty').style.display = 'none';
    document.getElementById('admin-chat-active').style.display = 'flex';
    document.getElementById('admin-active-chat-id-desk').value = chatId;
    document.getElementById('admin-chat-title-desk').innerText = chat.userInfo || 'User';
    
    if(window.innerWidth <= 768) {
        document.getElementById('admin-chat-sidebar-panel').style.display = 'none';
        document.getElementById('admin-chat-main-panel').style.display = 'flex';
        document.getElementById('btn-back-chat').style.display = 'inline-block';
    }
    
    const body = document.getElementById('admin-chat-body-desktop');
    let html = '';
    
    (chat.messages || []).forEach(msg => {
        const isAdmin = msg.sender === 'admin';
        html += `
            <div class="chat-msg ${isAdmin ? 'user' : 'admin'}" style="${isAdmin ? 'align-self:flex-end; background:var(--primary); color:white;' : 'align-self:flex-start; background:var(--surface-hover); color:var(--text); border:1px solid var(--border);'}">
                ${msg.text}
                <span class="chat-time" style="color:${isAdmin ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)'};">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
        `;
    });
    body.innerHTML = html;
    
    setTimeout(() => { body.scrollTop = body.scrollHeight; }, 50);
    document.querySelectorAll('.admin-chat-card').forEach(el => el.classList.remove('active'));
    const activeCard = document.getElementById(`chat-card-${chatId}`);
    if(activeCard) activeCard.classList.add('active');
};

window.insertQuickReplyDesk = function(text) {
    const input = document.getElementById('admin-chat-input-desk');
    if(input) { input.value = input.value + text + " "; input.focus(); }
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
    
    const btn = document.getElementById('btn-resolve-chat');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    try {
        await deleteDoc(doc(db, pathChats, chatId));
        document.getElementById('admin-active-chat-id-desk').value = '';
        document.getElementById('admin-chat-empty').style.display = 'flex';
        document.getElementById('admin-chat-active').style.display = 'none';
        
        if(window.innerWidth <= 768) window.backToChatListMobile();
        
        window.customAlert('Dihapus', 'Sesi Live Chat diselesaikan dan dihapus dari server.', 'success');
    } catch(e) {
        window.customAlert('Gagal', 'Tidak dapat menghapus sesi.', 'error');
    } finally {
        btn.innerHTML = ogHtml; btn.disabled = false;
    }
};

// Inisialisasi Aplikasi Admin
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
    initAdminApp();
}