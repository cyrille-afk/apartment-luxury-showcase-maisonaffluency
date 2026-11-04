import asyncio,json
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for width,height in [(1946,1181),(1024,1800)]:
   page=await browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto('http://localhost:8080',wait_until='networkidle')
   for label,key in [('Seating','seating'),('Tables','tables'),('Lighting','lighting'),('Rugs','rugs'),('Storage','storage'),('Decor','decor')]:
    trigger=page.get_by_role('button',name=label,exact=True);await trigger.hover()
    panel=page.locator(f'[data-product-grid-panel="{key}"]');await panel.wait_for()
    await page.wait_for_function('document.querySelectorAll("[data-product-menu-grid] img").length > 0')
    await page.wait_for_function('Array.from(document.querySelectorAll("[data-product-menu-grid] img")).every(i=>i.complete)')
    first=await panel.locator('img').evaluate_all('(imgs)=>imgs.map(i=>({src:i.currentSrc,ok:i.naturalWidth>0,label:i.alt,lazy:i.loading}))')
    sidebar=await panel.locator('[data-product-menu-sidebar]').bounding_box();grid=await panel.locator('[data-product-menu-grid]').bounding_box()
    assert abs(sidebar['height']-grid['height'])<1
    assert all(i['ok'] and i['lazy']=='lazy' for i in first),first
    assert await panel.get_by_text('Shop By Room',exact=True).count()==0
    await panel.screenshot(path=f'/tmp/browser/product-menus/{key}-{width}.png')
    await page.get_by_role('button',name='By Rooms',exact=True).hover();await page.locator('[data-room-menu="rooms"]').wait_for()
    await trigger.hover();await panel.wait_for();await page.wait_for_function('Array.from(document.querySelectorAll("[data-product-menu-grid] img")).every(i=>i.complete && i.naturalWidth>0)')
    second=await panel.locator('img').evaluate_all('(imgs)=>imgs.map(i=>i.currentSrc)')
    changed=sum(a['src']!=b for a,b in zip(first,second));assert changed>0,(key,first,second)
    print(json.dumps({'width':width,'menu':key,'height':grid['height'],'cards':[i['label'] for i in first],'changed':changed,'errors':errors}))
   await page.get_by_role('button',name='Tables',exact=True).hover();await page.locator('[data-product-menu-grid]').get_by_role('button',name='Coffee Tables Coffee Tables',exact=True).click();await page.wait_for_url('**/products-category/tables/coffee-tables')
   assert not errors,errors
   await page.close()
  await browser.close()
asyncio.run(main())
