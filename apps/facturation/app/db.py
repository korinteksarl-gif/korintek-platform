"""Couche PostgreSQL — facturation KORINTEK."""
import json, os
from contextlib import contextmanager
from datetime import datetime, timezone
import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ["DATABASE_URL"]
ROLES = {"SUPER_ADMIN", "ADMIN", "OPERATOR", "AUDITOR"}


def _connect(): return psycopg2.connect(DATABASE_URL)

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
        cur.execute("""CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id=1), data JSONB NOT NULL)""")
        cur.execute("""CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY, doc_type TEXT NOT NULL, num TEXT, doc_date TEXT,
            client_nom TEXT, client_tel TEXT, client_email TEXT, client_adresse TEXT,
            items_json JSONB, ht INTEGER, total INTEGER, tva_on BOOLEAN,
            retenue_pct INTEGER, conditions TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
            status TEXT, updated_by TEXT, updated_at TEXT, archived_by TEXT, archived_at TEXT,
            cancelled_reason TEXT, activity_type TEXT
        )""")
        cur.execute("""CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY, display_name TEXT, first_seen_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'OPERATOR'
        )""")
        cur.execute("""CREATE TABLE IF NOT EXISTS clients (
            id SERIAL PRIMARY KEY, nom TEXT NOT NULL, tel TEXT, email TEXT, adresse TEXT,
            created_by TEXT, last_used_at TEXT NOT NULL, UNIQUE(nom,tel)
        )""")
        cur.execute("""CREATE TABLE IF NOT EXISTS audit_log (
            id SERIAL PRIMARY KEY, actor_email TEXT NOT NULL, actor_role TEXT,
            action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, details JSONB,
            success BOOLEAN NOT NULL DEFAULT TRUE, created_at TEXT NOT NULL
        )""")
        cur.execute("""CREATE TABLE IF NOT EXISTS payments (
            id SERIAL PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES documents(id),
            amount INTEGER NOT NULL CHECK(amount>0), method TEXT NOT NULL,
            payment_date TEXT NOT NULL, reference TEXT, notes TEXT,
            created_by TEXT NOT NULL, created_at TEXT NOT NULL
        )""")
        # Non-destructive upgrades for existing installations.
        for sql in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'OPERATOR'",
            # No default on legacy documents: existing rows keep a NULL status,
            # so the upgrade does not silently relabel historical documents as DRAFT.
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS status TEXT",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_by TEXT",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TEXT",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS archived_by TEXT",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS archived_at TEXT",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS cancelled_reason TEXT",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS activity_type TEXT",
            # Lot 3 : numérotation continue côté serveur + liens inter-modules
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS external_ref TEXT",
            "ALTER TABLE documents ADD COLUMN IF NOT EXISTS source TEXT",
            "CREATE UNIQUE INDEX IF NOT EXISTS documents_external_ref_uniq ON documents(external_ref) WHERE external_ref IS NOT NULL",
            """CREATE TABLE IF NOT EXISTS doc_counters (
                doc_type TEXT NOT NULL, year INTEGER NOT NULL, last INTEGER NOT NULL,
                PRIMARY KEY (doc_type, year))""",
            # Nouveau format PFX-AAAA-NNNN : unique. Les anciens numéros (aléatoires) ne sont pas concernés.
            "CREATE UNIQUE INDEX IF NOT EXISTS documents_num_seq_uniq ON documents(num) WHERE num ~ '^[A-Z]{3}-[0-9]{4}-[0-9]{4,}$'",
        ]: cur.execute(sql)


def now_iso(): return datetime.now(timezone.utc).isoformat()

