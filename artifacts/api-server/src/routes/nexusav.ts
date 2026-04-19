import { Router } from "express";
import { execFile, exec } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import fs from "fs";

const router = Router();
const execAsync = promisify(exec);

const WORKSPACE_ROOT = "/home/runner/workspace";
const SCRIPT_DIR = path.join(WORKSPACE_ROOT, "scripts", "antivirus");
const SH_SCRIPT  = path.join(SCRIPT_DIR, "antivirus_scanner.sh");
const PY_SCRIPT  = path.join(SCRIPT_DIR, "antivirus_scanner.py");

function stripAnsi(s: string) {
  return s.replace(/\x1B\[[0-9;]*[mGKHF]/g, "").trim();
}

function parseThreats(output: string) {
  const threats: Array<{
    type: string;
    level: "WARNING" | "POTENT" | "HARD";
    path: string;
    description: string;
  }> = [];
  const lines = output.split("\n").map(stripAnsi);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const levelMatch = line.match(/\[(?:!!!|!!|!)\]\s+\[(WARNING|POTENT|HARD)\]\s+(.+)/);
    if (levelMatch) {
      const level = levelMatch[1] as "WARNING" | "POTENT" | "HARD";
      const type  = levelMatch[2].trim().replace(/_/g, " ");
      let filePath = "";
      let description = "";

      if (lines[i + 1]?.match(/Ruta:/)) {
        filePath = lines[i + 1].replace(/.*Ruta:\s*/, "").trim();
      }
      if (lines[i + 2]?.match(/Info:/)) {
        description = lines[i + 2].replace(/.*Info:\s*/, "").trim();
      }

      const key = `${type}::${filePath}`;
      if (!threats.find((t) => `${t.type}::${t.path}` === key)) {
        threats.push({ type, level, path: filePath, description });
      }
    }
  }
  return threats;
}

function parseStats(output: string) {
  const files = parseInt(output.match(/Archivos escaneados:\s*(\d+)/)?.[1] ?? "0", 10);
  const dirs  = parseInt(output.match(/Directorios escaneados:\s*(\d+)/)?.[1] ?? "0", 10);
  const fixed = parseInt(output.match(/Reparaciones[^:]*:\s*(\d+)/)?.[1] ?? "0", 10);
  return { filesScanned: isNaN(files) ? 0 : files, dirsScanned: isNaN(dirs) ? 0 : dirs, fixed: isNaN(fixed) ? 0 : fixed };
}

router.post("/nexusav/scan", async (req, res) => {
  const { mode = "quick", autoFix = false, paths } = req.body as {
    mode?: string;
    autoFix?: boolean;
    paths?: string[];
  };

  const validModes = ["quick", "full", "deep", "custom"];
  if (!validModes.includes(mode)) {
    res.status(400).json({ success: false, error: "Modo inválido" });
    return;
  }

  const startTime = Date.now();
  const isWin     = os.platform() === "win32";

  let shellCmd: string;

  if (!isWin && fs.existsSync(SH_SCRIPT)) {
    const extraArgs: string[] = [];
    if (autoFix) extraArgs.push("--fix");
    if (mode === "custom" && paths?.length) {
      paths.forEach((p) => extraArgs.push(`--path=${p}`));
    }
    const safeArgs = [SH_SCRIPT, mode, ...extraArgs]
      .map((a) => `'${a.replace(/'/g, "'\\''")}'`)
      .join(" ");
    shellCmd = `bash ${safeArgs}`;
  } else if (fs.existsSync(PY_SCRIPT)) {
    const pyBin = isWin ? "python" : "python3";
    const extraArgs: string[] = [];
    if (autoFix) extraArgs.push("--fix");
    if (mode === "custom" && paths?.length) {
      paths.forEach((p) => extraArgs.push(`--path=${p}`));
    }
    const safeArgs = [PY_SCRIPT, mode, ...extraArgs]
      .map((a) => `'${a.replace(/'/g, "'\\''")}'`)
      .join(" ");
    shellCmd = `${pyBin} ${safeArgs}`;
  } else {
    res.status(500).json({
      success: false,
      error: "No se encontraron los scripts del scanner. Verifica que existan en scripts/antivirus/",
    });
    return;
  }

  try {
    const { stdout, stderr } = await execAsync(shellCmd, {
      cwd: process.cwd(),
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
      shell: "/bin/sh",
    });

    const combined  = stdout + stderr;
    const duration  = Math.round((Date.now() - startTime) / 1000);
    const threats   = parseThreats(combined);
    const stats     = parseStats(combined);

    res.json({
      success: true,
      result: {
        ...stats,
        threats,
        duration,
        rawOutput: combined.slice(0, 8000),
      },
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
    const combined = (e.stdout ?? "") + (e.stderr ?? "");

    if (combined.length > 100) {
      const duration  = Math.round((Date.now() - startTime) / 1000);
      const threats   = parseThreats(combined);
      const stats     = parseStats(combined);
      res.json({
        success: true,
        result: { ...stats, threats, duration, rawOutput: combined.slice(0, 8000) },
      });
      return;
    }

    const errMsg = e.killed
      ? "Tiempo límite excedido (120s). Usa modo 'quick' para escaneos más rápidos."
      : `Error al ejecutar scanner: ${e.message ?? "desconocido"}`;

    res.status(500).json({ success: false, error: errMsg });
  }
});

export default router;
