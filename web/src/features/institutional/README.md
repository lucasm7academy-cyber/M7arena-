# Páginas institucionais e tutorial

| Página | Rota pública | Responsabilidade |
|---|---|---|
| [QuemSomos](pages/QuemSomos.tsx) | `/quem-somos` | Apresentação institucional, conteúdo e links de comunidade. |
| [Politicas](pages/Politicas.tsx) | `/politicas` | Exibição dos termos e políticas do produto. |
| [Tutorial](pages/Tutorial.tsx) | `/tutorial` | Orientações de uso, navegação e apresentação do vínculo Riot. |

As três são lazy no [App](../../App.tsx), dentro do layout público. QuemSomos e
Politicas apresentam conteúdo local; não são um CMS. Tutorial também usa
AuthContext, SDK `profiles.getRiot` e apresentação da conta quando disponível.
Aceitar termos é uma operação autenticada da API de Identidade, não a simples
visita a Politicas. Não implementar autorização ou regras financeiras nessas telas.

Textos/links legais e de comunidade são conteúdo público. Alterações de regra
devem refletir o contrato do domínio correspondente; este README não substitui
o texto apresentado ao usuário. Preserve o visual e a navegação existentes.

Não há teste DOM específico dessas páginas. Para mudança de caminhos, lint/build
e conferência das rotas são proporcionais; build não homologa layout ou links externos.
