throw new Error("deliberate boot failure probe"); Deno.serve(() => new Response("never"));
