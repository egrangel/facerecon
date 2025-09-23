const { exec } = require('child_process');

console.log('📦 Installing native module dependencies...');

// Get correct npm command for Windows
function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

// Install required dependencies
async function installDependencies() {
  const npmCmd = getNpmCommand();
  const packages = ['node-addon-api', 'node-gyp'];

  console.log(`Installing: ${packages.join(', ')}`);

  return new Promise((resolve, reject) => {
    exec(`${npmCmd} install ${packages.join(' ')}`, {
      cwd: process.cwd(),
      shell: true
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Failed to install dependencies:', error.message);
        reject(error);
      } else {
        console.log('✅ Dependencies installed successfully');
        if (stdout) console.log(stdout);
        resolve();
      }
    });
  });
}

installDependencies()
  .then(() => {
    console.log('');
    console.log('🎯 Next steps to enable high-performance detection:');
    console.log('1. Install OpenCV: https://opencv.org/releases/');
    console.log('2. Install Visual Studio Build Tools (Windows)');
    console.log('3. Run: npm run build:native');
    console.log('');
    console.log('💡 The system will work with TensorFlow.js fallback if native build fails');
  })
  .catch((error) => {
    console.error('Installation failed:', error.message);
    process.exit(1);
  });