<script lang="ts">
  import {
    analyzeThemeSvelteSource,
    type ThemeSvelteAnalysis,
    type ThemeSvelteDiagnostic,
  } from '$lib/themeSvelte';
  import {
    THEME_SVELTE_COMPONENT_PLACEHOLDER,
    THEME_SVELTE_COMPONENT_SKELETON,
  } from '$lib/themeSvelteSnippets';
  import { Component, CircleAlert, Maximize2, Minimize2, X } from '@lucide/svelte';
  import type * as Monaco from 'monaco-editor';
  import { onMount } from 'svelte';

  type MonacoApi = typeof import('monaco-editor');

  let {
    value = '',
    onchange,
    variables = [],
    height = 320,
  }: {
    value?: string;
    onchange?: (value: string) => void;
    variables?: string[];
    height?: number;
  } = $props();

  const LANGUAGE_ID = 'ezpp-theme-svelte';
  const THEME_ID = 'ezpp-theme-svelte-dark';
  const MARKER_OWNER = 'ezpp-theme-svelte';
  // Keep these split so the Svelte parser cannot mistake a string literal for
  // the end of this component's own script block.
  const SCRIPT_OPEN = '<scr' + 'ipt>';
  const SCRIPT_CLOSE = '</scr' + 'ipt>';
  const STYLE_OPEN = '<sty' + 'le>';
  const STYLE_CLOSE = '</sty' + 'le>';

  const propDocs: { label: string; documentation: string; insert: string }[] = [
    {
      label: '$props',
      insert:
        'let { variables = {}, layer = {}, theme = {}, asset = (path) => path, screen = "home" } = $props();',
      documentation:
        'Receive live theme props: `variables`, `layer`, `theme`, `screen` and the `asset(path)` helper.',
    },
    {
      label: 'variables',
      insert: 'variables.${1:name}',
      documentation: 'Live rule variables. They update when a Logic rule changes a variable.',
    },
    {
      label: 'layer',
      insert: 'layer.${1:width}',
      documentation:
        'The layer bounds: `layer.id`, `layer.name`, `layer.width` and `layer.height`.',
    },
    {
      label: 'theme',
      insert: 'theme.${1:name}',
      documentation: 'Theme metadata: `theme.name`, `theme.author` and `theme.accentColor`.',
    },
    {
      label: 'asset',
      insert: 'asset("${1:image.png}")',
      documentation:
        'Resolve a file inside the theme `assets/` folder. Works in the launcher and editor preview.',
    },
    {
      label: 'screen',
      insert: 'screen',
      documentation: 'The current launcher screen. Custom layers only render on Home today.',
    },
    {
      label: '$state',
      insert: 'let ${1:value} = $state(${2:0});',
      documentation: 'Create reactive component state.',
    },
    {
      label: '$derived',
      insert: 'const ${1:value} = $derived(${2:expression});',
      documentation: 'Create a value derived from other reactive state.',
    },
    {
      label: '$effect',
      insert: '$effect(() => {\n\t$0\n});',
      documentation: 'Run a side effect when reactive values change.',
    },
    {
      label: 'onMount',
      insert: 'import { onMount } from "svelte";\n\nonMount(() => {\n\t$0\n});',
      documentation: 'Run code after the component mounts. Import it from `svelte`.',
    },
    {
      label: 'onDestroy',
      insert: 'import { onDestroy } from "svelte";\n\nonDestroy(() => {\n\t$0\n});',
      documentation: 'Clean up timers, listeners and observers before the layer unmounts.',
    },
    {
      label: 'tick',
      insert: 'import { tick } from "svelte";\n\nawait tick();',
      documentation: 'Wait for pending DOM updates.',
    },
    {
      label: 'import transition',
      insert: 'import { ${1:fade} } from "svelte/transition";',
      documentation:
        'Import transitions such as `fade`, `fly`, `slide`, `scale`, `blur` and `draw` from `svelte/transition`.',
    },
    {
      label: 'import store',
      insert: 'import { ${1:writable} } from "svelte/store";',
      documentation: 'Svelte stores are available from `svelte/store`.',
    },
    {
      label: 'SvelteMap',
      insert: 'import { SvelteMap } from "svelte/reactivity";\n\nlet ${1:items} = new SvelteMap();',
      documentation: 'Reactive Map from `svelte/reactivity`.',
    },
    {
      label: 'SvelteSet',
      insert: 'import { SvelteSet } from "svelte/reactivity";\n\nlet ${1:items} = new SvelteSet();',
      documentation: 'Reactive Set from `svelte/reactivity`.',
    },
    {
      label: '{#if}',
      insert: '{#if ${1:condition}}\n\t$0\n{/if}',
      documentation: 'Conditionally render markup.',
    },
    {
      label: '{#each}',
      insert: '{#each ${1:items} as ${2:item}}\n\t$0\n{/each}',
      documentation: 'Render a list. Add `(${3:item.id})` for a keyed each block.',
    },
    {
      label: '{#snippet}',
      insert: '{#snippet ${1:name}(${2:argument})}\n\t$0\n{/snippet}',
      documentation: 'Declare a reusable snippet and render it with `{@render name(argument)}`.',
    },
    {
      label: '{@render}',
      insert: '{@render ${1:name}(${2:argument})}',
      documentation: 'Render a snippet declared in this component.',
    },
    {
      label: SCRIPT_OPEN,
      insert: `${SCRIPT_OPEN}\n\t$0\n${SCRIPT_CLOSE}`,
      documentation: 'Plain JavaScript only. TypeScript is not preprocessed in theme layers.',
    },
    {
      label: STYLE_OPEN,
      insert: `${STYLE_OPEN}\n\t$0\n${STYLE_CLOSE}`,
      documentation: 'Scoped CSS for this component.',
    },
  ];

  let host = $state<HTMLDivElement>();
  let monaco: MonacoApi | undefined;
  let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
  let model: Monaco.editor.ITextModel | undefined;
  let ready = $state(false);
  let loadError = $state('');
  let expanded = $state(false);
  let lineCount = $state(1);
  let cursorLine = $state(1);
  let cursorColumn = $state(1);
  let errorCount = $state(0);
  let warningCount = $state(0);
  let checking = $state(false);
  let diagnostics = $state<ThemeSvelteDiagnostic[]>([]);
  let currentValue = '';
  let validateTimer: ReturnType<typeof setTimeout> | undefined;
  let validationToken = 0;

  const ensureLanguage = (api: MonacoApi) => {
    if (!api.languages.getLanguages().some((language) => language.id === LANGUAGE_ID)) {
      api.languages.register({ id: LANGUAGE_ID });
    }

    api.languages.setLanguageConfiguration(LANGUAGE_ID, {
      comments: { blockComment: ['<!--', '-->'] },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '`', close: '`' },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
        { open: '`', close: '`' },
      ],
      indentationRules: {
        increaseIndentPattern: /<[^/!][^>]*>\s*$|\{[#:@][^}]*$/,
        decreaseIndentPattern: /^\s*<\/|\{\/|\{:else/,
      },
    });

    api.languages.setMonarchTokensProvider(LANGUAGE_ID, {
      tokenizer: {
        root: [
          [/<!--/, { token: 'comment', next: '@comment' }],
          [/<scr(?:ipt)\b[^>]*>/, { token: 'tag', next: '@script' }],
          [/<sty(?:le)\b[^>]*>/, { token: 'tag', next: '@style' }],
          [/<\/?[\w:-]+/, 'tag'],
          [/[a-zA-Z_][\w-]*(?=\s*=)/, 'attribute.name'],
          [/"[^"]*"|'[^']*'/, 'string'],
          [/\{[#:/@][^}]*\}/, 'keyword'],
          [/\{[^}]*\}/, 'expression'],
          [/[<>/=]/, 'delimiter'],
          [/[^<{]+/, 'text'],
          [/[<{]/, 'delimiter'],
        ],
        comment: [
          [/[^-]+/, 'comment'],
          [/-->/, { token: 'comment', next: '@pop' }],
          [/./, 'comment'],
        ],
        script: [
          [/<\/script\s*>/, { token: 'tag', next: '@pop' }],
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@blockComment'],
          [
            /\b(?:import|from|let|const|var|if|else|for|while|return|function|async|await|new|typeof|export|class|extends|try|catch|finally|throw|break|continue|switch|case|default|of|in)\b/,
            'keyword',
          ],
          [/\$(?:state|derived|effect|props|bindable|inspect)(?:\.\w+)?/, 'predefined'],
          [
            /\b(?:onMount|onDestroy|tick|mount|unmount|fade|fly|slide|scale|blur|draw|writable|readable|derived|SvelteMap|SvelteSet|Math|Number|String|Boolean|JSON)\b/,
            'predefined',
          ],
          [/\b\d+(?:\.\d+)?\b/, 'number'],
          [/[A-Za-z_$][\w$]*/, 'identifier'],
          [/===|!==|=>|==|!=|<=|>=|&&|\|\||\+\+|--|[=!<>+\-*/%?:]/, 'operator'],
          [/[{}()[\].,;]/, 'delimiter'],
          [/[^}\s]/, 'text'],
        ],
        blockComment: [
          [/[^*/]+/, 'comment'],
          [/\*\//, { token: 'comment', next: '@pop' }],
          [/[*/]/, 'comment'],
        ],
        style: [
          [/<\/style\s*>/, { token: 'tag', next: '@pop' }],
          [/\/\*/, 'comment', '@blockComment'],
          [/[.#][\w-]+/, 'attribute.name'],
          [
            /\b(?:var|calc|rgb|rgba|linear-gradient|radial-gradient|url|blur|clamp|min|max)\b/,
            'predefined',
          ],
          [/[a-zA-Z-]+(?=\s*:)/, 'type'],
          [/#[0-9a-fA-F]{3,8}\b/, 'number.hex'],
          [/\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|deg|s|ms)?\b/, 'number'],
          [/"[^"]*"|'[^']*'/, 'string'],
          [/[{}();:,]/, 'delimiter'],
          [/[^}\s]/, 'text'],
        ],
      },
    });

    api.editor.defineTheme(THEME_ID, {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
        { token: 'predefined', foreground: '8be9fd' },
        { token: 'tag', foreground: 'ff79c6' },
        { token: 'attribute.name', foreground: '50fa7b' },
        { token: 'identifier', foreground: 'f8f8f2' },
        { token: 'expression', foreground: 'f8f8f2' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'number.hex', foreground: 'bd93f9' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'operator', foreground: 'ff79c6' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'text', foreground: 'f8f8f2' },
        { token: 'delimiter', foreground: 'a1a1aa' },
      ],
      colors: {
        'editor.background': '#08080c',
        'editor.foreground': '#f4f4f5',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': '#e4e4e7',
        'editor.lineHighlightBackground': '#ffffff08',
        'editor.selectionBackground': '#ff006e33',
        'editor.inactiveSelectionBackground': '#ff006e22',
        'editorCursor.foreground': '#ff006e',
        'editorIndentGuide.background1': '#27272a',
        'editorIndentGuide.activeBackground1': '#52525b',
        'editorBracketHighlight.foreground1': '#ff79c6',
        'editorBracketHighlight.foreground2': '#8be9fd',
        'editorBracketHighlight.foreground3': '#f1fa8c',
        'editorGutter.background': '#08080c',
        'editorWidget.background': '#121218',
        'editorWidget.border': '#3f3f46',
        'editorSuggestWidget.background': '#121218',
        'editorSuggestWidget.border': '#3f3f46',
        'editorSuggestWidget.selectedBackground': '#ff006e26',
        'editorSuggestWidget.highlightForeground': '#ff79c6',
        'editorHoverWidget.background': '#121218',
        'editorHoverWidget.border': '#3f3f46',
        'editorError.foreground': '#f87171',
        'editorWarning.foreground': '#fbbf24',
        'editorOverviewRuler.errorForeground': '#f87171',
        'editorOverviewRuler.warningForeground': '#fbbf24',
        'scrollbarSlider.background': '#52525b55',
        'scrollbarSlider.hoverBackground': '#71717a88',
        'scrollbarSlider.activeBackground': '#a1a1aa99',
      },
    });
  };

  const completionRange = (
    api: MonacoApi,
    currentModel: Monaco.editor.ITextModel,
    position: Monaco.Position
  ) => {
    const word = currentModel.getWordUntilPosition(position);
    return new api.Range(
      position.lineNumber,
      word.startColumn,
      position.lineNumber,
      word.endColumn
    );
  };

  const completionPrefixes = ['variables.', 'layer.', 'theme.'];

  // When the user has already typed `variables.`, Monaco replaces only the
  // word after the dot. Strip the prefix from the insertion so the completion
  // does not produce `variables.variables.score`.
  const stripTypedPrefix = (
    insertText: string,
    currentModel: Monaco.editor.ITextModel,
    range: Monaco.Range
  ) => {
    const typed = currentModel
      .getLineContent(range.startLineNumber)
      .slice(0, range.startColumn - 1);
    for (const prefix of completionPrefixes) {
      if (typed.endsWith(prefix) && insertText.startsWith(prefix)) {
        return insertText.slice(prefix.length);
      }
    }
    return insertText;
  };

  const registerIntellisense = (api: MonacoApi) => {
    const completion = api.languages.registerCompletionItemProvider(LANGUAGE_ID, {
      triggerCharacters: ['.', '{', '#', '"', "'", ':', '<'],
      provideCompletionItems(currentModel, position) {
        const range = completionRange(api, currentModel, position);
        const suggestions: Monaco.languages.CompletionItem[] = [];

        for (const entry of propDocs) {
          suggestions.push({
            label: entry.label,
            kind:
              entry.label.charCodeAt(0) === 36 || entry.label.startsWith('{')
                ? api.languages.CompletionItemKind.Keyword
                : entry.label.startsWith('import')
                  ? api.languages.CompletionItemKind.Module
                  : api.languages.CompletionItemKind.Property,
            insertText: stripTypedPrefix(entry.insert, currentModel, range),
            insertTextRules: api.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            documentation: entry.documentation,
            sortText: `1_${entry.label}`,
          });
        }

        suggestions.push({
          label: 'Svelte component skeleton',
          kind: api.languages.CompletionItemKind.Snippet,
          insertText: THEME_SVELTE_COMPONENT_SKELETON,
          insertTextRules: api.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          documentation: 'A ready-to-edit layer with props, markup and scoped styles.',
          sortText: '0_skeleton',
        });

        for (const variable of variables) {
          suggestions.push({
            label: `variables.${variable}`,
            kind: api.languages.CompletionItemKind.Variable,
            insertText: stripTypedPrefix(`variables.${variable}`, currentModel, range),
            range,
            documentation: `Live rule variable \`${variable}\`. Change it from a Logic rule.`,
            sortText: `0_${variable}`,
          });
        }

        return { suggestions, incomplete: false };
      },
    });

    const hover = api.languages.registerHoverProvider(LANGUAGE_ID, {
      provideHover(currentModel, position) {
        const word = currentModel.getWordAtPosition(position);
        if (!word) return null;
        const entry = propDocs.find(
          (candidate) => candidate.label === word.word || candidate.label === `${word.word}`
        );
        if (!entry) return null;
        return {
          range: new api.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
          contents: [{ value: `**${entry.label}**\n\n${entry.documentation}` }],
        };
      },
    });

    return () => {
      completion.dispose();
      hover.dispose();
    };
  };

  const syncDiagnostics = (analysis: ThemeSvelteAnalysis) => {
    if (!monaco || !model) return;
    const all: ThemeSvelteDiagnostic[] = analysis.ok
      ? analysis.warnings
      : [...analysis.errors, ...analysis.warnings];
    const markers: Monaco.editor.IMarkerData[] = all.map((diagnostic) => {
      const lineNumber = Math.min(Math.max(1, diagnostic.line), model!.getLineCount());
      const maxColumn = model!.getLineMaxColumn(lineNumber);
      const startColumn = Math.min(Math.max(1, diagnostic.column), maxColumn);
      const endLine = Math.min(
        Math.max(lineNumber, diagnostic.endLine ?? lineNumber),
        model!.getLineCount()
      );
      const endMaxColumn = model!.getLineMaxColumn(endLine);
      const endColumn = Math.min(
        Math.max(startColumn, diagnostic.endColumn ?? startColumn + 1),
        endMaxColumn
      );
      return {
        severity:
          diagnostic.severity === 'error'
            ? monaco!.MarkerSeverity.Error
            : monaco!.MarkerSeverity.Warning,
        message: diagnostic.message,
        source: 'EZPP Svelte layer',
        startLineNumber: lineNumber,
        startColumn,
        endLineNumber: endLine,
        endColumn: Math.max(startColumn + 1, endColumn),
      };
    });
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
    errorCount = all.filter((diagnostic) => diagnostic.severity === 'error').length;
    warningCount = all.filter((diagnostic) => diagnostic.severity === 'warning').length;
    diagnostics = all;
  };

  const validate = async (source: string) => {
    const token = ++validationToken;
    checking = true;
    const analysis = await analyzeThemeSvelteSource(source, 'ThemeLayer.svelte');
    if (token !== validationToken) return;
    checking = false;
    syncDiagnostics(analysis);
  };

  const scheduleValidation = (source: string, immediate = false) => {
    if (validateTimer) clearTimeout(validateTimer);
    checking = true;
    validateTimer = setTimeout(
      () => {
        void validate(source);
      },
      immediate ? 0 : 350
    );
  };

  const updateStats = (source: string) => {
    lineCount = Math.max(1, source.split('\n').length);
  };

  $effect(() => {
    const next = value;
    if (!model || !monaco || next === currentValue) return;
    currentValue = next;
    model.setValue(next);
    updateStats(next);
    scheduleValidation(next);
  });

  $effect(() => {
    if (!expanded) return;
    requestAnimationFrame(() => editor?.layout());
  });

  onMount(() => {
    let disposed = false;
    let disposeIntellisense: (() => void) | undefined;

    void (async () => {
      try {
        const { default: EditorWorker } =
          await import('monaco-editor/editor/editor.worker.js?worker');
        if (disposed) return;

        type WorkerHost = typeof globalThis & {
          MonacoEnvironment?: { getWorker: () => Worker };
        };
        (globalThis as WorkerHost).MonacoEnvironment ??= {
          getWorker: () => new EditorWorker(),
        };

        const api = await import('monaco-editor');
        if (disposed) return;

        monaco = api;
        ensureLanguage(api);
        if (!host) return;

        currentValue = value;
        updateStats(currentValue);
        model = api.editor.createModel(currentValue, LANGUAGE_ID);
        editor = api.editor.create(host, {
          model,
          theme: THEME_ID,
          ariaLabel: 'Custom Svelte component source',
          automaticLayout: true,
          fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", monospace',
          fontSize: 11,
          lineHeight: 18,
          fontLigatures: true,
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          glyphMargin: true,
          folding: true,
          minimap: { enabled: false },
          wordWrap: 'on',
          wrappingIndent: 'indent',
          tabSize: 2,
          insertSpaces: true,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 8, bottom: 8 },
          renderLineHighlight: 'line',
          fixedOverflowWidgets: true,
          quickSuggestions: { other: true, comments: false, strings: true },
          suggestOnTriggerCharacters: true,
          suggest: { showWords: false, preview: true },
          wordBasedSuggestions: 'off',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        });

        editor.onDidChangeModelContent(() => {
          const next = model?.getValue() ?? '';
          currentValue = next;
          updateStats(next);
          scheduleValidation(next);
          onchange?.(next);
        });
        editor.onDidChangeCursorPosition((event) => {
          cursorLine = event.position.lineNumber;
          cursorColumn = event.position.column;
        });

        disposeIntellisense = registerIntellisense(api);
        ready = true;
        scheduleValidation(currentValue, true);
        editor.focus();
      } catch (error) {
        console.error('Could not load the Monaco Svelte editor', error);
        loadError = error instanceof Error ? error.message : String(error);
        scheduleValidation(value, true);
      }
    })();

    return () => {
      disposed = true;
      if (validateTimer) clearTimeout(validateTimer);
      disposeIntellisense?.();
      editor?.dispose();
      model?.dispose();
      editor = undefined;
      model = undefined;
      monaco = undefined;
    };
  });

  function toggleExpanded() {
    expanded = !expanded;
    requestAnimationFrame(() => {
      editor?.layout();
      editor?.focus();
    });
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      expanded = false;
    }
  }}
/>

{#if expanded}
  <button
    type="button"
    class="fixed inset-0 z-[100] cursor-default bg-black/75 backdrop-blur-sm"
    aria-label="Close expanded component editor"
    onclick={() => (expanded = false)}
  ></button>
{/if}

<div
  class="flex flex-col overflow-hidden border border-theme-800 bg-[#08080c] {expanded
    ? 'fixed inset-4 z-[101] rounded-xl shadow-2xl'
    : 'relative rounded-md'}"
  style={expanded ? '' : `height:${height}px`}
>
  <div
    class="flex h-7 shrink-0 items-center gap-1.5 border-b border-theme-800 bg-theme-950/80 px-2"
  >
    <Component class="size-3 shrink-0 text-primary" />
    <span class="text-[9px] font-semibold uppercase tracking-wide text-theme-100">
      Svelte component
    </span>
    <span class="ml-auto flex items-center gap-1.5">
      {#if loadError}
        <span class="text-[8px] text-destructive">Editor unavailable</span>
      {:else if checking}
        <span class="text-[8px] text-muted-foreground">Checking…</span>
      {:else if errorCount > 0}
        <span class="flex items-center gap-0.5 text-[8px] text-destructive">
          <CircleAlert class="size-2.5" />
          {errorCount}
        </span>
      {:else}
        <span class="text-[8px] text-emerald-400">Ready</span>
      {/if}
      <button
        type="button"
        class="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-theme-800 hover:text-theme-50"
        title={expanded ? 'Exit fullscreen' : 'Open fullscreen editor'}
        aria-label={expanded ? 'Exit fullscreen editor' : 'Open fullscreen editor'}
        onclick={toggleExpanded}
      >
        {#if expanded}
          <Minimize2 class="size-3" />
        {:else}
          <Maximize2 class="size-3" />
        {/if}
      </button>
      {#if expanded}
        <button
          type="button"
          class="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
          title="Close editor"
          aria-label="Close expanded editor"
          onclick={() => (expanded = false)}
        >
          <X class="size-3" />
        </button>
      {/if}
    </span>
  </div>

  {#if loadError}
    <textarea
      class="min-h-0 flex-1 resize-none border-0 bg-[#08080c] p-2 font-mono text-[11px] leading-relaxed text-theme-50 outline-none"
      spellcheck={false}
      {value}
      placeholder={THEME_SVELTE_COMPONENT_PLACEHOLDER}
      oninput={(event) => {
        const next = (event.currentTarget as HTMLTextAreaElement).value;
        onchange?.(next);
        scheduleValidation(next);
      }}
    ></textarea>
    <p class="border-t border-theme-800 px-2 py-1 text-[8px] text-destructive">
      Monaco could not load: {loadError}
    </p>
  {:else}
    <div class="relative min-h-0 flex-1">
      <div bind:this={host} class="absolute inset-0"></div>
      {#if !ready}
        <div
          class="absolute inset-0 flex items-center justify-center bg-[#08080c] text-[9px] text-muted-foreground"
        >
          Loading editor…
        </div>
      {/if}
    </div>
  {/if}

  {#if diagnostics.length > 0}
    <div class="max-h-24 shrink-0 overflow-y-auto border-t border-theme-800 bg-theme-950/70">
      {#each diagnostics.slice(0, 8) as diagnostic, index (index)}
        <div
          class="flex items-start gap-1.5 border-b border-theme-800/60 px-2 py-1 last:border-b-0"
        >
          <CircleAlert
            class="mt-px size-2.5 shrink-0 {diagnostic.severity === 'error'
              ? 'text-destructive'
              : 'text-amber-300'}"
          />
          <p class="min-w-0 flex-1 text-[8px] leading-relaxed text-theme-100">
            {diagnostic.message}
          </p>
          <button
            type="button"
            class="shrink-0 font-mono text-[8px] text-muted-foreground hover:text-primary"
            title="Jump to this line"
            onclick={() => {
              editor?.setPosition({ lineNumber: diagnostic.line, column: diagnostic.column });
              editor?.revealLineInCenter(diagnostic.line);
              editor?.focus();
            }}
          >
            {diagnostic.line}:{diagnostic.column}
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <div
    class="flex h-5 shrink-0 items-center gap-3 border-t border-theme-800 px-2 text-[8px] text-muted-foreground"
  >
    <span>{lineCount} line{lineCount === 1 ? '' : 's'}</span>
    <span>Ln {cursorLine}, Col {cursorColumn}</span>
    <span class="ml-auto">
      {#if checking}
        Checking…
      {:else if errorCount > 0}
        <span class="text-destructive">{errorCount} error{errorCount === 1 ? '' : 's'}</span>
        {#if warningCount > 0}
          <span class="text-amber-300">
            · {warningCount} warning{warningCount === 1 ? '' : 's'}</span
          >
        {/if}
      {:else if warningCount > 0}
        <span class="text-amber-300">{warningCount} warning{warningCount === 1 ? '' : 's'}</span>
      {:else}
        No errors
      {/if}
    </span>
  </div>
</div>
