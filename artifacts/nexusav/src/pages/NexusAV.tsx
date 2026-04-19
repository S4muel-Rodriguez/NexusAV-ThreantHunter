import { useState, useEffect, useRef, useCallback } from "react";

type ScanMode = "quick" | "full" | "deep" | "custom";
type ScanStatus = "idle" | "scanning" | "complete" | "error";
type ThreatLevel = "WARNING" | "POTENT" | "HARD";

interface Threat {
  type: string;
  level: ThreatLevel;
  path: string;
  description: string;
}

interface ScanResult {
  filesScanned: number;
  dirsScanned: number;
  threats: Threat[];
  duration: number;
  fixed: number;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ASCII_LOGO = `
  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗ █████╗ ██╗   ██╗
  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝██╔══██╗██║   ██║
  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗███████║██║   ██║
  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║██╔══██║╚██╗ ██╔╝
  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║██║  ██║ ╚████╔╝ 
  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝  ╚═══╝  
`;

const THREAT_BADGE: Record<ThreatLevel, string> = {
  WARNING: "badge-warning",
  POTENT: "badge-potent",
  HARD: "badge-hard",
};

const THREAT_ICON: Record<ThreatLevel, string> = {
  WARNING: "[!!!]",
  POTENT: "[!!]",
  HARD: "[!]",
};

const THREAT_LABEL: Record<ThreatLevel, string> = {
  WARNING: "MUY PELIGROSO",
  POTENT: "PELIGRO MEDIO",
  HARD: "POCO PELIGROSO",
};

const MODE_INFO: Record<ScanMode, { time: string; desc: string; color: string }> = {
  quick: { time: "2–5 min", desc: "Directorios críticos y /tmp", color: "#00ffff" },
  full:  { time: "10–30 min", desc: "Sistema completo profundidad media", color: "#a855f7" },
  deep:  { time: "30–90 min", desc: "Cada archivo, SUID, permisos globales", color: "#ff8800" },
  custom: { time: "Variable", desc: "Rutas personalizadas", color: "#00ff88" },
};

const SCAN_MESSAGES = [
  "Inicializando motor de detección...",
  "Cargando firmas de malware...",
  "Analizando procesos activos...",
  "Escaneando puertos de red...",
  "Verificando entradas de inicio...",
  "Revisando archivo hosts...",
  "Buscando código ofuscado...",
  "Detectando shellcode...",
  "Analizando bits SUID/SGID...",
  "Verificando firmas de ransomware...",
  "Buscando troyanos...",
  "Escaneando rootkits...",
  "Detectando cryptominers...",
  "Analizando conexiones de red...",
  "Verificando scripts de inicio...",
  "Compilando reporte final...",
];

function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(id);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

function RadarIcon({ active }: { active: boolean }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className={active ? "radar-spin" : ""}>
      <circle cx="32" cy="32" r="30" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.3" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.2" />
      <circle cx="32" cy="32" r="10" fill="none" stroke="#00ffff" strokeWidth="1" opacity="0.15" />
      <line x1="32" y1="32" x2="32" y2="4" stroke="#00ffff" strokeWidth="2" opacity="0.8" />
      <line x1="32" y1="32" x2="56" y2="32" stroke="#00ffff" strokeWidth="1" opacity="0.3" />
      <line x1="32" y1="32" x2="10" y2="10" stroke="#00ffff" strokeWidth="1" opacity="0.2" />
      <defs>
        <radialGradient id="rg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00ffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00ffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M32 32 L32 4 A28 28 0 0 1 56 32 Z" fill="url(#rg)" opacity="0.4" />
      <circle cx="32" cy="32" r="3" fill="#00ffff" />
      {active && (
        <>
          <circle cx="20" cy="18" r="2" fill="#ff3333" opacity="0.9" className="status-active" />
          <circle cx="45" cy="40" r="1.5" fill="#ff8800" opacity="0.7" />
        </>
      )}
    </svg>
  );
}

function ThunderLogo() {
  return (
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
      <polygon
        points="20,0 8,20 18,20 12,40 28,14 18,14"
        fill="#00ffff"
        style={{ filter: "drop-shadow(0 0 8px #00ffff) drop-shadow(0 0 20px #00ffff)" }}
      />
    </svg>
  );
}

