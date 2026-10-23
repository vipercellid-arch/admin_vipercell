rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // =========================================================
    // FUNGSI CEK ADMIN RESMI VIPERCELL (AKSES PENUH)
    // =========================================================
    function isAdmin() {
      return request.auth != null && (
        request.auth.token.email == "vipercell.id@gmail.com" || 
        request.auth.token.email == "millertipak63@gmail.com" ||
        request.auth.token.email == "vipercell@bot.id"
      );
    }

    // =========================================================
    // 1. KOLEKSI USERS (MEMBER, MEMBER PLUS, PIN TRX & TAMU)
    //    - Pengguna Tamu (Anonim) tidak diizinkan memiliki saldo (balance).
    //    - Mendukung penyimpanan PIN Transaksi (trxPinHash), Member Plus, dan Auth Token untuk pembersihan 6 jam.
    // =========================================================
    match /users/{userId} {
      allow read: if true;
      allow create: if isAdmin() || (
        request.auth != null &&
        request.auth.uid == userId &&
        (!('balance' in request.resource.data) || request.resource.data.balance == 0)
      );
      allow update: if isAdmin() || (
        request.auth != null && (
          request.auth.uid == userId ||
          resource.data.uid == userId
        ) && (
          (request.resource.data.get('isAnonymous', false) == false && request.resource.data.get('isGuest', false) == false) ||
          request.resource.data.get('balance', 0) == 0
        )
      );
      allow delete: if isAdmin() || request.auth != null;
    }

    // =========================================================
    // 2. KOLEKSI ORDERS (PESANAN, TOPUP SALDO, MEMBER PLUS, PLN, PASCA & DIGIFLAZZ)
    // =========================================================
    match /orders/{orderId} {
      allow read, create: if true;
      allow update: if isAdmin() || (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'status',
          'paymentVerified',
          'paidAt',
          'paidAtIso',
          'paymentVerifiedBy',
          'paymentMutationId',
          'paymentApp',
          'adminReply',
          'autoDelivered',
          'deliveredAt',
          'durationDays',
          'subscriptionStartAt',
          'subscriptionEndAt',
          'subscriptionStatus',
          'userId',
          'userEmail',
          'emailSent',
          'emailSending',
          'emailSentAt',
          'notif_new',
          'notif_paid',
          'notif_completed',
          'isTopupOrder',
          'isMemberPlusOrder',
          'isMemberPlusUser',
          'memberPlusActivated',
          'orderType',
          'topupAmount',
          'balanceCredited',
          'balanceCreditedAt',
          'balanceRefunded',
          'balanceRefundedAt',
          'refundedToBalance',
          'refundedAt',
          'verifiedTargetName',
          'targetAccountName',
          'plnTokenNumber',
          'plnSubscriberName',
          'plnSegmentPower',
          'plnKwh',
          'customEwalletNominal',
          'customEwalletAmount',
          'adminFeeAmount',
          'pascaBillDetails',
          'digiflazzRefId',
          'digiflazzSku',
          'digiflazzCustomerNo',
          'digiflazzStatus',
          'digiflazzRc',
          'digiflazzSn',
          'digiflazzMessage',
          'digiflazzLastHitAt',
          'digiflazzPrice',
          'digiflazzSellingPrice',
          'digiflazzDesc',
          'digiflazzCommand',
          'digiflazzInFlight'
        ])
      );
      allow delete: if isAdmin();
    }

    // =========================================================
    // 3. KOLEKSI STOCKS (GUDANG STOK LOKAL)
    // =========================================================
    match /stocks/{stockId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'usedQuota',
          'status',
          'usedAt',
          'orderId',
          'buyers',
          'sentCount',
          'lastSentAt',
          'lastOrderId'
        ])
      );
    }

    // =========================================================
    // 4. KOLEKSI PRODUCTS (KATALOG PRODUK LOKAL & DIGIFLAZZ + SEMBUNYIKAN PRODUK/VARIAN)
    // =========================================================
    match /products/{productId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'stockVault',
          'exhaustedVault',
          'stockCount',
          'soldOut',
          'isGangguan',
          'isVariantGangguan',
          'isHidden',
          'isBrandHidden',
          'memberPlusPriceNum',
          'isCheckUsernameProduct',
          'sellerProductStatus',
          'buyerProductStatus'
        ])
      );
    }

    // =========================================================
    // 5. KOLEKSI DIGIFLAZZ_CATALOG, DIGIFLAZZ_DEPOSITS & BALANCE_LOGS
    // =========================================================
    match /digiflazz_catalog/{skuId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    match /digiflazz_deposits/{depId} {
      allow read, create, update, delete: if isAdmin();
    }

    match /balance_logs/{logId} {
      allow read, create: if request.auth != null;
      allow update, delete: if isAdmin();
    }

    // =========================================================
    // 6. KOLEKSI PROMOS (KODE PROMO MEMBER & MEMBER PLUS)
    // =========================================================
    match /promos/{promoId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'usedCount',
          'usedEmails'
        ])
      );
    }

    // =========================================================
    // 7. KOLEKSI SETTINGS (KONFIGURASI TOKO & KREDENSIAL RAHASIA ADMIN)
    // =========================================================
    match /settings/secretConfig {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    match /settings/{settingId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        settingId != 'secretConfig' &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'lastPaymentDetected',
          'lastPaymentTimestamp',
          'lastPaymentMutation',
          'suggestionsList',
          'footerMarqueeShowPrice',
          'footerMarqueeShowStatus',
          'footerMarqueeSpeed',
          'digiflazzLastBalance'
        ])
      );
    }

    // =========================================================
    // 8. KOLEKSI PAYMENT_MUTATIONS, PRODUCT_SUGGESTIONS, DEVICE_LOCKS, REVIEWS & CHATS
    // =========================================================
    match /payment_mutations/{mutationId} {
      allow read, create, update, delete: if true;
    }

    match /product_suggestions/{suggestionId} {
      allow read, create: if true;
      allow update, delete: if isAdmin();
    }

    match /device_locks/{deviceId} {
      allow read, create, update: if true;
      allow delete: if isAdmin() || request.auth != null;
    }

    match /reviews/{reviewId} {
      allow read, create: if true;
      allow update, delete: if isAdmin();
    }

    match /chats/{userId} {
      allow read, create, update: if true;
      allow delete: if isAdmin() || request.auth != null;
    }

    // =========================================================
    // RULES WORKSPACE / ARTIFACTS PATH (CADANGAN KOMPATIBILITAS)
    // =========================================================
    match /artifacts/{appId}/public/data/settings/secretConfig {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
    match /artifacts/{appId}/public/data/users/{userId} {
      allow read, create, update: if true;
      allow delete: if isAdmin() || request.auth != null;
    }
    match /artifacts/{appId}/public/data/orders/{orderId} {
      allow read, create: if true;
      allow update: if isAdmin() || (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'status', 'paymentVerified', 'paidAt', 'paidAtIso',
          'paymentVerifiedBy', 'paymentMutationId', 'paymentApp',
          'adminReply', 'autoDelivered', 'deliveredAt',
          'durationDays', 'subscriptionStartAt', 'subscriptionEndAt', 'subscriptionStatus',
          'userId', 'userEmail', 'emailSent', 'emailSending', 'emailSentAt',
          'notif_new', 'notif_paid', 'notif_completed',
          'isTopupOrder', 'isMemberPlusOrder',
          'isMemberPlusUser', 'memberPlusActivated', 'orderType', 'topupAmount',
          'balanceCredited', 'balanceCreditedAt', 'balanceRefunded', 'balanceRefundedAt',
          'refundedToBalance', 'refundedAt', 'verifiedTargetName', 'targetAccountName',
          'plnTokenNumber', 'plnSubscriberName', 'plnSegmentPower', 'plnKwh',
          'customEwalletNominal', 'customEwalletAmount', 'adminFeeAmount', 'pascaBillDetails',
          'digiflazzRefId', 'digiflazzSku', 'digiflazzCustomerNo', 'digiflazzStatus',
          'digiflazzRc', 'digiflazzSn', 'digiflazzMessage', 'digiflazzLastHitAt',
          'digiflazzPrice', 'digiflazzSellingPrice', 'digiflazzDesc', 'digiflazzCommand', 'digiflazzInFlight'
        ])
      );
      allow delete: if isAdmin();
    }
    match /artifacts/{appId}/public/data/stocks/{stockId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'usedQuota', 'status', 'usedAt', 'orderId', 'buyers', 'sentCount', 'lastSentAt', 'lastOrderId'
        ])
      );
    }
    match /artifacts/{appId}/public/data/products/{productId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'stockVault', 'exhaustedVault', 'stockCount', 'soldOut', 'isGangguan', 'isVariantGangguan', 'isHidden', 'isBrandHidden', 'memberPlusPriceNum',
          'isCheckUsernameProduct', 'sellerProductStatus', 'buyerProductStatus'
        ])
      );
    }
    match /artifacts/{appId}/public/data/digiflazz_catalog/{skuId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
    match /artifacts/{appId}/public/data/digiflazz_deposits/{depId} {
      allow read, create, update, delete: if isAdmin();
    }
    match /artifacts/{appId}/public/data/balance_logs/{logId} {
      allow read, create: if request.auth != null;
      allow update, delete: if isAdmin();
    }
    match /artifacts/{appId}/public/data/promos/{promoId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'usedCount', 'usedEmails'
        ])
      );
    }
    match /artifacts/{appId}/public/data/settings/{settingId} {
      allow read: if true;
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        settingId != 'secretConfig' &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'lastPaymentDetected', 'lastPaymentTimestamp', 'lastPaymentMutation', 'suggestionsList',
          'footerMarqueeShowPrice', 'footerMarqueeShowStatus', 'footerMarqueeSpeed', 'digiflazzLastBalance'
        ])
      );
    }
    match /artifacts/{appId}/public/data/payment_mutations/{mutationId} {
      allow read, create, update, delete: if true;
    }
    match /artifacts/{appId}/public/data/product_suggestions/{suggestionId} {
      allow read, create: if true;
      allow update, delete: if isAdmin();
    }
    match /artifacts/{appId}/public/data/device_locks/{deviceId} {
      allow read, create, update: if true;
      allow delete: if isAdmin() || request.auth != null;
    }
    match /artifacts/{appId}/public/data/reviews/{reviewId} {
      allow read, create: if true;
      allow update, delete: if isAdmin();
    }
    match /artifacts/{appId}/public/data/chats/{userId} {
      allow read, create, update: if true;
      allow delete: if isAdmin() || request.auth != null;
    }
  }
}