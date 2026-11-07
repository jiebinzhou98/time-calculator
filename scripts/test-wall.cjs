/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node scripts/test-wall.cjs. No browser or network required.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const cache = new Map()
function load(file) {
  file = path.resolve(__dirname, '..', 'lib', file + '.ts')
  if (cache.has(file)) return cache.get(file)
  const loadedModule = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  new Function('exports','require',code)(loadedModule.exports, name=>load(name.replace('./','')))
  cache.set(file,loadedModule.exports)
  return loadedModule.exports
}
const {DEFAULT_DAMAGE} = load('damage')
const {DEFAULT_WALL, buildWallScenario, runWall, wallDamageLimit} = load('wall')
const damage = {...DEFAULT_DAMAGE,defenseOn:false,enemyIncludesPerk:false}
const settings = {...DEFAULT_WALL,health:'100',healthUnit:'',regen:'0',regenUnit:'',
  repeat:false,count:'1',thorns:'100',wallThorns:'100',horizon:'30',heat:false}
const build=(s={},d={})=>{
  const r=buildWallScenario({...settings,...s},{...damage,...d})
  assert.deepEqual(r.errors,[])
  return r.scenario
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} differs from ${b}`)
let s=build()
assert.equal(s.hits.length,1)
assert.equal(s.firstCohortDeath,1)
assert.equal(runWall(s,100).brokenAt,1) // lethal even if Thorns kill on that hit
assert.equal(runWall(s,99).brokenAt,null)
near(wallDamageLimit(s),100)
s=build({thorns:'110',wallThorns:'13'})
near(s.thornPercent,14.3)
assert.equal(s.firstCohortHits,7)
near(wallDamageLimit(s),100/7)
assert.equal(build({thorns:'110',wallThorns:'13',enemyType:'boss'}).firstCohortHits,14)
assert.equal(build({thorns:'110',wallThorns:'13',protected:true}).firstCohortHits,18)
s=build({thorns:'110',wallThorns:'13',heat:true})
near(s.hits[1].weight,1.04)
near(s.hits.reduce((sum,e)=>sum+e.weight,0),(1.04**7-1)/.04)
assert.ok(wallDamageLimit(s)<100/7)
assert.equal(build({orbOn:true,orbDelay:'.5'}).hits.length,0)
assert.equal(build({orbOn:true,orbDelay:'1'}).hits.length,1)
assert.equal(build({orbOn:true,orbDelay:'0',protected:true,wallThorns:'13'}).firstCohortHits,20)
assert.equal(build({enemyType:'elite',orbOn:true,orbDelay:'0',wallThorns:'13'}).firstCohortHits,8)
s=build({thorns:'0',bhOn:true,bhDamage:'2',bhDuration:'50',bhCooldown:'50',enemyRemaining:'5'})
assert.equal(s.firstCohortDeath,3)
assert.equal(s.firstCohortHits,3)
assert.equal(build({enemyType:'boss',thorns:'0',bhOn:true,bhDuration:'50',bhCooldown:'50'}).firstCohortDeath,null)
s=build({thorns:'0',horizon:'4',bhOn:true,bhDuration:'2',bhCooldown:'4'}, {pcolOn:true})
near(s.hits[0].weight,.1); near(s.hits[1].weight,1); near(s.hits[3].weight,.1)
near(build({bhOn:false},{pcolOn:true}).hits[0].weight,1)
near(build({enemyType:'elite',bhOn:true},{pcolOn:true}).hits[0].weight,1)
near(build({}, {perkOn:true,perkLevel:'10',enemyIncludesPerk:false}).hits[0].weight,.45)
near(build({}, {perkOn:true,perkLevel:'10',enemyIncludesPerk:true}).hits[0].weight,1)
s=build({thorns:'110',wallThorns:'13',repeat:true,arrivalInterval:'2',count:'10',horizon:'20'})
assert.ok(s.peakEnemies>10)
assert.equal(s.totalSpawned,100)
const manual={...build(),regen:50,horizon:2,hits:[{time:.5,weight:1,hits:1},{time:1,weight:1,hits:1}]}
assert.equal(runWall(manual,60).brokenAt,null) // healing continues between closely spaced hits
assert.equal(runWall({...manual,hits:[{time:1,weight:2,hits:2}]},60).brokenAt,1)
assert.equal(runWall({...manual,regen:1000,hits:[{time:1,weight:1,hits:1}]},101).brokenAt,1)
near(build({regen:'5',wallRegen:'200',regenMode:'tower'}).regen,10)
near(build({regen:'5',wallRegen:'200',regenMode:'wall'}).regen,5)
assert.equal(runWall({...manual,regen:0,startHealth:25},30).brokenAt,.5)
assert.ok(buildWallScenario({...settings,health:'-1'},damage).errors.length)
assert.ok(buildWallScenario({...settings,bhOn:true,bhDuration:'51',bhCooldown:'50'},damage).errors.length)
assert.ok(buildWallScenario({...settings,count:'2.5'},damage).errors.length)
assert.ok(buildWallScenario({...settings,attackInterval:'0'},damage).errors.length)
for(const variant of [{},{heat:true},{regen:'5',repeat:true},{enemyType:'boss'},{bhOn:true,bhDamage:'2'}]) {
  const scenario=build(variant), boundary=wallDamageLimit(scenario)
  assert.equal(runWall(scenario,boundary*.999).brokenAt,null)
  assert.notEqual(runWall(scenario,boundary*1.001).brokenAt,null)
}
near(wallDamageLimit(build({health:'1',healthUnit:'q',regen:'0'})), wallDamageLimit(build({health:'1',healthUnit:'',regen:'0'}))*1e15)
// User regression: 40q Wall, final Wall Regen 420T/s, 200q enemy stat.
const userWall={...DEFAULT_WALL,health:'40',healthUnit:'q',regen:'420',regenUnit:'T',regenMode:'wall',bhOn:true,bhDuration:'50',bhCooldown:'50'}
const userDamage={...DEFAULT_DAMAGE,defenseOn:true,defense:'98',flameOn:true,flame:'95',pcolOn:true,pcol:'Ancestral',perkOn:true,enemyIncludesPerk:true}
const covered=buildWallScenario(userWall,userDamage).scenario
assert.equal(covered.pcolStatus,'permanent')
near(covered.regen,420e12)
near(covered.firstHitFactor*200e15,20e12)
assert.equal(runWall(covered,200e15).brokenAt,null)
const uncovered=buildWallScenario({...userWall,bhOn:false},userDamage).scenario
assert.equal(uncovered.pcolStatus,'inactive')
near(wallDamageLimit(covered),wallDamageLimit(uncovered)*10)
assert.notEqual(runWall(uncovered,200e15).brokenAt,null)
assert.equal(buildWallScenario({...userWall,enemyType:'boss'},userDamage).scenario.pcolStatus,'unsupported')
// Single-hit and siege must use the same first-hit reduction when coverage matches.
const {calculateDamage}=load('damage')
const at10Q={...userDamage,health:'40',healthUnit:'q',enemy:'10',enemyUnit:'Q'}
near(calculateDamage(at10Q).hit,1e15)
near(covered.firstHitFactor*1e19,calculateDamage(at10Q).hit)
near(1e15/covered.regen,2.380952380952381)
assert.notEqual(runWall(covered,1e19).brokenAt,null)
const onlyOne=buildWallScenario({...userWall,count:'1',repeat:false},userDamage).scenario
assert.equal(runWall(onlyOne,1e19).brokenAt,null)
console.log('Wall tests passed: Thorns breakpoints, heat-up, immunity, timed clearing, PCol windows, perk handling, arrivals, regen timing/caps, lethal ordering, validation, boundary search.')
