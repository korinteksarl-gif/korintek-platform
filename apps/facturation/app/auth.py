"""Authentification Entra ID + rôles KORINTEK Facturation."""
import os
import msal

CLIENT_ID = os.environ["AZURE_CLIENT_ID"]
CLIENT_SECRET = os.environ["AZURE_CLIENT_SECRET"]
TENANT_ID = os.environ["AZURE_TENANT_ID"]
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:8000").rstrip("/")
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}

AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
REDIRECT_PATH = "/auth/callback"
REDIRECT_URI = f"{APP_BASE_URL}{REDIRECT_PATH}"
SCOPES = ["User.Read"]
ROLES = {"SUPER_ADMIN", "ADMIN", "OPERATOR", "AUDITOR"}


def _msal_app():
    return msal.ConfidentialClientApplication(CLIENT_ID, client_credential=CLIENT_SECRET, authority=AUTHORITY)


def get_auth_url(state: str) -> str:
    return _msal_app().get_authorization_request_url(scopes=SCOPES, state=state, redirect_uri=REDIRECT_URI)


def acquire_token_by_code(code: str) -> dict:
    result = _msal_app().acquire_token_by_authorization_code(code=code, scopes=SCOPES, redirect_uri=REDIRECT_URI)
    if "error" in result:
        raise RuntimeError(f"Échec authentification Entra ID: {result.get('error_description')}")
    return result


def get_logout_url() -> str:
    return f"{AUTHORITY}/oauth2/v2.0/logout?post_logout_redirect_uri={APP_BASE_URL}/"


def is_bootstrap_super_admin(email: str) -> bool:
    """Return True for emails explicitly designated as permanent bootstrap Super Admins."""
    return email.lower() in ADMIN_EMAILS


def role_permissions(role: str) -> set[str]:
    return {
        "SUPER_ADMIN": {"view", "create", "update", "archive", "delete", "settings", "users", "audit", "export", "payments"},
        "ADMIN": {"view", "create", "update", "audit", "export", "payments"},
        "OPERATOR": {"view_own", "create", "update_own", "export_own", "payments"},
        "AUDITOR": {"view", "audit", "export"},
    }.get(role, set())
