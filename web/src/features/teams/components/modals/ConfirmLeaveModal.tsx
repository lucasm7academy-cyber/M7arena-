import { LogOut } from 'lucide-react';
import { useSound } from '../../../../hooks/useSound';
import { ModalBase } from './ModalBase';

interface ConfirmLeaveModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmLeaveModal = ({ onClose, onConfirm }: ConfirmLeaveModalProps) => {
  const { playSound } = useSound();
  return (
    <ModalBase onClose={onClose} title="Sair da Equipe">
      <div className="text-center space-y-6">
        <div
          className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-red-500/10 border border-red-500/30"
        >
          <LogOut className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <p className="text-white font-black text-lg uppercase tracking-tight">Tem certeza?</p>
          <p className="text-white/40 text-xs mt-1 font-semibold">Você perderá acesso ao chat e lineup da equipe.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-white/60 text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={() => { playSound('click'); onConfirm(); }}
            className="flex-1 py-3 bg-red-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-600 transition-all cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.4)]"
          >
            Sair do Time
          </button>
        </div>
      </div>
    </ModalBase>
  );
};
