$cs = "Server=127.0.0.1,8710;Database=ClinicDB;User Id=sa;Password=say@123;Encrypt=False;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "UPDATE ClinicSettings SET SettingValue = '8215614286:AAH-0jSn8wCK5-wctKskfSY6v_OLUhOMgtk' WHERE SettingKey = 'Telemed.TelegramBotToken' AND TenantId = 1"
$cmd.ExecuteNonQuery()
$conn.Close()
Write-Output "Token successfully saved in ClinicSettings!"
