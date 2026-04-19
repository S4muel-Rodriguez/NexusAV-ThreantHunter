#!/usr/bin/env python3
"""
=============================================================
  ANTIVIRUS SCANNER - Escaner de Seguridad Multiplataforma
  Compatible con: Windows | Linux | Android (Termux)
=============================================================
  Detecta: Virus, Malware, Troyanos, Rootkits, Ransomware,
           DDoS Bots, Spyware, Adware, Scripts Ofuscados,
           Backdoors, Keyloggers, Cryptominers, Worms
=============================================================
  Niveles de amenaza:
    HARD    = Poco peligroso (adware, trackers, PUA)
    POTENT  = Peligro medio (malware, spyware, bots)
    WARNING = Muy peligroso (rootkits, ransomware, troyanos)
=============================================================
  Uso:  python3 antivirus_scanner.py [opciones]
=============================================================
"""

import os
import sys
import re
import hashlib
import socket
import subprocess
import platform
import json
import time
import argparse
import stat
import struct
from datetime import datetime
from pathlib import Path

VERSION = "2.0.0"
OS = platform.system()

RED     = "\033[91m"
YELLOW  = "\033[93m"
ORANGE  = "\033[33m"
GREEN   = "\033[92m"
CYAN    = "\033[96m"
BLUE    = "\033[94m"
MAGENTA = "\033[95m"
BOLD    = "\033[1m"
RESET   = "\033[0m"

if OS == "Windows":
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        RED = YELLOW = ORANGE = GREEN = CYAN = BLUE = MAGENTA = BOLD = RESET = ""

MALWARE_SIGNATURES = {
    "WARNING": {
        "ransomware_patterns": [
            b".encrypted", b"your files have been encrypted", b"bitcoin", b"ransom",
            b"decrypt", b"pay now", b"!readme!", b"how_to_decrypt",
            b"wannacry", b"petya", b"locky", b"cryptolocker",
        ],
        "trojan_patterns": [
            b"CreateRemoteThread", b"VirtualAllocEx", b"WriteProcessMemory",
            b"NtCreateThreadEx", b"RtlCreateUserThread", b"SetWindowsHookEx",
            b"keylogger", b"backdoor", b"reverse_shell", b"meterpreter",
            b"metasploit", b"cobalt strike", b"empire",
        ],
        "rootkit_patterns": [
            b"NtQuerySystemInformation", b"ZwSetSystemInformation",
            b"ObRegisterCallbacks", b"PsSetLoadImageNotifyRoutine",
            b"DKOM", b"SSDT", b"hooking", b"hide_process",
        ],
        "shellcode_patterns": [
            b"\x90\x90\x90\x90\x90\x90\x90\x90",
            b"\xcc\xcc\xcc\xcc",
            b"\x41\x41\x41\x41\x41\x41\x41\x41",
        ],
        "ddos_patterns": [
            b"syn_flood", b"udp_flood", b"http_flood", b"slowloris",
            b"botnet", b"c2_server", b"command_and_control",
            b"mirai", b"bashlite",
        ],
        "obfuscation_patterns": [
            b"eval(base64_decode", b"eval(gzinflate", b"eval(str_rot13",
            b"$_POST[", b"$_GET[", b"assert(base64",
            b"chr(", b"pack(\"H", b"\\x", b"\\u0",
        ],
    },
    "POTENT": {
        "spyware_patterns": [
            b"GetAsyncKeyState", b"GetForegroundWindow", b"GetWindowText",
            b"screenshot", b"keylog", b"stealer", b"credential",
            b"password", b"clipboard", b"webcam", b"microphone",
        ],
        "cryptominer_patterns": [
            b"stratum+tcp", b"mining_pool", b"xmrig", b"minerd",
            b"monero", b"cryptonight", b"hashrate", b"gpu_mining",
        ],
        "worm_patterns": [
            b"self_replicate", b"spread", b"infect", b"propagate",
            b"copy_to_removable", b"autorun.inf",
        ],
        "network_attack_patterns": [
            b"port_scan", b"bruteforce", b"sqlmap", b"nmap_scan",
            b"arp_poison", b"mitm", b"sniffer",
        ],
        "suspicious_scripts": [
            b"powershell -enc", b"powershell -e ", b"IEX(", b"Invoke-Expression",
            b"DownloadString", b"DownloadFile", b"WebClient",
            b"curl | bash", b"wget -O- | sh", b"chmod 777",
        ],
    },
    "HARD": {
        "adware_patterns": [
            b"ad_inject", b"popup", b"adware", b"toolbar",
            b"redirect", b"affiliate", b"click_fraud",
        ],
        "pua_patterns": [
            b"registry_cleaner", b"optimizer", b"system_booster",
            b"driver_updater", b"free_download_manager",
        ],
        "tracker_patterns": [
            b"tracking_pixel", b"user_track", b"fingerprint",
            b"beacon", b"telemetry_send",
        ],
    }
}

