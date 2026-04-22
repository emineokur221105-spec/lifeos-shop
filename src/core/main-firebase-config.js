// 主 Firebase 連線（lifeos-maindoor）
// 用途：存租戶清單 + hostname 白名單 hash
// Firebase v11 modular SDK，ES module export
// 2026-04-23 換主 Firebase：前代 shop-system-v2 被移除，改 lifeos-maindoor 替代

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';

const mainFirebaseConfig = {
  apiKey: 'AIzaSyB0Hi-OlGqMDfGrIC3TqnYKnyWfwGyzm8Y',
  authDomain: 'lifeos-maindoor.firebaseapp.com',
  databaseURL: 'https://lifeos-maindoor-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'lifeos-maindoor',
  storageBucket: 'lifeos-maindoor.firebasestorage.app',
  messagingSenderId: '315546204047',
  appId: '1:315546204047:web:58c125191fa998d70bbdfa',
  measurementId: 'G-TCRWD0LWE3'
};

export const mainApp = initializeApp(mainFirebaseConfig, 'main');
export const mainDb = getDatabase(mainApp);
