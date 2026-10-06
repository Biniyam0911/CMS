$connStr = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;"
$con = New-Object System.Data.SqlClient.SqlConnection($connStr)
$con.Open()
$cmd = $con.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) FROM LabInstruments"
$cnt = $cmd.ExecuteScalar()
Write-Output "LabInstruments row count: $cnt"

$cmd.CommandText = "SELECT Id, Name, Model, Protocol, IpAddress, Port, ConnectionMode, RemoteIp, RemotePort FROM LabInstruments"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Output ("Row: " + $reader["Id"] + " | " + $reader["Name"] + " | Mode=" + $reader["ConnectionMode"] + " | IP=" + $reader["IpAddress"] + ":" + $reader["Port"])
}
$reader.Close()
$con.Close()
