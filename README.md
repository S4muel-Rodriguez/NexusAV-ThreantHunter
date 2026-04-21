# ⚡ NexusAV ThreatHunter

> Plataforma de ciberseguridad multiplataforma para detección de amenazas mediante análisis heurístico y por firmas.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Python](https://img.shields.io/badge/python-3.6+-blue)
![Platform](https://img.shields.io/badge/platform-linux%20%7C%20windows%20%7C%20android-lightgrey)

---

## 🧠 Descripción

**NexusAV ThreatHunter** es una herramienta de análisis de seguridad que permite escanear sistemas en busca de malware como:

- Ransomware  
- Spyware  
- Rootkits  
- Troyanos  
- Bots / DDoS  
- Cryptominers  
- Keyloggers  

Funciona de forma **offline**, utilizando técnicas de detección basadas en heurística y firmas.

---

## ⚙️ Requisitos

- Python 3.6 o superior  
- Bash (para versión `.sh`)  
- Sistema operativo:
  - Linux
  - Windows
  - Android (Termux)

---

## 🚀 Instalación

Clonar el repositorio:

```bash
git clone https://github.com/S4muel-Rodriguez/NexusAV-ThreantHunter.git
cd NexusAV-ThreantHunter/scripts/antivirus

 Ejecución:
🔹 Opción 1: Python (recomendada)
python3 antivirus_scanner.py quick

🔹 Opción 2: Bash
Dar permisos:
chmod +x antivirus_scanner.sh

Ejecutar:
./antivirus_scanner.sh deep

| Modo   | Descripción                             | Tiempo estimado |
| ------ | --------------------------------------- | --------------- |
| quick  | Escaneo rápido (directorios críticos)   | 2–5 min         |
| full   | Escaneo completo del sistema            | 10–30 min       |
| deep   | Escaneo profundo (permisos, SUID, etc.) | 30–90 min       |
| custom | Escaneo personalizado por ruta          | Variable        |

⚡ Opciones disponibles:

--fix / -f       # Elimina amenazas automáticamente
--verbose / -v   # Muestra logs detallados
--path / -p      # Especifica ruta personalizada


💻 Uso por plataforma
🐧 Linux:
sudo python3 antivirus_scanner.py full --fix
o
sudo bash antivirus_scanner.sh deep

🪟 Windows:
Ejecutar en CMD o PowerShell como administrador:
python antivirus_scanner.py full --fix

📱 Android (Termux):
pkg install python
python3 antivirus_scanner.py quick

🌐 Web:
https://threat-hunter-suite--samurodriguez2.replit.app/

scripts/antivirus/
├── antivirus_scanner.py
├── antivirus_scanner.sh
└── GUIA_DE_USO.md

⚠️ Disclaimer

Este proyecto es educativo y experimental.
No reemplaza soluciones antivirus profesionales.

📌 Roadmap
Integración con motores reales (ClamAV)
Logs persistentes
Panel web con resultados reales
Detección avanzada (ML básico)
🤝 Contribuciones

Pull requests y feedback son bienvenidos.

👨‍💻 Autor:
Samuel Rodriguez
GitHub:https://github.com/S4muel-Rodriguez 
