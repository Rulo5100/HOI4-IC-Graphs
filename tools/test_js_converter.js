const fs = require('fs');
const path = require('path');

// Load converter
const conv = require(path.join(__dirname, '..', 'hoi4_bin2txt.js'));
const {meltHoi4, isHoi4Binary} = conv;

// Load token dictionary
const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hoi4_tokens.json'), 'utf8'));

// Load binary save
const savePath = String.raw`C:\Users\Roberts (ME)\Documents\Paradox Interactive\Hearts of Iron IV\save games\autosave.hoi4`;
const buf = new Uint8Array(fs.readFileSync(savePath));

console.log(`Save size: ${buf.length} bytes`);
console.log(`Is binary: ${isHoi4Binary(buf)}`);

// Convert
console.time('melt');
const text = meltHoi4(buf, tokens);
console.timeEnd('melt');

console.log(`Output size: ${text.length} chars`);

// Show first 40 lines
const lines = text.split('\n');
console.log(`Total lines: ${lines.length}`);
console.log('\n=== First 40 lines ===');
console.log(lines.slice(0, 40).join('\n'));

// Compare with rakaly melted output
const rakalyPath = process.env.TEMP + '\\autosave_melted.hoi4';
if (fs.existsSync(rakalyPath)) {
    const rakalyText = fs.readFileSync(rakalyPath, 'utf8');
    const rakalyLines = rakalyText.split('\n');
    console.log('\n=== Comparison with Rakaly (first 30 lines) ===');
    for (let i = 0; i < 30; i++) {
        const mine = (lines[i] || '').trim();
        const theirs = (rakalyLines[i] || '').trim();
        const match = mine === theirs ? 'OK' : 'DIFF';
        if (match === 'DIFF') {
            console.log(`Line ${i+1} ${match}:`);
            console.log(`  Mine:   "${mine}"`);
            console.log(`  Rakaly: "${theirs}"`);
        } else {
            console.log(`Line ${i+1} OK: ${mine}`);
        }
    }
}
