"""Generate an independently fictional, ordinary-file round-2 packet.

All names, places, dates, memories and images are invented. Only the relationship
shape and interface constraints mirror the assignment. No private source is read.
Run with the bundled Python (Pillow and reportlab) and an optional output folder.
"""
from pathlib import Path
import csv
import hashlib
import html
import json
import shutil
import subprocess
import sys
import zipfile
from PIL import Image, ImageDraw, ImageFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / 'packet'
for child in ['01-upload', '02-background/saved-family-folder', '02-background/saved-family-correspondence', '80-presenter', '90-provenance']:
    (ROOT / child).mkdir(parents=True, exist_ok=True)
UPLOAD = ROOT / '01-upload'
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def encode(value): return json.dumps(value, indent=2, ensure_ascii=True) + '\n'
def save(path, value): Path(path).write_text(encode(value))
def csv_write(path, rows):
    with Path(path).open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
def fid(n): return f'F{n:03d}'

NAMES = [
    'Rowan Vale', 'Cedric Vale', 'Ada Vale', 'Jasper Vale', 'Alder Vale',
    'Felix Vale', 'Quentin Vale', 'Silas Vale', 'Nora Ash', 'Elspeth Vale',
    'Beatrice Vale', 'Hugo Pike', 'Mira Vale', 'Gareth Vale', 'Ellis Vale',
    'Otis Vale', 'Clara Vale', 'Mira Vale', 'Martin Vale', 'Theo Vale',
    'Dorian Vale', 'Iris Lane', 'Warren Reed', 'Celia Reed', 'Jonah Vale',
    'Hazel Vale', 'Luca Vale', 'Sylvie Vale', 'June Moss', 'Robin Vale',
    'Emmett Vale', 'Wren Vale', 'Bram Ash', 'Vera Birch', 'Edmund Birch',
]
BIRTHS = [1990,1858,1860,1881,1885,1887,1890,1892,1887,1889,1907,1905,1909,1910,1912,1918,None,1932,1934,1936,1940,1945,1890,1892,1962,1965,2001,1935,1967,1991,2011,1976,1938,1915,1912]
# This explicit invented graph has one duplicate raw edge at row 46.
EDGES = [
 (2,3,'spouse',True),(2,4,'parent_child',True),(2,5,'parent_child',True),(2,6,'parent_child',True),(2,7,'parent_child',True),(2,8,'parent_child',True),
 (3,4,'parent_child',True),(3,5,'parent_child',True),(3,6,'parent_child',True),(3,7,'parent_child',True),(3,8,'parent_child',True),
 (5,9,'spouse',True),(5,10,'spouse',False),(5,11,'parent_child',False),(9,11,'parent_child',False),(5,13,'parent_child',False),(10,13,'parent_child',False),
 (5,14,'parent_child',False),(10,14,'parent_child',False),(5,15,'parent_child',False),(10,15,'parent_child',False),(5,16,'parent_child',False),(10,16,'parent_child',False),
 (11,12,'spouse',False),(15,17,'spouse',False),(15,18,'parent_child',False),(17,18,'parent_child',False),(15,19,'parent_child',False),(17,19,'parent_child',False),
 (15,20,'parent_child',False),(17,20,'parent_child',False),(15,21,'parent_child',False),(17,21,'parent_child',False),(15,22,'parent_child',False),(17,22,'parent_child',False),
 (25,1,'parent_child',False),(26,1,'parent_child',False),(25,26,'spouse',False),(19,25,'parent_child',False),(25,27,'parent_child',False),(26,27,'parent_child',False),
 (23,24,'spouse',False),(23,17,'parent_child',False),(24,17,'parent_child',False),(19,28,'spouse',False),(19,25,'parent_child',False),(28,25,'parent_child',False),
 (19,29,'parent_child',False),(28,29,'parent_child',False),(1,30,'spouse',False),(25,31,'parent_child',False),(32,31,'parent_child',False),(25,32,'spouse',False),
 (33,26,'parent_child',False),(34,35,'spouse',True),(34,28,'parent_child',False),(35,28,'parent_child',True),
]
people = []
for n, name in enumerate(NAMES, 1):
    birth = BIRTHS[n-1]
    notes = {
        5: 'Approximate life years. Fictional register records residence in Willowford throughout life.',
        15: 'Recorded in Willowford until about 1936, then Harbourfield about 1936-1980. Exact moving date unknown.',
        17: 'Fictional ledger says 1911; its margin note reports 1909. No original birth certificate is supplied. Leave birth year unresolved.',
        13: 'Distinct from Mira Vale F018. Do not merge matching names.',
        18: 'Distinct from Mira Vale F013. Do not merge matching names.',
        28: 'Birth year reported by prior register; exact date unknown.',
        31: 'Half-sibling of Rowan F001, sharing father F025. Mother is F032. Not a child of Rowan.',
        32: 'Recorded as Jonah F025 partner or spouse; legal marital status unverified.',
        35: 'Parent and spouse links remain probable.',
    }.get(n, 'Fictional supplied prior family record.')
    places = {5:'Willowford, Northmere',15:'Willowford until about 1936; Harbourfield about 1936-1980',17:'Fernbridge (birth); Harbourfield (later residence)',1:'Harbourfield'}.get(n,'unknown')
    people.append({'person_id':fid(n),'full_name':name,'aliases':'Clara Reed' if n==17 else ('Iris Vale; Aunt Iris' if n==22 else ''),'birth':birth or 'unknown','birth_precision':'unknown' if birth is None else ('approximate' if n in [5,24,30,31] else 'year'),'death':1961 if n==5 else (1980 if n==15 else 'unknown'),'death_precision':'approximate' if n==5 else ('year' if n==15 else 'unknown'),'places':places,'source_refs':f'fictional-ledger:{fid(n)}','status':'candidate' if n in [2,3,4,7,9] else 'reported','notes':notes})
