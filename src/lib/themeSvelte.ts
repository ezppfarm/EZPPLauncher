/* eslint-disable svelte/no-svelte-internal -- Svelte has no public constructor for components compiled at runtime; theme layers must use the client runtime that `svelte/compiler` emits. */
import { parse as parseAcorn } from 'acorn';
import type {
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ImportDeclaration,
  Literal,
  Node as AcornNode,
  Program,
} from 'acorn';
import type { Component } from 'svelte';
import * as SvelteRuntime from 'svelte';
import * as SvelteAnimate from 'svelte/animate';
import * as SvelteEasing from 'svelte/easing';
import * as SvelteClient from 'svelte/internal/client';
import * as SvelteLegacy from 'svelte/legacy';
import * as SvelteMotion from 'svelte/motion';
import * as SvelteReactivity from 'svelte/reactivity';
import * as SvelteStore from 'svelte/store';
import * as SvelteTransition from 'svelte/transition';

export type ThemeSvelteDiagnostic = {
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: 'error' | 'warning';
  code?: string;
};

export type ThemeSvelteAnalysis =
  | {
      ok: true;
      /** Compiled module rewritten to run through the launcher's runtime map. */
      code: string;
      /** Side-effect runtime flags the component needs before it is mounted. */
      flags?: string[];
      warnings: ThemeSvelteDiagnostic[];
    }
  | {
      ok: false;
      errors: ThemeSvelteDiagnostic[];
      warnings: ThemeSvelteDiagnostic[];
    };

export type ThemeSvelteComponent = Component<Record<string, unknown>>;

export type ThemeSvelteCompileResult = {
  component?: ThemeSvelteComponent;
  errors: ThemeSvelteDiagnostic[];
  warnings: ThemeSvelteDiagnostic[];
};

/** Public Svelte modules a theme component may import. */
const runtimeModules: Record<string, Record<string, unknown>> = {
  svelte: SvelteRuntime as unknown as Record<string, unknown>,
  'svelte/internal/client': SvelteClient as unknown as Record<string, unknown>,
  'svelte/internal/disclose-version': {},
  'svelte/animate': SvelteAnimate as unknown as Record<string, unknown>,
  'svelte/easing': SvelteEasing as unknown as Record<string, unknown>,
  'svelte/legacy': SvelteLegacy as unknown as Record<string, unknown>,
  'svelte/motion': SvelteMotion as unknown as Record<string, unknown>,
  'svelte/reactivity': SvelteReactivity as unknown as Record<string, unknown>,
  'svelte/store': SvelteStore as unknown as Record<string, unknown>,
  'svelte/transition': SvelteTransition as unknown as Record<string, unknown>,
};

const LEGACY_FLAG_MODULE = 'svelte/internal/flags/legacy';
runtimeModules['svelte/internal/flags/async'] = {};
runtimeModules['svelte/internal/flags/legacy'] = {};
runtimeModules['svelte/internal/flags/tracing'] = {};
const SUPPORTED_IMPORTS = [
  'svelte',
  'svelte/animate',
  'svelte/easing',
  'svelte/motion',
  'svelte/reactivity',
  'svelte/store',
  'svelte/transition',
].join(', ');
const MAX_CACHED_PROGRAMS = 24;
const analysisCache = new Map<string, Promise<ThemeSvelteAnalysis>>();

type Replacement = { start: number; end: number; text: string };

const applyReplacements = (code: string, replacements: Replacement[]) => {
  let next = code;
  for (const replacement of [...replacements].sort((a, b) => b.start - a.start)) {
    next = `${next.slice(0, replacement.start)}${replacement.text}${next.slice(replacement.end)}`;
  }
  return next;
};

const nodeValue = (node: AcornNode | null | undefined): Record<string, unknown> | undefined =>
  node ? (node as unknown as Record<string, unknown>) : undefined;

const literalValue = (node: unknown): string | undefined => {
  const value = nodeValue(node as AcornNode | undefined)?.value;
  return typeof value === 'string' ? value : undefined;
};

const scriptStartLine = (source: string) => {
  const index = source.indexOf('<script');
  if (index < 0) return 1;
  return source.slice(0, index).split('\n').length;
};

const unsupportedModuleDiagnostic = (
  source: string,
  moduleName: string
): ThemeSvelteDiagnostic => ({
  message: `Importing "${moduleName}" is not available inside a theme layer. Theme components can import ${SUPPORTED_IMPORTS}.`,
  line: scriptStartLine(source),
  column: 1,
  severity: 'error',
});

const dynamicImportDiagnostic = (source: string): ThemeSvelteDiagnostic => ({
  message:
    'Dynamic import() is not available inside a theme layer. Import from the Svelte runtime at the top of the component instead.',
  line: scriptStartLine(source),
  column: 1,
  severity: 'error',
});

const importMetaDiagnostic = (source: string): ThemeSvelteDiagnostic => ({
  message:
    'import.meta is not available inside a theme layer. Theme components run from a local WebView module, not a bundled file.',
  line: scriptStartLine(source),
  column: 1,
  severity: 'error',
});

