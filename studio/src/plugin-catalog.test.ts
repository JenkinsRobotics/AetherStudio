import { expect, test } from 'vitest';
import type { AgentPlugin } from '@aether/session/agent';
import { filterPlugins, pluginStatus, pluginControls } from './plugin-catalog';
const plugin = (changes: Partial<AgentPlugin> = {}) => ({ id:'test', name:'Test', publisher:'Aether', description:'Advisor', installed:false, enabled:false, runtimeReady:false, account:{}, capabilities:{chat:true,imageGeneration:false,videoGeneration:false}, ...changes } as AgentPlugin);
test('installed and connected filters distinguish global installation from personal login', () => {
 const available=plugin(), installed=plugin({id:'installed',installed:true}), connected=plugin({id:'connected',installed:true,account:{connected:true}});
 const catalog=[available,installed,connected];
 expect(filterPlugins(catalog,'installed','')).toEqual([installed,connected]);
 expect(filterPlugins(catalog,'connected','')).toEqual([connected]);
 expect(filterPlugins(catalog,'all',' AETHER ')).toHaveLength(3);
 expect(filterPlugins(catalog,'all','missing')).toEqual([]);
});
test('status distinguishes missing installation, repair and disabled policies', () => {
 expect(pluginStatus(plugin())).toBe('Not installed');
 expect(pluginStatus(plugin({installed:true}))).toBe('Needs repair');
 expect(pluginStatus(plugin({installed:true,runtimeReady:true}))).toBe('Disabled');
 expect(pluginStatus(plugin({installed:true,runtimeReady:true,enabled:true}))).toBe('Enabled');
});

test('admins can prepare providers from personal view without asking another admin', () => {
 expect(pluginControls(plugin(), false, true)).toMatchObject({install:true,askAdmin:false,login:false});
 expect(pluginControls(plugin(), false, false)).toMatchObject({install:false,askAdmin:true});
 const installed=plugin({installed:true,runtimeReady:true});
 expect(pluginControls(installed,false,true)).toMatchObject({enable:true,login:false});
 expect(pluginControls({...installed,enabled:true},false,true)).toMatchObject({enable:false,login:true});
 expect(pluginControls({...installed,enabled:true},true,true).login).toBe(false);
});
