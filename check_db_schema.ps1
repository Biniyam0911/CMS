$connStr = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;"
$con = New-Object System.Data.SqlClient.SqlConnection($connStr)
$con.Open()
$cmd = $con.CreateCommand()
$cmd.CommandText = "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMN_NAME IN ('DisplayOrder')"
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    Write-Output ("Table: " + $r[0] + " | Column: " + $r[1] + " | Type: " + $r[2] + " | Default: " + $r[3])
}
$con.Close()
