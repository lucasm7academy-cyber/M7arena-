// src/pages/DiscordCallback.tsx
// Recebe o ?code e ?state do Discord OAuth, troca pelo discord_id e salva em discord_links

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function DiscordCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [msg, setMsg] = useState('Vinculando sua conta Discord...');

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code  = params.get('code');
      const state = params.get('state');

      if (!code || !state) {
        if (cancelled) return;
        setStatus('error');
        setMsg('Parâmetros inválidos. Tente novamente.');
        return;
      }

      // 1. Valida o state e pega o user_id
      const { data: stateRow, error: stateErr } = await supabase
        .from('discord_oauth_state')
        .select('user_id, used')
        .eq('state', state)
        .maybeSingle();

      if (stateErr || !stateRow || stateRow.used) {
        if (cancelled) return;
        setStatus('error');
        setMsg('Link expirado ou já utilizado. Gere um novo link na página de vinculação.');
        return;
      }

      // 2. Marca o state como usado
      await supabase
        .from('discord_oauth_state')
        .update({ used: true })
        .eq('state', state);

      // 3. Troca o code pelo discord_id via edge function
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('discord-oauth-exchange', {
        body: { code, redirect_uri: `${window.location.origin}/auth/discord/callback` },
      });

      if (fnErr || !fnData?.discord_id) {
        if (cancelled) return;
        setStatus('error');
        setMsg('Falha ao obter dados do Discord. Tente novamente.');
        return;
      }

      // 4. Salva em discord_links e atualiza profiles.discord
      const { error: linkErr } = await supabase
        .from('discord_links')
        .upsert({
          discord_id:  fnData.discord_id,
          supabase_id: stateRow.user_id,
          discord_tag: fnData.discord_tag,
        }, { onConflict: 'discord_id' });

      if (linkErr) {
        if (cancelled) return;
        setStatus('error');
        setMsg('Erro ao salvar vínculo. Tente novamente.');
        return;
      }

      // Atualiza o campo discord no perfil do usuário automaticamente
      await supabase
        .from('profiles')
        .upsert({ id: stateRow.user_id, discord: fnData.discord_tag }, { onConflict: 'id' });

      if (cancelled) return;
      setStatus('success');
      setMsg('Discord vinculado com sucesso!');
      timeoutId = setTimeout(() => navigate('/vincular?discord=linked'), 1500);
    };

    run();
    return () => { cancelled = true; if (timeoutId) clearTimeout(timeoutId); };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin mx-auto" />
        )}
        {status === 'success' && <div className="text-5xl">✅</div>}
        {status === 'error'   && <div className="text-5xl">❌</div>}
        <p className="text-white/60 font-bold">{msg}</p>
        {status === 'error' && (
          <button onClick={() => navigate('/vincular')} className="mt-4 px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-sm font-bold">
            Voltar
          </button>
        )}
      </div>
    </div>
  );
}
