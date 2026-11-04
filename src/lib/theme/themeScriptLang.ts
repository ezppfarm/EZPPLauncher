import { isThemeClockVariable } from './themeClock';
import type { ThemeV2ScriptScreen, ThemeV2ScriptValue } from './themeV2';
import { parse as parseAcorn } from 'acorn';
import type {
  AssignmentExpression,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ConditionalExpression,
  Expression,
  ExpressionStatement,
  ForStatement,
  Identifier,
  IfStatement,
  Literal,
  LogicalExpression,
  Node as AcornNode,
  ParenthesizedExpression,
  Program as AcornProgram,
  TemplateLiteral,
  UnaryExpression,
  UpdateExpression,
  VariableDeclaration,
  WhileStatement,
} from 'acorn';

export type ThemeScriptDiagnostic = {
  message: string;
  line: number;
  column: number;
};

export type ThemeScriptExpression =
  | { type: 'literal'; value: ThemeV2ScriptValue }
  | { type: 'variable'; name: string }
  | { type: 'unary'; operator: '!' | '-'; operand: ThemeScriptExpression }
  | {
      type: 'binary';
      operator: '||' | '&&' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/' | '%';
      left: ThemeScriptExpression;
      right: ThemeScriptExpression;
    }
  | { type: 'call'; name: string; args: ThemeScriptExpression[] }
  | {
      type: 'conditional';
      test: ThemeScriptExpression;
      consequent: ThemeScriptExpression;
      alternate: ThemeScriptExpression;
    };

export type ThemeScriptStatement =
  | { type: 'set'; name: string; expression: ThemeScriptExpression }
  | { type: 'toggleVariable'; name: string }
  | {
      type: 'visibility';
      target: 'element' | 'group';
      id: string;
      mode: 'show' | 'hide' | 'toggle';
    }
  | { type: 'navigate'; screen: ThemeV2ScriptScreen }
  | { type: 'openUrl'; url: string }
  | { type: 'launch' }
  | { type: 'stop' }
  | {
      type: 'if';
      condition: ThemeScriptExpression;
      then: ThemeScriptStatement[];
      else?: ThemeScriptStatement[];
    }
  | { type: 'repeat'; count: ThemeScriptExpression; body: ThemeScriptStatement[] }
  | {
      type: 'for';
      init: ThemeScriptStatement[];
      test?: ThemeScriptExpression;
      update: ThemeScriptStatement[];
      body: ThemeScriptStatement[];
    }
  | { type: 'while'; test: ThemeScriptExpression; body: ThemeScriptStatement[] };

export type ThemeScriptProgram = ThemeScriptStatement[];

export type ThemeScriptParseResult = {
  program: ThemeScriptProgram;
  errors: ThemeScriptDiagnostic[];
};

export type ThemeScriptExpressionContext = {
  variables: Record<string, ThemeV2ScriptValue>;
  screen: ThemeV2ScriptScreen;
  isVisible: (elementId: string) => boolean;
  isGroupVisible: (groupId: string) => boolean;
  random: () => number;
};

export type ThemeScriptRuntime = ThemeScriptExpressionContext & {
  setElementVisible?: (elementId: string, visible: boolean) => void;
  setGroupVisible?: (groupId: string, visible: boolean) => void;
  navigate?: (screen: ThemeV2ScriptScreen) => void;
  openUrl?: (url: string) => void;
  launch?: () => void;
  /** External actions are only allowed from an explicit click trigger. */
  allowExternal?: boolean;
};

const SCRIPT_SCREENS = ['home', 'themes', 'settings', 'login'] as const;
const MAX_NESTING = 32;
const BLOCKED_VARIABLES = new Set(['__proto__', 'prototype', 'constructor']);
const FUNCTION_ARITY: Record<string, { min: number; max: number }> = {
  min: { min: 1, max: Number.MAX_SAFE_INTEGER },
  max: { min: 1, max: Number.MAX_SAFE_INTEGER },
  clamp: { min: 3, max: 3 },
  round: { min: 1, max: 1 },
  floor: { min: 1, max: 1 },
  ceil: { min: 1, max: 1 },
  abs: { min: 1, max: 1 },
  random: { min: 0, max: 0 },
  chance: { min: 1, max: 1 },
  visible: { min: 1, max: 1 },
  groupVisible: { min: 1, max: 1 },
  contains: { min: 2, max: 2 },
  length: { min: 1, max: 1 },
  number: { min: 1, max: 1 },
  string: { min: 1, max: 1 },
  boolean: { min: 1, max: 1 },
};

