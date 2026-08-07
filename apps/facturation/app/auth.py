"""
Authentification Entra ID (Azure AD) via MSAL — flux "authorization code".
Restreint la connexion aux comptes du tenant KORINTEK uniquement.
"""
import os
import msal

CLIENT_ID = os.environ["AZURE_CLIENT_ID"]
CLIENT_SECRET = os.environ["AZURE_CLIENT_SECRET"]
TENANT_ID = os.environ["AZURE_TENANT_ID"]
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:8000").rstrip("/")
ADMIN_EMAILS = {
    e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()
}

AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
REDIRECT_PATH = "/auth/callback"
REDIRECT_URI = f"{APP_BASE_URL}{REDIRECT_PATH}"
SCOPES = ["User.Read"]


def _msal_app():
    return msal.ConfidentialClientApplication(
        client_id=CLIENT_ID,
        client_credential=CLIENT_SECRET,
        authority=AUTHORITY,
    )


def get_auth_url(state: str) -> str:
    return _msal_app().get_authorization_request_url(
        scopes=SCOPES,
        state=state,
        redirect_uri=REDIRECT_URI,
    )


def acquire_token_by_code(code: str) -> dict:
    """Échange le code d'autorisation contre un token, retourne les claims utilisateur."""
    result = _msal_app().acquire_token_by_authorization_code(
        code=code,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )
    if "error" in result:
        raise RuntimeError(f"Échec authentification Entra ID: {result.get('error_description')}")
    return result


def get_logout_url() -> str:
    return f"{AUTHORITY}/oauth2/v2.0/logout?post_logout_redirect_uri={APP_BASE_URL}/"


def is_admin(email: str) -> bool:
    return email.lower() in ADMIN_EMAILS
