// js/config/firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: นำค่า Config จาก Firebase Console ของโปรเจกต์ Luminous Story มาใส่ที่นี่
const firebaseConfig = {
  apiKey: "AIzaSyDlov2Xof9ftatmYOLkkEpDz0cDhDykN9c",
  authDomain: "luminous-story.firebaseapp.com",
  projectId: "luminous-story",
  storageBucket: "luminous-story.firebasestorage.app",
  messagingSenderId: "178955077787",
  appId: "1:178955077787:web:2dfbe5bfef3215daa89e3e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };