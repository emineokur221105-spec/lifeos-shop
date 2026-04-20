// 主 Firebase 連線（lifeos-shop-main）
// 用途：存租戶清單 + hostname 白名單 hash
// Firebase v11 modular SDK，ES module export

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';

const mainFirebaseConfig = {
  apiKey: 'AIzaSyD4TPDV30efPIni8RYu26RbpQ0yxNmCBpc',
  authDomain: 'lifeos-shop-main.firebaseapp.com',
  databaseURL: 'https://lifeos-shop-main-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'lifeos-shop-main',
  storageBucket: 'lifeos-shop-main.firebasestorage.app',
  messagingSenderId: '283566726785',
  appId: '1:283566726785:web:cd01f9d4a7562f61c8f780',
  measurementId: 'G-DFH2XEQBMP'
};

export const mainApp = initializeApp(mainFirebaseConfig, 'main');
export const mainDb = getDatabase(mainApp);
