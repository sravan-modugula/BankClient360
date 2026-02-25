# ============================================
# ClientIQ Development Server Startup Script
# ============================================

# Set environment variables
$env:NODE_ENV = "development"
$env:PORT = "5000"
$env:HOST = "127.0.0.1"
$env:DATABASE_DIALECT = "sqlserver"
$env:DB_VENDOR = "mssql"

# SQL Server connection (update these values)
$env:MSSQL_SERVER = "HUB-SQL1TST-LIS"
$env:MSSQL_DATABASE = "ClientIQ"
$env:MSSQL_USER = "ClientIQ"
$env:MSSQL_PASSWORD = "&|mb*f?!snqhY~pM4j&0"
$env:MSSQL_PORT = "1433"
$env:MSSQL_ENCRYPT = "false"
$env:MSSQL_TRUST_SERVER_CERTIFICATE = "true"
$env:SAML_ENABLED = "false"

# Session secret
$env:SESSION_SECRET = "cacdd0fdd20e94caf36a14a01c1568f0ef66d9c3b7e654c7b9492633cdce4ffa"

# Navigate to application directory
Set-Location -Path "C:\ClientIQ"

# Start development server
Write-Host "Starting ClientIQ Development Server..." -ForegroundColor Green
Write-Host "URL: http://localhost:5000" -ForegroundColor Cyan
npx tsx watch --clear-screen=false server/index.ts