const importReplacement = (node: ImportDeclaration): Replacement | undefined => {
  const moduleName = literalValue(node.source);
  if (!moduleName || !runtimeModules[moduleName]) return undefined;
  if (node.specifiers.length === 0) {
    return { start: node.start, end: node.end, text: '' };
  }

  const namespaceLines: string[] = [];
  const defaultLines: string[] = [];
  const namedSpecifiers: string[] = [];

  for (const specifier of node.specifiers) {
    if (specifier.type === 'ImportDefaultSpecifier') {
      defaultLines.push(
        `const ${specifier.local.name} = __themeModules[${JSON.stringify(moduleName)}].default;`
      );
      continue;
    }
    if (specifier.type === 'ImportNamespaceSpecifier') {
      namespaceLines.push(
        `const ${specifier.local.name} = __themeModules[${JSON.stringify(moduleName)}];`
      );
      continue;
    }

    const imported =
      specifier.imported.type === 'Identifier'
        ? specifier.imported.name
        : String((specifier.imported as Literal).value);
    namedSpecifiers.push(
      imported === specifier.local.name
        ? imported
        : `${JSON.stringify(imported)}: ${specifier.local.name}`
    );
  }

  if (namedSpecifiers.length > 0) {
    namespaceLines.push(
      `const { ${namedSpecifiers.join(', ')} } = __themeModules[${JSON.stringify(moduleName)}];`
    );
  }

  return {
    start: node.start,
    end: node.end,
    text: [...namespaceLines, ...defaultLines].join('\n'),
  };
};

/**
 * Re-shape Svelte's ESM output into a function body. The compiler emits only
 * a default export and imports from Svelte's runtime; evaluating that module
 * directly would require a blob URL, which the Tauri CSP intentionally blocks.
 * Keeping the transform deterministic also lets the editor show import errors
 * without mounting anything.
 */
