#!/usr/bin/env bash
# =============================================================
#   ANTIVIRUS SCANNER - Bash Edition
#   Compatible con: Linux | Android (Termux) | macOS
# =============================================================
#   Detecta: Virus, Malware, Troyanos, Rootkits, Ransomware,
#            DDoS Bots, Spyware, Scripts Ofuscados, Backdoors
# =============================================================
#   Niveles de amenaza:
#     HARD    = Poco peligroso (adware, trackers, PUA)
#     POTENT  = Peligro medio (malware, spyware, bots)
#     WARNING = Muy peligroso (rootkits, ransomware, troyanos)
# =============================================================
#   USO: bash antivirus_scanner.sh [modo] [opciones]
# =============================================================

set -euo pipefail

RED='\033[91m'
YELLOW='\033[93m'
ORANGE='\033[33m'
GREEN='\033[92m'
CYAN='\033[96m'
BLUE='\033[94m'
BOLD='\033[1m'
RESET='\033[0m'

VERSION="2.0.0"
SCAN_MODE="${1:-full}"
AUTO_FIX=false
VERBOSE=false
CUSTOM_PATHS=()
THREATS_FOUND=0
FILES_SCANNED=0
DIRS_SCANNED=0
FIXED=0
REPORT_FILE="$HOME/antivirus_report_$(date +%Y%m%d_%H%M%S).txt"
QUARANTINE_DIR="$HOME/.antivirus_quarantine"

for arg in "$@"; do
    case "$arg" in
        --fix|-f)   AUTO_FIX=true ;;
        --verbose|-v) VERBOSE=true ;;
        --path=*)   CUSTOM_PATHS+=("${arg#--path=}") ;;
        -p)         shift; CUSTOM_PATHS+=("$1") ;;
    esac
done

log_threat() {
    local TYPE="$1"
    local LEVEL="$2"
    local PATH_INFO="$3"
    local DESC="$4"
    local COLOR="$YELLOW"
    local ICON="[!]"
    case "$LEVEL" in
        WARNING) COLOR="$RED";    ICON="[!!!]" ;;
        POTENT)  COLOR="$ORANGE"; ICON="[!!]"  ;;
        HARD)    COLOR="$YELLOW"; ICON="[!]"   ;;
    esac
    echo -e "${COLOR}${BOLD}${ICON} [${LEVEL}] ${TYPE}${RESET}"
    echo    "    Ruta: $PATH_INFO"
    echo    "    Info: $DESC"
    echo -e "${COLOR}${BOLD}${ICON} [${LEVEL}] ${TYPE}${RESET}" >> "$REPORT_FILE"
    echo    "    Ruta: $PATH_INFO"                              >> "$REPORT_FILE"
    echo    "    Info: $DESC"                                   >> "$REPORT_FILE"
    THREATS_FOUND=$((THREATS_FOUND + 1))
}

print_section() {
    echo ""
    echo -e "${BLUE}${BOLD}============================================================${RESET}"
    echo -e "${BLUE}${BOLD}  $1${RESET}"
    echo -e "${BLUE}${BOLD}============================================================${RESET}"
    echo "============================================================" >> "$REPORT_FILE"
    echo "  $1"                                                          >> "$REPORT_FILE"
    echo "============================================================" >> "$REPORT_FILE"
}

print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║       ANTIVIRUS SCANNER - Bash Edition (Linux/Android)       ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
    echo -e "${GREEN}  Sistema: $(uname -o 2>/dev/null || uname -s) - $(uname -m)"
    echo    "  Fecha:   $(date '+%d/%m/%Y %H:%M:%S')"
    echo -e "  Version: $VERSION${RESET}"
    echo ""
    echo "ANTIVIRUS SCANNER REPORT"           > "$REPORT_FILE"
    echo "Fecha: $(date '+%d/%m/%Y %H:%M:%S')" >> "$REPORT_FILE"
    echo "Sistema: $(uname -s) $(uname -m)"    >> "$REPORT_FILE"
    echo ""                                    >> "$REPORT_FILE"
}

