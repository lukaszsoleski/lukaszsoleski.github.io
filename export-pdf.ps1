param(
    [ValidateSet('all', 'pl', 'en')]
    [string]$Target = 'all',

    [string]$EdgePath
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $EdgePath) {
    $edgeCandidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
    ) | Where-Object { $_ -and (Test-Path $_) }

    $EdgePath = $edgeCandidates | Select-Object -First 1
}

if (-not $EdgePath) {
    throw 'Microsoft Edge not found. Pass -EdgePath with the full path to msedge.exe.'
}

$exports = switch ($Target) {
    'pl' {
        @(@{ Input = 'index.html'; Output = 'cv-pl.pdf' })
    }
    'en' {
        @(@{ Input = 'en.html'; Output = 'cv-en.pdf' })
    }
    default {
        @(
            @{ Input = 'index.html'; Output = 'cv-pl.pdf' },
            @{ Input = 'en.html'; Output = 'cv-en.pdf' }
        )
    }
}

foreach ($export in $exports) {
    $inputPath = Join-Path $projectRoot $export.Input
    $outputPath = Join-Path $projectRoot $export.Output

    if (-not (Test-Path $inputPath)) {
        throw "Missing input file: $inputPath"
    }

    $inputUri = ([System.Uri] (Resolve-Path $inputPath).Path).AbsoluteUri
    $edgeArgs = @(
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        '--print-to-pdf-no-header',
        "--print-to-pdf=$outputPath",
        $inputUri
    )

    & $EdgePath @edgeArgs | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Edge failed while exporting $($export.Output)."
    }

    Write-Output "Generated $($export.Output)"
}