'use client';

import React, { memo, useMemo } from 'react';

interface StreamEmbedProps {
  channel: string;
  className?: string;
  autoplay?: boolean;
}

function StreamEmbedComponent({
  channel,
  className = 'w-full aspect-video rounded-2xl',
  autoplay = false,
}: StreamEmbedProps) {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  if (!channel || channel.trim() === '') {
    return (
      <div className={`${className} bg-black/50 flex items-center justify-center text-white/60 text-center`}>
        <p>Canal Twitch não configurado</p>
      </div>
    );
  }

  const cleanChannel = channel.replace(/^@/, '').trim();

  const iframeSrc = useMemo(() => {
    return `https://player.twitch.tv/?channel=${encodeURIComponent(cleanChannel)}&parent=${hostname}`;
  }, [cleanChannel, hostname]);

  return (
    <iframe
      src={iframeSrc}
      allowFullScreen
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      className={className}
      style={{ border: 'none', borderRadius: 'inherit' }}
    />
  );
}

export const StreamEmbed = memo(StreamEmbedComponent, (prevProps, nextProps) => {
  return (
    prevProps.channel === nextProps.channel &&
    prevProps.className === nextProps.className &&
    prevProps.autoplay === nextProps.autoplay
  );
});