class ThemeScriptParseError extends Error {
  line: number;
  column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.line = line;
    this.column = column;
  }
}

const ACTION_FUNCTIONS = new Set([
  'showLayer',
  'hideLayer',
  'toggleLayer',
  'showGroup',
  'hideGroup',
  'toggleGroup',
  'goTo',
  'navigate',
  'openUrl',
  'launch',
  'stop',
]);

const FUNCTION_ALIASES: Record<string, string> = {
  Number: 'number',
  String: 'string',
  Boolean: 'boolean',
  'Math.min': 'min',
  'Math.max': 'max',
  'Math.clamp': 'clamp',
  'Math.round': 'round',
  'Math.floor': 'floor',
  'Math.ceil': 'ceil',
  'Math.abs': 'abs',
  'Math.random': 'random',
};

const BLOCKED_GLOBALS = new Set([
  'document',
  'window',
  'globalThis',
  'global',
  'self',
  'top',
  'parent',
  'frames',
  'process',
  'require',
  'module',
  'exports',
  'eval',
  'Function',
  'AsyncFunction',
  'GeneratorFunction',
  'Reflect',
  'Proxy',
  'WebAssembly',
  'fetch',
  'XMLHttpRequest',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
  'history',
  'Math',
  'undefined',
  'NaN',
  'Infinity',
]);

const acornLocation = (node: AcornNode | undefined) => ({
  line: node?.loc?.start.line ?? 1,
  column: (node?.loc?.start.column ?? 0) + 1,
});

const compileError = (message: string, node?: AcornNode) => {
  const location = acornLocation(node);
  return new ThemeScriptParseError(message, location.line, location.column);
};

class JavaScriptThemeScriptCompiler {
  private depth = 0;

  compileProgram(program: AcornProgram): ThemeScriptProgram {
    return this.compileStatements(program.body);
  }

  private nested<T>(node: AcornNode, compile: () => T): T {
    if (this.depth >= MAX_NESTING) {
      throw compileError(`Scripts can nest at most ${MAX_NESTING} blocks deep.`, node);
    }
    this.depth += 1;
    try {
      return compile();
    } finally {
      this.depth -= 1;
    }
  }

  private compileStatements(nodes: AcornNode[]): ThemeScriptStatement[] {
    return nodes.flatMap((node) => this.compileStatement(node));
  }

  private compileStatement(node: AcornNode): ThemeScriptStatement[] {
    switch (node.type) {
      case 'EmptyStatement':
        return [];
      case 'BlockStatement':
        return this.nested(node, () => this.compileStatements((node as BlockStatement).body));
      case 'VariableDeclaration':
        return this.compileVariableDeclaration(node as VariableDeclaration);
      case 'ExpressionStatement':
        return this.compileExpressionStatement((node as ExpressionStatement).expression);
      case 'IfStatement':
        return this.compileIf(node as IfStatement);
      case 'ForStatement':
        return this.compileFor(node as ForStatement);
      case 'WhileStatement':
        return this.compileWhile(node as WhileStatement);
      case 'ReturnStatement':
        throw compileError('Use stop() instead of return to end a theme script.', node);
      case 'BreakStatement':
      case 'ContinueStatement':
        throw compileError('break and continue are not supported yet.', node);
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        throw compileError('Functions are not supported in theme scripts.', node);
      case 'ForInStatement':
      case 'ForOfStatement':
        throw compileError('Only classic for loops are supported.', node);
      case 'DoWhileStatement':
        throw compileError('do...while is not supported. Use while instead.', node);
      case 'SwitchStatement':
      case 'TryStatement':
      case 'ThrowStatement':
      case 'WithStatement':
      case 'DebuggerStatement':
      case 'LabeledStatement':
        throw compileError(`${node.type} is not supported in theme scripts.`, node);
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportAllDeclaration':
        throw compileError('Imports and exports are not available in theme scripts.', node);
      default:
        throw compileError(`Unsupported JavaScript statement "${node.type}".`, node);
    }
  }

  private compileVariableDeclaration(node: VariableDeclaration): ThemeScriptStatement[] {
    if (node.kind !== 'var' && node.kind !== 'let' && node.kind !== 'const') {
      throw compileError('Only var, let and const declarations are supported.', node);
    }

    return node.declarations.map((declaration) => {
      if (declaration.id.type !== 'Identifier') {
        throw compileError(
          'Destructuring is not supported. Use a simple variable name.',
          declaration.id
        );
      }
      return {
        type: 'set',
        name: this.variableName(declaration.id.name, declaration.id),
        expression: declaration.init
          ? this.compileExpression(declaration.init)
          : { type: 'literal', value: 0 },
      };
    });
  }

