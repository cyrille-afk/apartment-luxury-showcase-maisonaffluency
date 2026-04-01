const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function extractViaOembed(url: string): Promise<string | null> {
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.thumbnail_url || null;
  } catch {
    return null;
  }
}

async function extractViaHtmlScrape(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const html = await response.text();

    // Try og:image
    const ogMatch = html.match(/<meta\s+(?:[^>]*?)property=["']og:image["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+(?:[^>]*?)content=["']([^"']+)["']\s+(?:[^>]*?)property=["']og:image["']/i);
    if (ogMatch?.[1]) return ogMatch[1];

    // Try twitter:image
    const twMatch = html.match(/<meta\s+(?:[^>]*?)name=["']twitter:image["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+(?:[^>]*?)content=["']([^"']+)["']\s+(?:[^>]*?)name=["']twitter:image["']/i);
    if (twMatch?.[1]) return twMatch[1];

    return null;
  } catch {
    return null;
  }
}

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

    const cleanUrl = url.trim().split('?')[0].replace(/\/$/, '') + '/';
    console.log('Extracting image from:', cleanUrl);

    // Try oEmbed first (most reliable when not rate-limited)
    let imageUrl = await extractViaOembed(cleanUrl);

    // Fallback: direct HTML scrape
    if (!imageUrl) {
      console.log('oEmbed failed, trying HTML scrape...');
      imageUrl = await extractViaHtmlScrape(cleanUrl);
    }

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract image. The post may be private, or Instagram is rate-limiting requests. Try again later or paste the image URL manually.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Success:', imageUrl.substring(0, 80));

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
