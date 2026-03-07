const fs = require('fs');
const path = require('path');

const projectRoot = 'c:\\zapzapdelivery2';
const oldDir = path.join(projectRoot, 'src', 'app', 'estabelecimentoss');
const newDir = path.join(projectRoot, 'src', 'app', 'estabelecimentos');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Try to Rename, if fail, Copy
if (fs.existsSync(oldDir)) {
  if (!fs.existsSync(newDir)) {
    console.log(`Attempting to rename ${oldDir} to ${newDir}`);
    try {
      fs.renameSync(oldDir, newDir);
      console.log('Directory renamed successfully.');
    } catch (err) {
      console.log('Rename failed (locked?), attempting to copy instead...');
      try {
        copyDir(oldDir, newDir);
        console.log('Directory copied successfully.');
        // Try to remove old dir, but ignore error if locked
        try {
          fs.rmSync(oldDir, { recursive: true, force: true });
          console.log('Old directory removed.');
        } catch (rmErr) {
          console.warn('Could not remove old directory (likely locked). Please remove manually:', oldDir);
        }
      } catch (cpErr) {
        console.error('Copy failed:', cpErr);
        process.exit(1);
      }
    }
  } else {
    console.log(`Directory ${newDir} already exists. Skipping rename/copy.`);
  }
} else {
  console.log(`Directory ${oldDir} does not exist. Skipping rename.`);
}

// 2. Replace content in files
function replaceInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('estabelecimentoss')) {
      const newContent = content.replace(/estabelecimentoss/g, 'estabelecimentos');
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated references in ${filePath}`);
    }
  } catch (err) {
    console.error(`Error processing file ${filePath}:`, err);
  }
}

function traverseDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
            traverseDir(filePath);
        }
        } else {
        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.json') || filePath.endsWith('.md')) {
            replaceInFile(filePath);
        }
        }
    } catch (e) {
        // ignore errors accessing files
    }
  }
}

console.log('Starting content replacement...');
traverseDir(path.join(projectRoot, 'src'));
console.log('Content replacement completed.');
