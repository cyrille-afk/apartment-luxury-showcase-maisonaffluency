import asyncio,json
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  page=await browser.new_page(viewport={'width':1946,'height':1181})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('http://localhost:8080',wait_until='networkidle')
  await page.evaluate('window.captured=[];window.__lovableEvents={track:(name,properties)=>{window.captured.push({name,properties});return null}}')
  trigger=page.get_by_role('button',name='Seating',exact=True)
  await trigger.hover();await page.locator('[data-seating-grid]').wait_for()
  await trigger.click()
  assert await page.evaluate('captured.filter(e=>e.name==="project.seating_dropdown_opened").length')==1
  sidebar=page.locator('[data-seating-sidebar]')
  await sidebar.get_by_role('button',name='Armchairs',exact=True).click()
  await page.wait_for_url('**/products-category/seating/armchairs')
  await trigger.hover();await page.locator('[data-seating-grid]').wait_for()
  card=page.locator('[data-seating-grid]').get_by_role('button',name='Sofas Sofas',exact=True)
  await card.hover();await card.click();await page.wait_for_url('**/products-category/seating/sofas')
  captured=await page.evaluate('captured');print(json.dumps(captured))
  opens=[e for e in captured if e['name']=='project.seating_dropdown_opened'];assert len(opens)==2
  subs=[e for e in captured if e['name']=='project.seating_subcategory_clicked'];assert subs==[{'name':'project.seating_subcategory_clicked','properties':{'subcategory':'Armchairs'}}]
  interactions=[e['properties'] for e in captured if e['name']=='project.seating_featured_image_interacted'];assert [e['interaction'] for e in interactions]==['hover','click'];assert all(e['subcategory']=='Sofas' and isinstance(e['image_index'],int) and e['image_index']>=0 for e in interactions);assert interactions[0]['image_index']==interactions[1]['image_index']
  await page.screenshot(path='/tmp/browser/seating-analytics/destination.png')
  await page.evaluate('delete window.__lovableEvents');await trigger.hover();await page.locator('[data-seating-sidebar]').get_by_role('button',name='Chairs',exact=True).click();await page.wait_for_url('**/products-category/seating/chairs')
  assert not errors,errors;print('All analytics assertions passed; no-runtime fallback works; errors:',errors)
  await browser.close()
asyncio.run(main())