  private compileExpressionStatement(expression: Expression): ThemeScriptStatement[] {
    if (expression.type === 'AssignmentExpression') {
      return this.compileAssignment(expression as AssignmentExpression);
    }
    if (expression.type === 'UpdateExpression') {
      return this.compileUpdate(expression as UpdateExpression);
    }
    if (expression.type === 'CallExpression') {
      return [this.compileActionCall(expression as CallExpression)];
    }
    if (expression.type === 'SequenceExpression') {
      return expression.expressions.flatMap((item) => this.compileExpressionStatement(item));
    }
    throw compileError(
      'Only assignments, ++/-- and theme action calls can be used as statements.',
      expression
    );
  }

  private compileAssignment(node: AssignmentExpression): ThemeScriptStatement[] {
    if (node.left.type !== 'Identifier') {
      throw compileError('Only simple variable names can be assigned.', node.left);
    }
    const name = this.variableName(node.left.name, node.left);
    const right = this.compileExpression(node.right);
    switch (node.operator) {
      case '=':
        return [{ type: 'set', name, expression: right }];
      case '+=':
      case '-=':
      case '*=':
      case '/=':
      case '%=':
        return [
          {
            type: 'set',
            name,
            expression: {
              type: 'binary',
              operator: node.operator.slice(0, -1) as '+' | '-' | '*' | '/' | '%',
              left: { type: 'variable', name },
              right,
            },
          },
        ];
      default:
        throw compileError(`Assignment operator "${node.operator}" is not supported.`, node);
    }
  }

  private compileUpdate(node: UpdateExpression): ThemeScriptStatement[] {
    if (node.argument.type !== 'Identifier') {
      throw compileError('Only simple variable names can be incremented.', node.argument);
    }
    return [
      {
        type: 'set',
        name: this.variableName(node.argument.name, node.argument),
        expression: {
          type: 'binary',
          operator: node.operator === '++' ? '+' : '-',
          left: { type: 'variable', name: node.argument.name },
          right: { type: 'literal', value: 1 },
        },
      },
    ];
  }

  private compileIf(node: IfStatement): ThemeScriptStatement[] {
    return this.nested(node, () => {
      const condition = this.compileExpression(node.test);
      const then = this.compileStatement(node.consequent);
      const otherwise = node.alternate ? this.compileStatement(node.alternate) : undefined;
      return [
        {
          type: 'if',
          condition,
          then,
          ...(otherwise ? { else: otherwise } : {}),
        },
      ];
    });
  }

  private compileFor(node: ForStatement): ThemeScriptStatement[] {
    return this.nested(node, () => {
      const init = node.init
        ? node.init.type === 'VariableDeclaration'
          ? this.compileVariableDeclaration(node.init)
          : this.compileExpressionStatement(node.init)
        : [];
      const test = node.test ? this.compileExpression(node.test) : undefined;
      const update = node.update ? this.compileExpressionStatement(node.update) : [];
      return [
        {
          type: 'for',
          init,
          ...(test ? { test } : {}),
          update,
          body: this.compileStatement(node.body),
        },
      ];
    });
  }

  private compileWhile(node: WhileStatement): ThemeScriptStatement[] {
    return this.nested(node, () => [
      {
        type: 'while',
        test: this.compileExpression(node.test),
        body: this.compileStatement(node.body),
      },
    ]);
  }

