$ErrorActionPreference = 'Stop'
$base = 'https://cdn.jsdelivr.net/npm/three@0.160.0'
$root = 'c:\Users\beata\OneDrive\Dokumente\1_Uni\Master\01_Semester\4_UE Prototypenbau\Proto-gruppe-01\webapp\static\three'
New-Item -ItemType Directory -Force -Path "$root\addons\loaders", "$root\addons\controls", "$root\addons\libs" | Out-Null
Invoke-WebRequest -Uri "$base/build/three.module.js" -OutFile "$root\three.module.js"
Invoke-WebRequest -Uri "$base/examples/jsm/loaders/GLTFLoader.js" -OutFile "$root\addons\loaders\GLTFLoader.js"
Invoke-WebRequest -Uri "$base/examples/jsm/controls/OrbitControls.js" -OutFile "$root\addons\controls\OrbitControls.js"
Invoke-WebRequest -Uri "$base/examples/jsm/libs/fflate.module.js" -OutFile "$root\addons\libs\fflate.module.js"
Write-Output 'Downloads abgeschlossen:'
Get-ChildItem -Recurse $root | Select-Object FullName, Length | Format-Table -AutoSize
