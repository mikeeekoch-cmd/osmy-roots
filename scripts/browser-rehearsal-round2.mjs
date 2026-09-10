/** Actual browser acceptance. Evidence/output stays in the ignored local data directory. */
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {DemoManifestSchema} from '../packages/contracts/round2.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.ROOTS_APP_URL||'http://127.0.0.1:3200';
if(!process.env.ROOTS_PACKET_DIR)throw Error('Set ROOTS_PACKET_DIR to the frozen private or fictional packet.');
const packet=resolve(process.env.ROOTS_PACKET_DIR);
const manifestBytes=await readFile(join(packet,'DEMO_MANIFEST.json'));
const manifest=DemoManifestSchema.parse(JSON.parse(manifestBytes));
const fileHash=createHash('sha256').update(manifestBytes).digest('hex');
const packetHash=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const seedName=process.env.ROOTS_REHEARSAL_NAME;
if(!seedName)throw Error('Set ROOTS_REHEARSAL_NAME to the supplied starting person.');
const directory=resolve(process.env.ROOTS_REHEARSAL_OUTPUT||'.roots-data/rehearsals');
await mkdir(directory,{recursive:true,mode:0o700});
const runLabel=process.env.ROOTS_REHEARSAL_LABEL||new Date().toISOString().replace(/[:.]/g,'-');
const files=manifest.files.filter(f=>f.path.startsWith('01-upload/'));
for(const f of files){const b=await readFile(join(packet,f.path));if(b.length!==f.bytes||createHash('sha256').update(b).digest('hex')!==f.sha256)throw Error('Frozen upload inventory changed.');}
const browser=await chromium.launch({headless:process.env.ROOTS_HEADFUL!=='1',...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
const page=await context.newPage();
const log={runLabel,manifestFileHash:fileHash,packetHash,submitAt:null,questionCompletionAt:null,batches:[],bookReadyAt:null,downloadClickAt:null,receiptAt:null,projectId:null,requests:[],errors:[],snapshots:[],pass:false};
let latest=null;
const seenBatches=new Set();
page.on('pageerror',e=>log.errors.push({kind:'page',message:e.message}));
page.on('request',request=>{if(request.url().includes('/api/projects'))log.requests.push({at:new Date().toISOString(),method:request.method(),path:new URL(request.url()).pathname});});
page.on('response',async response=>{
  if(!response.url().includes('/api/projects')||!response.headers()['content-type']?.includes('application/json'))return;
  try{
    const s=await response.json();
    if(!s.projectId)return;
    latest=s;log.projectId=s.projectId;
    if(s.run?.initialSavedAt&&!log.initialSavedAt)log.initialSavedAt=s.run.initialSavedAt;
    log.snapshots.push({at:new Date().toISOString(),version:s.version,people:s.people.length,relationships:s.relationships.length,phase:s.run?.phase,book:s.run?.book.status,answers:s.run?.answers.length});
    if(s.run?.answers.length===7&&!log.questionCompletionAt)log.questionCompletionAt=new Date().toISOString();
    for(const b of s.run?.batches||[])if(b.status==='saved'&&!seenBatches.has(b.id)){seenBatches.add(b.id);log.batches.push({id:b.id,savedAt:b.savedAt,observedAt:new Date().toISOString()});}
    if(s.run?.book.status==='ready'&&!log.bookReadyAt)log.bookReadyAt=new Date().toISOString();
  }catch{}
});
const waitFor=async(fn,timeout=150000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('Timed out waiting for saved application state.');await new Promise(r=>setTimeout(r,100));}};
try{
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByLabel(/Starting person or family name|Your full name/).fill(seedName);
  if(process.env.ROOTS_REHEARSAL_GEOGRAPHY)await page.getByLabel('Family geography',{exact:true}).fill(process.env.ROOTS_REHEARSAL_GEOGRAPHY);
  else await page.getByLabel('I do not know the family location',{exact:true}).check();
  await page.locator('input[type=file]').first().setInputFiles(files.map(f=>join(packet,f.path)));
  await page.screenshot({path:join(directory,`${runLabel}-intake.png`),fullPage:true});
  if(log.requests.length)throw Error('The fresh intake started work before Submit.');
  log.submitAt=new Date().toISOString();
  await page.getByRole('button',{name:/Start the search|Start searching|Start research/}).click();
  await waitFor(()=>latest?.run,20000);
  if(latest.run.packetHash!==packetHash)throw Error('Runtime packet fingerprint differs from the frozen manifest.');
  for(let index=0;index<7;index++){
    const due=Date.parse(log.submitAt)+8000+index*3500;
    await new Promise(r=>setTimeout(r,Math.max(0,due-Date.now())));
    await page.getByText(`${index+1} of 7`,{exact:true}).waitFor({timeout:20000});
    const button=index===6?page.getByRole('button',{name:"I don't know",exact:true}):page.getByRole('button',{name:'Confirm and continue',exact:true});
    await button.waitFor({state:'visible',timeout:20000});
    await button.click({timeout:20000});
    await waitFor(()=>latest?.run?.answers.length>=index+1,10000);
  }
  await waitFor(()=>latest?.people.length>=5,20000);
  await page.screenshot({path:join(directory,`${runLabel}-initial-branch.png`),fullPage:true});
  if(process.env.ROOTS_REHEARSAL_REFRESH==='1'){
    const id=latest.projectId;await page.reload({waitUntil:'domcontentloaded'});await waitFor(()=>latest?.projectId===id&&latest?.people.length>=5,15000);
  }
  // Inspect a real person card during saved arrivals. This does not mutate state.
  const pairPerson=latest.photoPairs?.flatMap(pair=>pair.personIds).map(id=>latest.people.find(person=>person.id===id)).find(Boolean);
  const cards=page.locator('.person-node');
  if(await cards.count()){
    const card=pairPerson?cards.filter({hasText:pairPerson.displayNameEn}).first():cards.first();
    await card.click();await page.waitForTimeout(350);
    await page.screenshot({path:join(directory,`${runLabel}-person.png`),fullPage:true});
    const compare=page.getByRole('button',{name:'Compare photos',exact:true}).first();
    if(await compare.count()){
      await compare.click();await page.locator('.photo-comparison').waitFor();
      await page.screenshot({path:join(directory,`${runLabel}-photo-comparison.png`),fullPage:true});
      log.photoComparison={mode:await page.locator('.comparison-side-by-side').count()?'side_by_side':'aligned',at:new Date().toISOString()};
      await page.getByRole('button',{name:'Close photograph',exact:true}).click();
    }else if(latest.photoPairs?.length)throw Error('The supplied photo comparison was not reachable from its person card.');
    else {
      const original=page.locator('.photo-open').first();
      if(await original.count()){
        await original.click();await page.getByRole('dialog',{name:'Original photograph',exact:true}).waitFor();
        await page.screenshot({path:join(directory,`${runLabel}-original-photo.png`),fullPage:true});
        await page.getByRole('button',{name:'Close photograph',exact:true}).click();
      }
    }
    await page.keyboard.press('Escape');
  }
  await waitFor(()=>latest?.run?.book.status==='ready'&&latest.people.length===manifest.selectedPersonIds.length,120000);
  await page.screenshot({path:join(directory,`${runLabel}-book-ready.png`),fullPage:true});
  const previewResponse=page.waitForResponse(response=>response.url().includes('/book/preview')&&response.status()===200,{timeout:10000});
  await page.getByRole('button',{name:'Preview current PDF',exact:true}).click();
  const pdf=await previewResponse;
  // Chrome's native PDF viewer can expose a synthetic document body to CDP.
  // Verify the same preview URL through this browser context's request client.
  const pdfBytes=await context.request.get(pdf.url());
  if(!pdfBytes.ok()||!(await pdfBytes.body()).subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('The book preview is not an actual PDF.');
  await page.waitForTimeout(750);
  await page.screenshot({path:join(directory,`${runLabel}-pdf-preview.png`),fullPage:true});
  await page.getByRole('button',{name:'Close book preview',exact:true}).click();
  const text=await page.locator('body').innerText();
  if(/[\u0400-\u04ff]/u.test(text))throw Error('Cyrillic text was rendered in the English demo.');
  if(/\b(countdown|seconds remaining|120.second demo|time remaining|elapsed session)\b/i.test(text))throw Error('Internal timing leaked into product UI.');
  if(latest.relationships.length!==manifest.expectedRelationshipCount)throw Error('Final relationship coverage mismatch.');
  if(manifest.photos.some(photo=>!latest.photoAnnotations?.some(saved=>saved.assetId===photo.assetId)))throw Error('A supplied photo caption is missing from the saved family.');
  if(latest.run.modelStatus!=='completed'||latest.run.analysis?.model!=='gpt-6-astra'||!latest.stories.some(s=>s.status==='accepted'&&s.evidenceType==='family_recollection')||!latest.bookPassages.some(p=>p.origin==='live'&&p.model==='gpt-6-astra'))throw Error('A live reviewed Astra recollection or passage is missing.');
  log.models={analysis:latest.run.analysis.model,passage:latest.bookPassages.map(p=>p.model)};
  if(log.batches.length!==6||Date.parse(log.batches[5].savedAt)-Date.parse(log.batches[0].savedAt)<45000)throw Error('Six distinct saved batches did not span 45 seconds.');
  const downloadPromise=page.waitForEvent('download',{timeout:30000});
  log.downloadClickAt=new Date().toISOString();
  await page.getByRole('button',{name:'Download family book',exact:false}).first().click();
  const download=await downloadPromise;
  await download.saveAs(join(directory,`${runLabel}.zip`));
  if(await download.failure())throw Error('Browser download failed.');
  log.receiptAt=new Date().toISOString();
  log.clickMs=Date.parse(log.downloadClickAt)-Date.parse(log.submitAt);
  log.receiptMs=Date.parse(log.receiptAt)-Date.parse(log.submitAt);
  await waitFor(()=>latest?.run?.phase==='completed',10000);
  await writeFile(join(directory,`${runLabel}-project.json`),JSON.stringify(latest,null,2),{mode:0o600});
  log.pass=log.clickMs<=120000&&log.receiptMs<=120000&&log.errors.length===0;
  if(!log.pass)throw Error('Browser rehearsal exceeded timing or reported a page error.');
  console.log(JSON.stringify({runLabel,pass:log.pass,clickMs:log.clickMs,receiptMs:log.receiptMs,people:latest.people.length,relationships:latest.relationships.length,batches:log.batches.length}));
}catch(e){log.errors.push({kind:'rehearsal',message:e.message});await page.screenshot({path:join(directory,`${runLabel}-failure.png`),fullPage:true}).catch(()=>{});console.error('Rehearsal failed:',e.message);process.exitCode=1;}
finally{await writeFile(join(directory,`${runLabel}-timing.json`),JSON.stringify(log,null,2),{mode:0o600});await context.close();await browser.close();}
