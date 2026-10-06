$connStr = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;"
$sql = Get-Content "database\migration\seed_lab_instruments.sql" -Raw
$batches = $sql -split '\r?\nGO\r?\n'
$con = New-Object System.Data.SqlClient.SqlConnection($connStr)
$con.Open()
foreach ($batch in $batches) {
    $b = $batch.Trim()
    if ($b.Length -gt 0) {
        $cmd = $con.CreateCommand()
        $cmd.CommandText = $b
        try { $cmd.ExecuteNonQuery() | Out-Null } catch { Write-Output "WARN: $_" }
    }
}
Write-Output "Seeding executed."
$con.Close()
