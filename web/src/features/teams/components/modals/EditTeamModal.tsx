import React, { useState } from 'react';
import { Check, Copy, MessageSquare, Paintbrush, RefreshCw, Upload, X } from 'lucide-react';
import { useSound } from '../../../../hooks/useSound';
import { api } from '../../../../lib/api';
import { type TimeData } from '../../roster';
import { ModalBase } from './ModalBase';

function validarImagem(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('O arquivo deve ser uma imagem.');
      return;
    }
    // Sem limite de tamanho nem de dimensão: o servidor aceita o arquivo como
    // veio e normaliza a logo para 1080x1080 (pedido do usuário 19/10). Aqui só
    // garantimos que é uma imagem que o navegador consegue abrir.
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    const finish = (msg: string | null) => {
      URL.revokeObjectURL(objectUrl);
      resolve(msg);
    };
    img.onload = () => finish(null);
    // Sem onerror a Promise nunca resolve se a imagem falhar ao carregar
    // (arquivo corrompido, bloqueio de CSP), e o modal trava para sempre.
    img.onerror = () => finish('Não foi possível ler a imagem. Tente outro arquivo.');
    img.src = objectUrl;
  });
}

const COLOR_THEMES = [
  { from: '#FFB700', to: '#FF6600', label: 'Amarelo/Laranja' },
  { from: '#0044FF', to: '#00D4FF', label: 'Azul Escuro' },
  { from: '#FF3300', to: '#FF9900', label: 'Vermelho' },
  { from: '#00FF88', to: '#00C3FF', label: 'Verde Claro' },
  { from: '#7B00FF', to: '#00AAFF', label: 'Roxo' },
  { from: '#FF006E', to: '#FF9966', label: 'Rosa' },
  { from: '#00FF41', to: '#008F11', label: 'Verde' },
  { from: '#F953C6', to: '#B91D73', label: 'Pink' },
  { from: '#1CB5E0', to: '#000851', label: 'Azul Claro' },
  { from: '#FF416C', to: '#FF4B2B', label: 'Vermelho Vivo' },
  { from: '#11998e', to: '#38ef7d', label: 'Menta' },
  { from: '#00D9FF', to: '#0099CC', label: 'Turquesa' },
];

// ── Upload de logo para o disco local (ADR-007) ─────────────────────────────
async function uploadLogoTime(file: File, timeId: string): Promise<string | null> {
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const name = `${timeId}-${Date.now()}.${ext}`;
  const renamed = new File([file], name, { type: file.type });

  try {
    const { url } = await api.upload(renamed, 'team-logos', timeId);
    return `${url}?t=${Date.now()}`;
  } catch (err) {
    console.error('❌ Erro upload logo time:', err);
    return null;
  }
}

interface EditTeamModalProps {
  team: TimeData;
  onClose: () => void;
  onSave: (updated: Partial<TimeData>) => void;
}