DEFAULT_SETTINGS = {"nom":"KORINTEK SARL","adresse":"Adidogomé Soviépé, en face du Centre CIFT, 28 BP 313, Lomé - Togo","tel":"+228 99 25 26 26 / 99 99 01 31","email":"info@korintek.com","rccm":"TG-LFW-01-2020-B12-02929","nif":"1001702047","cnss":"127916","site":"korintek.com","banque":"BANQUE ATLANTIQUE TOGO","ribBanque":"TG138","ribGuichet":"01004","compte":"041477730005","ribCle":"77","iban":"TG53 TG13 8010 0404 1477 7300 0577","swift":"ATTGTGTGXXX","signature":None}

def get_settings():
    with get_conn() as conn:
        cur=conn.cursor(); cur.execute("SELECT data FROM settings WHERE id=1"); row=cur.fetchone()
        return row[0] if row else dict(DEFAULT_SETTINGS)

def save_settings(data):
    with get_conn() as conn:
        conn.cursor().execute("INSERT INTO settings(id,data) VALUES(1,%s) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data", (json.dumps(data),))

def audit(actor_email, actor_role, action, entity_type=None, entity_id=None, details=None, success=True):
    with get_conn() as conn:
        conn.cursor().execute("INSERT INTO audit_log(actor_email,actor_role,action,entity_type,entity_id,details,success,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)", (actor_email,actor_role,action,entity_type,str(entity_id) if entity_id is not None else None,json.dumps(details or {}),success,now_iso()))

def upsert_user(email, display_name, bootstrap_super=False):
    email=email.lower(); now=now_iso()
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""INSERT INTO users(email,display_name,first_seen_at,last_seen_at,role) VALUES(%s,%s,%s,%s,%s)
          ON CONFLICT(email) DO UPDATE SET
            display_name=EXCLUDED.display_name,
            last_seen_at=EXCLUDED.last_seen_at,
            role=CASE WHEN %s THEN 'SUPER_ADMIN' ELSE users.role END
          """, (email,display_name,now,now,"SUPER_ADMIN" if bootstrap_super else "OPERATOR",bootstrap_super))
        cur.execute("SELECT * FROM users WHERE email=%s",(email,)); return dict(cur.fetchone())

def get_user(email):
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor); cur.execute("SELECT * FROM users WHERE email=%s",(email.lower(),)); r=cur.fetchone(); return dict(r) if r else None

def list_users():
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor); cur.execute("SELECT email,display_name,role,first_seen_at,last_seen_at FROM users ORDER BY display_name,email"); return [dict(r) for r in cur.fetchall()]

def set_user_role(email, role):
    if role not in ROLES: raise ValueError("Rôle invalide")
    with get_conn() as conn:
        cur=conn.cursor(); cur.execute("UPDATE users SET role=%s WHERE email=%s",(role,email.lower()))
        return cur.rowcount == 1

def count_super_admins():
    with get_conn() as conn:
        cur=conn.cursor(); cur.execute("SELECT COUNT(*) FROM users WHERE role='SUPER_ADMIN'"); return int(cur.fetchone()[0])

def _row_to_doc(r):
    return {"id":r["id"],"type":r["doc_type"],"num":r["num"],"date":r["doc_date"],"client":r["client_nom"],"clientTel":r["client_tel"],"clientEmail":r["client_email"],"clientAdresse":r["client_adresse"],"items":r["items_json"] or [],"ht":r["ht"],"total":r["total"],"tvaOn":bool(r["tva_on"]),"retenuePct":r["retenue_pct"],"conditions":r["conditions"],"created_by":r["created_by"],"created_at":r["created_at"],"status":r.get("status") or "DRAFT","updated_by":r.get("updated_by"),"updated_at":r.get("updated_at"),"archived_by":r.get("archived_by"),"archived_at":r.get("archived_at"),"cancelled_reason":r.get("cancelled_reason"),"activityType":r.get("activity_type")}

def list_documents(email, role):
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if role in {"SUPER_ADMIN","ADMIN","AUDITOR"}: cur.execute("SELECT * FROM documents ORDER BY id DESC")
        else: cur.execute("SELECT * FROM documents WHERE created_by=%s ORDER BY id DESC",(email,))
        return [_row_to_doc(r) for r in cur.fetchall()]

def get_document(doc_id,email,role):
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor); cur.execute("SELECT * FROM documents WHERE id=%s",(doc_id,)); r=cur.fetchone()
        if not r:return None
        d=_row_to_doc(r)
        return d if role in {"SUPER_ADMIN","ADMIN","AUDITOR"} or d["created_by"]==email else None

DOC_PREFIX = {"facture": "FAC", "devis": "DEV", "proforma": "PRO"}

def _next_number(cur, doc_type, doc_date=None):
    """Numéro continu par type et par année (ex. FAC-2026-0001), attribué par le serveur.
    L'UPSERT verrouille la ligne du compteur : deux enregistrements simultanés
    ne peuvent pas obtenir le même numéro."""
    prefix = DOC_PREFIX.get(doc_type, "PRO")
    try:
        year = int(str(doc_date)[:4])
    except (TypeError, ValueError):
        year = datetime.now(timezone.utc).year
    if year < 2000 or year > 2100:
        year = datetime.now(timezone.utc).year
    cur.execute("""INSERT INTO doc_counters(doc_type, year, last) VALUES (%s, %s, 1)
                   ON CONFLICT (doc_type, year) DO UPDATE SET last = doc_counters.last + 1
                   RETURNING last""", (prefix, year))
    return f"{prefix}-{year}-{cur.fetchone()[0]:04d}"

def create_document(doc,created_by,external_ref=None,source=None,status='DRAFT'):
    with get_conn() as conn:
        cur=conn.cursor()
        num=_next_number(cur, doc.get("type"), doc.get("date"))
        cur.execute("""INSERT INTO documents(doc_type,num,doc_date,client_nom,client_tel,client_email,client_adresse,items_json,ht,total,tva_on,retenue_pct,conditions,created_by,created_at,status,activity_type,external_ref,source) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",(doc.get("type"),num,doc.get("date"),doc.get("client"),doc.get("clientTel"),doc.get("clientEmail"),doc.get("clientAdresse"),json.dumps(doc.get("items",[])),doc.get("ht",0),doc.get("total",0),bool(doc.get("tvaOn")),doc.get("retenuePct",0),doc.get("conditions"),created_by,now_iso(),status,doc.get("activityType"),external_ref,source))
        return cur.fetchone()[0], num

