"""
Couche base de données — PostgreSQL (hébergé gratuitement sur Neon.tech).
Stocke : réglages société (RIB, signature, logo...), et l'historique des
proformas/factures générées, avec l'email de la personne qui a créé chaque document.
"""
import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ["DATABASE_URL"]  # ex: postgresql://user:pass@host/dbname?sslmode=require


def _connect():
    return psycopg2.connect(DATABASE_URL)


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                data JSONB NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                doc_type TEXT NOT NULL,
                num TEXT,
                doc_date TEXT,
                client_nom TEXT,
                client_tel TEXT,
                client_email TEXT,
                client_adresse TEXT,
                items_json JSONB,
                ht INTEGER,
                total INTEGER,
                tva_on BOOLEAN,
                retenue_pct INTEGER,
                conditions TEXT,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                email TEXT PRIMARY KEY,
                display_name TEXT,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                nom TEXT NOT NULL,
                tel TEXT,
                email TEXT,
                adresse TEXT,
                created_by TEXT,
                last_used_at TEXT NOT NULL,
                UNIQUE (nom, tel)
            )
        """)


# ---------------- settings ----------------

DEFAULT_SETTINGS = {
    "nom": "KORINTEK SARL",
    "adresse": "Adidogomé Soviépé, en face du Centre CIFT, 28 BP 313, Lomé - Togo",
    "tel": "+228 99 25 26 26 / 99 99 01 31",
    "email": "info@korintek.com",
    "rccm": "TG-LFW-01-2020-B12-02929",
    "nif": "1001702047",
    "cnss": "127916",
    "site": "korintek.com",
    "banque": "BANQUE ATLANTIQUE TOGO",
    "ribBanque": "TG138",
    "ribGuichet": "01004",
    "compte": "041477730005",
    "ribCle": "77",
    "iban": "TG53 TG13 8010 0404 1477 7300 0577",
    "swift": "ATTGTGTGXXX",
    "signature": None,
}


def get_settings():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT data FROM settings WHERE id = 1")
        row = cur.fetchone()
        if row:
            return row[0]  # JSONB already parsed as dict by psycopg2
        return dict(DEFAULT_SETTINGS)


def save_settings(data: dict):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO settings (id, data) VALUES (1, %s)
               ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data""",
            (json.dumps(data),),
        )


# ---------------- documents ----------------

def list_documents(user_email: str, is_admin: bool):
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if is_admin:
            cur.execute("SELECT * FROM documents ORDER BY id DESC")
        else:
            cur.execute(
                "SELECT * FROM documents WHERE created_by = %s ORDER BY id DESC",
                (user_email,),
            )
        return [_row_to_doc(r) for r in cur.fetchall()]


def get_document(doc_id: int, user_email: str, is_admin: bool):
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM documents WHERE id = %s", (doc_id,))
        row = cur.fetchone()
        if not row:
            return None
        doc = _row_to_doc(row)
        if not is_admin and doc["created_by"] != user_email:
            return None
        return doc


def create_document(doc: dict, created_by: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO documents
               (doc_type, num, doc_date, client_nom, client_tel, client_email,
                client_adresse, items_json, ht, total, tva_on, retenue_pct, conditions,
                created_by, created_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               RETURNING id""",
            (
                doc.get("type"),
                doc.get("num"),
                doc.get("date"),
                doc.get("client"),
                doc.get("clientTel"),
                doc.get("clientEmail"),
                doc.get("clientAdresse"),
                json.dumps(doc.get("items", [])),
                doc.get("ht", 0),
                doc.get("total", 0),
                bool(doc.get("tvaOn")),
                doc.get("retenuePct", 0),
                doc.get("conditions"),
                created_by,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        return cur.fetchone()[0]


def _row_to_doc(row):
    return {
        "id": row["id"],
        "type": row["doc_type"],
        "num": row["num"],
        "date": row["doc_date"],
        "client": row["client_nom"],
        "clientTel": row["client_tel"],
        "clientEmail": row["client_email"],
        "clientAdresse": row["client_adresse"],
        "items": row["items_json"] or [],
        "ht": row["ht"],
        "total": row["total"],
        "tvaOn": bool(row["tva_on"]),
        "retenuePct": row["retenue_pct"],
        "conditions": row["conditions"],
        "created_by": row["created_by"],
        "created_at": row["created_at"],
    }


# ---------------- users ----------------

def upsert_user(email: str, display_name: str):
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO users (email, display_name, first_seen_at, last_seen_at)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (email) DO UPDATE SET
                 display_name = EXCLUDED.display_name,
                 last_seen_at = EXCLUDED.last_seen_at""",
            (email.lower(), display_name, now, now),
        )


# ---------------- clients (base clients réutilisable) ----------------

def upsert_client(nom: str, tel: str, email: str, adresse: str, created_by: str):
    if not nom:
        return
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO clients (nom, tel, email, adresse, created_by, last_used_at)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (nom, tel) DO UPDATE SET
                 email = COALESCE(EXCLUDED.email, clients.email),
                 adresse = COALESCE(EXCLUDED.adresse, clients.adresse),
                 last_used_at = EXCLUDED.last_used_at""",
            (nom.strip(), (tel or "").strip(), email, adresse, created_by, now),
        )


def search_clients(query: str, limit: int = 8):
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT nom, tel, email, adresse FROM clients
               WHERE nom ILIKE %s
               ORDER BY last_used_at DESC
               LIMIT %s""",
            (f"%{query}%", limit),
        )
        return [dict(r) for r in cur.fetchall()]


