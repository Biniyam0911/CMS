<#
.SYNOPSIS
    Send a mock LIS result to the CMS TCP listener for a specific OrderId and TestId.

.DESCRIPTION
    Queries the CMS database to fetch:
      - Patient MRN and name from the LabOrder
      - TestCode and TestName from LabTestCatalog for the given TestId
      - The LabOrderItem.Id (orderItemId) for this order+test combo
    Then builds and sends an MLLP-wrapped HL7 v2.5 ORU^R01 message.

.PARAMETER OrderId
    The LabOrders.Id (e.g. 78246)

.PARAMETER TestId
    The LabTestCatalog.Id (e.g. 753)

.PARAMETER Value
    The numeric result value to report (default: 5.5)

.PARAMETER Unit
    The unit of measurement (default: fetched from DB NormalRangeHigh/Low or empty)

.PARAMETER Flag
    HL7 abnormal flag: N, H, L, HH, LL, A (default: N)

.PARAMETER RefRange
    Reference range string (default: fetched from DB or '3.5-10.5')

.PARAMETER Server
    TCP server host (default: 127.0.0.1)

.PARAMETER Port
    TCP port the CMS LIS listener is on (default: 8004)

.EXAMPLE
    .\test_lis_by_orderid.ps1 -OrderId 78252 -TestId 753 -Value 6.2 -Flag N
    .\test_lis_by_orderid.ps1 -OrderId 78252 -TestId 753 -Value 55.0 -Unit "U/L" -Flag H -RefRange "10-40"
#>

param(
    [Parameter(Mandatory=$true)]  [int]    $OrderId,
    [Parameter(Mandatory=$true)]  [int]    $TestId,
    [Parameter(Mandatory=$false)] [double] $Value      = 5.5,
    [Parameter(Mandatory=$false)] [string] $Unit       = "",
    [Parameter(Mandatory=$false)] [string] $Flag       = "N",
    [Parameter(Mandatory=$false)] [string] $RefRange   = "",
    [Parameter(Mandatory=$false)] [string] $Server     = "127.0.0.1",
    [Parameter(Mandatory=$false)] [int]    $Port       = 8004
)

Set-StrictMode -Off
$ErrorActionPreference = "Stop"

# ─────────────────────────────────────────────
# 1. Fetch data from DB
# ─────────────────────────────────────────────
$connStr = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;Connect Timeout=10;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

# Order + patient info
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT o.Id AS OrderId, o.OrderNumber, p.MRN, LTRIM(ISNULL(p.FirstName,'') + ' ' + ISNULL(p.LastName,'')) AS PatientName FROM LabOrders o JOIN Patients p ON p.Id = o.PatientId WHERE o.Id = $OrderId"
$dr = $cmd.ExecuteReader()
if (-not $dr.Read()) {
    $dr.Close(); $conn.Close()
    Write-Error "No LabOrder found with Id=$OrderId"
    exit 1
}
$orderNumber  = $dr["OrderNumber"].ToString()
$mrn          = $dr["MRN"].ToString()
$patientName  = $dr["PatientName"].ToString()
$dr.Close()

Write-Host "Order  : $orderNumber"
Write-Host "Patient: $patientName  MRN=$mrn"

# Test info from catalog
$cmd2 = $conn.CreateCommand()
$cmd2.CommandText = @"
SELECT t.Id, t.TestCode, t.TestName,
       ISNULL(t.Unit, '') AS Unit,
       ISNULL(CAST(t.NormalRangeLow  AS VARCHAR), '') AS NormLow,
       ISNULL(CAST(t.NormalRangeHigh AS VARCHAR), '') AS NormHigh
FROM   LabTestCatalog t
WHERE  t.Id = $TestId
"@
$dr2 = $cmd2.ExecuteReader()
if (-not $dr2.Read()) {
    $dr2.Close(); $conn.Close()
    Write-Error "No LabTestCatalog entry found with Id=$TestId"
    exit 1
}
$testCode = $dr2["TestCode"].ToString()
$testName = $dr2["TestName"].ToString()
$dbUnit   = $dr2["Unit"].ToString()
$normLow  = $dr2["NormLow"].ToString()
$normHigh = $dr2["NormHigh"].ToString()
$dr2.Close()

# Use DB unit/range if not overridden
if ([string]::IsNullOrWhiteSpace($Unit))     { $Unit     = $dbUnit }
if ([string]::IsNullOrWhiteSpace($RefRange)) {
    if ($normLow -and $normHigh) { $RefRange = "$normLow-$normHigh" }
    elseif ($normHigh)           { $RefRange = "0-$normHigh" }
    else                         { $RefRange = "" }
}

Write-Host "Test   : $testCode  $testName  Unit=$Unit  RefRange=$RefRange"

# OrderItem Id for this order+test (used in OBR-3 / filler)
$cmd3 = $conn.CreateCommand()
$cmd3.CommandText = "SELECT TOP 1 Id FROM LabOrderItems WHERE OrderId = $OrderId AND TestId = $TestId ORDER BY Id"
$orderItemId = $cmd3.ExecuteScalar()
if (-not $orderItemId) {
    Write-Warning "No LabOrderItem found for OrderId=$OrderId TestId=$TestId - using 0 as fallback"
    $orderItemId = 0
}
$conn.Close()


Write-Host "OrderItemId: $orderItemId"
Write-Host ""

# ─────────────────────────────────────────────
# 2. Build HL7 ORU^R01
# ─────────────────────────────────────────────
$now       = Get-Date -Format "yyyyMMddHHmmss"
$msgCtrlId = "MSG$now"
$obxId     = 1

$hl7 = @"
MSH|^~\&|LIS|LAB|CMS|CLINIC|$now||ORU^R01|$msgCtrlId|P|2.5
PID|1||$mrn^^^CMS^MR||$patientName||19800101|U
OBR|1|$OrderId|$orderItemId|$testCode^$testName|||$now
OBX|$obxId|NM|$testCode^$testName||$Value|$Unit|$RefRange|$Flag|||F
"@.TrimStart()

# ─────────────────────────────────────────────
# 3. Wrap in MLLP and send
# ─────────────────────────────────────────────
$MLLP_START = [char]0x0B          # VT
$MLLP_END   = [char]0x1C + "`r"   # FS + CR

$message = $MLLP_START + $hl7 + $MLLP_END

Write-Host "=== HL7 Message ===" -ForegroundColor Cyan
Write-Host $hl7
Write-Host "===================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Connecting to $Server`:$Port ..." -ForegroundColor Yellow

try {
    $tcp    = New-Object System.Net.Sockets.TcpClient($Server, $Port)
    $stream = $tcp.GetStream()
    $stream.ReadTimeout  = 10000
    $stream.WriteTimeout = 10000

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($message)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    Write-Host "Message sent. Waiting for ACK..." -ForegroundColor Green

    Start-Sleep -Milliseconds 2000

    $buf = New-Object byte[] 4096
    $read = $stream.Read($buf, 0, $buf.Length)
    if ($read -gt 0) {
        $ack = [System.Text.Encoding]::UTF8.GetString($buf, 0, $read)
        Write-Host "=== ACK Received ===" -ForegroundColor Green
        Write-Host $ack
    } else {
        Write-Host "(No ACK data received)" -ForegroundColor DarkYellow
    }

    $stream.Close()
    $tcp.Close()
} catch {
    Write-Error "Connection/send error: $_"
}
