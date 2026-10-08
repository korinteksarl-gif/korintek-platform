import os, secrets, logging
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from . import auth, db

logging.basicConfig(level=logging.INFO)
logger=logging.getLogger('korintek.facturation')

db.init_db(); app=FastAPI(title='KORINTEK — Facturation')
app.add_middleware(SessionMiddleware,secret_key=os.environ.get('SESSION_SECRET_KEY',secrets.token_hex(32)),same_site='lax',https_only=True)
templates=Jinja2Templates(directory=os.path.join(os.path.dirname(__file__),'templates'))

def get_current_user(request): return request.session.get('user')
def require_user(request):
    u=get_current_user(request)
    if not u: raise HTTPException(401,'Non authentifié')
    return u

def require_perm(permission):
    def dep(user=Depends(require_user)):
        if permission not in auth.role_permissions(user['role']): raise HTTPException(403,'Droits insuffisants')
        return user
    return dep

@app.get('/login')
def login(request):
    state=secrets.token_urlsafe(16); request.session['auth_state']=state; return RedirectResponse(auth.get_auth_url(state))

@app.get('/auth/callback')
def auth_callback(request:Request,code:str=None,state:str=None,error:str=None):
    if error: raise HTTPException(400,f'Erreur Entra ID: {error}')
    if not code or state != request.session.get('auth_state'): raise HTTPException(400,'Requête d’authentification invalide')
    result=auth.acquire_token_by_code(code); claims=result.get('id_token_claims',{}); email=(claims.get('preferred_username') or claims.get('email') or '').lower(); name=claims.get('name',email)
    if not email: raise HTTPException(400,'Impossible de récupérer l’email')
    existing=db.get_user(email); bootstrap=auth.is_bootstrap_super_admin(email)
    u=db.upsert_user(email,name,bootstrap_super=bootstrap)
    # ADMIN_EMAILS remains an emergency bootstrap: it cannot demote an explicitly managed account.
    role='SUPER_ADMIN' if bootstrap else u['role']
    request.session['user']={'email':email,'name':name,'role':role,'is_admin':role in {'SUPER_ADMIN','ADMIN'}}
    db.audit(email,role,'LOGIN','USER',email,{'name':name})
    return RedirectResponse('/')

@app.get('/logout')
def logout(request):
    u=get_current_user(request)
    if u: db.audit(u['email'],u['role'],'LOGOUT','USER',u['email'])
    request.session.clear(); return RedirectResponse(auth.get_logout_url())

@app.get('/')
def index(request: Request):
    u=get_current_user(request)
    if not u:return RedirectResponse('/login')
    return templates.TemplateResponse('index.html',{'request':request,'user':u})

@app.get('/api/me')
def api_me(user=Depends(require_user)): return user


@app.get('/api/diagnostics')
def api_diagnostics(user=Depends(require_user)):
    if user['role'] != 'SUPER_ADMIN':
        raise HTTPException(403, 'Diagnostic réservé au Super Admin')
    try:
        with db.get_conn() as conn:
            cur=conn.cursor()
            cur.execute('SELECT current_database(), current_user')
            database, db_user = cur.fetchone()
            cur.execute('SELECT COUNT(*) FROM documents')
            document_count=cur.fetchone()[0]
            cur.execute('SELECT COUNT(*) FROM users')
            user_count=cur.fetchone()[0]
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='documents' ORDER BY ordinal_position")
            columns=[r[0] for r in cur.fetchall()]
        return {'ok':True,'database':database,'db_user':db_user,'document_count':document_count,'user_count':user_count,'documents_columns':columns}
    except Exception as exc:
        raise HTTPException(500, detail=_error_detail(exc, 'diagnostics'))

@app.get('/api/settings')
def api_get_settings(user=Depends(require_user)): return db.get_settings()

@app.post('/api/settings')
async def api_save_settings(request:Request,user=Depends(require_perm('settings'))):
    data=await request.json(); db.save_settings(data); db.audit(user['email'],user['role'],'UPDATE_SETTINGS','SETTINGS','1'); return {'ok':True}

@app.get('/api/users')
def api_users(user=Depends(require_perm('users'))): return db.list_users()

@app.patch('/api/users/{email}/role')
async def api_user_role(email:str,request:Request,user=Depends(require_perm('users'))):
    data=await request.json(); role=data.get('role')
    if email.lower()==user['email'].lower() and role!='SUPER_ADMIN': raise HTTPException(400,'Le Super Admin ne peut pas se retirer lui-même ce rôle.')
    db.set_user_role(email,role); db.audit(user['email'],user['role'],'CHANGE_ROLE','USER',email,{'new_role':role}); return {'ok':True}