csv_write(UPLOAD/'Family_Register.csv',people)
relationships=[]; raw_relationships=[]; reconciliation=[]; seen={}
for n,(a,b,kind,candidate) in enumerate(EDGES,1):
    rid=f'FR{n:03d}'
    row={'relationship_id':rid,'from_person_id':fid(a),'to_person_id':fid(b),'type':kind,'source_refs':f'fictional-ledger:{rid}','status':'candidate' if candidate else 'reported'}
    raw_relationships.append(row)
    key=(a,b,kind)
    if key in seen:
        reconciliation.append({'raw_row':n,'raw_id':rid,'action':'merged_duplicate','retained_id':seen[key]}); continue
    seen[key]=rid;relationships.append(row)
    reconciliation.append({'raw_row':n,'raw_id':rid,'action':'retained','retained_id':rid})
csv_write(UPLOAD/'Family_Relationships.csv',relationships)
csv_write(ROOT/'90-provenance/RAW_RELATIONSHIPS.csv',raw_relationships)
csv_write(ROOT/'90-provenance/relationship-reconciliation.csv',reconciliation)

evidence = {
 'ORIGIN-01': "The fictional family ledger places Alder Vale's birth and lifetime residence in Willowford, Northmere.",
 'TIME-01': 'The fictional family ledger records Alder Vale as born about 1885 and deceased about 1961. Both years are approximate.',
 'MOVEMENT-01': 'The fictional family ledger places Ellis Vale in Willowford until about 1936, then in Harbourfield from about 1936 to 1980. The exact moving date is unknown.',
 'CONFLICT-01': "Clara Vale's fictional ledger birth field gives 1911. Its margin note reports 1909. No original birth certificate is supplied; keep the year unresolved.",
 'KINSHIP-01': 'The fictional relationship ledger identifies Martin Vale as the father of Jonah Vale. Raw rows 39 and 46 repeat the same link; retain FR039 once.',
}
evidence_roots={'ORIGIN-01':'fictional-ledger:F005','TIME-01':'fictional-ledger:F005','MOVEMENT-01':'fictional-ledger:F015','CONFLICT-01':'fictional-ledger:F017','KINSHIP-01':'fictional-ledger:FR039'}
text='Fictional English derivative family evidence\nAll people, places and facts in this packet are invented for engineering tests.\n\n'
for locator,quote in evidence.items():text+=f'[{locator} | evidence root {evidence_roots[locator]}]\n{quote}\n\n'
(UPLOAD/'Family_Recollections.txt').write_text(text)

