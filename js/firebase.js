import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
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
  getDocs,
  increment,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Konfigurasi Firebase Proyek Vipercell
const firebaseConfig = {
  apiKey: "AIzaSyBQGZjl7uj5CRiLWCvPQKjiK4HvIYnXSJg",
  authDomain: "vipercell-fc50e.firebaseapp.com",
  projectId: "vipercell-fc50e",
  storageBucket: "vipercell-fc50e.firebasestorage.app",
  messagingSenderId: "710483059781",
  appId: "1:710483059781:web:b4c27b14ab34c45c892f2c"
};

// Inisialisasi Firebase App, Database Firestore, dan Auth
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Export seluruh fungsi Firestore & Auth agar bisa dipanggil oleh store.js dan admin.js
export {
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
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
  getDocs,
  increment,
  arrayUnion
};