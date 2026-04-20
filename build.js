const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

const SKIP_MINIFY = new Set([
  'firebase-app-compat.js',
  'firebase-database-compat.js',
  'html2canvas.min.js',
]);

// 開關：HTML 內嵌 <script> 是否也進 terser
// 預設開啟。2026-04-20 修正 HTML 註解內假 script 標籤的 regex 誤判問題後已穩定
// 緊急關閉：MINIFY_HTML_INLINE=0 node build.js
const MINIFY_HTML_INLINE = process.env.MINIFY_HTML_INLINE !== '0';

const TERSER_BASE = {
  compress: {
    drop_console: false,
    passes: 2,
  },
  mangle: {
    toplevel: false,
    reserved: ['firebase', 'html2canvas'],
  },
  format: {
    comments: false,
  },
};

async function minifyJsCode(code, isModule) {
  // ⚠️ terser 會把 module/ecma 等鍵寫進 compress / mangle 子物件，
  //    若用 ...TERSER_BASE 淺拷貝會跨檔污染（module:true 的檔會把後續 classic 檔也當 module 做 DCE，把頂層 const 砍光）。
  //    所以這裡每次都 deep-clone，或顯式 re-create 子物件。
  const opts = {
    compress: { ...TERSER_BASE.compress },
    mangle: { ...TERSER_BASE.mangle, reserved: [...TERSER_BASE.mangle.reserved] },
    format: { ...TERSER_BASE.format },
    ecma: 2022,
    module: !!isModule,
  };
  return minify(code, opts);
}

// 找 HTML 裡的 <script>...</script>（排除 <script src="...">），用 terser 混淆內嵌 JS
async function minifyHtmlInlineScripts(html, relPath) {
  // 先清掉 HTML 註解，避免註解裡寫的 `<script>` 字串被當作真的 script tag
  // （例如 weekly.html 有「從 <script type="module"> 內 import」這種說明註解）
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const items = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    items.push({
      full: m[0],
      attrs: m[1] || '',
      body: m[2] || '',
      start: m.index,
      end: m.index + m[0].length,
    });
  }

  let output = '';
  let cursor = 0;
  let countMin = 0;
  let countSkip = 0;

  for (const it of items) {
    output += html.slice(cursor, it.start);
    cursor = it.end;

    const hasSrc = /\bsrc\s*=/i.test(it.attrs);
    if (hasSrc || !it.body.trim()) {
      output += it.full;
      countSkip++;
      continue;
    }

    const isModule = /\btype\s*=\s*["']module["']/i.test(it.attrs);
    try {
      const result = await minifyJsCode(it.body, isModule);
      const minCode = result.code != null ? result.code : it.body;
      output += `<script${it.attrs}>${minCode}</script>`;
      countMin++;
    } catch (err) {
      console.error(`[fail-inline] ${relPath}: ${err.message}`);
      output += it.full;
      countSkip++;
    }
  }
  output += html.slice(cursor);

  console.log(`[html-min] ${relPath} (minified ${countMin}, skipped ${countSkip})`);
  return output;
}

async function rimraf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function walk(srcDir, distDir) {
  fs.mkdirSync(distDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const distPath = path.join(distDir, entry.name);
    const rel = path.relative(SRC, srcPath);

    if (entry.isDirectory()) {
      await walk(srcPath, distPath);
      continue;
    }

    if (entry.name.endsWith('.js') && !SKIP_MINIFY.has(entry.name)) {
      const code = fs.readFileSync(srcPath, 'utf8');
      // 偵測 ES module（core/* 這類），讓 terser 支援 top-level await / import / export
      const isModule = /\b(import|export)\b/.test(code);
      try {
        const result = await minifyJsCode(code, isModule);
        fs.writeFileSync(distPath, result.code || '', 'utf8');
        console.log(`[min] ${rel}${isModule ? ' (module)' : ''}`);
      } catch (err) {
        console.error(`[fail] ${srcPath}: ${err.message}`);
        fs.copyFileSync(srcPath, distPath);
      }
    } else if (entry.name.endsWith('.html')) {
      if (!MINIFY_HTML_INLINE) {
        fs.copyFileSync(srcPath, distPath);
        console.log(`[copy-html] ${rel}（內嵌 script 混淆已關閉）`);
      } else {
        const html = fs.readFileSync(srcPath, 'utf8');
        try {
          const out = await minifyHtmlInlineScripts(html, rel);
          fs.writeFileSync(distPath, out, 'utf8');
        } catch (err) {
          console.error(`[fail-html] ${srcPath}: ${err.message}`);
          fs.copyFileSync(srcPath, distPath);
        }
      }
    } else {
      fs.copyFileSync(srcPath, distPath);
      console.log(`[copy] ${rel}`);
    }
  }
}

(async () => {
  console.log('清空 dist/ ...');
  await rimraf(DIST);

  if (!fs.existsSync(SRC)) {
    console.error('src/ 不存在');
    process.exit(1);
  }

  console.log('開始 build...');
  await walk(SRC, DIST);
  console.log('build 完成 → dist/');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