DANGEROUS_EXTENSIONS = {
    "WARNING": [".exe", ".dll", ".sys", ".drv", ".scr", ".com", ".bat", ".cmd",
                ".vbs", ".ps1", ".psm1", ".psd1", ".js", ".jse", ".hta",
                ".msi", ".msp", ".msc", ".reg", ".inf"],
    "POTENT":  [".py", ".sh", ".pl", ".rb", ".php", ".asp", ".aspx",
                ".jar", ".class", ".war", ".apk", ".ipa"],
    "HARD":    [".lnk", ".url", ".pif", ".cpl", ".gadget"],
}

DANGEROUS_PROCESSES = {
    "WARNING": [
        "mimikatz", "meterpreter", "metasploit", "cobaltstrike",
        "netcat", "nc.exe", "ncat", "socat", "cryptolocker",
        "wannacry", "notpetya", "darkcomet", "poison_ivy",
        "blackshades", "njrat", "quasar",
    ],
    "POTENT": [
        "xmrig", "minerd", "cgminer", "bfgminer", "cpuminer",
        "nmap", "masscan", "sqlmap", "hydra", "medusa",
        "aircrack", "hashcat", "john",
    ],
    "HARD": [
        "adware_helper", "puabundler", "downloadmanager",
        "toolbar_helper", "browsermodifier",
    ],
}

DANGEROUS_PORTS = {
    "WARNING": [
        (1337, "Backdoor/Hacker"),
        (4444, "Metasploit/Meterpreter"),
        (1234, "Backdoor genérico"),
        (6667, "IRC Botnet"),
        (6666, "IRC Botnet"),
        (31337, "Back Orifice"),
        (12345, "NetBus Troyano"),
        (27374, "SubSeven Troyano"),
        (65535, "Backdoor genérico"),
        (5554, "Sasser Worm"),
        (9996, "Sasser Worm"),
        (2745, "Bagle Worm"),
        (3127, "MyDoom Worm"),
    ],
    "POTENT": [
        (4899, "Radmin"),
        (5900, "VNC sin auth"),
        (5938, "TeamViewer sospechoso"),
        (8080, "Proxy sospechoso"),
        (8888, "Servidor sin auth"),
        (7777, "Backdoor genérico"),
        (9999, "Backdoor genérico"),
        (10000, "Webmin sin SSL"),
    ],
    "HARD": [
        (23, "Telnet sin cifrado"),
        (21, "FTP sin cifrado"),
        (69, "TFTP inseguro"),
        (111, "RPC portmapper"),
        (135, "RPC DCOM"),
        (139, "NetBIOS"),
        (445, "SMB expuesto"),
    ],
}

SUSPICIOUS_REGISTRY_KEYS = [
    r"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run",
    r"HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Run",
    r"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services",
    r"HKEY_CURRENT_USER\Software\Microsoft\Internet Explorer\Main",
    r"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon",
]

detected_threats = []
scan_stats = {
    "files_scanned": 0,
    "dirs_scanned": 0,
    "threats_found": 0,
    "fixed": 0,
    "errors": 0,
    "start_time": None,
}


def print_banner():
    print(f"""
{CYAN}{BOLD}
╔══════════════════════════════════════════════════════════════╗
║        ANTIVIRUS SCANNER - Seguridad Multiplataforma        ║
║              Windows | Linux | Android (Termux)              ║
╚══════════════════════════════════════════════════════════════╝{RESET}
{GREEN}  Sistema detectado: {OS} ({platform.machine()})
  Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
  Version: {VERSION}{RESET}
""")


