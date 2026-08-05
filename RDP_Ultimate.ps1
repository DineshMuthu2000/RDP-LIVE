param([switch]$AutoStart)

# Load Assemblies
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# Set High DPI awareness
try { [System.Windows.Forms.Application]::SetHighDpiMode('SystemAware') } catch {}

# --- Win32 P/Invoke Definitions ---
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

        [DllImport("user32.dll")]
        public static extern int GetSystemMetrics(int nIndex);

        [DllImport("user32.dll")] 
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")] 
        public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
    }
"@

# --- Configuration ---
$ProcessName = "mstsc" 
$LoopAlignmentInterval = 1000 # Milliseconds for Alignment Loop
$LoopPasteInterval = 200      # Milliseconds for Password Paste Loop

# Global State for Password Injection
$script:HandledHandles = @{}

# --- Alignment Logic ---
function Update-RDPAlignment {
    $ScreenWidth = [Win32]::GetSystemMetrics(0)
    $ScreenHeight = [Win32]::GetSystemMetrics(1)
    
    # Get Windows
    $Windows = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
    $Count = $Windows.Count
    
    if ($Count -eq 0) { return }

    # Sort Windows by Number in Title
    $SortedWindows = $Windows | Sort-Object -Property @{Expression = {
            if ($_.MainWindowTitle -match "(\d+)") {
                [int]$matches[1]
            }
            else {
                999999
            }
        }
    }, MainWindowTitle

    # Calculate Grid
    $Rows = 3
    if ($script:Radio2.Checked) { $Rows = 2 }
    # Use Ceiling to ensure we have enough columns for all windows
    $Cols = [Math]::Ceiling($Count / $Rows)
    if ($Cols -lt 1) { $Cols = 1 }
    
    # Pixel-perfect calculation to avoid gaps, PLUS Border Overlap to hide invisible OS borders
    # Windows 10/11 have invisible borders of approx 7-8 pixels. We overlap them to make windows look "glued" together.
    $BorderOverlap = 8 
    
    $i = 0
    foreach ($win in $SortedWindows) {
        $RowIndex = [Math]::Floor($i / $Cols)
        $ColIndex = $i % $Cols
        
        # Calculate strict logic grid edges
        $GridX1 = [int][Math]::Round(($ColIndex * $ScreenWidth) / $Cols)
        $GridX2 = [int][Math]::Round((($ColIndex + 1) * $ScreenWidth) / $Cols)
        $GridY1 = [int][Math]::Round(($RowIndex * $ScreenHeight) / $Rows)
        $GridY2 = [int][Math]::Round((($RowIndex + 1) * $ScreenHeight) / $Rows)
        
        # Apply Overlap
        $FinalX = $GridX1 - $BorderOverlap
        $FinalY = $GridY1
        
        $FinalWidth = ($GridX2 - $GridX1) + ($BorderOverlap * 2)
        $FinalHeight = ($GridY2 - $GridY1) + $BorderOverlap # Extend bottom to hide bottom border
        
        [void][Win32]::MoveWindow($win.MainWindowHandle, $FinalX, $FinalY, $FinalWidth, $FinalHeight, $true)
        $i++
    }
}

# --- Password Injection Logic ---
function Invoke-PasswordInjection {
    if (!$script:txtPass.Text) { return }
    try {
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $cond = New-Object System.Windows.Automation.OrCondition(
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Windows Security")),
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Enter your credentials")),
            (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Remote Desktop Connection security warning"))
        )
        
        $securityWindows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
        
        foreach ($win in $securityWindows) {
            $hwnd = $win.Current.NativeWindowHandle
            if ($hwnd -eq 0) { continue }
            
            $hStr = $hwnd.ToString()
            if ($script:HandledHandles.ContainsKey($hStr)) { continue }

            # Activation
            [Win32]::SwitchToThisWindow([IntPtr]$hwnd, $true)
            [Win32]::SetForegroundWindow([IntPtr]$hwnd)
            Start-Sleep -Milliseconds 100
            
            # 1. Handle Security Warning Checkboxes
            $checkNames = @(
                "Smart cards or Windows Hello for Business",
                "WebAuthn (Windows Hello or security keys)",
                "Clipboard",
                "Printers"
            )
            foreach ($cName in $checkNames) {
                $cCond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $cName)
                $checkEl = $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cCond)
                if ($checkEl) {
                    $tp = $null
                    if ($checkEl.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$tp)) {
                        if ($tp.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::Off) {
                            $tp.Toggle()
                        }
                    }
                }
            }

            # 2. Handle PIN/Password Field
            $pBox = $null
            $pConds = @(
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "PinInput")),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "PIN")),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "PasswordInput")),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Password"))
            )

            foreach ($pc in $pConds) {
                $pBox = $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $pc)
                if ($pBox) { break }
            }

            if ($pBox) {
                try { $pBox.SetFocus() } catch {}
                $vp = $null
                if ($pBox.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
                    $vp.SetValue($script:txtPass.Text)
                }
                else {
                    [System.Windows.Forms.SendKeys]::SendWait($script:txtPass.Text)
                }
            }
            
            Start-Sleep -Milliseconds 150

            # 3. Submit (OK / Connect)
            $sBtn = $null
            $sConds = @(
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "OK")),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Connect")),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "OkButton")),
                (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "SubmitButton"))
            )
            foreach ($sc in $sConds) {
                $sBtn = $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $sc)
                if ($sBtn) { break }
            }

            if ($sBtn) {
                $ip = $null
                if ($sBtn.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$ip)) {
                    $ip.Invoke()
                }
                else {
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                }
            }
            else {
                [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            }
            
            $script:HandledHandles[$hStr] = $true
        }
    }
    catch {}
}


