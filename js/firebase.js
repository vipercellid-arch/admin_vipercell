// ========================================================
// VIPERCELL V24.5 - UNIVERSAL FIREBASE CORE MODULE
// Menyokong Web User (store.js) & Web Admin (admin.js)
// ========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  deleteUser,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  writeBatch,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Konfigurasi Rasmi Projek Firebase Vipercell
const firebaseConfig = {
  apiKey: "AIzaSyBQGZjl7uj5CRiLWCvPQKjiK4HvIYnXSJg",
  authDomain: "vipercell-fc50e.firebaseapp.com",
  projectId: "vipercell-fc50e",
  storageBucket: "vipercell-fc50e.firebasestorage.app",
  messagingSenderId: "710483059781",
  appId: "1:710483059781:web:b4c27b14ab34c45c892f2c"
};

// Inisialisasi Aplikasi Utama, Firestore Database, dan Authentication
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Inisialisasi Penyimpanan Sesi Permanen (Anti-Hilang Sesi Semasa Refresh di Web & PWA)
export const persistenceReady = (async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
    } catch (fallbackErr) {
      console.warn("Peringatan Persistence Firebase:", fallbackErr);
    }
  }
})();

// Eksport semua fungsi Authentication & Firestore supaya boleh dipanggil terus oleh store.js dan admin.js
export {
  // Fungsi & Provider Firebase Authentication
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  deleteUser,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  
  // Fungsi & Utiliti Cloud Firestore
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  writeBatch,
  runTransaction
};