story='I remember Alder Vale working beside the river. He repaired wooden boats for neighbours. [Transcription gap.] People brought him cracked hulls and loose seats, and he kept working until the boats were ready to use again.'
sources={'fictional-ledger':{'people':people,'relationships':raw_relationships},'fictional-memory:17':{'attribution':'Aunt Iris in the invented source register','locator':'fictional notebook passage 17','text':story}}
save(ROOT/'90-provenance/fictional-originals.json',sources)
original_hash=sha(ROOT/'90-provenance/fictional-originals.json')
chats={
 'Mom':('chat-mom','fictional-ledger:F017',[
  ('Collector','What does the older ledger say about Clara?','editorial prompt'),
  ('Mom role',evidence['CONFLICT-01'],'fictional ledger F017, birth field and margin note'),
  ('Collector','We can leave the year open.','editorial instruction')]),
 'Dad':('chat-dad','fictional-ledger:F015',[
  ('Collector','Which relative moved?','editorial prompt'),
  ('Dad role',evidence['MOVEMENT-01'],'fictional ledger F015, residences'),
  ('Collector','The exact moving date remains unknown.','fictional ledger F015, approximate date')]),
 'Family':('chat-family','fictional-memory:17',[
  ('Collector','The next passage is attributed to Aunt Iris in the invented source register. The original message time is not available.','fictional memory register, passage 17 attribution'),
  ('Aunt Iris (attributed recollection)',story,'fictional notebook passage 17'),
  ('Collector','Please review the person and the recollection before including it in the book.','editorial instruction')]),
}
for role,(sid,root,messages) in chats.items():
    chat='\n'.join(f'{speaker}: {body}' for speaker,body,loc in messages)+'\n'
    metadata={'schemaVersion':'roots-reconstructed-chat-v1','sourceId':sid,'reconstruction':True,'evidenceRootId':root,'originalSourceHash':original_hash,'originalLocator':f'fictional prepared {role.lower()} evidence','attribution':'Roles are reconstructed; facts retain the invented source author. Aunt Iris is the attributed speaker only in the Family recollection.','language':'en','originalMessageTimestamp':None,'timestampSemantics':'No real timestamps or original message metadata exist.','messages':[{'index':i,'evidenceRootId':root,'originalLocator':loc,'attribution':speaker if role=='Family' and i==1 else 'Reconstructed dialogue role','sourceSpan':{'locator':f'_chat.txt:L{i+1}','quote':body}} for i,(speaker,body,loc) in enumerate(messages)]}
    with zipfile.ZipFile(UPLOAD/f'WhatsApp_{role}.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for name,value in [('_chat.txt',chat),('metadata.json',encode(metadata))]:
            info=zipfile.ZipInfo(name,(2000,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;archive.writestr(info,value)

photos=[]
specs=[(5,'Alder_Vale'),(15,'Ellis_and_Clara'),(19,'Martin_Vale'),(25,'Jonah_Vale'),(1,'Rowan_Vale'),(1,'Rowan_and_Jonah')]
for i,(person,slug) in enumerate(specs,1):
    file=f'{i:02d}__{slug}.jpg';asset=f'F-PHOTO-{i:02d}'
    canvas=Image.new('RGB',(720,540),'#f3ede2');draw=ImageDraw.Draw(canvas)
    font=ImageFont.load_default(size=22);small=ImageFont.load_default(size=15)
    draw.rounded_rectangle((30,28,690,512),radius=20,outline='#97a491',width=3)
    draw.text((58,52),'FICTIONAL ARCHIVE CARD',font=small,fill='#56735e')
    draw.text((58,84),slug.replace('_',' '),font=font,fill='#213c2e')
    # Simple trees and a boat are deliberately non-human placeholders.
    for offset in [0,230] if i in [2,6] else [110]:
        x=125+offset; draw.rectangle((x+56,255,x+72,368),fill='#887258')
        draw.ellipse((x,145,x+128,292),fill='#719074');draw.ellipse((x+18,120,x+115,225),fill='#8ca68a')
    draw.line((72,391,648,391),fill='#a7b8bc',width=3)
    draw.polygon([(440,356),(609,356),(587,379),(464,379)],fill='#ad815c')
    draw.text((58,444),'Generated test image. No real person pictured.',font=small,fill='#556356')
    canvas.save(UPLOAD/file,quality=86)
    if i in [2,6]:
        pos=[{'position':1,'personId':None,'label':'Unknown (left symbol)','status':'unresolved'},{'position':2,'personId':None,'label':'Unknown (right symbol)','status':'unresolved'}]
        caption=f'Fictional card labelled {slug.replace("_"," ")}; the supplied label does not assign left-to-right identities. No real people are pictured.'
    else:
        pos=[{'position':1,'personId':fid(person),'label':NAMES[person-1]+' (fictional label)','status':'proposed' if i==4 else 'confirmed'}]
        caption=f'Fictional archive card associated with {NAMES[person-1]} by its supplied label. This is an illustration, not a portrait.'
    photos.append({'assetId':asset,'file':file,'positions':pos,'support':[{'sourceId':'photo-captions','locator':asset,'quote':caption}],'caption':caption,'sha256':sha(UPLOAD/file),'evidenceRootId':f'fictional-photo-label:{i}'})
save(UPLOAD/'Photo_Captions.txt',photos)

overview=[
 "This is a fictional family packet for testing Osmy Roots. Rowan Vale is the imagined presenter. Every name, place, date and memory in these files was invented for the engineering fixture. The images are generated archive cards with trees and boats; they do not depict real people. No private family record, photograph, source hash or file path is included.",
 "The fictional narrative begins with a promise to preserve a family history. Rowan brings earlier records and a few labelled images to assemble a readable book. The central line runs from Alder Vale to Ellis, Martin, Jonah and Rowan. The full register contains 35 distinct people. Two people happen to share the name Mira Vale, but their stable IDs and relationships keep them separate.",
 "The supplied places are Willowford, Northmere, Harbourfield and Fernbridge. They are invented locations. The ledger records a move for Ellis around 1936; the exact day remains unknown. Alder's birth and death years are approximate. Clara has conflicting reported birth years, and the packet contains no independent certificate that would settle the difference. Probable links near the oldest generation remain candidates.",
 "The relationship register contains 56 distinct links. A separate audit file preserves 57 raw rows and identifies one repeated parent-child edge. The ordinary upload files carry the entire intended roster and its relationships. The staged map should release a five-person branch and then six saved batches, reaching all 35 people without loading a hidden family seed.",
 "Three short chat archives use undated reconstructed dialogue. Their Mom, Dad and Family roles are format labels. They preserve invented evidence roots and source locators, so repeated adaptations cannot count as independent corroboration. One personal recollection remains unaccepted until the model interpretation and the presenter's explicit review. The book should include the current reviewed state, keep uncertainty visible and cite the supplied English source passages. This fixture supports engineering and rehearsal; it is not evidence of a real family's history."
]
body=ParagraphStyle('body',fontName='Helvetica',fontSize=10.3,leading=15.4,spaceAfter=12,textColor=HexColor('#334236'))
title=ParagraphStyle('title',fontName='Times-Roman',fontSize=27,leading=31,spaceAfter=17,textColor=HexColor('#284a37'))
content=[Paragraph('Osmy Roots: the Vale family',title),Paragraph('Independent fictional engineering fixture',ParagraphStyle('sub',fontName='Helvetica',fontSize=10,leading=14,spaceAfter=15,textColor=HexColor('#6c826d')))]
content += [Paragraph(html.escape(p),body) for p in overview]
SimpleDocTemplate(str(UPLOAD/'Family_Overview.pdf'),pagesize=(612,792),leftMargin=54,rightMargin=54,topMargin=46,bottomMargin=42,title='Osmy Roots fictional family overview',author='Osmy Roots test fixture',invariant=1).build(content)

def support(locator):return [{'sourceId':'family-recollections','locator':locator,'quote':evidence[locator]}]
questions=[
 {'id':'Q1','category':'photo','prompt':'Whose labelled archive card is this?','recommendation':'Alder Vale, associated by the supplied fictional label.','support':photos[0]['support'],'personIds':['F005'],'effect':{'kind':'annotation','photoAssetId':'F-PHOTO-01'},'requiresAstra':False},
 {'id':'Q2','category':'kinship','prompt':'How is Martin related to Jonah?','recommendation':'Martin Vale is Jonah Vale\'s father, according to the supplied relationship ledger.','support':support('KINSHIP-01'),'personIds':['F019','F025'],'effect':{'kind':'relationship','relationshipId':'FR039'},'requiresAstra':False},
 {'id':'Q3','category':'origin','prompt':'Where does the ledger place Alder?','recommendation':'Willowford, Northmere, as reported by the fictional ledger.','support':support('ORIGIN-01'),'personIds':['F005'],'effect':{'kind':'claim','personId':'F005','predicate':'origin'},'requiresAstra':False},
 {'id':'Q4','category':'time','prompt':'How should Alder\'s life years appear?','recommendation':'About 1885 to about 1961; keep both years approximate.','support':support('TIME-01'),'personIds':['F005'],'effect':{'kind':'claim','personId':'F005','predicate':'life_period'},'requiresAstra':False},
 {'id':'Q5','category':'movement','prompt':'Who moved to Harbourfield?','recommendation':'Ellis Vale moved from Willowford around 1936; the exact moving date is unknown.','support':support('MOVEMENT-01'),'personIds':['F015'],'effect':{'kind':'claim','personId':'F015','predicate':'movement'},'requiresAstra':False},
 {'id':'Q6','category':'recollection','prompt':'Whose recollection belongs with Alder?','recommendation':'Keep Aunt Iris\'s attributed memory of Alder repairing wooden boats, preserving its gaps and attribution.','support':[{'sourceId':'chat-family','locator':'_chat.txt:L2','quote':story}],'personIds':['F005'],'effect':{'kind':'story','personId':'F005'},'requiresAstra':True},
 {'id':'Q7','category':'conflict','prompt':'Can we settle Clara\'s birth year?','recommendation':'Keep 1909 and 1911 as conflicting reports. Leave the birth year unresolved.','support':support('CONFLICT-01'),'personIds':['F017'],'effect':{'kind':'editorial','personId':'F017','predicate':'birth_conflict'},'requiresAstra':False},
]
initial=['F005','F015','F019','F025','F001']
groups=[['F010','F017','F028','F026','F030'],['F009','F011','F012','F013','F014'],['F016','F018','F020','F021','F022'],['F023','F024','F027','F032','F031'],['F002','F003','F004','F006','F007'],['F008','F029','F033','F034','F035']]
available=set(initial);batches=[];assigned=set()
for row in relationships:
    if row['from_person_id'] in available and row['to_person_id'] in available:assigned.add(row['relationship_id'])
initial_links=sorted(assigned)
for n,(group,offset) in enumerate(zip(groups,[44,53,62,71,80,89]),1):
    available.update(group)
    links=[r['relationship_id'] for r in relationships if r['relationship_id'] not in assigned and r['from_person_id'] in available and r['to_person_id'] in available]
    assigned.update(links)
    batches.append({'id':f'batch-{n}','personIds':group,'relationshipIds':links,'dependencyIds':['initial' if n==1 else f'batch-{n-1}'],'releaseOffsetSeconds':offset})
assert len(available)==35 and len(assigned)==56

script='''# Fictional 120-second presenter cues

This is an independently fictional rehearsal aid. Do not claim the story is a real family memory. Opening and dedication use the stage clock; application time starts on Submit.

Before Submit: "I brought an earlier family register, labelled images and prepared English family evidence into Osmy Roots."

0-8 seconds: Submit once. "The sources are being parsed. The request status shows whether the model is working."

8-35 seconds: Read the evidence and explicitly answer seven checks: 1 Alder label; 2 Martin is Jonah's father; 3 Willowford; 4 approximate years; 5 Ellis moved; 6 Aunt Iris's attributed boat-repair memory; 7 unresolved 1909/1911. Use I don't know if the displayed evidence differs. Never confirm automatically to meet the clock.

35 seconds: "This first branch comes from supplied records." Inspect the saved five-person branch.

44/53/62/71/80/89 seconds: Six real saved batches reach 10/15/20/25/30/35 people. Pan and inspect the labelled cards. Same-name people remain distinct. "These are records assembled into this session. The open dates and probable links stay visible."

90-108 seconds: Open the current book preview. "The reviewed recollection now has a cited passage in this version." Say this only after actual Astra interpretation, explicit confirmation and current-book preparation succeed.

108-115 seconds: Click Download family book; measure actual file receipt separately. The normal Submit-to-click ceiling is 120 seconds, target receipt by 120 too.

After Download: "This is something we can read, correct and keep together."

If the real request stalls: "The request is still running." Keep its status visible. A prepared fixture may illustrate the UI but does not satisfy a live Astra or two-browser-rehearsal gate.
'''
(ROOT/'80-presenter/SCRIPT_120_SECONDS.md').write_text(script)
answer_lines=['# Seven answers for the fictional fixture','','These recommendations are presenter-only; never pass this file or the manifest to the model.']
for q in questions:
    answer_lines += ['',f"{q['id']}. {q['prompt']}",q['recommendation'],f"Source: {q['support'][0]['sourceId']} / {q['support'][0]['locator']}.",f"Accepted effect: {q['effect']['kind']} for {', '.join(q['personIds'])}; retain evidence status and attribution.","I don't know: save an explicit unknown review; do not add certainty or accept the recollection."]
(ROOT/'80-presenter/SEVEN_ANSWERS.md').write_text('\n'.join(answer_lines)+'\n')
(ROOT/'02-background/saved-family-folder/Family_Origin.txt').write_text('[Repeated saved English copy; evidence root fictional-ledger:F005]\n'+evidence['ORIGIN-01']+'\n')
(ROOT/'02-background/saved-family-correspondence/Moving_to_Harbourfield.txt').write_text('[Prepared correspondence copy, not a mailbox scan; evidence root fictional-ledger:F015]\n'+evidence['MOVEMENT-01']+'\n')
files=[]
for file in sorted(UPLOAD.iterdir()):
    sid={'Family_Register.csv':'family-register','Family_Relationships.csv':'family-relationships','Family_Recollections.txt':'family-recollections','Photo_Captions.txt':'photo-captions','Family_Overview.pdf':'family-overview','WhatsApp_Mom.zip':'chat-mom','WhatsApp_Dad.zip':'chat-dad','WhatsApp_Family.zip':'chat-family'}.get(file.name)
    er={'chat-mom':['fictional-ledger:F017'],'chat-dad':['fictional-ledger:F015'],'chat-family':['fictional-memory:17'],'family-recollections':list(dict.fromkeys(evidence_roots.values()))}.get(sid,['fictional-ledger'] if sid else [f'fictional-photo-label:{next(i for i,p in enumerate(photos,1) if p["file"]==file.name)}'])
    files.append({'path':'01-upload/'+file.name,'sha256':sha(file),'bytes':file.stat().st_size,'sourceIds':[sid] if sid else [],'evidenceRootIds':er,'lineage':[{'originalHash':original_hash,'originalLocator':'Invented English source records, not private evidence','derivativeHash':sha(file),'language':'en'}] if sid else []})
for relative,sid,root_id in [('02-background/saved-family-folder/Family_Origin.txt','saved-origin','fictional-ledger:F005'),('02-background/saved-family-correspondence/Moving_to_Harbourfield.txt','saved-movement','fictional-ledger:F015')]:
    file=ROOT/relative
    files.append({'path':relative,'sha256':sha(file),'bytes':file.stat().st_size,'sourceIds':[sid],'evidenceRootIds':[root_id],'lineage':[{'originalHash':original_hash,'originalLocator':'Repeated copy of initially supplied fictional ledger evidence','derivativeHash':sha(file),'language':'en'}]})
manifest={'schemaVersion':'roots-demo-v2','packetVersion':'fictional-v2.3','script':{'title':'Fictional Vale family rehearsal','version':'1','sha256':sha(ROOT/'80-presenter/SCRIPT_120_SECONDS.md')},'selectedPersonIds':[p['person_id'] for p in people],'expectedRelationshipCount':56,'files':files,'photos':[{k:p[k] for k in ['assetId','file','positions','support']} for p in photos],'questions':questions,'initialBranchIds':initial,'initialReleaseOffsetSeconds':35,'batches':batches,'sourceJobs':[{'id':'saved-folder','kind':'saved_folder','filePaths':['02-background/saved-family-folder/Family_Origin.txt'],'evidenceRootIds':['fictional-ledger:F005'],'releaseOffsetSeconds':53},{'id':'saved-correspondence','kind':'saved_correspondence','filePaths':['02-background/saved-family-correspondence/Moving_to_Harbourfield.txt'],'evidenceRootIds':['fictional-ledger:F015'],'releaseOffsetSeconds':71}],'requiredBookSections':['Dedication','Main family branch','Full family register','Reviewed recollection','Photographs','Sources and open questions']}
save(ROOT/'DEMO_MANIFEST.json',manifest)
expected={'fictional':True,'people':35,'relationships':56,'rawRelationships':57,'duplicate':{'rawId':'FR046','retainedId':'FR039'},'initialPeople':initial,'initialRelationships':initial_links,'batchTotals':[10,15,20,25,30,35],'batchOffsetsSeconds':[44,53,62,71,80,89],'photos':6,'unacceptedStory':'fictional-memory:17','sameNameIds':['F013','F018'],'unknownBirthYearId':'F017','requiredCategories':[q['category'] for q in questions],'sourceStatus':'supplied prior records; reconstructed chats; generated non-family images','packetHash':hashlib.sha256(encode(manifest).encode()).hexdigest()}
save(ROOT/'80-presenter/EXPECTED_OUTCOME.json',expected)
narrative=[]
for q,offset in zip(questions,[8,12,16,20,24,28,32]):narrative.append({'beat':q['id'],'app_seconds':offset,'source':q['support'][0]['sourceId'],'locator':q['support'][0]['locator'],'person':';'.join(q['personIds']),'photo':q['effect'].get('photoAssetId',''),'batch':'','saved_change':q['effect']['kind'],'book_section':'Reviewed recollection' if q['category']=='recollection' else 'Sources and open questions'})
for batch in batches:narrative.append({'beat':batch['id'],'app_seconds':batch['releaseOffsetSeconds'],'source':'family-register;family-relationships','locator':'CSV rows for released IDs','person':';'.join(batch['personIds']),'photo':'','batch':batch['id'],'saved_change':'Commit supported eligible records only','book_section':'Full family register'})
csv_write(ROOT/'80-presenter/NARRATIVE_MAP.csv',narrative)
(ROOT/'00-START-HERE.md').write_text('''# Fictional ordinary-file packet

All content is invented. Images are code-generated non-family placeholders. Use seed name Rowan Vale, geography Willowford and Harbourfield, language English.

Select all 14 files directly inside 01-upload. The folder includes two CSV registers, one PDF, two text sources, three chat ZIPs and six JPEG illustrations. Do not upload the manifest, presenter answers, audit files or expected outputs. No JSON seed is required.

The 35-person roster and 56-link shape are supported by initial files. The audit keeps 57 raw edges with one duplicate. Seven source checks and six dependency-safe arrivals use the shared round-2 contract. The boat-repair recollection is initially unaccepted and appears canonically in WhatsApp_Family.zip.

The partial-card identity and both group-card orders deliberately remain proposed or unknown. Two different people share the name Mira Vale. Dates and candidate relationships stay unresolved where indicated.

The packet can validate parsers and UI shapes. It does not satisfy the private-content acceptance gate or prove a live Astra result. Run production parsing and canonical Zod validation before using it.
''')
assert len(list(UPLOAD.iterdir()))==14
assert sum(p.stat().st_size for p in UPLOAD.iterdir())<20_000_000

subprocess.run(['node','--import','tsx',str(Path(__file__).with_name('finalize.mjs').resolve()),str(ROOT.resolve())],cwd=Path(__file__).resolve().parents[3],check=True)
