# Checklist de Cutover Final (m7arena.pro)

1. **Re-sync de Delta**: Executar `node scripts/migrate/extract.js` e `node scripts/migrate/load.js` na VPS `187.127.6.136`.
2. **Apontamento de DNS**: Apontar o registro A de `m7arena.pro` para `187.127.6.136` no painel da Hostinger.
3. **Certificado TLS**: Certbot/Nginx gerando certificado SSL em `187.127.6.136`.
4. **Fallback Mantido**: O site antigo (`m7academy.pro`) permanece intacto no Supabase/Vercel sem alterações.
