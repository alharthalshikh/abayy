import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Replace with your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBkch8qqqzwPj6jhiUTVB4Fu4hsIYFyqek",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "abaya-13d98.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "abaya-13d98",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "abaya-13d98.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "277253139212",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:277253139212:web:73d8b4408e78698c0db729"
};


const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "PLACEHOLDER" && firebaseConfig.projectId !== "PLACEHOLDER";
};

export { db, auth, storage };
