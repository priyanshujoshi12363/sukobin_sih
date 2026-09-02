import { initializeApp, getApps, getApp } from "firebase/app";

import {
  getAuth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCCtkbbjwko3_CN06jqANgeY9TB4MDbRJI",
  authDomain: "sukobin-37444.firebaseapp.com",
  databaseURL:
    "https://sukobin-37444-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sukobin-37444",
  storageBucket: "sukobin-37444.appspot.com",
  messagingSenderId: "894121030293",
  appId: "1:894121030293:web:f89df5e67680075f5fe19c",
};

// ✅ Initialize Firebase app once
const app =
  getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp();

// ✅ SIMPLE AUTH
const auth = getAuth(app);

export { auth, firebaseConfig };