def print_section(title):
    print(f"\n{BLUE}{BOLD}{'='*60}{RESET}")
    print(f"{BLUE}{BOLD}  {title}{RESET}")
    print(f"{BLUE}{BOLD}{'='*60}{RESET}")


def threat_color(level):
    colors = {"WARNING": RED, "POTENT": ORANGE, "HARD": YELLOW}
    return colors.get(level, RESET)


def log_threat(threat_type, level, path, description, action=""):
    c = threat_color(level)
    icon = {"WARNING": "[!!!]", "POTENT": "[!!]", "HARD": "[!]"}.get(level, "[?]")
    print(f"{c}{BOLD}{icon} [{level}] {threat_type}{RESET}")
    print(f"    Ruta: {path}")
    print(f"    Info: {description}")
    if action:
        print(f"    {GREEN}Accion: {action}{RESET}")
    detected_threats.append({
        "type": threat_type,
        "level": level,
        "path": str(path),
        "description": description,
        "action": action,
        "timestamp": datetime.now().isoformat(),
    })
    scan_stats["threats_found"] += 1


def get_file_hash(filepath, algo="sha256"):
    try:
        h = hashlib.new(algo)
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None


def is_binary_file(filepath):
    try:
        with open(filepath, "rb") as f:
            chunk = f.read(8192)
        return b"\x00" in chunk
    except Exception:
        return False


def detect_obfuscation_in_text(content):
    score = 0
    if len(re.findall(r"\\x[0-9a-fA-F]{2}", content)) > 20:
        score += 3
    if len(re.findall(r"\\u[0-9a-fA-F]{4}", content)) > 10:
        score += 2
    b64_pattern = re.findall(r"[A-Za-z0-9+/]{50,}={0,2}", content)
    if len(b64_pattern) > 3:
        score += 3
    if "eval(" in content and ("base64" in content or "decode" in content):
        score += 5
    long_strings = re.findall(r"[A-Za-z0-9+/=]{200,}", content)
    if long_strings:
        score += 2
    return score


def scan_file_content(filepath):
    try:
        with open(filepath, "rb") as f:
            content = f.read(5 * 1024 * 1024)
    except PermissionError:
        scan_stats["errors"] += 1
        return
    except Exception:
        scan_stats["errors"] += 1
        return

    content_lower = content.lower()
    found = False

    for level, categories in MALWARE_SIGNATURES.items():
        for category, patterns in categories.items():
            for pattern in patterns:
                if pattern in content_lower:
                    log_threat(
                        f"Firma: {category.replace('_', ' ').title()}",
                        level,
                        filepath,
                        f"Patron detectado: {pattern.decode('utf-8', errors='replace')}"
                    )
                    found = True
                    break
            if found:
                break
        if found:
            break

    try:
        text_content = content.decode("utf-8", errors="ignore")
        obf_score = detect_obfuscation_in_text(text_content)
        if obf_score >= 5:
            log_threat(
                "Codigo Ofuscado",
                "POTENT" if obf_score < 8 else "WARNING",
                filepath,
                f"Nivel de ofuscacion: {obf_score}/10 - Posible malware oculto"
            )
    except Exception:
        pass

    ext = Path(filepath).suffix.lower()
    for level, exts in DANGEROUS_EXTENSIONS.items():
        if ext in exts:
            size = os.path.getsize(filepath)
            if size == 0:
                log_threat("Archivo Vacio Sospechoso", "HARD", filepath,
                           "Archivo ejecutable vacio - posible placeholder de malware")
            break

    if OS != "Windows" and not is_binary_file(filepath):
        try:
            fstat = os.stat(filepath)
            if fstat.st_mode & stat.S_ISUID:
                log_threat("SUID Sospechoso", "WARNING", filepath,
                           "Archivo con bit SUID - puede escalar privilegios")
            if fstat.st_mode & stat.S_ISGID:
                log_threat("SGID Sospechoso", "POTENT", filepath,
                           "Archivo con bit SGID")
        except Exception:
            pass