@app.get('/api/audit')
def api_audit(user=Depends(require_perm('audit'))): return db.audit_list()

@app.get('/api/documents')
def api_list_documents(user=Depends(require_user)):
    return db.list_documents(user['email'],user['role'])

@app.get('/api/documents/{doc_id}')
def api_get_document(doc_id:int,user=Depends(require_user)):
    d=db.get_document(doc_id,user['email'],user['role'])
    if not d: raise HTTPException(404,'Document introuvable')
    db.audit(user['email'],user['role'],'VIEW_DOCUMENT','DOCUMENT',doc_id)
    return d

def _safe_audit(email, role, action, entity_type=None, entity_id=None, details=None):
    try:
        db.audit(email, role, action, entity_type, entity_id, details)
    except Exception:
        logger.exception('Audit non bloquant: %s %s %s', action, entity_type, entity_id)


def _error_detail(exc, operation):
    logger.exception('Erreur Facturation [%s]', operation)
    return {
        'operation': operation,
        'type': type(exc).__name__,
        'message': str(exc) or 'Erreur interne sans message'
    }


@app.post('/api/documents')
async def api_create_document(request:Request,user=Depends(require_perm('create'))):
    try:
        doc=await request.json()
        doc_id=db.create_document(doc,user['email'])
    except Exception as exc:
        raise HTTPException(500, detail=_error_detail(exc, 'create_document'))

    try:
        db.upsert_client(doc.get('client'),doc.get('clientTel'),doc.get('clientEmail'),doc.get('clientAdresse'),user['email'])
    except Exception:
        logger.exception('Enregistrement client non bloquant pour document %s', doc_id)
    _safe_audit(user['email'],user['role'],'CREATE_DOCUMENT','DOCUMENT',doc_id,{'num':doc.get('num'),'type':doc.get('type')})
    return {'ok':True,'id':doc_id,'status':'DRAFT'}

@app.put('/api/documents/{doc_id}')
async def api_update_document(doc_id:int,request:Request,user=Depends(require_user)):
    try:
        d=db.get_document(doc_id,user['email'],user['role'])
        if not d: raise HTTPException(404,'Document introuvable')
        allowed=user['role']=='SUPER_ADMIN' or user['role']=='ADMIN' or (user['role']=='OPERATOR' and d['created_by']==user['email'])
        if not allowed: raise HTTPException(403,'Modification interdite')
        if d['status'] in {'ARCHIVED','CANCELLED'}: raise HTTPException(409,'Document verrouillé')
        doc=await request.json(); ok=db.update_document(doc_id,doc,user['email'])
        if not ok: raise HTTPException(409,'Document non modifiable')
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, detail=_error_detail(exc, 'update_document'))
    try:
        db.upsert_client(doc.get('client'),doc.get('clientTel'),doc.get('clientEmail'),doc.get('clientAdresse'),user['email'])
    except Exception:
        logger.exception('Mise à jour client non bloquante pour document %s', doc_id)
    _safe_audit(user['email'],user['role'],'UPDATE_DOCUMENT','DOCUMENT',doc_id,{'num':doc.get('num')})
    return {'ok':True}

@app.post('/api/documents/{doc_id}/status')
async def api_status(doc_id:int,request:Request,user=Depends(require_user)):
    data=await request.json(); status=data.get('status'); d=db.get_document(doc_id,user['email'],user['role'])
    if not d: raise HTTPException(404,'Document introuvable')
    current=d.get('status') or 'DRAFT'
    transitions={
        'DRAFT': {'VALIDATED'},
        'VALIDATED': {'ISSUED'},
        'ISSUED': {'SENT'},
        'SENT': set(),
        'PARTIALLY_PAID': set(),
        'PAID': set(),
        'CANCELLED': set(),
        'ARCHIVED': set(),
    }
    if status in {'PARTIALLY_PAID','PAID'}:
        raise HTTPException(400,'Les statuts de paiement sont gérés automatiquement par l’enregistrement des paiements.')
    if status=='ARCHIVED' and user['role']!='SUPER_ADMIN':
        raise HTTPException(403,'Archivage réservé au Super Admin')
    if status=='CANCELLED' and user['role']!='SUPER_ADMIN':
        raise HTTPException(403,'Annulation administrative réservée au Super Admin')
    if status in {'VALIDATED','ISSUED','SENT'} and user['role'] not in {'SUPER_ADMIN','ADMIN'}:
        raise HTTPException(403,'Validation réservée à l’administration')
    if status not in {'CANCELLED','ARCHIVED'} and status not in transitions.get(current,set()):
        raise HTTPException(409,f'Transition de statut interdite: {current} → {status}')
    if current in {'CANCELLED','ARCHIVED'}:
        raise HTTPException(409,'Document verrouillé')
    ok=db.change_status(doc_id,status,user['email'],data.get('reason'))
    if not ok: raise HTTPException(409,'Impossible de changer le statut')
    db.audit(user['email'],user['role'],status,'DOCUMENT',doc_id,{'reason':data.get('reason')})
    return {'ok':True,'status':status}