def get_document_by_external_ref(external_ref):
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor); cur.execute("SELECT * FROM documents WHERE external_ref=%s",(external_ref,)); r=cur.fetchone()
        return _row_to_doc(r) if r else None

def update_document(doc_id,doc,actor):
    """Le numéro n'est jamais modifiable à la main : il est conservé, ou réattribué
    si le type change (ex. un devis transformé en facture reçoit un numéro FAC-)."""
    with get_conn() as conn:
        cur=conn.cursor()
        cur.execute("SELECT doc_type,num FROM documents WHERE id=%s",(doc_id,)); row=cur.fetchone()
        if not row: return None
        num = row[1] if (doc.get("type") or row[0]) == row[0] else _next_number(cur, doc.get("type"), doc.get("date"))
        doc = {**doc, "num": num}
        cur.execute("""UPDATE documents SET doc_type=%s,num=%s,doc_date=%s,client_nom=%s,client_tel=%s,client_email=%s,client_adresse=%s,items_json=%s,ht=%s,total=%s,tva_on=%s,retenue_pct=%s,conditions=%s,activity_type=%s,updated_by=%s,updated_at=%s WHERE id=%s AND COALESCE(status,'DRAFT') NOT IN ('ARCHIVED','CANCELLED') RETURNING id""",(doc.get("type"),doc.get("num"),doc.get("date"),doc.get("client"),doc.get("clientTel"),doc.get("clientEmail"),doc.get("clientAdresse"),json.dumps(doc.get("items",[])),doc.get("ht",0),doc.get("total",0),bool(doc.get("tvaOn")),doc.get("retenuePct",0),doc.get("conditions"),doc.get("activityType"),actor,now_iso(),doc_id)); return num if cur.fetchone() else None