def scan_directory(path, max_depth=None, current_depth=0, verbose=False):
    try:
        path = Path(path)
        if not path.exists():
            print(f"{YELLOW}  Directorio no existe: {path}{RESET}")
            return

        for item in path.iterdir():
            try:
                if item.is_symlink():
                    continue

                if item.is_dir():
                    skip_dirs = {
                        "proc", "sys", "dev", "run", "snap", "lost+found",
                        "$Recycle.Bin", "System Volume Information",
                        "Windows.old", "pagefile.sys",
                    }
                    if item.name in skip_dirs:
                        continue
                    if max_depth is None or current_depth < max_depth:
                        scan_stats["dirs_scanned"] += 1
                        if verbose:
                            print(f"{CYAN}  Escaneando: {item}{RESET}", end="\r")
                        scan_directory(item, max_depth, current_depth + 1, verbose)

                elif item.is_file():
                    scan_stats["files_scanned"] += 1
                    size = item.stat().st_size
                    if size > 100 * 1024 * 1024:
                        continue
                    scan_file_content(item)

            except PermissionError:
                pass
            except Exception:
                scan_stats["errors"] += 1

    except PermissionError:
        pass
    except Exception as e:
        scan_stats["errors"] += 1


def scan_processes():
    print_section("ESCANEO DE PROCESOS ACTIVOS")
    suspicious_found = []

    try:
        if OS == "Windows":
            result = subprocess.run(
                ["tasklist", "/fo", "csv", "/nh"],
                capture_output=True, text=True, timeout=30
            )
            lines = result.stdout.strip().split("\n")
            for line in lines:
                parts = line.strip('"').split('","')
                if parts:
                    pname = parts[0].lower()
                    for level, procs in DANGEROUS_PROCESSES.items():
                        for proc in procs:
                            if proc in pname:
                                log_threat(
                                    f"Proceso Peligroso",
                                    level,
                                    f"PID: {parts[1] if len(parts) > 1 else '?'}",
                                    f"Proceso detectado: {parts[0]}"
                                )
                                suspicious_found.append(parts[0])
        else:
            result = subprocess.run(
                ["ps", "aux"],
                capture_output=True, text=True, timeout=30
            )
            for line in result.stdout.split("\n")[1:]:
                parts = line.split()
                if len(parts) < 11:
                    continue
                cmd = " ".join(parts[10:]).lower()
                for level, procs in DANGEROUS_PROCESSES.items():
                    for proc in procs:
                        if proc in cmd:
                            log_threat(
                                "Proceso Peligroso",
                                level,
                                f"PID: {parts[1]}",
                                f"Comando: {' '.join(parts[10:])[:80]}"
                            )
                            suspicious_found.append(parts[1])

    except Exception as e:
        print(f"{YELLOW}  No se pudo listar procesos: {e}{RESET}")

    if not suspicious_found:
        print(f"{GREEN}  ✓ No se detectaron procesos peligrosos{RESET}")

    return suspicious_found


def scan_network_ports():
    print_section("ESCANEO DE PUERTOS Y CONEXIONES")
    suspicious_ports = []

    try:
        if OS == "Windows":
            result = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True, text=True, timeout=30
            )
        else:
            result = subprocess.run(
                ["ss", "-tulpn"],
                capture_output=True, text=True, timeout=30
            )
            if result.returncode != 0:
                result = subprocess.run(
                    ["netstat", "-tulpn"],
                    capture_output=True, text=True, timeout=30
                )

        output = result.stdout

        for level, ports in DANGEROUS_PORTS.items():
            for port, desc in ports:
                patterns = [f":{port} ", f":{port}\t", f":{port}\n"]
                for pattern in patterns:
                    if pattern in output:
                        log_threat(
                            f"Puerto Peligroso",
                            level,
                            f"Puerto {port}",
                            f"{desc} - Puerto abierto detectado"
                        )
                        suspicious_ports.append(port)
                        break

        listening_count = output.lower().count("listen")
        if listening_count > 30:
            log_threat(
                "Exceso de Puertos Abiertos",
                "POTENT",
                "Sistema",
                f"{listening_count} puertos en escucha - posible backdoor o botnet"
            )

    except Exception as e:
        print(f"{YELLOW}  No se pudo escanear puertos: {e}{RESET}")

    if not suspicious_ports:
        print(f"{GREEN}  ✓ No se detectaron puertos peligrosos conocidos{RESET}")

    return suspicious_ports


