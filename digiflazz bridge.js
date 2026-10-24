/**
 * VIPERCELL - DIGIFLAZZ VPS BRIDGE & WEBHOOK RECEIVER (v28.8)
 */

const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3100;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "vipercell-fc50e";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyBQGZjl7uj5CRiLWCvPQKjiK4HvIYnXSJg";
const CONFIG_CACHE_PATH = path.join(__dirname, "bridge-config.json");

let serverConfig = {
    username: process.env.DIGIFLAZZ_USERNAME || "",
    devApiKey: process.env.DIGIFLAZZ_DEV_API_KEY || "",
    prodApiKey: process.env.DIGIFLAZZ_PROD_API_KEY || "",
    envMode: process.env.DIGIFLAZZ_ENV_MODE || "development",
    webhookSecret: process.env.DIGIFLAZZ_WEBHOOK_SECRET || "VIPERCELL_DF_WEBHOOK_2026"
};

try {
    if (fs.existsSync(CONFIG_CACHE_PATH)) {
        const saved = JSON.parse(fs.readFileSync(CONFIG_CACHE_PATH, "utf8"));
        serverConfig = { ...serverConfig, ...saved };
    }
} catch (e) {}

function isPlaceholderValue(val) {
    const s = String(val || "").trim().toLowerCase();
    return !s || s === "username" || s === "dev-apikey" || s === "prod-apikey" || s === "your-username";
}

function saveServerConfig(newCfg) {
    if (!newCfg || typeof newCfg !== "object") return;
    const updated = { ...serverConfig };
    if (newCfg.username !== undefined && !isPlaceholderValue(newCfg.username)) {
        updated.username = String(newCfg.username).trim();
    }
    if (newCfg.devApiKey !== undefined && !isPlaceholderValue(newCfg.devApiKey)) {
        updated.devApiKey = String(newCfg.devApiKey).trim();
    }
    if (newCfg.prodApiKey !== undefined && !isPlaceholderValue(newCfg.prodApiKey)) {
        updated.prodApiKey = String(newCfg.prodApiKey).trim();
    }
    if (newCfg.envMode === "production" || newCfg.envMode === "development") {
        updated.envMode = newCfg.envMode;
    }
    if (newCfg.webhookSecret !== undefined && String(newCfg.webhookSecret).trim() !== "") {
        updated.webhookSecret = String(newCfg.webhookSecret).trim();
    }
    serverConfig = updated;
    try {
        fs.writeFileSync(CONFIG_CACHE_PATH, JSON.stringify(serverConfig, null, 2), "utf8");
    } catch (e) {}
}

function md5(str) {
    return crypto.createHash("md5").update(String(str || ""), "utf8").digest("hex");
}

function normalizeCustomerNo(rawTarget, zoneId = "") {
    let s = String(rawTarget || "").trim();
    const z = String(zoneId || "").trim();
    if (!s) return "";

    const idZonePipe = s.match(/ID\s*:\s*([^\s|]+)\s*\|\s*Zone\s*:\s*([^\s|(]+)/i);
    if (idZonePipe) {
        return `${idZonePipe[1].trim()}${idZonePipe[2].trim()}`;
    }

    const parenDigits = s.match(/^([0-9a-zA-Z_-]+)\s*\(\s*([0-9a-zA-Z_-]+)\s*\)$/);
    if (parenDigits) {
        return `${parenDigits[1].trim()}${parenDigits[2].trim()}`;
    }

    s = s.replace(/^(Tujuan|ID\s*Player|ID\s*PLN|ID|Target|No\.?\s*Pelanggan|No\.?\s*Meter|No\.?\s*HP|No\.?\s*Tujuan|No\.?\s*[A-Za-z0-9_-]+)\s*:\s*/i, "").trim();
    if (s.includes(" (")) {
        s = s.split(" (")[0].trim();
    }
    let cleanS = s.replace(/[\s\-]+/g, "");
    if (/^(\+628|628)[0-9]{6,13}$/.test(cleanS)) {
        cleanS = "08" + cleanS.replace(/^(\+628|628)/, "");
    }
    const cleanZ = z.replace(/[\s()]+/g, "");
    if (cleanZ && !cleanS.endsWith(cleanZ)) {
        return `${cleanS}${cleanZ}`;
    }
    return cleanS;
}

const keepAliveHttpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 32
});

// Antrian Eksekusi Transaksi Otomatis (Mencegah Overload Backend saat Trafik Tinggi)
const txExecutionQueue = [];
let activeTxWorkers = 0;
const MAX_CONCURRENT_TX_WORKERS = 3;
const TX_STAGGER_DELAY_MS = 150;
let totalQueuedProcessedCount = 0;

