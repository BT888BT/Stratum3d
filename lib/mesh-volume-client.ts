/**
 * Browser-compatible STL volume calculation.
 * Uses ArrayBuffer directly — no Node Buffer dependency.
 *
 * Divergence theorem: for each triangle (A, B, C):
 *   signedVol = (A · (B × C)) / 6
 * Sum and abs() → total solid volume in mm³.
 */

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
function volumeFromBinarySTL(ab: ArrayBuffer): number {
  const view = new DataView(ab);
  const triCount = view.getUint32(80, true);
  let vol = 0;
  let offset = 84;
  for (let i = 0; i < triCount; i++) {
    offset += 12; // skip normal
    const ax = view.getFloat32(offset,      true); const ay = view.getFloat32(offset + 4,  true); const az = view.getFloat32(offset + 8,  true);
    const bx = view.getFloat32(offset + 12, true); const by = view.getFloat32(offset + 16, true); const bz = view.getFloat32(offset + 20, true);
    const cx = view.getFloat32(offset + 24, true); const cy = view.getFloat32(offset + 28, true); const cz = view.getFloat32(offset + 32, true);
    offset += 36 + 2;
    vol += signedTriVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  return Math.abs(vol);
}

// ── ASCII STL ────────────────────────────────────────────────────────────────
function volumeFromASCIISTL(text: string): number {
  const re = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;
  const verts: [number, number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    verts.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
  }
  let vol = 0;
  for (let i = 0; i + 2 < verts.length; i += 3) {
    const [ax, ay, az] = verts[i];
    const [bx, by, bz] = verts[i + 1];
    const [cx, cy, cz] = verts[i + 2];
    vol += signedTriVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  return Math.abs(vol);
}

/**
 * Calculate volume from an STL file's ArrayBuffer.
 * Works in the browser — no Node dependencies.
 */
export function extractVolumeMm3FromArrayBuffer(ab: ArrayBuffer, filename: string): number {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "stl") {
    // Check if binary or ASCII STL
    const view = new DataView(ab);
    const triCount = view.getUint32(80, true);
    const expectedBinarySize = 84 + triCount * 50;
    const isBinary = Math.abs(ab.byteLength - expectedBinarySize) < 100;

    if (isBinary) {
      return volumeFromBinarySTL(ab);
    } else {
      const text = new TextDecoder().decode(ab);
      return volumeFromASCIISTL(text);
    }
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

/**
 * Calculate volume from a File object (async — reads file first).
 */
export async function extractVolumeMm3FromFile(file: File): Promise<number> {
  const ab = await file.arrayBuffer();
  return extractVolumeMm3FromArrayBuffer(ab, file.name);
}