# ─── Firmas de malware ────────────────────────────────────────
RANSOMWARE_SIGS=(
    "your files have been encrypted"
    "bitcoin" "ransom" "decrypt" "pay now"
    "!readme!" "how_to_decrypt" "wannacry"
    "petya" "locky" "cryptolocker"
)

TROJAN_SIGS=(
    "CreateRemoteThread" "VirtualAllocEx" "WriteProcessMemory"
    "keylogger" "backdoor" "reverse_shell" "meterpreter"
    "metasploit" "cobalt strike"
)

ROOTKIT_SIGS=(
    "NtQuerySystemInformation" "DKOM" "SSDT" "hooking"
    "hide_process" "ObRegisterCallbacks"
)

DDOS_SIGS=(
    "syn_flood" "udp_flood" "http_flood" "botnet"
    "c2_server" "mirai" "bashlite" "slowloris"
)

SHELLCODE_SIGS=(
    "x90x90x90x90x90x90x90x90"
    "eval(base64_decode" "eval(gzinflate"
    "chr(" "assert(base64"
)

SPYWARE_SIGS=(
    "GetAsyncKeyState" "screenshot" "keylog" "stealer"
    "credential" "clipboard" "webcam" "microphone"
)

CRYPTOMINER_SIGS=(
    "stratum+tcp" "mining_pool" "xmrig" "minerd"
    "monero" "cryptonight" "hashrate"
)

SUSPICIOUS_SCRIPTS=(
    "powershell -enc" "powershell -e " "IEX(" "Invoke-Expression"
    "DownloadString" "curl | bash" "wget -O- | sh"
    "chmod 777" "base64 -d | sh"
)

# ─── Procesos peligrosos ─────────────────────────────────────
WARNING_PROCESSES=(
    "mimikatz" "meterpreter" "metasploit"
    "nc " "ncat" "socat" "cryptolocker"
    "wannacry" "darkcomet" "njrat"
)

POTENT_PROCESSES=(
    "xmrig" "minerd" "cgminer" "cpuminer"
    "nmap" "masscan" "sqlmap" "hydra"
    "aircrack" "hashcat"
)

# ─── Puertos peligrosos ──────────────────────────────────────
WARNING_PORTS=("1337:Backdoor_Hacker" "4444:Metasploit_Meterpreter"
    "6667:IRC_Botnet" "6666:IRC_Botnet" "31337:Back_Orifice"
    "12345:NetBus_Troyano" "27374:SubSeven_Troyano"
    "5554:Sasser_Worm" "2745:Bagle_Worm" "3127:MyDoom_Worm")

POTENT_PORTS=("4899:Radmin" "5900:VNC_sin_auth"
    "8888:Servidor_sin_auth" "9999:Backdoor_generico"
    "7777:Backdoor_generico")

HARD_PORTS=("23:Telnet_inseguro" "21:FTP_inseguro"
    "111:RPC_portmapper" "139:NetBIOS" "445:SMB_expuesto")

# ─── Funciones de escaneo ─────────────────────────────────────

