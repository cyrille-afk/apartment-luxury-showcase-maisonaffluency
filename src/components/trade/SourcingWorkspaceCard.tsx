import React, { useState } from 'react';

export const SourcingWorkspaceCard = () => {
  const [selectedFinish, setSelectedFinish] = useState('Mist Ash');
  const [isLocked, setIsLocked] = useState(true);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-[#FAF9F5] border border-neutral-200/60 rounded-lg font-sans text-neutral-800 space-y-6">
      {/* Upper Context Header */}
      <div>
        <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase block mb-1">
          Man of Parts
        </span>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-medium text-neutral-900">
            Cinnamon Gardens Floor Lamp by Yabu Pushelberg
          </h3>
          <span className="text-[10px] bg-amber-100 text-amber-800 font-medium px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
            Locked
          </span>
        </div>
        <p className="text-xs text-amber-700/80 font-light mt-1.5">
          • Handcrafted to Order · 10-16-Week Lead Time + 2wk White-Glove to New York (~18wks total)
        </p>
      </div>

      {/* Main Interactive Grid Split */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left: 3D Interaction Viewport */}
        <div className="md:col-span-4 bg-neutral-100/50 border border-neutral-200/40 rounded-md p-6 flex flex-col items-center justify-center min-h-[220px] relative">
          <span className="absolute top-3 left-3 text-[9px] uppercase tracking-wider text-neutral-400 font-medium">
            Interactive 3D Model
          </span>
          <div className="w-16 h-16 bg-neutral-300 rounded-sm mb-4 animate-pulse opacity-40" />
          <button className="px-4 py-1.5 bg-white border border-neutral-300 text-xs font-light rounded-full shadow-sm hover:bg-neutral-50 transition-colors">
            View in 3D
          </button>
        </div>

        {/* Right: Fine-Grain Selection Control Panel */}
        <div className="md:col-span-8 space-y-5">
          {/* Finish Selectors */}
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase block mb-2">
              Base (2)
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedFinish('Black Pepper Ash')}
                className={`p-1 rounded border text-left transition-all ${selectedFinish === 'Black Pepper Ash' ? 'border-neutral-800 bg-white ring-1 ring-neutral-800' : 'border-neutral-200 bg-neutral-50'}`}
              >
                <div className="w-12 h-8 bg-neutral-800 rounded-sm mb-1" />
                <span className="text-[10px] block font-light text-neutral-600 text-center">Black Pepper</span>
              </button>
              <button
                onClick={() => setSelectedFinish('Mist Ash')}
                className={`p-1 rounded border text-left transition-all ${selectedFinish === 'Mist Ash' ? 'border-neutral-800 bg-white ring-1 ring-neutral-800' : 'border-neutral-200 bg-neutral-50'}`}
              >
                <div className="w-12 h-8 bg-neutral-300 rounded-sm mb-1" />
                <span className="text-[10px] block font-light text-neutral-600 text-center">Mist Ash</span>
              </button>
            </div>
          </div>

          {/* Pricing & Specification Details */}
          <div className="bg-white/60 p-4 border border-neutral-200/40 rounded-md space-y-2 text-xs">
            <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase block mb-1">
              Current Selection
            </span>
            <div className="grid grid-cols-3 gap-y-1.5 text-neutral-600 font-light">
              <div>SKU</div><div className="col-span-2 font-mono text-neutral-900">MA-E5CD4720</div>
              <div>Frame</div><div className="col-span-2 text-neutral-900">{selectedFinish}</div>
              <div>Trade Price (EUR)</div><div className="col-span-2 font-medium text-neutral-900">From €4,950</div>
              <div>Lead Time</div><div className="col-span-2 text-neutral-900">10-16 weeks</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Controls Footer */}
      <div className="pt-4 border-t border-neutral-200/60 flex justify-between items-center gap-3">
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-neutral-800 bg-neutral-900 text-white text-xs uppercase tracking-wider font-medium rounded-sm hover:bg-neutral-800">
            Generate Tearsheet
          </button>
          <button className="px-4 py-2 border border-neutral-300 text-neutral-700 text-xs uppercase tracking-wider font-medium rounded-sm bg-white hover:bg-neutral-50">
            Add to Project Board
          </button>
        </div>

        {/* Mode Toggles */}
        <div className="flex border border-neutral-200 rounded-sm bg-neutral-50 p-0.5 text-[11px] font-medium uppercase tracking-wide">
          <button
            onClick={() => setIsLocked(true)}
            className={`px-3 py-1 rounded-sm ${isLocked ? 'bg-[#D9C3B0] text-neutral-900 font-semibold' : 'text-neutral-400'}`}
          >
            Locked
          </button>
          <button
            onClick={() => setIsLocked(false)}
            className={`px-3 py-1 rounded-sm ${!isLocked ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
          >
            Swap
          </button>
        </div>
      </div>
    </div>
  );
};

export default SourcingWorkspaceCard;
