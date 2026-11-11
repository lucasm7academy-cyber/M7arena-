import path from 'node:path';
import { ts } from './scope.mjs';
import { node, edge, evidence, fileId, slash } from './model.mjs';

export function extractCode(snapshot, nodes, edges, diagnostics) {
  const allowed = new Set(snapshot.files), records = new Map(), projects = [];
  const relative = file => slash(path.relative(snapshot.root, file));
  const key = decl => `${relative(decl.getSourceFile().fileName)}:${decl.getStart()}:${decl.end}`;
  const sourceOf = (sf, decl) => evidence(relative(sf.fileName), snapshot.hashes[relative(sf.fileName)],
    sf.getLineAndCharacterOfPosition(decl.getStart(sf)).line + 1,
    sf.getLineAndCharacterOfPosition(Math.max(decl.getStart(sf), decl.end - 1)).line + 1);
  const report = (code, sf, decl, extra = {}) => diagnostics.push({ code,
    path: relative(sf.fileName), source: sourceOf(sf, decl), resolution: 'unresolved', ...extra });

  for (const area of ['web', 'api']) {
    const names = snapshot.files.filter(p => !p.endsWith('.md') &&
      (area === 'web' ? p.startsWith('web/') : p.startsWith('api/') || p.startsWith('db/')));
    if (!names.length) continue;
    const options = snapshot.projects[area].options;
    const program = ts.createProgram(names.map(p => path.join(snapshot.root, p)), options);
    const checker = program.getTypeChecker();
    const files = names.map(p => program.getSourceFile(path.join(snapshot.root, p))).filter(Boolean);
    projects.push({ program, checker, files, options });
    for (const sf of files) {
      const ordinals = new Map();
      function add(decl, name, nameNode, category, alias = false) {
        const parents = [];
        for (let p = decl.parent; p && p !== sf; p = p.parent) {
          if ((ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isVariableDeclaration(p)) && p.name && ts.isIdentifier(p.name)) parents.unshift(p.name.text);
        }
        const qualified = [...parents, alias ? `${category}.${name}` : name].join('.');
        const ordinal = ordinals.get(qualified) || 0; ordinals.set(qualified, ordinal + 1);
        const rel = relative(sf.fileName), identity = `${rel}#${qualified}${ordinal ? `~${ordinal}` : ''}`;
        const item = node('Symbol', identity, name, rel, sourceOf(sf, decl), 'ast',
          { qualifiedName: qualified, category, aliases: [], declarationKind: ts.SyntaxKind[decl.kind] });
        nodes.push(item); edges.push(edge('CONTAINS', fileId(rel), item.id, item.source));
        records.set(key(decl), { item, decl, nameNode, alias, checker });
      }
      function visit(decl) {
        if ((ts.isFunctionDeclaration(decl) || ts.isClassDeclaration(decl)) && !decl.name && decl.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
          add(decl, 'default', decl, 'default');
        } else if ((ts.isFunctionDeclaration(decl) || ts.isClassDeclaration(decl) || ts.isInterfaceDeclaration(decl) ||
          ts.isTypeAliasDeclaration(decl) || ts.isEnumDeclaration(decl) || ts.isVariableDeclaration(decl) ||
          ts.isMethodDeclaration(decl)) && decl.name && (ts.isIdentifier(decl.name) || ts.isStringLiteral(decl.name))) {
          add(decl, decl.name.text, decl.name, 'declaration');
        } else if (ts.isImportSpecifier(decl) || ts.isNamespaceImport(decl) || ts.isExportSpecifier(decl)) {
          add(decl, decl.name.text, decl.name, ts.isExportSpecifier(decl) ? 'export' : 'import', true);
        } else if (ts.isImportClause(decl) && decl.name) add(decl, decl.name.text, decl.name, 'import', true);
        else if (ts.isExportAssignment(decl) && !ts.isIdentifier(decl.expression)) add(decl, 'default', decl.expression, 'default');
        ts.forEachChild(decl, visit);
      }
      visit(sf);
      for (const error of sf.parseDiagnostics || []) report('PARSE_ERROR', sf, sf, { message: ts.flattenDiagnosticMessageText(error.messageText, ' ') });
    }
  }

  function targetOf(symbol, checker) {
    if (!symbol) return null;
    try {
      if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      for (const decl of symbol?.declarations || []) {
        const rel = relative(decl.getSourceFile().fileName);
        if (!allowed.has(rel)) continue;
        if (ts.isSourceFile(decl)) return fileId(rel);
        const record = records.get(key(decl));
        if (record) return record.item.id;
      }
    } catch { return null; }
    return null;
  }

  for (const record of records.values()) {
    if (!record.alias) continue;
    const symbol = record.checker.getSymbolAtLocation(record.nameNode);
    const target = targetOf(symbol, record.checker);
    if (target && target !== record.item.id) edges.push(edge('ALIASES', record.item.id, target, record.item.source, 'typechecker'));
    else {
      let external = false;
      try {
        const resolved = symbol && (symbol.flags & ts.SymbolFlags.Alias ? record.checker.getAliasedSymbol(symbol) : symbol);
        external = !!resolved?.declarations?.length && resolved.declarations.every(d => !allowed.has(relative(d.getSourceFile().fileName)));
      } catch { /* A origem não resolvida permanece diagnosticada abaixo. */ }
      diagnostics.push({ code: external ? 'ALIAS_EXTERNAL' : 'ALIAS_UNRESOLVED', path: record.item.path,
        symbol: record.item.name, source: record.item.source, resolution: 'unresolved', severity: external ? 'info' : 'warning' });
    }
  }

  for (const { checker, files, options } of projects) for (const sf of files) {
    const rel = relative(sf.fileName);
    const connectImport = (decl, specifier, kinds) => {
      if (/\.(css|scss|svg|png|jpe?g|gif|webp|woff2?|mp3|ogg)(?:\?|$)/i.test(specifier)) {
        report('ASSET_IMPORT_EXCLUDED', sf, decl, { specifier, severity: 'info' });
        return;
      }
      const resolved = ts.resolveModuleName(specifier, sf.fileName, options, ts.sys).resolvedModule;
      const target = resolved && relative(resolved.resolvedFileName);
      if (!target || !allowed.has(target)) {
        report(specifier.startsWith('.') || specifier.startsWith('@/') ? 'IMPORT_UNRESOLVED_OR_OUTSIDE_SCOPE' : 'EXTERNAL_IMPORT', sf, decl,
          { specifier, severity: specifier.startsWith('.') ? 'warning' : 'info' });
        return;
      }
      for (const kind of kinds) edges.push(edge(kind, fileId(rel), fileId(target), sourceOf(sf, decl), 'typechecker', { specifier }));
    };
    function imports(decl) {
      if ((ts.isImportDeclaration(decl) || ts.isExportDeclaration(decl)) && decl.moduleSpecifier && ts.isStringLiteralLike(decl.moduleSpecifier)) {
        const kinds = new Set();
        if (ts.isImportDeclaration(decl)) {
          const clause = decl.importClause;
          if (clause?.isTypeOnly) kinds.add('IMPORTS_TYPE');
          else if (!clause || clause.name || (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))) kinds.add('IMPORTS');
          if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings) && !clause.isTypeOnly) {
            for (const spec of clause.namedBindings.elements) kinds.add(spec.isTypeOnly ? 'IMPORTS_TYPE' : 'IMPORTS');
          }
        } else if (decl.isTypeOnly) kinds.add('IMPORTS_TYPE');
        else if (decl.exportClause && ts.isNamedExports(decl.exportClause)) {
          for (const spec of decl.exportClause.elements) kinds.add(spec.isTypeOnly ? 'IMPORTS_TYPE' : 'IMPORTS');
        } else kinds.add('IMPORTS');
        if (!kinds.size) kinds.add('IMPORTS');
        connectImport(decl, decl.moduleSpecifier.text, kinds);
      }
      if (ts.isCallExpression(decl) && decl.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (decl.arguments[0] && ts.isStringLiteralLike(decl.arguments[0])) connectImport(decl, decl.arguments[0].text, ['IMPORTS_DYNAMIC']);
        else report('DYNAMIC_IMPORT_NON_LITERAL', sf, decl);
      }
      ts.forEachChild(decl, imports);
    }
    imports(sf);

    const module = checker.getSymbolAtLocation(sf);
    if (!module) continue;
    for (const exported of checker.getExportsOfModule(module)) {
      const own = exported.declarations?.find(d => d.getSourceFile() === sf && records.has(key(d)));
      let target = own ? records.get(key(own)).item.id : targetOf(exported, checker);
      if (!target) { report('EXPORT_UNRESOLVED_OR_EXTERNAL', sf, sf, { name: exported.name }); continue; }
      const ownRecord = own && records.get(key(own));
      if (!ownRecord && !target.startsWith(`symbol:${rel}#`)) {
        const declaration = sf.statements.find(d => ts.isExportDeclaration(d)) || sf;
        const alias = node('Symbol', `${rel}#export.${exported.name}`, exported.name, rel,
          sourceOf(sf, declaration), 'typechecker', { qualifiedName: `export.${exported.name}`, category: 'export', aliases: [] });
        nodes.push(alias); edges.push(edge('CONTAINS', fileId(rel), alias.id, alias.source));
        edges.push(edge('ALIASES', alias.id, target, alias.source, 'typechecker'));
        target = alias.id;
      }
      edges.push(edge('EXPORTS', fileId(rel), target, ownRecord?.item.source || sourceOf(sf, sf), 'typechecker', { exportName: exported.name }));
    }
  }
}
