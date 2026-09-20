; Inno Setup sketch for Akara Connect
; Compile after PyInstaller produces Dist\akara-connect.exe

[Setup]
AppName=Akara Connect
AppVersion=0.7.0
DefaultDirName={autopf}\AkaraConnect
DefaultGroupName=Akara Connect
OutputBaseFilename=AkaraConnectSetup
PrivilegesRequired=lowest
Compression=lzma
SolidCompression=yes

[Files]
Source: "..\dist\akara-connect.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Akara Connect"; Filename: "{app}\akara-connect.exe"
Name: "{autodesktop}\Akara Connect"; Filename: "{app}\akara-connect.exe"

[Run]
Filename: "{app}\akara-connect.exe"; Description: "Launch Akara Connect"; Flags: nowait postinstall skipifsilent