# ---------------- export & tableau de bord ----------------

def get_documents_in_range(start: str, end: str, user_email: str, is_admin: bool):
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if is_admin:
            cur.execute(
                """SELECT * FROM documents
                   WHERE doc_date >= %s AND doc_date <= %s
                   ORDER BY doc_date ASC, id ASC""",
                (start, end),
            )
        else:
            cur.execute(
                """SELECT * FROM documents
                   WHERE doc_date >= %s AND doc_date <= %s AND created_by = %s
                   ORDER BY doc_date ASC, id ASC""",
                (start, end, user_email),
            )
        return [_row_to_doc(r) for r in cur.fetchall()]


def _categorize_items(items):
    """Classe grossièrement les lignes d'une facture par catégorie de produit."""
    cats = {"PTE Core": 0, "Formations": 0, "Examens": 0, "Autre": 0}
    for it in items or []:
        name = (it.get("name") or "").lower()
        line_total = (it.get("price") or 0) * (it.get("qty") or 1)
        if "pte core" in name or "proforma pte" in name:
            cats["PTE Core"] += line_total
        elif "examen" in name or "voucher" in name:
            cats["Examens"] += line_total
        elif any(k in name for k in ["formation", "aws", "azure", "cisco", "ccna", "comptia",
                                       "isc", "cissp", "ceh", "pmi", "pmp", "capm", "cia", "cams", "frm"]):
            cats["Formations"] += line_total
        else:
            cats["Autre"] += line_total
    return cats


def get_dashboard_stats(user_email: str, is_admin: bool):
    with get_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if is_admin:
            cur.execute("SELECT * FROM documents ORDER BY doc_date ASC")
        else:
            cur.execute(
                "SELECT * FROM documents WHERE created_by = %s ORDER BY doc_date ASC",
                (user_email,),
            )
        docs = [_row_to_doc(r) for r in cur.fetchall()]

    monthly = {}
    by_type = {"proforma": {"total": 0, "count": 0}, "facture": {"total": 0, "count": 0}}
    by_creator = {}
    by_category = {"PTE Core": 0, "Formations": 0, "Examens": 0, "Autre": 0}

    for d in docs:
        month = (d["date"] or "")[:7] or "?"
        monthly.setdefault(month, {"total": 0, "count": 0})
        monthly[month]["total"] += d["total"] or 0
        monthly[month]["count"] += 1

        t = d["type"] if d["type"] in by_type else "proforma"
        by_type[t]["total"] += d["total"] or 0
        by_type[t]["count"] += 1

        creator = d["created_by"] or "?"
        by_creator.setdefault(creator, {"total": 0, "count": 0})
        by_creator[creator]["total"] += d["total"] or 0
        by_creator[creator]["count"] += 1

        cats = _categorize_items(d["items"])
        for k, v in cats.items():
            by_category[k] += v

    return {
        "monthly": [{"month": k, **v} for k, v in sorted(monthly.items())],
        "by_type": by_type,
        "by_creator": [{"email": k, **v} for k, v in sorted(by_creator.items(), key=lambda x: -x[1]["total"])],
        "by_category": by_category,
        "total_documents": len(docs),
        "total_amount": sum(d["total"] or 0 for d in docs),
    }