  private compileExpression(node: AcornNode): ThemeScriptExpression {
    switch (node.type) {
      case 'Literal': {
        const literal = node as Literal & { regex?: unknown; bigint?: unknown };
        if (literal.regex || literal.bigint) {
          throw compileError('Regular expressions and BigInt are not supported.', node);
        }
        if (literal.value === null || literal.value === undefined) {
          throw compileError(
            'null and undefined are not supported. Use 0 or an empty string.',
            node
          );
        }
        if (
          typeof literal.value !== 'string' &&
          typeof literal.value !== 'number' &&
          typeof literal.value !== 'boolean'
        ) {
          throw compileError('Only numbers, strings and booleans are supported.', node);
        }
        return { type: 'literal', value: literal.value };
      }
      case 'Identifier': {
        const name = (node as Identifier).name;
        if (BLOCKED_GLOBALS.has(name)) {
          throw compileError(`The global "${name}" is not available in theme scripts.`, node);
        }
        return { type: 'variable', name };
      }
      case 'TemplateLiteral':
        return this.compileTemplate(node as TemplateLiteral);
      case 'UnaryExpression': {
        const unary = node as UnaryExpression;
        if (unary.operator !== '!' && unary.operator !== '-' && unary.operator !== '+') {
          throw compileError(`Unary operator "${unary.operator}" is not supported.`, node);
        }
        const operand = this.compileExpression(unary.argument);
        return unary.operator === '+'
          ? operand
          : { type: 'unary', operator: unary.operator, operand };
      }
      case 'BinaryExpression': {
        const binary = node as BinaryExpression;
        const operator =
          binary.operator === '===' ? '==' : binary.operator === '!==' ? '!=' : binary.operator;
        if (!['==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/', '%'].includes(operator)) {
          throw compileError(`Operator "${binary.operator}" is not supported.`, node);
        }
        return {
          type: 'binary',
          operator: operator as '==' | '!=' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/' | '%',
          left: this.compileExpression(binary.left as AcornNode),
          right: this.compileExpression(binary.right),
        };
      }
      case 'LogicalExpression': {
        const logical = node as LogicalExpression;
        if (logical.operator !== '&&' && logical.operator !== '||') {
          throw compileError(`Operator "${logical.operator}" is not supported.`, node);
        }
        return {
          type: 'binary',
          operator: logical.operator,
          left: this.compileExpression(logical.left),
          right: this.compileExpression(logical.right),
        };
      }
      case 'ConditionalExpression': {
        const conditional = node as ConditionalExpression;
        return {
          type: 'conditional',
          test: this.compileExpression(conditional.test),
          consequent: this.compileExpression(conditional.consequent),
          alternate: this.compileExpression(conditional.alternate),
        };
      }
      case 'CallExpression':
        return this.compilePureCall(node as CallExpression);
      case 'ParenthesizedExpression':
        return this.compileExpression((node as ParenthesizedExpression).expression);
      case 'AssignmentExpression':
      case 'UpdateExpression':
        throw compileError('Assignments are statements; put them on their own line.', node);
      case 'MemberExpression':
      case 'ChainExpression':
        throw compileError('Only Math.* functions are available inside expressions.', node);
      case 'ThisExpression':
        throw compileError('this is not available in theme scripts.', node);
      case 'ArrayExpression':
      case 'ObjectExpression':
        throw compileError('Arrays and objects are not supported. Use theme variables.', node);
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ClassExpression':
        throw compileError('Functions and classes are not supported in theme scripts.', node);
      default:
        throw compileError(`Unsupported JavaScript expression "${node.type}".`, node);
    }
  }

  private compileTemplate(node: TemplateLiteral): ThemeScriptExpression {
    let result: ThemeScriptExpression = {
      type: 'literal',
      value: node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw ?? '',
    };
    for (let index = 0; index < node.expressions.length; index += 1) {
      result = {
        type: 'binary',
        operator: '+',
        left: result,
        right: this.compileExpression(node.expressions[index]),
      };
      const next = node.quasis[index + 1]?.value.cooked ?? node.quasis[index + 1]?.value.raw ?? '';
      if (next) {
        result = {
          type: 'binary',
          operator: '+',
          left: result,
          right: { type: 'literal', value: next },
        };
      }
    }
    return result;
  }

  private callName(node: CallExpression): string {
    if (node.callee.type === 'Identifier') return node.callee.name;
    if (
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.object.type === 'Identifier' &&
      node.callee.property.type === 'Identifier'
    ) {
      return `${node.callee.object.name}.${node.callee.property.name}`;
    }
    throw compileError('Only direct function calls are supported.', node.callee as AcornNode);
  }

  private compilePureCall(node: CallExpression): ThemeScriptExpression {
    const rawName = this.callName(node);
    if (ACTION_FUNCTIONS.has(rawName)) {
      throw compileError(`${rawName}() is an action and must be its own statement.`, node);
    }
    const name = FUNCTION_ALIASES[rawName] ?? rawName;
    const spec = FUNCTION_ARITY[name];
    if (!spec) throw compileError(`Unknown function "${rawName}".`, node);
    if (node.arguments.some((argument) => argument.type === 'SpreadElement')) {
      throw compileError('Spread arguments are not supported.', node);
    }
    if (node.arguments.length < spec.min || node.arguments.length > spec.max) {
      const expected =
        spec.min === spec.max
          ? `${spec.min}`
          : `${spec.min}–${spec.max === Number.MAX_SAFE_INTEGER ? 'many' : spec.max}`;
      throw compileError(
        `Function "${rawName}" expects ${expected} argument${spec.min === 1 && spec.max === 1 ? '' : 's'}.`,
        node
      );
    }
    return {
      type: 'call',
      name,
      args: node.arguments.map((argument) => this.compileExpression(argument as AcornNode)),
    };
  }

