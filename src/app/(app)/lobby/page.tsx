'use client';

import React from 'react';
import LobbyHero from '@/components/lobby/LobbyHero';
import LobbyFeatures from '@/components/lobby/LobbyFeatures';

export default function LobbyPage() {
  return (
    <div className="min-h-screen text-white font-sans p-4 md:p-8 space-y-8">
      {/* HERO SECTION */}
      <LobbyHero />

      {/* RECURSOS */}
      <LobbyFeatures />
    </div>
  );
}
