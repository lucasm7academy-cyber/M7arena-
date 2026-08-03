import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

export default function QuemSomos() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-transparent text-white py-10 md:py-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* SEÇÃO QUEM SOMOS */}
        <section className="overflow-hidden">
          <div className="flex flex-col lg:flex-row items-center gap-10 md:gap-16">
            <div className="flex flex-col items-center lg:items-start gap-8 lg:w-1/2 text-center lg:text-left">
              <div className="flex flex-col items-center lg:items-start gap-2">
                <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter leading-none font-display text-center lg:text-left">
                  QUEM SOMOS?
                </h2>
              </div>

              <div className="lg:hidden w-full">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <div className="relative aspect-[4/5] bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                    <img
                      src="/images/lucasEdu.png"
                      alt="Founder"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                    <div className="absolute bottom-4 left-4 right-4 p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl">
                      <p className="text-[8px] font-black uppercase text-[#FFB700] tracking-widest mb-0.5">Fundador & CEO</p>
                      <p className="text-base font-black uppercase text-white tracking-tight">
                        Lucas <span className="text-[#FFB700]">"One lucks"</span> Eduardo
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="space-y-6 text-white/80 text-sm md:text-lg leading-relaxed font-sans text-center lg:text-left">
                <p>
                  Desde os 15 anos de idade, sonho em realizar campeonatos e eventos de e-sports, e somente aos 24 deixei o medo de lado e criei a <span className="text-white font-bold">M7 Arena</span>, uma organização voltada para o competitivo com o intuito de proporcionar aos jogadores amadores a experiência única de brilhar em uma arena profissional.
                </p>
                <p>
                  Acreditamos que o talento não tem elo e que todos merecem uma vitrine justa. Na M7, nossa missão é transformar sonhos em realidade, oferecendo competições organizadas, seguras e com premiações que valorizam o esforço de cada competidor que pisa na Summoner's Rift.
                </p>
              </div>
            </div>

            <div className="hidden lg:block lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="relative z-10 w-full max-w-[500px] mx-auto">
                  <div className="absolute -inset-4 border border-[#FFB700]/20 rounded-2xl -rotate-3 z-0" />
                  <div className="absolute -inset-4 border border-[#FFB700]/10 rounded-2xl rotate-2 z-0" />

                  <div className="relative aspect-[4/5] bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden group">
                    <img
                      src="/images/lucasEdu.png"
                      alt="Founder"
                      className="w-full h-full object-cover transition-all duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                    <div className="absolute bottom-6 left-6 right-6 p-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl">
                      <p className="text-[10px] font-black uppercase text-[#FFB700] tracking-widest mb-1 font-sans">Fundador & CEO</p>
                      <p className="text-xl font-black uppercase text-white tracking-tight font-display">
                        Lucas <span className="text-[#FFB700]">"One lucks"</span> Eduardo
                      </p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#FFB700]/5 blur-[80px] rounded-full -z-10" />
              </motion.div>
            </div>
          </div>
        </section>

        {/* SEÇÃO CONTINUAÇÃO QUEM SOMOS */}
        <section className="py-10 md:py-16 overflow-hidden">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-10 md:gap-16">
            <div className="flex flex-col items-center lg:items-start gap-8 lg:w-1/2 text-center lg:text-left">
              <div className="flex flex-col items-center lg:items-start gap-4">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight font-display text-center lg:text-left text-white">
                  "Em alguns momentos cheguei a duvidar que tudo isso seria possível, mas nunca desisti de criar a M7 e hoje vejo que estamos apenas no começo..."
                </h2>
              </div>

              <div className="lg:hidden w-full">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  className="relative w-full"
                >
                  <div className="relative aspect-[4/5] bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
                    <img
                    src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Riven_18.jpg"
                    alt="Founder Continuation"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                </div>
              </motion.div>
            </div>

            <div className="space-y-6 text-white/80 text-sm md:text-lg leading-relaxed font-sans text-center lg:text-left">
              <p>
                O caminho até aqui não foi simples. Lidar com a incerteza, estruturar as primeiras transmissões e conquistar a confiança da comunidade foram desafios gigantescos que exigiram noites em claro e dedicação integral. Cada feedback de um jogador, cada momento emocionante narrado e cada comemoração de título nos mostraram que toda gota de suor valeu a pena.
              </p>
              <p>
                Hoje, olhamos para a M7 Arena não apenas como uma marca de torneios, mas como uma verdadeira comunidade unida pela paixão pelo esporte eletrônico. E este é apenas o primeiro capítulo de uma história grandiosa que estamos escrevendo juntos com cada invocador.
              </p>
            </div>
          </div>

          <div className="hidden lg:block lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative z-10 w-full max-w-[500px] mx-auto">
                <div className="absolute -inset-4 border border-[#FFB700]/20 rounded-2xl rotate-3 z-0" />
                <div className="absolute -inset-4 border border-[#FFB700]/10 rounded-2xl -rotate-2 z-0" />

                <div className="relative aspect-[4/5] bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden group">
                  <img
                    src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Riven_18.jpg"
                      alt="Founder Continuation"
                      className="w-full h-full object-cover transition-all duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                  </div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#FFB700]/5 blur-[80px] rounded-full -z-10" />
              </motion.div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