  private compileActionCall(node: CallExpression): ThemeScriptStatement {
    const name = this.callName(node);
    if (!ACTION_FUNCTIONS.has(name)) {
      if (FUNCTION_ARITY[name] || FUNCTION_ALIASES[name]) {
        throw compileError(
          `${name}() is a value function and cannot be used as a statement.`,
          node
        );
      }
      throw compileError(`Unknown action "${name}()".`, node);
    }
    if (node.arguments.some((argument) => argument.type === 'SpreadElement')) {
      throw compileError('Spread arguments are not supported.', node);
    }

    const stringArgument = (label: string): string => {
      const argument = node.arguments[0];
      if (!argument || argument.type !== 'Literal' || typeof argument.value !== 'string') {
        throw compileError(`${name}() expects ${label} as a quoted string.`, argument ?? node);
      }
      return argument.value;
    };
    const requireCount = (count: number) => {
      if (node.arguments.length !== count) {
        throw compileError(`${name}() expects ${count} argument${count === 1 ? '' : 's'}.`, node);
      }
    };
    const idArgument = (label: string) => {
      const value = stringArgument(label).trim();
      if (!value || value.length > 64) {
        throw compileError(`${label} must be between 1 and 64 characters.`, node);
      }
      return value;
    };

    switch (name) {
      case 'showLayer':
      case 'hideLayer':
      case 'toggleLayer': {
        requireCount(1);
        return {
          type: 'visibility',
          target: 'element',
          id: idArgument('a layer id'),
          mode: name === 'showLayer' ? 'show' : name === 'hideLayer' ? 'hide' : 'toggle',
        };
      }
      case 'showGroup':
      case 'hideGroup':
      case 'toggleGroup': {
        requireCount(1);
        return {
          type: 'visibility',
          target: 'group',
          id: idArgument('a group id'),
          mode: name === 'showGroup' ? 'show' : name === 'hideGroup' ? 'hide' : 'toggle',
        };
      }
      case 'goTo':
      case 'navigate': {
        requireCount(1);
        const screen = stringArgument('a screen name');
        if (!SCRIPT_SCREENS.includes(screen as (typeof SCRIPT_SCREENS)[number])) {
          throw compileError(
            `Unknown screen "${screen}". Use home, themes, settings or login.`,
            node
          );
        }
        return { type: 'navigate', screen: screen as ThemeV2ScriptScreen };
      }
      case 'openUrl': {
        requireCount(1);
        const url = stringArgument('a URL');
        if (!/^https?:\/\//i.test(url) || url.length > 2000) {
          throw compileError(
            'URLs must start with http:// or https:// and be at most 2000 characters.',
            node
          );
        }
        return { type: 'openUrl', url };
      }
      case 'launch':
        requireCount(0);
        return { type: 'launch' };
      case 'stop':
        requireCount(0);
        return { type: 'stop' };
      default:
        throw compileError(`Unknown action "${name}()".`, node);
    }
  }

  private variableName(name: string, node: AcornNode): string {
    if (isThemeClockVariable(name)) {
      throw compileError(`"${name}" is a built-in clock value and is read-only.`, node);
    }
    if (BLOCKED_VARIABLES.has(name) || BLOCKED_GLOBALS.has(name)) {
      throw compileError(`"${name}" cannot be used as a theme variable.`, node);
    }
    if (name === 'screen') {
      throw compileError('"screen" is read-only in theme scripts.', node);
    }
    return name;
  }
}

