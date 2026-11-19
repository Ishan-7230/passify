"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { passTemplates } from "./templates";
import { PassQrCode } from "./PassQrCode";
import { processPhoto } from "../../lib/media/processPhoto";
import { exportToPng, exportToPdf, printPass } from "../../lib/export/passExporter";

type PersonalPassBuilderProps = {
  templateId: string | null;
};

export function PersonalPassBuilder({ templateId }: PersonalPassBuilderProps) {
  const template = passTemplates.find((item) => item.id === templateId) ?? passTemplates[0];
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [photoError, setPhotoError] = useState("");
  const [photoSavings, setPhotoSavings] = useState("");
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [exportState, setExportState] = useState<"png" | "pdf" | "print" | null>(null);
  const [exportError, setExportError] = useState("");
  const [origin, setOrigin] = useState("https://passify.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const passPreviewRef = useRef<HTMLDivElement>(null);

  const passId = name.trim()
    ? `PAS-${name.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "USER"}-${template.id.toUpperCase()}`
    : `PAS-DEMO-${template.id.toUpperCase()}`;

  const verificationUrl = `${origin}/verify/${encodeURIComponent(passId)}`;

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPhotoError("");
    setPhotoSavings("");
    if (!file) return;

    setIsProcessingPhoto(true);
    try {
      const result = await processPhoto(file, {
        maxWidth: 500,
        maxHeight: 500,
        quality: 0.85,
        maxFileSizeMb: 10,
      });

      setPhotoDataUrl(result.dataUrl);
      const originalKb = (result.originalSize / 1024).toFixed(0);
      const compressedKb = (result.compressedSize / 1024).toFixed(0);
      setPhotoSavings(`Photo optimized: ${originalKb} KB → ${compressedKb} KB`);
    } catch (err) {
      setPhotoDataUrl("");
      setPhotoError(err instanceof Error ? err.message : "Failed to process photo.");
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  async function handleExportPng() {
    if (!passPreviewRef.current) return;
    setExportState("png");
    setExportError("");
    try {
      await exportToPng(passPreviewRef.current, `passify-${name || "personal"}-pass.png`, 3);
    } catch (err) {
      console.error("Export PNG failed:", err);
      setExportError("Failed to export PNG. Please try again.");
    } finally {
      setExportState(null);
    }
  }

  async function handleExportPdf() {
    if (!passPreviewRef.current) return;
    setExportState("pdf");
    setExportError("");
    try {
      await exportToPdf(passPreviewRef.current, `passify-${name || "personal"}-pass.pdf`);
    } catch (err) {
      console.error("Export PDF failed:", err);
      setExportError("Failed to export PDF. Please try again.");
    } finally {
      setExportState(null);
    }
  }

  async function handlePrint() {
    if (!passPreviewRef.current) return;
    setExportState("print");
    setExportError("");
    try {
      await printPass(passPreviewRef.current);
    } catch (err) {
      console.error("Print failed:", err);
      setExportError("Failed to initiate print. Please try again.");
    } finally {
      setExportState(null);
    }
  }

  return (
    <main
      className="scanlines relative min-h-screen overflow-x-hidden px-6 py-10 text-white md:px-12"
      style={{
        backgroundImage: "url('/arcade-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-slate-950/80" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <Link
          href="/dashboard/personal/templates"
          className="font-pixel text-xs uppercase tracking-widest text-slate-400 transition hover:text-white"
        >
          ← Back to templates
        </Link>

        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
          {/* Controls Column */}
          <section>
            <p
              className="font-pixel text-sm font-bold uppercase tracking-[0.3em]"
              style={{ color: template.accent, textShadow: `0 0 10px ${template.accent}` }}
            >
              Step 2 of 3 · Personalize your pass
            </p>
            <h1 className="mt-3 font-pixel text-3xl font-bold md:text-5xl">ADD YOUR DETAILS</h1>
            <p className="mt-4 max-w-xl text-slate-300">
              Upload a photo and enter the details that should appear on your pass. The preview updates as you type.
            </p>

            <form
              className="mt-8 space-y-6 rounded-3xl border border-white/15 bg-slate-950/70 p-6"
              onSubmit={(e) => e.preventDefault()}
            >
              <div>
                <label htmlFor="pass-name" className="font-pixel text-sm font-bold">
                  Name
                </label>
                <input
                  id="pass-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={40}
                  placeholder="e.g. Alex Morgan"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                  required
                />
              </div>

              <div>
                <label htmlFor="pass-title" className="font-pixel text-sm font-bold">
                  Title
                </label>
                <input
                  id="pass-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={40}
                  placeholder="e.g. Creative Director"
                  className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                  required
                />
              </div>

              <div>
                <label htmlFor="pass-photo" className="font-pixel text-sm font-bold">
                  Photo
                </label>
                <input
                  id="pass-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoChange}
                  className="mt-2 block w-full rounded-xl border border-dashed border-white/30 bg-black/40 p-4 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-white"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>PNG, JPG, or WebP · Auto-compressed</span>
                  {isProcessingPhoto && <span className="animate-pulse text-cyan-300">Processing & compressing...</span>}
                </div>
                {photoSavings && <p className="mt-2 text-xs text-emerald-400">{photoSavings}</p>}
                {photoError && (
                  <p className="mt-2 text-sm text-rose-300" role="alert">
                    {photoError}
                  </p>
                )}
              </div>
            </form>

            {/* Export and Action Panel */}
            <div className="mt-6 rounded-3xl border border-white/15 bg-slate-950/70 p-6">
              <h2 className="font-pixel text-sm font-bold uppercase tracking-widest text-cyan-300">
                EXPORT & DOWNLOAD
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Save your completed personal pass in high-resolution format or send it directly to your printer.
              </p>

              {exportError && (
                <p className="mt-3 text-sm text-rose-300" role="alert">
                  {exportError}
                </p>
              )}

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleExportPng}
                  disabled={exportState !== null}
                  className="btn-neon flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-pixel text-xs font-bold text-white transition disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg, #ff2d78, #bf00ff)" }}
                >
                  {exportState === "png" ? "SAVING..." : "💾 DOWNLOAD PNG"}
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportState !== null}
                  className="btn-neon flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-pixel text-xs font-bold text-white transition disabled:opacity-50"
                  style={{ background: "linear-gradient(90deg, #00f5ff, #0066ff)" }}
                >
                  {exportState === "pdf" ? "CREATING..." : "📄 EXPORT PDF"}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={exportState !== null}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-pixel text-xs font-bold text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  {exportState === "print" ? "PREPARING..." : "🖨️ PRINT PASS"}
                </button>
              </div>
            </div>
          </section>

          {/* Live Preview Column */}
          <section aria-label="Live pass preview" className="lg:sticky lg:top-8 lg:self-start">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-pixel text-sm font-bold uppercase tracking-widest">Live preview</h2>
              <span className="text-xs text-slate-400">{template.name}</span>
            </div>

            {/* Printable Pass Card Ref Target */}
            <div
              ref={passPreviewRef}
              className="relative mx-auto aspect-square w-full max-w-[620px] overflow-hidden rounded-3xl border-2 bg-cover bg-no-repeat shadow-2xl"
              style={{
                backgroundImage: `url('/personal-pass-designs-${template.sheet}.png')`,
                backgroundPosition: template.position,
                backgroundSize: "300% 200%",
                borderColor: `${template.accent}90`,
              }}
            >
              {photoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoDataUrl}
                  alt="Uploaded pass holder"
                  className="absolute object-cover shadow-sm"
                  style={template.photoPosition}
                />
              )}

              <div className="absolute left-[17%] top-[64%] w-[66%] truncate text-center font-pixel text-[clamp(0.7rem,2.2vw,1.7rem)] font-bold text-slate-950">
                {name.trim() || "YOUR NAME"}
              </div>

              <div className="absolute left-[20%] top-[77%] w-[60%] truncate text-center font-pixel text-[clamp(0.55rem,1.5vw,1.2rem)] font-bold text-slate-950">
                {title.trim() || "YOUR TITLE"}
              </div>

              {/* Dynamic Verification QR Code */}
              <div className="absolute bottom-[3%] right-[3%] flex flex-col items-center rounded-lg bg-white/95 p-1.5 shadow-lg">
                <PassQrCode value={verificationUrl} size={48} />
                <span className="mt-0.5 text-[6px] font-bold uppercase tracking-wider text-slate-800">
                  SCAN TO VERIFY
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>ID: <code className="font-mono text-cyan-300">{passId}</code></span>
              <Link
                href={`/verify/${encodeURIComponent(passId)}`}
                target="_blank"
                className="font-pixel text-[11px] text-cyan-400 underline transition hover:text-cyan-300"
              >
                Preview Verification ↗
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}