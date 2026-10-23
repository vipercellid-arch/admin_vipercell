/**
 * VIPERCELL - DIGIFLAZZ VPS BRIDGE & WEBHOOK RECEIVER (v28.4)
 * Mendukung:
 * 1. Dual API Key (Development & Production) tersimpan di VPS dan otomatis mengambil kunci dari Firestore (mainConfig/digiflazzBridgeSyncToken) jika memori VPS kosong.
 * 2. Auto-Retry Signature Pintar (mencoba Production Key & Development Key secara otomatis jika salah satu mengembalikan pesan Signature salah).
 * 3. Penanganan otomatis penggabungan ID + Zone ID menjadi satu nomor tujuan (Contoh: 123456(1234) -> 1234561234).
 * 4. Cek Username / ID Pelanggan Asli dari Digiflazz (/v1/inquiry-pln & SKU Cek Username via /v1/transaction) TANPA pernah membuat username acak/palsu.
 * 5. Webhook Receiver (/api/digiflazz/webhook) untuk pembaruan status pesanan dan SN/Token PLN secara real-time.
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

function saveServerConfig(newCfg) {
    const updated = { ...serverConfig };
    if (newCfg.username !== undefined && String(newCfg.username).trim() !== "") {
        updated.username = String(newCfg.username).trim();
    }
    if (newCfg.devApiKey !== undefined && String(newCfg.devApiKey).trim() !== "" && newCfg.devApiKey !== "dev-apikey") {
        updated.devApiKey = String(newCfg.devApiKey).trim();
    }
    if (newCfg.prodApiKey !== undefined && String(newCfg.prodApiKey).trim() !== "" && newCfg.prodApiKey !== "dev-apikey") {
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

    s = s.replace(/^(Tujuan|ID\s*Player|ID\s*PLN|ID|Target|No\.?\s*Pelanggan|No\.?\s*Meter|No\.?\s*HP|No\.?\s*Tujuan)\s*:\s*/i, "").trim();
    if (s.includes(" (")) {
        s = s.split(" (")[0].trim();
    }
    if (z && !s.endsWith(z)) {
        return `${s}${z}`;
    }
    return s;
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
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(bodyStr),
                ...headers
            }
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
    const hasKeys = Boolean(serverConfig.username && (serverConfig.devApiKey || serverConfig.prodApiKey));
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
            username: u || serverConfig.username,
            devApiKey: dKey || lKey || serverConfig.devApiKey,
            prodApiKey: pKey || serverConfig.prodApiKey,
            envMode: (mode === "production" || mode === "development") ? mode : serverConfig.envMode,
            webhookSecret: sec || serverConfig.webhookSecret
        });
    } catch (e) {}
}

