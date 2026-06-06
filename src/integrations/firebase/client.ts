import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBIHRfq0tKN6ELQP0NznDBAaFEVVQ_kUkU",
  authDomain: "studio-5871543491-a8c0f.firebaseapp.com",
  projectId: "studio-5871543491-a8c0f",
  storageBucket: "studio-5871543491-a8c0f.firebasestorage.app",
  messagingSenderId: "1015663394432",
  appId: "1:1015663394432:web:3500496b7b64f446113065",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
export const storage = getStorage(firebaseApp);