const parseJavaScriptThemeScript = (source: string): ThemeScriptParseResult => {
  let program: AcornProgram;
  try {
    program = parseAcorn(source, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      locations: true,
    }) as AcornProgram;
  } catch (error) {
    const loc = (error as { loc?: { line: number; column: number } }).loc;
    return {
      program: [],
      errors: [
        {
          message: (error instanceof Error
            ? error.message
            : 'Could not parse this JavaScript.'
          ).replace(/\s*\(\d+:\d+\)\s*$/, ''),
          line: loc?.line ?? 1,
          column: (loc?.column ?? 0) + 1,
        },
      ],
    };
  }

  try {
    return { program: new JavaScriptThemeScriptCompiler().compileProgram(program), errors: [] };
  } catch (error) {
    if (error instanceof ThemeScriptParseError) {
      return {
        program: [],
        errors: [{ message: error.message, line: error.line, column: error.column }],
      };
    }
    return {
      program: [],
      errors: [
        {
          message: error instanceof Error ? error.message : 'Could not compile this script.',
          line: 1,
          column: 1,
        },
      ],
    };
  }
};

/** Theme scripts use plain, sandboxed JavaScript syntax. */
export const parseThemeScript = (source: string): ThemeScriptParseResult => {
  if (!source.trim()) return { program: [], errors: [] };
  return parseJavaScriptThemeScript(source);
};

export const formatThemeScriptError = (error: ThemeScriptDiagnostic) =>
  `${error.message} (line ${error.line}, column ${error.column})`;

const numberValue = (value: ThemeV2ScriptValue): number => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

const booleanValue = (value: ThemeV2ScriptValue): boolean => Boolean(value);

const equalValues = (left: ThemeV2ScriptValue, right: ThemeV2ScriptValue) => {
  if (typeof left === 'number' || typeof right === 'number') {
    return numberValue(left) === numberValue(right);
  }
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return booleanValue(left) === booleanValue(right);
  }
  return String(left) === String(right);
};

const compareValues = (left: ThemeV2ScriptValue, right: ThemeV2ScriptValue) => {
  if (typeof left === 'number' || typeof right === 'number') {
    return numberValue(left) - numberValue(right);
  }
  const leftText = String(left);
  const rightText = String(right);
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
};

const callFunction = (
  name: string,
  args: ThemeV2ScriptValue[],
  context: ThemeScriptExpressionContext
): ThemeV2ScriptValue => {
  switch (name) {
    case 'min':
      return Math.min(...args.map(numberValue));
    case 'max':
      return Math.max(...args.map(numberValue));
    case 'clamp': {
      const value = numberValue(args[0]);
      const min = numberValue(args[1]);
      const max = numberValue(args[2]);
      return Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max));
    }
    case 'round':
      return Math.round(numberValue(args[0]));
    case 'floor':
      return Math.floor(numberValue(args[0]));
    case 'ceil':
      return Math.ceil(numberValue(args[0]));
    case 'abs':
      return Math.abs(numberValue(args[0]));
    case 'random':
      return context.random();
    case 'chance':
      return context.random() * 100 < numberValue(args[0]);
    case 'visible':
      return context.isVisible(String(args[0] ?? ''));
    case 'groupVisible':
      return context.isGroupVisible(String(args[0] ?? ''));
    case 'contains':
      return String(args[0] ?? '').includes(String(args[1] ?? ''));
    case 'length':
      return String(args[0] ?? '').length;
    case 'number':
      return numberValue(args[0]);
    case 'string':
      return String(args[0] ?? '');
    case 'boolean':
      return booleanValue(args[0]);
    default:
      return 0;
  }
};

export const evaluateThemeScriptExpression = (
  expression: ThemeScriptExpression,
  context: ThemeScriptExpressionContext
): ThemeV2ScriptValue => {
  switch (expression.type) {
    case 'literal':
      return expression.value;
    case 'variable':
      return expression.name === 'screen'
        ? context.screen
        : (context.variables[expression.name] ?? 0);
    case 'unary': {
      if (expression.operator === '!')
        return !booleanValue(evaluateThemeScriptExpression(expression.operand, context));
      return -numberValue(evaluateThemeScriptExpression(expression.operand, context));
    }
    case 'call':
      return callFunction(
        expression.name,
        expression.args.map((argument) => evaluateThemeScriptExpression(argument, context)),
        context
      );
    case 'conditional':
      return booleanValue(evaluateThemeScriptExpression(expression.test, context))
        ? evaluateThemeScriptExpression(expression.consequent, context)
        : evaluateThemeScriptExpression(expression.alternate, context);
    case 'binary': {
      if (expression.operator === '&&') {
        return (
          booleanValue(evaluateThemeScriptExpression(expression.left, context)) &&
          booleanValue(evaluateThemeScriptExpression(expression.right, context))
        );
      }
      if (expression.operator === '||') {
        return (
          booleanValue(evaluateThemeScriptExpression(expression.left, context)) ||
          booleanValue(evaluateThemeScriptExpression(expression.right, context))
        );
      }

      const left = evaluateThemeScriptExpression(expression.left, context);
      const right = evaluateThemeScriptExpression(expression.right, context);
      switch (expression.operator) {
        case '==':
          return equalValues(left, right);
        case '!=':
          return !equalValues(left, right);
        case '<':
          return compareValues(left, right) < 0;
        case '<=':
          return compareValues(left, right) <= 0;
        case '>':
          return compareValues(left, right) > 0;
        case '>=':
          return compareValues(left, right) >= 0;
        case '+':
          return typeof left === 'string' || typeof right === 'string'
            ? String(left) + String(right)
            : numberValue(left) + numberValue(right);
        case '-':
          return numberValue(left) - numberValue(right);
        case '*':
          return numberValue(left) * numberValue(right);
        case '/': {
          const divisor = numberValue(right);
          return divisor === 0 ? 0 : numberValue(left) / divisor;
        }
        case '%': {
          const divisor = numberValue(right);
          return divisor === 0 ? 0 : numberValue(left) % divisor;
        }
        default:
          return 0;
      }
    }
  }
};

