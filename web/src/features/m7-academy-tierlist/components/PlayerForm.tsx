import { Phone, UserRound } from "lucide-react";
import { useSound } from "../../../hooks/useSound";
import { ROLE_META } from "../constants";
import { POOL_ROLES, type AvailabilityWindow, type PoolRole } from "../types";
import { maskWhatsapp } from "../utils";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { CutInput, Field } from "./Field";

interface PlayerFormProps {
  fullName: string;
  setFullName: (value: string) => void;
  contact: string;
  setContact: (value: string) => void;
  primaryRole: PoolRole;
  setPrimaryRole: (value: PoolRole) => void;
  availability: AvailabilityWindow[];
  setAvailability: (value: AvailabilityWindow[]) => void;
}

function RoleButton({ role, active, onClick }: { role: PoolRole; active: boolean; onClick: () => void }) {
  const meta = ROLE_META[role];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 border px-2 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
        active
          ? "border-primary bg-primary text-black"
          : "border-white/10 bg-[#0c0d12] text-white/50 hover:border-white/25 hover:text-white"
      }`}
    >
      <img
        src={meta.img}
        alt={meta.label}
        className={`h-4 w-4 object-contain ${active ? "brightness-0" : "opacity-60"}`}
      />
      {meta.short}
    </button>
  );
}

export function PlayerForm({
  fullName,
  setFullName,
  contact,
  setContact,
  primaryRole,
  setPrimaryRole,
  availability,
  setAvailability,
}: PlayerFormProps) {
  const { playSound } = useSound();

  return (
    <section className="border-t border-white/10 pt-6">
      <h2 className="text-sm font-black uppercase tracking-widest text-white">Seus dados</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nome completo" required>
          <CutInput
            leftIcon={<UserRound className="h-4 w-4" />}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            maxLength={150}
          />
        </Field>

        <Field label="WhatsApp" hint="DDD + número" required>
          <CutInput
            leftIcon={<Phone className="h-4 w-4" />}
            type="tel"
            inputMode="numeric"
            value={maskWhatsapp(contact)}
            onChange={(event) => setContact(event.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="(11) 91234-5678"
            autoComplete="tel"
            maxLength={15}
          />
        </Field>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/45">
          Rota principal <span className="text-primary">*</span>
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {POOL_ROLES.map((role) => (
            <RoleButton
              key={role}
              role={role}
              active={primaryRole === role}
              onClick={() => {
                playSound("click");
                setPrimaryRole(role);
              }}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <AvailabilityEditor windows={availability} onChange={setAvailability} />
      </div>
    </section>
  );
}
