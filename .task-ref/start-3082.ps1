# Start the D: build's web server on 3082 for verification (leaves the host's
# 3080 untouched). Redirect stdout/stderr to files under .task-ref.
$out = 'D:\Github\dsh_test\.task-ref\server-3082.out.log'
$err = 'D:\Github\dsh_test\.task-ref\server-3082.err.log'
New-Item -ItemType Directory -Force -Path 'D:\Github\dsh_test\.task-ref' | Out-Null
Start-Process -FilePath 'D:\nodejs\node.exe' `
  -ArgumentList '--import','tsx/esm','apps/cli/src/bin.ts','web','--port','3082' `
  -WorkingDirectory 'D:\Github\dsh_test' `
  -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $out -RedirectStandardError $err |
  ForEach-Object { Add-Content -Path 'D:\Github\dsh_test\.task-ref\start-3082.log' -Value ("started pid " + $_.Id) }