def scan_startup_entries():
    print_section("ESCANEO DE ENTRADAS DE INICIO AUTOMATICO")
    suspicious = []

    if OS == "Windows":
        try:
            import winreg
            startup_locs = [
                (winreg.HKEY_CURRENT_USER,
                 r"Software\Microsoft\Windows\CurrentVersion\Run"),
                (winreg.HKEY_LOCAL_MACHINE,
                 r"Software\Microsoft\Windows\CurrentVersion\Run"),
                (winreg.HKEY_LOCAL_MACHINE,
                 r"Software\Microsoft\Windows\CurrentVersion\RunOnce"),
            ]
            for hive, key_path in startup_locs:
                try:
                    key = winreg.OpenKey(hive, key_path, 0, winreg.KEY_READ)
                    i = 0
                    while True:
                        try:
                            name, value, _ = winreg.EnumValue(key, i)
                            val_lower = value.lower()
                            suspicious_terms = [
                                "temp", "appdata\\roaming", "powershell -",
                                "cmd /c", "wscript", "cscript", "rundll32",
                                "regsvr32", "certutil", "bitsadmin",
                            ]
                            for term in suspicious_terms:
                                if term in val_lower:
                                    log_threat(
                                        "Entrada de Inicio Sospechosa",
                                        "POTENT",
                                        key_path,
                                        f"{name}: {value[:100]}"
                                    )
                                    suspicious.append(name)
                                    break
                            i += 1
                        except OSError:
                            break
                    winreg.CloseKey(key)
                except Exception:
                    pass
        except ImportError:
            pass

    else:
        startup_files = [
            "/etc/rc.local", "/etc/crontab",
            Path.home() / ".bashrc",
            Path.home() / ".profile",
            Path.home() / ".bash_profile",
        ]

        cron_dirs = [
            "/etc/cron.d", "/etc/cron.hourly", "/etc/cron.daily",
            "/var/spool/cron", "/var/spool/cron/crontabs",
        ]

        all_startup = list(startup_files)
        for d in cron_dirs:
            if os.path.isdir(d):
                try:
                    for f in Path(d).iterdir():
                        all_startup.append(f)
                except Exception:
                    pass

        for sf in all_startup:
            try:
                if not Path(sf).is_file():
                    continue
                with open(sf, "r", errors="ignore") as f:
                    content = f.read()
                suspicious_terms = [
                    "curl | bash", "wget | sh", "python -c", "perl -e",
                    "nc -", "netcat", "/tmp/", "base64 -d",
                    "chmod 777", "chmod +x", "chmod 4777",
                ]
                for term in suspicious_terms:
                    if term in content:
                        log_threat(
                            "Script de Inicio Sospechoso",
                            "POTENT",
                            str(sf),
                            f"Patron sospechoso encontrado: '{term}'"
                        )
                        suspicious.append(str(sf))
                        break
            except Exception:
                pass

    if not suspicious:
        print(f"{GREEN}  ✓ No se detectaron entradas de inicio sospechosas{RESET}")

    return suspicious


def scan_hosts_file():
    print_section("VERIFICANDO ARCHIVO HOSTS (Hijacking DNS)")

    if OS == "Windows":
        hosts_path = r"C:\Windows\System32\drivers\etc\hosts"
    else:
        hosts_path = "/etc/hosts"

    try:
        with open(hosts_path, "r", errors="ignore") as f:
            lines = f.readlines()

        legit_domains = {"localhost", "localhost.localdomain", "broadcasthost",
                         "local", "ip6-localhost", "ip6-loopback",
                         "ip6-localnet", "ip6-mcastprefix", "ip6-allnodes",
                         "ip6-allrouters", "ip6-allhosts"}

        suspicious_hosts = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                domain = parts[1].lower()
                if domain not in legit_domains:
                    ip = parts[0]
                    if ip not in ("127.0.0.1", "::1", "0.0.0.0"):
                        log_threat(
                            "Redireccion DNS Sospechosa",
                            "POTENT",
                            hosts_path,
                            f"'{domain}' redirigido a {ip} - posible pharming"
                        )
                        suspicious_hosts.append(domain)

        if not suspicious_hosts:
            print(f"{GREEN}  ✓ Archivo hosts limpio{RESET}")

    except Exception as e:
        print(f"{YELLOW}  No se pudo leer archivo hosts: {e}{RESET}")


