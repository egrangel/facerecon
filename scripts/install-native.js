const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Installing high-performance native face detection module...');

// Get correct npm command for Windows
function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function getNodeGypCommand() {
  return process.platform === 'win32' ? 'node-gyp.cmd' : 'node-gyp';
}

// Check if node-gyp is available
function checkNodeGyp() {
  return new Promise((resolve) => {
    const nodeGypCmd = getNodeGypCommand();
    const nodeGyp = spawn(nodeGypCmd, ['--version'], { stdio: 'pipe', shell: true });
    nodeGyp.on('close', (code) => {
      resolve(code === 0);
    });
    nodeGyp.on('error', () => {
      resolve(false);
    });
  });
}

// Install node-addon-api and node-gyp if needed
async function installDependencies() {
  console.log('📦 Installing build dependencies...');

  return new Promise((resolve, reject) => {
    const npmCmd = getNpmCommand();
    exec(`${npmCmd} install node-addon-api node-gyp`, {
      cwd: process.cwd(),
      shell: true
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Failed to install build dependencies:', error.message);
        reject(error);
      } else {
        console.log('✅ Build dependencies installed');
        if (stdout) console.log(stdout);
        resolve();
      }
    });
  });
}

// Build the native module
async function buildNativeModule() {
  console.log('🔨 Building native C++ face detection module...');
  console.log('⚠️  This requires OpenCV to be installed on your system');

  return new Promise((resolve) => {
    const nodeGypCmd = getNodeGypCommand();
    exec(`${nodeGypCmd} rebuild`, {
      cwd: process.cwd(),
      shell: true
    }, (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Native module build failed');
        console.log('🔄 System will fallback to TensorFlow.js (slower but works)');
        console.log('');
        console.log('To enable high-performance detection:');
        console.log('1. Install OpenCV: https://opencv.org/releases/');
        console.log('2. Install Visual Studio Build Tools');
        console.log('3. Update paths in binding.gyp');
        console.log('4. Run: npm run build:native');
        console.log('');
        console.log('Error details:', error.message);
        if (stderr) console.log('Stderr:', stderr);
      } else {
        console.log('🎉 Native module built successfully!');
        console.log('⚡ High-performance face detection is now available');
        if (stdout) console.log(stdout);
      }
      resolve(); // Don't fail the entire installation
    });
  });
}

// Main installation process
async function main() {
  try {
    // Check if binding.gyp exists
    if (!fs.existsSync('binding.gyp')) {
      console.log('⚠️  binding.gyp not found - native module not configured');
      console.log('📝 Run the face detection setup first');
      return;
    }

    // Install dependencies
    await installDependencies();

    // Build native module
    await buildNativeModule();

    console.log('');
    console.log('🚀 Setup complete! Your system now has:');
    console.log('   - C++ native face detection (if build succeeded)');
    console.log('   - TensorFlow.js fallback (always available)');
    console.log('   - Automatic performance optimization');

  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    console.log('🔄 System will use TensorFlow.js fallback');
  }
}

main();