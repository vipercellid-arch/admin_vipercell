import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";

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
  databaseURL: "https://vipercell-fc50e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vipercell-fc50e",
  storageBucket: "vipercell-fc50e.firebasestorage.app",
  messagingSenderId: "710483059781",
  appId: "1:710483059781:web:b4c27b14ab34c45c892f2c",
  measurementId: "G-V7P0DJ27BL"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export let analytics = null;
try {
  if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
  }
} catch (err) {}

export const persistenceReady = (async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
    } catch (fallbackErr) {
      console.warn("Persistence Warning:", fallbackErr);
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