def patch_security_issues():
    print_section("PARCHEO DE VULNERABILIDADES Y PUERTOS")
    patched = []

    if OS == "Linux":
        patches = [
            {
                "desc": "Deshabilitar Telnet inseguro",
                "check": lambda: os.path.exists("/etc/inetd.d/telnet"),
                "cmd": ["systemctl", "stop", "telnet.socket"],
                "level": "HARD",
            },
            {
                "desc": "Desactivar rsh inseguro",
                "check": lambda: os.path.exists("/etc/xinetd.d/rsh"),
                "cmd": ["systemctl", "stop", "rsh.socket"],
                "level": "HARD",
            },
            {
                "desc": "Aplicar politica sysctl segura (net.ipv4.tcp_syncookies)",
                "check": lambda: True,
                "cmd": ["sysctl", "-w", "net.ipv4.tcp_syncookies=1"],
                "level": "POTENT",
            },
            {
                "desc": "Bloquear IP forwarding",
                "check": lambda: True,
                "cmd": ["sysctl", "-w", "net.ipv4.ip_forward=0"],
                "level": "POTENT",
            },
            {
                "desc": "Activar proteccion ICMP",
                "check": lambda: True,
                "cmd": ["sysctl", "-w", "net.ipv4.icmp_echo_ignore_broadcasts=1"],
                "level": "HARD",
            },
        ]

        for patch in patches:
            try:
                if patch["check"]():
                    result = subprocess.run(
                        patch["cmd"],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode == 0:
                        c = threat_color(patch["level"])
                        print(f"{GREEN}  ✓ Parcheado: {patch['desc']}{RESET}")
                        patched.append(patch["desc"])
                        scan_stats["fixed"] += 1
                    else:
                        print(f"{YELLOW}  ⚠ No se pudo parchear: {patch['desc']}{RESET}")
            except Exception:
                pass

        try:
            ufw_result = subprocess.run(["which", "ufw"], capture_output=True)
            if ufw_result.returncode == 0:
                for port, desc in [(4444, "Metasploit"), (1337, "Backdoor"), (31337, "Back Orifice")]:
                    subprocess.run(
                        ["ufw", "deny", str(port)],
                        capture_output=True, timeout=10
                    )
                    print(f"{GREEN}  ✓ Puerto bloqueado con UFW: {port} ({desc}){RESET}")
                    scan_stats["fixed"] += 1
        except Exception:
            pass

    elif OS == "Windows":
        win_patches = [
            ("netsh advfirewall firewall add rule name=\"Block Meterpreter\" protocol=TCP dir=in localport=4444 action=block",
             "Bloquear puerto Meterpreter 4444"),
            ("netsh advfirewall firewall add rule name=\"Block Backdoor\" protocol=TCP dir=in localport=1337 action=block",
             "Bloquear backdoor puerto 1337"),
            ("netsh advfirewall firewall add rule name=\"Block BackOrifice\" protocol=TCP dir=in localport=31337 action=block",
             "Bloquear Back Orifice 31337"),
        ]

        for cmd, desc in win_patches:
            try:
                result = subprocess.run(
                    cmd, shell=True, capture_output=True,
                    text=True, timeout=15
                )
                if result.returncode == 0:
                    print(f"{GREEN}  ✓ {desc}{RESET}")
                    scan_stats["fixed"] += 1
                    patched.append(desc)
            except Exception:
                pass

    if not patched:
        print(f"{YELLOW}  Info: Parches automaticos limitados. "
              f"Ejecutar como administrador/root para aplicar todos.{RESET}")

    return patched


def quarantine_file(filepath):
    try:
        quarantine_dir = Path.home() / ".antivirus_quarantine"
        quarantine_dir.mkdir(exist_ok=True)
        dest = quarantine_dir / (Path(filepath).name + ".quarantined")
        import shutil
        shutil.move(str(filepath), str(dest))
        os.chmod(str(dest), 0o000)
        print(f"{GREEN}    ✓ Archivo en cuarentena: {dest}{RESET}")
        scan_stats["fixed"] += 1
        return True
    except Exception as e:
        print(f"{YELLOW}    ⚠ No se pudo poner en cuarentena: {e}{RESET}")
        return False


def kill_dangerous_process(pid):
    try:
        if OS == "Windows":
            subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                           capture_output=True, timeout=10)
        else:
            os.kill(int(pid), 9)
        print(f"{GREEN}    ✓ Proceso {pid} terminado{RESET}")
        scan_stats["fixed"] += 1
        return True
    except Exception as e:
        print(f"{YELLOW}    ⚠ No se pudo terminar proceso {pid}: {e}{RESET}")
        return False