# --- GUI Architecture ---

$Form = New-Object System.Windows.Forms.Form
$Form.Text = "RDP Manager"
$Form.Size = New-Object System.Drawing.Size(440, 770)
$Form.StartPosition = "CenterScreen"
$Form.TopMost = $true
$Form.FormBorderStyle = "FixedSingle"
$Form.MaximizeBox = $false

# Custom Logo
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent -Path $MyInvocation.MyCommand.Definition -ErrorAction SilentlyContinue }
if (-not $ScriptDir) { $ScriptDir = "." }
$IconPath = Join-Path $ScriptDir "logo.png"
if (Test-Path $IconPath) {
    try {
        $bitmap = [System.Drawing.Bitmap]::FromFile($IconPath)
        $iconHandle = $bitmap.GetHicon()
        $Form.Icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    }
    catch {}
}

# Custom Gradient Background
$Form.Add_Paint({
        param($_sender, $e)
        $Rect = $Form.ClientRectangle
        $Brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($Rect, 
            [System.Drawing.Color]::FromArgb(18, 38, 32), 
            [System.Drawing.Color]::FromArgb(6, 20, 14), 
            45)
        $e.Graphics.FillRectangle($Brush, $Rect)
        $Brush.Dispose()
    })

# --- Panels ---
# We will use simple visibility toggling for "Tabs"
# Panel Container
$ContentPanel = New-Object System.Windows.Forms.Panel
$ContentPanel.Location = New-Object System.Drawing.Point(0, 50) # Leave space for Header
$ContentPanel.Size = New-Object System.Drawing.Size(440, 640)
$ContentPanel.BackColor = [System.Drawing.Color]::Transparent
$Form.Controls.Add($ContentPanel)

# Header Navigation
$NavPanel = New-Object System.Windows.Forms.Panel
$NavPanel.Size = New-Object System.Drawing.Size(440, 50)
$NavPanel.BackColor = [System.Drawing.Color]::FromArgb(12, 32, 22) # Dark Islamic Green header
$Form.Controls.Add($NavPanel)

function New-RDPNavButton($Text, $X, $ClickScript) {
    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = $Text
    $btn.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btn.FlatAppearance.BorderSize = 0
    $btn.ForeColor = [System.Drawing.Color]::Gray
    $btn.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $btn.Size = New-Object System.Drawing.Size(100, 50)
    $btn.Location = New-Object System.Drawing.Point($X, 0)
    $btn.Cursor = [System.Windows.Forms.Cursors]::Hand
    $btn.Add_Click($ClickScript)
    $NavPanel.Controls.Add($btn)
    return $btn
}

# --- Views ---
# 1. Launcher View
$LaunchPanelView = New-Object System.Windows.Forms.Panel
$LaunchPanelView.Dock = [System.Windows.Forms.DockStyle]::Fill
$LaunchPanelView.BackColor = [System.Drawing.Color]::Transparent
$LaunchPanelView.Visible = $true # Default
$ContentPanel.Controls.Add($LaunchPanelView)

# 2. Aligner View
$AlignPanelView = New-Object System.Windows.Forms.Panel
$AlignPanelView.Dock = [System.Windows.Forms.DockStyle]::Fill
$AlignPanelView.BackColor = [System.Drawing.Color]::Transparent
$AlignPanelView.Visible = $false
$ContentPanel.Controls.Add($AlignPanelView)

# 3. About View
$AboutPanelView = New-Object System.Windows.Forms.Panel
$AboutPanelView.Dock = [System.Windows.Forms.DockStyle]::Fill
$AboutPanelView.BackColor = [System.Drawing.Color]::FromArgb(10, 28, 18)
$AboutPanelView.Visible = $false
$ContentPanel.Controls.Add($AboutPanelView)

# Navigation Logic
$ShowLauncher = {
    $LaunchPanelView.Visible = $true
    $AlignPanelView.Visible = $false
    $AboutPanelView.Visible = $false
    $script:BtnNavLaunch.ForeColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
    $script:BtnNavAlign.ForeColor = [System.Drawing.Color]::Gray
    $script:BtnNavAbout.ForeColor = [System.Drawing.Color]::Gray
}
$ShowAligner = {
    $LaunchPanelView.Visible = $false
    $AlignPanelView.Visible = $true
    $AboutPanelView.Visible = $false
    $script:BtnNavLaunch.ForeColor = [System.Drawing.Color]::Gray
    $script:BtnNavAlign.ForeColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
    $script:BtnNavAbout.ForeColor = [System.Drawing.Color]::Gray
}
$ShowAbout = {
    $LaunchPanelView.Visible = $false
    $AlignPanelView.Visible = $false
    $AboutPanelView.Visible = $true
    $script:BtnNavLaunch.ForeColor = [System.Drawing.Color]::Gray
    $script:BtnNavAlign.ForeColor = [System.Drawing.Color]::Gray
    $script:BtnNavAbout.ForeColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
}

