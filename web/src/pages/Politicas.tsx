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
            Código de <span className="text-[#FFB700]">Conduta</span>
          </h1>
          <p className="text-white/60 text-lg">
            Políticas e diretrizes para uma comunidade saudável e respeitosa
          </p>
        </div>

        {/* Conteúdo */}
        <div className="space-y-12">
          {/* Seção 1 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              1. Respeito Mútuo
            </h2>
            <p className="text-white/80 leading-relaxed">
              Todos os membros da comunidade M7 Academy devem tratar uns aos outros com respeito e dignidade.
              Comportamentos discriminatórios, assédio ou humilhação de qualquer forma não serão tolerados.
              Somos uma comunidade diversa e celebramos a individualidade de cada membro.
            </p>
          </section>

          {/* Seção 2 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              2. Fair Play
            </h2>
            <p className="text-white/80 leading-relaxed">
              A competição deve ser saudável e justa. Qualquer forma de trapaça, exploit de bugs, ou
              manipulação de regras é estritamente proibida. Entendemos que o objetivo é melhorar como
              jogador em um ambiente competitivo íntegro.
            </p>
          </section>

          {/* Seção 3 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              3. Comunicação Apropriada
            </h2>
            <p className="text-white/80 leading-relaxed">
              Linguagem ofensiva, xingamentos, spam ou conteúdo inapropriado não são permitidos em
              nenhuma forma de comunicação dentro da plataforma. Mantenha as conversas produtivas,
              construtivas e respeitosas.
            </p>
          </section>

          {/* Seção 4 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              4. Responsabilidade Pessoal
            </h2>
            <p className="text-white/80 leading-relaxed">
              Cada jogador é responsável por suas ações e comportamento. Ao participar de salas e
              partidas, você concorda em cumprir as regras do modo de jogo e aceitar o resultado com
              maturidade, independentemente do resultado.
            </p>
          </section>

          {/* Seção 5 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              5. Consequências de Violações
            </h2>
            <div className="text-white/80 leading-relaxed space-y-3">
              <p>
                Violações do código de conduta podem resultar em:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Advertência verbal</li>
                <li>Suspensão temporária da conta</li>
                <li>Restrições em funcionalidades específicas</li>
                <li>Banimento permanente em casos graves</li>
              </ul>
            </div>
          </section>

          {/* Seção 6 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              6. Privacidade e Dados Pessoais
            </h2>
            <p className="text-white/80 leading-relaxed">
              Seus dados pessoais são tratados com confidencialidade e segurança. Nunca compartilhamos
              informações sensíveis com terceiros sem seu consentimento. Respeite a privacidade dos
              demais membros e não solicite ou compartilhe informações pessoais desnecessariamente.
            </p>
          </section>

          {/* Seção 7 */}
          <section className="bg-white/5 border border-white/10 rounded-2xl p-8">
            <h2 className="text-2xl font-black text-[#FFB700] uppercase tracking-tight mb-4">
              7. Denúncias e Suporte
            </h2>
            <p className="text-white/80 leading-relaxed mb-4">
              Se você presenciar uma violação do código de conduta, entre em contato com o suporte
              através dos canais oficiais. Todas as denúncias serão investigadas com seriedade e
              discrição.
            </p>
            <p className="text-white/80 leading-relaxed">
              Estamos comprometidos em manter um ambiente seguro e acolhedor para todos os membros
              da comunidade M7 Academy.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10">
          <p className="text-white/40 text-sm text-center">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  );
}
