import { AdminCriarJogo } from "./AdminCriarJogo";
import { MeusJogosPendentes } from "./MeusJogosPendentes";
import { TodosJogosPendentes } from "./TodosJogosPendentes";
import { ListaCronograma } from "./ListaCronograma";

export const Cronograma = () => {
  return (
    <div className="space-y-6">
      {/* ADMIN ACTION: CREATE GAME (Only admins create matchups, players just propose dates) */}
      <AdminCriarJogo />

      {/* MEUS JOGOS PENDENTES — somente jogos onde o time do usuário participa */}
      <MeusJogosPendentes />

      {/* TODOS OS JOGOS PENDENTES — somente admin, botão Arbitrar */}
      <TodosJogosPendentes />

      <ListaCronograma />
    </div>
  );
};