/**
 * Volume + bounding-box calculation using the divergence theorem.
 * For each triangle (A, B, C): signedVol = (A · (B × C)) / 6
 * Sum and abs() → total solid volume in mm³.
 * heightMm is the Z-axis extent (max Z − min Z), used for height-based pricing.
 */

export type MeshData = { volumeMm3: number; heightMm: number };

function signedTriVolume(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number
): number {
  return (
    ax * (by * cz - bz * cy) +
    ay * (bz * cx - bx * cz) +
    az * (bx * cy - by * cx)
  ) / 6;
}

// ── Binary STL ───────────────────────────────────────────────────────────────
function meshDataFromBinarySTL(buf: ArrayBuffer): MeshData {
  const view = new DataView(buf);
  const triCount = view.getUint32(80, true);
  let vol = 0;
  let minZ = Infinity, maxZ = -Infinity;
  let offset = 84;
  for (let i = 0; i < triCount; i++) {
    offset += 12; // skip normal
    const ax = view.getFloat32(offset,      true); const ay = view.getFloat32(offset + 4,  true); const az = view.getFloat32(offset + 8,  true);
    const bx = view.getFloat32(offset + 12, true); const by = view.getFloat32(offset + 16, true); const bz = view.getFloat32(offset + 20, true);
    const cx = view.getFloat32(offset + 24, true); const cy = view.getFloat32(offset + 28, true); const cz = view.getFloat32(offset + 32, true);
    offset += 36 + 2;
    vol += signedTriVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
    if (az < minZ) minZ = az; if (az > maxZ) maxZ = az;
    if (bz < minZ) minZ = bz; if (bz > maxZ) maxZ = bz;
    if (cz < minZ) minZ = cz; if (cz > maxZ) maxZ = cz;
  }
  return { volumeMm3: Math.abs(vol), heightMm: isFinite(maxZ) ? maxZ - minZ : 0 };
}

function volumeFromBinarySTL(buf: ArrayBuffer): number {
  return meshDataFromBinarySTL(buf).volumeMm3;
}

// ── ASCII STL ────────────────────────────────────────────────────────────────
function meshDataFromASCIISTL(text: string): MeshData {
  const re = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;
  const verts: [number, number, number][] = [];
  let m: RegExpExecArray | null;
  let minZ = Infinity, maxZ = -Infinity;
  while ((m = re.exec(text)) !== null) {
    const z = parseFloat(m[3]);
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    verts.push([parseFloat(m[1]), parseFloat(m[2]), z]);
  }
  let vol = 0;
  for (let i = 0; i + 2 < verts.length; i += 3) {
    const [ax, ay, az] = verts[i];
    const [bx, by, bz] = verts[i + 1];
    const [cx, cy, cz] = verts[i + 2];
    vol += signedTriVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  return { volumeMm3: Math.abs(vol), heightMm: isFinite(maxZ) ? maxZ - minZ : 0 };
}

function volumeFromASCIISTL(text: string): number {
  return meshDataFromASCIISTL(text).volumeMm3;
}

// ── OBJ ──────────────────────────────────────────────────────────────────────
function volumeFromOBJ(text: string): number {
  const verts: [number, number, number][] = [];
  let vol = 0;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t.startsWith("v ")) {
      const [, x, y, z] = t.split(/\s+/);
      verts.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
    } else if (t.startsWith("f ")) {
      const idxs = t.split(/\s+/).slice(1).map(p => parseInt(p.split("/")[0]) - 1);
      for (let i = 1; i + 1 < idxs.length; i++) {
        const [ax, ay, az] = verts[idxs[0]];
        const [bx, by, bz] = verts[idxs[i]];
        const [cx, cy, cz] = verts[idxs[i + 1]];
        vol += signedTriVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
      }
    }
  }
  return Math.abs(vol);
}

