import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Plus, Upload, X } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { useSound } from '../../../../hooks/useSound';
import type { CreateTeamData } from '../../types';
import { CUT_FRAME, CUT_FRAME_INNER } from './ModalBase';

interface CreateTeamModalProps {
  onClose: () => void;
  onCreate: (data: CreateTeamData) => void | Promise<void>;
  hasRiot: boolean;
}

const COLOR_THEMES = [
  { from: '#FFB700', to: '#FF6600', label: 'Gold' },
  { from: '#0044FF', to: '#00D4FF', label: 'Neon Blue' },
  { from: '#FF3300', to: '#FF9900', label: 'Fire' },
  { from: '#00FF88', to: '#00C3FF', label: 'Toxic Green' },
  { from: '#7B00FF', to: '#00AAFF', label: 'Storm Purple' },
  { from: '#FF00B8', to: '#7000FF', label: 'Pink' },
  { from: '#0cebeb', to: '#29ffc6', label: 'Aurora' },
  { from: '#f5af19', to: '#f12711', label: 'Sunrise' },
  { from: '#11998E', to: '#38EF7D', label: 'Emerald' },
  { from: '#00FF41', to: '#00A32A', label: 'Matrix Green' },
];

const compressImageFile = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpeg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const CreateTeamModal = ({ onClose, onCreate, hasRiot }: CreateTeamModalProps) => {
  const { playSound } = useSound();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [theme, setTheme] = useState({ from: COLOR_THEMES[0].from, to: COLOR_THEMES[0].to });
  const [logoPreview, setLogoPreview] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [discord, setDiscord] = useState('');

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    if (!file.type.includes('image')) { setLogoError('Apenas imagens PNG ou JPEG'); return; }
    playSound('click');
    try {
      const compressedFile = await compressImageFile(file, 400, 400, 0.7);
      setLogoFile(compressedFile);
      setLogoPreview(URL.createObjectURL(compressedFile));
    } catch (err) {
      console.error('Error compressing logo:', err);
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleCreate = (): void => {
    if (!name || tag.length < 3 || !hasRiot || !whatsapp || !discord) return;
    playSound('success');
    onCreate({
      name,
      tag: tag.toUpperCase().slice(0, 4),
      gradientFrom: theme.from,
      gradientTo: theme.to,
      logoUrl: logoPreview || undefined,
      _logoFile: logoFile,
      whatsapp: whatsapp.replace(/\D/g, ''), // Remove caracteres não numéricos
      discord: discord
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.15 }}
        className="relative p-[1.5px] w-full max-w-lg shadow-2xl"
        style={{
          clipPath: CUT_FRAME,
          background: `linear-gradient(135deg, ${theme.from}, rgba(255,255,255,0.08) 100%)`,
          boxShadow: `0 0 50px -10px ${theme.from}40`
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="w-full bg-[#08080a] relative overflow-hidden flex flex-col p-6 sm:p-8"
          style={{ clipPath: CUT_FRAME_INNER }}
        >
          {/* Header */}
          <div className="border-b border-white/5 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl p-[1px] flex items-center justify-center shrink-0"
                style={{
                  background: theme.from
                }}
              >
                <div
                  className="w-full h-full bg-[#08080a] rounded-[11px] flex items-center justify-center"
                >
                  <Plus className="w-5 h-5" style={{ color: theme.from }} />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-white">Monte sua Equipe</h2>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Crie seu time e lidere no ranking</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white p-1 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="pt-6 space-y-4">
            <div>
              <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-1.5">Nome do Time</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: M7 Esports"
                maxLength={24}
                className="w-full bg-[#0c0c10] border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-semibold focus:outline-none focus:border-white/25 placeholder:text-white/20 transition-colors"
              />
            </div>

            <div>
              <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-1.5">Tag (até 4 letras)</label>
              <input
                value={tag}
                onChange={e => setTag(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="Ex: M7ES"
                maxLength={4}
                className="w-full bg-[#0c0c10] border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-black tracking-widest focus:outline-none focus:border-white/25 placeholder:text-white/20 transition-colors"
              />
              <p className="text-white/30 text-[9px] mt-1 font-bold">Sua tag aparece em rankings, campeonatos e no Hall da Fama.</p>
            </div>

            <div>
              <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-1.5">Logo do Time</label>
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-xl border border-white/10 bg-[#0c0c10] flex items-center justify-center shrink-0 overflow-hidden"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-5 h-5 text-white/30" />
                  )}
                </div>

                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoUpload} />
                  <div
                    className="flex items-center justify-center gap-2 py-3.5 border rounded-xl transition-all cursor-pointer font-black text-xs uppercase tracking-widest"
                    style={{
                      borderColor: `${theme.from}50`,
                      background: `${theme.from}15`,
                      color: theme.from,
                    }}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Enviar Logo</span>
                  </div>
                </label>
              </div>
              {logoError && <p className="text-red-400 text-[10px] mt-1 font-bold">{logoError}</p>}
            </div>

            <div>
              <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-1.5">Tema de Cor</label>
              <div className="grid grid-cols-5 gap-2">
                {COLOR_THEMES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => setTheme({ from: t.from, to: t.to })}
                    className={`relative h-9 rounded-lg transition-all cursor-pointer flex items-center justify-center p-[1px] ${
                      theme.from === t.from ? 'ring-2 ring-white scale-105' : 'hover:scale-105 border border-white/10'
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${t.from}, ${t.to})`
                    }}
                    title={t.label}
                  >
                    {theme.from === t.from && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            {/* ── CONTATO ── */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-black">Contato do Responsável</p>
              <div>
                <label className="text-white/30 text-[9px] uppercase tracking-widest block mb-1">WhatsApp</label>
                <input
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="Ex: (11) 99999-9999"
                  type="tel"
                  className="w-full bg-[#0c0c10] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-semibold focus:outline-none focus:border-white/25 placeholder:text-white/20 transition-colors"
                />
              </div>
              <div>
                <label className="text-white/30 text-[9px] uppercase tracking-widest flex items-center gap-1.5 mb-1">
                  <FaDiscord className="w-3 h-3 text-[#5865F2]" /> Discord
                </label>
                <input
                  value={discord}
                  onChange={e => setDiscord(e.target.value)}
                  placeholder="Ex: usuario#1234"
                  type="text"
                  className="w-full bg-[#0c0c10] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-semibold focus:outline-none focus:border-white/25 placeholder:text-white/20 transition-colors"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCreate}
                disabled={!name || tag.length < 3 || !hasRiot || !whatsapp || !discord}
                className="w-full py-4 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: theme.from,
                  boxShadow: `0 0 30px -5px ${theme.from}66`
                }}
              >
                Criar Equipe
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
