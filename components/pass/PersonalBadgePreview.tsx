/* eslint-disable @next/next/no-img-element -- Same-origin images are captured directly for PNG/PDF export. */
import type { PassTemplate } from "./templates";
export function PersonalBadgePreview({ template, name, title, photoUrl, qrUrl, passNumber }: { template: PassTemplate; name: string; title: string; photoUrl?: string | null; qrUrl?: string; passNumber?: string }) {
  return <div role="img" aria-label={`${template.name} pass preview`} className="relative mx-auto aspect-square w-full max-w-[620px] overflow-hidden rounded-3xl border-2 bg-cover bg-no-repeat shadow-2xl" style={{ backgroundImage: `url('/personal-pass-designs-${template.sheet}.png')`, backgroundPosition: template.position, backgroundSize: "300% 200%", borderColor: `${template.accent}90` }}>
    {photoUrl && <img src={photoUrl} alt="Pass holder" className="absolute object-cover" style={template.photoPosition} />}
    <div className="absolute left-[17%] top-[64%] w-[66%] truncate text-center font-pixel font-bold text-slate-950" style={{ fontSize: "clamp(12px,2.2vw,22px)" }}>{name || "YOUR NAME"}</div>
    <div className="absolute left-[17%] top-[77%] truncate text-center font-pixel font-bold text-slate-950" style={{ width: qrUrl ? "48%" : "66%", fontSize: "clamp(10px,1.5vw,16px)" }}>{title || "YOUR TITLE"}</div>
    {qrUrl && <div className="absolute bottom-[3%] right-[3%] w-[25%] aspect-square rounded bg-white p-1"><img src={qrUrl} alt="Verification QR" className="h-full w-full" /></div>}
    {passNumber && <div className="absolute bottom-[4%] left-[5%] max-w-[60%] rounded bg-white/95 px-2 py-1 font-mono text-[10px] font-bold text-black">{passNumber}</div>}
  </div>;
}