$script:BtnNavLaunch = New-RDPNavButton "LAUNCHER" 20 $ShowLauncher
$script:BtnNavAlign = New-RDPNavButton "ALIGNER" 160 $ShowAligner
$script:BtnNavAbout = New-RDPNavButton "ABOUT" 300 $ShowAbout
$script:BtnNavLaunch.ForeColor = [System.Drawing.Color]::FromArgb(212, 175, 55) # Default Active
$script:BtnNavLaunch.ForeColor = [System.Drawing.Color]::FromArgb(212, 175, 55) # Default Active


# --- Helper: Create Section Label ---
function New-RDPSectionLabel($Parent, $Text, $Y) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $Text
    $lbl.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
    $lbl.ForeColor = [System.Drawing.Color]::Gray
    $lbl.AutoSize = $true
    $lbl.Location = New-Object System.Drawing.Point(40, $Y)
    $Parent.Controls.Add($lbl)
}

# --- LAUNCHER VIEW CONTENT ---
$LauncherHeader = New-Object System.Windows.Forms.Label
$LauncherHeader.Text = "AUTO LAUNCH RDP"
$LauncherHeader.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$LauncherHeader.ForeColor = [System.Drawing.Color]::White
$LauncherHeader.AutoSize = $false
$LauncherHeader.TextAlign = "MiddleCenter"
$LauncherHeader.Size = New-Object System.Drawing.Size(440, 35)
$LauncherHeader.Location = New-Object System.Drawing.Point(0, 30)
$LaunchPanelView.Controls.Add($LauncherHeader)

# PIN Input
New-RDPSectionLabel $LaunchPanelView "PIN" 90

$PinFile = Join-Path $ScriptDir "pin.txt"
$SavedPin = "!@#$"
if (Test-Path $PinFile) { $SavedPin = (Get-Content $PinFile -Raw).Trim() }

$script:txtPass = New-Object System.Windows.Forms.TextBox
$script:txtPass.Location = New-Object System.Drawing.Point(40, 115)
$script:txtPass.Size = New-Object System.Drawing.Size(310, 25)
$script:txtPass.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$script:txtPass.PasswordChar = '*'
$script:txtPass.BackColor = [System.Drawing.Color]::FromArgb(25, 50, 35)
$script:txtPass.ForeColor = [System.Drawing.Color]::White
$script:txtPass.BorderStyle = "FixedSingle"
$script:txtPass.Text = $SavedPin
$LaunchPanelView.Controls.Add($script:txtPass)

$btnEye = New-Object System.Windows.Forms.Button
$btnEye.Location = New-Object System.Drawing.Point(355, 115)
$btnEye.Size = New-Object System.Drawing.Size(25, 23)
$btnEye.Text = "O"
$btnEye.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnEye.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnEye.FlatAppearance.BorderSize = 0
$btnEye.BackColor = [System.Drawing.Color]::FromArgb(85, 90, 100)
$btnEye.ForeColor = [System.Drawing.Color]::White
$btnEye.Cursor = [System.Windows.Forms.Cursors]::Hand
$btnEye.Add_Click({
    if ($script:txtPass.PasswordChar -eq '*') {
        $script:txtPass.PasswordChar = [char]0
    } else {
        $script:txtPass.PasswordChar = '*'
    }
})
$LaunchPanelView.Controls.Add($btnEye)

# Range Input
New-RDPSectionLabel $LaunchPanelView "ID RANGE (From - To)" 160
$txtStart = New-Object System.Windows.Forms.TextBox
$txtStart.Location = New-Object System.Drawing.Point(40, 185)
$txtStart.Size = New-Object System.Drawing.Size(150, 25)
$txtStart.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$txtStart.BackColor = [System.Drawing.Color]::FromArgb(25, 50, 35)
$txtStart.ForeColor = [System.Drawing.Color]::White
$txtStart.BorderStyle = "FixedSingle"
$txtStart.Text = "0"
$LaunchPanelView.Controls.Add($txtStart)

$lblTo = New-Object System.Windows.Forms.Label
$lblTo.Text = "-"
$lblTo.ForeColor = [System.Drawing.Color]::White
$lblTo.AutoSize = $true
$lblTo.Font = New-Object System.Drawing.Font("Segoe UI", 12)
$lblTo.Location = New-Object System.Drawing.Point(200, 182)
$LaunchPanelView.Controls.Add($lblTo)

$txtEnd = New-Object System.Windows.Forms.TextBox
$txtEnd.Location = New-Object System.Drawing.Point(230, 185)
$txtEnd.Size = New-Object System.Drawing.Size(150, 25)
$txtEnd.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$txtEnd.BackColor = [System.Drawing.Color]::FromArgb(25, 50, 35)
$txtEnd.ForeColor = [System.Drawing.Color]::White
$txtEnd.BorderStyle = "FixedSingle"
$txtEnd.Text = "0"
$LaunchPanelView.Controls.Add($txtEnd)


# Launch Button
$btnLaunch = New-Object System.Windows.Forms.Button
$btnLaunch.Text = "START RDP SESSIONS"
$btnLaunch.Size = New-Object System.Drawing.Size(340, 55)
$btnLaunch.Location = New-Object System.Drawing.Point(40, 250)
$btnLaunch.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$btnLaunch.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnLaunch.FlatAppearance.BorderSize = 0
$btnLaunch.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55) # Islamic Gold
$btnLaunch.ForeColor = [System.Drawing.Color]::FromArgb(10, 28, 18)
$btnLaunch.Cursor = [System.Windows.Forms.Cursors]::Hand
$LaunchPanelView.Controls.Add($btnLaunch)

