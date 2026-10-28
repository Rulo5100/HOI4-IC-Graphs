const fs = require('fs');
const path = require('path');
const conv = require(path.join(__dirname, '..', 'hoi4_bin2txt.js'));
const {meltHoi4, isHoi4Binary} = conv;
const tokens = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hoi4_tokens.json'), 'utf8'));

const savePath = String.raw`C:\Users\Roberts (ME)\Documents\Paradox Interactive\Hearts of Iron IV\save games\autosave.hoi4`;
const buf = new Uint8Array(fs.readFileSync(savePath));

console.time('melt');
const text = meltHoi4(buf, tokens);
console.timeEnd('melt');

const rakalyPath = process.env.TEMP + '\\autosave_melted.hoi4';
if (!fs.existsSync(rakalyPath)) { console.log('No Rakaly output to compare'); process.exit(0); }
const rakalyText = fs.readFileSync(rakalyPath, 'utf8');

const myLines = text.split('\n');
const rkLines = rakalyText.split('\n');

console.log(`My lines: ${myLines.length}, Rakaly lines: ${rkLines.length}`);

let diffs = 0;
const maxCheck = Math.min(myLines.length, rkLines.length, 500000);
for (let i = 0; i < maxCheck; i++) {
    const mine = myLines[i];
    const theirs = rkLines[i];
    if (mine !== theirs) {
        diffs++;
        if (diffs <= 20) {
            console.log(`Line ${i+1} DIFF:`);
            console.log(`  Mine:   "${mine.substring(0,120)}"`);
            console.log(`  Rakaly: "${theirs.substring(0,120)}"`);
        }
    }
}
console.log(`\nTotal diffs in first ${maxCheck} lines: ${diffs}`);