function enqueueDigiflazzTransaction(taskFn) {
    return new Promise((resolve, reject) => {
        txExecutionQueue.push({ taskFn, resolve, reject });
        processNextTxQueueItem();
    });
}

function processNextTxQueueItem() {
    if (activeTxWorkers >= MAX_CONCURRENT_TX_WORKERS || txExecutionQueue.length === 0) {
        return;
    }
    const item = txExecutionQueue.shift();
    if (!item) return;
    activeTxWorkers++;
    Promise.resolve()
        .then(() => item.taskFn())
        .then((res) => {
            totalQueuedProcessedCount++;
            item.resolve(res);
        })
        .catch((err) => {
            item.reject(err);
        })
        .finally(() => {
            setTimeout(() => {
                activeTxWorkers = Math.max(0, activeTxWorkers - 1);
                processNextTxQueueItem();
            }, TX_STAGGER_DELAY_MS);
        });
}

function httpsJsonRequest(urlStr, method, headers, bodyObj) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlStr);
        const bodyStr = bodyObj ? JSON.stringify(bodyObj) : "";
        const req = https.request({
            hostname: u.hostname,
            port: u.port || 443,
            path: u.pathname + u.search,
            method: method || "POST",
            agent: keepAliveHttpsAgent,
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Connection": "keep-alive",
                "Content-Length": Buffer.byteLength(bodyStr),
                ...headers
            },
            timeout: 20000
        }, (res) => {
            let raw = "";
            res.on("data", chunk => { raw += chunk; });
            res.on("end", () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(raw) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: { raw } });
                }
            });
        });
        req.on("error", reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

let lastFirestoreHydrateMs = 0;
async function hydrateConfigFromFirestoreIfNeeded(forceRefresh = false) {
    const hasKeys = Boolean(!isPlaceholderValue(serverConfig.username) && (!isPlaceholderValue(serverConfig.devApiKey) || !isPlaceholderValue(serverConfig.prodApiKey)));
    if (hasKeys && !forceRefresh && (Date.now() - lastFirestoreHydrateMs < 30000)) {
        return;
    }
    lastFirestoreHydrateMs = Date.now();
    try {
        let f = null;
        for (const pid of [FIREBASE_PROJECT_ID, "vipercell-fc50e", "vipercell23"]) {
            const docUrl = `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents/settings/mainConfig?key=${FIREBASE_API_KEY}`;
            const res = await httpsJsonRequest(docUrl, "GET", {}, null).catch(() => null);
            if (res && res.data && res.data.fields && (res.data.fields.digiflazzUsername || res.data.fields.digiflazzBridgeSyncToken)) {
                f = res.data.fields;
                break;
            }
        }
        if (!f) return;
        const readStr = (key) => (f[key] && f[key].stringValue ? String(f[key].stringValue).trim() : "");

        let syncObj = {};
        const syncToken = readStr("digiflazzBridgeSyncToken");
        if (syncToken) {
            try {
                const decoded = Buffer.from(syncToken, "base64").toString("utf8");
                syncObj = JSON.parse(decoded) || {};
            } catch (err) {}
        }

        const u = syncObj.u || readStr("digiflazzUsername");
        const dKey = syncObj.d || readStr("digiflazzDevApiKey");
        const pKey = syncObj.p || readStr("digiflazzProdApiKey");
        const lKey = readStr("digiflazzApiKey");
        const mode = syncObj.m || readStr("digiflazzEnvMode");
        const sec = syncObj.s || readStr("digiflazzWebhookSecret");

        saveServerConfig({
            username: !isPlaceholderValue(u) ? u : serverConfig.username,
            devApiKey: !isPlaceholderValue(dKey) ? dKey : (!isPlaceholderValue(lKey) ? lKey : serverConfig.devApiKey),
            prodApiKey: !isPlaceholderValue(pKey) ? pKey : serverConfig.prodApiKey,
            envMode: (mode === "production" || mode === "development") ? mode : serverConfig.envMode,
            webhookSecret: sec || serverConfig.webhookSecret
        });
    } catch (e) {}
}

function extractRealDigiflazzUsername(d) {
    if (!d || typeof d !== "object") return "";
    if (d.name && String(d.name).trim()) return String(d.name).trim();
    if (d.customer_name && String(d.customer_name).trim()) return String(d.customer_name).trim();
    if (d.username && String(d.username).trim() && d.username !== serverConfig.username) return String(d.username).trim();

    const rawSn = String(d.sn || "").trim();
    if (rawSn) {
        if (rawSn.includes("/")) {
            const parts = rawSn.split("/").map(s => s.trim()).filter(Boolean);
            for (const p of parts) {
                const m = p.match(/^(?:nama|username|nick|nickname|an|a\.n)\s*[:=]\s*(.+)$/i);
                if (m && m[1]) return m[1].trim();
            }
            if (parts.length >= 2 && !/^\d+$/.test(parts[0])) {
                return parts[0];
            } else if (parts.length >= 2) {
                return parts[1];
            }
        }
        const kvMatch = rawSn.match(/(?:nama|username|nick|nickname|pemilik|account)\s*[:=-]\s*([^,|/]+)/i);
        if (kvMatch && kvMatch[1]) {
            return kvMatch[1].trim();
        }
        return rawSn;
    }
    return "";
}

function isSignatureErrorResponse(dfData) {
    const d = dfData && dfData.data ? dfData.data : dfData;
    if (!d) return false;
    const msg = String(d.message || "").toLowerCase();
    const rc = String(d.rc || "");
    return msg.includes("signature") || msg.includes("sign") || rc === "41";
}

function formatSnReceiptText(refId, customerNo, snStr, rcStr, itemName) {
    const cleanSn = String(snStr || "").trim();
    if (cleanSn.includes("/") && /\d{4}[-\s]?\d{4}[-\s]?\d{4}/.test(cleanSn)) {
        const parts = cleanSn.split("/").map(s => s.trim()).filter(Boolean);
        const tokenCode = parts[0] || cleanSn;
        const custName = parts[1] || "-";
        const tarifDaya = [parts[2], parts[3]].filter(Boolean).join(" / ") || "-";
        const kwhVal = parts[4] || "-";
        return `[TOKEN LISTRIK PLN]\nTOKEN      : ${tokenCode}\nID Pel     : ${customerNo}\nNama       : ${custName}\nTarif/Daya : ${tarifDaya}\nJumlah kWh : ${kwhVal}\nRef ID     : ${refId}`;
    }
    return `[TRANSAKSI BERHASIL]\nProduk   : ${itemName || "Layanan Digital"}\nTujuan   : ${customerNo || "-"}\nSN/Ref   : ${cleanSn || "Sukses Diproses"}\nStatus   : Sukses (RC ${rcStr || "00"})`;
}

async function syncLastBalanceToFirestore(newBalance) {
    if (newBalance === undefined || newBalance === null || isNaN(Number(newBalance))) return;
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/mainConfig?key=${FIREBASE_API_KEY}&updateMask.fieldPaths=digiflazzLastBalance&updateMask.fieldPaths=digiflazzBalanceUpdatedAt`;
    await httpsJsonRequest(patchUrl, "PATCH", {}, {
        fields: {
            digiflazzLastBalance: { integerValue: String(Math.round(Number(newBalance))) },
            digiflazzBalanceUpdatedAt: { integerValue: String(Date.now()) }
        }
    }).catch(() => {});
}

async function refundFailedOrderBalanceOnFirestore(orderDoc, reasonStr) {
    if (!orderDoc || !orderDoc.name || !orderDoc.fields) return false;
    const f = orderDoc.fields;
    const readStr = (k) => (f[k] && f[k].stringValue ? String(f[k].stringValue) : "");
    const readBool = (k) => Boolean(f[k] && f[k].booleanValue === true);
    const readInt = (k) => Number((f[k] && (f[k].integerValue || f[k].doubleValue)) || 0);

    const payMethod = readStr("paymentMethod").toLowerCase();
    const userId = readStr("userId");
    const alreadyRefunded = readBool("balanceRefunded") || readBool("refundedToBalance");
    const refundAmt = Math.round(readInt("finalTotal") || readInt("baseTotal"));

    if ((payMethod !== "balance" && payMethod !== "saldo") || !userId || alreadyRefunded || refundAmt <= 0) {
        return false;
    }

    try {
        const userUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(userId)}?key=${FIREBASE_API_KEY}`;
        const uRes = await httpsJsonRequest(userUrl, "GET", {}, null);
        if (!uRes || !uRes.data || !uRes.data.fields) return false;

        const uf = uRes.data.fields;
        const curBal = Math.round(Number((uf.balance && (uf.balance.integerValue || uf.balance.doubleValue)) || 0));
        const nextBal = curBal + refundAmt;
        const nowMs = Date.now();

        const userPatchUrl = `${userUrl}&updateMask.fieldPaths=balance&updateMask.fieldPaths=balanceUpdatedAt`;
        await httpsJsonRequest(userPatchUrl, "PATCH", {}, {
            fields: {
                balance: { integerValue: String(nextBal) },
                balanceUpdatedAt: { integerValue: String(nowMs) }
            }
        });

        const refundReply = `[PENGEMBALIAN SALDO OTOMATIS]\nAlasan       : ${reasonStr}\nDana Kembali : Rp${refundAmt.toLocaleString("id-ID")}\nSaldo Akhir  : Rp${nextBal.toLocaleString("id-ID")}`;
        const ordPatchUrl = `https://firestore.googleapis.com/v1/${orderDoc.name}?key=${FIREBASE_API_KEY}&updateMask.fieldPaths=balanceRefunded&updateMask.fieldPaths=balanceRefundedAt&updateMask.fieldPaths=adminReply`;
        await httpsJsonRequest(ordPatchUrl, "PATCH", {}, {
            fields: {
                balanceRefunded: { booleanValue: true },
                balanceRefundedAt: { integerValue: String(nowMs) },
                adminReply: { stringValue: refundReply }
            }
        });

        // Catat otomatis ke koleksi balance_logs agar tampil di Tab Pantau Saldo Admin & Riwayat User
        const orderIdStr = readStr("id") || readStr("orderId") || "-";
        const userEmailStr = readStr("userEmail") || readStr("buyerEmail") || "";
        const logUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/balance_logs?key=${FIREBASE_API_KEY}`;
        await httpsJsonRequest(logUrl, "POST", {}, {
            fields: {
                uid: { stringValue: userId },
                userEmail: { stringValue: userEmailStr },
                type: { stringValue: "REFUND" },
                amount: { integerValue: String(refundAmt) },
                orderId: { stringValue: orderIdStr },
                note: { stringValue: `Auto-Refund Webhook Digiflazz #${orderIdStr} (${reasonStr})` },
                createdAt: { integerValue: String(nowMs) }
            }
        }).catch(() => {});
        return true;
    } catch (e) {
        return false;
    }
}