const walkExpression = (
  expression: ThemeScriptExpression,
  visit: (expression: ThemeScriptExpression) => void
) => {
  visit(expression);
  switch (expression.type) {
    case 'unary':
      walkExpression(expression.operand, visit);
      break;
    case 'binary':
      walkExpression(expression.left, visit);
      walkExpression(expression.right, visit);
      break;
    case 'call':
      for (const argument of expression.args) walkExpression(argument, visit);
      break;
    case 'conditional':
      walkExpression(expression.test, visit);
      walkExpression(expression.consequent, visit);
      walkExpression(expression.alternate, visit);
      break;
    default:
      break;
  }
};

const walkStatements = (
  statements: ThemeScriptStatement[],
  visit: (statement: ThemeScriptStatement) => void
) => {
  for (const statement of statements) {
    visit(statement);
    if (statement.type === 'if') {
      walkStatements(statement.then, visit);
      if (statement.else) walkStatements(statement.else, visit);
    } else if (statement.type === 'repeat') {
      walkStatements(statement.body, visit);
    } else if (statement.type === 'for') {
      walkStatements(statement.init, visit);
      walkStatements(statement.update, visit);
      walkStatements(statement.body, visit);
    } else if (statement.type === 'while') {
      walkStatements(statement.body, visit);
    }
  }
};

/** Variable names read or written by a compiled script; `screen` is a builtin. */
export const themeScriptProgramVariables = (program: ThemeScriptProgram): string[] => {
  const names = new Set<string>();
  walkStatements(program, (statement) => {
    if (statement.type === 'set') names.add(statement.name);
    if (statement.type === 'toggleVariable') names.add(statement.name);
    if (statement.type === 'if')
      walkExpression(statement.condition, (expression) => {
        if (expression.type === 'variable' && expression.name !== 'screen')
          names.add(expression.name);
      });
    if (statement.type === 'repeat')
      walkExpression(statement.count, (expression) => {
        if (expression.type === 'variable' && expression.name !== 'screen')
          names.add(expression.name);
      });
    if (statement.type === 'for' && statement.test)
      walkExpression(statement.test, (expression) => {
        if (expression.type === 'variable' && expression.name !== 'screen')
          names.add(expression.name);
      });
    if (statement.type === 'while')
      walkExpression(statement.test, (expression) => {
        if (expression.type === 'variable' && expression.name !== 'screen')
          names.add(expression.name);
      });
    if (statement.type === 'set')
      walkExpression(statement.expression, (expression) => {
        if (expression.type === 'variable' && expression.name !== 'screen')
          names.add(expression.name);
      });
  });
  return [...names].filter((name) => !isThemeClockVariable(name));
};

export const themeScriptSourceVariables = (source: string): string[] => {
  const { program } = parseThemeScript(source);
  return program.length > 0 ? themeScriptProgramVariables(program) : [];
};

/** Whether a compiled script contains an action that leaves the launcher. */
export const themeScriptProgramCanLeaveLauncher = (program: ThemeScriptProgram): boolean => {
  let canLeave = false;
  walkStatements(program, (statement) => {
    if (statement.type === 'launch' || statement.type === 'openUrl') canLeave = true;
  });
  return canLeave;
};

export type ThemeScriptReferences = {
  elementIds: string[];
  groupIds: string[];
};

