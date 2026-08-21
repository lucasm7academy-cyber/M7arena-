import { motion, AnimatePresence } from "motion/react";
import { X, FileText } from "lucide-react";
import { CUT_FRAME, CUT_FRAME_INNER, CUT_BUTTON, CUT_BUTTON_INNER, CUT_BADGE, CUT_BADGE_INNER } from "../../../../components/campeonatos/cut-edge";

export const RegrasModal = ({ isOpen, onClose, campeonato }: any) => {
  return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="relative p-[1.5px] w-full max-w-2xl shadow-2xl"
              style={{
                clipPath: CUT_FRAME,
                background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.08) 100%)`,
                boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}33`
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] relative overflow-hidden flex flex-col p-5 sm:p-8 space-y-5"
                style={{ clipPath: CUT_FRAME_INNER }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 p-[1px] flex items-center justify-center shrink-0"
                      style={{
                        clipPath: CUT_BADGE,
                        background: `linear-gradient(135deg, ${campeonato.themeColor || '#FFB700'}, rgba(255,255,255,0.1))`,
                      }}
                    >
                      <div
                        className="w-full h-full bg-[#08080a] flex items-center justify-center"
                        style={{ clipPath: CUT_BADGE_INNER }}
                      >
                        <FileText
                          className="w-6 h-6"
                          style={{ color: campeonato.themeColor }}
                        />
                      </div>
                    </div>
                    <div>
                      <h2
                        className="text-xl font-black uppercase tracking-widest"
                        style={{ color: campeonato.themeColor }}
                      >
                        Regulamento Oficial
                      </h2>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        Termos, regras e conduta
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onClose()}
                    className="w-9 h-9 flex items-center justify-center text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 cursor-pointer"
                    style={{ clipPath: CUT_BADGE }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className="relative p-[1px] w-full"
                  style={{
                    clipPath: CUT_BUTTON,
                    background: 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div
                    className="bg-[#0c0c10] p-4 sm:p-6 overflow-y-auto max-h-[60vh] custom-scrollbar"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <div className="prose prose-invert prose-sm max-w-none">
                      <p className="text-white/70 leading-relaxed whitespace-pre-wrap font-medium text-xs sm:text-sm">
                        {campeonato.regulamento ||
                          "Nenhum regulamento cadastrado para este campeonato."}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onClose()}
                  className="w-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-black py-3.5 flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-widest border border-white/10 cursor-pointer"
                  style={{ clipPath: CUT_BUTTON }}
                >
                  FECHAR REGULAMENTO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );
};