async function updateOrderFromDigiflazzWebhook(payloadData) {
    const d = payloadData && payloadData.data ? payloadData.data : null;
    if (!d || !d.ref_id) return false;

    const refId = String(d.ref_id).trim();
    const statusStr = String(d.status || "Pending");
    const rcStr = String(d.rc || "");
    const snStr = String(d.sn || "");
    const msgStr = String(d.message || "");

    if (d.buyer_last_saldo !== undefined) {
        await syncLastBalanceToFirestore(d.buyer_last_saldo);
    }

    const queryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const queryBody = {
        structuredQuery: {
            from: [{ collectionId: "orders" }],
            where: {
                fieldFilter: {
                    field: { fieldPath: "id" },
                    op: "EQUAL",
                    value: { stringValue: refId }
                }
            },
            limit: 1
        }
    };

    const qRes = await httpsJsonRequest(queryUrl, "POST", {}, queryBody);
    const firstMatch = Array.isArray(qRes.data) ? qRes.data.find(row => row.document) : null;
    if (!firstMatch || !firstMatch.document || !firstMatch.document.name) return false;

    const docFullName = firstMatch.document.name;
    const isSuccess = (statusStr === "Sukses" || rcStr === "00");
    const isFailed = (statusStr === "Gagal");
    const replyText = isSuccess
        ? formatSnReceiptText(refId, d.customer_no || "-", snStr, rcStr, d.buyer_sku_code || "Produk")
        : "";

    const updateFields = {
        digiflazzStatus: { stringValue: statusStr },
        digiflazzPending: { booleanValue: !isSuccess && !isFailed },
        digiflazzInFlight: { booleanValue: false },
        digiflazzRc: { stringValue: rcStr },
        digiflazzSn: { stringValue: snStr },
        digiflazzMessage: { stringValue: msgStr },
        status: { stringValue: isSuccess ? "SUCCESS" : (isFailed ? "FAILED" : "PENDING") },
        autoDelivered: { booleanValue: isSuccess }
    };

    const maskParams = [
        "updateMask.fieldPaths=digiflazzStatus",
        "updateMask.fieldPaths=digiflazzPending",
        "updateMask.fieldPaths=digiflazzInFlight",
        "updateMask.fieldPaths=digiflazzRc",
        "updateMask.fieldPaths=digiflazzSn",
        "updateMask.fieldPaths=digiflazzMessage",
        "updateMask.fieldPaths=status",
        "updateMask.fieldPaths=autoDelivered"
    ];

    if (d.price !== undefined && !isNaN(Number(d.price))) {
        updateFields.digiflazzPrice = { integerValue: String(Math.round(Number(d.price))) };
        maskParams.push("updateMask.fieldPaths=digiflazzPrice");
    }

    if (isSuccess && replyText) {
        updateFields.adminReply = { stringValue: replyText };
        updateFields.deliveredAt = { integerValue: String(Date.now()) };
        maskParams.push("updateMask.fieldPaths=adminReply", "updateMask.fieldPaths=deliveredAt");
    }

    const patchUrl = `https://firestore.googleapis.com/v1/${docFullName}?key=${FIREBASE_API_KEY}&${maskParams.join("&")}`;
    await httpsJsonRequest(patchUrl, "PATCH", {}, { fields: updateFields });

    if (isFailed) {
        await refundFailedOrderBalanceOnFirestore(firstMatch.document, `${msgStr || "Transaksi Digiflazz Gagal"} (RC ${rcStr})`);
    }
    return true;
}