# Status
$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Size = New-Object System.Drawing.Size(340, 40)
$lblStatus.Location = New-Object System.Drawing.Point(40, 315)
$lblStatus.TextAlign = "TopCenter"
$lblStatus.ForeColor = [System.Drawing.Color]::LightGray
$lblStatus.Font = New-Object System.Drawing.Font("Consolas", 9)
$LaunchPanelView.Controls.Add($lblStatus)

# --- TRACKER UI IN LAUNCHER ---
$lblLiveRDPs = New-Object System.Windows.Forms.Label
$lblLiveRDPs.Text = "Live RDPs: 0"
$lblLiveRDPs.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$lblLiveRDPs.ForeColor = [System.Drawing.Color]::FromArgb(0, 255, 255) # Cyan
$lblLiveRDPs.AutoSize = $false
$lblLiveRDPs.TextAlign = "MiddleCenter"
$lblLiveRDPs.Size = New-Object System.Drawing.Size(340, 30)
$lblLiveRDPs.Location = New-Object System.Drawing.Point(40, 360)
$LaunchPanelView.Controls.Add($lblLiveRDPs)

$btnShowMissing = New-Object System.Windows.Forms.Button
$btnShowMissing.Text = "Show Missing IDs"
$btnShowMissing.Size = New-Object System.Drawing.Size(340, 40)
$btnShowMissing.Location = New-Object System.Drawing.Point(40, 400)
$btnShowMissing.Font = New-Object System.Drawing.Font("Segoe UI", 12)
$btnShowMissing.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnShowMissing.FlatAppearance.BorderSize = 0
$btnShowMissing.BackColor = [System.Drawing.Color]::FromArgb(85, 90, 100)
$btnShowMissing.ForeColor = [System.Drawing.Color]::FromArgb(20, 20, 20)
$btnShowMissing.Cursor = [System.Windows.Forms.Cursors]::Hand
$LaunchPanelView.Controls.Add($btnShowMissing)

$lblMissingHeader = New-Object System.Windows.Forms.Label
$lblMissingHeader.Text = "Missing IDs:"
$lblMissingHeader.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$lblMissingHeader.ForeColor = [System.Drawing.Color]::White
$lblMissingHeader.AutoSize = $true
$lblMissingHeader.Location = New-Object System.Drawing.Point(40, 455)
$LaunchPanelView.Controls.Add($lblMissingHeader)

$txtMissingIDs = New-Object System.Windows.Forms.TextBox
$txtMissingIDs.Location = New-Object System.Drawing.Point(40, 480)
$txtMissingIDs.Size = New-Object System.Drawing.Size(340, 140)
$txtMissingIDs.Multiline = $true
$txtMissingIDs.ScrollBars = "Vertical"
$txtMissingIDs.Font = New-Object System.Drawing.Font("Segoe UI", 11)
$txtMissingIDs.BackColor = [System.Drawing.Color]::White
$txtMissingIDs.ForeColor = [System.Drawing.Color]::Black
$txtMissingIDs.ReadOnly = $true
$LaunchPanelView.Controls.Add($txtMissingIDs)
$lblStatus.Text = "Ready to launch."
$LaunchPanelView.Controls.Add($lblStatus)