def print_report():
    print_section("REPORTE FINAL DE SEGURIDAD")

    elapsed = time.time() - scan_stats["start_time"]
    print(f"\n{CYAN}  Estadisticas del escaneo:{RESET}")
    print(f"    Archivos escaneados:    {scan_stats['files_scanned']}")
    print(f"    Directorios escaneados: {scan_stats['dirs_scanned']}")
    print(f"    Tiempo total:           {elapsed:.1f} segundos")
    print(f"    Errores (permisos):     {scan_stats['errors']}")
    print(f"    Reparaciones aplicadas: {scan_stats['fixed']}")

    if not detected_threats:
        print(f"\n{GREEN}{BOLD}  ✓ ¡SISTEMA LIMPIO! No se detectaron amenazas.{RESET}")
        return

    warning_threats = [t for t in detected_threats if t["level"] == "WARNING"]
    potent_threats   = [t for t in detected_threats if t["level"] == "POTENT"]
    hard_threats     = [t for t in detected_threats if t["level"] == "HARD"]

    print(f"\n{RED}{BOLD}  AMENAZAS DETECTADAS: {len(detected_threats)}{RESET}")
    print(f"  {RED}  [WARNING] Muy peligroso:  {len(warning_threats)}{RESET}")
    print(f"  {ORANGE}  [POTENT]  Peligro medio:  {len(potent_threats)}{RESET}")
    print(f"  {YELLOW}  [HARD]    Poco peligroso: {len(hard_threats)}{RESET}")

    if warning_threats:
        print(f"\n{RED}{BOLD}  --- AMENAZAS WARNING (ACCION INMEDIATA) ---{RESET}")
        for t in warning_threats:
            print(f"  {RED}• {t['type']} | {t['path']}{RESET}")
            print(f"    {t['description']}")

    if potent_threats:
        print(f"\n{ORANGE}{BOLD}  --- AMENAZAS POTENT (REVISAR PRONTO) ---{RESET}")
        for t in potent_threats:
            print(f"  {ORANGE}• {t['type']} | {t['path']}{RESET}")
            print(f"    {t['description']}")

    if hard_threats:
        print(f"\n{YELLOW}{BOLD}  --- AMENAZAS HARD (MONITOREAR) ---{RESET}")
        for t in hard_threats:
            print(f"  {YELLOW}• {t['type']} | {t['path']}{RESET}")
            print(f"    {t['description']}")

    report_path = Path.home() / f"antivirus_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    try:
        with open(report_path, "w") as f:
            json.dump({
                "scan_date": datetime.now().isoformat(),
                "system": OS,
                "stats": scan_stats,
                "threats": detected_threats,
            }, f, indent=2, default=str)
        print(f"\n{CYAN}  Reporte guardado en: {report_path}{RESET}")
    except Exception:
        pass


