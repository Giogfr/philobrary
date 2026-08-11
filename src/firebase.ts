import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD59DrYCbDvE1X7l-ZRTB9U_ybRS-n5OQQ",
  authDomain: "sheikh-gios-library.firebaseapp.com",
  projectId: "sheikh-gios-library",
  storageBucket: "sheikh-gios-library.firebasestorage.app",
  messagingSenderId: "584491219155",
  appId: "1:584491219155:web:1b88c091b018e4041afc26",
  measurementId: "G-KBSP8EKXSB",
  databaseURL: "https://sheikh-gios-library-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
