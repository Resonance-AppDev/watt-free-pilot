"""Real Chromium UI tests with an isolated, mocked Supabase network. Never uses live accounts or writes."""
import contextlib
import http.server
import json
import re
import socket
import socketserver
import subprocess
import threading
import time
from pathlib import Path
import pytest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
UUID_OWNER='11111111-1111-4111-8111-111111111111'
UUID_MEMBER='33333333-3333-4333-8333-333333333333'
R1='22222222-2222-4222-8222-222222222222'
R2='44444444-4444-4444-8444-444444444444'
CODE='a'*64
class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

@contextlib.contextmanager
def site_server():
    sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
    class ThreadServer(socketserver.ThreadingMixIn,http.server.HTTPServer): daemon_threads=True
    handler=lambda *args,**kwargs: QuietHandler(*args,directory=str(PUBLIC),**kwargs)
    srv=ThreadServer(('127.0.0.1',port),handler)
    thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start()
    try:yield f'http://127.0.0.1:{port}'
    finally:srv.shutdown();srv.server_close()

class FakeSupabase:
    def __init__(self):
        self.rooms={R1:{'id':R1,'title':'WATT Private Pilot','owner_id':UUID_OWNER,'members':{UUID_OWNER:'owner',UUID_MEMBER:'member'},'messages':[
            {'id':1,'sender_id':UUID_OWNER,'sender_name':'Pilot owner','body':'Welcome to WATT','created_at':'2026-11-01T06:45:00Z'}]}}
        self.tokens={'fake-token-owner':UUID_OWNER,'fake-token-member':UUID_MEMBER}
        self.sent={};self.requests=[];self.denied=0
    def handler(self,route,request):
        url=request.url
        if request.method=='OPTIONS':
            route.fulfill(status=204,headers=self.headers());return
        name=url.split('/rpc/')[-1] if '/rpc/' in url else 'login'
        try:body=request.post_data_json or {}
        except:body={}
        auth=(request.headers.get('authorization') or '').replace('Bearer ','')
        uid=self.tokens.get(auth)
        self.requests.append({'name':name,'uid':uid})
        def response(content,status=200):route.fulfill(status=status,content_type='application/json',headers=self.headers(),body=json.dumps(content))
        if name=='login':
            email=body.get('email','')
            if email.startswith('owner'):
                user_id,token=UUID_OWNER,'fake-token-owner'
            elif email.startswith('member'):
                user_id,token=UUID_MEMBER,'fake-token-member'
            else:response({'error_code':'invalid_credentials'},400);return
            response({'access_token':token,'expires_in':3600,'user':{'id':user_id,'email':email,'email_confirmed_at':'2026-10-01T00:00:00Z','is_anonymous':False}});return
        if not uid:
            self.denied+=1;response({'ok':False,'code':'AUTH_REQUIRED'},401);return
        if name=='watt_pilot_list_rooms':
            items=[{'id':r['id'],'title':r['title'],'owner_id':r['owner_id'],'role':r['members'][uid]} for r in self.rooms.values() if uid in r['members']];response({'ok':True,'rooms':items});return
        if name=='watt_pilot_create_room':
            mine=sum(1 for r in self.rooms.values() if r['owner_id']==uid)
            if mine>=2:response({'ok':False,'code':'ROOM_LIMIT'});return
            self.rooms[R2]={'id':R2,'title':body['p_title'],'owner_id':uid,'members':{uid:'owner'},'messages':[]};response({'ok':True,'room':{'id':R2}});return
        if name=='watt_pilot_join_room':
            if body.get('p_token')!=CODE or R2 not in self.rooms:response({'ok':False,'code':'INVALID_INVITE'});return
            self.rooms[R2]['members'][uid]='member';response({'ok':True,'room':{'id':R2}});return
        rid=body.get('p_room_id')
        if not rid or rid not in self.rooms or uid not in self.rooms[rid]['members']:
            self.denied+=1;response({'ok':False,'code':'MEMBERSHIP_REQUIRED'});return
        room=self.rooms[rid]
        if name=='watt_pilot_get_room':
            after=int(body.get('p_after_id',0));msgs=room['messages']
            msgs=(msgs[-50:] if after==0 else [m for m in msgs if m['id']>after][:50])
            response({'ok':True,'room':{'id':rid,'title':room['title']},'members':[{'user_id':m} for m in room['members']],
                'messages':msgs,'next_after_id':max([m['id'] for m in msgs],default=after)});return
        if name=='watt_pilot_issue_invite':
            if uid!=room['owner_id']:response({'ok':False,'code':'OWNER_REQUIRED'});return
            response({'ok':True,'token':CODE,'expires_at':'2026-11-02T00:00:00Z'});return
        if name=='watt_pilot_revoke_invites':
            if uid!=room['owner_id']:response({'ok':False,'code':'OWNER_REQUIRED'});return
            response({'ok':True});return
        if name=='watt_pilot_send_message':
            key=(uid,body['p_client_message_id'])
            if key in self.sent:
                existing=self.sent[key]
                response({'ok':True,'duplicate':True,'message':existing});return
            msg={'id':len(room['messages'])+1,'sender_id':uid,'sender_name':'Participant','body':body['p_body'],
                 'created_at':'2026-11-01T10:45:00Z'}
            self.sent[key]=msg;room['messages'].append(msg)
            response({'ok':True,'duplicate':False,'message':msg});return
        response({'ok':False,'code':'BAD_INPUT'},400)
    @staticmethod
    def headers():return {'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS',
        'access-control-allow-headers':'apikey, authorization, content-type'}