// ── 3MF ──────────────────────────────────────────────────────────────────────
function volumeFrom3MFXml(xml: string): number {
  const verts: [number, number, number][] = [];
  const vertRe = /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = vertRe.exec(xml)) !== null) {
    verts.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
  }
  let vol = 0;
  const triRe = /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g;
  while ((m = triRe.exec(xml)) !== null) {
    const [ax, ay, az] = verts[parseInt(m[1])];
    const [bx, by, bz] = verts[parseInt(m[2])];
    const [cx, cy, cz] = verts[parseInt(m[3])];
    vol += signedTriVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  return Math.abs(vol);
}

function volumeFrom3MF(buf: ArrayBuffer): number {
  const bytes = new Uint8Array(buf);
  const marker = "<vertices>";
  const markerBytes = Array.from(marker).map(c => c.charCodeAt(0));
  let xmlStart = -1;
  outer: for (let i = 0; i < bytes.length - markerBytes.length; i++) {
    for (let j = 0; j < markerBytes.length; j++) {
      if (bytes[i + j] !== markerBytes[j]) continue outer;
    }
    xmlStart = i; break;
  }
  if (xmlStart === -1) throw new Error("Could not parse 3MF — try converting to STL.");
  const endMarker = "</mesh>";
  let xmlEnd = bytes.length;
  const endBytes = Array.from(endMarker).map(c => c.charCodeAt(0));
  for (let i = xmlStart; i < bytes.length - endBytes.length; i++) {
    let match = true;
    for (let j = 0; j < endBytes.length; j++) {
      if (bytes[i + j] !== endBytes[j]) { match = false; break; }
    }
    if (match) { xmlEnd = i + endBytes.length; break; }
  }
  const xml = new TextDecoder().decode(bytes.slice(xmlStart - 50, xmlEnd));
  return volumeFrom3MFXml(xml);
}

// ── Main: accepts pre-read Buffer (avoids double arrayBuffer() consumption) ──

export function extractMeshDataFromBuffer(buffer: Buffer, filename: string): MeshData {
  const ext = filename.split(".").pop()?.toLowerCase();
  const bytes = new Uint8Array(buffer);
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  if (ext === "stl") {
    const view = new DataView(ab);
    const triCount = view.getUint32(80, true);
    const expectedBinarySize = 84 + triCount * 50;
    const isBinary = Math.abs(buffer.length - expectedBinarySize) < 100;
    return isBinary
      ? meshDataFromBinarySTL(ab)
      : meshDataFromASCIISTL(new TextDecoder().decode(ab));
  }

  // For OBJ/3MF, height extraction is not implemented — fall back to volume only
  return { volumeMm3: extractVolumeMm3FromBuffer(buffer, filename), heightMm: 0 };
}

export function extractVolumeMm3FromBuffer(buffer: Buffer, filename: string): number {
  const ext = filename.split(".").pop()?.toLowerCase();
  // Convert Buffer → ArrayBuffer safely. In newer @types/node (v22+), Buffer.buffer
  // returns ArrayBuffer | SharedArrayBuffer which is not assignable to ArrayBuffer.
  // Using the ArrayBuffer constructor with a Uint8Array source creates a clean copy.
  const bytes = new Uint8Array(buffer);
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  if (ext === "stl") {
    // Check if ASCII STL (starts with "solid" text, not binary)
    const header = new TextDecoder().decode(new Uint8Array(ab, 0, 80));
    // Binary STL may also start with "solid" in header — check triangle count vs file size
    const view = new DataView(ab);
    const triCount = view.getUint32(80, true);
    const expectedBinarySize = 84 + triCount * 50;
    const isBinary = Math.abs(buffer.length - expectedBinarySize) < 100;

    if (isBinary) {
      return volumeFromBinarySTL(ab);
    } else {
      const text = new TextDecoder().decode(ab);
      return volumeFromASCIISTL(text);
    }
  }

  if (ext === "obj") {
    return volumeFromOBJ(new TextDecoder().decode(ab));
  }

  if (ext === "3mf") {
    return volumeFrom3MF(ab);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

// Keep async version for backwards compat if needed elsewhere
export async function extractVolumeMm3(file: File): Promise<number> {
  const ab = await file.arrayBuffer();
  const buffer = Buffer.from(ab);
  return extractVolumeMm3FromBuffer(buffer, file.name);
}
