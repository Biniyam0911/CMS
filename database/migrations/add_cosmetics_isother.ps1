$connStr = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CosmeticsSales') AND name = 'IsOther')
BEGIN
    ALTER TABLE dbo.CosmeticsSales ADD IsOther BIT NOT NULL DEFAULT 0;
END
"
$res = $cmd.ExecuteNonQuery()
Write-Output "CosmeticsSales IsOther executed: $res"
$conn.Close()