export const EditTeamModal = ({
  team, onClose, onSave,
}: EditTeamModalProps) => {
  const { playSound } = useSound();
  const [name, setName] = useState(team.nome);
  const [tag, setTag] = useState(team.tag);
  const [theme, setTheme] = useState({ from: team.gradientFrom, to: team.gradientTo });
  const safeInitialLogo = (team.logoUrl && !String(team.logoUrl).startsWith('blob:')) ? team.logoUrl : '';
  const [logoPreview, setLogoPreview] = useState(safeInitialLogo);
  const [logoUrl, setLogoUrl] = useState(safeInitialLogo);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [whatsapp, setWhatsapp] = useState(team.whatsapp || '');
  const [discord, setDiscord] = useState(team.discord || '');
  const [copiedField, setCopiedField] = useState<'whatsapp' | 'discord' | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError('');
    const err = await validarImagem(file);
    if (err) { setLogoError(err); return; }
    setLogoUploading(true);
    const blobPreview = URL.createObjectURL(file);
    setLogoPreview(blobPreview);
    const url = await uploadLogoTime(file, String(team.id));
    setLogoUploading(false);
    URL.revokeObjectURL(blobPreview);
    if (url) {
      playSound('click');
      setLogoPreview(url);
      setLogoUrl(url);
    } else {
      setLogoError('Falha no upload. Tente novamente.');
      setLogoPreview(logoUrl);
    }
  };

  const handleCopyField = (text: string, field: 'whatsapp' | 'discord') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    playSound('success');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const cleanPhone = (phone: string) => phone.replace(/\D/g, '');

  const handleSave = () => {
    if (logoUploading) return;
    playSound('success');
    onSave({
      nome: name,
      tag: tag.toUpperCase().slice(0, 4),
      gradientFrom: theme.from,
      gradientTo: theme.to,
      logoUrl: (logoUrl && !logoUrl.startsWith('blob:')) ? logoUrl : undefined,
      whatsapp: whatsapp ? cleanPhone(whatsapp) : undefined,
      discord: discord || undefined,
    });
    onClose();
  };

  return (
    <ModalBase onClose={onClose} gradientFrom={theme.from}>
      <div className="space-y-5">
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
                <Paintbrush className="w-5 h-5" style={{ color: theme.from }} />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-white">Editar Time</h2>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Identidade visual e contatos</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white p-1 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-1.5">Nome do Time</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={24}
              className="w-full bg-[#0c0c10] border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-semibold focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          <div>
            <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-1.5">Tag (até 4 letras)</label>
            <input
              value={tag}
              onChange={e => setTag(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4}
              className="w-full bg-[#0c0c10] border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-black tracking-widest focus:outline-none focus:border-white/25 transition-colors"
            />
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
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <div
                  className="flex items-center justify-center gap-2 py-3.5 border rounded-xl transition-all cursor-pointer font-black text-xs uppercase tracking-widest"
                  style={{
                    borderColor: `${theme.from}50`,
                    background: `${theme.from}15`,
                    color: theme.from,
                  }}
                >
                  {logoUploading
                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                    : <Upload className="w-4 h-4" />}
                  <span>{logoUploading ? 'Enviando...' : 'Enviar Logo'}</span>
                </div>
              </label>
            </div>
            <p className="text-white/30 text-[9px] mt-1 font-bold">PNG ou JPEG · máx. 1080×1080px</p>
            {logoError && <p className="text-red-400 text-[10px] mt-1 font-bold">{logoError}</p>}
          </div>

          <div>
            <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-1.5">WhatsApp</label>
            <div className="flex items-center gap-2">
              <input
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                maxLength={20}
                className="flex-1 bg-[#0c0c10] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-semibold focus:outline-none focus:border-white/25 transition-colors"
              />
              {whatsapp && (
                <button
                  onClick={() => handleCopyField(whatsapp, 'whatsapp')}
                  className={`p-3 border rounded-xl transition-all cursor-pointer ${
                    copiedField === 'whatsapp'
                      ? 'bg-green-500/20 border-green-500/40 text-green-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/50'
                  }`}
                  title="Copiar WhatsApp"
                >
                  {copiedField === 'whatsapp' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 mb-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#5865F2]" /> Discord
            </label>
            <div className="flex items-center gap-2">
              <input
                value={discord}
                onChange={e => setDiscord(e.target.value)}
                placeholder="usuario#0000"
                maxLength={37}
                className="flex-1 bg-[#0c0c10] border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-semibold focus:outline-none focus:border-white/25 transition-colors"
              />
              {discord && (
                <button
                  onClick={() => handleCopyField(discord, 'discord')}
                  className={`p-3 border rounded-xl transition-all cursor-pointer ${
                    copiedField === 'discord'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/50'
                  }`}
                  title="Copiar Discord"
                >
                  {copiedField === 'discord' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block mb-1.5">Cor</label>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_THEMES.map(t => (
                <button
                  key={t.label}
                  onClick={() => setTheme({ from: t.from, to: t.to })}
                  className={`relative h-8 rounded-lg transition-all cursor-pointer flex items-center justify-center p-[1px] ${
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

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-white/60 text-xs font-black uppercase tracking-wider hover:bg-white/10 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              style={{
                backgroundColor: theme.from,
                boxShadow: `0 0 25px -5px ${theme.from}66`
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
};
