import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC0rTdOFM1-8dFrPsCpmqDe-zlLcXowjYU",
  authDomain: "flowsync-f4d42.firebaseapp.com",
  projectId: "flowsync-f4d42",
  storageBucket: "flowsync-f4d42.firebasestorage.app",
  messagingSenderId: "340749255218",
  appId: "1:340749255218:web:0bc6b0a2bfd6506279322b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);