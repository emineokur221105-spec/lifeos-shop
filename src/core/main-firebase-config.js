// 主 Firebase 連線（lifeos-shop-main）
// 用途：存租戶清單 + hostname 白名單 hash
// Firebase v11 modular SDK，ES module export

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js';

const mainFirebaseConfig = {
  apiKey: 'AIzaSyDsUsWuynci0DP71veuu19Ht8bJmhHSkHs',
  authDomain: 'worktools-f53e5.firebaseapp.com',
  databaseURL: 'https://worktools-f53e5-default-rtdb.firebaseio.com',
  projectId: 'worktools-f53e5',
  storageBucket: 'worktools-f53e5.firebasestorage.app',
  messagingSenderId: '950551082090',
  appId: '1:950551082090:web:3c2c4962b5ffa044aec613',
  measurementId: 'G-EKPY3SC0BR'
};

export const mainApp = initializeApp(mainFirebaseConfig, 'main');
export const mainDb = getDatabase(mainApp);
