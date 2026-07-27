$fileLoc = "C:\Encrypted.txt"
$VaultUrl = "https://VLT-APP01.fmb.com"

<#
    Decrypts the value.txt containing roleID and secretID.
    ConvertFrom-Json converts the JSON-formatted string to a PS hashtable for easy referencing.

    roleID gotten from Vault CLI on the server 'vault read auth/approle/role/AppA/role-id'
    secretID generated with vault write -f auth/approle/role/AppA/secret-id.  This generates a new secret every time it's run; use with caution.
#>

Function Decrypt-File {
    param (
        [string]$fileLoc
    )
    $file = Get-Content $fileLoc
    $bytes = [Convert]::FromBase64String($file)

    Add-Type -AssemblyName System.Security

    $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect(
        $bytes,
        $null,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )

    $vaultIDs = [System.Text.Encoding]::UTF8.GetString($decrypted)

    return $vaultIDs
}


<#
    Uses roleID/secretID to auth and get a short lived token.
#>
Function Get-VaultToken {
    $IDs = decrypt-File -fileLoc $fileLoc| ConvertFrom-Json
    $RoleId = $IDs.roleID
    $SecretId = $IDs.secretID

    $body = @{
        role_id  = $RoleId
        secret_id = $SecretId
    } | ConvertTo-Json

    $response = Invoke-RestMethod `
        -Uri "$VaultUrl/v1/auth/approle/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body

    $VaultToken = $response.auth.client_token

    return $VaultToken
}


<#
    Pulls token, grabs ClientIQ values for Start-Server.ps1
#>
Function Get-CIQValues {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("dev","test","staging", "prod")]
        [string]$Environment
    )

    $VaultToken = Get-VaultToken

    $response = Invoke-RestMethod `
        -Uri "$VaultUrl/v1/secret/data/$Environment/ClientIQ" `
        -Method Get `
        -Headers @{
            "X-Vault-Token" = $VaultToken
        }

    $Secrets = $response.data.data

    return $Secrets
}

Export-ModuleMember -Function Get-CIQValues