export const rewriteCompiledSvelteModule = (
  compiled: string,
  source = ''
): { code?: string; errors: ThemeSvelteDiagnostic[]; flags?: string[] } => {
  let program: Program;
  try {
    program = parseAcorn(compiled, {
      ecmaVersion: 'latest',
      sourceType: 'module',
    }) as unknown as Program;
  } catch (error) {
    return {
      errors: [
        {
          message: `The compiled Svelte module could not be parsed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          line: 1,
          column: 1,
          severity: 'error',
        },
      ],
    };
  }

  const errors: ThemeSvelteDiagnostic[] = [];
  const replacements: Replacement[] = [];
  const flags: string[] = [];
  let defaultExportName: string | undefined;
  let hasReturnedDefault = false;

  for (const node of program.body) {
    if (node.type === 'ImportDeclaration') {
      const declaration = node as ImportDeclaration;
      const moduleName = literalValue(declaration.source);
      if (!moduleName || !runtimeModules[moduleName]) {
        errors.push(unsupportedModuleDiagnostic(source, moduleName ?? 'unknown module'));
        continue;
      }
      if (moduleName === LEGACY_FLAG_MODULE && flags.length === 0) {
        flags.push(LEGACY_FLAG_MODULE);
      }
      const replacement = importReplacement(declaration);
      if (replacement) replacements.push(replacement);
      continue;
    }

    if (node.type === 'ExportDefaultDeclaration') {
      const declaration = node as ExportDefaultDeclaration;
      const exported = declaration.declaration;
      const exportedNode = nodeValue(exported as AcornNode);
      const exportedName =
        exportedNode?.type === 'FunctionDeclaration' || exportedNode?.type === 'ClassDeclaration'
          ? (nodeValue(exportedNode.id as AcornNode)?.name as string | undefined)
          : undefined;

      if (exportedName) {
        defaultExportName = exportedName;
        replacements.push({ start: declaration.start, end: exported.start, text: '' });
      } else {
        hasReturnedDefault = true;
        replacements.push({ start: declaration.start, end: exported.start, text: 'return ' });
      }
      continue;
    }

    if (node.type === 'ExportNamedDeclaration') {
      const declaration = node as ExportNamedDeclaration;
      if (declaration.source) {
        errors.push({
          message: 'Re-exporting from another module is not available inside a theme layer.',
          line: scriptStartLine(source),
          column: 1,
          severity: 'error',
        });
        continue;
      }
      if (declaration.declaration) {
        replacements.push({
          start: declaration.start,
          end: declaration.declaration.start,
          text: '',
        });
      } else {
        replacements.push({ start: declaration.start, end: declaration.end, text: '' });
      }
    }
  }

  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.type === 'ImportExpression') {
      errors.push(dynamicImportDiagnostic(source));
      return;
    }
    if (record.type === 'MetaProperty') {
      const meta = nodeValue(record.meta as AcornNode);
      if (meta?.name === 'import') {
        errors.push(importMetaDiagnostic(source));
        return;
      }
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === 'start' || key === 'end' || key === 'loc') continue;
      walk(child);
    }
  };
  walk(program);

  if (errors.length > 0) {
    return { errors: dedupeDiagnostics(errors) };
  }
  if (!defaultExportName && !hasReturnedDefault) {
    return {
      errors: [
        {
          message:
            'A custom Svelte layer needs a component. Add markup to the file; Svelte emits the default component automatically.',
          line: scriptStartLine(source),
          column: 1,
          severity: 'error',
        },
      ],
    };
  }

  let code = applyReplacements(compiled, replacements);
  if (defaultExportName) code += `\nreturn ${defaultExportName};`;
  return { code, errors: [], flags };
};

const dedupeDiagnostics = (diagnostics: ThemeSvelteDiagnostic[]) => {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.message}:${diagnostic.line}:${diagnostic.column}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const compilerDiagnostic = (
  value: unknown,
  severity: 'error' | 'warning'
): ThemeSvelteDiagnostic => {
  const error = (value ?? {}) as {
    message?: unknown;
    code?: unknown;
    start?: { line?: number; column?: number };
    end?: { line?: number; column?: number };
  };
  const line = Math.max(1, Number(error.start?.line ?? 1));
  const column = Math.max(1, Number(error.start?.column ?? 0) + 1);
  const endLine = Math.max(line, Number(error.end?.line ?? line));
  const endColumn = Math.max(1, Number(error.end?.column ?? 0) + 1);
  return {
    message: typeof error.message === 'string' ? error.message : String(value),
    line,
    column,
    endLine,
    endColumn,
    severity,
    code: typeof error.code === 'string' ? error.code : undefined,
  };
};

const analyzeUncached = async (source: string, filename: string): Promise<ThemeSvelteAnalysis> => {
  let compiler: typeof import('svelte/compiler');
  try {
    compiler = await import('svelte/compiler');
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          message: `The Svelte compiler could not be loaded: ${
            error instanceof Error ? error.message : String(error)
          }`,
          line: 1,
          column: 1,
          severity: 'error',
        },
      ],
      warnings: [],
    };
  }

  try {
    const result = compiler.compile(source, {
      generate: 'client',
      filename,
      css: 'injected',
      dev: false,
      hmr: false,
      preserveComments: true,
    });
    const warnings = (result.warnings ?? []).map((warning) =>
      compilerDiagnostic(warning, 'warning')
    );
    const rewritten = rewriteCompiledSvelteModule(result.js.code, source);
    if (!rewritten.code) {
      return {
        ok: false,
        errors: dedupeDiagnostics(rewritten.errors),
        warnings,
      };
    }
    return { ok: true, code: rewritten.code, flags: rewritten.flags, warnings };
  } catch (error) {
    return {
      ok: false,
      errors: [compilerDiagnostic(error, 'error')],
      warnings: [],
    };
  }
};

/** Compile/inspect a layer's source. Shared by the editor and the renderer. */
export const analyzeThemeSvelteSource = (
  source: string,
  filename = 'ThemeLayer.svelte'
): Promise<ThemeSvelteAnalysis> => {
  const normalized = source;
  const key = `${filename}\u0000${normalized}`;
  const cached = analysisCache.get(key);
  if (cached) return cached;

  const analysis = analyzeUncached(normalized, filename);
  analysisCache.set(key, analysis);
  if (analysisCache.size > MAX_CACHED_PROGRAMS) {
    const oldest = analysisCache.keys().next().value;
    if (oldest) analysisCache.delete(oldest);
  }
  return analysis;
};

const runtimeErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
};

/** Compile and instantiate the component body, ready for Svelte's mount(). */
export const compileThemeSvelte = async (
  source: string,
  filename = 'ThemeLayer.svelte'
): Promise<ThemeSvelteCompileResult> => {
  const analysis = await analyzeThemeSvelteSource(source, filename);
  if (!analysis.ok) {
    return { errors: analysis.errors, warnings: analysis.warnings };
  }

  try {
    if (analysis.flags?.includes(LEGACY_FLAG_MODULE)) {
      // Svelte enables legacy component semantics through a side-effect module
      // that the compiler emits for imports and `export let` props.
      await import('svelte/internal/flags/legacy');
    }
    const factory = new Function('__themeModules', analysis.code) as (
      modules: Record<string, Record<string, unknown>>
    ) => unknown;
    const component = factory(runtimeModules);
    if (typeof component !== 'function') {
      return {
        errors: [
          {
            message: 'The component did not export a mountable Svelte component.',
            line: 1,
            column: 1,
            severity: 'error',
          },
        ],
        warnings: analysis.warnings,
      };
    }
    return {
      component: component as ThemeSvelteComponent,
      errors: [],
      warnings: analysis.warnings,
    };
  } catch (error) {
    return {
      errors: [
        {
          message: `The component could not be evaluated: ${runtimeErrorMessage(error)}`,
          line: 1,
          column: 1,
          severity: 'error',
        },
      ],
      warnings: analysis.warnings,
    };
  }
};
