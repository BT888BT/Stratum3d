"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type GalleryImage = {
  id: string;
  caption: string | null;
  url: string;
};

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [sliding, setSliding] = useState<"left" | "right" | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/gallery")
      .then(r => r.json())
      .then((data: GalleryImage[]) => { setImages(data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (images.length > 1) {
      timerRef.current = setInterval(() => {
        setSliding("left");
        setTimeout(() => {
          setCurrent(c => (c + 1) % images.length);
          setSliding(null);
        }, 300);
      }, 5000);
    }
  }, [images.length]);

  const goNext = useCallback(() => {
    setSliding("left");
    setTimeout(() => {
      setCurrent(c => (c + 1) % images.length);
      setSliding(null);
    }, 300);
    resetTimer();
  }, [images.length, resetTimer]);

  const goPrev = useCallback(() => {
    setSliding("right");
    setTimeout(() => {
      setCurrent(c => (c - 1 + images.length) % images.length);
      setSliding(null);
    }, 300);
    resetTimer();
  }, [images.length, resetTimer]);

  // Auto-advance
  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  if (!loaded) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading gallery...</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 40, opacity: 0.3 }}>📷</span>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No images in the gallery yet.</p>
      </div>
    );
  }

  const getIndex = (offset: number) => (current + offset + images.length) % images.length;
  const prevImg = images.length > 1 ? images[getIndex(-1)] : null;
  const currImg = images[current];
  const nextImg = images.length > 1 ? images[getIndex(1)] : null;

  const slideTransform = sliding === "left"
    ? "translateX(-8%)"
    : sliding === "right"
    ? "translateX(8%)"
    : "translateX(0)";

  return (
    <div>
      <div style={{ marginBottom: "clamp(20px, 3vw, 32px)", textAlign: "center" }}>
        <span className="eyebrow" style={{ marginBottom: 10 }}>Our Work</span>
        <h1 className="font-display" style={{ fontSize: "clamp(36px, 5vw, 60px)", marginBottom: 8 }}>GALLERY</h1>
        <p style={{ color: "var(--text-dim)", fontSize: "clamp(13px, 1.5vw, 15px)" }}>
          A selection of recent prints from our workshop.
        </p>
      </div>

      {/* 3-image carousel */}
      <div style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(8px, 2vw, 20px)",
        minHeight: "clamp(280px, 50vw, 500px)",
        overflow: "hidden",
        padding: "0 50px",
        transform: slideTransform,
        transition: sliding ? "transform 0.3s ease" : "none",
      }}>

        {/* Left small image */}
        {prevImg && (
          <div onClick={goPrev} style={{
            flexShrink: 0,
            width: "clamp(80px, 18vw, 180px)",
            height: "clamp(80px, 18vw, 180px)",
            borderRadius: 10,
            overflow: "hidden",
            opacity: 0.4,
            cursor: "pointer",
            transition: "opacity 0.2s, transform 0.2s",
            filter: "brightness(0.6)",
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.transform = "scale(1.03)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.transform = "scale(1)"; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={prevImg.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        )}

        {/* Center main image */}
        <div style={{
          flexShrink: 0,
          width: "clamp(240px, 50vw, 600px)",
          maxHeight: "clamp(280px, 50vw, 500px)",
          borderRadius: 14,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={currImg.id}
            src={currImg.url}
            alt={currImg.caption || "3D printed part"}
            style={{
              width: "100%",
              height: "auto",
              maxHeight: "clamp(280px, 50vw, 500px)",
              objectFit: "contain",
              display: "block",
            }}
          />

          {/* Caption overlay — only show if there's text */}
          {currImg.caption && (
            <div style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0,
              background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
              padding: "24px 20px 14px",
            }}>
              <p style={{ margin: 0, fontSize: 13, color: "#eee" }}>{currImg.caption}</p>
            </div>
          )}
        </div>

        {/* Right small image */}
        {nextImg && (
          <div onClick={goNext} style={{
            flexShrink: 0,
            width: "clamp(80px, 18vw, 180px)",
            height: "clamp(80px, 18vw, 180px)",
            borderRadius: 10,
            overflow: "hidden",
            opacity: 0.4,
            cursor: "pointer",
            transition: "opacity 0.2s, transform 0.2s",
            filter: "brightness(0.6)",
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.transform = "scale(1.03)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.transform = "scale(1)"; }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={nextImg.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        )}
      </div>

      {/* Floating nav arrows */}
      {images.length > 1 && (
        <>
          <button onClick={goPrev} aria-label="Previous image" style={{
            position: "fixed", left: "clamp(8px, 2vw, 24px)", top: "50%", transform: "translateY(-50%)",
            background: "rgba(14,10,6,0.6)", border: "none", borderRadius: "50%",
            width: 44, height: 44, color: "var(--text-dim)", fontSize: 22, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)", transition: "background 0.15s, color 0.15s",
            zIndex: 20,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.5)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(14,10,6,0.6)"; e.currentTarget.style.color = "var(--text-dim)"; }}
          >‹</button>
          <button onClick={goNext} aria-label="Next image" style={{
            position: "fixed", right: "clamp(8px, 2vw, 24px)", top: "50%", transform: "translateY(-50%)",
            background: "rgba(14,10,6,0.6)", border: "none", borderRadius: "50%",
            width: 44, height: 44, color: "var(--text-dim)", fontSize: 22, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)", transition: "background 0.15s, color 0.15s",
            zIndex: 20,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.5)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(14,10,6,0.6)"; e.currentTarget.style.color = "var(--text-dim)"; }}
          >›</button>
        </>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 24 }}>
          {images.map((_, i) => (
            <button key={i} onClick={() => { setCurrent(i); resetTimer(); }} style={{
              width: i === current ? 20 : 6,
              height: 6,
              borderRadius: 3,
              border: "none",
              background: i === current ? "var(--orange)" : "var(--border-hi)",
              cursor: "pointer",
              transition: "all 0.25s ease",
              padding: 0,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
