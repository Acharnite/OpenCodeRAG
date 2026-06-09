param(
  [switch]$Dry
)

$dryRun = ($env:DRY_RUN -eq '1') -or $Dry

function Run($cmd) {
  Write-Host "> $cmd"
  if (-not $dryRun) {
    Invoke-Expression $cmd
    if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE" }
  } else {
    Write-Host '(dry run) skipped'
  }
}

try {
  if (-not $dryRun) {
    Run 'git push origin main'
  } else {
    Write-Host '(dry run) would run: git push origin main'
  }

  if (-not $dryRun) {
    Run 'npm version patch'
  } else {
    Write-Host '(dry run) would run: npm version patch'
  }

  $tag = (git describe --tags --abbrev=0).Trim()
  Write-Host "Detected tag: $tag"

  Run "git push origin $tag"
  Run "gh release create $tag --title ""Version $tag"" --notes ""Patch release"""
} catch {
  Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