def change_status(doc_id,status,actor,reason=None):
    allowed={"DRAFT","VALIDATED","ISSUED","SENT","PARTIALLY_PAID","PAID","CANCELLED","ARCHIVED"}
    if status not in allowed: raise ValueError("Statut invalide")
    with get_conn() as conn:
        cur=conn.cursor(); cur.execute("UPDATE documents SET status=%s,cancelled_reason=%s,updated_by=%s,updated_at=%s,archived_by=CASE WHEN %s='ARCHIVED' THEN %s ELSE archived_by END,archived_at=CASE WHEN %s='ARCHIVED' THEN %s ELSE archived_at END WHERE id=%s",(status,reason,actor,now_iso(),status,actor,status,now_iso(),doc_id)); return cur.rowcount>0

def soft_delete(doc_id,actor): return change_status(doc_id,"CANCELLED",actor,"Suppression logique / annulation administrative")

def upsert_client(nom,tel,email,adresse,created_by):
    if not nom:return
    with get_conn() as conn:
        conn.cursor().execute("INSERT INTO clients(nom,tel,email,adresse,created_by,last_used_at) VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(nom,tel) DO UPDATE SET email=COALESCE(EXCLUDED.email,clients.email),adresse=COALESCE(EXCLUDED.adresse,clients.adresse),last_used_at=EXCLUDED.last_used_at",(nom.strip(),(tel or '').strip(),email,adresse,created_by,now_iso()))

def search_clients(query,limit=8):
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor); cur.execute("SELECT nom,tel,email,adresse FROM clients WHERE nom ILIKE %s ORDER BY last_used_at DESC LIMIT %s",(f"%{query}%",limit)); return [dict(r) for r in cur.fetchall()]

def add_payment(doc_id,amount,method,payment_date,reference,notes,created_by):
    with get_conn() as conn:
        cur=conn.cursor(); cur.execute("INSERT INTO payments(document_id,amount,method,payment_date,reference,notes,created_by,created_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",(doc_id,amount,method,payment_date,reference,notes,created_by,now_iso())); return cur.fetchone()[0]

def list_payments(doc_id):
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor); cur.execute("SELECT * FROM payments WHERE document_id=%s ORDER BY payment_date,id",(doc_id,)); return [dict(r) for r in cur.fetchall()]

def get_payment_summary(doc_id):
    with get_conn() as conn:
        cur=conn.cursor(); cur.execute("SELECT COALESCE(SUM(amount),0) FROM payments WHERE document_id=%s",(doc_id,)); return int(cur.fetchone()[0])

def audit_list(limit=300):
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor); cur.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT %s",(limit,)); return [dict(r) for r in cur.fetchall()]

def get_documents_in_range(start,end,email,role):
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if role in {"SUPER_ADMIN","ADMIN","AUDITOR"}: cur.execute("SELECT * FROM documents WHERE doc_date>= %s AND doc_date<=%s ORDER BY doc_date,id",(start,end))
        else: cur.execute("SELECT * FROM documents WHERE doc_date>= %s AND doc_date<=%s AND created_by=%s ORDER BY doc_date,id",(start,end,email))
        return [_row_to_doc(r) for r in cur.fetchall()]

def _categorize_items(items):
    cats={"Fourniture / Vente":0,"Prestations":0,"Installation / Intégration":0,"Maintenance / Support":0,"Formation":0,"Examens / Certification":0,"Autre":0}
    for it in items or []:
        name=(it.get('name') or '').lower(); total=(it.get('price') or 0)*(it.get('qty') or 1)
        if any(k in name for k in ['examen','voucher','pearson','psi','pte']): cats['Examens / Certification']+=total
        elif any(k in name for k in ['formation','aws','azure','cisco','ccna','comptia','isc','cissp','ceh','pmi','pmp','capm','cia','cams','frm']): cats['Formation']+=total
        elif any(k in name for k in ['installation','configuration','intégration','integration','déploiement','deployment']): cats['Installation / Intégration']+=total
        elif any(k in name for k in ['maintenance','support','assistance','contrat']): cats['Maintenance / Support']+=total
        elif any(k in name for k in ['prestation','audit','conseil','consulting','service','accompagnement']): cats['Prestations']+=total
        elif any(k in name for k in ['switch','routeur','router','firewall','fortigate','serveur','server','nas','rack','pdu','ups','onduleur','ordinateur','laptop','pc','licence','license','câblage','cablage','accessoire']): cats['Fourniture / Vente']+=total
        else: cats['Autre']+=total
    return cats