scan_file() {
    local FILE="$1"
    local FOUND=false

    if [ ! -r "$FILE" ]; then return; fi

    local SIZE
    SIZE=$(stat -c%s "$FILE" 2>/dev/null || stat -f%z "$FILE" 2>/dev/null || echo 0)
    SIZE="${SIZE//[^0-9]/}"
    SIZE="${SIZE:-0}"
    if [ "$SIZE" -gt $((50 * 1024 * 1024)) ]; then return; fi

    FILES_SCANNED=$((FILES_SCANNED + 1))

    local CONTENT
    CONTENT=$(strings "$FILE" 2>/dev/null | tr '[:upper:]' '[:lower:]' | head -c 200000 || true)

    if [ -z "$CONTENT" ]; then return; fi

    for sig in "${RANSOMWARE_SIGS[@]}"; do
        if echo "$CONTENT" | grep -qF "$sig" 2>/dev/null; then
            log_threat "Ransomware" "WARNING" "$FILE" "Firma detectada: '$sig'"
            FOUND=true; break
        fi
    done

    if ! $FOUND; then
        for sig in "${TROJAN_SIGS[@]}"; do
            if echo "$CONTENT" | grep -qF "$sig" 2>/dev/null; then
                log_threat "Troyano" "WARNING" "$FILE" "Firma detectada: '$sig'"
                FOUND=true; break
            fi
        done
    fi

    if ! $FOUND; then
        for sig in "${ROOTKIT_SIGS[@]}"; do
            if echo "$CONTENT" | grep -qF "$sig" 2>/dev/null; then
                log_threat "Rootkit" "WARNING" "$FILE" "Firma de rootkit: '$sig'"
                FOUND=true; break
            fi
        done
    fi

    if ! $FOUND; then
        for sig in "${DDOS_SIGS[@]}"; do
            if echo "$CONTENT" | grep -qF "$sig" 2>/dev/null; then
                log_threat "DDoS_Bot" "WARNING" "$FILE" "Patron DDoS: '$sig'"
                FOUND=true; break
            fi
        done
    fi

    if ! $FOUND; then
        for sig in "${SPYWARE_SIGS[@]}"; do
            if echo "$CONTENT" | grep -qF "$sig" 2>/dev/null; then
                log_threat "Spyware" "POTENT" "$FILE" "Firma spyware: '$sig'"
                FOUND=true; break
            fi
        done
    fi

    if ! $FOUND; then
        for sig in "${CRYPTOMINER_SIGS[@]}"; do
            if echo "$CONTENT" | grep -qF "$sig" 2>/dev/null; then
                log_threat "CryptoMiner" "POTENT" "$FILE" "Firma minero: '$sig'"
                FOUND=true; break
            fi
        done
    fi

    if ! $FOUND; then
        for sig in "${SUSPICIOUS_SCRIPTS[@]}"; do
            if echo "$CONTENT" | grep -qF "$sig" 2>/dev/null; then
                log_threat "Script_Sospechoso" "POTENT" "$FILE" "Patron: '$sig'"
                FOUND=true; break
            fi
        done
    fi

    local B64_COUNT
    B64_COUNT=$(echo "$CONTENT" | grep -oE '[A-Za-z0-9+/]{60,}={0,2}' 2>/dev/null | wc -l | tr -d ' ' || echo 0)
    B64_COUNT="${B64_COUNT//[^0-9]/}"
    B64_COUNT="${B64_COUNT:-0}"
    if [ "$B64_COUNT" -gt 5 ] && ! $FOUND; then
        log_threat "Codigo_Ofuscado" "POTENT" "$FILE" \
            "Posible ofuscacion Base64: $B64_COUNT bloques detectados"
        FOUND=true
    fi

    local HEX_COUNT
    HEX_COUNT=$(echo "$CONTENT" | grep -oE '(\\x[0-9a-f]{2}){5,}' 2>/dev/null | wc -l | tr -d ' ' || echo 0)
    HEX_COUNT="${HEX_COUNT//[^0-9]/}"
    HEX_COUNT="${HEX_COUNT:-0}"
    if [ "$HEX_COUNT" -gt 3 ] && ! $FOUND; then
        log_threat "Shellcode_Probable" "WARNING" "$FILE" \
            "Secuencias hexadecimales sospechosas: $HEX_COUNT"
        FOUND=true
    fi

    if [ -x "$FILE" ]; then
        local PERMS
        PERMS=$(stat -c%a "$FILE" 2>/dev/null || stat -f%Mp%Lp "$FILE" 2>/dev/null || echo "000")
        if [[ "$PERMS" == *"4"* ]] || [[ "$PERMS" == "4777" ]] || [[ "$PERMS" == "4755" ]]; then
            log_threat "SUID_Peligroso" "WARNING" "$FILE" \
                "Bit SUID activo (permisos: $PERMS) - puede escalar privilegios"
        fi
    fi
}