/** Layer and group ids referenced directly by a compiled script. */
export const themeScriptProgramReferences = (
  program: ThemeScriptProgram
): ThemeScriptReferences => {
  const elementIds = new Set<string>();
  const groupIds = new Set<string>();

  const collectExpression = (expression: ThemeScriptExpression) => {
    walkExpression(expression, (node) => {
      if (node.type !== 'call' || node.args.length === 0) return;
      const argument = node.args[0];
      if (argument.type !== 'literal' || typeof argument.value !== 'string') return;
      if (node.name === 'visible') elementIds.add(argument.value);
      if (node.name === 'groupVisible') groupIds.add(argument.value);
    });
  };

  walkStatements(program, (statement) => {
    if (statement.type === 'visibility') {
      if (statement.target === 'element') elementIds.add(statement.id);
      else groupIds.add(statement.id);
    }
    if (statement.type === 'if') collectExpression(statement.condition);
    if (statement.type === 'repeat') collectExpression(statement.count);
    if (statement.type === 'for' && statement.test) collectExpression(statement.test);
    if (statement.type === 'while') collectExpression(statement.test);
    if (statement.type === 'set') collectExpression(statement.expression);
  });

  return { elementIds: [...elementIds], groupIds: [...groupIds] };
};

const MAX_STEPS = 10000;
const MAX_REPEAT = 1000;

/** Execute a compiled script against theme state. Never evaluates JavaScript. */
export const executeThemeScript = (program: ThemeScriptProgram, runtime: ThemeScriptRuntime) => {
  let steps = 0;
  let stopped = false;
  let exhausted = false;

  const evaluate = (expression: ThemeScriptExpression) =>
    evaluateThemeScriptExpression(expression, runtime);

  const run = (statements: ThemeScriptStatement[]): boolean => {
    for (const statement of statements) {
      if (stopped) return true;
      steps += 1;
      if (steps > MAX_STEPS) {
        exhausted = true;
        return true;
      }

      switch (statement.type) {
        case 'set':
          runtime.variables[statement.name] = evaluate(statement.expression);
          break;
        case 'toggleVariable':
          runtime.variables[statement.name] = !booleanValue(
            runtime.variables[statement.name] ?? false
          );
          break;
        case 'visibility': {
          const visible =
            statement.mode === 'show'
              ? true
              : statement.mode === 'hide'
                ? false
                : statement.target === 'group'
                  ? !runtime.isGroupVisible(statement.id)
                  : !runtime.isVisible(statement.id);
          if (statement.target === 'group') runtime.setGroupVisible?.(statement.id, visible);
          else runtime.setElementVisible?.(statement.id, visible);
          break;
        }
        case 'navigate':
          runtime.navigate?.(statement.screen);
          break;
        case 'openUrl':
          if (runtime.allowExternal === true && /^https?:\/\//i.test(statement.url)) {
            runtime.openUrl?.(statement.url);
          }
          break;
        case 'launch':
          if (runtime.allowExternal === true) runtime.launch?.();
          break;
        case 'stop':
          stopped = true;
          return true;
        case 'if': {
          const branch = booleanValue(evaluate(statement.condition))
            ? statement.then
            : (statement.else ?? []);
          if (run(branch)) return true;
          break;
        }
        case 'repeat': {
          const count = Math.min(
            MAX_REPEAT,
            Math.max(0, Math.floor(numberValue(evaluate(statement.count))))
          );
          for (let index = 0; index < count; index += 1) {
            steps += 1;
            if (steps > MAX_STEPS) {
              exhausted = true;
              return true;
            }
            if (run(statement.body)) return true;
          }
          break;
        }
        case 'for': {
          if (run(statement.init)) return true;
          let iterations = 0;
          while (!statement.test || booleanValue(evaluate(statement.test))) {
            steps += 1;
            iterations += 1;
            if (steps > MAX_STEPS || iterations > MAX_REPEAT) {
              exhausted = true;
              return true;
            }
            if (run(statement.body)) return true;
            if (run(statement.update)) return true;
          }
          break;
        }
        case 'while': {
          let iterations = 0;
          while (booleanValue(evaluate(statement.test))) {
            steps += 1;
            iterations += 1;
            if (steps > MAX_STEPS || iterations > MAX_REPEAT) {
              exhausted = true;
              return true;
            }
            if (run(statement.body)) return true;
          }
          break;
        }
      }
    }
    return false;
  };

  run(program);
  return { stopped, exhausted };
};
