import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:8126/';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
await mkdir('test-results',{recursive:true});
const errors=[];
const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
page.on('pageerror',e=>errors.push(e.message));
const stored = async p => p.evaluate(()=>JSON.parse(localStorage.getItem(`kids-board-v1-${localStorage.getItem('kids-board-selected')}`)));
try {
  await page.goto(base);
  await page.getByRole('heading',{name:'快乐点数棋',exact:true}).waitFor();
  await page.locator('#board-image').evaluate(img=>img.decode());
  assert.equal(await page.locator('.piece').count(),2);
  await page.getByRole('button',{name:'路线：开',exact:true}).click();
  assert.equal(await page.locator('#route-svg').isVisible(),false,'route off must actually hide the SVG');
  await page.getByRole('button',{name:'路线：关',exact:true}).click();
  assert.equal(await page.locator('#route-svg').isVisible(),true);
  await page.getByRole('button',{name:'朗读：开',exact:true}).click();
  // A real roll changes one position and persists the next player's turn.
  await page.getByRole('button',{name:'掷骰子',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('roll').disabled);
  const first=await stored(page);
  assert.equal(first.turn,1);
  assert.ok(first.positions[0]>=1&&first.positions[0]<=6);
  assert.equal(first.positions[1],0);
  assert.equal(first.rounds,1);
  await page.reload();
  assert.deepEqual((await stored(page)).positions,first.positions);
  await page.getByText('轮到小绿',{exact:true}).waitFor();
  // Reset cancellation preserves positions, confirmation returns everyone to start.
  await page.getByRole('button',{name:'重新开始',exact:true}).click();
  await page.getByRole('button',{name:'继续这一局',exact:true}).click();
  assert.deepEqual((await stored(page)).positions,first.positions);
  await page.getByRole('button',{name:'重新开始',exact:true}).click();
  await page.getByRole('button',{name:'开始新一局',exact:true}).click();
  assert.deepEqual((await stored(page)).positions,[0,0]);
  // Change player count and verify all pawns remain visible.
  await page.locator('#player-count').selectOption('4');
  assert.equal(await page.locator('.piece').count(),4);
  const pieces=await page.locator('.piece').evaluateAll(els=>els.map(e=>({left:e.style.left,top:e.style.top})));
  assert.equal(new Set(pieces.map(p=>`${p.left}/${p.top}`)).size,4);
  await page.screenshot({path:'test-results/desktop-counting.png',fullPage:true});
  await page.getByRole('button',{name:/经典飞行棋 认汉字/}).click();
  await page.locator('#board-image').evaluate(img=>img.decode());
  await page.getByRole('button',{name:'第1格：白',exact:true}).click();
  assert.equal(await page.locator('#landed-word').textContent(),'白');
  await page.getByRole('button',{name:'第3格：空格，梯子捷径',exact:true}).click();
  assert.equal(await page.locator('#landed-word').textContent(),'空格');
  await page.getByRole('button',{name:'第36格：月',exact:true}).click();
  assert.equal(await page.locator('#landed-word').textContent(),'月');
  // Zoom moves the live board, then restores it with focus intact.
  await page.getByRole('button',{name:'放大棋盘',exact:true}).click();
  assert.equal(await page.locator('#zoom-mount #board-surface').count(),1);
  await page.getByRole('button',{name:'返回游戏',exact:true}).click();
  assert.equal(await page.locator('#board-mount #board-surface').count(),1);
  // Real UI uses a nearly finished save to exercise victory and disabled rolling.
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('kids-board-v1-literacy'));
    state.positions=[37,0];state.turn=0;state.rounds=2;state.lastRoll=1;
    localStorage.setItem('kids-board-v1-literacy',JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole('button',{name:'掷骰子',exact:true}).click();
  await page.getByText('小橘获胜！',{exact:true}).waitFor();
  assert.equal((await stored(page)).winner,0);
  assert.equal((await stored(page)).positions[0],38);
  assert.ok(await page.locator('#roll').isDisabled());
  await page.getByRole('button',{name:'重新开始',exact:true}).click();
  await page.getByRole('button',{name:'开始新一局',exact:true}).click();
  await page.getByRole('button',{name:'第1格：白',exact:true}).click();
  await page.screenshot({path:'test-results/desktop-literacy.png',fullPage:true});
  // Escape must cancel even after an earlier confirmed reset.
  await page.getByRole('button',{name:'掷骰子',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('roll').disabled);
  const beforeEscape=await stored(page);
  await page.getByRole('button',{name:'重新开始',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.locator('#reset-dialog').waitFor({state:'hidden'});
  assert.deepEqual(await stored(page),beforeEscape,'Escape must not reuse an old confirm value');

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(base);
  await mobile.locator('#board-image').evaluate(img=>img.decode());
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile page must not overflow');
  await mobile.getByRole('button',{name:'放大棋盘',exact:true}).click();
  assert.ok(await mobile.locator('#zoom-mount').evaluate(el=>el.scrollWidth>el.clientWidth),'zoom must allow panning');
  await mobile.keyboard.press('Escape');
  await mobile.locator('#board-mount #board-surface').waitFor();
  assert.equal(await mobile.locator('#board-mount #board-surface').count(),1);
  await mobile.screenshot({path:'test-results/mobile-counting.png',fullPage:true});
  await mobile.getByRole('button',{name:/经典飞行棋 认汉字/}).click();
  await mobile.locator('#board-image').evaluate(img=>img.decode());
  await mobile.getByRole('button',{name:'第36格：月',exact:true}).click();
  await mobile.screenshot({path:'test-results/mobile-literacy.png',fullPage:true});
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  // Touch-size viewport still permits a full completed turn.
  await mobile.getByRole('button',{name:'掷骰子',exact:true}).click();
  await mobile.waitForFunction(()=>!document.getElementById('roll').disabled);
  assert.equal((await stored(mobile)).rounds,1);
  await mobile.close();
  const animated=await browser.newPage({viewport:{width:320,height:740}});
  animated.on('pageerror',e=>errors.push(e.message));
  await animated.goto(base);
  assert.ok(await animated.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'320px viewport must fit');
  await animated.locator('#roll').click();
  assert.ok(await animated.locator('#roll').isDisabled());
  assert.ok(await animated.locator('#tab-literacy').isDisabled());
  assert.ok(await animated.locator('#player-count').isDisabled());
  await animated.waitForFunction(()=>!document.getElementById('roll').disabled);
  assert.equal((await stored(animated)).rounds,1,'animation completes exactly one turn');
  await animated.close();
  assert.deepEqual(errors,[],'no browser runtime errors');
  console.log('PASS: desktop/mobile rolling, persistence, reset, four players, corrected cells, zoom, victory, overflow, no runtime errors');
} finally { await browser.close(); }