# Launch Logic
$btnLaunch.Add_Click({
        try { $script:txtPass.Text | Out-File $PinFile -NoNewline -Encoding UTF8 } catch {}
        $btnLaunch.Enabled = $false
        $btnLaunch.Text = "LAUNCHING..."
        $btnLaunch.BackColor = [System.Drawing.Color]::FromArgb(150, 130, 50)
        $script:HandledHandles = @{}
        $lblStatus.Text = "Launching RDP Sessions..."
        [System.Windows.Forms.Application]::DoEvents()

        $startID = [int]$txtStart.Text
        $endID = [int]$txtEnd.Text
        $docs = [System.Environment]::GetFolderPath('MyDocuments')
        $files = Get-ChildItem -Path $docs -Filter "*.rdp" -ErrorAction SilentlyContinue
    
        $found = 0
        foreach ($f in $files) {
            if ($f.Name -match '(\d+)') {
                $num = [int]$matches[1]
                if ($num -ge $startID -and $num -le $endID) {
                    $lblStatus.Text = "Opening: $num (Fullscreen)`nAuto-pasting password..."
                    [System.Windows.Forms.Application]::DoEvents()
                    try {
                        Start-Process "mstsc.exe" -ArgumentList "/f", "`"$($f.FullName)`""
                        $found++
                    }
                    catch {}
                    Start-Sleep -Milliseconds 800 # Slight delay to let windows register
                }
            }
        }
    
        if ($found -eq 0) {
            $lblStatus.Text = "Error: No matching RDP files found."
        }
        else {
            $lblStatus.Text = "Launched $found sessions.`nPassword injection is active."
        }

        $btnLaunch.Enabled = $true
        $btnLaunch.Text = "START RDP SESSIONS"
        $btnLaunch.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
    })

# --- ALIGNER VIEW CONTENT ---
$AlignHeader = New-Object System.Windows.Forms.Label
$AlignHeader.Text = "WINDOW ALIGNER"
$AlignHeader.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$AlignHeader.ForeColor = [System.Drawing.Color]::White
$AlignHeader.AutoSize = $false
$AlignHeader.TextAlign = "MiddleCenter"
$AlignHeader.Size = New-Object System.Drawing.Size(440, 35)
$AlignHeader.Location = New-Object System.Drawing.Point(0, 30)
$AlignPanelView.Controls.Add($AlignHeader)

# Control Panel Card
$AlignPanelCard = New-Object System.Windows.Forms.Panel
$AlignPanelCard.Size = New-Object System.Drawing.Size(340, 170)
$AlignPanelCard.Location = New-Object System.Drawing.Point(40, 100)
$AlignPanelCard.BackColor = [System.Drawing.Color]::FromArgb(25, 50, 35)
$AlignPanelView.Controls.Add($AlignPanelCard)

New-RDPSectionLabel $AlignPanelCard "GRID LAYOUT" 20

# Row Selection (Modern Toggle Buttons)
$UpdateRadioUI = {
    if ($script:Radio2.Checked) {
        $script:Radio2.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55) # Gold
        $script:Radio2.ForeColor = [System.Drawing.Color]::FromArgb(10, 28, 18)
        $script:Radio3.BackColor = [System.Drawing.Color]::FromArgb(35, 65, 45) # Dark Green
        $script:Radio3.ForeColor = [System.Drawing.Color]::Silver
    }
    else {
        $script:Radio2.BackColor = [System.Drawing.Color]::FromArgb(35, 65, 45)
        $script:Radio2.ForeColor = [System.Drawing.Color]::Silver
        $script:Radio3.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
        $script:Radio3.ForeColor = [System.Drawing.Color]::FromArgb(10, 28, 18)
    }
}

$script:Radio2 = New-Object System.Windows.Forms.RadioButton
$script:Radio2.Text = "2 Rows"
$script:Radio2.Appearance = [System.Windows.Forms.Appearance]::Button
$script:Radio2.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$script:Radio2.FlatAppearance.BorderSize = 0
$script:Radio2.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$script:Radio2.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$script:Radio2.Size = New-Object System.Drawing.Size(130, 35)
$script:Radio2.Location = New-Object System.Drawing.Point(30, 50)
$script:Radio2.Cursor = [System.Windows.Forms.Cursors]::Hand
$script:Radio2.Add_CheckedChanged($UpdateRadioUI)
$AlignPanelCard.Controls.Add($script:Radio2)

$script:Radio3 = New-Object System.Windows.Forms.RadioButton
$script:Radio3.Text = "3 Rows"
$script:Radio3.Appearance = [System.Windows.Forms.Appearance]::Button
$script:Radio3.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$script:Radio3.FlatAppearance.BorderSize = 0
$script:Radio3.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$script:Radio3.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$script:Radio3.Size = New-Object System.Drawing.Size(130, 35)
$script:Radio3.Location = New-Object System.Drawing.Point(170, 50)
$script:Radio3.Cursor = [System.Windows.Forms.Cursors]::Hand
$script:Radio3.Checked = $true
$script:Radio3.Add_CheckedChanged($UpdateRadioUI)
$AlignPanelCard.Controls.Add($script:Radio3)

# Initialize Toggle State Colors
& $UpdateRadioUI

# Minimize Checkbox
$script:CheckMin = New-Object System.Windows.Forms.CheckBox
$script:CheckMin.Text = "Auto-Minimize App"
$script:CheckMin.ForeColor = [System.Drawing.Color]::LightGray
$script:CheckMin.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$script:CheckMin.AutoSize = $true
$script:CheckMin.Location = New-Object System.Drawing.Point(30, 120)
$script:CheckMin.Cursor = [System.Windows.Forms.Cursors]::Hand
$AlignPanelCard.Controls.Add($script:CheckMin)

# Apply Button
$btnApplyAlign = New-Object System.Windows.Forms.Button
$btnApplyAlign.Text = "ALIGN WINDOWS"
$btnApplyAlign.Size = New-Object System.Drawing.Size(340, 55)
$btnApplyAlign.Location = New-Object System.Drawing.Point(40, 300)
$btnApplyAlign.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$btnApplyAlign.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnApplyAlign.FlatAppearance.BorderSize = 0
$btnApplyAlign.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55) # Islamic Gold
$btnApplyAlign.ForeColor = [System.Drawing.Color]::FromArgb(10, 28, 18)
$btnApplyAlign.Cursor = [System.Windows.Forms.Cursors]::Hand
$AlignPanelView.Controls.Add($btnApplyAlign)

# Align Logic for Button
$btnApplyAlign.Add_Click({
        [void](Update-RDPAlignment)
        if ($script:CheckMin.Checked) {
            $Form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
        }
    })

# --- ABOUT VIEW CONTENT ---
$AboutTitle = New-Object System.Windows.Forms.Label
$AboutTitle.Text = "RDP ULTIMATE MANAGER"
$AboutTitle.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$AboutTitle.ForeColor = [System.Drawing.Color]::White
$AboutTitle.AutoSize = $false
$AboutTitle.TextAlign = "MiddleCenter"
$AboutTitle.Size = New-Object System.Drawing.Size(440, 35)
$AboutTitle.Location = New-Object System.Drawing.Point(0, 40)
$AboutPanelView.Controls.Add($AboutTitle)

$DevName = New-Object System.Windows.Forms.Label
$DevName.Text = "Developed by: Dinesh M"
$DevName.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$DevName.ForeColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
$DevName.AutoSize = $false
$DevName.TextAlign = "MiddleCenter"
$DevName.Size = New-Object System.Drawing.Size(440, 30)
$DevName.Location = New-Object System.Drawing.Point(0, 90)
$AboutPanelView.Controls.Add($DevName)

$Desc = New-Object System.Windows.Forms.Label
$Desc.Text = "Custom Automation & Scripting Solutions"
$Desc.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$Desc.ForeColor = [System.Drawing.Color]::LightGray
$Desc.AutoSize = $false
$Desc.TextAlign = "MiddleCenter"
$Desc.Size = New-Object System.Drawing.Size(440, 30)
$Desc.Location = New-Object System.Drawing.Point(0, 125)
$AboutPanelView.Controls.Add($Desc)
$btnShowMissing.Add_Click({
    $startID = [int]$txtStart.Text
    $endID = [int]$txtEnd.Text
    
    $activeWindows = Get-Process -Name "mstsc" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
    $live = @()
    foreach ($win in $activeWindows) {
        if ($win.MainWindowTitle -match "(\d+)") {
            $live += [int]$matches[1]
        }
    }
    
    $live = $live | Select-Object -Unique | Sort-Object
    $lblLiveRDPs.Text = "Live RDPs: $($live.Count)"
    
    $missing = @()
    if ($startID -gt 0 -and $endID -ge $startID) {
        for ($i = $startID; $i -le $endID; $i++) {
            if ($live -notcontains $i) {
                $missing += $i
            }
        }
    }
    
    $txtMissingIDs.Text = "Missing IDs ($($missing.Count)):`r`n" + ($missing -join ", ")
})

# --- BACKGROUND WORKERS (Timers) ---

# 1. Alignment Timer (Optional - user requested Start/Stop loop in original)
# We will just use the loop logic if the user requests it, but the merged code used a Click -> Loop format.
# Let's add a "Loop Mode" toggle to the aligner?
# The request said "Features: Sort by number in title, Start/Stop toggle button."
# So I will replicate the "Start/Stop" loop logic on the Aligner button.

$TimerAlign = New-Object System.Windows.Forms.Timer
$TimerAlign.Interval = $LoopAlignmentInterval
$script:AlignRunning = $false

$TimerAlign.Add_Tick({ [void](Align-Windows) })

$btnApplyAlign.Add_Click({
        if ($script:AlignRunning) {
            $TimerAlign.Stop()
            $btnApplyAlign.Text = "ALIGN WINDOWS (START)"
            $btnApplyAlign.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
            $script:AlignRunning = $false
        }
        else {
            [void](Update-RDPAlignment)
            $TimerAlign.Start()
            $btnApplyAlign.Text = "STOP ALIGNMENT"
            $btnApplyAlign.BackColor = [System.Drawing.Color]::FromArgb(200, 50, 50)
            $script:AlignRunning = $true
        
            if ($script:CheckMin.Checked) {
                $Form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
            }
        }
    })
# Clear previous click event to avoid double binding
$btnApplyAlign.remove_Click($btnApplyAlign.Click) 
# Wait, I can't easily remove anonymous delegates in PS. I should just define the logic once.
# I will redefine the button logic below to be correct.

$btnApplyAlign = New-Object System.Windows.Forms.Button # Re-create to clear events
$btnApplyAlign.Text = "INITIATE ALIGNMENT"
$btnApplyAlign.Size = New-Object System.Drawing.Size(340, 55)
$btnApplyAlign.Location = New-Object System.Drawing.Point(40, 300)
$btnApplyAlign.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$btnApplyAlign.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$btnApplyAlign.FlatAppearance.BorderSize = 0
$btnApplyAlign.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
$btnApplyAlign.ForeColor = [System.Drawing.Color]::FromArgb(10, 28, 18)
$btnApplyAlign.Cursor = [System.Windows.Forms.Cursors]::Hand
$AlignPanelView.Controls.Add($btnApplyAlign)

$btnApplyAlign.Add_Click({
        if ($script:AlignRunning) {
            $TimerAlign.Stop()
            $btnApplyAlign.Text = "INITIATE ALIGNMENT"
            $btnApplyAlign.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
            $script:AlignRunning = $false
        }
        else {
            [void](Update-RDPAlignment)
            $TimerAlign.Start()
            $btnApplyAlign.Text = "STOP ALIGNMENT LOOP"
            $btnApplyAlign.BackColor = [System.Drawing.Color]::FromArgb(231, 76, 60)
            $script:AlignRunning = $true
        
            if ($script:CheckMin.Checked) {
                $Form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
            }
        }
    })


# 2. Password Injection Timer (Always Configured to Run)
# It only acts if password text is present.
$TimerPaste = New-Object System.Windows.Forms.Timer
$TimerPaste.Interval = $LoopPasteInterval
$TimerPaste.Add_Tick({ Invoke-PasswordInjection })
$TimerPaste.Start()


# --- Footer ---
$FooterLabel = New-Object System.Windows.Forms.Label
$FooterLabel.Text = "$([char]0x0645)$([char]0x0627) $([char]0x0634)$([char]0x0627)$([char]0x0621) $([char]0x0627)$([char]0x0644)$([char]0x0644)$([char]0x0647)"
$FooterLabel.Font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$FooterLabel.ForeColor = [System.Drawing.Color]::FromArgb(212, 175, 55) # Gold
$FooterLabel.BackColor = [System.Drawing.Color]::FromArgb(6, 20, 14) # Solid background to prevent glitches
$FooterLabel.AutoSize = $false
$FooterLabel.TextAlign = "MiddleCenter"
$FooterLabel.Size = New-Object System.Drawing.Size(440, 40)
$FooterLabel.Location = New-Object System.Drawing.Point(0, 680)
$Form.Controls.Add($FooterLabel)

# --- Admin Password Lock ---
function Get-StringHash([string]$str) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($str)
    $hash = $sha.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hash)).Replace("-","")
}

