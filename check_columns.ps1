$connStr = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;"
$con = New-Object System.Data.SqlClient.SqlConnection($connStr)
$con.Open()
$cmd = $con.CreateCommand()
$cmd.CommandText = "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'LabInstruments'"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Output ($reader["COLUMN_NAME"] + " (" + $reader["DATA_TYPE"] + ", null=" + $reader["IS_NULLABLE"] + ")")
}
$reader.Close()
$con.Close()
