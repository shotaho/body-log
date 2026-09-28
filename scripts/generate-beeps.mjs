// レストタイマー用のビープ音(WAV, 16bit mono)を生成する。
// 実行: node scripts/generate-beeps.mjs
import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';

function beep(file, { freq, seconds, volume = 0.6 }) {
  const rate = 22050;
  const n = Math.floor(rate * seconds);
  const data = Buffer.alloc(n * 2);
  const fade = Math.floor(rate * 0.01); // クリックノイズを避けるため前後 10ms でフェード
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / fade, (n - 1 - i) / fade);
    const sample = Math.sin((2 * Math.PI * freq * i) / rate) * volume * env;
    data.writeInt16LE(Math.round(sample * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
}

// 残り10秒: 短く低め / 0秒: 長く高め
beep('assets/sounds/rest-warning.wav', { freq: 880, seconds: 0.15 });
beep('assets/sounds/rest-end.wav', { freq: 1320, seconds: 0.5 });
