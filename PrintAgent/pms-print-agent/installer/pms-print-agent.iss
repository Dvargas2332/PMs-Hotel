; Inno Setup script (build an installer EXE for Windows)
; Requirements: Inno Setup 6+
; Build steps:
; 1) npm run build:exe
; 2) Open this .iss in Inno Setup and Compile

#define AppName "PMS Print Agent"
#define AppVersion "0.1.0"
#define AppExeName "pms-print-agent.exe"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\\{#AppName}
DefaultGroupName={#AppName}
OutputBaseFilename=pms-print-agent-setup
Compression=lzma
SolidCompression=yes

[Files]
Source: "..\\dist\\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\\.env.example"; DestDir: "{app}"; DestName: ".env.example"; Flags: ignoreversion

[Icons]
Name: "{group}\\{#AppName}"; Filename: "{app}\\{#AppExeName}"
Name: "{group}\\Uninstall {#AppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\\{#AppExeName}"; Description: "Run {#AppName} now"; Flags: nowait postinstall skipifsilent
