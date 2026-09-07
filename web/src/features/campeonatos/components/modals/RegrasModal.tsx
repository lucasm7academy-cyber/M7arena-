import { motion, AnimatePresence } from "motion/react";
import { X, FileText, ExternalLink } from "lucide-react";

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
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#08080a] shadow-2xl overflow-hidden flex flex-col p-5 sm:p-8 space-y-5"
            style={{
              boxShadow: `0 0 50px -10px ${campeonato.themeColor || '#FFB700'}33`
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <FileText
                    className="w-6 h-6"
                    style={{ color: campeonato.themeColor }}
                  />
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
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full rounded-xl border border-white/10 bg-[#0c0c10] p-4 sm:p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-white/70 leading-relaxed whitespace-pre-wrap font-medium text-xs sm:text-sm">
                  {campeonato.regulamento ||
                    "Nenhum regulamento cadastrado para este campeonato."}
                </p>
              </div>
            </div>

            {(() => {
              const raw = (campeonato.regulamento || '').trim();
              const isUrl = raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('www.') || raw.includes('docs.google.com') || raw.includes('drive.google.com') || raw.includes('.pdf') || raw.includes('/');
              if (!isUrl) return null;
              const finalUrl = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
              return (
                <a
                  href={finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-xl text-black font-black py-3.5 flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-widest cursor-pointer hover:scale-[1.01] shadow-lg"
                  style={{
                    backgroundColor: campeonato.themeColor || '#FFB700',
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir Documento Oficial em Nova Aba</span>
                </a>
              );
            })()}

            <button
              onClick={() => onClose()}
              className="w-full rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-black py-3.5 flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-widest border border-white/10 cursor-pointer"
            >
              FECHAR REGULAMENTO
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
