/* ============================================================================
 * VIPERCELL V25.0 - UNIVERSAL FIREBASE CORE MODULE
 * [FEATURE-01 & FEATURE-08] AUTH PERSISTENCE & ATOMIC TRANSACTION ENGINE
 * ============================================================================ */

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

const firebaseConfig = {
  apiKey: "AIzaSyBQGZjl7uj5CRiLWCvPQKjiK4HvIYnXSJg",
  authDomain: "vipercell-fc50e.firebaseapp.com",
  projectId: "vipercell-fc50e",
  storageBucket: "vipercell-fc50e.firebasestorage.app",
  messagingSenderId: "710483059781",
  appId: "1:710483059781:web:b4c27b14ab34c45c892f2c"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const persistenceReady = (async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
    } catch (fallbackErr) {
      console.warn("Firebase Persistence Warning:", fallbackErr);
    }
  }
})();

export {
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
/* ======================== END OF [FEATURE-01] ============================= */