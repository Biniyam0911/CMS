$connStr = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;"
$con = New-Object System.Data.SqlClient.SqlConnection($connStr)
$con.Open()
$cmd = $con.CreateCommand()
$cmd.CommandText = "SELECT cc.name, cc.definition FROM sys.check_constraints cc WHERE cc.parent_object_id = OBJECT_ID('LabInstruments')"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Output ($reader["name"] + ": " + $reader["definition"])
}
$reader.Close()
$con.Close()
