#!/usr/bin/env node

/**
 * Audio Upload Helper for Swagger Testing
 * 
 * Usage:
 *   node test-audio-upload.js <mp3-file-path> [sessionId] [always-listen]
 * 
 * Example:
 *   node test-audio-upload.js "libs/ttsMP3.com_VoiceText_2026-2-12_22-22-3.mp3" test-123 true
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const args = process.argv.slice(2);
const inputFile = args[0];
const sessionId = args[1] || 'test-123';
const alwaysListen = args[2] === 'true';

if (!inputFile) {
  console.error('Usage: node test-audio-upload.js <mp3-or-wav-file> [sessionId] [always-listen]');
  process.exit(1);
}

const apiBaseUrl = 'http://localhost:3000';

async function run() {
  try {
    // Validate file exists
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ File not found: ${inputFile}`);
      process.exit(1);
    }

    const fileName = path.basename(inputFile);
    console.log(`📁 Input file: ${fileName}`);
    console.log(`🎯 Session ID: ${sessionId}`);
    console.log(`🎤 Always-Listen: ${alwaysListen}`);

    // Step 1: Enable always-listen if requested
    if (alwaysListen) {
      console.log('\n📍 Step 1: Enable always-listen mode...');
      const alwaysListenRes = await axios.post(`${apiBaseUrl}/audio-processing/always-listen`, {
        sessionId,
        enabled: true,
      });
      console.log(`✅ Always-listen enabled:`, alwaysListenRes.data);
    }

    // Step 2: Upload file
    console.log('\n📍 Step 2: Upload audio file...');
    const form = new FormData();
    form.append('sessionId', sessionId);
    form.append('file', fs.createReadStream(inputFile));

    const uploadRes = await axios.post(`${apiBaseUrl}/audio-processing/chunk-file`, form, {
      headers: form.getHeaders(),
    });

    console.log(`✅ Audio processed:`, uploadRes.data);

    if (uploadRes.data.transcript) {
      console.log(`\n📝 Transcription: "${uploadRes.data.transcript}"`);
      console.log(`✅ Final: ${uploadRes.data.isFinal}`);

      // Detect wake word in transcript
      const transcript = uploadRes.data.transcript.toLowerCase();
      if (transcript.includes('hey eleni') || transcript.includes('hey, eleni') || transcript.includes('hey elena')) {
        console.log(`\n🔔 Wake word detected! Next utterance will be transcribed.`);
      }
    }
  } catch (error) {
    if (error.response) {
      console.error(`❌ API Error [${error.response.status}]:`, error.response.data);
    } else {
      console.error(`❌ Error:`, error.message);
    }
    process.exit(1);
  }
}

run();
