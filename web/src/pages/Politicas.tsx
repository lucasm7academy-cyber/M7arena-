import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Politicas() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-white py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="mb-12">
          <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-4">
            CÃ³digo de <span className="text-[#FFB700]">Conduta</span>
          </h1>
          <p className="text-white/60 text-lg">
            PolÃ­ticas e diretrizes para uma comunidade saudÃ¡vel e respeitosa
          </p>
        </div>

        {/* ConteÃºdo */}
        <div className="space-y-12">
          {/* SeÃ§Ã£o 1 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              1. Respeito MÃºtuo
            </h2>
            <p className="text-white/80 leading-relaxed">
              Todos os membros da comunidade M7 ARENA devem tratar uns aos outros com respeito e dignidade.
              Comportamentos discriminatÃ³rios, assÃ©dio ou humilhaÃ§Ã£o de qualquer forma nÃ£o serÃ£o tolerados.
              Somos uma comunidade diversa e celebramos a individualidade de cada membro.
            </p>
          </section>

          {/* SeÃ§Ã£o 2 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              2. Fair Play
            </h2>
            <p className="text-white/80 leading-relaxed">
              A competiÃ§Ã£o deve ser saudÃ¡vel e justa. Qualquer forma de trapaÃ§a, exploit de bugs, ou
              manipulaÃ§Ã£o de regras Ã© estritamente proibida. Entendemos que o objetivo Ã© melhorar como
              jogador em um ambiente competitivo Ã­ntegro.
            </p>
          </section>

          {/* SeÃ§Ã£o 3 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              3. ComunicaÃ§Ã£o Apropriada
            </h2>
            <p className="text-white/80 leading-relaxed">
              Linguagem ofensiva, xingamentos, spam ou conteÃºdo inapropriado nÃ£o sÃ£o permitidos em
              nenhuma forma de comunicaÃ§Ã£o dentro da plataforma. Mantenha as conversas produtivas,
              construtivas e respeitosas.
            </p>
          </section>

          {/* SeÃ§Ã£o 4 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              4. Responsabilidade Pessoal
            </h2>
            <p className="text-white/80 leading-relaxed">
              Cada jogador Ã© responsÃ¡vel por suas aÃ§Ãµes e comportamento. Ao participar de salas e
              partidas, vocÃª concorda em cumprir as regras do modo de jogo e aceitar o resultado com
              maturidade, independentemente do resultado.
            </p>
          </section>

          {/* SeÃ§Ã£o 5 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              5. ConsequÃªncias de ViolaÃ§Ãµes
            </h2>
            <div className="text-white/80 leading-relaxed space-y-3">
              <p>
                ViolaÃ§Ãµes do cÃ³digo de conduta podem resultar em:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>AdvertÃªncia verbal</li>
                <li>SuspensÃ£o temporÃ¡ria da conta</li>
                <li>RestriÃ§Ãµes em funcionalidades especÃ­ficas</li>
                <li>Banimento permanente em casos graves</li>
              </ul>
            </div>
          </section>

          {/* SeÃ§Ã£o 6 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              6. Privacidade e Dados Pessoais
            </h2>
            <p className="text-white/80 leading-relaxed">
              Seus dados pessoais sÃ£o tratados com confidencialidade e seguranÃ§a. Nunca compartilhamos
              informaÃ§Ãµes sensÃ­veis com terceiros sem seu consentimento. Respeite a privacidade dos
              demais membros e nÃ£o solicite ou compartilhe informaÃ§Ãµes pessoais desnecessariamente.
            </p>
          </section>

          {/* SeÃ§Ã£o 7 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              7. DenÃºncias e Suporte
            </h2>
            <p className="text-white/80 leading-relaxed mb-4">
              Se vocÃª presenciar uma violaÃ§Ã£o do cÃ³digo de conduta, entre em contato com o suporte
              atravÃ©s dos canais oficiais. Todas as denÃºncias serÃ£o investigadas com seriedade e
              discriÃ§Ã£o.
            </p>
            <p className="text-white/80 leading-relaxed">
              Estamos comprometidos em manter um ambiente seguro e acolhedor para todos os membros
              da comunidade M7 ARENA.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10">
          <p className="text-white/40 text-sm text-center">
            Ãšltima atualizaÃ§Ã£o: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  );
}
