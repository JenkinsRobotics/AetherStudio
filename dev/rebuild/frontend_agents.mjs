import assert from 'node:assert/strict';
import {join} from 'node:path';

// Native server launches a fixture-only provider. No external sign-in link is
// opened and no real provider credentials or paid inference are used.
export async function verifyBrowserAgents(page, origin, evidence) {
  await page.goto(`${origin}/?pluginApp=map`);
  await page.getByRole('button',{name:'Manage Studio installation',exact:true}).click();
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'ChatGPT',exact:true})});
  for (const name of ['Claude','Google Gemini']) {
    const provider=page.getByRole('article',{name:`${name} plugin`,exact:true});
    await provider.getByRole('button',{name:'Install',exact:true}).click();
    await provider.getByRole('button',{name:'Disable',exact:true}).waitFor();
  }
  await card.getByRole('button',{name:'Install',exact:true}).click();
  await card.getByRole('button',{name:'Disable',exact:true}).waitFor();
  await page.getByRole('button',{name:'My connections',exact:true}).click();
  await card.getByRole('button',{name:'Sign in with ChatGPT',exact:true}).click();
  await card.getByRole('textbox',{name:'Sign-in callback URL'}).fill('fixture-browser');
  await card.getByRole('button',{name:'Complete sign-in',exact:true}).click();
  await card.getByRole('button',{name:'Disconnect',exact:true}).waitFor();
  await card.getByText('fixture-browser',{exact:true}).waitFor();
  const output=await page.evaluate(async()=>{
    const call=async(action,data)=>{
      const response=await fetch(`/api/agent/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      if(!response.ok)throw new Error(`Agent ${action}: ${response.status}`);
      return response.json();
    };
    const wait=async job=>{
      for(let i=0;i<100;i++){
        const value=await call('job',{id:job.id});
        if(value.state!=='running')return value;
        await new Promise(r=>setTimeout(r,30));
      }
      throw new Error('Fixture provider did not finish');
    };
    const models=await wait(await call('models',{provider:'chatgpt'}));
    const chat=await wait(await call('chat',{provider:'chatgpt',app:'map',model:models.models[0].id,messages:[{role:'user',content:'hello'}]}));
    return {models,chat};
  });
  assert.equal(output.models.state,'completed');
  assert.equal(output.chat.state,'completed');
  assert.equal(output.chat.text,'Hello fixture-browser');
  if(evidence)await page.screenshot({path:join(evidence,'native-agent-connected.png')});
  await card.getByRole('button',{name:'Disconnect',exact:true}).click();
  await card.getByText('Not signed in',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Manage Studio installation',exact:true}).click();
  await card.getByRole('button',{name:'Disable',exact:true}).click();
  await card.getByRole('button',{name:'Enable',exact:true}).waitFor();
  const providerResults=[];
  for (const [id,name,signIn] of [['claude','Claude','Sign in with Claude'],['gemini','Google Gemini','Sign in with Google']]) {
    await page.getByRole('button',{name:'My connections',exact:true}).click();
    const provider=page.getByRole('article',{name:`${name} plugin`,exact:true});
    await provider.getByRole('button',{name:signIn,exact:true}).click();
    await provider.getByRole('button',{name:'Disconnect',exact:true}).waitFor();
    const response=await page.evaluate(async provider=>{
      const call=async(action,data)=>{
        const r=await fetch(`/api/agent/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        if (!r.ok) throw new Error(`Provider fixture ${action}: ${r.status}`);
        return r.json();
      };
      const wait=async job=>{
        for(let i=0;i<100;i++){
          const result=await call('job',{id:job.id});
          if(result.state!=='running')return result;
          await new Promise(resolve=>setTimeout(resolve,30));
        }
        throw new Error('Provider fixture timeout');
      };
      const models=await wait(await call('models',{provider}));
      const chat=await wait(await call('chat',{provider,app:'map',model:'',messages:[{role:'user',content:'hello'}]}));
      return {models:models.state,chat:chat.state,text:chat.text};
    },id);
    assert.equal(response.models,'completed');assert.equal(response.chat,'completed');
    assert.ok(response.text.includes('fixture response'));
    await provider.getByRole('button',{name:'Disconnect',exact:true}).click();
    await provider.getByText('Not signed in',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Manage Studio installation',exact:true}).click();
    await provider.getByRole('button',{name:'Disable',exact:true}).click();
    await provider.getByRole('button',{name:'Enable',exact:true}).waitFor();
    providerResults.push({id,fixtureSignIn:true,models:true,chat:true,disconnect:true,disable:true});
  }
  return {nativeCatalog:true,configuredProviders:3,pluginInstall:true,fixtureSignIn:true,modelSelection:true,fixtureChat:true,disconnect:true,disable:true,providerResults,externalProviderUsed:false};
}


export async function verifyBrowserAutomation(page, origin, evidence) {
  await page.goto(`${origin}/?section=plugins`);
  const section=page.locator('section.agent-connections');
  await section.getByRole('heading',{name:'Agent access',exact:true}).waitFor();
  await section.getByRole('checkbox',{name:'Aether Map',exact:true}).waitFor();
  assert.equal(await section.getByRole('option',{name:'Edit saved documents',exact:true}).count(),1);
  await section.getByRole('textbox',{name:'Connection name',exact:true}).fill('Native browser assistant');
  await section.getByRole('combobox',{name:'Access',exact:true}).selectOption('content');
  await section.getByRole('checkbox',{name:'Aether Map',exact:true}).check();
  await section.getByRole('button',{name:'Create connection',exact:true}).click();
  const key=section.getByRole('textbox',{name:'Connection key',exact:true});
  await key.waitFor();
  // Never copy the credential into evidence or browser reports.
  assert.equal(await key.evaluate(el=>/^aether_agent_[a-f0-9]{64}$/.test(el.value)),true);
  const credential=await key.inputValue();
  const catalog=()=>page.evaluate(async credential=>{
    const response=await fetch('/api/automation/commands/list',{method:'POST',credentials:'omit',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},body:'{}'});
    return {status:response.status,commands:response.ok?(await response.json()).commands:[]};
  },credential);
  const enabled=await catalog();assert.equal(enabled.status,200);
  assert.ok(enabled.commands.some(command=>command.id.startsWith('map.') && command.writes));
  assert.ok(!enabled.commands.some(command=>command.id.startsWith('cad.')),'Map grant does not expose CAD commands');
  await section.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal(await key.count(),0);
  await page.reload();
  const connection=section.locator('article').filter({hasText:'Native browser assistant'});
  await connection.getByRole('button',{name:'Revoke',exact:true}).waitFor();
  assert.equal(await key.count(),0);
  await connection.getByRole('button',{name:'Revoke',exact:true}).click();
  await connection.getByText('Inactive',{exact:true}).waitFor();
  assert.equal((await catalog()).status,401);
  assert.equal(await connection.getByRole('button',{name:'Revoke',exact:true}).isDisabled(),true);
  await page.reload();
  await connection.getByText('Inactive',{exact:true}).waitFor();
  if(evidence)await page.screenshot({path:join(evidence,'native-automation-revoked.png')});
  return {create:true,oneTimeKey:true,persistedGrant:true,revoke:true,persistedRevocation:true,productEditingCatalog:true,appScope:true,revokedUseDenied:true};
}
