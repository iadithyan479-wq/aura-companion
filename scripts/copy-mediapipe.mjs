import { cp, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const target = path.join(root, "client/public/mediapipe/wasm");
await access(source);
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log("Copied MediaPipe's WebAssembly runtime into the static public assets.");