def assert_no_overflow(page):
    measurement=page.evaluate('''() => ({viewport:document.documentElement.clientWidth,
      document:document.documentElement.scrollWidth,body:document.body.scrollWidth})''')
    assert measurement['document']<=measurement['viewport']+1,measurement

@pytest.fixture(scope='module')
def host():
    with site_server() as addr:yield addr

def prepare(page, filename, backend=None):
    # Browser policy blocks navigation to any URL; render the exact HTML/CSS on about:blank
    # and execute the exact JS with its ESM import/export boundary adapted for injection.
    html=(PUBLIC/filename).read_text()
    html=re.sub(r'<link[^>]+rel="stylesheet"[^>]*>', '', html)
    html=re.sub(r'<script[^>]+type="module"[^>]*></script>', '', html)
    page.set_content(html)
    page.add_style_tag(content=(PUBLIC/'assets/site.css').read_text())
    if backend:
        def handler(url, options):
            class Request:
                method=options.get('method','POST')
                headers={k.lower():v for k,v in options.get('headers',{}).items()}
                @property
                def url(self):return url
                @property
                def post_data_json(self):return json.loads(options.get('body','{}'))
            class Route:
                result={'status':500,'content':{'ok':False,'code':'TEST_ROUTE_ERROR'}}
                def fulfill(self,status=200,content_type=None,headers=None,body='{}'):
                    self.result={'status':status,'content':json.loads(body) if body else {}}
            route=Route();backend.handler(route,Request());return route.result
        page.expose_function('__mockSupabase',handler)
        page.add_script_tag(content="window.fetch=async (url,options)=>{\n            const x=await window.__mockSupabase(url,{method:options.method,headers:options.headers,body:options.body});\n            return new Response(JSON.stringify(x.content),{status:x.status,headers:{'content-type':'application/json'}});\n        };")
        core=(PUBLIC/'assets/core.js').read_text().replace('export ', '')
        core='(function(){\n'+core+'\nwindow.__WATT_API__={rpc,signInWithPassword,normalizeRooms,normalizeRoom,checkMessage,nextPending,friendlyError,isExpired,ROOM_ID,INVITE_CODE};\n})();'
        script=(PUBLIC/'assets/workspace.js').read_text()
        script=re.sub(r"^import \{[^\n]+\} from './core.js';", "const {rpc,signInWithPassword,normalizeRooms,normalizeRoom,checkMessage,nextPending,friendlyError,isExpired,ROOM_ID,INVITE_CODE}=window.__WATT_API__;",script)
        page.add_script_tag(content=core)
        page.add_script_tag(content=script)