scan_directory_recursive() {
    local DIR="$1"
    local DEPTH="${2:-99}"
    local CURRENT="${3:-0}"

    if [ "$CURRENT" -ge "$DEPTH" ]; then return; fi
    if [ ! -d "$DIR" ] || [ ! -r "$DIR" ]; then return; fi

    local SKIP_DIRS=("proc" "sys" "dev" "run" "snap" "lost+found" "selinux")
    local BASENAME
    BASENAME=$(basename "$DIR")
    for skip in "${SKIP_DIRS[@]}"; do
        if [ "$BASENAME" = "$skip" ]; then return; fi
    done

    DIRS_SCANNED=$((DIRS_SCANNED + 1))

    if $VERBOSE; then
        echo -e "${CYAN}  Escaneando: $DIR${RESET}"
    fi

    while IFS= read -r -d '' FILE; do
        if [ -f "$FILE" ] && [ ! -L "$FILE" ]; then
            scan_file "$FILE"
        fi
    done < <(find "$DIR" -maxdepth 1 -type f -print0 2>/dev/null)

    while IFS= read -r -d '' SUBDIR; do
        if [ -d "$SUBDIR" ] && [ ! -L "$SUBDIR" ]; then
            scan_directory_recursive "$SUBDIR" "$DEPTH" "$((CURRENT + 1))"
        fi
    done < <(find "$DIR" -maxdepth 1 -type d -not -path "$DIR" -print0 2>/dev/null)
}