function Show-AdminPasswordDialog([string]$Title) {
    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = $Title
    $dlg.Size = New-Object System.Drawing.Size(360, 180)
    $dlg.StartPosition = "CenterScreen"
    $dlg.TopMost = $true
    $dlg.FormBorderStyle = "FixedDialog"
    $dlg.MaximizeBox = $false
    $dlg.MinimizeBox = $false
    $dlg.BackColor = [System.Drawing.Color]::FromArgb(12, 32, 22)

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $Title
    $lbl.ForeColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
    $lbl.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $lbl.Location = New-Object System.Drawing.Point(20, 15)
    $lbl.Size = New-Object System.Drawing.Size(300, 20)
    $dlg.Controls.Add($lbl)

    $txt = New-Object System.Windows.Forms.TextBox
    $txt.Location = New-Object System.Drawing.Point(20, 45)
    $txt.Size = New-Object System.Drawing.Size(300, 25)
    $txt.PasswordChar = '*'
    $txt.Font = New-Object System.Drawing.Font("Segoe UI", 11)
    $txt.BackColor = [System.Drawing.Color]::FromArgb(25, 50, 35)
    $txt.ForeColor = [System.Drawing.Color]::White
    $txt.BorderStyle = "FixedSingle"
    $dlg.Controls.Add($txt)

    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = "OK"
    $btn.Size = New-Object System.Drawing.Size(100, 35)
    $btn.Location = New-Object System.Drawing.Point(110, 85)
    $btn.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
    $btn.ForeColor = [System.Drawing.Color]::FromArgb(10, 28, 18)
    $btn.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $btn.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btn.FlatAppearance.BorderSize = 0
    $btn.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $dlg.AcceptButton = $btn
    $dlg.Controls.Add($btn)

    $result = $dlg.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) { return $txt.Text }
    return $null
}