def get_dashboard_stats(email,role):
    docs=list_documents(email,role); monthly={}; by_type={'devis':{'total':0,'count':0},'proforma':{'total':0,'count':0},'facture':{'total':0,'count':0}}; by_creator={}; cats={'Fourniture / Vente':0,'Prestations':0,'Installation / Intégration':0,'Maintenance / Support':0,'Formation':0,'Examens / Certification':0,'Autre':0}
    for d in docs:
        m=(d['date'] or '')[:7] or '?'; monthly.setdefault(m,{'total':0,'count':0}); monthly[m]['total']+=d['total'] or 0; monthly[m]['count']+=1
        t=d['type'] if d['type'] in by_type else 'proforma'; by_type[t]['total']+=d['total'] or 0; by_type[t]['count']+=1
        c=d['created_by']; by_creator.setdefault(c,{'total':0,'count':0}); by_creator[c]['total']+=d['total'] or 0; by_creator[c]['count']+=1
        activity_map={'FOURNITURE_VENTE':'Fourniture / Vente','PRESTATION':'Prestations','FOURNITURE_PRESTATION':'Fourniture / Vente','INSTALLATION_INTEGRATION':'Installation / Intégration','MAINTENANCE_SUPPORT':'Maintenance / Support','FORMATION':'Formation','EXAMEN_CERTIFICATION':'Examens / Certification','AUTRE':'Autre'}
        activity=d.get('activityType')
        if activity in activity_map:
            cats[activity_map[activity]] += d['total'] or 0
        else:
            for k,v in _categorize_items(d['items']).items(): cats[k]+=v
    return {'monthly':[{'month':k,**v} for k,v in sorted(monthly.items())],'by_type':by_type,'by_creator':[{'email':k,**v} for k,v in sorted(by_creator.items(),key=lambda x:-x[1]['total'])],'by_category':cats,'total_documents':len(docs),'total_amount':sum(d['total'] or 0 for d in docs)}


def get_receivables(email, role):
    """Factures émises non annulées : montant, encaissé, reste, ancienneté (jours)."""
    with get_conn() as conn:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        base="""SELECT d.*, COALESCE(p.paid,0) AS paid, p.last_payment
                FROM documents d
                LEFT JOIN (SELECT document_id, SUM(amount) AS paid, MAX(payment_date) AS last_payment FROM payments GROUP BY document_id) p ON p.document_id=d.id
                WHERE d.doc_type='facture' AND COALESCE(d.status,'DRAFT') NOT IN ('CANCELLED','ARCHIVED')"""
        if role in {"SUPER_ADMIN","ADMIN","AUDITOR"}: cur.execute(base+" ORDER BY d.doc_date, d.id")
        else: cur.execute(base+" AND d.created_by=%s ORDER BY d.doc_date, d.id",(email,))
        rows=cur.fetchall()
    today=datetime.now(timezone.utc).date(); out=[]
    for r in rows:
        d=_row_to_doc(r); paid=int(r["paid"] or 0); total=int(d["total"] or 0)
        try: age=(today-datetime.fromisoformat(str(d["date"])[:10]).date()).days
        except Exception: age=None
        out.append({**d,"paid":paid,"balance":max(0,total-paid),"age_days":age,"last_payment":r["last_payment"]})
    return out