function extractRealDigiflazzUsername(d) {
    if (!d || typeof d !== "object") return "";
    if (d.name && String(d.name).trim()) return String(d.name).trim();
    if (d.customer_name && String(d.customer_name).trim()) return String(d.customer_name).trim();
    if (d.username && String(d.username).trim()) return String(d.username).trim();

    const rawSn = String(d.sn || "").trim();
    if (rawSn) {
        // Banyak produk Cek Username Digiflazz mengembalikan nama di dalam SN, contoh:
        // "NICKNAME" atau "Username: NICKNAME / ID: 123" atau "SN: NICKNAME" atau "123456/NAMA PELANGGAN/..."
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
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/mainConfig?key=${FIREBASE_API_KEY}&updateMask.fieldPaths=digiflazzLastBalance`;
    await httpsJsonRequest(patchUrl, "PATCH", {}, {
        fields: {
            digiflazzLastBalance: { integerValue: String(Math.round(Number(newBalance))) }
        }
    }).catch(() => {});
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
        digiflazzRc: { stringValue: rcStr },
        digiflazzSn: { stringValue: snStr },
        digiflazzMessage: { stringValue: msgStr },
        status: { stringValue: isSuccess ? "SUCCESS" : (isFailed ? "FAILED" : "PENDING") },
        autoDelivered: { booleanValue: isSuccess }
    };

    const maskParams = [
        "updateMask.fieldPaths=digiflazzStatus",
        "updateMask.fieldPaths=digiflazzRc",
        "updateMask.fieldPaths=digiflazzSn",
        "updateMask.fieldPaths=digiflazzMessage",
        "updateMask.fieldPaths=status",
        "updateMask.fieldPaths=autoDelivered"
    ];

    if (isSuccess && replyText) {
        updateFields.adminReply = { stringValue: replyText };
        updateFields.deliveredAt = { integerValue: String(Date.now()) };
        maskParams.push("updateMask.fieldPaths=adminReply", "updateMask.fieldPaths=deliveredAt");
    }

    const patchUrl = `https://firestore.googleapis.com/v1/${docFullName}?key=${FIREBASE_API_KEY}&${maskParams.join("&")}`;
    await httpsJsonRequest(patchUrl, "PATCH", {}, { fields: updateFields });
    return true;
}

const server = http.createServer((req, res) => {
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
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            ok: true,
            service: "Vipercell Digiflazz VPS Bridge v28.3",
            projectId: FIREBASE_PROJECT_ID,
            envMode: serverConfig.envMode,
            hasDevKey: Boolean(serverConfig.devApiKey),
            hasProdKey: Boolean(serverConfig.prodApiKey),
            hasCredentials: Boolean(serverConfig.username && (serverConfig.devApiKey || serverConfig.prodApiKey))
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
                    envMode: serverConfig.envMode,
                    hasDevKey: Boolean(serverConfig.devApiKey),
                    hasProdKey: Boolean(serverConfig.prodApiKey),
                    message: "Konfigurasi API Key Development & Production tersimpan di VPS Bridge"
                }));
                return;
            }

            await hydrateConfigFromFirestoreIfNeeded(false);

            if (body.devApiKey || body.prodApiKey) {
                saveServerConfig({
                    username: body.username || serverConfig.username,
                    devApiKey: body.devApiKey || serverConfig.devApiKey,
                    prodApiKey: body.prodApiKey || serverConfig.prodApiKey,
                    envMode: body.envMode || serverConfig.envMode
                });
            }

            const endpointPath = String(body.endpoint || "/v1/cek-saldo").trim();
            const activeEnvMode = String(body.envMode || serverConfig.envMode || "development").trim();
            let username = String(body.username || serverConfig.username || "").trim();
            if (!username || username === "username") {
                await hydrateConfigFromFirestoreIfNeeded(true);
                username = String(serverConfig.username || body.username || "").trim();
            }

            const cleanKey = (k) => (k && k !== "dev-apikey" ? String(k).trim() : "");
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

            const payload = { ...(body.payload || {}) };
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
                // Tembak ke /v1/transaction menggunakan SKU Cek Username yang telah diatur Admin
                if (!skuCode || !username || !chosenKey) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        data: {
                            status: "Gagal",
                            rc: "40",
                            message: !skuCode
                                ? "Kode SKU Cek Username belum diatur untuk produk ini."
                                : "Kredensial API Digiflazz belum tersimpan di server."
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
                    payload.sign = md5(username + keyToUse + "pricelist");
                } else if (endpointPath === "/v1/deposit") {
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

            // Untuk /v1/inquiry-pln, utamakan Production Key jika tersedia karena endpoint inquiry PLN Digiflazz menggunakan Production Key
            const primaryKeyForEndpoint = (endpointPath === "/v1/inquiry-pln" && prodKey) ? prodKey : chosenKey;
            const secondaryKeyForEndpoint = (primaryKeyForEndpoint === prodKey) ? devKey : prodKey;

            computePayloadSign(primaryKeyForEndpoint);
            let dfRes = await httpsJsonRequest(`https://api.digiflazz.com${endpointPath}`, "POST", {}, payload);

            // Auto-Retry dengan kunci pasangan (Dev <-> Prod) atau re-hydrate dari Firestore jika Digiflazz mengembalikan "Signature Anda salah"
            if (isSignatureErrorResponse(dfRes.data)) {
                await hydrateConfigFromFirestoreIfNeeded(true);
                const freshDev = cleanKey(serverConfig.devApiKey);
                const freshProd = cleanKey(serverConfig.prodApiKey);
                const retryCandidates = [secondaryKeyForEndpoint, freshProd, freshDev].filter(k => k && k !== primaryKeyForEndpoint);
                for (const candKey of retryCandidates) {
                    computePayloadSign(candKey);
                    const retryRes = await httpsJsonRequest(`https://api.digiflazz.com${endpointPath}`, "POST", {}, payload);
                    if (!isSignatureErrorResponse(retryRes.data)) {
                        dfRes = retryRes;
                        break;
                    }
                }
            }

            if (dfRes.data?.data?.deposit !== undefined) {
                await syncLastBalanceToFirestore(dfRes.data.data.deposit);
            } else if (dfRes.data?.data?.buyer_last_saldo !== undefined) {
                await syncLastBalanceToFirestore(dfRes.data.data.buyer_last_saldo);
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(dfRes.data));
        } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, message: err.message }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`Vipercell Digiflazz VPS Bridge v28.3 berjalan di port ${PORT}`);
});