# --- Script Directory Initialization ---
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }

# ============================================================================
# LICENSE MANAGEMENT SYSTEM INTEGRATION
# ============================================================================

$script:ApiBaseUrl = "http://localhost:5000/api/licenses"
$LicenseFile = Join-Path $ScriptDir "license.dat"
$OfflineGraceHours = 48 # 48 hours offline grace period

function Get-SystemHWID {
    try {
        $cpu = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1).ProcessorId
        $board = (Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1).SerialNumber
        $comp = $env:COMPUTERNAME
        $raw = "$cpu-$board-$comp"
        $sha = [System.Security.Cryptography.SHA256]::Create()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($raw)
        $hash = [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace("-", "")
        return "HWID-" + $hash.Substring(0, 16)
    } catch {
        return "HWID-" + $env:COMPUTERNAME
    }
}

function Show-LicensePromptDialog([string]$Message = "Enter License Key to Activate RDP Manager:") {
    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = "License Activation Required"
    $dlg.Size = New-Object System.Drawing.Size(440, 220)
    $dlg.StartPosition = "CenterScreen"
    $dlg.TopMost = $true
    $dlg.FormBorderStyle = "FixedDialog"
    $dlg.MaximizeBox = $false
    $dlg.MinimizeBox = $false
    $dlg.BackColor = [System.Drawing.Color]::FromArgb(12, 32, 22)

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $Message
    $lbl.ForeColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
    $lbl.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $lbl.Location = New-Object System.Drawing.Point(20, 15)
    $lbl.Size = New-Object System.Drawing.Size(380, 45)
    $dlg.Controls.Add($lbl)

    $txt = New-Object System.Windows.Forms.TextBox
    $txt.Location = New-Object System.Drawing.Point(20, 70)
    $txt.Size = New-Object System.Drawing.Size(380, 25)
    $txt.Font = New-Object System.Drawing.Font("Segoe UI", 11)
    $txt.BackColor = [System.Drawing.Color]::FromArgb(25, 50, 35)
    $txt.ForeColor = [System.Drawing.Color]::White
    $txt.BorderStyle = "FixedSingle"
    $txt.Text = "RDP-"
    $dlg.Controls.Add($txt)

    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = "Activate License"
    $btn.Size = New-Object System.Drawing.Size(160, 35)
    $btn.Location = New-Object System.Drawing.Point(140, 120)
    $btn.BackColor = [System.Drawing.Color]::FromArgb(212, 175, 55)
    $btn.ForeColor = [System.Drawing.Color]::FromArgb(10, 28, 18)
    $btn.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $btn.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btn.FlatAppearance.BorderSize = 0
    $btn.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $dlg.AcceptButton = $btn
    $dlg.Controls.Add($btn)

    $result = $dlg.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) { return $txt.Text.Trim() }
    return $null
}

function Save-LicenseCache([string]$key, [string]$hwid) {
    $cache = @{
        license_key = $key
        hwid = $hwid
        last_validated = (Get-Date).ToString("o")
    } | ConvertTo-Json
    $cache | Out-File $LicenseFile -NoNewline -Encoding UTF8
}

function Load-LicenseCache {
    if (Test-Path $LicenseFile) {
        try {
            $raw = Get-Content $LicenseFile -Raw -ErrorAction SilentlyContinue
            if ($raw) { return $raw | ConvertFrom-Json }
        } catch {}
    }
    return $null
}

