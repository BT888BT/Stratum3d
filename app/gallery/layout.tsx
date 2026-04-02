import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gallery — Stratum3D | 3D Printing Perth",
  description: "See examples of 3D printed parts from Stratum3D. PLA, PETG and ABS prints for hobbyists, cosplayers and makers in Perth, Western Australia.",
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
