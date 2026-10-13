import { ArrowLeft, Check, Heart, ShieldCheck, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type CompanionSettings = { name: string; interests: string; style: string; remember: boolean; voice: string; atmosphere: string };

type Props = { initial: CompanionSettings; onClose: () => void; onSave: (value: CompanionSettings) => void };

const defaults: CompanionSettings = { name: "", interests: "", style: "Gentle & encouraging", remember: false, voice: "No spoken replies", atmosphere: "Lavender dusk" };

export default function SettingsPanel({ initial, onClose, onSave }: Props) {
  const [form, setForm] = useState<CompanionSettings>({ ...defaults, ...initial });
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const set = (key: keyof CompanionSettings, value: string | boolean) => setForm(current => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.remember) localStorage.setItem("aura-companion-settings", JSON.stringify(form));
    else localStorage.removeItem("aura-companion-settings");
    onSave(form);
  };
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const focusFirst = () => panel.querySelector<HTMLElement>(selector)?.focus();
    const focusFrame = requestAnimationFrame(focusFirst);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={panelRef} className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header"><button onClick={onClose} className="icon-button" aria-label="Close settings"><ArrowLeft size={18} /></button><div className="settings-heading-icon"><Sparkles size={17} /></div><div className="settings-heading-copy"><span>MAKE IT YOURS</span><h2 id="settings-title">Your little universe</h2></div><button onClick={onClose} className="icon-button settings-close" aria-label="Close settings"><X size={18} /></button></header>
        <form onSubmit={submit}>
          <div className="settings-scroll">
            <p className="settings-lede">AURA should feel like your space. Change anything, any time.</p>
            <label className="field-label">What should AURA call you?<input maxLength={32} value={form.name} onChange={event => set("name", event.target.value)} placeholder="Just a first name or nickname" /></label>
            <label className="field-label">Things you love or want to explore<textarea maxLength={240} rows={3} value={form.interests} onChange={event => set("interests", event.target.value)} placeholder="Books, art, a new hobby… entirely optional" /></label>
            <label className="field-label">AURA’s communication style<select value={form.style} onChange={event => set("style", event.target.value)}><option>Gentle & encouraging</option><option>Warm & playful</option><option>Honest & straightforward</option><option>Quiet & thoughtful</option></select></label>
            <label className="field-label">Voice replies<select value={form.voice} onChange={event => set("voice", event.target.value)}><option>No spoken replies</option><option>Warm and calm</option><option>Light and cheerful</option></select></label>
            <label className="field-label">Your visual atmosphere<select value={form.atmosphere} onChange={event => set("atmosphere", event.target.value)}><option>Lavender dusk</option><option>Rosewater glow</option><option>Sea glass</option></select></label>
            <div className="preference-note"><Heart size={15} /><span>Your style and relevant interests shape a few on-device reply templates; no AI service is connected.</span></div>
            <label className="remember-setting"><input type="checkbox" checked={form.remember} onChange={event => set("remember", event.target.checked)} /><span><b>Remember these settings on this device</b><small>If you leave this off, they disappear when you close the app.</small></span></label>
            <div className="settings-privacy"><ShieldCheck size={15} /><span>Only saved in this browser on your device. No account or cloud memory is connected.</span></div>
          </div>
          <footer className="settings-footer"><button type="button" className="settings-cancel" onClick={onClose}>Not now</button><button type="submit" className="settings-save"><Check size={15} /> Save my space</button></footer>
        </form>
      </section>
    </div>
  );
}
