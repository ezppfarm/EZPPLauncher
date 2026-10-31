<script lang="ts">
  import { isThemeClockVariable, THEME_CLOCK_VARIABLE_NAMES } from '$lib/themeClock';
  import { parseThemeScript } from '$lib/themeScriptLang';
  import type { ThemeV2Element, ThemeV2Group, ThemeV2ScriptScreen } from '$lib/themeV2';
  import { Braces, CircleAlert, Maximize2, Minimize2, X } from '@lucide/svelte';
  import type * as Monaco from 'monaco-editor';
  import { onMount } from 'svelte';

  type MonacoApi = typeof import('monaco-editor');

  let {
    value = '',
    onchange,
    variables = [],
    elements = [],
    groups = [],
    height = 280,
  }: {
    value?: string;
    onchange?: (value: string) => void;
    variables?: string[];
    elements?: ThemeV2Element[];
    groups?: ThemeV2Group[];
    height?: number;
  } = $props();

  const LANGUAGE_ID = 'ezpp-theme-script';
  const THEME_ID = 'ezpp-theme-script-dark';
  const MARKER_OWNER = 'ezpp-theme-script';

  const screens: ThemeV2ScriptScreen[] = ['home', 'themes', 'settings', 'login'];

  const statementDocs: Record<string, string> = {
    let: 'Declare a theme variable.\n\n`let score = 0;`',
    const: 'Declare a value that will not be reassigned.\n\n`const bonus = 10;`',
    var: 'Declare a theme variable using the older JavaScript keyword.\n\n`var score = 0;`',
    if: 'Run a block only when a condition is true.\n\n`if (score >= 10) { ... }`',
    else: 'Run a block when the `if` condition is false.\n\n`else { ... }`',
    for: 'Run a bounded loop.\n\n`for (let i = 0; i < 3; i++) { ... }`',
    while: 'Run while a condition stays true. Loops stop after 1,000 iterations.',
    true: 'Boolean true.',
    false: 'Boolean false.',
    screen: 'The current launcher screen, such as `"home"` or `"themes"`.',
    Math: 'JavaScript math helpers such as `Math.floor(value)` and `Math.random()`.',
  };

  const actionFunctions: {
    name: string;
    label: string;
    insert: string;
    documentation: string;
  }[] = [
    {
      name: 'showLayer',
      label: 'showLayer(id)',
      insert: 'showLayer(${1:"layer_id"});',
      documentation: 'Make a layer visible.',
    },
    {
      name: 'hideLayer',
      label: 'hideLayer(id)',
      insert: 'hideLayer(${1:"layer_id"});',
      documentation: 'Hide a layer.',
    },
    {
      name: 'toggleLayer',
      label: 'toggleLayer(id)',
      insert: 'toggleLayer(${1:"layer_id"});',
      documentation: 'Flip a layer between visible and hidden.',
    },
    {
      name: 'showGroup',
      label: 'showGroup(id)',
      insert: 'showGroup(${1:"group_id"});',
      documentation: 'Make a group visible.',
    },
    {
      name: 'hideGroup',
      label: 'hideGroup(id)',
      insert: 'hideGroup(${1:"group_id"});',
      documentation: 'Hide a group.',
    },
    {
      name: 'toggleGroup',
      label: 'toggleGroup(id)',
      insert: 'toggleGroup(${1:"group_id"});',
      documentation: 'Flip a group between visible and hidden.',
    },
    {
      name: 'goTo',
      label: 'goTo(screen)',
      insert: 'goTo(${1:"themes"});',
      documentation: 'Navigate to `home`, `themes`, `settings` or `login`.',
    },
    {
      name: 'navigate',
      label: 'navigate(screen)',
      insert: 'navigate(${1:"themes"});',
      documentation: 'Alias for `goTo`.',
    },
    {
      name: 'openUrl',
      label: 'openUrl(url)',
      insert: 'openUrl(${1:"https://example.com"});',
      documentation: 'Open a website after a confirmation dialog. Click triggers only.',
    },
    {
      name: 'launch',
      label: 'launch()',
      insert: 'launch();',
      documentation: 'Start the normal osu! launch flow. Click triggers only.',
    },
    {
      name: 'stop',
      label: 'stop()',
      insert: 'stop();',
      documentation: 'End the current script immediately.',
    },
  ];

  const functions: {
    name: string;
    label: string;
    insert: string;
    documentation: string;
  }[] = [
    {
      name: 'min',
      label: 'min(a, b, ...)',
      insert: 'min(${1:a}, ${2:b})',
      documentation: 'Returns the smallest number.',
    },
    {
      name: 'max',
      label: 'max(a, b, ...)',
      insert: 'max(${1:a}, ${2:b})',
      documentation: 'Returns the largest number.',
    },
    {
      name: 'clamp',
      label: 'clamp(value, min, max)',
      insert: 'clamp(${1:value}, ${2:0}, ${3:100})',
      documentation: 'Keeps a number inside a range.',
    },
    {
      name: 'round',
      label: 'round(value)',
      insert: 'round(${1:value})',
      documentation: 'Rounds to the nearest whole number.',
    },
    {
      name: 'floor',
      label: 'floor(value)',
      insert: 'floor(${1:value})',
      documentation: 'Rounds down.',
    },
    {
      name: 'ceil',
      label: 'ceil(value)',
      insert: 'ceil(${1:value})',
      documentation: 'Rounds up.',
    },
    {
      name: 'abs',
      label: 'abs(value)',
      insert: 'abs(${1:value})',
      documentation: 'Returns the absolute value.',
    },
    {
      name: 'random',
      label: 'random()',
      insert: 'random()',
      documentation: 'Returns a random number between 0 and 1.',
    },
    {
      name: 'chance',
      label: 'chance(percent)',
      insert: 'chance(${1:25})',
      documentation: 'Returns true with the given percentage chance.',
    },
    {
      name: 'visible',
      label: 'visible(layerId)',
      insert: 'visible(${1:"layer_id"})',
      documentation: 'Whether a layer is currently visible.',
    },
    {
      name: 'groupVisible',
      label: 'groupVisible(groupId)',
      insert: 'groupVisible(${1:"group_id"})',
      documentation: 'Whether a group is currently visible.',
    },
    {
      name: 'contains',
      label: 'contains(text, search)',
      insert: 'contains(${1:text}, ${2:"search"})',
      documentation: 'Whether text contains a smaller string.',
    },
    {
      name: 'length',
      label: 'length(text)',
      insert: 'length(${1:text})',
      documentation: 'Returns the number of characters in text.',
    },
    {
      name: 'number',
      label: 'number(value)',
      insert: 'number(${1:value})',
      documentation: 'Converts a value to a number.',
    },
    {
      name: 'string',
      label: 'string(value)',
      insert: 'string(${1:value})',
      documentation: 'Converts a value to text.',
    },
    {
      name: 'boolean',
      label: 'boolean(value)',
      insert: 'boolean(${1:value})',
      documentation: 'Converts a value to true or false.',
    },
  ];

  const snippets: { label: string; insert: string; documentation: string }[] = [
    {
      label: 'let … = …;',
      insert: 'let ${1:name} = ${2:0};',
      documentation: 'Declare a theme variable.',
    },
    {
      label: 'if (…) { … }',
      insert: 'if (${1:condition}) {\n\t$0\n}',
      documentation: 'Run statements when a condition matches.',
    },
    {
      label: 'if (…) { … } else { … }',
      insert: 'if (${1:condition}) {\n\t$0\n} else {\n\t\n}',
      documentation: 'Run one of two blocks.',
    },
    {
      label: 'for (…) { … }',
      insert: 'for (let ${1:i} = 0; ${1:i} < ${2:3}; ${1:i}++) {\n\t$0\n}',
      documentation: 'Run a bounded loop.',
    },
    {
      label: 'while (…) { … }',
      insert: 'while (${1:condition}) {\n\t$0\n}',
      documentation: 'Run while a condition stays true.',
    },
    {
      label: 'clicks += 1;',
      insert: '${1:clicks} += ${2:1};',
      documentation: 'Add to a number variable.',
    },
    {
      label: 'showLayer(…);',
      insert: 'showLayer(${1:"layer_id"});',
      documentation: 'Make a layer visible.',
    },
    {
      label: 'hideLayer(…);',
      insert: 'hideLayer(${1:"layer_id"});',
      documentation: 'Hide a layer.',
    },
    {
      label: 'toggleLayer(…);',
      insert: 'toggleLayer(${1:"layer_id"});',
      documentation: 'Flip a layer between visible and hidden.',
    },
    {
      label: 'goTo(…);',
      insert: 'goTo(${1:"themes"});',
      documentation: 'Navigate to another launcher screen.',
    },
    {
      label: 'openUrl(…);',
      insert: 'openUrl(${1:"https://example.com"});',
      documentation: 'Open a website after a confirmation dialog.',
    },
  ];

  let host = $state<HTMLDivElement | undefined>(undefined);
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
  let currentValue = '';

  const ensureLanguage = (api: MonacoApi) => {
    if (!api.languages.getLanguages().some((language) => language.id === LANGUAGE_ID)) {
      api.languages.register({ id: LANGUAGE_ID });
    }

    api.languages.setLanguageConfiguration(LANGUAGE_ID, {
      comments: { lineComment: '//', blockComment: ['/*', '*/'] },
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
        increaseIndentPattern: /\{[^}"']*$/,
        decreaseIndentPattern: /^\s*\}/,
      },
    });
    api.languages.setMonarchTokensProvider(LANGUAGE_ID, {
      tokenizer: {
        root: [
          [/\s+/, 'white'],
          [/\/\/.*$/, 'comment'],
          [/\/\*/, { token: 'comment', next: '@comment' }],
          [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
          [/'/, { token: 'string.quote', bracket: '@open', next: '@singleString' }],
          [/`/, { token: 'string.quote', bracket: '@open', next: '@templateString' }],
          [
            /\b(?:let|const|var|if|else|for|while|do|function|return|break|continue|switch|case|default|new|delete|typeof|instanceof|in|of|class|try|catch|finally|throw|this)\b/,
            'keyword',
          ],
          [/\b(?:true|false|null|undefined)\b/, 'keyword'],
          [
            /\b(?:min|max|clamp|round|floor|ceil|abs|random|chance|visible|groupVisible|contains|length|number|string|boolean|Number|String|Boolean|showLayer|hideLayer|toggleLayer|showGroup|hideGroup|toggleGroup|goTo|navigate|openUrl|launch|stop|Math)\b/,
            'predefined',
          ],
          [/\b(?:screen)\b/, 'constant'],
          [/\b\d+(?:\.\d+)?\b/, 'number'],
          [/[A-Za-z_][A-Za-z0-9_]*/, 'identifier'],
          [/===|!==|=>|==|!=|<=|>=|&&|\|\||\+\+|--|\*\*|[=!<>+\-*/%?:]/, 'operator'],
          [/[{}()[\]]/, '@brackets'],
          [/[,;]/, 'delimiter'],
          [/[^\s]/, 'invalid'],
        ],
        string: [
          [/[^"\\]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
        ],
        singleString: [
          [/[^'\\]+/, 'string'],
          [/\\./, 'string.escape'],
          [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
        ],
        templateString: [
          [/[^`\\]+/, 'string'],
          [/\\./, 'string.escape'],
          [/`/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
        ],
        comment: [
          [/[^*/]+/, 'comment'],
          [/\*\//, { token: 'comment', next: '@pop' }],
          [/[*/]/, 'comment'],
        ],
      },
    });

    api.editor.defineTheme(THEME_ID, {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
        { token: 'predefined', foreground: '8be9fd' },
        { token: 'constant', foreground: 'ffb86c' },
        { token: 'identifier', foreground: 'f8f8f2' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'string.escape', foreground: 'ffb86c' },
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'operator', foreground: 'ff79c6' },
        { token: 'invalid', foreground: 'ff5555' },
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
        'editorOverviewRuler.errorForeground': '#f87171',
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

  const insideString = (text: string) => {
    let inside = false;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] !== '"') continue;
      let backslashes = 0;
      for (let check = index - 1; check >= 0 && text[check] === '\\'; check -= 1) {
        backslashes += 1;
      }
      if (backslashes % 2 === 0) inside = !inside;
    }
    return inside;
  };

  const registerIntellisense = (api: MonacoApi) => {
    const completion = api.languages.registerCompletionItemProvider(LANGUAGE_ID, {
      triggerCharacters: ['"', '.'],
      provideCompletionItems(currentModel, position) {
        const range = completionRange(api, currentModel, position);
        const line = currentModel.getLineContent(position.lineNumber);
        const before = line.slice(0, position.column - 1);
        const suggestions: Monaco.languages.CompletionItem[] = [];

        if (insideString(before)) {
          const prefix = before.slice(0, before.lastIndexOf('"')).toLowerCase();
          const wantsScreen = /(?:goTo|navigate)\s*\(\s*$/.test(prefix);
          const wantsGroup = /(?:showGroup|hideGroup|toggleGroup|groupVisible)\s*\(\s*$/.test(
            prefix
          );
          const wantsLayer = /(?:showLayer|hideLayer|toggleLayer|visible)\s*\(\s*$/.test(prefix);

          if (wantsScreen) {
            for (const screen of screens) {
              suggestions.push({
                label: screen,
                kind: api.languages.CompletionItemKind.EnumMember,
                insertText: screen,
                range,
                documentation: `Go to the ${screen} screen.`,
                sortText: `0_${screen}`,
              });
            }
          } else if (wantsGroup) {
            for (const group of groups) {
              suggestions.push({
                label: group.name?.trim() || group.id,
                detail: group.id,
                kind: api.languages.CompletionItemKind.Struct,
                insertText: group.id,
                range,
                documentation: `Group id: \`${group.id}\``,
                sortText: `0_${group.id}`,
              });
            }
          } else if (wantsLayer) {
            for (const element of elements) {
              suggestions.push({
                label: element.name?.trim() || element.id,
                detail: element.id,
                kind: api.languages.CompletionItemKind.Field,
                insertText: element.id,
                range,
                documentation: `${element.type} layer id: \`${element.id}\``,
                sortText: `0_${element.id}`,
              });
            }
          }

          return { suggestions, incomplete: false };
        }

        for (const snippet of snippets) {
          suggestions.push({
            label: snippet.label,
            kind: api.languages.CompletionItemKind.Snippet,
            insertText: snippet.insert,
            insertTextRules: api.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            documentation: snippet.documentation,
            sortText: `0_${snippet.label}`,
          });
        }

        for (const entry of Object.entries(statementDocs)) {
          suggestions.push({
            label: entry[0],
            kind: api.languages.CompletionItemKind.Keyword,
            insertText: entry[0],
            range,
            documentation: entry[1],
            sortText: `1_${entry[0]}`,
          });
        }

        for (const variable of new Set([...THEME_CLOCK_VARIABLE_NAMES, ...variables])) {
          const clock = isThemeClockVariable(variable);
          suggestions.push({
            label: variable,
            kind: api.languages.CompletionItemKind.Variable,
            insertText: variable,
            range,
            documentation: clock
              ? `Built-in clock value, read-only and refreshed every second. Display it in text layers with \`{${variable}}\`.`
              : `Theme variable. Assign it with \`${variable} += 1;\` and display it in text layers with \`{${variable}}\`.`,
            sortText: `${clock ? '1' : '2'}_${variable}`,
          });
        }

        for (const screen of screens) {
          suggestions.push({
            label: `"${screen}"`,
            kind: api.languages.CompletionItemKind.EnumMember,
            insertText: `"${screen}"`,
            range,
            documentation: 'Screen name for `goTo()` and `screen`.',
            sortText: `3_${screen}`,
          });
        }

        for (const entry of actionFunctions) {
          suggestions.push({
            label: entry.label,
            kind: api.languages.CompletionItemKind.Function,
            insertText: entry.insert,
            insertTextRules: api.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            documentation: entry.documentation,
            sortText: `1_${entry.name}`,
          });
        }

        for (const entry of functions) {
          suggestions.push({
            label: entry.label,
            kind: api.languages.CompletionItemKind.Function,
            insertText: entry.insert,
            insertTextRules: api.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            documentation: entry.documentation,
            sortText: `1_${entry.name}`,
          });
        }

        return { suggestions, incomplete: false };
      },
    });

    const hover = api.languages.registerHoverProvider(LANGUAGE_ID, {
      provideHover(currentModel, position) {
        const word = currentModel.getWordAtPosition(position);
        if (!word) return null;

        let contents = statementDocs[word.word];
        let kind = 'Keyword';
        if (!contents) {
          const entry = [...functions, ...actionFunctions].find(
            (candidate) => candidate.name === word.word
          );
          if (entry) {
            contents = `**${entry.label}**\n\n${entry.documentation}`;
            kind = 'Function';
          }
        }
        if (!contents && (isThemeClockVariable(word.word) || variables.includes(word.word))) {
          contents = isThemeClockVariable(word.word)
            ? `**${word.word}** — built-in clock value\n\nRefreshes every second. Use it in text layers as \`{${word.word}}\` or read it directly in logic.`
            : `**${word.word}** — theme variable\n\nUse it in text layers as \`{${word.word}}\`.`;
          kind = 'Variable';
        }
        if (!contents) {
          const element = elements.find((candidate) => candidate.id === word.word);
          if (element) {
            contents = `**${element.name?.trim() || element.type}**\n\nLayer id: \`${element.id}\``;
            kind = 'Layer';
          }
        }
        if (!contents) {
          const group = groups.find((candidate) => candidate.id === word.word);
          if (group) {
            contents = `**${group.name?.trim() || 'Group'}**\n\nGroup id: \`${group.id}\``;
            kind = 'Group';
          }
        }
        if (!contents) return null;

        return {
          range: new api.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          ),
          contents: [{ value: `_${kind}_\n\n${contents}` }],
        };
      },
    });

    return () => {
      completion.dispose();
      hover.dispose();
    };
  };

  const syncDiagnostics = (source: string) => {
    if (!monaco || !model) return;
    const result = parseThemeScript(source);
    const markers: Monaco.editor.IMarkerData[] = result.errors.map((error) => {
      const lineNumber = Math.min(Math.max(1, error.line), model!.getLineCount());
      const maxColumn = model!.getLineMaxColumn(lineNumber);
      const startColumn = Math.min(Math.max(1, error.column), maxColumn);
      return {
        severity: monaco!.MarkerSeverity.Error,
        message: error.message,
        source: 'EZPP theme script',
        startLineNumber: lineNumber,
        startColumn,
        endLineNumber: lineNumber,
        endColumn: Math.min(maxColumn, startColumn + 1),
      };
    });
    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
    errorCount = markers.length;
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
    syncDiagnostics(next);
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
        (globalThis as WorkerHost).MonacoEnvironment = {
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
          ariaLabel: 'Advanced theme rule script',
          automaticLayout: true,
          fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", monospace',
          fontSize: 12,
          lineHeight: 19,
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
          quickSuggestions: { other: true, comments: false, strings: false },
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
          syncDiagnostics(next);
          onchange?.(next);
        });
        editor.onDidChangeCursorPosition((event) => {
          cursorLine = event.position.lineNumber;
          cursorColumn = event.position.column;
        });

        disposeIntellisense = registerIntellisense(api);
        syncDiagnostics(currentValue);
        updateStats(currentValue);
        ready = true;
        editor.focus();
      } catch (error) {
        console.error('Could not load the Monaco script editor', error);
        loadError = error instanceof Error ? error.message : String(error);
      }
    })();

    return () => {
      disposed = true;
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
    aria-label="Close expanded script editor"
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
    <Braces class="size-3 shrink-0 text-primary" />
    <span class="text-[9px] font-semibold uppercase tracking-wide text-theme-100">
      Advanced script
    </span>
    <span class="ml-auto flex items-center gap-1.5">
      {#if loadError}
        <span class="text-[8px] text-destructive">Editor unavailable</span>
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
      placeholder={'score += 1;\nif (score >= 3) {\n  showLayer("secret");\n}'}
      oninput={(event) => {
        const next = (event.currentTarget as HTMLTextAreaElement).value;
        onchange?.(next);
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
    <div
      class="flex h-5 shrink-0 items-center gap-3 border-t border-theme-800 px-2 text-[8px] text-muted-foreground"
    >
      <span>{lineCount} line{lineCount === 1 ? '' : 's'}</span>
      <span>Ln {cursorLine}, Col {cursorColumn}</span>
      <span class="ml-auto">
        {#if errorCount > 0}
          <span class="text-destructive">{errorCount} error{errorCount === 1 ? '' : 's'}</span>
        {:else}
          No errors
        {/if}
      </span>
    </div>
  {/if}
</div>
