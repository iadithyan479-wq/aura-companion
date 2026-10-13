import type { Mood } from "@/types/companion";

type Props = { mode: "idle" | "listening" | "thinking" | "speaking"; mood: Mood | null };

const motes = Array.from({ length: 12 }, (_, index) => ({ angle: index * 30, delay: `${index * -0.7}s`, size: index % 3 === 0 ? "large" : "" }));

export default function GalaxyCore({ mode, mood }: Props) {
  return (
    <div className={`galaxy-stage state-${mode} galaxy-mood-${mood || "none"}`} aria-hidden="true">
      <div className="galaxy-halo halo-one" /><div className="galaxy-halo halo-two" />
      <div className="galaxy-orbit orbit-one"><span /></div><div className="galaxy-orbit orbit-two"><span /></div><div className="galaxy-orbit orbit-three"><span /></div>
      <div className="galaxy-core"><div className="core-glass"><span className="core-star">✦</span><span className="core-crosshair">✧</span><span className="core-flare" /></div><span className="core-rim" /></div>
      {motes.map((mote, index) => <span key={index} className={`galaxy-mote ${mote.size}`} style={{ "--angle": `${mote.angle}deg`, "--delay": mote.delay } as React.CSSProperties} />)}
      <div className="galaxy-ground-glow" />
    </div>
  );
}
