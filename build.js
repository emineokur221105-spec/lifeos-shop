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

const TERSER_OPTIONS = {
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

    if (entry.isDirectory()) {
      await walk(srcPath, distPath);
      continue;
    }

    if (entry.name.endsWith('.js') && !SKIP_MINIFY.has(entry.name)) {
      const code = fs.readFileSync(srcPath, 'utf8');
      try {
        const result = await minify(code, TERSER_OPTIONS);
        fs.writeFileSync(distPath, result.code || '', 'utf8');
        console.log(`[min] ${path.relative(SRC, srcPath)}`);
      } catch (err) {
        console.error(`[fail] ${srcPath}: ${err.message}`);
        fs.copyFileSync(srcPath, distPath);
      }
    } else {
      fs.copyFileSync(srcPath, distPath);
      console.log(`[copy] ${path.relative(SRC, srcPath)}`);
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
