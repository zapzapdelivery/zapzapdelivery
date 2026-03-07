const fs = require('fs');
const path = require('path');

const projectRoot = 'c:\\zapzapdelivery2';
const oldApiDir = path.join(projectRoot, 'src', 'app', 'api', 'estabelecimentoss');
const newApiDir = path.join(projectRoot, 'src', 'app', 'api', 'estabelecimentos');

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

if (fs.existsSync(oldApiDir)) {
  if (!fs.existsSync(newApiDir)) {
    console.log(`Attempting to rename API directory ${oldApiDir} to ${newApiDir}`);
    try {
      fs.renameSync(oldApiDir, newApiDir);
      console.log('API Directory renamed successfully.');
    } catch (err) {
      console.log('API Rename failed, attempting to copy...');
      try {
        copyDir(oldApiDir, newApiDir);
        console.log('API Directory copied successfully.');
        try {
          fs.rmSync(oldApiDir, { recursive: true, force: true });
          console.log('Old API directory removed.');
        } catch (rmErr) {
          console.warn('Could not remove old API directory (locked?):', oldApiDir);
        }
      } catch (cpErr) {
        console.error('API Copy failed:', cpErr);
        process.exit(1);
      }
    }
  } else {
    console.log(`API Directory ${newApiDir} already exists. Skipping.`);
  }
} else {
  console.log(`API Directory ${oldApiDir} does not exist. Skipping.`);
}
