$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot '../infra/local/.env'
if (Test-Path -LiteralPath $target) { throw 'Existing .env preserved. No changes made.' }
function New-LocalSecret { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) }
$lines = @('WP_PORT=8087', ('DB_PASSWORD=' + (New-LocalSecret)), ('DB_ROOT_PASSWORD=' + (New-LocalSecret)), ('WP_ADMIN_PASSWORD=' + (New-LocalSecret)))
[IO.File]::WriteAllLines([IO.Path]::GetFullPath($target), $lines)
Write-Output 'Private local configuration generated. No credentials printed.'
