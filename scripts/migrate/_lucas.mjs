import fs from "fs";

const times = JSON.parse(fs.readFileSync("dump/times.json", "utf8"));
const membros = JSON.parse(fs.readFileSync("dump/time_membros.json", "utf8"));
const LUCAS = "59180f6a-5d93-4452-966b-afc420f804d0";

const owned = times.filter((x) => x.dono_id === LUCAS).map((x) => x.nome);
const asMember = membros
  .filter((x) => x.user_id === LUCAS)
  .map((x) => {
    const t = times.find((tm) => tm.id === x.time_id);
    return `${t?.nome} (${x.is_capitao ? "capitao" : "membro"})`;
  });
console.log("lucas dono de:", owned.join(", ") || "nenhum time");
console.log("lucas membro de:", asMember.join(", ") || "nenhum");