export default function NexusAV() {
  const [mode, setMode] = useState<ScanMode>("quick");
  const [autoFix, setAutoFix] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "NexusAV v2.0.0 — Sistema listo.",
    "Selecciona un modo de escaneo y presiona INICIAR ESCANEO.",
    "",
    "⚡ Niveles de amenaza:",
    "  [!!!] WARNING — Muy peligroso (ransomware, troyanos, rootkits)",
    "  [!!]  POTENT  — Peligro medio (spyware, bots, cryptominers)",
    "  [!]   HARD    — Poco peligroso (adware, trackers, PUA)",
    "",
    "Esperando instrucciones..._",
  ]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"scan" | "guide" | "about">("scan");
  const [osInfo, setOsInfo] = useState("Detectando sistema...");
  const terminalRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<string>("");

  const subtitle = useTypewriter("⚡ NexusAV — Protección Total Multiplataforma", 30);

  useEffect(() => {
    const ua = navigator.userAgent;
    let os = "Linux/Android";
    if (ua.includes("Win")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Android")) os = "Android";
    setOsInfo(os);
  }, []);

  const addLine = useCallback((line: string) => {
    setTerminalLines((prev) => [...prev.slice(-200), line]);
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  useEffect(() => {
    let msgTimer: ReturnType<typeof setInterval>;
    if (status === "scanning") {
      msgTimer = setInterval(() => {
        setMsgIndex((i) => {
          const next = (i + 1) % SCAN_MESSAGES.length;
          addLine(`[${new Date().toLocaleTimeString()}] ${SCAN_MESSAGES[next]}`);
          return next;
        });
      }, 2500);
    }
    return () => clearInterval(msgTimer);
  }, [status, addLine]);

  const startScan = async () => {
    setStatus("scanning");
    setThreats([]);
    setScanResult(null);
    setProgress(0);
    const session = Date.now().toString();
    sessionRef.current = session;

    setTerminalLines([
      `[${new Date().toLocaleTimeString()}] ═══════════════════════════════════════`,
      `[${new Date().toLocaleTimeString()}] ⚡  NexusAV ESCANEO INICIADO`,
      `[${new Date().toLocaleTimeString()}] ═══════════════════════════════════════`,
      `[${new Date().toLocaleTimeString()}] Modo: ${mode.toUpperCase()} | Fix automático: ${autoFix ? "SÍ" : "NO"}`,
      `[${new Date().toLocaleTimeString()}] ${SCAN_MESSAGES[0]}`,
    ]);

    let prog = 0;
    const progressTimer = setInterval(() => {
      prog += Math.random() * 3;
      if (prog > 95) prog = 95;
      setProgress(Math.round(prog));
    }, 800);

    try {
      const body: Record<string, unknown> = { mode, autoFix };
      if (mode === "custom" && customPath) {
        body.paths = customPath.split(",").map((p) => p.trim()).filter(Boolean);
      }

      const res = await fetch(`${BASE}/api/nexusav/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      clearInterval(progressTimer);
      setProgress(100);

      if (data.success) {
        const result: ScanResult = data.result;
        setScanResult(result);
        setThreats(result.threats);

        addLine(`[${new Date().toLocaleTimeString()}] ═══════════════════════════════════════`);
        addLine(`[${new Date().toLocaleTimeString()}] ESCANEO COMPLETADO`);
        addLine(`[${new Date().toLocaleTimeString()}] Archivos escaneados: ${result.filesScanned}`);
        addLine(`[${new Date().toLocaleTimeString()}] Amenazas detectadas: ${result.threats.length}`);
        addLine(`[${new Date().toLocaleTimeString()}] Tiempo: ${result.duration}s`);

        if (result.threats.length === 0) {
          addLine(`[${new Date().toLocaleTimeString()}] ✓ SISTEMA LIMPIO — No se detectaron amenazas`);
        } else {
          result.threats.forEach((t) => {
            addLine(`[${new Date().toLocaleTimeString()}] ${THREAT_ICON[t.level]} [${t.level}] ${t.type}: ${t.path}`);
          });
        }

        if (autoFix && result.fixed > 0) {
          addLine(`[${new Date().toLocaleTimeString()}] ✓ ${result.fixed} acciones correctivas aplicadas`);
        }

        setStatus("complete");
      } else {
        addLine(`[ERROR] ${data.error}`);
        setStatus("error");
      }
    } catch (err) {
      clearInterval(progressTimer);
      addLine(`[ERROR] No se pudo conectar con el servidor. Verifica que el backend esté activo.`);
      setStatus("error");
    }

    return () => clearInterval(progressTimer);
  };

  const resetScan = () => {
    setStatus("idle");
    setProgress(0);
    setThreats([]);
    setScanResult(null);
    setTerminalLines([
      `[${new Date().toLocaleTimeString()}] Sistema reiniciado. Listo para nuevo escaneo._`,
    ]);
  };

  const warningCount = threats.filter((t) => t.level === "WARNING").length;
  const potentCount = threats.filter((t) => t.level === "POTENT").length;
  const hardCount = threats.filter((t) => t.level === "HARD").length;

  return (
    <div className="min-h-screen retro-grid scanlines" style={{ background: "var(--dark-bg)" }}>
      {/* Google Font import */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap"
        rel="stylesheet"
      />

      {/* ── Header ── */}
      <header className="border-b" style={{ borderColor: "var(--dark-border)", background: "rgba(3,6,16,0.95)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ThunderLogo />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold neon-cyan tracking-widest" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                    NEXUS
                  </span>
                  <span className="text-2xl font-bold neon-purple tracking-widest" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                    AV
                  </span>
                </div>
                <div className="text-xs" style={{ color: "#0d5f5f" }}>ANTIVIRUS SCANNER v2.0.0</div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs" style={{ color: "#0d5f5f" }}>
              <div className="flex items-center gap-2">
                <span className="status-active" style={{ color: "#00ff88" }}>●</span>
                <span>SISTEMA: {osInfo}</span>
              </div>
              <div style={{ color: "#0d5f5f" }}>
                {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── ASCII Logo ── */}
      <div className="text-center py-4 overflow-hidden logo-ascii">
        <pre className="text-xs leading-tight inline-block" style={{
          color: "rgba(0,255,255,0.15)",
          fontFamily: "monospace",
          fontSize: "clamp(5px, 1.2vw, 11px)",
        }}>
          {ASCII_LOGO}
        </pre>
        <div className="text-sm neon-purple tracking-[0.3em] mt-1" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
          {subtitle}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-0 mb-6 border-b" style={{ borderColor: "var(--dark-border)" }}>
          {[
            { id: "scan", label: "⚡ ESCANEAR" },
            { id: "guide", label: "📋 GUÍA DE USO" },
            { id: "about", label: "ℹ ACERCA DE" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="px-6 py-2 text-xs tracking-widest transition-all"
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                background: activeTab === tab.id ? "rgba(0,255,255,0.08)" : "transparent",
                borderBottom: activeTab === tab.id ? "2px solid var(--neon-cyan)" : "2px solid transparent",
                color: activeTab === tab.id ? "var(--neon-cyan)" : "#0d5f5f",
                marginBottom: "-1px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SCAN TAB ── */}
      {activeTab === "scan" && (
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* LEFT — Control Panel */}
            <div className="lg:col-span-1 flex flex-col gap-4">

              {/* Radar + Status */}
              <div className="neon-card p-4 flex flex-col items-center gap-3">
                <RadarIcon active={status === "scanning"} />
                <div className="text-xs tracking-widest" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                  {status === "idle"     && <span style={{ color: "#0d5f5f" }}>STANDBY</span>}
                  {status === "scanning" && <span className="neon-cyan status-active">ESCANEANDO...</span>}
                  {status === "complete" && <span className="neon-green">COMPLETADO</span>}
                  {status === "error"    && <span className="neon-red">ERROR</span>}
                </div>

                {/* Progress Bar */}
                {status === "scanning" && (
                  <div className="w-full">
                    <div className="flex justify-between text-xs mb-1" style={{ color: "#0d5f5f" }}>
                      <span>PROGRESO</span>
                      <span className="neon-cyan">{progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-sm" style={{ background: "#030610", border: "1px solid var(--dark-border)" }}>
                      <div
                        className="h-full rounded-sm progress-bar-inner"
                        style={{ width: `${progress}%`, background: "linear-gradient(90deg, #00aaaa, #00ffff)" }}
                      />
                    </div>
                  </div>
                )}

                {/* Result summary */}
                {status === "complete" && scanResult && (
                  <div className="w-full text-xs space-y-1" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                    <div className="flex justify-between">
                      <span style={{ color: "#0d5f5f" }}>Archivos:</span>
                      <span className="neon-cyan">{scanResult.filesScanned.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "#0d5f5f" }}>Amenazas:</span>
                      <span className={scanResult.threats.length > 0 ? "neon-red" : "neon-green"}>
                        {scanResult.threats.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "#0d5f5f" }}>Tiempo:</span>
                      <span className="neon-cyan">{scanResult.duration}s</span>
                    </div>
                    {autoFix && (
                      <div className="flex justify-between">
                        <span style={{ color: "#0d5f5f" }}>Reparados:</span>
                        <span className="neon-green">{scanResult.fixed}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mode Selector */}
              <div className="neon-card p-4">
                <div className="text-xs tracking-widest mb-3" style={{ color: "#0d5f5f" }}>MODO DE ESCANEO</div>
                <div className="space-y-2">
                  {(["quick", "full", "deep", "custom"] as ScanMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      disabled={status === "scanning"}
                      className="w-full text-left px-3 py-2 text-xs transition-all"
                      style={{
                        fontFamily: "'Share Tech Mono', monospace",
                        background: mode === m ? "rgba(0,255,255,0.08)" : "transparent",
                        border: `1px solid ${mode === m ? MODE_INFO[m].color : "var(--dark-border)"}`,
                        color: mode === m ? MODE_INFO[m].color : "#0d5f5f",
                        borderRadius: "2px",
                        cursor: status === "scanning" ? "not-allowed" : "pointer",
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="uppercase tracking-wider">{m}</span>
                        <span style={{ opacity: 0.6 }}>{MODE_INFO[m].time}</span>
                      </div>
                      <div style={{ opacity: 0.5, fontSize: "10px", marginTop: "2px" }}>{MODE_INFO[m].desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="neon-card p-4">
                <div className="text-xs tracking-widest mb-3" style={{ color: "#0d5f5f" }}>OPCIONES</div>
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    className="retro-checkbox"
                    checked={autoFix}
                    onChange={(e) => setAutoFix(e.target.checked)}
                    disabled={status === "scanning"}
                  />
                  <span className="text-xs" style={{ color: autoFix ? "var(--neon-green)" : "#0d5f5f" }}>
                    AUTO-FIX (eliminar amenazas)
                  </span>
                </label>

                {mode === "custom" && (
                  <div>
                    <div className="text-xs mb-1" style={{ color: "#0d5f5f" }}>RUTAS (separadas por coma):</div>
                    <input
                      type="text"
                      value={customPath}
                      onChange={(e) => setCustomPath(e.target.value)}
                      placeholder="/home/usuario, /tmp"
                      disabled={status === "scanning"}
                      className="w-full text-xs p-2"
                      style={{
                        background: "#030610",
                        border: "1px solid var(--dark-border)",
                        color: "var(--neon-cyan)",
                        fontFamily: "'Share Tech Mono', monospace",
                        borderRadius: "2px",
                        outline: "none",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  className="btn-neon btn-neon-green w-full"
                  onClick={startScan}
                  disabled={status === "scanning"}
                >
                  {status === "scanning" ? "⟳ ESCANEANDO..." : "⚡ INICIAR ESCANEO"}
                </button>
                {(status === "complete" || status === "error") && (
                  <button className="btn-neon w-full" onClick={resetScan}>
                    ↺ NUEVO ESCANEO
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT — Terminal + Threats */}
            <div className="lg:col-span-2 flex flex-col gap-4">

              {/* Terminal */}
              <div className="neon-card" style={{ minHeight: "280px" }}>
                <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor: "var(--dark-border)" }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: "#ff3333" }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: "#ff8800" }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: "#00ff88" }} />
                  <span className="text-xs ml-2" style={{ color: "#0d5f5f" }}>nexusav@terminal — bash</span>
                </div>
                <div className="terminal p-4" style={{ height: "280px" }} ref={terminalRef}>
                  {terminalLines.map((line, i) => (
                    <div key={i} style={{
                      color: line.includes("[!!!]") ? "var(--neon-red)"
                           : line.includes("[!!]") ? "var(--neon-orange)"
                           : line.includes("[!]") ? "var(--neon-yellow)"
                           : line.includes("[ERROR]") ? "var(--neon-red)"
                           : line.includes("✓") ? "var(--neon-green)"
                           : line.includes("⚡") ? "var(--neon-cyan)"
                           : "var(--neon-green)"
                    }}>
                      {line || "\u00A0"}
                    </div>
                  ))}
                  {status === "scanning" && (
                    <div style={{ color: "var(--neon-cyan)" }}>
                      <span className="blink">█</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Threat List */}
              {(threats.length > 0 || status === "complete") && (
                <div className="neon-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs tracking-widest" style={{ color: "#0d5f5f" }}>AMENAZAS DETECTADAS</span>
                    <div className="flex gap-2">
                      {warningCount > 0 && (
                        <span className="badge-warning">{warningCount} WARNING</span>
                      )}
                      {potentCount > 0 && (
                        <span className="badge-potent">{potentCount} POTENT</span>
                      )}
                      {hardCount > 0 && (
                        <span className="badge-hard">{hardCount} HARD</span>
                      )}
                      {threats.length === 0 && (
                        <span className="badge-clean">✓ LIMPIO</span>
                      )}
                    </div>
                  </div>

                  {threats.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="text-3xl mb-2">✓</div>
                      <div className="neon-green text-sm tracking-widest">SISTEMA LIMPIO</div>
                      <div className="text-xs mt-1" style={{ color: "#0d5f5f" }}>No se detectaron amenazas</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                      {threats.map((t, i) => (
                        <div
                          key={i}
                          className="threat-item px-3 py-2"
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: `1px solid ${t.level === "WARNING" ? "rgba(255,51,51,0.3)" : t.level === "POTENT" ? "rgba(255,136,0,0.3)" : "rgba(255,221,0,0.3)"}`,
                            borderRadius: "2px",
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <span className={THREAT_BADGE[t.level]}>{THREAT_ICON[t.level]} {THREAT_LABEL[t.level]}</span>
                            <span className="text-xs" style={{ color: "#0d5f5f" }}>{t.type}</span>
                          </div>
                          <div className="text-xs mt-1 truncate" style={{ color: "var(--neon-cyan)", opacity: 0.7 }}>{t.path}</div>
                          <div className="text-xs mt-0.5" style={{ color: "#0d5f5f" }}>{t.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stats Grid */}
              {status === "complete" && scanResult && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "ARCHIVOS", value: scanResult.filesScanned.toLocaleString(), color: "var(--neon-cyan)" },
                    { label: "AMENAZAS", value: threats.length.toString(), color: threats.length > 0 ? "var(--neon-red)" : "var(--neon-green)" },
                    { label: "WARNING", value: warningCount.toString(), color: "var(--neon-red)" },
                    { label: "REPARADOS", value: scanResult.fixed.toString(), color: "var(--neon-green)" },
                  ].map((stat) => (
                    <div key={stat.label} className="neon-card p-3 text-center">
                      <div className="text-lg font-bold" style={{ color: stat.color, fontFamily: "'Share Tech Mono', monospace" }}>
                        {stat.value}
                      </div>
                      <div className="text-xs tracking-widest mt-1" style={{ color: "#0d5f5f" }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── GUIDE TAB ── */}
      {activeTab === "guide" && (
        <div className="max-w-4xl mx-auto px-4 pb-8">
          <div className="neon-card p-6">
            <div className="text-xs tracking-widest mb-6 neon-cyan">GUÍA DE USO — COMANDOS DEL SCRIPT</div>

            <div className="space-y-6 text-xs" style={{ fontFamily: "'Share Tech Mono', monospace" }}>

              {/* Quick start */}
              <div>
                <div className="neon-purple mb-3 tracking-widest">── INICIO RÁPIDO ──</div>
                <div className="terminal p-3 rounded" style={{ lineHeight: "2" }}>
                  <div style={{ color: "#0d5f5f" }}># Descargar el script</div>
                  <div style={{ color: "var(--neon-green)" }}>wget scripts/antivirus/antivirus_scanner.py</div>
                  <div style={{ color: "var(--neon-green)" }}>wget scripts/antivirus/antivirus_scanner.sh</div>
                  <div className="mt-2" style={{ color: "#0d5f5f" }}># Dar permisos de ejecución</div>
                  <div style={{ color: "var(--neon-green)" }}>chmod +x antivirus_scanner.sh</div>
                </div>
              </div>

              {/* Modes */}
              <div>
                <div className="neon-purple mb-3 tracking-widest">── MODOS DE ESCANEO ──</div>
                <div className="space-y-2">
                  {[
                    { cmd: "python3 antivirus_scanner.py quick", desc: "Escaneo rápido • 2-5 min • Directorios críticos", color: "var(--neon-cyan)" },
                    { cmd: "python3 antivirus_scanner.py full", desc: "Escaneo completo • 10-30 min • Sistema completo", color: "var(--neon-purple)" },
                    { cmd: "python3 antivirus_scanner.py deep --fix", desc: "Escaneo profundo + limpiar • 30-90 min", color: "var(--neon-orange)" },
                    { cmd: "python3 antivirus_scanner.py custom --path /ruta", desc: "Escaneo personalizado de rutas específicas", color: "var(--neon-green)" },
                  ].map((item, i) => (
                    <div key={i} className="p-3" style={{ background: "#030610", border: "1px solid var(--dark-border)", borderRadius: "2px" }}>
                      <div style={{ color: item.color }}>{item.cmd}</div>
                      <div style={{ color: "#0d5f5f", marginTop: "4px" }}>  # {item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Platform */}
              <div>
                <div className="neon-purple mb-3 tracking-widest">── POR PLATAFORMA ──</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      os: "🐧 LINUX",
                      cmds: [
                        "sudo python3 antivirus_scanner.py full --fix",
                        "sudo bash antivirus_scanner.sh deep --fix",
                      ],
                    },
                    {
                      os: "🪟 WINDOWS",
                      cmds: [
                        "# Abrir CMD como Administrador:",
                        "python antivirus_scanner.py full --fix",
                      ],
                    },
                    {
                      os: "📱 ANDROID",
                      cmds: [
                        "# En Termux:",
                        "pkg install python",
                        "python3 antivirus_scanner.py quick",
                      ],
                    },
                  ].map((p, i) => (
                    <div key={i} className="neon-card p-3">
                      <div className="neon-cyan mb-2">{p.os}</div>
                      {p.cmds.map((c, j) => (
                        <div key={j} style={{ color: c.startsWith("#") ? "#0d5f5f" : "var(--neon-green)", fontSize: "11px", lineHeight: "1.8" }}>{c}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div>
                <div className="neon-purple mb-3 tracking-widest">── OPCIONES DISPONIBLES ──</div>
                <div className="terminal p-3 rounded" style={{ lineHeight: "2.2" }}>
                  {[
                    ["--fix   / -f", "Eliminar amenazas y parchear automáticamente"],
                    ["--verbose / -v", "Mostrar progreso detallado"],
                    ["--path  / -p", "Ruta personalizada (puede repetirse)"],
                  ].map(([flag, desc], i) => (
                    <div key={i} className="flex gap-4">
                      <span style={{ color: "var(--neon-cyan)", minWidth: "160px" }}>{flag}</span>
                      <span style={{ color: "#0d5f5f" }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What fix does */}
              <div>
                <div className="neon-purple mb-3 tracking-widest">── QUÉ HACE --FIX ──</div>
                <div className="space-y-1">
                  {[
                    ["✓", "Cuarentena de archivos maliciosos", "var(--neon-green)"],
                    ["✓", "Termina procesos peligrosos (PID)", "var(--neon-green)"],
                    ["✓", "Bloquea puertos: 4444, 1337, 31337, 6667...", "var(--neon-green)"],
                    ["✓", "Activa protección SYN Flood (sysctl)", "var(--neon-green)"],
                    ["✓", "Desactiva servicios inseguros (Telnet, TFTP)", "var(--neon-green)"],
                    ["✓", "Protege archivos críticos con atributo inmutable", "var(--neon-green)"],
                    ["!", "Requiere permisos root/admin para todos los parches", "var(--neon-orange)"],
                  ].map(([icon, text, color], i) => (
                    <div key={i} className="flex gap-2 text-xs" style={{ color }}>
                      <span>{icon}</span><span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ABOUT TAB ── */}
      {activeTab === "about" && (
        <div className="max-w-4xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="neon-card p-6">
              <div className="text-xs tracking-widest mb-4 neon-cyan">ACERCA DE NEXUSAV</div>
              <div className="space-y-2 text-xs" style={{ color: "#0d5f5f", lineHeight: "2" }}>
                <div><span className="neon-cyan">Versión:</span> 2.0.0</div>
                <div><span className="neon-cyan">Plataforma:</span> Windows / Linux / Android</div>
                <div><span className="neon-cyan">Motor:</span> Análisis de firmas + heurísticas</div>
                <div><span className="neon-cyan">Sin conexión:</span> Funciona 100% local</div>
                <div><span className="neon-cyan">Lenguajes:</span> Python 3.6+ / Bash 4+</div>
              </div>
            </div>

            <div className="neon-card p-6">
              <div className="text-xs tracking-widest mb-4 neon-purple">AMENAZAS QUE DETECTA</div>
              <div className="grid grid-cols-2 gap-1 text-xs" style={{ color: "#0d5f5f" }}>
                {["Ransomware", "Troyanos", "Rootkits", "DDoS Bots", "Spyware", "Cryptominers", "Backdoors", "Keyloggers", "Worms", "Adware", "Shellcode", "Código ofuscado"].map((t) => (
                  <div key={t} className="flex items-center gap-1">
                    <span style={{ color: "var(--neon-cyan)" }}>▸</span> {t}
                  </div>
                ))}
              </div>
            </div>

            <div className="neon-card p-6 sm:col-span-2">
              <div className="text-xs tracking-widest mb-4" style={{ color: "#0d5f5f" }}>ARCHIVOS DEL PROYECTO</div>
              <div className="terminal p-3 text-xs" style={{ lineHeight: "2" }}>
                <div style={{ color: "var(--neon-cyan)" }}>scripts/antivirus/</div>
                <div style={{ color: "var(--neon-green)" }}>  ├── antivirus_scanner.py   <span style={{ color: "#0d5f5f" }}>← Script principal (Win/Linux/Android)</span></div>
                <div style={{ color: "var(--neon-green)" }}>  ├── antivirus_scanner.sh   <span style={{ color: "#0d5f5f" }}>← Versión Bash (Linux/Android)</span></div>
                <div style={{ color: "var(--neon-green)" }}>  └── GUIA_DE_USO.md         <span style={{ color: "#0d5f5f" }}>← Documentación completa</span></div>
              </div>
              <div className="mt-4 text-xs" style={{ color: "#0d5f5f" }}>
                ⚠ NexusAV usa análisis de firmas y heurísticas offline. Para protección en tiempo real,
                complementar con ClamAV (Linux) o Windows Defender (Windows).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="border-t mt-4 py-3 text-center" style={{ borderColor: "var(--dark-border)" }}>
        <span className="text-xs tracking-widest" style={{ color: "#0d3f3f" }}>
          ⚡ NEXUSAV v2.0.0 — PROTECCIÓN MULTIPLATAFORMA — LINUX | WINDOWS | ANDROID
        </span>
      </footer>
    </div>
  );
}
