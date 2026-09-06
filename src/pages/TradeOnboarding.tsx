import { useState } from "react";
import { Link } from "react-router-dom";
import { useTradeCopilot } from "@/contexts/TradeCopilotContext";

const SUGGESTIONS = ["DESIGN CONCIERGE", "STUDIO ASSISTANT", "HEAD ARCHIVIST"];

const instrumentSerif = { fontFamily: "'Instrument Serif', serif" };

export default function TradeOnboarding() {
  const [step, setStep] = useState<1 | 2>(1);
  const [inputValue, setInputValue] = useState("");
  const [initialized, setInitialized] = useState(false);
  const { copilotName, setCopilotName } = useTradeCopilot();

  const selectSuggestion = (name: string) => setInputValue(name);

  const handleInitialize = () => {
    const name = inputValue.trim() || SUGGESTIONS[0];
    setCopilotName(name);
    setInitialized(true);
  };

  return (
    <main
      className="min-h-[100lvh] w-full flex items-center justify-center px-6"
      style={{ backgroundColor: "#F5F5F3" }}
    >
      <div className="relative w-full max-w-4xl min-h-[520px] flex items-center justify-center">
        {/* Step 1 — Cannes Onboarding Container */}
        <section
          className={`absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-700 ease-in-out ${
            step === 1
              ? "opacity-100 z-10 pointer-events-auto"
              : "opacity-0 z-0 pointer-events-none"
          }`}
          style={instrumentSerif}
        >
          <div className="space-y-4 mb-16">
            <p className="text-4xl md:text-6xl lg:text-7xl text-black leading-tight">
              Welcome to the Maison.
            </p>
            <p className="text-lg md:text-2xl text-black/70 leading-relaxed">
              To help you manage your architectural projects,
            </p>
            <p className="text-lg md:text-2xl text-black/70 leading-relaxed">
              your digital curation concierge is ready.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-none bg-black text-white px-10 py-4 text-xs md:text-sm uppercase tracking-[0.25em] font-sans hover:bg-neutral-800 transition-colors duration-300"
          >
            Meet Your Concierge
          </button>
        </section>

        {/* Step 2 — Copilot Personalization Engine */}
        <section
          className={`absolute inset-0 flex flex-col items-center justify-center text-center transition-opacity duration-700 ease-in-out ${
            step === 2
              ? "opacity-100 z-10 pointer-events-auto"
              : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <div className="max-w-2xl w-full flex flex-col items-center">
            {!initialized && (
              <h1
                className="text-2xl md:text-4xl text-black leading-snug mb-10"
                style={instrumentSerif}
              >
                Every great design studio operates differently. What would you like to call your AI
                curation copilot?
              </h1>
            )}

            {!initialized ? (
              <>
                <div className="flex flex-wrap justify-center gap-3 mb-8">
                  {SUGGESTIONS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => selectSuggestion(name)}
                      className="rounded-none bg-[#E8E8E6] text-black px-5 py-2.5 text-[10px] md:text-xs uppercase tracking-[0.2em] font-sans hover:bg-[#DCDCDA] transition-colors duration-300"
                    >
                      {name}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Or enter a custom name... (e.g., Felix, Pierre)"
                  className="w-full max-w-md rounded-none border border-black bg-transparent px-4 py-3 text-black placeholder:text-black/40 focus:outline-none focus:ring-1 focus:ring-black font-sans text-sm mb-8"
                />

                <button
                  type="button"
                  onClick={handleInitialize}
                  className="rounded-none bg-[#C5A86E] text-black px-10 py-4 text-xs md:text-sm uppercase tracking-[0.25em] font-sans hover:bg-[#B49A63] transition-colors duration-300"
                >
                  Initialize Portal
                </button>
              </>
            ) : (
              <div style={instrumentSerif}>
                <p className="text-2xl md:text-3xl text-black mb-3">Portal initialized.</p>
                <p className="text-lg text-black/70 mb-10">
                  Welcome, <span className="text-black">{copilotName}</span>.
                </p>
                <Link
                  to="/trade"
                  className="inline-block rounded-none bg-black text-white px-10 py-4 text-xs md:text-sm uppercase tracking-[0.25em] font-sans hover:bg-neutral-800 transition-colors duration-300"
                >
                  Enter Workspace
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
