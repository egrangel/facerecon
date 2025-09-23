const https = require('https');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(process.cwd(), 'models', 'face_detection');

// Ensure models directory exists
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const models = [
  {
    name: 'deploy.prototxt',
    url: 'https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt',
    path: path.join(modelsDir, 'deploy.prototxt')
  },
  {
    name: 'res10_300x300_ssd_iter_140000.caffemodel',
    url: 'https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel',
    path: path.join(modelsDir, 'res10_300x300_ssd_iter_140000.caffemodel')
  }
];

function downloadFile(url, filepath, name) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${name}...`);

    const file = fs.createWriteStream(filepath);

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded ${name} (${fs.statSync(filepath).size} bytes)`);
          resolve();
        });
      } else {
        console.error(`❌ Failed to download ${name}: HTTP ${response.statusCode}`);
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      console.error(`❌ Download error for ${name}:`, err.message);
      fs.unlink(filepath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

async function downloadModels() {
  console.log('🚀 Downloading OpenCV DNN face detection models...');
  console.log(`📁 Target directory: ${modelsDir}`);

  try {
    for (const model of models) {
      if (fs.existsSync(model.path)) {
        console.log(`⏭️  Skipping ${model.name} (already exists)`);
      } else {
        await downloadFile(model.url, model.path, model.name);
      }
    }

    console.log('\n🎉 All models downloaded successfully!');
    console.log('📊 Model files:');

    models.forEach(model => {
      if (fs.existsSync(model.path)) {
        const stats = fs.statSync(model.path);
        console.log(`  ✅ ${model.name}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      }
    });

    console.log('\n💡 You can now use deep learning face detection!');
    console.log('🔧 Run: node test-simple-native.js <image> (will auto-use DNN)');

  } catch (error) {
    console.error('❌ Download failed:', error.message);
    console.log('\n🔄 The system will fallback to Haar cascade if DNN models are missing');
  }
}

downloadModels();