param(
    [Parameter(Mandatory)][string]$Carriage,
    [Parameter(Mandatory)][string]$Unicorn,
    [Parameter(Mandatory)][string]$Pegasus,
    [Parameter(Mandatory)][string]$Griffin,
    [string]$Review
)

$ErrorActionPreference = 'Stop'
if (-not $Review) { $Review = Join-Path $PSScriptRoot '../../../docs/royal-player-tokens' }
Add-Type -AssemblyName System.Drawing
$renders = Join-Path $Review 'renders'
$output = Join-Path $Review 'comparisons'
$null = New-Item -ItemType Directory -Force -Path $output
$references = [ordered]@{
    RoyalCarriage = $Carriage
    RoyalUnicorn = $Unicorn
    RoyalPegasus = $Pegasus
    RoyalGriffin = $Griffin
}

$title = [System.Drawing.Font]::new('Segoe UI', 33, [System.Drawing.FontStyle]::Bold)
$label = [System.Drawing.Font]::new('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(244, 233, 211))
$accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(217, 187, 125))
$matte = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(58, 73, 92))
$paper = [System.Drawing.Color]::FromArgb(19, 28, 42)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$encoding = [System.Drawing.Imaging.EncoderParameters]::new(1)
$encoding.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
    [System.Drawing.Imaging.Encoder]::Quality, [long]94
)

try {
    foreach ($model in $references.Keys) {
        $card = [System.Drawing.Bitmap]::new(1324, 1418)
        $canvas = [System.Drawing.Graphics]::FromImage($card)
        try {
            $canvas.Clear($paper)
            $canvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $canvas.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
            $canvas.DrawString(($model -creplace '(?<=Royal)(?=[A-Z])',' '),$title,$ink,24,14)
            $panels = @(
                @{ Label = 'Supplied concept'; Path = $references[$model]; X = 24; Y = 110 }
                @{ Label = 'Master GLB / matched three-quarter angle'; Path = (Join-Path $renders "$model-front.png"); X = 674; Y = 110 }
                @{ Label = 'Master GLB / opposite side'; Path = (Join-Path $renders "$model-opposite.png"); X = 24; Y = 762 }
                @{ Label = 'Master GLB / rear three-quarter angle'; Path = (Join-Path $renders "$model-rear.png"); X = 674; Y = 762 }
            )
            foreach ($panel in $panels) {
                $canvas.DrawString($panel.Label,$label,$accent,$panel.X,($panel.Y-31))
                $canvas.FillRectangle($matte,$panel.X,$panel.Y,626,626)
                $source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $panel.Path).Path)
                try {
                    $factor = 626 / [Math]::Max($source.Width,$source.Height)
                    $w = [int]($source.Width * $factor)
                    $h = [int]($source.Height * $factor)
                    $canvas.DrawImage($source,[int]($panel.X+(626-$w)/2),[int]($panel.Y+(626-$h)/2),$w,$h)
                } finally {
                    $source.Dispose()
                }
            }
            $card.Save((Join-Path (Resolve-Path -LiteralPath $output).Path "$model.jpg"),$codec,$encoding)
        } finally {
            $canvas.Dispose()
            $card.Dispose()
        }
    }
} finally {
    foreach ($item in @($title,$label,$ink,$accent,$matte,$encoding)) {
        $item.Dispose()
    }
}