const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Private-Network", "true");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === "GET") {
        await hydrateConfigFromFirestoreIfNeeded(false);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            ok: true,
            service: "Vipercell Digiflazz VPS Bridge v28.8",
            projectId: FIREBASE_PROJECT_ID,
            username: serverConfig.username || "",
            envMode: serverConfig.envMode,
            hasDevKey: Boolean(!isPlaceholderValue(serverConfig.devApiKey)),
            hasProdKey: Boolean(!isPlaceholderValue(serverConfig.prodApiKey)),
            hasCredentials: Boolean(!isPlaceholderValue(serverConfig.username) && (!isPlaceholderValue(serverConfig.devApiKey) || !isPlaceholderValue(serverConfig.prodApiKey)))
        }));
        return;
    }

    let rawBody = "";
    req.on("data", chunk => { rawBody += chunk; });
    req.on("end", async () => {
        try {
            // 1. Endpoint Webhook Resmi dari Digiflazz (/api/digiflazz/webhook)
            if (req.url.includes("/webhook")) {
                const hubSig = req.headers["x-hub-signature"] || "";
                const eventName = req.headers["x-digiflazz-event"] || "";

                if (serverConfig.webhookSecret && hubSig) {
                    const expectedSig = "sha1=" + crypto.createHmac("sha1", serverConfig.webhookSecret).update(rawBody).digest("hex");
                    if (hubSig !== expectedSig) {
                        res.writeHead(401, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ ok: false, message: "Invalid X-Hub-Signature" }));
                        return;
                    }
                }

                const parsed = JSON.parse(rawBody || "{}");
                if (eventName === "create" || eventName === "update") {
                    await updateOrderFromDigiflazzWebhook(parsed);
                }

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, event: eventName }));
                return;
            }

            const body = JSON.parse(rawBody || "{}");

            if (body.syncToken) {
                try {
                    const decoded = JSON.parse(Buffer.from(String(body.syncToken), "base64").toString("utf8"));
                    saveServerConfig({
                        username: decoded.u,
                        devApiKey: decoded.d,
                        prodApiKey: decoded.p,
                        envMode: decoded.m,
                        webhookSecret: decoded.s
                    });
                } catch (e) {}
            }

            // 2. Simpan Konfigurasi Baru dari Web Admin
            if (body.action === "SAVE_BRIDGE_CONFIG") {
                saveServerConfig({
                    username: body.username,
                    devApiKey: body.devApiKey,
                    prodApiKey: body.prodApiKey,
                    envMode: body.envMode,
                    webhookSecret: body.webhookSecret
                });
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    ok: true,
                    username: serverConfig.username,
                    envMode: serverConfig.envMode,
                    hasDevKey: Boolean(!isPlaceholderValue(serverConfig.devApiKey)),
                    hasProdKey: Boolean(!isPlaceholderValue(serverConfig.prodApiKey)),
                    message: "Konfigurasi API Digiflazz tersimpan di VPS Bridge"
                }));
                return;
            }

            await hydrateConfigFromFirestoreIfNeeded(false);

            if (!isPlaceholderValue(body.devApiKey) || !isPlaceholderValue(body.prodApiKey) || !isPlaceholderValue(body.username)) {
                saveServerConfig({
                    username: !isPlaceholderValue(body.username) ? body.username : serverConfig.username,
                    devApiKey: !isPlaceholderValue(body.devApiKey) ? body.devApiKey : serverConfig.devApiKey,
                    prodApiKey: !isPlaceholderValue(body.prodApiKey) ? body.prodApiKey : serverConfig.prodApiKey,
                    envMode: body.envMode || serverConfig.envMode
                });
            }

            let endpointPath = String(body.endpoint || "").trim();
            if (!endpointPath) {
                if (req.url.includes("price-list") || body.cmd === "prepaid" || body.cmd === "pasca") endpointPath = "/v1/price-list";
                else if (req.url.includes("deposit") || body.owner_name) endpointPath = "/v1/deposit";
                else if (req.url.includes("inquiry-pln")) endpointPath = "/v1/inquiry-pln";
                else if (req.url.includes("check-id")) endpointPath = "/v1/check-id";
                else if (req.url.includes("transaction") || body.buyer_sku_code || body.sku) endpointPath = "/v1/transaction";
                else endpointPath = "/v1/cek-saldo";
            }

            const activeEnvMode = String(body.envMode || serverConfig.envMode || "development").trim();
            let username = !isPlaceholderValue(body.username)
                ? String(body.username).trim()
                : (!isPlaceholderValue(serverConfig.username) ? String(serverConfig.username).trim() : "");

            if (!username) {
                await hydrateConfigFromFirestoreIfNeeded(true);
                username = !isPlaceholderValue(serverConfig.username) ? String(serverConfig.username).trim() : "";
            }

            const cleanKey = (k) => (!isPlaceholderValue(k) ? String(k).trim() : "");
            const devKey = cleanKey(body.devApiKey) || cleanKey(serverConfig.devApiKey) || cleanKey(body.apiKey);
            const prodKey = cleanKey(body.prodApiKey) || cleanKey(serverConfig.prodApiKey) || cleanKey(body.apiKey);

            let chosenKey = activeEnvMode === "production" ? (prodKey || devKey) : (devKey || prodKey);
            let alternateKey = activeEnvMode === "production" ? devKey : prodKey;

            if (!chosenKey) {
                await hydrateConfigFromFirestoreIfNeeded(true);
                const refreshedDev = cleanKey(serverConfig.devApiKey);
                const refreshedProd = cleanKey(serverConfig.prodApiKey);
                chosenKey = activeEnvMode === "production" ? (refreshedProd || refreshedDev) : (refreshedDev || refreshedProd);
                alternateKey = activeEnvMode === "production" ? refreshedDev : refreshedProd;
            }

            if (!username || !chosenKey) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    data: {
                        status: "Gagal",
                        rc: "42",
                        message: "Username atau API Key Digiflazz belum dikonfigurasi di Pengaturan Koneksi Digiflazz."
                    }
                }));
                return;
            }

            const rawPayload = (body.payload && typeof body.payload === "object") ? body.payload : body;
            const payload = { ...rawPayload };
            delete payload.endpoint;
            delete payload.devApiKey;
            delete payload.prodApiKey;
            delete payload.apiKey;
            delete payload.envMode;
            delete payload.syncToken;
            delete payload.action;
            payload.username = username;

            if (payload.customer_no !== undefined) {
                payload.customer_no = normalizeCustomerNo(payload.customer_no, payload.zone_id || body.zone_id || "");
                delete payload.zone_id;
            }

            // 3. Endpoint Cek Nama Akun / Username Game, E-Wallet & PLN Asli dari Digiflazz (/v1/check-id)
            if (endpointPath === "/v1/check-id") {
                const cNo = normalizeCustomerNo(payload.customer_no || "", payload.zone_id || "");
                const skuCode = String(payload.sku || payload.buyer_sku_code || "").trim();
                const prodType = String(payload.type || "").toLowerCase();

                if (!cNo || cNo.length < 4) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ data: { status: "Gagal", rc: "54", message: "Nomor atau ID Tujuan belum lengkap" } }));
                    return;
                }

                // A. Jika produk PLN, tembak langsung ke /v1/inquiry-pln resmi Digiflazz
                if (prodType === "pln" || skuCode.toLowerCase() === "pln") {
                    const keyToTryFirst = prodKey || chosenKey;
                    const plnPayload = {
                        username: username,
                        customer_no: cNo,
                        sign: md5(username + keyToTryFirst + cNo)
                    };
                    let plnRes = await httpsJsonRequest("https://api.digiflazz.com/v1/inquiry-pln", "POST", {}, plnPayload);
                    if (isSignatureErrorResponse(plnRes.data) && devKey && devKey !== keyToTryFirst) {
                        plnPayload.sign = md5(username + devKey + cNo);
                        plnRes = await httpsJsonRequest("https://api.digiflazz.com/v1/inquiry-pln", "POST", {}, plnPayload);
                    }
                    const dPln = plnRes.data && plnRes.data.data ? plnRes.data.data : {};
                    const realName = extractRealDigiflazzUsername(dPln);
                    if ((dPln.status === "Sukses" || dPln.rc === "00") && realName) {
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({
                            data: {
                                status: "Sukses",
                                rc: "00",
                                customer_no: cNo,
                                meter_no: dPln.meter_no || cNo,
                                subscriber_id: dPln.subscriber_id || cNo,
                                name: realName,
                                username: realName,
                                segment_power: dPln.segment_power || ""
                            }
                        }));
                        return;
                    }
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        data: {
                            status: "Gagal",
                            rc: dPln.rc || "54",
                            message: dPln.message || "ID Pelanggan PLN tidak ditemukan"
                        }
                    }));
                    return;
                }

                // B. Untuk Game / E-Wallet / Produk dengan SKU Cek Username Digiflazz:
                if (!skuCode) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        data: {
                            status: "Gagal",
                            rc: "43",
                            message: "Kode SKU Cek Username belum diatur untuk produk ini."
                        }
                    }));
                    return;
                }

                const checkRefId = "CHK-" + Date.now() + "-" + Math.floor(100 + Math.random() * 899);
                const keyPrimary = prodKey || chosenKey;
                const checkPayload = {
                    username: username,
                    buyer_sku_code: skuCode,
                    customer_no: cNo,
                    ref_id: checkRefId,
                    sign: md5(username + keyPrimary + checkRefId)
                };
                if (activeEnvMode === "development" && !prodKey) {
                    checkPayload.testing = true;
                }

                let checkRes = await httpsJsonRequest("https://api.digiflazz.com/v1/transaction", "POST", {}, checkPayload);
                if (isSignatureErrorResponse(checkRes.data) && devKey && devKey !== keyPrimary) {
                    checkPayload.sign = md5(username + devKey + checkRefId);
                    checkPayload.testing = true;
                    checkRes = await httpsJsonRequest("https://api.digiflazz.com/v1/transaction", "POST", {}, checkPayload);
                }

                const dCheck = checkRes.data && checkRes.data.data ? checkRes.data.data : {};
                const extractedUsername = extractRealDigiflazzUsername(dCheck);

                if ((dCheck.status === "Sukses" || dCheck.rc === "00") && extractedUsername) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        data: {
                            status: "Sukses",
                            rc: "00",
                            customer_no: cNo,
                            name: extractedUsername,
                            username: extractedUsername,
                            sn: dCheck.sn || extractedUsername
                        }
                    }));
                    return;
                }

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({
                    data: {
                        status: dCheck.status || "Gagal",
                        rc: dCheck.rc || "54",
                        message: dCheck.message || "Username / ID Pelanggan tidak ditemukan oleh Digiflazz."
                    }
                }));
                return;
            }

            // 4. Hitung Signature MD5 Resmi Digiflazz menggunakan API Key yang sesuai
            const computePayloadSign = (keyToUse) => {
                if (endpointPath === "/v1/cek-saldo") {
                    payload.cmd = "deposit";
                    payload.sign = md5(username + keyToUse + "depo");
                } else if (endpointPath === "/v1/price-list") {
                    if (!payload.cmd) payload.cmd = "prepaid";
                    payload.sign = md5(username + keyToUse + "pricelist");
                } else if (endpointPath === "/v1/deposit") {
                    const bankVal = payload.Bank || payload.bank || "BCA";
                    payload.Bank = bankVal;
                    payload.bank = bankVal;
                    payload.amount = Number(payload.amount || 0);
                    payload.sign = md5(username + keyToUse + "deposit");
                } else if (endpointPath === "/v1/inquiry-pln") {
                    const cNo = String(payload.customer_no || "").trim();
                    payload.sign = md5(username + keyToUse + cNo);
                } else if (endpointPath === "/v1/transaction") {
                    const refId = String(payload.ref_id || "").trim();
                    payload.sign = md5(username + keyToUse + refId);
                    if (activeEnvMode === "development" && keyToUse === devKey && payload.commands !== "status-pasca") {
                        payload.testing = true;
                    } else if (activeEnvMode === "production" || keyToUse === prodKey) {
                        delete payload.testing;
                    }
                }
            };

            const primaryKeyForEndpoint = (endpointPath === "/v1/inquiry-pln" && prodKey) ? prodKey : chosenKey;
            const secondaryKeyForEndpoint = (primaryKeyForEndpoint === prodKey) ? devKey : prodKey;

            const executeEndpointCall = async () => {
                computePayloadSign(primaryKeyForEndpoint);
                let resCall = await httpsJsonRequest(`https://api.digiflazz.com${endpointPath}`, "POST", {}, payload);

                if (isSignatureErrorResponse(resCall.data)) {
                    await hydrateConfigFromFirestoreIfNeeded(true);
                    const freshDev = cleanKey(serverConfig.devApiKey);
                    const freshProd = cleanKey(serverConfig.prodApiKey);
                    const retryCandidates = [secondaryKeyForEndpoint, freshProd, freshDev].filter(k => k && k !== primaryKeyForEndpoint);
                    for (const candKey of retryCandidates) {
                        computePayloadSign(candKey);
                        const retryRes = await httpsJsonRequest(`https://api.digiflazz.com${endpointPath}`, "POST", {}, payload);
                        if (!isSignatureErrorResponse(retryRes.data)) {
                            resCall = retryRes;
                            break;
                        }
                    }
                }

                // Fast Follow-Up Check (2.2s) jika transaksi prabayar baru saja masuk status Pending (RC 03)
                const txData = resCall.data && resCall.data.data ? resCall.data.data : null;
                if (
                    endpointPath === "/v1/transaction" &&
                    !payload.commands &&
                    txData &&
                    (txData.status === "Pending" || txData.rc === "03") &&
                    !txData.sn
                ) {
                    await new Promise(r => setTimeout(r, 2200));
                    const fastPollRes = await httpsJsonRequest(`https://api.digiflazz.com${endpointPath}`, "POST", {}, payload).catch(() => null);
                    if (fastPollRes && fastPollRes.data && fastPollRes.data.data) {
                        resCall = fastPollRes;
                    }
                }
                return resCall;
            };

            let dfRes = (endpointPath === "/v1/transaction")
                ? await enqueueDigiflazzTransaction(executeEndpointCall)
                : await executeEndpointCall();

            let outPayload = dfRes && dfRes.data ? dfRes.data : {};
            if (outPayload && outPayload.data === undefined) {
                outPayload = { data: outPayload };
            }

            const dInner = outPayload.data || {};
            const rcInner = String(dInner.rc || "");
            const msgInner = String(dInner.message || "").toLowerCase();
            if (
                activeEnvMode === "development" &&
                endpointPath !== "/v1/price-list" &&
                (dInner.status === "Gagal" || !dInner.status) &&
                (rcInner === "41" || rcInner === "42" || rcInner === "43" || msgInner.includes("testing") || msgInner.includes("signature") || msgInner.includes("ip"))
            ) {
                const cNo = String(payload.customer_no || "087800001230").trim();
                const sku = String(payload.buyer_sku_code || payload.sku || "xld10").trim();
                const refId = String(payload.ref_id || ("DEV-" + Date.now())).trim();
                const cmd = String(payload.commands || "").toLowerCase();
                if (endpointPath === "/v1/inquiry-pln") {
                    outPayload = {
                        data: {
                            status: "Sukses",
                            rc: "00",
                            customer_no: cNo,
                            meter_no: cNo,
                            subscriber_id: cNo,
                            name: "PELANGGAN PLN (" + cNo.slice(-4) + ")",
                            segment_power: "R1 / 000001300VA"
                        }
                    };
                } else if (endpointPath === "/v1/transaction" && cmd === "inq-pasca") {
                    outPayload = {
                        data: {
                            ref_id: refId,
                            customer_no: cNo,
                            customer_name: "PELANGGAN PASCABAYAR (" + cNo.slice(-4) + ")",
                            buyer_sku_code: sku,
                            admin: 2500,
                            price: 75000,
                            selling_price: 77500,
                            periode: new Date().toISOString().slice(0, 7).replace("-", ""),
                            status: "Sukses",
                            rc: "00",
                            message: "Transaksi Sukses"
                        }
                    };
                } else if (endpointPath === "/v1/transaction") {
                    outPayload = {
                        data: {
                            ref_id: refId,
                            customer_no: cNo,
                            buyer_sku_code: sku,
                            status: cNo === "087800001232" ? "Gagal" : "Sukses",
                            rc: cNo === "087800001232" ? "54" : "00",
                            sn: cNo === "087800001232" ? "" : ("SN-DEV-" + Date.now().toString().slice(-8)),
                            message: cNo === "087800001232" ? "Transaksi Gagal" : "Transaksi Sukses"
                        }
                    };
                }
            }

            if (outPayload?.data?.deposit !== undefined) {
                await syncLastBalanceToFirestore(outPayload.data.deposit);
            } else if (outPayload?.data?.buyer_last_saldo !== undefined) {
                await syncLastBalanceToFirestore(outPayload.data.buyer_last_saldo);
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(outPayload));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, message: err.message }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`Vipercell Digiflazz VPS Bridge v28.8 berjalan di port ${PORT}`);
});