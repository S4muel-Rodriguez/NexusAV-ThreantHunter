# Guía de Uso — Antivirus Scanner Multiplataforma

## ¿Qué hace este script?

Analiza tu dispositivo en busca de amenazas de seguridad **sin depender de conexión a internet ni servicios externos**. Funciona completamente en local.

### Amenazas que detecta

| Tipo | Descripción |
|------|-------------|
| Ransomware | Cifra tus archivos y pide rescate (WannaCry, Petya, Locky…) |
| Troyanos | Programas que parecen legítimos pero son maliciosos |
| Rootkits | Se ocultan en el sistema para mantener acceso |
| DDoS Bots | Tu equipo usado para atacar otros servidores |
| Spyware | Roba contraseñas, graba pantalla, keylogger |
| Cryptominers | Usa tu CPU/GPU para minar criptomonedas |
| Backdoors | Puertas traseras para acceso remoto no autorizado |
| Código ofuscado | Scripts maliciosos disfrazados con codificación |
| Gusanos (Worms) | Se auto-replican por la red |
| Adware/PUA | Software no deseado y rastreadores |

---

## Niveles de amenaza

| Nivel | Color | Peligro | Ejemplos |
|-------|-------|---------|---------|
| `HARD` | Amarillo `[!]` | Poco peligroso | Adware, rastreadores, PUA |
| `POTENT` | Naranja `[!!]` | Peligro medio | Spyware, bots, cryptominers |
| `WARNING` | Rojo `[!!!]` | Muy peligroso | Ransomware, rootkits, troyanos |

---

## Modos de escaneo

| Modo | Tiempo estimado | Qué analiza |
|------|----------------|-------------|
| `quick` | 2–5 minutos | Directorios del usuario, /tmp, binarios clave |
| `full` | 10–30 minutos | Sistema completo a profundidad media (recomendado) |
| `deep` | 30–90 minutos | Cada archivo del sistema, SUID, permisos |
| `custom` | Variable | Las rutas que tú elijas |

---

## Instalación y requisitos

### Requisitos Python
- Python 3.6 o superior
- No necesita instalar librerías externas (solo usa módulos estándar)

### Requisitos Bash
- Bash 4+ (preinstalado en Linux, disponible en Android via Termux)
- Comandos estándar: `find`, `grep`, `strings`, `ps`, `ss`/`netstat`

---

## USO EN LINUX

### Escaneo rápido (sin instalar nada)
```bash
python3 antivirus_scanner.py quick
```

### Escaneo completo con limpieza automática (requiere sudo)
```bash
sudo python3 antivirus_scanner.py full --fix
```

### Escaneo profundo con detalles
```bash
sudo python3 antivirus_scanner.py deep --fix --verbose
```

### Escanear una carpeta específica
```bash
python3 antivirus_scanner.py custom --path /home/usuario --path /opt
```

### Con el script Bash
```bash
# Dar permisos de ejecución (solo la primera vez)
chmod +x antivirus_scanner.sh

# Escaneo rápido
bash antivirus_scanner.sh quick

# Escaneo completo con limpieza (recomendado con sudo)
sudo bash antivirus_scanner.sh full --fix

# Escaneo profundo
sudo bash antivirus_scanner.sh deep --fix --verbose
```

---

## USO EN WINDOWS

### Con Python
```cmd
REM Abrir CMD como Administrador, luego:
python antivirus_scanner.py full
python antivirus_scanner.py full --fix
python antivirus_scanner.py deep --fix --verbose
python antivirus_scanner.py custom --path C:\Users --path C:\Windows\Temp
```

### Con PowerShell como Administrador
```powershell
python antivirus_scanner.py full --fix
```

> **Nota Windows:** Para aplicar todos los parches de firewall, abre CMD o PowerShell **como Administrador**.

---

## USO EN ANDROID (Termux)

```bash
# Instalar Python en Termux (solo la primera vez)
pkg install python

# Dar permiso de acceso al almacenamiento
termux-setup-storage

# Escaneo rápido del almacenamiento del teléfono
python3 antivirus_scanner.py quick

# Escaneo en carpeta de descargas
python3 antivirus_scanner.py custom --path /sdcard/Download --path /sdcard

# Con Bash
bash antivirus_scanner.sh quick
bash antivirus_scanner.sh full --fix
```

---

## Opciones disponibles

```
Uso: python3 antivirus_scanner.py [modo] [opciones]

Modos:
  quick    Escaneo rápido (2-5 min)
  full     Escaneo completo (10-30 min) [por defecto]
  deep     Escaneo profundo (30-90 min)
  custom   Rutas personalizadas

Opciones:
  --fix,     -f    Eliminar/cuarentena amenazas y parchear automáticamente
  --verbose, -v    Mostrar progreso detallado archivo por archivo
  --path,    -p    Ruta a escanear (se puede repetir para varias rutas)
```

---

## ¿Qué hace el modo --fix?

1. **Cuarentena**: Mueve archivos peligrosos a `~/.antivirus_quarantine/` (no los borra, por si acaso)
2. **Mata procesos**: Termina procesos identificados como maliciosos
3. **Bloquea puertos**: Cierra puertos conocidos de malware (4444, 1337, 31337, etc.)
4. **Parches del sistema** (solo Linux/root):
   - Activa protección SYN Flood
   - Bloquea IP forwarding
   - Protege archivos críticos (hosts, crontab)
   - Desactiva servicios inseguros (telnet, rsh, tftp)
   - Aplica reglas de firewall (UFW o iptables)

---

## Reporte de resultados

Al finalizar, el script genera automáticamente un reporte en:
- **Reporte JSON** (Python): `~/antivirus_report_YYYYMMDD_HHMMSS.json`
- **Reporte TXT** (Bash): `~/antivirus_report_YYYYMMDD_HHMMSS.txt`

---

## Ejemplos prácticos rápidos

```bash
# Quiero analizar rápido si estoy infectado
python3 antivirus_scanner.py quick

# Análisis completo y limpieza en Linux
sudo python3 antivirus_scanner.py full --fix

# Solo revisar una carpeta de descargas
python3 antivirus_scanner.py custom --path ~/Downloads --fix

# Android: revisar tarjeta SD
python3 antivirus_scanner.py custom --path /sdcard

# Windows (como Administrador):
python antivirus_scanner.py full --fix
```

---

## Advertencias importantes

- **Cuarentena ≠ borrar**: Los archivos en cuarentena se mueven, no se eliminan. Si fue un falso positivo, están en `~/.antivirus_quarantine/`
- **Falsos positivos**: Algunos archivos de desarrollo o herramientas legítimas pueden activar alertas por patrones similares. Revisa el reporte antes de actuar.
- **Root/Admin recomendado**: Para aplicar parches de firewall y acceder a archivos del sistema se necesitan privilegios elevados.
- **No reemplaza un antivirus completo**: Este script usa análisis de firmas y heurísticas. Para protección en tiempo real, complementa con soluciones dedicadas (ClamAV en Linux, Windows Defender en Windows).

---

## Archivos del proyecto

```
scripts/antivirus/
├── antivirus_scanner.py   ← Script principal (Windows / Linux / Android)
├── antivirus_scanner.sh   ← Versión Bash (Linux / Android)
└── GUIA_DE_USO.md         ← Esta guía
```
