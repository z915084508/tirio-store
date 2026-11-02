param([ValidateSet('Check','Start','Stop','Initialize')][string]$Action = 'Check')
$ErrorActionPreference = 'Stop'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is unavailable. Install/start Docker Desktop with WSL2 before running this script.' }
$compose = Join-Path $PSScriptRoot '../infra/local/compose.yaml'
$envFile = Join-Path $PSScriptRoot '../infra/local/.env'
if (-not (Test-Path $envFile)) { throw 'Run prepare-local.ps1 first.' }
function Invoke-Compose([string[]]$DockerArgs) {
  & docker compose --env-file $envFile -f $compose @DockerArgs
  if ($LASTEXITCODE -ne 0) { throw 'Docker Compose operation failed.' }
}
switch ($Action) {
  Check { Invoke-Compose @('config','--quiet'); & docker info --format '{{.ServerVersion}}'; if ($LASTEXITCODE -ne 0) { throw 'Docker engine unavailable' } }
  Start { Invoke-Compose @('up','-d','--wait','db','wordpress') }
  Stop { Invoke-Compose @('stop','wordpress','db') }
  Initialize {
    Invoke-Compose @('exec','-T','wordpress','test','-f','/var/www/html/wp-config.php')
    & docker compose --env-file $envFile -f $compose run --rm cli core is-installed
    if ($LASTEXITCODE -eq 1) {
      Invoke-Compose @('run','--rm','--entrypoint','sh','cli','-c','wp core install --url=http://127.0.0.1:8087 --title="TIRIO Local Development" --admin_user=tirio_local --admin_password="$WP_ADMIN_PASSWORD" --admin_email=admin@example.invalid --skip-email')
    } elseif ($LASTEXITCODE -ne 0) { throw 'Unable to determine existing installation state; stopped without overwriting.' }
    Invoke-Compose @('run','--rm','cli','plugin','install','woocommerce','--version=11.2.1','--activate')
    Invoke-Compose @('run','--rm','cli','core','version')
    Invoke-Compose @('run','--rm','cli','plugin','get','woocommerce','--field=version')
  }
}
