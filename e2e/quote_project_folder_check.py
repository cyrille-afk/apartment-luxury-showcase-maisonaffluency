"""Signed-in, disposable regression for configured quote-to-folder synchronization."""
import asyncio
import json
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        await page.goto("http://localhost:8080", wait_until="domcontentloaded")
        await page.evaluate("([k,v])=>localStorage.setItem(k,v)", [os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"], os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]])
        await page.goto("http://localhost:8080/trade/boards/f71ce63f-a7a8-48e7-a30b-8a045c4acd19?project=6ecaae1a-ac52-40e6-aea6-02eb38256823", wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        result = await page.evaluate("""async () => {
          const {supabase}=await import('/src/integrations/supabase/client.ts');
          const project='6ecaae1a-ac52-40e6-aea6-02eb38256823';
          const quote=crypto.randomUUID(), board=crypto.randomUUID();
          const {data:{user}}=await supabase.auth.getUser();
          if(!user) throw Error('Signed-in account required');
          const check=(result)=>{if(result.error) throw Error(result.error.message);return result.data;};
          try {
            check(await supabase.from('client_boards').insert({id:board,user_id:user.id,title:'Disposable quote sync check',project_id:project}));
            check(await supabase.from('trade_quotes').insert({id:quote,user_id:user.id,status:'draft',currency:'EUR'}));
            const chair='Upholstery: Safire-2 0007 · Frame Finish: Black Pepper Oak';
            check(await supabase.from('trade_quote_items').insert([
              {quote_id:quote,product_id:'d6094740-c916-4c7f-9f76-08883bc0c066',quantity:1,variant_label:'Wood Finish: Bleached Oak',unit_price_cents:10056330},
              {quote_id:quote,product_id:'9489ea91-8d42-4429-b356-45acf36e5a42',quantity:1,variant_label:chair,unit_price_cents:501600}
            ]));
            check(await supabase.rpc('link_quote_project_folder',{_quote_id:quote,_project_id:project,_board_id:board}));
            let rows=check(await supabase.from('client_board_items').select('*').eq('board_id',board));
            if(rows.length!==2 || !rows.some(r=>r.variant_label===chair)) throw Error('Two exact configurations required');
            check(await supabase.rpc('link_quote_project_folder',{_quote_id:quote,_project_id:project,_board_id:board}));
            rows=check(await supabase.from('client_board_items').select('*').eq('board_id',board));
            if(rows.length!==2) throw Error('Retry duplicated selections');
            check(await supabase.from('trade_quote_items').insert({quote_id:quote,product_id:'d6094740-c916-4c7f-9f76-08883bc0c066',quantity:1,variant_label:'Wood Finish: Black Oak'}));
            rows=check(await supabase.from('client_board_items').select('*').eq('board_id',board));
            if(rows.length!==3 || !rows.some(r=>r.variant_label==='Wood Finish: Bleached Oak')) throw Error('Future addition replaced original selection');
            if(rows.some(r=>'unit_price_cents' in r || 'internal_notes' in r)) throw Error('Quote prices copied into board');
            const mismatch=await supabase.rpc('link_quote_project_folder',{_quote_id:quote,_project_id:crypto.randomUUID(),_board_id:board});
            if(!mismatch.error) throw Error('Wrong project accepted');
            const prices=check(await supabase.from('trade_quote_items').select('unit_price_cents').eq('quote_id',quote));
            if(!prices.some(r=>r.unit_price_cents===10056330)) throw Error('Yoma price changed');
            return {board,quote,passed:true};
          } catch(error) {
            await supabase.from('trade_quotes').delete().eq('id',quote);
            await supabase.from('client_boards').delete().eq('id',board);
            throw error;
          }
        }""")
        try:
            await page.goto(f"http://localhost:8080/trade/boards/{result['board']}?project=6ecaae1a-ac52-40e6-aea6-02eb38256823", wait_until="domcontentloaded")
            await page.get_by_text("3 items · 0 approved · 0 rejected", exact=True).wait_for(timeout=15000)
            await page.get_by_text("Yoma CLW Console", exact=True).first.wait_for()
            print("PASS: two exact selections, duplicate-safe retry, later addition, price isolation, wrong-project denial and signed-in folder readback")
        finally:
            await page.evaluate("""async ({quote,board})=>{const {supabase}=await import('/src/integrations/supabase/client.ts'); for(const [table,id] of [['trade_quotes',quote],['client_boards',board]]){const {error}=await supabase.from(table).delete().eq('id',id);if(error) throw Error('Cleanup failed');}}""", result)
            await browser.close()

asyncio.run(main())