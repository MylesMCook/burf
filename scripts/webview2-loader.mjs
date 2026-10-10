// Redistribute only the pinned SDK's architecture-matched native loader.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

export const SDK_VERSION = "1.0.4258.31";
export const SDK_SHA256 = "56f7f4b8bf9aee4b8efefbbdd4f67d5f74ebd1b100ed0806da71bf76af481aa9";
export const LOADER_SHA256 = {
  amd64: "3426dcc55fdfb8b5e7ac623cf33b4ccf283fbf68a0c5a65bddfdb4d749a8abee",
  arm64: "4f48cb32d34298c86cca2108057eea0d900b5e422575e926e8086318a0b9cbf0",
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const url = `https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${SDK_VERSION}/microsoft.web.webview2.${SDK_VERSION}.nupkg`;

// The archive digest is checked before this bounded reader handles fixed names.
function entry(archive, wanted) {
  let end = archive.length - 22;
  const floor = Math.max(0, end - 65535);
  while (end >= floor && archive.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < floor) throw new Error("The pinned WebView2 package has no ZIP directory.");
  const count = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  for (let index = 0; index < count; index++) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid WebView2 ZIP directory.");
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (name === wanted) {
      const size = archive.readUInt32LE(offset + 24);
      const compressed = archive.readUInt32LE(offset + 20);
      const method = archive.readUInt16LE(offset + 10);
      const local = archive.readUInt32LE(offset + 42);
      if (size > 16 * 1024 * 1024 || local + 30 > archive.length || archive.readUInt32LE(local) !== 0x04034b50 || (archive.readUInt16LE(local + 6) & 1)) throw new Error("Invalid WebView2 ZIP entry.");
      const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
      if (start + compressed > archive.length) throw new Error("Truncated WebView2 ZIP entry.");
      const input = archive.subarray(start, start + compressed);
      const output = method === 0 ? input : method === 8 ? inflateRawSync(input, { maxOutputLength: 16 * 1024 * 1024 }) : null;
      if (!output || output.length !== size) throw new Error("Unsupported WebView2 ZIP entry.");
      return output;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`The pinned SDK is missing ${wanted}.`);
}

export function loaderFiles(archive, architecture) {
  if (!(architecture in LOADER_SHA256)) throw new Error("WebView2 supports amd64 or arm64.");
  if (digest(archive) !== SDK_SHA256) throw new Error("WebView2 SDK digest mismatch.");
  const dll = entry(archive, `build/native/${architecture === "amd64" ? "x64" : "arm64"}/WebView2Loader.dll`);
  if (digest(dll) !== LOADER_SHA256[architecture]) throw new Error("WebView2 loader digest mismatch.");
  return { "WebView2Loader.dll": dll, "WebView2-LICENSE.txt": entry(archive, "LICENSE.txt"), "WebView2-NOTICE.txt": entry(archive, "NOTICE.txt") };
}

export async function stageLoader(root, architecture, output, packagePath = process.env.WEBVIEW2_SDK_PACKAGE) {
  const cache = packagePath || join(root, `bin/downloads/microsoft.web.webview2.${SDK_VERSION}.nupkg`);
  if (!existsSync(cache)) {
    if (packagePath) throw new Error(`WEBVIEW2_SDK_PACKAGE does not exist: ${cache}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Could not obtain WebView2 SDK: HTTP ${response.status}.`);
    const archive = Buffer.from(await response.arrayBuffer());
    if (digest(archive) !== SDK_SHA256) throw new Error("Downloaded WebView2 SDK digest mismatch.");
    await mkdir(dirname(cache), { recursive: true });
    await writeFile(cache, archive);
  }
  const files = loaderFiles(await readFile(cache), architecture);
  await mkdir(output, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) await writeFile(join(output, name), bytes);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  await stageLoader(root, process.argv[2], process.argv[3]);
}
