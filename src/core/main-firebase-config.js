// 主 Firebase 連線（lifeos-shop-main）
// 用途：存租戶清單 + hostname 白名單 hash
// Firebase v11 modular SDK，ES module export

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';

const mainFirebaseConfig = {
  apiKey: 'AIzaSyA-pdZT_sEwwB0nrOgq0-JtugyPx9Be6Qk',
  authDomain: 'shop-system-v2.firebaseapp.com',
  databaseURL: 'https://shop-system-v2-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'shop-system-v2',
  storageBucket: 'shop-system-v2.firebasestorage.app',
  messagingSenderId: '861911239688',
  appId: '1:861911239688:web:396e6a495b194de9c515bd',
  measurementId: 'G-NPF5TH4Z15'
};

export const mainApp = initializeApp(mainFirebaseConfig, 'main');
export const mainDb = getDatabase(mainApp);
