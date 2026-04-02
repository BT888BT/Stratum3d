"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type GalleryImage = {
  id: string; storage_path: string; caption: string | null;
  sort_order: number; visible: boolean; url: string | null;
};

export default function AdminGalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function loadImages() {
    const res = await fetch("/api/admin/gallery");
    if (res.ok) setImages(await res.json());
  }

  useEffect(() => { loadImages(); }, []);

  async function handleUpload() {
    if (!file) { setError("Select an image file."); return; }
    setUploading(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("caption", caption);
    const res = await fetch("/api/admin/gallery", { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Upload failed.");
    } else {
      setFile(null); setCaption("");
      await loadImages();
    }
    setUploading(false);
  }

  async function toggleVisibility(id: string, visible: boolean) {
    setLoading(id);
    await fetch("/api/admin/gallery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, visible: !visible }),
    });
    setImages(imgs => imgs.map(i => i.id === id ? { ...i, visible: !visible } : i));
    setLoading(null);
  }

  async function deleteImage(id: string) {
    if (!confirm("Delete this image permanently?")) return;
    setLoading(id);
    await fetch("/api/admin/gallery", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setImages(imgs => imgs.filter(i => i.id !== id));
    setLoading(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <Link href="/admin/orders" style={{ fontSize: 12, color: "var(--text-dim)", display: "inline-block", marginBottom: 10 }}>← Orders</Link>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Content</p>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 700 }}>Gallery</h1>
        </div>
      </div>

      {/* Upload new */}
      <div className="card">
        <p className="eyebrow" style={{ marginBottom: 16 }}>Add Image</p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Image file (JPEG, PNG, WebP · max 5 MB)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="input-field" style={{ fontSize: 12, padding: "8px 10px" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Caption (optional)</span>
            <input value={caption} onChange={e => setCaption(e.target.value)}
              className="input-field" placeholder="e.g. Custom cosplay helmet — PLA"
              onKeyDown={e => e.key === "Enter" && handleUpload()} />
          </label>
          <button onClick={handleUpload} disabled={uploading || !file}
            className="btn-primary" style={{ flexShrink: 0 }}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {/* Image grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 12,
      }}>
        {images.map(img => (
          <div key={img.id} style={{
            border: "1px solid var(--border-hi)", borderRadius: 10,
            overflow: "hidden", background: "var(--bg2)",
            opacity: loading === img.id ? 0.5 : img.visible ? 1 : 0.5,
            transition: "opacity 0.15s",
          }}>
            {img.url && (
              <div style={{ aspectRatio: "4/3", overflow: "hidden", background: "#111" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption || "Gallery image"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div style={{ padding: "10px 12px" }}>
              {img.caption && (
                <p style={{ fontSize: 12, color: "var(--text)", marginBottom: 8, lineHeight: 1.4 }}>{img.caption}</p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => toggleVisibility(img.id, img.visible)}
                  style={{
                    background: "transparent", border: `1px solid ${img.visible ? "rgba(0,229,160,0.3)" : "rgba(255,90,90,0.3)"}`,
                    borderRadius: 6, padding: "3px 10px", cursor: "pointer",
                    color: img.visible ? "var(--green)" : "var(--red)",
                    fontSize: 11, fontFamily: "var(--font-mono)",
                  }}>
                  {img.visible ? "● Visible" : "○ Hidden"}
                </button>
                <button onClick={() => deleteImage(img.id)}
                  style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 11, padding: "3px 8px" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
                >Delete</button>
              </div>
            </div>
          </div>
        ))}

        {images.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
            No gallery images yet. Upload one above.
          </div>
        )}
      </div>
    </div>
  );
}
