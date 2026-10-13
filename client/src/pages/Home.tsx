import {
  AudioLines,
  ChevronDown,
  Heart,
  Mic,
  MicOff,
  MoreHorizontal,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import CameraMood from "@/components/CameraMood";
import GalaxyCore from "@/components/GalaxyCore";
import SettingsPanel, { type CompanionSettings } from "@/components/SettingsPanel";

type Mood = "bright" | "grounded" | "low" | "wired" | "curious";
type Message = { id: number; from: "aura" | "you"; text: string; time: string };
type TalkMode = "idle" | "listening" | "thinking" | "speaking";

const suggestedPrompts = [
  { icon: Heart, label: "I have a lot on my mind" },
  { icon: Sparkles, label: "Give me a tiny reset" },
  { icon: AudioLines, label: "Tell me something kind" },
];

function responseFor(text: string, name: string, style: string, interests: string) {
  const value = text.toLowerCase();
  const personalize = (line: string) => {
    let tuned = line;
    if (style === "Warm & playful") tuned = tuned.replace("small, gentle reset", "tiny, low-pressure reset").replace("I can help you sort it out.", "Let’s untangle it together.");
    if (style === "Honest & straightforward") tuned = tuned.replace("that sounds like a lot to carry.", "that is a lot to carry.").replace("Would it help to talk it through, or would you rather start with one small, gentle reset?", "Would you like to talk it through, or pick one next step?");
    if (style === "Quiet & thoughtful") tuned = tuned.replace("I’m listening.", "Take your time; I’m here.").replace("hey, I’m glad you’re here.", "I’m here whenever you’re ready.");
    const interest = interests.split(/[,;\n]/).map(item => item.trim()).find(item => item.length >= 3 && value.includes(item.toLowerCase()));
    if (interest) tuned += ` I know ${interest} matters to you. Want to talk about that part?`;
    return tuned;
  };
  const withName = (line: string) => `${name ? `${name}, ` : ""}${personalize(line)}`;
  if (/\b(hello|hi|hey|good morning|good evening)\b/.test(value)) {
    return withName("hey, I’m glad you’re here. What’s taking up space in your mind today?");
  }
  if (/\b(stress|stressed|anxious|anxiety|overwhelm|overwhelmed|panic|hard day|bad day|tired|sad|lonely|upset)\b/.test(value)) {
    return withName("that sounds like a lot to carry. You don’t have to make it sound neat for me. Would it help to talk it through, or would you rather start with one small, gentle reset?");
  }
  if (/\b(reset|breathe|breath|calm|ground)\b/.test(value)) {
    return personalize("Let’s make this moment a little smaller. Unclench your jaw if you can. Feel your feet on the floor, then take one easy breath in and a slower one out. No need to fix everything right now.");
  }
  if (/\b(proud|did it|finished|win|excited|happy|good news|great)\b/.test(value)) {
    return personalize("I love that for you. Take a second to actually let the win land—you worked for this moment. What part are you most proud of?");
  }
  if (/\b(help|advice|what should|how do i|how can i)\b/.test(value)) {
    return personalize("I can help you sort it out. What feels most important here—and what part do you have the power to change first? We can take it one step at a time.");
  }
  if (/\b(thank|thanks)\b/.test(value)) {
    return personalize("Anytime. You deserve support that feels kind, not judgmental. Want to keep going, or leave it here for now?");
  }
  return withName("I’m listening. What does that feel like for you—and what would you most like to happen next?");
}

function clockNow() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function initialSettings(): CompanionSettings {
  try {
    const stored = localStorage.getItem("aura-companion-settings");
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

const defaultSettings: CompanionSettings = { name: "", interests: "", style: "Gentle & encouraging", remember: false, voice: "No spoken replies", atmosphere: "Lavender dusk" };

export default function Home() {
  const [mode, setMode] = useState<TalkMode>("idle");
  const [voiceOn, setVoiceOn] = useState(() => { const saved = initialSettings(); return saved.remember && ["Warm and calm", "Light and cheerful"].includes(saved.voice); });
  const voiceOnRef = useRef(voiceOn);
  const [settings, setSettings] = useState<CompanionSettings>(initialSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [time, setTime] = useState(clockNow);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, from: "aura", text: "Hey, I’m here with you. No pressure to have it all figured out. What’s on your mind?", time: clockNow() },
  ]);
  const [toast, setToast] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const userName = settings.name.trim();
  const handleCameraMood = useCallback((label: string) => {
    setToast(`The camera sees a ${label.toLowerCase()} expression. That’s only an estimate—how do you feel?`);
  }, []);
  const moods: { key: Mood; label: string; emoji: string; color: string }[] = [
    { key: "bright", label: "Bright", emoji: "✦", color: "gold" },
    { key: "grounded", label: "Grounded", emoji: "◌", color: "green" },
    { key: "low", label: "A little low", emoji: "☾", color: "blue" },
    { key: "wired", label: "A bit wired", emoji: "〰", color: "pink" },
    { key: "curious", label: "Curious", emoji: "✧", color: "violet" },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setTime(clockNow()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mode]);
  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const speak = (text: string) => {
    if (!voiceOnRef.current || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.voice === "Light and cheerful" ? 1.02 : 0.94;
    utterance.pitch = settings.voice === "Light and cheerful" ? 1.2 : 1.04;
    utterance.onstart = () => setMode("speaking");
    utterance.onend = () => setMode("idle");
    utterance.onerror = () => setMode("idle");
    window.speechSynthesis.speak(utterance);
  };

  const setVoicePreference = (enabled: boolean) => {
    voiceOnRef.current = enabled;
    setVoiceOn(enabled);
    if (!enabled) {
      window.speechSynthesis?.cancel();
      setMode(current => current === "speaking" ? "idle" : current);
    }
  };
  const toggleVoiceReplies = () => {
    const next = !voiceOnRef.current;
    setVoicePreference(next);
    setSettings(current => ({ ...current, voice: next ? (current.voice === "Light and cheerful" ? current.voice : "Warm and calm") : "No spoken replies" }));
  };

  const sendMessage = (content: string) => {
    const clean = content.trim();
    if (!clean) return;
    recognitionRef.current?.stop?.();
    window.speechSynthesis?.cancel();
    setDraft("");
    setMode("thinking");
    setMessages(prev => [...prev, { id: Date.now(), from: "you", text: clean, time: clockNow() }]);
    window.setTimeout(() => {
      const answer = responseFor(clean, userName, settings.style, settings.interests);
      setMessages(prev => [...prev, { id: Date.now() + 1, from: "aura", text: answer, time: clockNow() }]);
      if (voiceOnRef.current) speak(answer);
      else setMode("idle");
    }, 750 + Math.min(clean.length * 10, 800));
  };

  const toggleMic = () => {
    if (mode === "listening") {
      recognitionRef.current?.stop?.();
      setMode("idle");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast("Voice input isn’t supported here yet. You can still chat by typing.");
      return;
    }
    try {
      window.speechSynthesis?.cancel();
      const recognition = new SpeechRecognition();
      recognition.lang = navigator.language || "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) transcript += event.results[i][0].transcript;
        setDraft(transcript);
        if (event.results[event.results.length - 1].isFinal) sendMessage(transcript);
      };
      recognition.onerror = () => { setMode("idle"); setToast("The browser couldn’t start voice input. Check microphone permission or type instead."); };
      recognition.onend = () => setMode(current => current === "listening" ? "idle" : current);
      recognitionRef.current = recognition;
      recognition.start();
      setMode("listening");
    } catch {
      setToast("The microphone could not start. You can still chat by typing.");
    }
  };

  const chooseMood = (mood: Mood) => {
    setSelectedMood(mood);
    const found = moods.find(item => item.key === mood);
    setToast(`Thanks for checking in as ${found?.label.toLowerCase()}. I’ll meet you where you are.`);
  };

  const greeting = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date()).match(/AM/i)
    ? "The morning is yours to shape."
    : "A little space, just for you.";

  const modeLabel: Record<TalkMode, string> = { idle: "Here whenever you need me", listening: "I’m all ears…", thinking: "Putting a little thought into this…", speaking: "Sharing a little thought…" };

  return (
    <div className={`aura-app atmosphere-${settings.atmosphere === "Rosewater glow" ? "rose" : settings.atmosphere === "Sea glass" ? "sea" : "lavender"}`}>
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="AURA home">
          <span className="brand-mark"><span /></span>
          <span className="brand-name">aura<span>.</span></span>
        </a>
        <div className="sidebar-section-title">YOUR LITTLE UNIVERSE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#home" className="nav-item active"><span className="nav-icon">✳</span> My space <span className="nav-dot" /></a>
          <a href="#conversation" className="nav-item"><span className="nav-icon">◉</span> Our conversations</a>
          <a href="#check-in" className="nav-item"><span className="nav-icon">☾</span> Mood garden</a>
        </nav>
        <div className="sidebar-divider" />
        <div className="side-caption">TODAY'S INTENTION</div>
        <div className="intention-card"><div className="intention-star">✳</div><p>You don’t have to do it all at once.</p><span>one gentle step is enough</span></div>
        <div className="sidebar-spacer" />
        <div className="privacy-note"><ShieldCheck size={15} /><span>Your space is yours.<br /><b>Typing stays in this tab.</b></span></div>
        <button className="profile-button" onClick={() => setSettingsOpen(true)}>
          <span className="profile-avatar">{userName ? userName.slice(0, 1).toUpperCase() : "✧"}</span>
          <span className="profile-copy"><b>{userName || "Your profile"}</b><small>Make this yours</small></span>
          <Settings2 size={16} />
        </button>
      </aside>

      <main className="main-area" id="home">
        <header className="topbar">
          <div className="breadcrumb"><span>Your little universe</span><span className="crumb-slash">/</span><b>My space</b></div>
          <div className="topbar-right"><span className="local-badge"><span /> LOCAL PREVIEW</span><span className="topbar-time">{time}</span><button className="icon-button settings-mobile" onClick={() => setSettingsOpen(true)} aria-label="Personalise AURA"><Settings2 size={18} /></button></div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-row">
            <div className="welcome-copy">
              <span className="eyebrow"><span className="eyebrow-line" /> A MOMENT THAT'S YOURS</span>
              <h1>{userName ? `Hi, ${userName}.` : "Hey, lovely."}</h1>
              <p>{greeting} What would feel good right now?</p>
            </div>
            <div className="welcome-date"><span className="date-sun">✦</span><span><b>{new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date())}</b><small>{new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(new Date())}</small></span></div>
          </section>

          <section className="hero-card" aria-label="AURA companion">
            <div className="hero-wash" />
            <div className="hero-text">
              <span className="hero-kicker"><span className="live-dot" /> YOUR COMPANION IS HERE</span>
              <h2>A softer place<br />to <em>land.</em></h2>
              <p>Little thoughts, big feelings, half-formed plans. You can bring all of it here.</p>
              <a className="hero-link" href="#conversation">Come say hello <span>↗</span></a>
            </div>
            <GalaxyCore mode={mode} mood={selectedMood} />
            <div className={`orb-caption orb-caption-${mode}`}><span /> {modeLabel[mode]}</div>
            <div className="hero-note">YOUR LITTLE COSMOS <span>✦</span></div>
          </section>

          <div className="content-grid">
            <section className="conversation-card panel" id="conversation">
              <div className="panel-heading conversation-heading">
                <div className="panel-icon chat-icon"><AudioLines size={17} /></div>
                <div><h3>Talk it out</h3><p>A quiet corner, just for you two</p></div>
                <button className="icon-button heading-more" onClick={() => { setMessages([{ id: Date.now(), from: "aura", text: "Fresh page, soft start. What would you like to talk about?", time: clockNow() }]); setMode("idle"); }} aria-label="Start a fresh conversation"><Plus size={19} /></button>
              </div>
              <div className="offline-note"><Sparkles size={13} /> AURA's thoughtful local preview <span>·</span> messages stay in this tab</div>
              <div className="message-list" ref={listRef} aria-live="polite">
                {messages.map(message => <article className={`message-row ${message.from === "you" ? "message-user" : "message-aura"}`} key={message.id}>
                  {message.from === "aura" && <span className="message-avatar"><span>✧</span></span>}
                  <div className="message-body"><div className="message-meta"><b>{message.from === "you" ? userName || "You" : "AURA"}</b><time>{message.time}</time></div><p>{message.text}</p></div>
                </article>)}
                {mode === "thinking" && <div className="thinking-row"><span /><span /><span /><small>finding the right words</small></div>}
              </div>
              {messages.length === 1 && <div className="suggestions"><span>NOT SURE WHERE TO START?</span>{suggestedPrompts.map(({ icon: Icon, label }) => <button onClick={() => sendMessage(label)} key={label}><Icon size={14} /> {label}<span>↗</span></button>)}</div>}
              <form className="message-compose" onSubmit={event => { event.preventDefault(); sendMessage(draft); }}>
                <input value={draft} onChange={event => setDraft(event.target.value)} aria-label="Write your message" placeholder={mode === "listening" ? "Listening to you…" : "Write whatever's on your mind…"} />
                <button type="button" className={`voice-button ${mode === "listening" ? "recording" : ""}`} aria-label={mode === "listening" ? "Stop voice input" : "Start voice input"} onClick={toggleMic}>{mode === "listening" ? <MicOff size={17} /> : <Mic size={17} />}</button>
                <button type="submit" className="send-button" disabled={!draft.trim()} aria-label="Send message"><Send size={16} /></button>
              </form>
              <div className="conversation-foot"><span title="Speech-to-text handling depends on your browser"><ShieldCheck size={12} /> Typed chat stays local · voice processing varies</span><button onClick={toggleVoiceReplies} className={`voice-toggle ${voiceOn ? "on" : ""}`}>{voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}{voiceOn ? "Voice replies on" : "Voice replies off"}</button></div>
            </section>

            <aside className="right-rail">
              <section className="panel checkin-card" id="check-in">
                <div className="panel-heading compact-heading"><div className="panel-icon heart-icon"><Heart size={17} /></div><div><h3>How are you, really?</h3><p>No right answer. Just yours.</p></div><MoreHorizontal size={18} className="subtle-more" /></div>
                <div className="mood-options">{moods.map(({ key, label, emoji, color }) => <button key={key} className={`mood-chip ${selectedMood === key ? "selected" : ""} mood-${color}`} onClick={() => chooseMood(key)} aria-pressed={selectedMood === key}><span>{emoji}</span>{label}</button>)}</div>
                <div className="checkin-response"><span className="response-star">✳</span><p>{selectedMood ? "Thank you for letting me in. Your feelings don't need fixing here." : "A little check-in can make room for what you need."}</p></div>
              </section>

              <CameraMood onMood={handleCameraMood} />

              <section className="journal-card">
                <div className="journal-spark">✦</div><span className="journal-label">A LITTLE REMINDER</span>
                <p>“You are allowed to grow at your own pace.”</p><div className="journal-bottom"><span>KEEP WHAT FEELS TRUE</span><span>✧ · ✦ · ✧</span></div>
              </section>
            </aside>
          </div>
          <footer className="page-foot"><span><span className="foot-star">✧</span> Made for your softer moments.</span><div><button onClick={() => setSettingsOpen(true)}>Your settings</button><span>·</span><button onClick={() => setToast("AURA uses local conversation templates. Expression cues are not diagnoses; browser speech handling depends on your browser or provider.")}>About AURA</button></div></footer>
        </div>
      </main>

      <div className="mobile-dock" aria-label="Quick navigation">
        <a href="#home"><span>✳</span> My space</a><a href="#conversation"><AudioLines size={18} /> Talk</a><a href="#check-in"><Heart size={18} /> Check in</a><button onClick={() => setSettingsOpen(true)}><Settings2 size={18} /> Me</button>
      </div>

      {settingsOpen && <SettingsPanel initial={settings} onClose={() => setSettingsOpen(false)} onSave={next => { setSettings(next); setVoicePreference(["Warm and calm", "Light and cheerful"].includes(next.voice)); setSettingsOpen(false); setToast(next.remember ? "Your settings are saved on this device." : "Settings applied for this visit only."); }} />}
      {toast && <div className="toast-message" role="status"><span>✧</span>{toast}<button onClick={() => setToast("")} aria-label="Dismiss"><X size={15} /></button></div>}
      <button className="floating-voice" onClick={toggleVoiceReplies} aria-label={voiceOn ? "Turn voice replies off" : "Turn voice replies on"}><span className={voiceOn ? "floating-on" : ""}>{voiceOn ? <Volume2 size={17} /> : <VolumeX size={17} />}</span><span>{voiceOn ? "Voice on" : "Voice off"}</span><ChevronDown size={13} /></button>
      <div className="sr-only" aria-live="polite">{modeLabel[mode]}</div>
    </div>
  );
}