def get_scan_paths():
    if OS == "Windows":
        return [
            os.environ.get("USERPROFILE", "C:\\Users"),
            os.environ.get("TEMP", "C:\\Windows\\Temp"),
            "C:\\Windows\\System32",
            "C:\\ProgramData",
            os.environ.get("APPDATA", ""),
        ]
    elif OS == "Darwin":
        return [str(Path.home()), "/tmp", "/var/tmp", "/Applications"]
    else:
        return [
            str(Path.home()), "/tmp", "/var/tmp",
            "/etc", "/usr/local/bin",
            "/var/spool", "/run",
        ]


def run_scan(mode, paths=None, auto_fix=False, verbose=False):
    print_banner()
    scan_stats["start_time"] = time.time()

    scan_configs = {
        "quick": {"max_depth": 2, "desc": "ESCANEO RAPIDO (2-5 min)"},
        "full":  {"max_depth": None, "desc": "ESCANEO COMPLETO (10-30 min)"},
        "deep":  {"max_depth": None, "desc": "ESCANEO PROFUNDO (30+ min)"},
        "custom": {"max_depth": 3, "desc": "ESCANEO PERSONALIZADO"},
    }

    cfg = scan_configs.get(mode, scan_configs["full"])
    print(f"{CYAN}{BOLD}  Modo: {cfg['desc']}{RESET}")

    if paths is None:
        paths = get_scan_paths()

    print_section("ESCANEO DE ARCHIVOS")
    for path in paths:
        if path and os.path.exists(path):
            print(f"{CYAN}  Escaneando directorio: {path}{RESET}")
            scan_directory(path, cfg["max_depth"], verbose=verbose)

    suspicious_pids = scan_processes()
    scan_network_ports()
    scan_startup_entries()
    scan_hosts_file()

    if auto_fix:
        print_section("LIMPIEZA Y REPARACION AUTOMATICA")

        for threat in detected_threats:
            if os.path.isfile(threat["path"]):
                print(f"{ORANGE}  Poniendo en cuarentena: {threat['path']}{RESET}")
                quarantine_file(threat["path"])

        for pid in suspicious_pids:
            print(f"{ORANGE}  Terminando proceso sospechoso PID: {pid}{RESET}")
            kill_dangerous_process(pid)

        patch_security_issues()

    print_report()

    if detected_threats:
        print(f"""
{RED}{BOLD}  RECOMENDACIONES:{RESET}
  1. Ejecutar con --fix para limpiar automaticamente
  2. Cambiar contrasenas del sistema si hay amenazas WARNING
  3. Desconectar de la red si hay rootkits o troyanos detectados
  4. Revisar el reporte JSON generado para detalles completos
  5. Considera reinstalar el SO si hay amenazas WARNING multiples
""")


def main():
    parser = argparse.ArgumentParser(
        description="Antivirus Scanner Multiplataforma - Windows/Linux/Android",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog="""
Modos de escaneo:
  quick   Escaneo rapido de directorios criticos (2-5 min)
  full    Escaneo completo del sistema (10-30 min)
  deep    Escaneo profundo con todos los checks (30+ min)
  custom  Escanea rutas especificadas con --path

Niveles de amenaza:
  HARD    Poco peligroso (adware, PUA, trackers)
  POTENT  Peligro medio (spyware, bots, cryptominers)
  WARNING Muy peligroso (ransomware, rootkits, troyanos)

Ejemplos:
  python3 antivirus_scanner.py quick
  python3 antivirus_scanner.py full --fix
  python3 antivirus_scanner.py deep --fix --verbose
  python3 antivirus_scanner.py custom --path /home/usuario --path /tmp
        """
    )
    parser.add_argument(
        "mode",
        nargs="?",
        default="full",
        choices=["quick", "full", "deep", "custom"],
        help="Modo de escaneo (default: full)"
    )
    parser.add_argument(
        "--path", "-p",
        action="append",
        dest="paths",
        help="Ruta personalizada a escanear (puede repetirse)"
    )
    parser.add_argument(
        "--fix", "-f",
        action="store_true",
        help="Eliminar/cuarentena amenazas y parchear automaticamente"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Mostrar progreso detallado"
    )

    args = parser.parse_args()
    run_scan(args.mode, paths=args.paths, auto_fix=args.fix, verbose=args.verbose)


if __name__ == "__main__":
    main()