scan_processes() {
    print_section "ESCANEO DE PROCESOS ACTIVOS"
    local FOUND_PROCS=()

    local PS_OUTPUT
    PS_OUTPUT=$(ps aux 2>/dev/null || ps -A 2>/dev/null || true)

    for proc in "${WARNING_PROCESSES[@]}"; do
        local MATCHES
        MATCHES=$(echo "$PS_OUTPUT" | grep -i "$proc" | grep -v "grep" | grep -v "antivirus" || true)
        if [ -n "$MATCHES" ]; then
            local PID
            PID=$(echo "$MATCHES" | awk '{print $2}' | head -1)
            log_threat "Proceso_Peligroso" "WARNING" "PID:$PID" \
                "Proceso detectado: $proc"
            FOUND_PROCS+=("$PID")
        fi
    done

    for proc in "${POTENT_PROCESSES[@]}"; do
        local MATCHES
        MATCHES=$(echo "$PS_OUTPUT" | grep -i "$proc" | grep -v "grep" | grep -v "antivirus" || true)
        if [ -n "$MATCHES" ]; then
            local PID
            PID=$(echo "$MATCHES" | awk '{print $2}' | head -1)
            log_threat "Proceso_Sospechoso" "POTENT" "PID:$PID" \
                "Proceso detectado: $proc"
            FOUND_PROCS+=("$PID")
        fi
    done

    if [ ${#FOUND_PROCS[@]} -eq 0 ]; then
        echo -e "${GREEN}  ✓ No se detectaron procesos peligrosos${RESET}"
    fi

    echo "${FOUND_PROCS[@]:-}"
}

scan_network() {
    print_section "ESCANEO DE PUERTOS Y CONEXIONES DE RED"

    local NET_OUTPUT=""
    if command -v ss &>/dev/null; then
        NET_OUTPUT=$(ss -tulpn 2>/dev/null || true)
    elif command -v netstat &>/dev/null; then
        NET_OUTPUT=$(netstat -tulpn 2>/dev/null || true)
    fi

    local FOUND_PORTS=false

    for entry in "${WARNING_PORTS[@]}"; do
        local PORT="${entry%%:*}"
        local DESC="${entry#*:}"
        if echo "$NET_OUTPUT" | grep -qE ":${PORT}[[:space:]]|:${PORT}$"; then
            log_threat "Puerto_Peligroso" "WARNING" "Puerto $PORT" \
                "${DESC//_/ } - Puerto abierto"
            FOUND_PORTS=true
        fi
    done

    for entry in "${POTENT_PORTS[@]}"; do
        local PORT="${entry%%:*}"
        local DESC="${entry#*:}"
        if echo "$NET_OUTPUT" | grep -qE ":${PORT}[[:space:]]|:${PORT}$"; then
            log_threat "Puerto_Sospechoso" "POTENT" "Puerto $PORT" \
                "${DESC//_/ } - Puerto abierto"
            FOUND_PORTS=true
        fi
    done

    for entry in "${HARD_PORTS[@]}"; do
        local PORT="${entry%%:*}"
        local DESC="${entry#*:}"
        if echo "$NET_OUTPUT" | grep -qE ":${PORT}[[:space:]]|:${PORT}$"; then
            log_threat "Puerto_Inseguro" "HARD" "Puerto $PORT" \
                "${DESC//_/ } - Protocolo inseguro activo"
            FOUND_PORTS=true
        fi
    done

    if ! $FOUND_PORTS; then
        echo -e "${GREEN}  ✓ No se detectaron puertos peligrosos conocidos${RESET}"
    fi
}

scan_startup() {
    print_section "ESCANEO DE ENTRADAS DE INICIO AUTOMATICO"
    local FOUND_STARTUP=false

    local STARTUP_FILES=(
        "/etc/rc.local"
        "/etc/crontab"
        "$HOME/.bashrc"
        "$HOME/.profile"
        "$HOME/.bash_profile"
        "$HOME/.zshrc"
    )

    local CRON_DIRS=("/etc/cron.d" "/etc/cron.hourly" "/etc/cron.daily" "/var/spool/cron")

    for dir in "${CRON_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            while IFS= read -r -d '' f; do
                STARTUP_FILES+=("$f")
            done < <(find "$dir" -type f -print0 2>/dev/null)
        fi
    done

    local SUSPICIOUS_TERMS=(
        "curl | bash" "wget | sh" "wget -O- | sh"
        "python -c" "perl -e" "ruby -e"
        "nc -" "netcat" "/tmp/" "base64 -d"
        "chmod 777" "chmod +x /tmp" "chmod 4777"
        "xmrig" "minerd" "stratum+tcp"
    )

    for sf in "${STARTUP_FILES[@]}"; do
        if [ -f "$sf" ] && [ -r "$sf" ]; then
            for term in "${SUSPICIOUS_TERMS[@]}"; do
                if grep -qF "$term" "$sf" 2>/dev/null; then
                    log_threat "Script_Inicio_Sospechoso" "POTENT" "$sf" \
                        "Patron encontrado: '$term'"
                    FOUND_STARTUP=true
                    break
                fi
            done
        fi
    done

    if command -v systemctl &>/dev/null; then
        local SUSPICIOUS_SERVICES
        SUSPICIOUS_SERVICES=$(systemctl list-units --type=service --state=running 2>/dev/null | \
            grep -iE "(miner|xmrig|bot|rat|backdoor|crypto)" | awk '{print $1}' || true)
        if [ -n "$SUSPICIOUS_SERVICES" ]; then
            log_threat "Servicio_Sospechoso" "POTENT" "systemd" \
                "Servicios sospechosos: $SUSPICIOUS_SERVICES"
            FOUND_STARTUP=true
        fi
    fi

    if ! $FOUND_STARTUP; then
        echo -e "${GREEN}  ✓ No se detectaron entradas de inicio sospechosas${RESET}"
    fi
}

scan_hosts_file() {
    print_section "VERIFICANDO ARCHIVO HOSTS (Hijacking DNS)"

    local HOSTS_FILE="/etc/hosts"
    if [ ! -f "$HOSTS_FILE" ]; then return; fi

    local LEGIT_DOMAINS=("localhost" "localhost.localdomain" "broadcasthost" "local"
        "ip6-localhost" "ip6-loopback" "ip6-localnet" "ip6-mcastprefix"
        "ip6-allnodes" "ip6-allrouters" "ip6-allhosts")

    local FOUND_HIJACK=false

    while IFS= read -r line; do
        [[ "$line" =~ ^# ]] && continue
        [[ -z "$line" ]] && continue
        read -ra PARTS <<< "$line"
        if [ ${#PARTS[@]} -ge 2 ]; then
            local IP="${PARTS[0]}"
            local DOMAIN="${PARTS[1]}"
            local IS_LEGIT=false
            for legit in "${LEGIT_DOMAINS[@]}"; do
                if [ "$DOMAIN" = "$legit" ]; then IS_LEGIT=true; break; fi
            done
            if ! $IS_LEGIT && [[ "$IP" != "127.0.0.1" ]] && \
               [[ "$IP" != "::1" ]] && [[ "$IP" != "0.0.0.0" ]]; then
                log_threat "Redireccion_DNS_Sospechosa" "POTENT" "$HOSTS_FILE" \
                    "'$DOMAIN' redirigido a $IP - posible pharming/hijacking"
                FOUND_HIJACK=true
            fi
        fi
    done < "$HOSTS_FILE"

    if ! $FOUND_HIJACK; then
        echo -e "${GREEN}  ✓ Archivo hosts limpio${RESET}"
    fi
}

scan_suid_files() {
    print_section "BUSCANDO ARCHIVOS SUID/SGID SOSPECHOSOS"
    local FOUND=false

    local LEGIT_SUID=(
        "/usr/bin/passwd" "/usr/bin/sudo" "/usr/bin/su"
        "/bin/ping" "/usr/bin/ping" "/usr/bin/newgrp"
        "/usr/bin/chfn" "/usr/bin/chsh" "/usr/bin/gpasswd"
        "/usr/bin/pkexec" "/usr/lib/dbus-1.0/dbus-daemon-launch-helper"
        "/usr/lib/openssh/ssh-keysign" "/bin/mount" "/bin/umount"
    )

    while IFS= read -r -d '' FILE; do
        local IS_LEGIT=false
        for legit in "${LEGIT_SUID[@]}"; do
            if [ "$FILE" = "$legit" ]; then IS_LEGIT=true; break; fi
        done
        if ! $IS_LEGIT; then
            local PERMS
            PERMS=$(stat -c%a "$FILE" 2>/dev/null || echo "?")
            log_threat "SUID_SGID_Sospechoso" "WARNING" "$FILE" \
                "Archivo SUID/SGID no estandar (perms: $PERMS) - revisar urgente"
            FOUND=true
        fi
    done < <(find / -perm /6000 -type f -print0 2>/dev/null)

    if ! $FOUND; then
        echo -e "${GREEN}  ✓ Solo archivos SUID/SGID legitimos encontrados${RESET}"
    fi
}

scan_world_writable() {
    print_section "BUSCANDO ARCHIVOS CON ESCRITURA GLOBAL"
    local COUNT=0

    while IFS= read -r -d '' FILE; do
        if [[ "$FILE" != *"/proc/"* ]] && [[ "$FILE" != *"/sys/"* ]]; then
            log_threat "Escritura_Global" "HARD" "$FILE" \
                "Archivo world-writable - cualquiera puede modificarlo"
            COUNT=$((COUNT + 1))
            if [ "$COUNT" -ge 20 ]; then
                echo -e "${YELLOW}  ... (mostrando primeros 20, pueden haber mas)${RESET}"
                break
            fi
        fi
    done < <(find / -perm -002 -type f -print0 2>/dev/null)

    if [ "$COUNT" -eq 0 ]; then
        echo -e "${GREEN}  ✓ No se encontraron archivos con escritura global${RESET}"
    fi
}

patch_security() {
    print_section "PARCHEO DE SEGURIDAD Y CIERRE DE PUERTOS"

    if [ "$EUID" -ne 0 ] && [ "$(id -u)" -ne 0 ]; then
        echo -e "${YELLOW}  ⚠ Ejecutar como root para aplicar todos los parches${RESET}"
        echo -e "${YELLOW}  Aplicando parches disponibles sin root...${RESET}"
    fi

    if command -v sysctl &>/dev/null && [ "$EUID" -eq 0 ] 2>/dev/null; then
        local SYSCTL_PARAMS=(
            "net.ipv4.tcp_syncookies=1"
            "net.ipv4.icmp_echo_ignore_broadcasts=1"
            "net.ipv4.conf.all.accept_redirects=0"
            "net.ipv4.conf.all.send_redirects=0"
            "net.ipv4.conf.all.accept_source_route=0"
            "net.ipv6.conf.all.accept_redirects=0"
            "kernel.randomize_va_space=2"
            "net.ipv4.tcp_rfc1337=1"
        )
        for param in "${SYSCTL_PARAMS[@]}"; do
            if sysctl -w "$param" &>/dev/null; then
                echo -e "${GREEN}  ✓ Aplicado: sysctl $param${RESET}"
                FIXED=$((FIXED + 1))
            fi
        done
        echo ""
    fi

    if command -v ufw &>/dev/null && [ "$EUID" -eq 0 ] 2>/dev/null; then
        echo -e "${CYAN}  Bloqueando puertos peligrosos con UFW...${RESET}"
        local BLOCK_PORTS=(4444 1337 31337 12345 27374 6667 6666 5554 2745 3127)
        for port in "${BLOCK_PORTS[@]}"; do
            if ufw deny "$port" &>/dev/null; then
                echo -e "${GREEN}  ✓ Puerto bloqueado: $port${RESET}"
                FIXED=$((FIXED + 1))
            fi
        done
    elif command -v iptables &>/dev/null && [ "$EUID" -eq 0 ] 2>/dev/null; then
        echo -e "${CYAN}  Bloqueando puertos con iptables...${RESET}"
        local BLOCK_PORTS=(4444 1337 31337 12345 27374 6667 5554)
        for port in "${BLOCK_PORTS[@]}"; do
            if iptables -A INPUT -p tcp --dport "$port" -j DROP &>/dev/null; then
                echo -e "${GREEN}  ✓ Puerto bloqueado: $port${RESET}"
                FIXED=$((FIXED + 1))
            fi
            if iptables -A INPUT -p udp --dport "$port" -j DROP &>/dev/null; then
                FIXED=$((FIXED + 1))
            fi
        done
    fi

    if command -v chattr &>/dev/null && [ "$EUID" -eq 0 ] 2>/dev/null; then
        local PROTECT_FILES=("/etc/hosts" "/etc/crontab" "/etc/rc.local")
        for f in "${PROTECT_FILES[@]}"; do
            if [ -f "$f" ]; then
                if chattr +i "$f" &>/dev/null; then
                    echo -e "${GREEN}  ✓ Archivo protegido (inmutable): $f${RESET}"
                    FIXED=$((FIXED + 1))
                fi
            fi
        done
    fi

    if command -v systemctl &>/dev/null && [ "$EUID" -eq 0 ] 2>/dev/null; then
        local INSECURE_SERVICES=("telnet" "rsh" "rlogin" "tftp" "finger" "chargen")
        for svc in "${INSECURE_SERVICES[@]}"; do
            if systemctl is-active "$svc" &>/dev/null; then
                systemctl stop "$svc" &>/dev/null
                systemctl disable "$svc" &>/dev/null
                echo -e "${GREEN}  ✓ Servicio inseguro desactivado: $svc${RESET}"
                FIXED=$((FIXED + 1))
            fi
        done
    fi
}

quarantine_file() {
    local FILE="$1"
    mkdir -p "$QUARANTINE_DIR"
    local DEST="$QUARANTINE_DIR/$(basename "$FILE").quarantined_$(date +%s)"
    if mv "$FILE" "$DEST" 2>/dev/null; then
        chmod 000 "$DEST" 2>/dev/null
        echo -e "${GREEN}    ✓ Archivo en cuarentena: $DEST${RESET}"
        FIXED=$((FIXED + 1))
    else
        echo -e "${YELLOW}    ⚠ No se pudo mover a cuarentena: $FILE${RESET}"
    fi
}

print_report() {
    print_section "REPORTE FINAL DE SEGURIDAD"

    local ELAPSED=$((SECONDS))
    echo ""
    echo -e "${CYAN}  Estadisticas del escaneo:${RESET}"
    echo    "    Archivos escaneados:    $FILES_SCANNED"
    echo    "    Directorios escaneados: $DIRS_SCANNED"
    echo    "    Tiempo total:           ${ELAPSED}s"
    echo    "    Reparaciones aplicadas: $FIXED"

    if [ "$THREATS_FOUND" -eq 0 ]; then
        echo -e "\n${GREEN}${BOLD}  ✓ ¡SISTEMA LIMPIO! No se detectaron amenazas.${RESET}"
        echo -e "\n${GREEN}${BOLD}  ✓ ¡SISTEMA LIMPIO! No se detectaron amenazas.${RESET}" >> "$REPORT_FILE"
    else
        echo -e "\n${RED}${BOLD}  TOTAL AMENAZAS DETECTADAS: $THREATS_FOUND${RESET}"
        echo -e "${YELLOW}  Reporte completo: $REPORT_FILE${RESET}"

        if $AUTO_FIX; then
            echo -e "\n${GREEN}  Se aplicaron $FIXED acciones correctivas${RESET}"
        else
            echo -e "\n${ORANGE}  Para limpiar automaticamente, ejecuta con --fix${RESET}"
        fi

        echo -e "\n${RED}${BOLD}  RECOMENDACIONES:${RESET}"
        echo    "  1. Revisa el reporte: $REPORT_FILE"
        echo    "  2. Ejecuta con sudo bash antivirus_scanner.sh $SCAN_MODE --fix"
        echo    "  3. Cambia contrasenas si hay amenazas WARNING"
        echo    "  4. Desconecta de internet si hay rootkits/troyanos"
        echo    "  5. Considera reinstalar si hay multiples amenazas WARNING"
    fi

    echo ""
    echo "--- FIN DE REPORTE ---"                      >> "$REPORT_FILE"
    echo "Total amenazas: $THREATS_FOUND"              >> "$REPORT_FILE"
    echo "Reparaciones:   $FIXED"                      >> "$REPORT_FILE"
    echo "Fecha fin:      $(date '+%d/%m/%Y %H:%M:%S')" >> "$REPORT_FILE"
}

main() {
    print_banner

    local DEPTH=99
    local SCAN_PATHS=()

    case "$SCAN_MODE" in
        quick)
            echo -e "${CYAN}${BOLD}  Modo: ESCANEO RAPIDO (2-5 min)${RESET}"
            DEPTH=2
            SCAN_PATHS=("$HOME" "/tmp" "/var/tmp" "/usr/local/bin")
            ;;
        full)
            echo -e "${CYAN}${BOLD}  Modo: ESCANEO COMPLETO (10-30 min)${RESET}"
            DEPTH=5
            SCAN_PATHS=("$HOME" "/tmp" "/var/tmp" "/etc" "/usr" "/opt" "/bin" "/sbin")
            ;;
        deep)
            echo -e "${CYAN}${BOLD}  Modo: ESCANEO PROFUNDO (30+ min)${RESET}"
            DEPTH=99
            SCAN_PATHS=("/")
            ;;
        custom)
            echo -e "${CYAN}${BOLD}  Modo: ESCANEO PERSONALIZADO${RESET}"
            DEPTH=5
            SCAN_PATHS=("${CUSTOM_PATHS[@]:-$HOME}")
            ;;
        *)
            echo -e "${RED}  Modo invalido: $SCAN_MODE${RESET}"
            echo -e "  Modos validos: quick | full | deep | custom"
            exit 1
            ;;
    esac

    print_section "ESCANEO DE ARCHIVOS"
    for path in "${SCAN_PATHS[@]}"; do
        if [ -d "$path" ]; then
            echo -e "${CYAN}  Escaneando: $path${RESET}"
            scan_directory_recursive "$path" "$DEPTH" 0
        fi
    done

    scan_processes
    scan_network
    scan_startup
    scan_hosts_file

    if [ "$SCAN_MODE" = "deep" ] || [ "$SCAN_MODE" = "full" ]; then
        scan_suid_files
        scan_world_writable
    fi

    if $AUTO_FIX; then
        patch_security
        if [ "$THREATS_FOUND" -gt 0 ]; then
            print_section "CUARENTENA DE AMENAZAS"
            echo -e "${ORANGE}  Moviendo amenazas a cuarentena: $QUARANTINE_DIR${RESET}"
        fi
    fi

    print_report
}

main
