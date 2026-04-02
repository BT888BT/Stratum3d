"use client";

import { useState, useEffect, useCallback } from "react";

type GalleryImage = {
  id: string;
  caption: string | null;
  url: string;
};

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/gallery")
      .then(r => r.json())
      .then((data: GalleryImage[]) => { setImages(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    setCurrent(c => (c - 1 + images.length) % images.length);
  }, [images.length]);

  // Auto-advance every 5 seconds
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, images.length]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [next, prev]);

  if (!loaded) {
    return (
      <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading gallery...</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 40, opacity: 0.3 }}>📷</span>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No images in the gallery yet.</p>
      </div>
    );
  }

  const img = images[current];

  return (
    <div>
      <div style={{ marginBottom: "clamp(20px, 3vw, 32px)" }}>
        <span className="eyebrow" style={{ marginBottom: 10 }}>Our Work</span>
        <h1 className="font-display" style={{ fontSize: "clamp(36px, 5vw, 60px)", marginBottom: 8 }}>GALLERY</h1>
        <p style={{ color: "var(--text-dim)", fontSize: "clamp(13px, 1.5vw, 15px)" }}>
          A selection of recent prints from our workshop.
        </p>
      </div>

      {/* Carousel */}
      <div style={{
        position: "relative",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--border-hi)",
        background: "#0a0806",
      }}>
        {/* Main image */}
        <div style={{
          aspectRatio: "16/9",
          maxHeight: 520,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={img.id}
            src={img.url}
            alt={img.caption || "3D printed part"}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              animation: "fadeIn 0.3s ease",
            }}
          />
        </div>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button onClick={prev} style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%",
              width: 40, height: 40, color: "#fff", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(8px)", transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.6)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.5)")}
            >‹</button>
            <button onClick={next} style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%",
              width: 40, height: 40, color: "#fff", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(8px)", transition: "background 0.15s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.6)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.5)")}
            >›</button>
          </>
        )}

        {/* Caption bar */}
        <div style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}>
          <p style={{ fontSize: 13, color: img.caption ? "var(--text)" : "var(--muted)", margin: 0 }}>
            {img.caption || "Untitled"}
          </p>
          {images.length > 1 && (
            <span className="font-mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              {current + 1} / {images.length}
            </span>
          )}
        </div>
      </div>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} style={{
              width: i === current ? 24 : 8,
              height: 8,
              borderRadius: 4,
              border: "none",
              background: i === current ? "var(--orange)" : "var(--border-hi)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              padding: 0,
            }} />
          ))}
        </div>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div style={{
          display: "flex",
          gap: 8,
          marginTop: 20,
          overflowX: "auto",
          paddingBottom: 8,
        }}>
          {images.map((thumb, i) => (
            <button key={thumb.id} onClick={() => setCurrent(i)} style={{
              flexShrink: 0,
              width: 80, height: 60,
              borderRadius: 6,
              overflow: "hidden",
              border: i === current ? "2px solid var(--orange)" : "2px solid transparent",
              cursor: "pointer",
              opacity: i === current ? 1 : 0.5,
              transition: "all 0.2s ease",
              padding: 0,
              background: "#0a0806",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