@app.delete('/api/documents/{doc_id}')
def api_delete_document(doc_id:int,user=Depends(require_perm('delete'))):
    d=db.get_document(doc_id,user['email'],user['role'])
    if not d: raise HTTPException(404,'Document introuvable')
    db.soft_delete(doc_id,user['email']); db.audit(user['email'],user['role'],'DELETE','DOCUMENT',doc_id,{'logical':True}); return {'ok':True,'status':'CANCELLED'}

@app.get('/api/documents/{doc_id}/payments')
def api_payments(doc_id:int,user=Depends(require_perm('payments'))):
    d=db.get_document(doc_id,user['email'],user['role'])
    if not d: raise HTTPException(404,'Document introuvable')
    p=db.list_payments(doc_id); paid=sum(int(x['amount']) for x in p); return {'payments':p,'paid':paid,'balance':max(0,int(d['total'] or 0)-paid)}

@app.post('/api/documents/{doc_id}/payments')
async def api_add_payment(doc_id:int,request:Request,user=Depends(require_perm('payments'))):
    d=db.get_document(doc_id,user['email'],user['role'])
    if not d: raise HTTPException(404,'Document introuvable')
    data=await request.json(); amount=int(data.get('amount') or 0); balance=int(d['total'] or 0)-db.get_payment_summary(doc_id)
    if amount<=0 or amount>balance: raise HTTPException(400,'Montant de paiement invalide')
    pid=db.add_payment(doc_id,amount,data.get('method','Autre'),data.get('payment_date'),data.get('reference'),data.get('notes'),user['email']); newpaid=db.get_payment_summary(doc_id); newstatus='PAID' if newpaid>=int(d['total'] or 0) else 'PARTIALLY_PAID'; db.change_status(doc_id,newstatus,user['email']); db.audit(user['email'],user['role'],'CREATE_PAYMENT','PAYMENT',pid,{'document_id':doc_id,'amount':amount}); return {'ok':True,'payment_id':pid,'paid':newpaid,'balance':max(0,int(d['total'] or 0)-newpaid),'status':newstatus}

@app.get('/api/clients')
def api_search_clients(q:str='',user=Depends(require_user)):
    if len(q.strip())<2:return []
    return db.search_clients(q.strip())

@app.get('/api/documents/export.xlsx')
def api_export_documents(start:str,end:str,user=Depends(require_perm('export'))):
    from openpyxl import Workbook
    from openpyxl.styles import Font,PatternFill
    from io import BytesIO
    docs=db.get_documents_in_range(start,end,user['email'],user['role']); wb=Workbook(); ws=wb.active; ws.title='Factures'
    ws.append(['Type','Numéro','Date','Client','Téléphone','HT (FCFA)','TVA','Retenue (%)','Net à payer (FCFA)','Statut','Créé par'])
    for c in ws[1]: c.font=Font(bold=True,color='FFFFFF'); c.fill=PatternFill('solid',fgColor='0E2226')
    for d in docs: ws.append([d['type'],d['num'],d['date'],d['client'],d['clientTel'],d['ht'],'Oui' if d['tvaOn'] else 'Non',d['retenuePct'],d['total'],d['status'],d['created_by']])
    buf=BytesIO(); wb.save(buf); buf.seek(0); db.audit(user['email'],user['role'],'EXPORT_XLSX','DOCUMENT',None,{'start':start,'end':end,'count':len(docs)}); return StreamingResponse(buf,media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={'Content-Disposition':f'attachment; filename="korintek_factures_{start}_a_{end}.xlsx"'})

@app.get('/api/dashboard/stats')
def api_dashboard_stats(user=Depends(require_user)):
    if user['role'] not in {'SUPER_ADMIN','ADMIN','AUDITOR'}: raise HTTPException(403,'Tableau de bord global réservé à l’administration/audit')
    return db.get_dashboard_stats(user['email'],user['role'])
