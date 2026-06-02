# ============================================
# ClientIQ Development Server Startup Script
# ============================================

param (
    [Parameter(Mandatory=$true)]
    [string]$DBServer,

    [Parameter(Mandatory=$true)]
    [string]$DBName,

    [Parameter(Mandatory=$true)]
    [string]$DBUser,

    [Parameter(Mandatory=$true)]
    [string]$DBPassword,

    [Parameter(Mandatory=$true)]
    [string]$SessionSecret
)

# Set environment variables
$env:NODE_ENV = "development"
$env:PORT = "5000"
$env:HOST = "127.0.0.1"
$env:DATABASE_DIALECT = "sqlserver"
$env:DB_VENDOR = "mssql"

# SQL Server connection
$env:MSSQL_SERVER = $DBServer
$env:MSSQL_DATABASE = $DBName
$env:MSSQL_USER = $DBUser
$env:MSSQL_PASSWORD = $DBPassword
$env:MSSQL_PORT = "1433"
$env:MSSQL_ENCRYPT = "false"
$env:MSSQL_TRUST_SERVER_CERTIFICATE = "true"
$env:SAML_ENABLED = "false"

# Session secret
$env:SESSION_SECRET = $SessionSecret

# Navigate to application directory
Set-Location -Path "C:\ClientIQ"

# Start development server
Write-Host "Starting ClientIQ Development Server..." -ForegroundColor Green
Write-Host "URL: http://localhost:5000" -ForegroundColor Cyan
npx tsx watch --clear-screen=false server/index.ts