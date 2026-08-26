import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".svg",
  ".ts",
  ".tsx",
]);

const CP1252_SPECIAL_BYTES = new Map([
  ["\u20ac", 0x80],
  ["\u201a", 0x82],
  ["\u0192", 0x83],
  ["\u201e", 0x84],
  ["\u2026", 0x85],
  ["\u2020", 0x86],
  ["\u2021", 0x87],
  ["\u02c6", 0x88],
  ["\u2030", 0x89],
  ["\u0160", 0x8a],
  ["\u2039", 0x8b],
  ["\u0152", 0x8c],
  ["\u017d", 0x8e],
  ["\u2018", 0x91],
  ["\u2019", 0x92],
  ["\u201c", 0x93],
  ["\u201d", 0x94],
  ["\u2022", 0x95],
  ["\u2013", 0x96],
  ["\u2014", 0x97],
  ["\u02dc", 0x98],
  ["\u2122", 0x99],
  ["\u0161", 0x9a],
  ["\u203a", 0x9b],
  ["\u0153", 0x9c],
  ["\u017e", 0x9e],
  ["\u0178", 0x9f],
]);

const decoder = new TextDecoder("utf-8", { fatal: true });

function cp1252Byte(character) {
  const codePoint = character.codePointAt(0);
  if (codePoint <= 0x7f || (codePoint >= 0xa0 && codePoint <= 0xff)) {
    return codePoint;
  }
  if (codePoint >= 0x80 && codePoint <= 0x9f) {
    return codePoint;
  }
  return CP1252_SPECIAL_BYTES.get(character);
}

function sequenceLength(firstByte) {
  if (firstByte >= 0xc2 && firstByte <= 0xdf) return 2;
  if (firstByte >= 0xe0 && firstByte <= 0xef) return 3;
  if (firstByte >= 0xf0 && firstByte <= 0xf4) return 4;
  return 0;
}

function repairPass(input) {
  const characters = Array.from(input);
  let output = "";
  let repaired = 0;

  for (let index = 0; index < characters.length; index += 1) {
    const firstByte = cp1252Byte(characters[index]);
    const length = firstByte === undefined ? 0 : sequenceLength(firstByte);
    if (length === 0 || index + length > characters.length) {
      output += characters[index];
      continue;
    }

    const bytes = [firstByte];
    let valid = true;
    for (let offset = 1; offset < length; offset += 1) {
      const byte = cp1252Byte(characters[index + offset]);
      if (byte === undefined || byte < 0x80 || byte > 0xbf) {
        valid = false;
        break;
      }
      bytes.push(byte);
    }

    if (!valid) {
      output += characters[index];
      continue;
    }

    try {
      output += decoder.decode(Uint8Array.from(bytes));
      index += length - 1;
      repaired += 1;
    } catch {
      output += characters[index];
    }
  }

  return { output, repaired };
}

function repairMojibake(input) {
  let output = input;
  let repaired = 0;

  for (let pass = 0; pass < 3; pass += 1) {
    const result = repairPass(output);
    output = result.output;
    repaired += result.repaired;
    if (result.repaired === 0) break;
  }

  return { output, repaired };
}

function collectFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return TEXT_EXTENSIONS.has(path.extname(target)) ? [target] : [];

  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    return entry.isDirectory() ? collectFiles(child) : collectFiles(child);
  });
}

const files = [
  ...collectFiles(path.join(ROOT, "src")),
  ...collectFiles(path.join(ROOT, "public")),
  path.join(ROOT, "index.html"),
];

let affectedFiles = 0;
let repairedSequences = 0;

for (const file of files) {
  const input = fs.readFileSync(file, "utf8");
  const result = repairMojibake(input);
  if (result.repaired === 0) continue;

  affectedFiles += 1;
  repairedSequences += result.repaired;
  console.log(`${path.relative(ROOT, file)}: ${result.repaired} sequence(s)`);
  if (WRITE) fs.writeFileSync(file, result.output, "utf8");
}

if (affectedFiles === 0) {
  console.log("No repairable mojibake found.");
  process.exit(0);
}

const action = WRITE ? "Repaired" : "Found";
console.log(`${action} ${repairedSequences} sequence(s) in ${affectedFiles} file(s).`);
if (!WRITE) process.exit(1);
