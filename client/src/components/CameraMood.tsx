import { Camera, CameraOff, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = { onMood: (expression: string) => void };

function readExpression(blendshapes: any[]) {
  const score = (name: string) => blendshapes.find(item => item.categoryName === name)?.score ?? 0;
  const smile = (score("mouthSmileLeft") + score("mouthSmileRight")) / 2;
  const frown = (score("mouthFrownLeft") + score("mouthFrownRight")) / 2;
  const browUp = score("browInnerUp");
  const browsTense = (score("browDownLeft") + score("browDownRight")) / 2;
  const jawOpen = score("jawOpen");

  if (smile > 0.4) return { title: "A smile-like expression", signal: "Visible smile" };
  if (frown > 0.35 && browUp > 0.25) return { title: "A frown-like expression", signal: "Furrowed expression" };
  if (browsTense > 0.5 && jawOpen < 0.25) return { title: "A focused-looking expression", signal: "Tense brows" };
  if (jawOpen > 0.45) return { title: "An animated expression", signal: "Expressive movement" };
  return { title: "A neutral-looking expression", signal: "Subtle expression" };
}

export default function CameraMood({ onMood }: Props) {
  const [active, setActive] = useState(false);
  const [consent, setConsent] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionPending, setPermissionPending] = useState(false);
  const [status, setStatus] = useState("Camera is off");
  const [expression, setExpression] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraMountedRef = useRef(false);
  const permissionPendingRef = useRef(false);
  const permissionRequestRef = useRef(0);
  const lastReadRef = useRef("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    let disposed = false;
    let frame = 0;
    let lastRun = 0;
    let detector: any;

    const prepare = async () => {
      try {
        setLoading(true);
        setStatus("Preparing private, on-device expression reader…");
        video.srcObject = stream;
        await video.play();
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        const options = {
          baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "GPU" as const },
          runningMode: "VIDEO" as const,
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        };
        try {
          detector = await FaceLandmarker.createFromOptions(vision, options);
        } catch {
          detector = await FaceLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "CPU" } });
        }
        if (disposed) { detector.close(); return; }
        setStatus("Local expression check is active");
        const scan = (now: number) => {
          if (disposed) return;
          if (now - lastRun > 650 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            lastRun = now;
            try {
              const result = detector.detectForVideo(video, now);
              const face = result.faceBlendshapes?.[0]?.categories;
              if (face?.length) {
                const next = readExpression(face);
                setExpression(next.title);
                setStatus("One face found · video stays on your device");
                if (lastReadRef.current !== next.title) {
                  lastReadRef.current = next.title;
                  onMood(next.signal);
                }
              } else {
                setExpression("");
                lastReadRef.current = "";
                setStatus("No face in view · nothing is recorded");
              }
            } catch {
              setStatus("Can’t read this frame · camera is still private");
            }
          }
          frame = requestAnimationFrame(scan);
        };
        frame = requestAnimationFrame(scan);
      } catch (error) {
        if (!disposed) {
          setStatus(error instanceof Error ? "Reader unavailable · choose a check-in below" : "Reader unavailable · choose a check-in below");
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void prepare();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      detector?.close?.();
      video.pause();
      video.srcObject = null;
    };
  }, [stream, onMood]);

  useEffect(() => {
    cameraMountedRef.current = true;
    return () => {
      cameraMountedRef.current = false;
      permissionRequestRef.current += 1;
      permissionPendingRef.current = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, []);

  const turnOn = async () => {
    if (!consent) {
      setStatus("Please confirm the local-only camera note first.");
      return;
    }
    if (permissionPendingRef.current || streamRef.current) return;
    permissionPendingRef.current = true;
    const requestId = ++permissionRequestRef.current;
    setPermissionPending(true);
    setStatus("Waiting for camera permission…");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera permission isn’t available in this browser.");
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (!cameraMountedRef.current || requestId !== permissionRequestRef.current) {
        nextStream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = nextStream;
      setStream(nextStream);
      setActive(true);
    } catch (error) {
      if (cameraMountedRef.current && requestId === permissionRequestRef.current) {
        setStatus(error instanceof Error ? error.message : "The camera could not start. You can still check in with the buttons below.");
      }
    } finally {
      if (requestId === permissionRequestRef.current) {
        permissionPendingRef.current = false;
        if (cameraMountedRef.current) setPermissionPending(false);
      }
    }
  };

  const turnOff = () => {
    permissionRequestRef.current += 1;
    permissionPendingRef.current = false;
    setPermissionPending(false);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setStream(null);
    setActive(false);
    setExpression("");
    setStatus("Camera is off");
    lastReadRef.current = "";
  };

  return (
    <section className={`panel camera-card ${active ? "camera-active" : ""}`} aria-labelledby="camera-title">
      <div className="panel-heading compact-heading">
        <div className="panel-icon camera-icon"><Camera size={16} /></div>
        <div><h3 id="camera-title">Expression check-in</h3><p>Only if you want to</p></div>
        <span className={`camera-indicator ${active ? "camera-live" : ""}`}><span /> {active ? "LIVE" : "OFF"}</span>
      </div>
      {active ? <div className="camera-live-view">
        <video ref={videoRef} autoPlay muted playsInline aria-label="Your live camera preview. Video is processed only on this device." />
        <div className="camera-scan-line" />
        <div className="camera-local-tag"><ShieldCheck size={11} /> ON THIS DEVICE</div>
        <div className="camera-readout"><Sparkles size={13} /><span>{loading ? "Loading the local reader…" : expression || "Looking gently, not judging"}</span>{loading && <LoaderCircle size={13} className="spin" />}</div>
      </div> : <div className="camera-intro">
        <div className="camera-illustration"><div className="camera-illustration-ring ring-a" /><div className="camera-illustration-ring ring-b" /><span>✧</span></div>
        <div className="camera-intro-copy"><b>A little expression, a little context.</b><p>If you choose, AURA can look for visible facial expressions. Expressions aren’t feelings—and this is never a diagnosis.</p></div>
      </div>}
      <div className="camera-explainer"><ShieldCheck size={13} /><span>Camera stays off until you ask. No photo, audio or video is saved or sent to a server.</span></div>
      {active ? <button className="camera-control stop-camera" onClick={turnOff}><CameraOff size={14} /> Turn camera off</button> : <>
        <label className="consent-label"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>I’m okay with a <b>local-only</b> expression estimate. I can stop anytime.</span></label>
        <button className="camera-control start-camera" onClick={turnOn} disabled={!consent || permissionPending}>{permissionPending ? <LoaderCircle size={14} className="spin" /> : <Camera size={14} />}{permissionPending ? "Waiting for permission…" : "Turn on my camera"}</button>
      </>}
      {status !== "Camera is off" && <div className={`camera-status ${active ? "" : "camera-error"}`} role="status">{status}</div>}
      <div className="camera-disclaimer">AURA notices visible expressions; only you know what you feel.</div>
    </section>
  );
}
