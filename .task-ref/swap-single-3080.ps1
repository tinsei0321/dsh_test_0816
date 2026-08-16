# Consolidate to a single 3080: stop every running dsh web server (old 3080
# and 3082) and start one fresh server from the current master build on 3080.
# The probe additionally posts a host.gitStatus envelope — the definitive
# check that the new host-side RPC is loaded (the old host answers 404).
$ErrorActionPreference = 'Continue'
$log = 'D:\Github\dsh_test\.task-ref\swap-single-3080.log'
$out = 'D:\Github\dsh_test\.task-ref\single-3080.out.log'
$err = 'D:\Github\dsh_test\.task-ref\single-3080.err.log'

function L($msg) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $log -Value $line
}

L 'consolidation started; sleeping 20s for the finishing session to settle'
Start-Sleep -Seconds 20

$old = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'node.exe' -and $_.CommandLine -match 'apps/cli/src/bin\.ts\s+web'
}
if ($old) {
  foreach ($p in $old) {
    L ("stopping web server PID " + $p.ProcessId)
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; L 'stopped' }
    catch { L ("stop failed (already gone): " + $_.Exception.Message) }
  }
} else { L 'no running web server found' }
Start-Sleep -Seconds 3

L 'starting the single fresh server on 3080'
$proc = Start-Process -FilePath 'D:\nodejs\node.exe' `
  -ArgumentList '--import','tsx/esm','apps/cli/src/bin.ts','web' `
  -WorkingDirectory 'D:\Github\dsh_test' `
  -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $out -RedirectStandardError $err
L ("started pid " + $proc.Id)

$ok = $false
for ($i = 0; $i -lt 36; $i++) {
  Start-Sleep -Seconds 5
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/' -UseBasicParsing -TimeoutSec 4
    $hasBoot = $r.Content -match '__DSH_BOOT__'
    if (-not $hasBoot) { L ("probe @" + ($i * 5) + "s: up but no boot payload yet"); continue }
    $body = '{"type":"client-request","rpcId":"probe-git","method":"host.gitStatus","payload":{"path":"D:\\Github\\dsh_test"}}'
    try {
      $g = Invoke-WebRequest -Uri 'http://127.0.0.1:3080/api/host.gitStatus' -Method POST `
        -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 20
      L ("probe @" + ($i * 5) + "s: boot=True, host.gitStatus HTTP " + $g.StatusCode)
      $ok = $true
      break
    } catch {
      $code = $_.Exception.Response.StatusCode.value__
      L ("probe @" + ($i * 5) + "s: boot=True, host.gitStatus HTTP " + $code + " (host not ready yet)")
    }
  } catch {
    L ("probe @" + ($i * 5) + "s: not up yet")
  }
}
if ($ok) { L 'consolidation complete: single fresh 3080 serves the new build with host.gitStatus' }
else { L 'server did not come up within 3 minutes; see stderr log' }
L 'script done'
