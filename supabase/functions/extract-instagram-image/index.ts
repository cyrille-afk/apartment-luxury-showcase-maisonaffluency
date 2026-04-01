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

    console.log('Extracting image from Instagram URL:', url);

    // Use Instagram's public oEmbed endpoint — no API key needed
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url.trim())}`;

    const response = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      console.error('oEmbed failed with status:', response.status);
      return new Response(
        JSON.stringify({ success: false, error: `Instagram oEmbed returned ${response.status}. The post may be private or the URL invalid.` }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const imageUrl = data.thumbnail_url;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'No thumbnail found in oEmbed response' }),
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
