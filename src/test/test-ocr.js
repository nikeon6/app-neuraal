/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports -- Node script run with `node` */
const fs = require('node:fs');
const path = require('node:path');

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'glm-ocr';
const IMAGE_FILENAME = 'factura_test.jpg';

function resolveImagePath() {
  const candidates = [
    path.join(__dirname, IMAGE_FILENAME),
    path.join(process.cwd(), IMAGE_FILENAME),
    path.join(process.cwd(), 'src', 'test', IMAGE_FILENAME),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function testOCR() {
  try {
    const imagePath = resolveImagePath();
    if (!imagePath) {
      console.error(
        `❌ Image not found. Place "${IMAGE_FILENAME}" in project root or in src/test/`
      );
      process.exit(1);
    }

    console.log(`🔍 Reading image: ${imagePath}...`);
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    console.log('🚀 Sending to Ollama (may take a few seconds)...');
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt:
          'Analyze this image and extract all visible text in a structured format.',
        images: [imageBase64],
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }

    const data = await response.json();
    console.log('\n--- OCR RESULT ---');
    console.log(data.response ?? data);
    console.log('------------------\n');
  } catch (error) {
    const msg = error.message || '';
    const isConnectionRefused =
      error.cause?.code === 'ECONNREFUSED' ||
      error.code === 'ECONNREFUSED' ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('fetch failed');

    if (error.code === 'ENOENT') {
      console.error(`❌ File not found: ${error.path}`);
      process.exit(1);
    }
    if (isConnectionRefused) {
      console.error(
        '❌ Cannot connect to Ollama. Is Docker running and Ollama exposed on port 11434?'
      );
      process.exit(1);
    }
    console.error('❌ Error:', msg);
    process.exit(1);
  }
}

// Top-level await not available in CommonJS
// eslint-disable-next-line sonarjs/prefer-await -- script run with node, no ESM
testOCR();