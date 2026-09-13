// Package-owned policy; parse syntax, never comments or string examples.
import { parse } from '@babel/parser';

export function forbiddenWaits(source, filename) {
  const plugins = [];
  if (/\.[cm]?tsx?$/.test(filename)) plugins.push('typescript');
  if (/\.[jt]sx$/.test(filename)) plugins.push('jsx');
  const ast = parse(source, { sourceType: 'unambiguous', plugins });
  const findings = [];
  const sleepNames = new Set();
  const timerNamespaces = new Set();
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration' || !/^(node:)?timers\/promises$/.test(node.source.value)) continue;
    for (const specifier of node.specifiers) {
      if (specifier.imported?.name === 'setTimeout') sleepNames.add(specifier.local.name);
      if (['ImportNamespaceSpecifier', 'ImportDefaultSpecifier'].includes(specifier.type)) timerNamespaces.add(specifier.local.name);
    }
  }
  function report(node, message) { findings.push({ line: node.loc.start.line, column: node.loc.start.column + 1, message }); }

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      const property = callee.computed ? callee.property?.value : callee.property?.name;
      if (sleepNames.has(callee.name) || (timerNamespaces.has(callee.object?.name) && property === 'setTimeout')) {
        report(node, 'Promise timer sleeps are prohibited; wait for observable state or transport completion.');
      }
    }
    if (node.type === 'NewExpression' && node.callee.name === 'Promise') {
      const executor = node.arguments[0];
      const resolveName = executor?.params?.[0]?.name;
      function findTimer(child) {
        if (!child || typeof child !== 'object') return;
        if (child.type === 'CallExpression' && (child.callee.name === 'setTimeout' || child.callee.property?.name === 'setTimeout')) {
          const callback = child.arguments[0];
          if (resolveName && (callback?.name === resolveName ||
              (callback?.body?.type === 'CallExpression' && callback.body.callee.name === resolveName))) {
            report(child, 'Promise timer sleeps are prohibited; wait for observable state or transport completion.');
          }
        }
        for (const value of Object.values(child)) {
          if (Array.isArray(value)) value.forEach(findTimer);
          else if (value && typeof value === 'object') findTimer(value);
        }
      }
      findTimer(executor?.body);
    }
    if (['MemberExpression' , 'OptionalMemberExpression'].includes(node.type)) {
      const name = node.computed ? node.property?.value : node.property?.name;
      if (name === 'waitForTimeout') findings.push({ line: node.loc.start.line, column: node.loc.start.column + 1 });
    }
    if (node.type === 'ObjectPattern') {
      for (const property of node.properties) {
        if ((property.key?.name || property.key?.value) === 'waitForTimeout') {
          findings.push({ line: property.loc.start.line, column: property.loc.start.column + 1 });
        }
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast.program);
  return findings;
}

