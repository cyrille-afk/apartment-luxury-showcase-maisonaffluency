const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || !url.includes('instagram.com')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid Instagram URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting image from Instagram URL:', url);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url.trim(),
        formats: ['html'],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Scrape failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract og:image from HTML or metadata
    const html = data?.data?.html || data?.html || '';
    const metadata = data?.data?.metadata || data?.metadata || {};
    
    let imageUrl = metadata?.ogImage || metadata?.['og:image'] || null;

    if (!imageUrl && html) {
      // Try to extract og:image from HTML
      const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
        || html.match(/content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
      if (ogMatch) {
        imageUrl = ogMatch[1];
      }
    }

    if (!imageUrl && html) {
      // Fallback: try twitter:image
      const twMatch = html.match(/<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/i)
        || html.match(/content=["']([^"']+)["']\s+(?:property|name)=["']twitter:image["']/i);
      if (twMatch) {
        imageUrl = twMatch[1];
      }
    }

    if (!imageUrl) {
      console.log('No og:image found in scraped page');
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract image from this post. Try pasting the image URL manually.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracted image URL:', imageUrl.substring(0, 80) + '...');

    return new Response(
      JSON.stringify({ success: true, imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
