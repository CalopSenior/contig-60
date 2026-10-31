import test from 'node:test';import assert from 'node:assert/strict';import {solutions} from './solver';import {evaluate} from './game';
test('solver agrees with independently enumerated permutations, operators and both tree shapes for all dice rolls',()=>{
 const ops=['+','-','*','/'];
 for(let a=1;a<=6;a++)for(let b=a;b<=6;b++)for(let c=b;c<=6;c++){
  const dice=[a,b,c],expected=new Set<number>();
  for(const [x,y,z] of [[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]])for(const op1 of ops)for(const op2 of ops)for(const expr of [`(${x}${op1}${y})${op2}${z}`,`${x}${op1}(${y}${op2}${z})`]){
   try{const result=evaluate(expr,dice);if(Number.isInteger(result))expected.add(result);}catch{}
  }
  const actual=solutions(dice);assert.deepEqual(Object.keys(actual).map(Number).sort((a,b)=>a-b),[...expected].sort((a,b)=>a-b));
  for(const [value,expressions] of Object.entries(actual)){assert.equal(new Set(expressions).size,expressions.length);for(const expr of expressions)assert.ok(Math.abs(evaluate(expr,dice)-Number(value))<1e-9);}
 }
});
test('repeated dice, fractions, zero divisors and invalid inputs',()=>{assert.ok(solutions([1,1,1])[3]);assert.ok(solutions([6,1,6])[36]);assert.ok(!solutions([1,1,1])[75]);assert.throws(()=>solutions([0,1,1]));assert.throws(()=>solutions([1,2]));assert.ok(Object.isFrozen(solutions([1,1,1])[3]));});