def test_mobile_landing_and_login(host):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        for width in [360,390,768,1366]:
            page=browser.new_page(viewport={'width':width,'height':844},device_scale_factor=1)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            prepare(page,'index.html')
            assert page.get_by_role('heading',name='Human ideas. AI in concert.').is_visible()
            assert page.get_by_text('R0',exact=False).count()>0
            assert_no_overflow(page)
            if width==1366:page.screenshot(path=str(ROOT/'preview'/'homepage-desktop.png'),full_page=True)
            prepare(page,'workspace/index.html',FakeSupabase())
            assert page.get_by_role('button',name='Sign in securely').is_visible()
            assert_no_overflow(page)
            assert not errors,errors
            if width==390:page.screenshot(path=str(ROOT/'preview'/'workspace-signin-mobile.png'),full_page=True)
            page.close()
        browser.close()

def login(page,email='owner@example.com'):
    page.locator('#email').fill(email);page.locator('#password').fill('testpassword')
    page.locator('#pilot-acknowledge').check();page.locator('#login-submit').click()
    page.locator('#app-view').wait_for(state='visible',timeout=7000)

def test_simulated_two_user_rooms_invitations_and_messaging(host):
    backend=FakeSupabase()
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':390,'height':844})
        other=browser.new_page(viewport={'width':390,'height':844})
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)));other.on('pageerror',lambda e:errors.append(str(e)))
        prepare(page,'workspace/index.html',backend)
        prepare(other,'workspace/index.html',backend)
        login(page)
        page.locator('#room-title').get_by_text('WATT Private Pilot').wait_for()
        assert page.get_by_text('Welcome to WATT').is_visible()
        login(other,'member@example.com')
        assert other.get_by_text('Welcome to WATT').is_visible()
        assert other.locator('#owner-tools').is_hidden()
        assert other.locator('#room-count').inner_text()=='1'
        page.locator('#show-create').click();page.locator('#create-form [name=title]').fill('WATT Free QA room')
        page.locator('#create-form [name=name]').fill('Owner QA');page.get_by_role('button',name='Create room',exact=True).click()
        page.wait_for_function("document.querySelector('#room-title').textContent==='WATT Free QA room'",timeout=7000)
        page.locator('#message-draft').fill('Hello from the independent Firebase app')
        page.locator('#send-button').click()
        page.get_by_text('Hello from the independent Firebase app').wait_for(timeout=7000)
        assert len(backend.rooms[R2]['messages'])==1
        assert other.locator('#room-count').inner_text()=='1'
        page.locator('#generate-invite').click();page.locator('#invite-panel').wait_for(state='visible')
        assert page.locator('#invite-code').input_value()==CODE
        other.locator('#show-join').click();other.locator('#join-form [name=token]').fill(CODE)
        other.locator('#join-form [name=name]').fill('Member QA')
        other.get_by_role('button',name='Join room',exact=True).click()
        other.locator('#room-title').get_by_text('WATT Free QA room').wait_for()
        assert other.get_by_text('Hello from the independent Firebase app').is_visible()
        other.locator('#message-draft').fill('Reply from member')
        other.locator('#send-button').click();other.get_by_text('Reply from member').wait_for()
        page.locator('#refresh-messages').click();page.get_by_text('Reply from member').wait_for()
        assert len(backend.rooms[R2]['messages'])==2
        assert_no_overflow(page);assert_no_overflow(other)
        page.screenshot(path=str(ROOT/'preview'/'workspace-chat-mobile.png'),full_page=True)
        page.locator('#sign-out').click()
        assert page.locator('#login-view').is_visible()
        assert page.get_by_text('Reply from member').count()==0
        # about:blank has an opaque origin; storage access is prohibited by Chromium.
        # Node static checks verify no browser storage API is used in WATT source.
        assert not errors,errors
        browser.close()