function Invoke-LicenseVerification {
    $hwid = Get-SystemHWID
    $cache = Load-LicenseCache
    $key = $null

    if ($cache -and $cache.license_key) {
        $key = $cache.license_key
    } else {
        $key = Show-LicensePromptDialog "License Key Required. Enter Key to Activate:"
        if (-not $key) {
            [System.Windows.Forms.MessageBox]::Show("License key is required to use this software. Application will exit.", "License Error", "OK", "Error")
            exit
        }
    }

    $body = @{
        key = $key
        hwid = $hwid
        computer_name = $env:COMPUTERNAME
    } | ConvertTo-Json

    try {
        $endpoint = if ($cache) { "$script:ApiBaseUrl/validate" } else { "$script:ApiBaseUrl/activate" }
        $response = Invoke-RestMethod -Uri $endpoint -Method Post -Body $body -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop

        if ($response.success -or $response.valid) {
            Save-LicenseCache -key $key -hwid $hwid
        } else {
            [System.Windows.Forms.MessageBox]::Show("License Error: $($response.message)", "License Access Denied", "OK", "Error")
            if (Test-Path $LicenseFile) { Remove-Item $LicenseFile -Force }
            exit
        }
    } catch {
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $errJson = $reader.ReadToEnd() | ConvertFrom-Json
                $msg = $errJson.message
                [System.Windows.Forms.MessageBox]::Show("License Verification Failed:`n`n$msg", "License Error", "OK", "Error")
            } catch {
                [System.Windows.Forms.MessageBox]::Show("License Error: Server rejected request ($($_.Exception.Message))", "License Error", "OK", "Error")
            }
            if (Test-Path $LicenseFile) { Remove-Item $LicenseFile -Force }
            exit
        }

        if ($cache -and $cache.last_validated) {
            try {
                $lastVal = [datetime]::Parse($cache.last_validated)
                $hoursSince = ((Get-Date) - $lastVal).TotalHours
                if ($hoursSince -le $OfflineGraceHours) {
                    return
                } else {
                    [System.Windows.Forms.MessageBox]::Show("Backend License Server Unreachable.`n`nYour offline grace period ($OfflineGraceHours hours) has expired. Please connect to internet to validate license.", "Offline Grace Expired", "OK", "Error")
                    exit
                }
            } catch {
                [System.Windows.Forms.MessageBox]::Show("Unable to connect to License Server and offline cache is invalid.", "License Error", "OK", "Error")
                exit
            }
        } else {
            [System.Windows.Forms.MessageBox]::Show("Unable to connect to Backend License Server at $script:ApiBaseUrl.`n`nPlease ensure backend server is running.", "Connection Error", "OK", "Error")
            exit
        }
    }
}

# Perform License Verification on Startup
Invoke-LicenseVerification

$AdminPassFile = Join-Path $ScriptDir "admin.dat"
$LastCheckFile = Join-Path $ScriptDir "lastcheck.dat"

# First time: create admin password
if (-not (Test-Path $AdminPassFile)) {
    $p1 = Show-AdminPasswordDialog "Set Admin Password (First Run)"
    if (-not $p1) { [System.Windows.Forms.MessageBox]::Show("Admin password is required. App will close."); exit }
    $p2 = Show-AdminPasswordDialog "Confirm Admin Password"
    if ($p1 -ne $p2) { [System.Windows.Forms.MessageBox]::Show("Passwords do not match. App will close."); exit }
    Get-StringHash $p1 | Out-File $AdminPassFile -NoNewline -Encoding UTF8
    (Get-Date).ToString("o") | Out-File $LastCheckFile -NoNewline -Encoding UTF8
}

$AdminHash = (Get-Content $AdminPassFile -Raw).Trim()

# Check if 30 days have passed since last verification
$NeedVerify = $true
if (Test-Path $LastCheckFile) {
    try {
        $lastCheck = [datetime]::Parse((Get-Content $LastCheckFile -Raw).Trim())
        $daysSince = ((Get-Date) - $lastCheck).TotalDays
        if ($daysSince -lt 30) { $NeedVerify = $false }
    } catch { $NeedVerify = $true }
}

if ($NeedVerify) {
    $daysLeft = 30
    try {
        $lastCheck = [datetime]::Parse((Get-Content $LastCheckFile -Raw -ErrorAction SilentlyContinue).Trim())
        $daysLeft = [int][Math]::Ceiling(30 - ((Get-Date) - $lastCheck).TotalDays)
    } catch {}

    $startPass = Show-AdminPasswordDialog "30-Day Verification Required - Enter Admin Password"
    if (-not $startPass -or (Get-StringHash $startPass) -ne $AdminHash) {
        [System.Windows.Forms.MessageBox]::Show("Wrong password! Access Denied.", "Security", "OK", "Error")
        exit
    }
    # Save verified timestamp
    (Get-Date).ToString("o") | Out-File $LastCheckFile -NoNewline -Encoding UTF8
}

# --- Auto Start Logic ---
if ($AutoStart) {
    if ($ShowLauncher) { & $ShowLauncher } # Ensure Launcher view is active
    $TimerAutoStart = New-Object System.Windows.Forms.Timer
    $TimerAutoStart.Interval = 1000 # 1 Second Delay
    $TimerAutoStart.Add_Tick({
            $TimerAutoStart.Stop()
            $btnLaunch.PerformClick()
        })
    $TimerAutoStart.Start()
}

# --- Init ---
[System.Windows.Forms.Application]::EnableVisualStyles()
$Form.ShowDialog()
